import "server-only";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { isoDate } from "./format";
import { VEHICLE_STATUSES, type VehicleStatus } from "@/lib/vehicle-status";

export { VEHICLE_STATUSES, STATUS_INFO, type VehicleStatus } from "@/lib/vehicle-status";

// Purchase costs and profit per vehicle (the old "SHINKYOWA SEP 20xx" sheets).
// Amounts in stock_purchases / stock_expenses / japan_payments are JPY; the
// sale price stocks.cnf is in the customer's currency and converted with the
// vehicle's exchange rate. Everything here needs finance.view.

/** The business year runs September to August, named by its starting year. */
export const FY_START_MONTH = 9;

export function fiscalYearOf(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.getMonth() + 1 >= FY_START_MONTH ? d.getFullYear() : d.getFullYear() - 1;
}

export const fiscalYearLabel = (year: number) => `Sep ${year} – Aug ${year + 1}`;

const pad = (n: number) => String(n).padStart(2, "0");
const fiscalYearRange = (year: number) => [`${year}-${pad(FY_START_MONTH)}-01`, `${year + 1}-${pad(FY_START_MONTH)}-01`];

/** Approved customer payments for vehicle alias `s`. */
export const PAID_SQL =
  "(SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.stock_id = s.id AND p.customer_account_id = s.customer_account_id AND p.status = 'approved')";

/**
 * Where a vehicle is in the flow, from the data it already has: no customer
 * = available, customer but no vessel = reserved, on a vessel = shipped, on a
 * vessel and fully paid = cleared. Needs `shipment_stock ss` joined on s.id.
 */
export const AUTOMATIC_STATUS_SQL = `CASE
  WHEN s.customer_account_id IS NULL THEN 'available'
  WHEN ss.id IS NULL THEN 'reserved'
  WHEN COALESCE(s.cnf, 0) > 0 AND ${PAID_SQL} >= s.cnf THEN 'cleared'
  ELSE 'shipped' END`;

/** The manual sales label, when selected, otherwise the automatic lifecycle. */
export const STATUS_SQL = `COALESCE(s.status_override, ${AUTOMATIC_STATUS_SQL})`;

/** The date a vehicle counts towards: its purchase date, else when it was added. */
const DEAL_DATE = "COALESCE(sp.purchase_date, DATE(s.created_at))";

export type LedgerFilters = {
  year: number | null;
  agentId?: number | null;
  countryId?: number | null;
  status?: VehicleStatus | null;
  q?: string;
  /** Only this vehicle (any year). */
  stockId?: number;
};

export type LedgerRow = {
  id: number;
  sid: string;
  title: string;
  chassis: string;
  color: string;
  mileage: string;
  isListed: boolean;
  customerId: number | null;
  customer: string | null;
  company: string | null;
  country: string | null;
  agentId: number | null;
  agent: string | null;
  auction: string | null;
  lotNo: string | null;
  dealDate: string;
  purchaseDate: string | null;
  depositPercent: number | null;
  currency: string;
  symbol: string;
  cnf: number | null;
  rate: number | null;
  /** Sale price in JPY (cnf × rate), null when either is missing. */
  saleJpy: number | null;
  bought: number;
  expenses: Record<number, number>;
  expenseTotal: number;
  totalCost: number;
  /** saleJpy − totalCost, null until both a sale price and a cost exist. */
  profit: number | null;
  paid: number;
  balance: number | null;
  depositDue: number | null;
  japanPaid: number;
  vessel: string | null;
  shipmentId: number | null;
  etd: string | null;
  eta: string | null;
  status: VehicleStatus;
  notes: string | null;
};

/**
 * Vehicles that are part of a deal (have purchase costs or a customer),
 * newest first, with costs, sale price, payments and shipping.
 */
export async function ledger(filters: LedgerFilters): Promise<LedgerRow[]> {
  const where = ["(sp.stock_id IS NOT NULL OR s.customer_account_id IS NOT NULL)"];
  const params: unknown[] = [];
  if (filters.year !== null) {
    const [from, to] = fiscalYearRange(filters.year);
    where.push(`${DEAL_DATE} >= ? AND ${DEAL_DATE} < ?`);
    params.push(from, to);
  }
  if (filters.stockId) {
    where.push("s.id = ?");
    params.push(filters.stockId);
  }
  if (filters.agentId) {
    where.push("u.id = ?");
    params.push(filters.agentId);
  }
  if (filters.countryId) {
    where.push("c.country_id = ?");
    params.push(filters.countryId);
  }
  if (filters.status) {
    where.push(`${STATUS_SQL} = ?`);
    params.push(filters.status);
  }
  if (filters.q?.trim()) {
    where.push(
      "CONCAT_WS(' ', CONCAT('SKI-', s.sid), s.chassis, s.model, m.name, c.name, c.company, c.cid, sp.lot_no, a.name, sh.vessel_name) LIKE ?",
    );
    params.push(`%${filters.q.trim().replace(/[\\%_]/g, "\\$&")}%`);
  }

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT s.id, s.sid, s.year, s.model, s.chassis, s.color, s.mileage, s.cnf, s.is_listed, m.name AS make,
            c.id AS customer_id, c.name AS customer, c.company, co.name AS country,
            COALESCE(cur.code, scur.code, 'USD') AS currency, COALESCE(cur.symbol, scur.symbol, '$') AS symbol,
            u.id AS agent_id, u.name AS agent, a.name AS auction, sp.lot_no, sp.purchase_date, sp.deposit_percent, sp.exchange_rate,
            COALESCE(sp.bought_price, 0) AS bought, sp.notes, ${DEAL_DATE} AS deal_date, ${PAID_SQL} AS paid,
            (SELECT COALESCE(SUM(j.amount), 0) FROM japan_payments j WHERE j.stock_id = s.id) AS japan_paid,
            sh.id AS shipment_id, sh.vessel_name, sh.etd, sh.eta, ${STATUS_SQL} AS status
     FROM stocks s
     LEFT JOIN stock_purchases sp ON sp.stock_id = s.id
     LEFT JOIN auctions a ON a.id = sp.auction_id
     LEFT JOIN makes m ON m.id = s.make_id
     LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
     LEFT JOIN countries co ON co.id = c.country_id
     LEFT JOIN currencies cur ON cur.id = c.currency_id
     LEFT JOIN currencies scur ON scur.id = s.currency_id
     LEFT JOIN users u ON u.id = COALESCE(c.agent_id, s.agent_id)
     LEFT JOIN shipment_stock ss ON ss.stock_id = s.id
     LEFT JOIN shipments sh ON sh.id = ss.shipment_id
     WHERE ${where.join(" AND ")}
     ORDER BY deal_date DESC, s.id DESC`,
    params,
  );

  const expenses = new Map<number, Record<number, number>>();
  if (rows.length) {
    const [lines] = await db.query<RowDataPacket[]>(
      "SELECT stock_id, expense_type_id, amount FROM stock_expenses WHERE stock_id IN (?)",
      [rows.map((r) => r.id)],
    );
    for (const l of lines) {
      const map = expenses.get(Number(l.stock_id)) ?? {};
      map[Number(l.expense_type_id)] = Number(l.amount);
      expenses.set(Number(l.stock_id), map);
    }
  }

  return rows.map((r) => {
    const cnf = r.cnf === null ? null : Number(r.cnf);
    const rate = r.exchange_rate === null ? (r.currency === "JPY" ? 1 : null) : Number(r.exchange_rate);
    const lines = expenses.get(Number(r.id)) ?? {};
    const expenseTotal = Object.values(lines).reduce((a, b) => a + b, 0);
    const bought = Number(r.bought);
    const totalCost = bought + expenseTotal;
    const saleJpy = cnf && rate ? Math.round(cnf * rate) : null;
    const paid = Number(r.paid);
    const deposit = r.deposit_percent === null ? null : Number(r.deposit_percent);
    return {
      id: Number(r.id),
      sid: String(r.sid),
      title: `${r.year} ${r.make ?? ""} ${r.model}`.replace(/\s+/g, " ").trim(),
      chassis: String(r.chassis),
      color: r.color ?? "",
      mileage: String(r.mileage ?? ""),
      isListed: r.is_listed === 1,
      customerId: r.customer_id === null ? null : Number(r.customer_id),
      customer: r.customer,
      company: r.company || null,
      country: r.country,
      agentId: r.agent_id === null ? null : Number(r.agent_id),
      agent: r.agent,
      auction: r.auction,
      lotNo: r.lot_no,
      dealDate: isoDate(r.deal_date),
      purchaseDate: r.purchase_date ? isoDate(r.purchase_date) : null,
      depositPercent: deposit,
      currency: String(r.currency),
      symbol: String(r.symbol),
      cnf,
      rate,
      saleJpy,
      bought,
      expenses: lines,
      expenseTotal,
      totalCost,
      profit: saleJpy !== null && totalCost > 0 ? saleJpy - totalCost : null,
      paid,
      balance: cnf ? Math.max(cnf - paid, 0) : null,
      depositDue: cnf !== null && deposit !== null ? Math.round((cnf * deposit) / 100) : null,
      japanPaid: Number(r.japan_paid),
      vessel: r.vessel_name,
      shipmentId: r.shipment_id === null ? null : Number(r.shipment_id),
      etd: r.etd ? isoDate(r.etd) : null,
      eta: r.eta ? isoDate(r.eta) : null,
      status: r.status as VehicleStatus,
      notes: r.notes,
    };
  });
}

export type Totals = {
  units: number;
  sold: number;
  saleJpy: number;
  cost: number;
  profit: number;
  /** Vehicles with a sale price but no exchange rate or no cost: left out of profit. */
  incomplete: number;
  /** Unpaid customer balances converted to JPY (vehicles with a rate). */
  balanceJpy: number;
};

export function totals(rows: LedgerRow[]): Totals {
  const t: Totals = { units: rows.length, sold: 0, saleJpy: 0, cost: 0, profit: 0, incomplete: 0, balanceJpy: 0 };
  for (const r of rows) {
    t.cost += r.totalCost;
    if (r.cnf) t.sold++;
    if (r.saleJpy !== null) t.saleJpy += r.saleJpy;
    if (r.profit !== null) t.profit += r.profit;
    else if (r.cnf) t.incomplete++;
    if (r.balance && r.rate) t.balanceJpy += Math.round(r.balance * r.rate);
  }
  return t;
}

/** Totals per group (salesperson, country, month...), largest profit first. */
export function groupTotals(rows: LedgerRow[], key: (r: LedgerRow) => string) {
  const groups = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const k = key(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups].map(([name, list]) => ({ name, ...totals(list) }));
}

/** Business years that have vehicles, newest first, always including the current one. */
export async function fiscalYears(): Promise<number[]> {
  const [[row]] = await db.query<RowDataPacket[]>(
    `SELECT MIN(${DEAL_DATE}) AS first FROM stocks s LEFT JOIN stock_purchases sp ON sp.stock_id = s.id
     WHERE sp.stock_id IS NOT NULL OR s.customer_account_id IS NOT NULL`,
  );
  const current = fiscalYearOf(new Date());
  const first = row.first ? Math.min(fiscalYearOf(row.first), current) : current;
  const years: number[] = [];
  for (let y = current; y >= first; y--) years.push(y);
  return years;
}

export type PurchaseValues = {
  auction_id: string;
  lot_no: string;
  purchase_date: string;
  deposit_percent: string;
  exchange_rate: string;
  bought_price: string;
  notes: string;
  expenses: Record<string, string>;
};

/** Purchase form values for a vehicle (blank for a new one). */
export async function purchaseValues(stockId: number | null): Promise<PurchaseValues> {
  const blank: PurchaseValues = {
    auction_id: "", lot_no: "", purchase_date: "", deposit_percent: "50", exchange_rate: "", bought_price: "",
    notes: "", expenses: {},
  };
  if (!stockId) return blank;
  const [[[p]], [lines]] = await Promise.all([
    db.query<RowDataPacket[]>("SELECT * FROM stock_purchases WHERE stock_id = ?", [stockId]),
    db.query<RowDataPacket[]>("SELECT expense_type_id, amount FROM stock_expenses WHERE stock_id = ?", [stockId]),
  ]);
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    auction_id: str(p?.auction_id),
    lot_no: str(p?.lot_no),
    purchase_date: p?.purchase_date ? isoDate(p.purchase_date) : "",
    deposit_percent: p ? str(p.deposit_percent) : blank.deposit_percent,
    exchange_rate: p?.exchange_rate ? String(Number(p.exchange_rate)) : "",
    bought_price: p && p.bought_price ? String(p.bought_price) : "",
    notes: str(p?.notes),
    expenses: Object.fromEntries(lines.map((l) => [String(l.expense_type_id), String(l.amount)])),
  };
}

export type LedgerSearch = { year?: string; agent?: string; country?: string; status?: string; q?: string };

/** Ledger filters from the URL; the year defaults to the current business year ("all" for every year). */
export function parseLedgerSearch(sp: LedgerSearch): LedgerFilters & { yearParam: string } {
  const yearParam = sp.year === "all" || /^\d{4}$/.test(sp.year ?? "") ? sp.year! : String(fiscalYearOf(new Date()));
  const status = (VEHICLE_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as VehicleStatus) : null;
  return {
    yearParam,
    year: yearParam === "all" ? null : Number(yearParam),
    agentId: Number(sp.agent) || null,
    countryId: Number(sp.country) || null,
    status,
    q: sp.q ?? "",
  };
}

/** Salespeople who have deals: the filter options. */
export async function salespeopleOptions() {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT DISTINCT u.id, u.name FROM stocks s
     LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
     JOIN users u ON u.id = COALESCE(c.agent_id, s.agent_id) ORDER BY u.name`,
  );
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

export const JAPAN_PER_PAGE = 30;

/** Money paid out in Japan in a business year (null: every year). */
export async function listJapanPayments(year: number | null, q: string, page: number) {
  const where = ["1 = 1"];
  const params: unknown[] = [];
  if (year !== null) {
    where.push("j.payment_date >= ? AND j.payment_date < ?");
    params.push(...fiscalYearRange(year));
  }
  if (q.trim()) {
    where.push("CONCAT_WS(' ', j.payee, j.reference, j.note, CONCAT('SKI-', s.sid), s.chassis, s.model) LIKE ?");
    params.push(`%${q.trim().replace(/[\\%_]/g, "\\$&")}%`);
  }
  const base = `FROM japan_payments j LEFT JOIN stocks s ON s.id = j.stock_id LEFT JOIN makes m ON m.id = s.make_id
    WHERE ${where.join(" AND ")}`;
  const [[[sum]], [rows]] = await Promise.all([
    db.query<RowDataPacket[]>(`SELECT COUNT(*) AS n, COALESCE(SUM(j.amount), 0) AS total ${base}`, params),
    db.query<RowDataPacket[]>(
      `SELECT j.*, s.sid, s.year AS car_year, s.model, s.chassis, m.name AS make, u.name AS recorded_by
       ${base.replace("WHERE", "LEFT JOIN users u ON u.id = j.user_id WHERE")}
       ORDER BY j.payment_date DESC, j.id DESC LIMIT ? OFFSET ?`,
      [...params, JAPAN_PER_PAGE, (page - 1) * JAPAN_PER_PAGE],
    ),
  ]);
  return { rows, count: Number(sum.n), total: Number(sum.total) };
}

/** Vehicles a Japan payment can be for: purchased or reserved ones, newest first. */
export async function dealVehicleOptions() {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT s.id, s.sid, s.year, s.model, s.chassis, m.name AS make FROM stocks s
     LEFT JOIN makes m ON m.id = s.make_id LEFT JOIN stock_purchases sp ON sp.stock_id = s.id
     WHERE sp.stock_id IS NOT NULL OR s.customer_account_id IS NOT NULL ORDER BY s.id DESC`,
  );
  return rows.map((r) => ({ id: Number(r.id), name: `SKI-${r.sid} · ${r.year} ${r.make ?? ""} ${r.model} · ${r.chassis}` }));
}

/** Payee suggestions: auction houses and earlier payees. */
export async function payeeSuggestions() {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT name FROM auctions UNION SELECT DISTINCT payee AS name FROM japan_payments ORDER BY name",
  );
  return rows.map((r) => String(r.name));
}
