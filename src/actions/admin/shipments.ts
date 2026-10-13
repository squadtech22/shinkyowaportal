"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { formReader, runAction, type ActionState } from "@/lib/admin/actions";
import { authorize, authorizeAny, NotAllowedError } from "@/lib/admin/auth";
import { setFlash } from "@/lib/admin/flash";
import { getShipment, shippableVehicles } from "@/lib/admin/shipments";
import { isShipmentStatus, SHIPMENT_STATUS_LABELS } from "@/lib/shipment-status";
import { isoDate } from "@/lib/admin/format";
import { shipDates, updateForVehicles } from "@/lib/admin/updates";

export async function saveShipment(id: number | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("shipments.manage");
    if (id && !(await getShipment(user, id))) throw new NotAllowedError();
    const f = formReader(form);
    const vesselName = f.text("vessel_name", { required: true, max: 255, label: "Vessel name" });
    const method = f.oneOf("method", ["roro", "container"] as const, "Shipping method");
    const containerNo = f.optional("container_no", 100);
    const blNo = f.optional("bl_no", 100);
    const etd = f.date("etd", { required: true, label: "Departure (ETD)" });
    const eta = f.date("eta", { required: true, label: "Arrival (ETA)" });
    if (etd && eta && !f.errors.etd && !f.errors.eta && eta < etd) f.errors.eta = "Arrival must be on or after departure";
    const statusValue = String(form.get("status") ?? "automatic");
    if (statusValue !== "automatic" && !isShipmentStatus(statusValue)) f.errors.status = "Choose a valid status";
    const status = isShipmentStatus(statusValue) ? statusValue : null;
    const selected = [...new Set(form.getAll("stock_ids").map(Number))].filter((n) => Number.isInteger(n) && n > 0);
    f.done();

    // Only vehicles the user can see may be added or removed; vehicles of
    // other agents' customers already on board are left alone.
    const allowed = new Set((await shippableVehicles(user, id)).map((v) => v.id));
    if (selected.some((s) => !allowed.has(s))) {
      return { error: "A chosen vehicle is no longer available. Reload the page and try again." };
    }

    // Before the save: what the customers were last told (Updates feed).
    const [[before]] = id
      ? await db.query<RowDataPacket[]>(
          `SELECT vessel_name, etd, eta, status, (SELECT GROUP_CONCAT(stock_id) FROM shipment_stock WHERE shipment_id = ?) AS cars
           FROM shipments WHERE id = ?`,
          [id, id],
        )
      : [[null]];
    const onBoardBefore = new Set(String(before?.cars ?? "").split(",").filter(Boolean).map(Number));

    const conn = await db.getConnection();
    let shipmentId = id;
    try {
      await conn.beginTransaction();
      if (id) {
        await conn.query(
          `UPDATE shipments SET vessel_name = ?, method = ?, container_no = ?, bl_no = ?, etd = ?, eta = ?, status = ?,
             updated_at = NOW() WHERE id = ?`,
          [vesselName, method, containerNo, blNo, etd, eta, status, id],
        );
        if (allowed.size) {
          await conn.query("DELETE FROM shipment_stock WHERE shipment_id = ? AND stock_id IN (?)", [id, [...allowed]]);
        }
      } else {
        const [res] = await conn.query<ResultSetHeader>(
          `INSERT INTO shipments (vessel_name, method, container_no, bl_no, etd, eta, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [vesselName, method, containerNo, blNo, etd, eta, status],
        );
        shipmentId = res.insertId;
      }
      if (selected.length) {
        await conn.query(
          "INSERT INTO shipment_stock (shipment_id, stock_id, created_at, updated_at) VALUES ?",
          [selected.map((stockId) => [shipmentId, stockId, new Date(), new Date()])],
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      if (err && typeof err === "object" && "code" in err && err.code === "ER_DUP_ENTRY") {
        return { error: "A chosen vehicle was just put on another vessel. Reload the page and try again." };
      }
      throw err;
    } finally {
      conn.release();
    }

    // Tell each customer what changed for their vehicle.
    const kept = selected.filter((s) => onBoardBefore.has(s));
    const removed = [...onBoardBefore].filter((s) => allowed.has(s) && !selected.includes(s));
    const rescheduled = before && (isoDate(before.etd) !== etd || isoDate(before.eta) !== eta || before.vessel_name !== vesselName);
    await updateForVehicles(
      selected.filter((s) => !onBoardBefore.has(s)),
      "shipping",
      (car) => `${car} is booked on ${vesselName}: ${shipDates(etd!, eta!)}.`,
      user.id,
    );
    if (rescheduled) {
      await updateForVehicles(kept, "shipping", (car) => `Shipping schedule changed for ${car}: ${vesselName} now ${shipDates(etd!, eta!)}.`, user.id);
    }
    if (before && (before.status ?? null) !== status && status) {
      await updateForVehicles(kept, "shipping", (car) => `${car}: shipment status is now ${SHIPMENT_STATUS_LABELS[status]}.`, user.id);
    }
    await updateForVehicles(removed, "shipping", (car) => `${car} is no longer on ${before?.vessel_name}. We will let you know its new vessel.`, user.id);
    await setFlash(id ? "Shipment updated" : "Shipment added");
    revalidatePath("/admin", "layout");
    redirect("/admin/shipments");
  });
}

/** Sets the status by hand ("automatic" follows the dates again); nothing else changes. */
export async function updateShipmentStatus(id: number, statusValue: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorizeAny("shipments.manage", "shipments.status");
    if (statusValue !== "automatic" && !isShipmentStatus(statusValue)) return { error: "Choose a valid status." };
    if (!Number.isSafeInteger(id) || !(await getShipment(user, id))) throw new NotAllowedError();
    const status = statusValue === "automatic" ? null : statusValue;
    await db.query("UPDATE shipments SET status = ?, updated_at = NOW() WHERE id = ?", [status, id]);
    if (status) {
      // Every customer with a vehicle on this vessel hears about it.
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT ss.stock_id, sh.vessel_name FROM shipment_stock ss JOIN shipments sh ON sh.id = ss.shipment_id WHERE ss.shipment_id = ?",
        [id],
      );
      const word = { upcoming: "is loading", at_sea: "is at sea", arrived: "has arrived" }[status];
      await updateForVehicles(rows.map((r) => Number(r.stock_id)), "shipping", (car) => `${car} ${word} (${rows[0]?.vessel_name}).`, user.id);
    }
    const message = status ? `Status changed to ${SHIPMENT_STATUS_LABELS[status]}` : "Status now follows the ETD/ETA dates";
    await setFlash(message);
    revalidatePath("/admin", "layout");
    revalidatePath("/client", "layout");
    return { ok: true, message };
  });
}

export async function deleteShipment(id: number): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("shipments.manage");
    const data = await getShipment(user, id);
    if (!data) throw new NotAllowedError();
    if (data.hidden > 0) {
      return { error: "This vessel also carries vehicles of customers you cannot see. Ask a manager to delete it." };
    }
    // The vehicles stay reserved; they are just no longer on a vessel.
    await db.query("DELETE FROM shipments WHERE id = ?", [id]);
    await setFlash("Shipment deleted");
    revalidatePath("/admin", "layout");
    redirect("/admin/shipments");
  });
}
