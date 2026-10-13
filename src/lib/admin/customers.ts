import "server-only";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { documentColumns } from "@/lib/documents";
import { customerScope, type AdminUser } from "./auth";
import { PAYMENT_FLOW_COLUMNS } from "./payments";

// owed = CNF of reserved vehicles, paid = approved payments (customer currency).
const TOTALS = `
  (SELECT COALESCE(SUM(s.cnf), 0) FROM stocks s WHERE s.customer_account_id = c.id) AS owed,
  (SELECT COUNT(*) FROM stocks s WHERE s.customer_account_id = c.id) AS cars,
  (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.customer_account_id = c.id AND p.status = 'approved') AS paid,
  (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.customer_account_id = c.id AND p.status = 'not approved') AS pending`;

export const CUSTOMERS_PER_PAGE = 20;

export async function listCustomers(user: AdminUser, q: string, page: number, filter: string) {
  const scope = customerScope(user);
  const where = [scope.sql];
  const params: unknown[] = [...scope.params];
  if (q.trim()) {
    where.push("CONCAT_WS(' ', c.cid, c.name, c.company, c.email, c.phone, c.city) LIKE ?");
    params.push(`%${q.trim().replace(/[\\%_]/g, "\\$&")}%`);
  }
  const having = filter === "owing" ? "HAVING owed > paid" : filter === "settled" ? "HAVING owed > 0 AND owed <= paid" : "";
  const base = `
    SELECT c.id, c.cid, c.name, c.company, c.email, c.phone, co.name AS country, cur.symbol, cur.code,
           u.name AS agent, ${TOTALS}
    FROM customer_accounts c
    LEFT JOIN countries co ON co.id = c.country_id
    LEFT JOIN currencies cur ON cur.id = c.currency_id
    LEFT JOIN users u ON u.id = c.agent_id
    WHERE ${where.join(" AND ")}
    ${having}`;
  const [[{ total }], [rows]] = await Promise.all([
    db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM (${base}) t`, params).then(([r]) => r),
    db.query<RowDataPacket[]>(`${base} ORDER BY c.id DESC LIMIT ? OFFSET ?`, [
      ...params,
      CUSTOMERS_PER_PAGE,
      (page - 1) * CUSTOMERS_PER_PAGE,
    ]),
  ]);
  return { rows, total: Number(total) };
}

/** Loyalty points a customer earns for each reserved vehicle (taken back on release). */
export const POINTS_PER_RESERVATION = 10;

export async function getCustomer(user: AdminUser, id: number) {
  const scope = customerScope(user);
  const [rows] = await db.query<RowDataPacket[]>(`SELECT c.id FROM customer_accounts c WHERE c.id = ? AND ${scope.sql}`, [
    id,
    ...scope.params,
  ]);
  return rows.length ? loadCustomerAccount(id) : null;
}

/**
 * A customer with balances, loyalty points, reserved vehicles (with their
 * shipment and documents) and payments. No access check: callers do that
 * (getCustomer for staff, the portal session for customers).
 */
export async function loadCustomerAccount(id: number) {
  const [[customer]] = await db.query<RowDataPacket[]>(
    `SELECT c.*, co.name AS country, cur.symbol, cur.code, u.name AS agent, u.email AS agent_email,
            u.phone AS agent_phone, COALESCE(pt.points, 0) AS points, (c.password IS NOT NULL) AS has_login, ${TOTALS}
     FROM customer_accounts c
     LEFT JOIN countries co ON co.id = c.country_id
     LEFT JOIN currencies cur ON cur.id = c.currency_id
     LEFT JOIN users u ON u.id = c.agent_id
     LEFT JOIN points pt ON pt.customer_account_id = c.id
     WHERE c.id = ?`,
    [id],
  );
  if (!customer) return null;
  delete customer.password;

  const [[cars], [payments]] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT s.id, s.sid, s.model, s.year, s.chassis, s.cnf, s.fob, s.thumbnail, s.images, s.is_listed, s.created_by, m.name AS make,
              (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.stock_id = s.id AND p.customer_account_id = s.customer_account_id AND p.status = 'approved') AS paid,
              sh.id AS shipment_id, sh.vessel_name, sh.etd, sh.eta, sh.status AS shipment_status, d.id AS document_id, ${documentColumns("d")}
       FROM stocks s
       LEFT JOIN makes m ON m.id = s.make_id
       LEFT JOIN shipment_stock ss ON ss.stock_id = s.id
       LEFT JOIN shipments sh ON sh.id = ss.shipment_id
       LEFT JOIN documents d ON d.stock_id = s.id
       WHERE s.customer_account_id = ? ORDER BY s.id`,
      [id],
    ),
    db.query<RowDataPacket[]>(
      `SELECT p.*, ${PAYMENT_FLOW_COLUMNS}, s.sid, s.model, m.name AS make
       FROM payments p
       LEFT JOIN stocks s ON s.id = p.stock_id
       LEFT JOIN makes m ON m.id = s.make_id
       WHERE p.customer_account_id = ? ORDER BY p.payment_date DESC, p.id DESC`,
      [id],
    ),
  ]);
  return { customer, cars, payments };
}

/** Vehicles that can still be reserved (for the reserve form). */
export async function availableVehicles() {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT s.id, s.sid, s.year, s.model, s.fob, m.name AS make, cur.symbol
     FROM stocks s LEFT JOIN makes m ON m.id = s.make_id LEFT JOIN currencies cur ON cur.id = s.currency_id
     WHERE s.customer_account_id IS NULL ORDER BY m.name, s.model`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    label: `SKI-${r.sid} · ${r.year} ${r.make ?? ""} ${r.model}`,
    fob: Number(r.fob),
    symbol: String(r.symbol ?? ""),
  }));
}

/** Customers the user may reserve vehicles for (Reserved vehicles page). */
export async function customerOptions(user: AdminUser) {
  const scope = customerScope(user);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.id, c.name, c.cid, c.company, cur.symbol FROM customer_accounts c
     LEFT JOIN currencies cur ON cur.id = c.currency_id WHERE ${scope.sql} ORDER BY c.name`,
    scope.params,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: `${r.name}${r.company ? ` (${r.company})` : ""} · ${r.cid}`,
    symbol: String(r.symbol ?? ""),
  }));
}

export const RESERVED_PER_PAGE = 25;

export const RESERVED_FILTERS = ["all", "unpaid", "paid", "unshipped", "shipped"] as const;
export type ReservedFilter = (typeof RESERVED_FILTERS)[number];

/** Every reserved vehicle the user can see, with payment, shipment and paperwork status. */
export async function listReserved(user: AdminUser, q: string, filter: ReservedFilter, page: number) {
  const scope = customerScope(user);
  const where = ["s.customer_account_id IS NOT NULL", scope.sql];
  const params: unknown[] = [...scope.params];
  if (q.trim()) {
    where.push("CONCAT_WS(' ', CONCAT('SKI-', s.sid), s.chassis, s.model, m.name, c.name, c.company, c.cid, sh.vessel_name) LIKE ?");
    params.push(`%${q.trim().replace(/[\\%_]/g, "\\$&")}%`);
  }
  const base = `
    FROM stocks s
    JOIN customer_accounts c ON c.id = s.customer_account_id
    LEFT JOIN makes m ON m.id = s.make_id
    LEFT JOIN currencies cur ON cur.id = c.currency_id
    LEFT JOIN users u ON u.id = c.agent_id
    LEFT JOIN shipment_stock ss ON ss.stock_id = s.id
    LEFT JOIN shipments sh ON sh.id = ss.shipment_id
    LEFT JOIN documents d ON d.stock_id = s.id
    WHERE ${where.join(" AND ")}`;
  const paidSql = "(SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.stock_id = s.id AND p.customer_account_id = s.customer_account_id AND p.status = 'approved')";
  const filters: Record<ReservedFilter, string> = {
    all: "1 = 1",
    unpaid: `${paidSql} < COALESCE(s.cnf, 0)`,
    paid: `COALESCE(s.cnf, 0) > 0 AND ${paidSql} >= s.cnf`,
    unshipped: "sh.id IS NULL",
    shipped: "sh.id IS NOT NULL",
  };
  const counts = Object.fromEntries(
    await Promise.all(
      RESERVED_FILTERS.map(async (key) => {
        const [[row]] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${base} AND ${filters[key]}`, params);
        return [key, Number(row.n)] as const;
      }),
    ),
  ) as Record<ReservedFilter, number>;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT s.id, s.sid, s.year, s.model, s.chassis, s.cnf, s.thumbnail, s.updated_at, s.is_listed, s.created_by, m.name AS make,
            c.id AS customer_id, c.name AS customer, c.company, cur.symbol, u.name AS agent, ${paidSql} AS paid,
            sh.id AS shipment_id, sh.vessel_name, sh.etd, sh.eta, sh.status AS shipment_status, ${documentColumns("d")}
     ${base} AND ${filters[filter]}
     ORDER BY s.updated_at DESC, s.id DESC LIMIT ? OFFSET ?`,
    [...params, RESERVED_PER_PAGE, (page - 1) * RESERVED_PER_PAGE],
  );
  return { rows, counts, total: counts[filter] };
}
