"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { formReader, runAction, ValidationError, type ActionState } from "@/lib/admin/actions";
import { authorize, can, customerScope, NotAllowedError, type AdminUser } from "@/lib/admin/auth";
import { setFlash } from "@/lib/admin/flash";
import { deleteUpload, filesFrom, saveUpload } from "@/lib/uploads";
import { dateTime, money } from "@/lib/admin/format";
import { addUpdate } from "@/lib/admin/updates";

// The payment flow (see lib/admin/payments.ts): staff record an advance, and
// later each payment of its pending balance; the admin (payments.approve)
// approves each one as received or rejects it as not received.

/** Throws unless the customer exists and is visible to the user. */
async function assertCustomer(user: AdminUser, customerId: number) {
  const scope = customerScope(user);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.id FROM customer_accounts c WHERE c.id = ? AND ${scope.sql}`,
    [customerId, ...scope.params],
  );
  if (!rows.length) throw new NotAllowedError();
}

async function loadPayment(user: AdminUser, id: number) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, customer_account_id, stock_id, description, amount, status, kind, parent_id, pending_amount, file,
       (SELECT COUNT(*) FROM payments b WHERE b.parent_id = payments.id AND b.status = 'approved') AS approved_balances,
       GREATEST(COALESCE(pending_amount, 0) - (SELECT COALESCE(SUM(b.amount), 0) FROM payments b
         WHERE b.parent_id = payments.id AND b.status = 'approved'), 0) AS remaining
     FROM payments WHERE id = ?`,
    [id],
  );
  const payment = rows[0];
  if (!payment) throw new NotAllowedError();
  await assertCustomer(user, payment.customer_account_id);
  return payment;
}

function readPayment(form: FormData) {
  const f = formReader(form);
  const data = {
    customerId: f.id("customer_account_id", { required: true, label: "Customer" }),
    stockId: f.id("stock_id"),
    description: f.text("description", { required: true, max: 255, label: "Description" }),
    paymentDate: f.date("payment_date", { required: true, label: "Payment date" }),
    amount: f.int("amount", { required: true, min: 0, label: "Advance" }),
    inYen: f.int("in_yen", { required: true, min: 0, label: "Advance in yen" }),
    pendingAmount: f.int("pending_amount", { min: 0, label: "Pending" }) || null,
    pendingDueAt: null as string | null,
    receivedDate: f.date("payment_recieved_date"),
  };
  // <input type="datetime-local"> sends YYYY-MM-DDTHH:MM.
  const due = f.raw("pending_due_at");
  if (due && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(due) || !Number.isFinite(new Date(due).getTime()))) f.errors.pending_due_at = "Enter a valid date and time";
  else if (due) data.pendingDueAt = `${due.replace("T", " ")}:00`;
  if (data.pendingAmount && !due) f.errors.pending_due_at = "When should the pending balance be paid?";
  if (!data.pendingAmount && due) f.errors.pending_amount = "Enter the pending amount, or clear the due date";
  if (data.amount === 0 && !data.pendingAmount && !f.errors.amount) f.errors.amount = "Enter the advance or a pending balance";
  f.done();
  return data;
}

/** A payment of a pending balance: at most `max` USD. */
function readBalancePayment(form: FormData, max: number) {
  const f = formReader(form);
  const data = {
    amount: f.int("amount", { required: true, min: 1, max, label: "Amount paid" }),
    inYen: f.int("in_yen", { required: true, min: 0, label: "Amount in yen" }),
    paymentDate: f.date("payment_date", { required: true, label: "Payment date" }),
    receivedDate: f.date("payment_recieved_date"),
  };
  f.done();
  return data;
}

/**
 * The status after a save: approvers choose with the "Approved" tick; for
 * anyone else it stays as it was, except that a rejected payment they correct
 * goes back to waiting for approval.
 */
function nextStatus(user: AdminUser, form: FormData, current: string | null) {
  if (can(user, "payments.approve")) return form.get("status") === "approved" ? "approved" : "not approved";
  return current === "approved" ? "approved" : "not approved";
}

/** Tells the customer (portal Updates) that a payment was received, or that one is being checked. */
async function paymentUpdate(
  customerId: number,
  stockId: number | null,
  status: string,
  amount: number,
  what: string,
  userId: number,
  pendingAmount?: number | null,
  pendingDueAt?: string | null,
) {
  const sum = money(amount, "$");
  const balance = pendingAmount && pendingDueAt ? ` Remaining balance: ${money(pendingAmount, "$")}, due ${dateTime(pendingDueAt)}.` : "";
  const message =
    status === "approved"
      ? `We received your ${what === "balance payment" ? "balance payment" : "payment"} of ${sum} — thank you.${balance}`
      : `We have your payment notice of ${sum} (${what}). We'll confirm it as soon as it reaches our bank.${balance}`;
  if (amount > 0 || balance) await addUpdate({ customerId, stockId, kind: "payment", message, userId });
}

const flashFor = (status: string, what: string) =>
  status === "approved" ? `${what} recorded and approved` : `${what} recorded — waiting for the admin to approve it`;

export async function savePayment(id: number | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("payments.manage");
    const existing = id ? await loadPayment(user, id) : null;
    if (existing?.status === "approved" && !can(user, "payments.approve")) throw new NotAllowedError();
    const status = nextStatus(user, form, existing?.status ?? null);
    const reviewed = status === "approved" && existing?.status !== "approved";

    // A balance payment keeps its customer, vehicle and description; it may
    // not exceed what is left of the balance besides itself.
    let data: ReturnType<typeof readPayment>;
    if (existing?.kind === "balance") {
      const parent = await loadPayment(user, existing.parent_id);
      // `remaining` already has this payment taken off when it is approved.
      const max = Number(parent.remaining) + (existing.status === "approved" ? Number(existing.amount) : 0);
      const b = readBalancePayment(form, Math.max(max, 1));
      data = {
        customerId: existing.customer_account_id, stockId: existing.stock_id, description: existing.description,
        paymentDate: b.paymentDate, amount: b.amount, inYen: b.inYen, pendingAmount: null, pendingDueAt: null,
        receivedDate: b.receivedDate,
      };
    } else {
      data = readPayment(form);
      await assertCustomer(user, data.customerId!);
      // The vehicle, if given, must be reserved for this customer.
      if (data.stockId) {
        const [rows] = await db.query<RowDataPacket[]>(
          "SELECT id FROM stocks WHERE id = ? AND customer_account_id = ?",
          [data.stockId, data.customerId],
        );
        if (!rows.length) throw new ValidationError({ stock_id: "Choose a vehicle reserved for this customer" });
      }
    }

    const [file] = filesFrom(form, "file");
    const stored = file ? await saveUpload(file, "payments") : null;

    if (id) {
      const [updated] = await db.query<ResultSetHeader>(
        `UPDATE payments SET customer_account_id = ?, stock_id = ?, description = ?, payment_date = ?, amount = ?,
           in_yen = ?, pending_amount = ?, pending_due_at = ?, payment_recieved_date = ?, file = COALESCE(?, file),
           status = ?, reject_reason = NULL,
           reviewed_by = IF(?, ?, IF(? = 'approved', reviewed_by, NULL)),
           reviewed_at = IF(?, NOW(), IF(? = 'approved', reviewed_at, NULL)), updated_at = NOW()
         WHERE id = ? AND (? OR status <> 'approved')`,
        [
          data.customerId, data.stockId, data.description, data.paymentDate, data.amount, data.inYen,
          data.pendingAmount, data.pendingDueAt, data.receivedDate, stored, status,
          reviewed ? 1 : 0, user.id, status, reviewed ? 1 : 0, status,
          id, can(user, "payments.approve") ? 1 : 0,
        ],
      );
      if (!updated.affectedRows) {
        if (stored) await deleteUpload(stored, "payments");
        throw new NotAllowedError();
      }
      if (stored) await deleteUpload(existing!.file, "payments");
      await setFlash(
        status === "approved" ? "Payment updated" : existing?.status === "rejected"
          ? "Payment corrected and sent to the admin again"
          : "Payment updated — waiting for the admin to approve it",
      );
    } else {
      await db.query(
        `INSERT INTO payments (customer_account_id, stock_id, description, payment_date, amount, in_yen,
           pending_amount, pending_due_at, payment_recieved_date, file, status, kind, reviewed_by, reviewed_at,
           user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'advance', ?, IF(?, NOW(), NULL), ?, NOW(), NOW())`,
        [
          data.customerId, data.stockId, data.description, data.paymentDate, data.amount, data.inYen,
          data.pendingAmount, data.pendingDueAt, data.receivedDate, stored, status,
          reviewed ? user.id : null, reviewed ? 1 : 0, user.id,
        ],
      );
      await paymentUpdate(data.customerId!, data.stockId, status, data.amount!, data.description, user.id, data.pendingAmount, data.pendingDueAt);
      await setFlash(flashFor(status, "Payment"));
    }
    revalidatePath("/admin", "layout");
    redirect(form.get("return_to") === "customer" ? `/admin/customers/${data.customerId}` : "/admin/payments");
  });
}

/** "Customer paid the balance": records a payment of the pending balance of advance `parentId`. */
export async function recordBalancePayment(parentId: number, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("payments.manage");
    const parent = await loadPayment(user, parentId);
    if (parent.kind !== "advance" || !Number(parent.remaining)) {
      return { error: "This payment has no balance left to pay." };
    }
    if (parent.status === "rejected") {
      return { error: "The admin marked the advance as not received. Correct it first." };
    }
    const data = readBalancePayment(form, Number(parent.remaining));
    const status = nextStatus(user, form, null);
    const [file] = filesFrom(form, "file");
    const stored = file ? await saveUpload(file, "payments") : null;
    await db.query(
      `INSERT INTO payments (customer_account_id, stock_id, description, payment_date, amount, in_yen,
         payment_recieved_date, file, status, kind, parent_id, reviewed_by, reviewed_at, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'balance', ?, ?, IF(?, NOW(), NULL), ?, NOW(), NOW())`,
      [
        parent.customer_account_id, parent.stock_id, `Balance — ${parent.description}`.slice(0, 255), data.paymentDate,
        data.amount, data.inYen, data.receivedDate, stored, status, parent.id,
        status === "approved" ? user.id : null, status === "approved" ? 1 : 0, user.id,
      ],
    );
    await paymentUpdate(parent.customer_account_id, parent.stock_id, status, data.amount!, "balance payment", user.id);
    await setFlash(flashFor(status, "Balance payment"));
    revalidatePath("/admin", "layout");
    redirect(form.get("return_to") === "customer" ? `/admin/customers/${parent.customer_account_id}` : "/admin/payments");
  });
}

/** Admin: the money arrived. */
export async function approvePayment(id: number): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("payments.approve");
    const p = await loadPayment(user, id);
    await db.query(
      `UPDATE payments SET status = 'approved', reject_reason = NULL, reviewed_by = ?, reviewed_at = NOW(),
         payment_recieved_date = COALESCE(payment_recieved_date, CURDATE()), updated_at = NOW() WHERE id = ?`,
      [user.id, id],
    );
    await paymentUpdate(p.customer_account_id, p.stock_id, "approved", Number(p.amount), p.kind === "balance" ? "balance payment" : p.description, user.id);
    await setFlash("Payment approved — money received");
    revalidatePath("/admin", "layout");
  });
}

/** Admin: the money did not arrive; the reason is shown to whoever recorded it. */
export async function rejectPayment(id: number, reason: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("payments.approve");
    const p = await loadPayment(user, id);
    const why = String(reason ?? "").trim();
    if (!why) return { error: "Say why, e.g. “TT not in the bank yet”." };
    if (why.length > 255) return { error: "Keep the reason under 255 characters." };
    await db.query(
      `UPDATE payments SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [why, user.id, id],
    );
    await addUpdate({
      customerId: p.customer_account_id, stockId: p.stock_id, kind: "payment", userId: user.id,
      message: `Your payment of ${money(Number(p.amount), "$")} has not reached our bank yet: ${why}. Please check with your bank or your sales agent.`,
    });
    await setFlash("Payment marked as not received");
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

/** Admin: back to waiting for approval. */
export async function unapprovePayment(id: number): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("payments.approve");
    await loadPayment(user, id);
    await db.query(
      `UPDATE payments SET status = 'not approved', reject_reason = NULL, reviewed_by = NULL, reviewed_at = NULL,
         updated_at = NOW() WHERE id = ?`,
      [id],
    );
    await setFlash("Payment moved back to waiting for approval");
    revalidatePath("/admin", "layout");
  });
}

export async function deletePayment(id: number): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("payments.manage");
    const payment = await loadPayment(user, id);
    // Approved money (this payment, or a balance paid on it) is the admin's to remove.
    if ((payment.status === "approved" || Number(payment.approved_balances) > 0) && !can(user, "payments.approve")) {
      throw new NotAllowedError();
    }
    const [balances] = await db.query<RowDataPacket[]>("SELECT file FROM payments WHERE parent_id = ?", [id]);
    await db.query("DELETE FROM payments WHERE id = ?", [id]);
    await Promise.all([payment.file, ...balances.map((b) => b.file)].map((file) => deleteUpload(file, "payments")));
    await setFlash(balances.length ? "Payment and its balance payments deleted" : "Payment deleted");
    revalidatePath("/admin", "layout");
  });
}
