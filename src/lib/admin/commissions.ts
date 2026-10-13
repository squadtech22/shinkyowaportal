import "server-only";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { db } from "@/lib/db";
import { ledger } from "./finance";

// Staff commission, paid monthly, in JPY. Someone with commission.manage adds
// commission to sold vehicles (a percentage of the vehicle's profit from the
// purchase ledger, or a fixed amount); each commission belongs to a month
// (period 'YYYY-MM'). commission.approve approves a staff member's month,
// which creates a payout; commission.pay marks the payout complete. Commission
// added after a staff member's month was approved goes into the next month.

export const COMMISSION_STATUSES = ["pending", "approved", "paid"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];
export type CommissionType = "percent" | "fixed";

export const COMMISSION_STATUS_INFO: Record<CommissionStatus, { label: string; tone: "amber" | "blue" | "green" }> = {
  pending: { label: "Waiting for approval", tone: "amber" },
  approved: { label: "Approved — with finance", tone: "blue" },
  paid: { label: "Completed", tone: "green" },
};

const pad = (n: number) => String(n).padStart(2, "0");

/** 'YYYY-MM' of a date (default: today). */
export const periodOf = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export const isPeriod = (s: string | undefined): s is string => /^\d{4}-(0[1-9]|1[0-2])$/.test(s ?? "");

export function shiftPeriod(period: string, months: number) {
  const [y, m] = period.split("-").map(Number);
  return periodOf(new Date(y, m - 1 + months, 1));
}

/** "October 2026". */
export function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** The commission in JPY; percent commissions need the vehicle's profit (a loss gives 0). */
export function commissionAmount(type: CommissionType, rate: number, profit: number | null) {
  if (type === "fixed") return Math.round(rate);
  if (profit === null) return null;
  return Math.max(0, Math.round((profit * rate) / 100));
}

/** "10% of profit" / "Fixed per vehicle". */
export function commissionBasis(type: CommissionType, rate: number) {
  return type === "percent" ? `${rate}% of profit` : "Fixed per vehicle";
}

/** Profit of one vehicle as shown in the purchase ledger (null when incomplete). */
export async function vehicleProfit(stockId: number) {
  const [row] = await ledger({ year: null, stockId });
  return row ?? null;
}

export type CommissionRow = {
  id: number;
  stockId: number | null;
  vehicle: string;
  sid: string | null;
  chassis: string | null;
  customer: string | null;
  userId: number;
  user: string;
  period: string;
  type: CommissionType;
  rate: number;
  profit: number | null;
  amount: number;
  note: string | null;
  status: CommissionStatus;
  payoutId: number | null;
  createdBy: string | null;
  createdAt: Date;
};

export async function listCommissions(filters: { period?: string; userIds?: number[]; payoutId?: number }): Promise<CommissionRow[]> {
  const where = ["1 = 1"];
  const params: unknown[] = [];
  if (filters.period) {
    where.push("k.period = ?");
    params.push(filters.period);
  }
  if (filters.payoutId) {
    where.push("k.payout_id = ?");
    params.push(filters.payoutId);
  }
  if (filters.userIds) {
    if (!filters.userIds.length) return [];
    where.push("k.user_id IN (?)");
    params.push(filters.userIds);
  }
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT k.*, s.sid, s.year, s.model, s.chassis, m.name AS make, c.name AS customer, c.company,
            u.name AS user_name, cb.name AS created_by_name
     FROM commissions k
     JOIN users u ON u.id = k.user_id
     LEFT JOIN stocks s ON s.id = k.stock_id
     LEFT JOIN makes m ON m.id = s.make_id
     LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
     LEFT JOIN users cb ON cb.id = k.created_by
     WHERE ${where.join(" AND ")}
     ORDER BY k.period DESC, u.name, k.id DESC`,
    params,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    stockId: r.stock_id === null ? null : Number(r.stock_id),
    vehicle: r.sid ? `${r.year} ${r.make ?? ""} ${r.model}`.replace(/\s+/g, " ").trim() : "Vehicle removed",
    sid: r.sid,
    chassis: r.chassis,
    customer: r.company || r.customer || null,
    userId: Number(r.user_id),
    user: String(r.user_name),
    period: String(r.period),
    type: r.type,
    rate: Number(r.rate),
    profit: r.profit === null ? null : Number(r.profit),
    amount: Number(r.amount),
    note: r.note,
    status: r.status,
    payoutId: r.payout_id === null ? null : Number(r.payout_id),
    createdBy: r.created_by_name,
    createdAt: r.created_at,
  }));
}

export type PayoutRow = {
  id: number;
  userId: number;
  user: string;
  period: string;
  amount: number;
  cars: number;
  status: "approved" | "paid";
  approvedBy: string | null;
  approvedAt: Date | null;
  paidBy: string | null;
  paidAt: Date | null;
  paymentRef: string | null;
};

export async function listPayouts(filters: { status?: "approved" | "paid"; period?: string; userIds?: number[] }): Promise<PayoutRow[]> {
  const where = ["1 = 1"];
  const params: unknown[] = [];
  if (filters.status) {
    where.push("p.status = ?");
    params.push(filters.status);
  }
  if (filters.period) {
    where.push("p.period = ?");
    params.push(filters.period);
  }
  if (filters.userIds) {
    if (!filters.userIds.length) return [];
    where.push("p.user_id IN (?)");
    params.push(filters.userIds);
  }
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.*, u.name AS user_name, ab.name AS approved_by_name, pb.name AS paid_by_name,
            (SELECT COUNT(*) FROM commissions k WHERE k.payout_id = p.id) AS cars
     FROM commission_payouts p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN users ab ON ab.id = p.approved_by
     LEFT JOIN users pb ON pb.id = p.paid_by
     WHERE ${where.join(" AND ")}
     ORDER BY p.period DESC, u.name`,
    params,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    userId: Number(r.user_id),
    user: String(r.user_name),
    period: String(r.period),
    amount: Number(r.amount),
    cars: Number(r.cars),
    status: r.status,
    approvedBy: r.approved_by_name,
    approvedAt: r.approved_at,
    paidBy: r.paid_by_name,
    paidAt: r.paid_at,
    paymentRef: r.payment_ref,
  }));
}

/** One staff member's month: their commission rows and payout, if approved. */
export type MonthGroup = {
  userId: number;
  user: string;
  rows: CommissionRow[];
  amount: number;
  payout: PayoutRow | null;
  /** pending: not approved yet (also when commission was added after approval). */
  status: CommissionStatus;
};

/** The month's commission grouped by staff member. */
export async function monthGroups(period: string): Promise<MonthGroup[]> {
  const [rows, payouts] = await Promise.all([listCommissions({ period }), listPayouts({ period })]);
  const groups = new Map<number, MonthGroup>();
  for (const r of rows) {
    const g = groups.get(r.userId) ?? { userId: r.userId, user: r.user, rows: [], amount: 0, payout: null, status: "paid" as CommissionStatus };
    g.rows.push(r);
    g.amount += r.amount;
    groups.set(r.userId, g);
  }
  for (const g of groups.values()) {
    g.payout = payouts.find((p) => p.userId === g.userId) ?? null;
    g.status = g.rows.some((r) => r.status === "pending") ? "pending" : g.rows.some((r) => r.status === "approved") ? "approved" : "paid";
  }
  return [...groups.values()].sort((a, b) => a.user.localeCompare(b.user));
}

/**
 * The month new commission for this staff member goes into: the current
 * month, or the first later one whose payout has not been approved yet.
 */
export async function openPeriodFor(userId: number, executor: Pick<PoolConnection, "query"> = db) {
  const [rows] = await executor.query<RowDataPacket[]>("SELECT period FROM commission_payouts WHERE user_id = ?", [userId]);
  const closed = new Set(rows.map((r) => String(r.period)));
  let period = periodOf();
  while (closed.has(period)) period = shiftPeriod(period, 1);
  return period;
}

/** Months that have commission, newest first, always including the current one. */
export async function commissionPeriods() {
  const [rows] = await db.query<RowDataPacket[]>("SELECT DISTINCT period FROM commissions ORDER BY period DESC");
  const set = new Set([periodOf(), ...rows.map((r) => String(r.period))]);
  return [...set].sort().reverse();
}

/**
 * Sold vehicles (with a sale price and a salesperson) that have no
 * commission for that salesperson yet, with the salesperson's default rate.
 */
export async function vehiclesWithoutCommission(userIds?: number[]) {
  const [rows, [rates], [existing]] = await Promise.all([
    ledger({ year: null }),
    db.query<RowDataPacket[]>("SELECT id, commission_type, commission_value FROM users"),
    db.query<RowDataPacket[]>("SELECT stock_id, user_id FROM commissions WHERE stock_id IS NOT NULL"),
  ]);
  const done = new Set(existing.map((e) => `${e.stock_id}:${e.user_id}`));
  const rateOf = new Map(rates.map((r) => [Number(r.id), r]));
  return rows
    .filter((r) => r.cnf && r.agentId && !done.has(`${r.id}:${r.agentId}`))
    .filter((r) => !userIds || userIds.includes(r.agentId!))
    .map((r) => {
      const rate = rateOf.get(r.agentId!);
      const type = (rate?.commission_type ?? null) as CommissionType | null;
      const value = rate?.commission_value === null || rate?.commission_value === undefined ? null : Number(rate.commission_value);
      return {
        ...r,
        defaultType: type,
        defaultRate: value,
        suggested: type && value !== null ? commissionAmount(type, value, r.profit) : null,
      };
    });
}

/** The people who report to this user (for team totals). */
export async function teamMembers(userId: number) {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, name FROM users WHERE manager_id = ? ORDER BY name", [userId]);
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}
