import "server-only";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { customerScope, type AdminUser } from "./auth";

// Dashboard figures. Money totals use payments.in_yen (the JPY value of each
// transfer) so different customer currencies add up; balances are shown per
// currency. Users without customers.view_all only see their own customers.

/** One x-axis position of a dashboard chart. */
export type ChartPoint = { key: string; label: string; value: number; note?: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** The last `n` months, oldest first, as YYYY-MM keys with short labels. */
function lastMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: d.toLocaleDateString("en-US", { month: "short", ...(d.getMonth() === 0 || i === 0 ? { year: "2-digit" } : {}) }),
    };
  });
}

/** Vehicle enquiries + contact messages per day, last 30 days. */
export async function inquiriesPerDay(): Promise<ChartPoint[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT d, COUNT(*) AS n FROM (
       SELECT DATE(created_at) AS d FROM inquiries WHERE created_at >= CURDATE() - INTERVAL 29 DAY
       UNION ALL
       SELECT DATE(created_at) AS d FROM contact_messages WHERE created_at >= CURDATE() - INTERVAL 29 DAY
     ) t GROUP BY d`,
  );
  const byDay = new Map(rows.map((r) => [isoDay(new Date(r.d)), Number(r.n)]));
  const today = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (29 - i));
    const key = isoDay(d);
    const value = byDay.get(key) ?? 0;
    return { key, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), value, note: value === 1 ? "1 inquiry" : `${value} inquiries` };
  });
}

const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Customer accounts created per month, last 12 months (scoped like everything else). */
export async function customersPerMonth(user: AdminUser): Promise<ChartPoint[]> {
  const scope = customerScope(user);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(c.created_at, '%Y-%m') AS ym, COUNT(*) AS n FROM customer_accounts c
     WHERE ${scope.sql} AND c.created_at >= DATE_FORMAT(CURDATE() - INTERVAL 11 MONTH, '%Y-%m-01')
     GROUP BY ym`,
    scope.params,
  );
  const byMonth = new Map(rows.map((r) => [String(r.ym), Number(r.n)]));
  return lastMonths(12).map((m) => {
    const value = byMonth.get(m.key) ?? 0;
    return { ...m, value, note: value === 1 ? "1 new customer" : `${value} new customers` };
  });
}

export async function dashboardData(user: AdminUser) {
  const scope = customerScope(user);
  const where = `JOIN customer_accounts c ON c.id = p.customer_account_id WHERE ${scope.sql}`;

  const [[totals], [monthly], [balances], [stock], [inquiries], [recent], [pending], [owing]] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.in_yen END), 0) AS received,
         COALESCE(SUM(CASE WHEN p.status = 'approved' AND p.payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN p.in_yen END), 0) AS this_month,
         COALESCE(SUM(CASE WHEN p.status = 'approved' AND p.payment_date >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01')
                                AND p.payment_date < DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN p.in_yen END), 0) AS last_month,
         COALESCE(SUM(CASE WHEN p.status = 'not approved' THEN p.in_yen END), 0) AS pending_yen,
         COALESCE(SUM(CASE WHEN p.status = 'not approved' THEN p.amount END), 0) AS pending_usd,
         COUNT(CASE WHEN p.status = 'not approved' THEN 1 END) AS pending_count
       FROM payments p ${where}`,
      scope.params,
    ),
    db.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS ym, SUM(p.in_yen) AS yen, COUNT(*) AS n
       FROM payments p ${where} AND p.status = 'approved'
         AND p.payment_date >= DATE_FORMAT(CURDATE() - INTERVAL 11 MONTH, '%Y-%m-01')
       GROUP BY ym`,
      scope.params,
    ),
    // Per customer: CNF of reserved vehicles minus approved payments.
    db.query<RowDataPacket[]>(
      `SELECT cur.code, cur.symbol, SUM(GREATEST(t.owed - t.paid, 0)) AS outstanding, COUNT(*) AS customers
       FROM (
         SELECT c.id, c.currency_id,
           (SELECT COALESCE(SUM(s.cnf), 0) FROM stocks s WHERE s.customer_account_id = c.id) AS owed,
           (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.customer_account_id = c.id AND p.status = 'approved') AS paid
         FROM customer_accounts c WHERE ${scope.sql}
       ) t
       LEFT JOIN currencies cur ON cur.id = t.currency_id
       WHERE t.owed > t.paid
       GROUP BY cur.code, cur.symbol
       ORDER BY outstanding DESC`,
      scope.params,
    ),
    db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, COUNT(customer_account_id) AS reserved FROM stocks`,
    ),
    db.query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM inquiries WHERE status = 'new') AS vehicle,
              (SELECT COUNT(*) FROM contact_messages WHERE status = 'new') AS contact`,
    ),
    db.query<RowDataPacket[]>(
      `SELECT p.id, p.amount, p.in_yen, p.status, p.payment_date, p.description, c.id AS customer_id, c.name AS customer,
              cur.symbol
       FROM payments p JOIN customer_accounts c ON c.id = p.customer_account_id
       LEFT JOIN currencies cur ON cur.id = c.currency_id
       WHERE ${scope.sql} AND p.status = 'approved'
       ORDER BY p.payment_date DESC, p.id DESC LIMIT 5`,
      scope.params,
    ),
    db.query<RowDataPacket[]>(
      `SELECT p.id, p.amount, p.in_yen, p.payment_date, p.description, p.file, p.kind, p.status, c.id AS customer_id,
              c.name AS customer, u.name AS recorded_by, r.name AS recorded_role,
              cur.symbol
       FROM payments p JOIN customer_accounts c ON c.id = p.customer_account_id
       LEFT JOIN currencies cur ON cur.id = c.currency_id
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE ${scope.sql} AND p.status = 'not approved'
       ORDER BY p.payment_date ASC, p.id ASC LIMIT 8`,
      scope.params,
    ),
    db.query<RowDataPacket[]>(
      `SELECT * FROM (
         SELECT c.id, c.name, c.company, cur.symbol,
           (SELECT COALESCE(SUM(s.cnf), 0) FROM stocks s WHERE s.customer_account_id = c.id) AS owed,
           (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.customer_account_id = c.id AND p.status = 'approved') AS paid
         FROM customer_accounts c LEFT JOIN currencies cur ON cur.id = c.currency_id
         WHERE ${scope.sql}
       ) t WHERE t.owed > t.paid ORDER BY (t.owed - t.paid) DESC LIMIT 5`,
      scope.params,
    ),
  ]);

  // Fill all 12 months so empty months still get a (zero) point.
  const byMonth = new Map(monthly.map((r) => [String(r.ym), r]));
  const months: ChartPoint[] = lastMonths(12).map((m) => {
    const row = byMonth.get(m.key);
    const count = Number(row?.n ?? 0);
    return { ...m, value: Number(row?.yen ?? 0), note: count === 1 ? "1 payment" : `${count} payments` };
  });

  const t = totals[0];
  return {
    received: Number(t.received),
    thisMonth: Number(t.this_month),
    lastMonth: Number(t.last_month),
    pendingYen: Number(t.pending_yen),
    pendingUsd: Number(t.pending_usd),
    pendingCount: Number(t.pending_count),
    outstanding: balances.map((b) => ({
      code: String(b.code ?? "—"),
      symbol: String(b.symbol ?? ""),
      amount: Number(b.outstanding),
      customers: Number(b.customers),
    })),
    stock: { total: Number(stock[0].total), reserved: Number(stock[0].reserved) },
    newInquiries: Number(inquiries[0].vehicle) + Number(inquiries[0].contact),
    months,
    recent,
    pending,
    owing: owing.map((o) => ({
      id: Number(o.id),
      name: String(o.name),
      company: String(o.company ?? ""),
      symbol: String(o.symbol ?? ""),
      owed: Number(o.owed),
      paid: Number(o.paid),
      balance: Number(o.owed) - Number(o.paid),
    })),
  };
}
