"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { DOCUMENT_KEYS } from "@/lib/documents";
import { formReader, runAction, ValidationError, type ActionState } from "@/lib/admin/actions";
import { assignableAgents, authorize, can, customerScope, NotAllowedError, type AdminUser } from "@/lib/admin/auth";
import { POINTS_PER_RESERVATION } from "@/lib/admin/customers";
import { setFlash } from "@/lib/admin/flash";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/admin/password";
import { addUpdate, updateForVehicles, vehicleLabels } from "@/lib/admin/updates";

async function assertCustomer(user: AdminUser, id: number, executor: Pick<PoolConnection, "query"> = db) {
  const scope = customerScope(user);
  const [rows] = await executor.query<RowDataPacket[]>(
    `SELECT c.id FROM customer_accounts c WHERE c.id = ? AND ${scope.sql}`,
    [id, ...scope.params],
  );
  if (!rows.length) throw new NotAllowedError();
}

/** Runs queries on one connection inside a transaction. */
async function transaction<T>(body: (conn: PoolConnection) => Promise<T>) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await body(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function saveCustomer(id: number | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.manage");
    if (id) await assertCustomer(user, id);
    const f = formReader(form);
    const agents = await assignableAgents(user);
    const data = {
      name: f.text("name", { required: true, max: 100, label: "Name" }),
      company: f.text("company", { max: 200, label: "Company" }),
      email: f.email("email"),
      phone: f.text("phone", { max: 20, label: "Phone" }),
      whatsapp: f.text("whatsapp", { max: 20, label: "WhatsApp" }),
      address: f.text("address", { max: 255, label: "Address" }),
      city: f.text("city", { max: 255, label: "City" }),
      countryId: f.id("country_id"),
      currencyId: f.id("currency_id", { required: true, label: "Currency" }),
      description: f.optional("description", 5000),
      agentId: agents ? f.id("agent_id") : null,
    };
    // Users who see every customer may leave one unassigned; team leaders
    // must pick someone in their team, or the customer drops out of sight.
    if (agents && data.agentId && !agents.some((a) => a.id === data.agentId)) f.errors.agent_id = "Choose someone from the list";
    else if (agents && !data.agentId && !can(user, "customers.view_all")) f.errors.agent_id = "Choose who looks after this customer";

    // Customer portal login: email + password. Required for new customers
    // with an email; on edit an empty password keeps the current one.
    const password = String(form.get("portal_password") ?? "");
    const removeAccess = f.checked("portal_remove");
    if (!id && !data.email && !f.errors.email) {
      // Every new customer gets a portal login, so they can follow their vehicles.
      f.errors.email = "Add an email — the customer signs in to the portal with it";
    } else if (password && password.length < MIN_PASSWORD_LENGTH) {
      f.errors.portal_password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    } else if (password && !data.email) {
      f.errors.email = "Add an email — the customer signs in with it";
    } else if (!id && data.email && !password) {
      f.errors.portal_password = "Set a password so the customer can sign in to the portal";
    }
    f.done();

    if (id) {
      const [[account]] = await db.query<RowDataPacket[]>(
        `SELECT currency_id,
                (SELECT COUNT(*) FROM stocks WHERE customer_account_id = ?) AS cars,
                (SELECT COUNT(*) FROM payments WHERE customer_account_id = ?) AS payments
         FROM customer_accounts WHERE id = ?`,
        [id, id, id],
      );
      if (Number(account.currency_id) !== data.currencyId && (Number(account.cars) || Number(account.payments))) {
        throw new ValidationError({ currency_id: "This account already has reservations or payments. Keep its currency to preserve the recorded amounts." });
      }
    }

    const passwordHash = password && !removeAccess ? await hashPassword(password) : null;
    const values = [
      data.name, data.company, data.email, data.phone, data.whatsapp, data.address, data.city, data.countryId,
      data.currencyId, data.description,
    ];
    let customerId = id;
    if (id) {
      // Without a choice of agent, the customer keeps the current one.
      await db.query(
        `UPDATE customer_accounts SET name = ?, company = ?, email = ?, phone = ?, whatsapp = ?, address = ?, city = ?,
           country_id = ?, currency_id = ?, description = ?, agent_id = IF(?, ?, agent_id),
           password = IF(?, NULL, COALESCE(?, password)), updated_at = NOW()
         WHERE id = ?`,
        [...values, agents ? 1 : 0, data.agentId, removeAccess ? 1 : 0, passwordHash, id],
      );
      // A new password or removed access signs the customer out everywhere.
      if (passwordHash || removeAccess) await db.query("DELETE FROM client_sessions WHERE customer_account_id = ?", [id]);
      await setFlash("Customer updated");
    } else {
      // Customer number C-00001 is derived from the id after insert.
      const [res] = await db.query<ResultSetHeader>(
        `INSERT INTO customer_accounts (cid, name, company, email, phone, whatsapp, address, city, country_id,
           currency_id, description, agent_id, password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [`tmp-${randomBytes(8).toString("hex")}`, ...values, agents ? data.agentId : user.id, passwordHash],
      );
      customerId = res.insertId;
      await db.query("UPDATE customer_accounts SET cid = CONCAT('C-', LPAD(id, 5, '0')) WHERE id = ?", [customerId]);
      await setFlash(passwordHash ? "Customer added — they can now sign in at /client" : "Customer added");
    }
    revalidatePath("/admin", "layout");
    redirect(`/admin/customers/${customerId}`);
  });
}

export async function deleteCustomer(id: number): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.manage");
    await assertCustomer(user, id);
    const [[usage]] = await db.query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM stocks WHERE customer_account_id = ?) AS cars,
              (SELECT COUNT(*) FROM payments WHERE customer_account_id = ?) AS payments`,
      [id, id],
    );
    if (usage.cars > 0 || usage.payments > 0) {
      return { error: "This customer still has reserved vehicles or payments. Remove those first." };
    }
    // Portal sessions and loyalty points go with the account (ON DELETE CASCADE).
    await db.query("DELETE FROM customer_accounts WHERE id = ?", [id]);
    await setFlash("Customer deleted");
    revalidatePath("/admin", "layout");
    redirect("/admin/customers");
  });
}

/** Reserves the vehicle and awards the customer their loyalty points. */
async function reserve(user: AdminUser, customerId: number, form: FormData) {
  const f = formReader(form);
  const stockId = f.id("stock_id", { required: true, label: "Vehicle" });
  const cnf = f.int("cnf", { required: true, min: 1, label: "CNF price" });
  f.done();
  await transaction(async (conn) => {
    const [res] = await conn.query<ResultSetHeader>(
      `UPDATE stocks SET customer_account_id = ?, cnf = ?, agent_id = ?, updated_at = NOW()
       WHERE id = ? AND customer_account_id IS NULL`,
      [customerId, cnf, user.id, stockId],
    );
    if (res.affectedRows === 0) {
      throw new ValidationError({ stock_id: "That vehicle was just reserved by someone else" });
    }
    await conn.query(
      `INSERT INTO points (customer_account_id, points, created_at, updated_at) VALUES (?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE points = points + VALUES(points), updated_at = NOW()`,
      [customerId, POINTS_PER_RESERVATION],
    );
  });
  await updateForVehicles([stockId!], "reserved", (car) => `${car} is reserved for you.`, user.id);
  await setFlash(`Vehicle reserved · +${POINTS_PER_RESERVATION} loyalty points`);
  revalidatePath("/admin", "layout");
}

/** Reserve an available vehicle for the customer at a CNF (sale) price. */
export async function reserveVehicle(customerId: number, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.manage");
    await assertCustomer(user, customerId);
    await reserve(user, customerId, form);
    return { ok: true };
  });
}

/** Same as reserveVehicle, with the customer chosen on the form (Reserved vehicles page). */
export async function reserveVehicleForCustomer(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.manage");
    const f = formReader(form);
    const customerId = f.id("customer_account_id", { required: true, label: "Customer" });
    f.done();
    await assertCustomer(user, customerId!);
    await reserve(user, customerId!, form);
    return { ok: true };
  });
}

export async function updateReservationPrice(stockId: number, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.manage");
    const [rows] = await db.query<RowDataPacket[]>("SELECT customer_account_id FROM stocks WHERE id = ?", [stockId]);
    if (!rows[0]?.customer_account_id) throw new NotAllowedError();
    await assertCustomer(user, rows[0].customer_account_id);
    const f = formReader(form);
    const cnf = f.int("cnf", { required: true, min: 1, label: "CNF price" });
    f.done();
    await db.query("UPDATE stocks SET cnf = ?, updated_at = NOW() WHERE id = ?", [cnf, stockId]);
    await setFlash("Price updated");
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

/** Staff write an update the customer sees in their portal, about one vehicle or the whole account. */
export async function postCustomerUpdate(customerId: number, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.manage");
    await assertCustomer(user, customerId);
    const f = formReader(form);
    const message = f.text("message", { required: true, max: 500, label: "Update" });
    const stockId = f.id("stock_id");
    f.done();
    if (stockId) {
      const [rows] = await db.query<RowDataPacket[]>("SELECT id FROM stocks WHERE id = ? AND customer_account_id = ?", [stockId, customerId]);
      if (!rows.length) throw new ValidationError({ stock_id: "Choose one of this customer's vehicles" });
    }
    await addUpdate({ customerId, stockId, kind: "note", message, userId: user.id });
    revalidatePath(`/admin/customers/${customerId}`);
    revalidatePath("/client");
    return { ok: true, message: "Update sent — the customer sees it in their portal" };
  });
}

export async function releaseVehicle(stockId: number): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.manage");
    const label = (await vehicleLabels([stockId])).get(stockId)?.label;
    const customerId = await transaction(async (conn) => {
      const [[stock]] = await conn.query<RowDataPacket[]>(
        "SELECT customer_account_id FROM stocks WHERE id = ? FOR UPDATE", [stockId],
      );
      const customerId = stock?.customer_account_id;
      if (!customerId) throw new ValidationError({ stock_id: "This vehicle is not reserved." });
      await assertCustomer(user, customerId, conn);
      const [[usage]] = await conn.query<RowDataPacket[]>(
        `SELECT (SELECT COUNT(*) FROM payments WHERE stock_id = ?) AS payments,
                (SELECT COUNT(*) FROM shipment_stock WHERE stock_id = ?) AS shipments,
                (SELECT COUNT(*) FROM documents WHERE stock_id = ? AND (${DOCUMENT_KEYS.map((key) => `NULLIF(${key}, '') IS NOT NULL`).join(" OR ")})) AS documents,
                (SELECT COUNT(*) FROM commissions WHERE stock_id = ?) AS commissions`,
        [stockId, stockId, stockId, stockId],
      );
      if (Number(usage.payments) || Number(usage.shipments) || Number(usage.documents) || Number(usage.commissions)) {
        throw new ValidationError({ stock_id: "Remove this vehicle's payments, shipment, documents and commissions before releasing its reservation." });
      }
      await conn.query(
        "UPDATE stocks SET customer_account_id = NULL, cnf = NULL, agent_id = NULL, updated_at = NOW() WHERE id = ?",
        [stockId],
      );
      // Take back the points the reservation earned, never below zero.
      await conn.query(
        "UPDATE points SET points = GREATEST(points - ?, 0), updated_at = NOW() WHERE customer_account_id = ?",
        [POINTS_PER_RESERVATION, customerId],
      );
      return Number(customerId);
    });
    if (label) await addUpdate({ customerId, kind: "released", message: `${label} is no longer reserved for you.`, userId: user.id });
    await setFlash("Reservation released — the vehicle is available again");
    revalidatePath("/admin", "layout");
  });
}
