import "server-only";
import type { RowDataPacket } from "mysql2";
import type { Pool, PoolConnection } from "mysql2/promise";
import { db } from "@/lib/db";
import { date } from "./format";

// The customer's "Updates" feed (customer_updates): what happened on their
// account, newest first, in the portal and on the admin customer page.
// Actions call addUpdate()/updateForVehicles() after the change is saved;
// a failure here never undoes the change itself.

export const UPDATE_KINDS = ["reserved", "released", "payment", "shipping", "documents", "note"] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];

type Runner = Pool | PoolConnection;

export async function addUpdate(
  update: { customerId: number; stockId?: number | null; kind: UpdateKind; message: string; userId?: number | null },
  runner: Runner = db,
) {
  try {
    await runner.query(
      `INSERT INTO customer_updates (customer_account_id, stock_id, kind, message, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [update.customerId, update.stockId ?? null, update.kind, update.message.slice(0, 500), update.userId ?? null],
    );
  } catch (err) {
    console.error("Could not record customer update", err);
  }
}

/** "2021 Toyota Hilux (SKI-1042)" for each vehicle id, with its customer. */
export async function vehicleLabels(stockIds: number[]) {
  if (!stockIds.length) return new Map<number, { label: string; customerId: number | null }>();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT s.id, s.sid, s.year, s.model, m.name AS make, s.customer_account_id
     FROM stocks s LEFT JOIN makes m ON m.id = s.make_id WHERE s.id IN (?)`,
    [stockIds],
  );
  return new Map(
    rows.map((r) => [
      Number(r.id),
      {
        label: `${r.year} ${r.make ?? ""} ${r.model} (SKI-${r.sid})`.replace(/\s+/g, " "),
        customerId: r.customer_account_id ? Number(r.customer_account_id) : null,
      },
    ]),
  );
}

/** One update per reserved vehicle, to its customer; `message` gets the vehicle label. */
export async function updateForVehicles(
  stockIds: number[],
  kind: UpdateKind,
  message: (vehicle: string) => string,
  userId?: number | null,
) {
  const labels = await vehicleLabels(stockIds);
  for (const [stockId, v] of labels) {
    if (v.customerId) await addUpdate({ customerId: v.customerId, stockId, kind, message: message(v.label), userId });
  }
}

export const shipDates = (etd: Date | string, eta: Date | string) => `departs ${date(etd)}, arrives ${date(eta)}`;

export type CustomerUpdate = {
  id: number;
  kind: UpdateKind;
  message: string;
  created_at: Date;
  stock_id: number | null;
  sid: string | null;
  by_name: string | null;
};

export async function listUpdates(customerId: number, limit = 30): Promise<CustomerUpdate[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT cu.id, cu.kind, cu.message, cu.created_at, cu.stock_id, s.sid, u.name AS by_name
     FROM customer_updates cu
     LEFT JOIN stocks s ON s.id = cu.stock_id
     LEFT JOIN users u ON u.id = cu.user_id
     WHERE cu.customer_account_id = ?
     ORDER BY cu.created_at DESC, cu.id DESC LIMIT ?`,
    [customerId, limit],
  );
  return rows as CustomerUpdate[];
}
