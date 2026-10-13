import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { can, customerScope, type AdminUser } from "./auth";
import { POINTS_PER_RESERVATION } from "./customers";
import type { Cell, Sheet, SheetRow } from "./xlsx";

// Bulk import of vehicles from the company's Excel sheets ("SHINKYOWA SEP
// 20xx" tabs, CLEARED UNITS, CONTAINER SHIPMENT) or the import template.
// Columns are found by their header, so the old sheets work as they are.
// Vehicles are matched on chassis: new ones are added, existing ones updated.
// Customers, auction houses, countries and vessels that do not exist yet are
// created; staff are matched by name and never created.

type Field =
  | "csr" | "country" | "sid" | "customer" | "makeModel" | "make" | "model" | "year" | "mileage" | "color" | "chassis"
  | "lot" | "auction" | "date" | "term" | "fob" | "cnf" | "currency" | "rate" | "cnfJpy" | "bought" | "vessel" | "etd"
  | "eta" | "transmission" | "fuel" | "engine" | "doors" | "notes"
  | "exp_auction" | "exp_fwt" | "exp_transport" | "exp_inspection" | "exp_repair" | "exp_other";

/** Expense columns and the expense type (Catalog lists) each one fills. */
const EXPENSE_FIELDS: Record<string, string> = {
  exp_auction: "Auction fees",
  exp_fwt: "Freight (FWT)",
  exp_transport: "Transport",
  exp_inspection: "Inspection",
  exp_repair: "Repair",
  exp_other: "Other expense",
};

/**
 * Template columns in order, with the header names used in the old sheets.
 * Headers are compared without spaces and punctuation ("LOT#" = "LOT").
 */
export const IMPORT_COLUMNS: { field: Field; header: string; aliases: string[]; help: string; example: Cell }[] = [
  { field: "csr", header: "CSR", aliases: ["CRS", "SALESPERSON", "AGENT", "STAFF"], help: "Staff member who sold it, as named under Users (first name is enough)", example: "JIMMY" },
  { field: "country", header: "COUNTRY", aliases: [], help: "Customer's country", example: "IRELAND" },
  { field: "sid", header: "STOCK ID", aliases: ["SID", "STOCKNO"], help: "Optional. SKI-1234 or 1234; a new number is given when empty", example: null },
  { field: "customer", header: "COMPANY", aliases: ["CUSTOMER", "BUYER", "CLIENT"], help: "Customer / company. New customers are created", example: "DRIFT99 MOTORS" },
  { field: "makeModel", header: "MAKE/MODEL", aliases: ["MAKEMAKE", "VEHICLE"], help: "Make and model, e.g. TOYOTA PRIUS (or use separate MAKE and MODEL columns)", example: "TOYOTA PRIUS" },
  { field: "year", header: "YEAR", aliases: [], help: "Model year", example: 2015 },
  { field: "mileage", header: "MILEAGE", aliases: ["KM"], help: "Kilometres, e.g. 119000 or 119,000km", example: "119,000km" },
  { field: "color", header: "COLOR", aliases: ["COLOUR"], help: "", example: "WHITE" },
  { field: "chassis", header: "CHASSIS", aliases: ["CHASSISNO", "VIN"], help: "Required. Used to find the vehicle when importing again", example: "EXAMPLE-0000001" },
  { field: "lot", header: "LOT#", aliases: ["LOTNO"], help: "Auction lot number", example: 80122 },
  { field: "auction", header: "AUCTION", aliases: ["AUCTIONHOUSE"], help: "Auction house. New ones are added to Catalog lists", example: "USS Tokyo" },
  { field: "date", header: "DATE", aliases: ["PURCHASEDATE", "BOUGHTDATE"], help: "Purchase date (Excel date or 2025-10-15)", example: "2025-10-15" },
  { field: "term", header: "PAYMENT TERM", aliases: ["TERM", "DEPOSIT"], help: "Deposit: 50%, 50 or 0.5", example: "50%" },
  { field: "fob", header: "FOB", aliases: [], help: "FOB price in the customer's currency", example: null },
  { field: "cnf", header: "C&F", aliases: ["CANDF", "CNFPRICE", "SALEPRICE"], help: "Sale price in the customer's currency. 11850 / 11350 uses the last number", example: 4420 },
  { field: "currency", header: "CURRENCY", aliases: [], help: "USD, EUR, GBP or JPY. Empty: EUR for Ireland, GBP for UK, else USD", example: "EUR" },
  { field: "rate", header: "Ex-Rate", aliases: ["EXRATE", "EXCHANGERATE", "RATE"], help: "Yen per 1 unit of the customer's currency", example: 173 },
  { field: "cnfJpy", header: "CNF IN JPY", aliases: ["CNFJPY", "SALEJPY"], help: "Only used to work out the rate when Ex-Rate is empty", example: 764660 },
  { field: "bought", header: "BOUGHT", aliases: ["BOUGHTPRICE", "PURCHASEPRICE"], help: "Price paid at auction (JPY)", example: 505000 },
  { field: "exp_auction", header: "AUCTION FEES", aliases: ["AUCTIONFEE"], help: "JPY", example: 13500 },
  { field: "exp_fwt", header: "FWT", aliases: ["FREIGHT", "FREIGHTFWT"], help: "Freight, JPY", example: 120000 },
  { field: "exp_transport", header: "TRANSPORT", aliases: [], help: "Inland transport, JPY", example: 15000 },
  { field: "exp_inspection", header: "INSPECTION", aliases: [], help: "JPY", example: null },
  { field: "exp_repair", header: "REPAIR", aliases: [], help: "JPY", example: null },
  { field: "exp_other", header: "OTHER EXPENSE", aliases: ["OTHEREXPENSES", "OTHER"], help: "JPY", example: null },
  { field: "vessel", header: "VESSEL", aliases: ["SHIP", "VESSELNAME"], help: "Ship name. A vessel row like 'ALS HERCULES ETA : 2026-01-20 ETD : 2025-11-22' above the cars also works", example: "ALS HERCULES" },
  { field: "etd", header: "ETD", aliases: [], help: "Departure date", example: "2025-11-22" },
  { field: "eta", header: "ETA", aliases: [], help: "Arrival date", example: "2026-01-20" },
  { field: "transmission", header: "TRANSMISSION", aliases: ["TM", "GEAR"], help: "automatic or manual (default automatic)", example: "automatic" },
  { field: "fuel", header: "FUEL", aliases: [], help: "petrol, diesel, hybrid, electric (default petrol)", example: "hybrid" },
  { field: "engine", header: "ENGINE CC", aliases: ["ENGINE", "CC"], help: "Engine size in cc", example: 1800 },
  { field: "doors", header: "DOORS", aliases: [], help: "", example: 5 },
  { field: "notes", header: "NOTES", aliases: ["NOTE", "REMARKS"], help: "Saved with the purchase", example: null },
];

// Separate MAKE / MODEL columns are accepted too.
const EXTRA_HEADERS: Record<string, Field> = { MAKE: "make", MODEL: "model" };

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADER_FIELDS = new Map<string, Field>([
  ...Object.entries(EXTRA_HEADERS),
  ...IMPORT_COLUMNS.flatMap((c) => [norm(c.header), ...c.aliases].map((h): [string, Field] => [h, c.field])),
]);

function fieldForHeader(header: Cell): Field | null {
  if (typeof header !== "string") return null;
  const h = norm(header);
  if (HEADER_FIELDS.has(h)) return HEADER_FIELDS.get(h)!;
  // "Ex-Rate -2", "TRANSPORT +ATJ"
  if (h.startsWith("EXRATE")) return "rate";
  if (h.startsWith("TRANSPORT")) return "exp_transport";
  return null;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

const text = (v: Cell) => (v === null ? null : String(v).replace(/\s+/g, " ").trim() || null);

/** 1,234 / "¥1,234" / "16000 / 15500" (last number wins) / "INCLUDED" (null). */
function amount(v: Cell): { value: number | null; split: boolean } {
  if (v === null) return { value: null, split: false };
  if (typeof v === "number") return { value: v, split: false };
  const parts = v.split("/");
  const last = parts[parts.length - 1].replace(/[,\s¥$€£]|km|KM|Km/g, "");
  const n = Number(last);
  return { value: last && Number.isFinite(n) ? n : null, split: parts.length > 1 };
}

function isoFromSerial(serial: number) {
  const d = new Date(Math.round((serial - 25569) * 86400000));
  return d.toISOString().slice(0, 10);
}

/** Excel serial, 2025-10-15, 15/10/2025 or anything Date understands. */
function dateValue(v: Cell): string | null {
  if (v === null) return null;
  if (typeof v === "number") return v > 20000 && v < 80000 ? isoFromSerial(v) : null;
  const s = v.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  const valid = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < "1000-01-01" || iso > "9999-12-31") return null;
    const timestamp = Date.parse(`${iso}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === iso ? iso : null;
  };
  if (m) return valid(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return valid(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const parsed = new Date(t);
  return valid(`${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`);
}

/** Lot numbers stored as numbers (1.568502626E9) back to digits. */
const lotText = (v: Cell) => (v === null ? null : typeof v === "number" ? String(v) : (text(v)?.slice(0, 50) ?? null));

/** Edit distance where swapping two neighbouring letters also counts as one edit. */
function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Same word, or a one-letter typo in a longer word (TOYOYA, ALISHBLA, AYRAN). */
const similarWord = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && editDistance(a, b) <= 1);

// ---------------------------------------------------------------------------
// Reading a sheet
// ---------------------------------------------------------------------------

type Record_ = {
  n: number;
  get: (f: Field) => Cell;
  vessel: { name: string; etd: string | null; eta: string | null } | null;
};

type Parsed = {
  headerRow: number;
  columns: { header: string; field: Field | null }[];
  records: Record_[];
  ignored: number;
};

/** Finds the header row (the first with CHASSIS and two other known columns) and reads the rows under it. */
export function parseSheet(sheet: Sheet): Parsed | null {
  const headerIndex = sheet.rows.slice(0, 15).findIndex((r) => {
    const fields = r.cells.map(fieldForHeader);
    return fields.includes("chassis") && fields.filter(Boolean).length >= 3;
  });
  if (headerIndex < 0) return null;
  const header = sheet.rows[headerIndex];
  const fieldAt = header.cells.map(fieldForHeader);
  // First column wins when a header appears twice (e.g. "CNF" twice).
  const index = new Map<Field, number>();
  fieldAt.forEach((f, i) => f && !index.has(f) && index.set(f, i));
  // CONTAINER SHIPMENT sheets head the CSR column "ETA": names, not dates.
  if (!index.has("csr") && index.has("eta")) {
    const col = index.get("eta")!;
    const values = sheet.rows.slice(headerIndex + 1).map((r) => r.cells[col]).filter((v) => v !== null && v !== undefined);
    const names = values.filter((v) => typeof v === "string" && /^[A-Za-z][A-Za-z .]{1,30}$/.test(v.trim()));
    if (names.length > values.length / 2) {
      index.set("csr", col);
      index.delete("eta");
      fieldAt[col] = "csr";
    }
  }

  const records: Record_[] = [];
  let ignored = 0;
  let vessel: Record_["vessel"] = null;
  for (const row of sheet.rows.slice(headerIndex + 1)) {
    const get = (f: Field) => (index.has(f) ? (row.cells[index.get(f)!] ?? null) : null);
    const chassis = text(get("chassis"));
    if (!chassis) {
      const found = vesselRow(row);
      if (found) vessel = found;
      else ignored++;
      continue;
    }
    records.push({ n: row.n, get, vessel });
  }
  return {
    headerRow: header.n,
    columns: header.cells.map((h, i) => ({ header: String(h ?? ""), field: fieldAt[i] })).filter((c) => c.header),
    records,
    ignored,
  };
}

/** "Hoegh Tokyo  ETA : 2025-11-05 ETD : 2025-10-10" rows between groups of cars. */
function vesselRow(row: SheetRow): Record_["vessel"] {
  const cell = row.cells.find((c): c is string => typeof c === "string" && /\bET[AD]\s*:/i.test(c));
  if (!cell) return null;
  const name = cell.split(/\bET[AD]\s*:/i)[0].replace(/\s+/g, " ").trim();
  if (!name) return null;
  const find = (label: string) => {
    const m = new RegExp(`\\b${label}\\s*:\\s*([0-9][0-9./-]+)`, "i").exec(cell);
    return m ? dateValue(m[1]) : null;
  };
  return { name, etd: find("ETD"), eta: find("ETA") };
}

/** The sheet most likely meant: first with a usable header, preferring the newest season name. */
export function guessSheet(sheets: Sheet[]) {
  const usable = sheets.filter((s) => parseSheet(s));
  const year = (name: string) => Math.max(0, ...(name.match(/20\d\d/g) ?? []).map(Number));
  const seasons = usable.filter((s) => /SHINKYOWA|SEP/i.test(s.name)).sort((a, b) => year(b.name) - year(a.name));
  return seasons[0] ?? usable[0] ?? null;
}

// ---------------------------------------------------------------------------
// Planning and importing
// ---------------------------------------------------------------------------

export type ImportRow = {
  n: number;
  chassis: string;
  title: string;
  customer: string | null;
  agent: string | null;
  vessel: string | null;
  action: "create" | "update" | "skip";
  messages: string[];
};

export type ImportSummary = {
  create: number;
  update: number;
  skip: number;
  newCustomers: string[];
  newAuctions: string[];
  newCountries: string[];
  newShipments: string[];
  unmatchedStaff: { name: string; rows: number }[];
};

export type ImportOptions = {
  /** finance.manage: purchase costs, rate and expenses are imported. */
  costs: boolean;
  /** shipments.manage: vehicles are put on their vessels. */
  shipments: boolean;
  /** Write to the database (false: preview only). */
  commit: boolean;
  /** Sheet name, used to tell container shipments from RoRo. */
  sheetName: string;
  actorId: number;
  user: AdminUser;
};

type Lookup = { id: number | null; name: string; isNew: boolean };

/**
 * Matches every row against the database and, with commit, writes it all in
 * one transaction. Returns the same rows and summary either way, so the
 * preview shows exactly what the import will do.
 */
export async function runImport(parsed: Parsed, opts: ImportOptions) {
  const conn = await db.getConnection();
  try {
    if (opts.commit) await conn.beginTransaction();
    const result = await importRows(conn, parsed, opts);
    if (opts.commit) await conn.commit();
    return result;
  } catch (err) {
    if (opts.commit) await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function importRows(conn: PoolConnection, parsed: Parsed, opts: ImportOptions) {
  const q = async (sql: string, params: unknown[] = []) => (await conn.query<RowDataPacket[]>(sql, params))[0];
  const exec = async (sql: string, params: unknown[] = []) => (await conn.query<ResultSetHeader>(sql, params))[0];

  const scope = customerScope(opts.user);
  const staffWhere = can(opts.user, "customers.view_all") ? "1 = 1"
    : can(opts.user, "customers.view_team") ? "(id = ? OR manager_id = ?)" : "id = ?";
  const staffParams = can(opts.user, "customers.view_all") ? []
    : can(opts.user, "customers.view_team") ? [opts.user.id, opts.user.id] : [opts.user.id];
  const [users, makes, countries, currencies, auctions, expenseTypes, customers, shipments, stocks] = await Promise.all([
    q(`SELECT id, name FROM users WHERE is_active = 1 AND approval_status = 'approved' AND ${staffWhere}`, staffParams),
    q("SELECT id, name FROM makes"),
    q("SELECT id, name FROM countries"),
    q("SELECT id, code FROM currencies"),
    q("SELECT id, name FROM auctions"),
    q("SELECT id, name FROM expense_types"),
    q(`SELECT c.id, c.name, c.company, c.currency_id FROM customer_accounts c WHERE ${scope.sql}`, scope.params),
    q("SELECT id, vessel_name, etd FROM shipments"),
    q(`SELECT s.id, s.sid, s.chassis, s.customer_account_id, s.agent_id, c.name AS customer,
              (s.customer_account_id IS NULL OR ${scope.sql}) AS visible
       FROM stocks s LEFT JOIN customer_accounts c ON c.id = s.customer_account_id`, scope.params),
  ]);
  const usedSids = new Set(stocks.map((s) => String(s.sid)));
  let nextSid = Math.max(1000, ...stocks.map((s) => Number(s.sid) || 0)) + 1;
  const currencyId = (code: string) => currencies.find((c) => c.code === code)?.id ?? null;
  const usd = currencyId("USD") ?? currencies[0]?.id ?? null;

  // --- staff -------------------------------------------------------------
  const unmatched = new Map<string, number>();
  const staffCache = new Map<string, { id: number; name: string } | null>();
  const HONORIFICS = new Set(["BHAI", "SAHAB", "SAHIB", "MR", "MRS", "MS", "SIR", "JI"]);
  const staffFor = (raw: string) => {
    const k = norm(raw);
    if (staffCache.has(k)) return staffCache.get(k)!;
    const words = raw.toUpperCase().split(/[^A-Z]+/).filter((w) => w.length >= 3 && !HONORIFICS.has(w));
    let match = users.find((u) => norm(u.name) === k);
    if (!match) {
      const candidates = users.filter((u) =>
        String(u.name).toUpperCase().split(/[^A-Z]+/).filter((w) => w.length >= 3)
          .some((uw) => words.some((w) => similarWord(w, uw))),
      );
      if (candidates.length === 1) match = candidates[0];
    }
    const found = match ? { id: Number(match.id), name: String(match.name) } : null;
    staffCache.set(k, found);
    return found;
  };

  // --- lists that grow during the import ------------------------------------
  const created = { customers: [] as string[], auctions: [] as string[], countries: [] as string[], shipments: [] as string[] };
  let fakeId = -1; // ids of rows that would be created in a preview

  const countryFor = async (raw: string): Promise<Lookup> => {
    const k = key(raw);
    const hit =
      countries.find((c) => key(c.name) === k) ??
      (k.length >= 4 ? countries.find((c) => key(c.name).startsWith(k) || k.startsWith(key(c.name))) : undefined);
    if (hit) return { id: hit.id, name: hit.name, isNew: false };
    const name = raw.trim().slice(0, 100);
    const id = opts.commit
      ? (await exec("INSERT INTO countries (name, created_at, updated_at) VALUES (?, NOW(), NOW())", [name])).insertId
      : fakeId--;
    countries.push({ id, name } as RowDataPacket);
    created.countries.push(name);
    return { id, name, isNew: true };
  };

  const auctionFor = async (raw: string): Promise<Lookup> => {
    const k = key(raw);
    const hit = auctions.find((a) => key(a.name) === k);
    if (hit) return { id: hit.id, name: hit.name, isNew: false };
    const name = raw.replace(/\s+/g, " ").trim().slice(0, 100);
    const id = opts.commit
      ? (await exec("INSERT INTO auctions (name, created_at, updated_at) VALUES (?, NOW(), NOW())", [name])).insertId
      : fakeId--;
    auctions.push({ id, name } as RowDataPacket);
    created.auctions.push(name);
    return { id, name, isNew: true };
  };

  const expenseTypeId = async (name: string) => {
    const hit = expenseTypes.find((t) => key(t.name) === key(name));
    if (hit) return Number(hit.id);
    const id = opts.commit
      ? (await exec("INSERT INTO expense_types (name, created_at, updated_at) VALUES (?, NOW(), NOW())", [name])).insertId
      : fakeId--;
    expenseTypes.push({ id, name } as RowDataPacket);
    return id;
  };

  /** Exact name/company match, else one name starting with the other (DRIFT99 / DRIFT99 MOTORS). */
  const findCustomer = (raw: string) => {
    const k = key(raw);
    const exact = customers.find((c) => key(c.company ?? "") === k || key(c.name) === k);
    if (exact) return exact;
    if (k.length < 5) return undefined;
    const close = customers.filter((c) =>
      [key(c.company ?? ""), key(c.name)].some((ck) => ck.length >= 5 && (ck.startsWith(k) || k.startsWith(ck))),
    );
    return close.length === 1 ? close[0] : undefined;
  };

  const customerFor = async (raw: string, country: Lookup | null, currency: number | null, agentId: number | null) => {
    const hit = findCustomer(raw);
    if (hit) return { id: Number(hit.id), name: String(hit.company || hit.name), currencyId: hit.currency_id, isNew: false };
    const name = raw.replace(/\s+/g, " ").trim().slice(0, 100);
    let id = fakeId--;
    if (opts.commit) {
      id = (
        await exec(
          `INSERT INTO customer_accounts (cid, name, company, country_id, currency_id, agent_id, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'Imported from Excel', NOW(), NOW())`,
          [`tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, name, name, country?.id ?? null, currency,
            agentId ?? (can(opts.user, "customers.view_all") ? null : opts.user.id)],
        )
      ).insertId;
      await exec("UPDATE customer_accounts SET cid = CONCAT('C-', LPAD(id, 5, '0')) WHERE id = ?", [id]);
    }
    customers.push({ id, name, company: name, currency_id: currency } as RowDataPacket);
    created.customers.push(name);
    return { id, name, currencyId: currency, isNew: true };
  };

  const shipmentFor = async (name: string, etd: string | null, eta: string | null): Promise<{ id: number | null; error?: string }> => {
    if (etd && eta && eta < etd) return { id: null, error: `Vessel "${name}" arrival must be on or after departure` };
    const k = key(name);
    const sameName = shipments.filter((s) => key(s.vessel_name) === k);
    const hit = etd ? sameName.find((s) => s.etd && toIso(s.etd) === etd) : sameName.length === 1 ? sameName[0] : undefined;
    if (hit) return { id: Number(hit.id) };
    if (!etd || !eta) return { id: null, error: `Vessel "${name}" needs ETD and ETA dates to be added` };
    const method = /container/i.test(opts.sheetName) ? "container" : "roro";
    const id = opts.commit
      ? (
          await exec(
            "INSERT INTO shipments (vessel_name, method, etd, eta, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
            [name.slice(0, 255), method, etd, eta],
          )
        ).insertId
      : fakeId--;
    shipments.push({ id, vessel_name: name, etd } as RowDataPacket);
    created.shipments.push(`${name} (ETD ${etd})`);
    return { id };
  };

  // --- rows ------------------------------------------------------------------
  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  const stockByChassis = new Map(stocks.map((s) => [norm(String(s.chassis)), s]));

  for (const r of parsed.records) {
    const messages: string[] = [];
    const chassis = text(r.get("chassis"))!.toUpperCase().replace(/\s+/g, "").slice(0, 255);
    const out: ImportRow = { n: r.n, chassis, title: "", customer: null, agent: null, vessel: null, action: "skip", messages };
    rows.push(out);
    if (/^EXAMPLE/.test(chassis)) {
      messages.push("Example row from the template — skipped");
      continue;
    }
    if (seen.has(norm(chassis))) {
      messages.push("Chassis appears earlier in the file — skipped");
      continue;
    }
    seen.add(norm(chassis));
    const existing = stockByChassis.get(norm(chassis));
    if (existing && !Number(existing.visible)) {
      messages.push("This vehicle is reserved for a customer you cannot access — skipped");
      continue;
    }

    // Vehicle description
    const makeModel = text(r.get("makeModel"));
    let makeText = text(r.get("make"));
    let model = text(r.get("model"));
    const yearRaw = amount(r.get("year")).value;
    let year = yearRaw && yearRaw > 1950 && yearRaw < 2100 ? String(Math.trunc(yearRaw)) : "";
    if (makeModel && !model) {
      // "TOYOTA PRIUS 2015": the year at the end is dropped (and used when YEAR is empty).
      const trailingYear = /\s(19|20)\d\d$/.exec(makeModel);
      const clean = trailingYear ? makeModel.slice(0, trailingYear.index).trim() : makeModel;
      if (trailingYear && !year) year = trailingYear[0].trim();
      const [first, ...rest] = clean.split(" ");
      makeText = makeText ?? first;
      model = rest.join(" ") || clean;
    }
    const makeHit = makeText
      ? makes.find((m) => similarWord(norm(m.name), norm(makeText!)) || similarWord(norm(String(m.name).split(" ")[0]), norm(makeText!)))
      : undefined;
    if (makeText && !makeHit) model = `${makeText} ${model ?? ""}`.trim();
    model = (model ?? "").slice(0, 100);
    out.title = `${year} ${makeHit?.name ?? ""} ${model}`.replace(/\s+/g, " ").trim() || "(no model)";
    if (!model) messages.push("No model");

    // Staff
    const csr = text(r.get("csr"));
    const agent = csr ? staffFor(csr) : null;
    if (csr && !agent) {
      unmatched.set(csr.toUpperCase(), (unmatched.get(csr.toUpperCase()) ?? 0) + 1);
      messages.push(`Staff "${csr}" not found under Users — vehicle left unassigned`);
    }
    out.agent = agent?.name ?? null;

    // Customer
    const countryText = text(r.get("country"));
    const country = countryText ? await countryFor(countryText) : null;
    const currencyText = text(r.get("currency"))?.toUpperCase() ?? null;
    let currency = currencyText ? currencyId(currencyText) : null;
    if (currencyText && !currency) messages.push(`Unknown currency "${currencyText}"`);
    if (!currency) {
      const c = key(countryText ?? "");
      currency = c === "ireland" ? currencyId("EUR") : c === "uk" || c === "unitedkingdom" ? currencyId("GBP") : usd;
    }
    const customerText = text(r.get("customer"));
    const isStockRow = customerText && /^(stock|available|free)$/i.test(customerText);
    // A vehicle already reserved keeps its customer.
    let customer: Awaited<ReturnType<typeof customerFor>> | null = null;
    if (customerText && !isStockRow) {
      const match = findCustomer(customerText);
      if (existing?.customer_account_id && Number(match?.id) !== Number(existing.customer_account_id)) {
        messages.push(`Already reserved for ${existing.customer} — customer not changed`);
      } else {
        customer = await customerFor(customerText, country, currency, agent?.id ?? null);
      }
    }
    out.customer = customer ? customer.name + (customer.isNew ? " (new)" : "") : (existing?.customer ?? null);

    // Prices
    const cnfVal = amount(r.get("cnf"));
    if (cnfVal.split) messages.push(`C&F "${r.get("cnf")}" — used the last price, ${cnfVal.value}`);
    const cnf = cnfVal.value && cnfVal.value > 0 ? Math.round(cnfVal.value) : null;
    const fob = amount(r.get("fob")).value;

    const customerId = customer?.id ?? null;
    out.action = existing ? "update" : "create";

    const mileage = amount(r.get("mileage")).value;
    const transmissionText = (text(r.get("transmission")) ?? "").toLowerCase();
    const transmission = transmissionText.startsWith("m") ? "manual" : "automatic";
    const fuelText = (text(r.get("fuel")) ?? "").toLowerCase();
    const fuel = (["diesel", "petrol", "electric", "hybrid", "gasoline"] as const).find((f) => fuelText.startsWith(f.slice(0, 3))) ?? "petrol";
    const engine = amount(r.get("engine")).value;
    const doors = amount(r.get("doors")).value;
    const color = text(r.get("color"))?.slice(0, 255) ?? null;

    let stockId: number;
    if (existing) {
      stockId = Number(existing.id);
      if (opts.commit) {
        await exec(
          `UPDATE stocks SET make_id = COALESCE(?, make_id), model = IF(? <> '', ?, model), year = IF(? <> '', ?, year),
             mileage = COALESCE(?, mileage), color = COALESCE(?, color), cnf = COALESCE(?, cnf), fob = COALESCE(?, fob),
             customer_account_id = COALESCE(customer_account_id, ?), agent_id = COALESCE(?, agent_id),
             transmission = COALESCE(?, transmission), fuel = COALESCE(?, fuel), engine = COALESCE(?, engine),
             doors = COALESCE(?, doors),
             currency_id = COALESCE(?, currency_id), updated_at = NOW()
           WHERE id = ?`,
          [makeHit?.id ?? null, model, model, year, year, mileage === null ? null : String(Math.round(mileage)), color, cnf,
            fob === null ? null : Math.round(fob), customerId, agent?.id ?? null,
            transmissionText ? transmission : null, fuelText ? fuel : null, engine === null ? null : Math.round(engine),
            doors === null ? null : String(Math.round(doors)), customer?.currencyId ?? null, stockId],
        );
      }
    } else {
      const sidText = text(r.get("sid"))?.replace(/^SKI-?/i, "") ?? "";
      let sid = /^\d{1,9}$/.test(sidText) && !usedSids.has(sidText) ? sidText : "";
      if (sidText && !sid) messages.push(`Stock ID ${sidText} is taken — given a new number`);
      if (!sid) {
        while (usedSids.has(String(nextSid))) nextSid++;
        sid = String(nextSid++);
      }
      usedSids.add(sid);
      stockId = opts.commit
        ? (
            await exec(
              `INSERT INTO stocks (sid, images, chassis, make_id, model, year, fob, cnf, currency_id, mileage, doors,
                 transmission, fuel, engine, color, features, customer_account_id, agent_id, is_listed, created_at, updated_at)
               VALUES (?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, 0, NOW(), NOW())`,
              [sid, chassis, makeHit?.id ?? null, model, year, fob === null ? 0 : Math.round(fob), cnf,
                customer?.currencyId ?? currency ?? usd, String(mileage === null ? 0 : Math.round(mileage)),
                String(doors === null ? 0 : Math.round(doors)), transmission, fuel, engine === null ? 0 : Math.round(engine),
                color, customerId, agent?.id ?? null],
            )
          ).insertId
        : fakeId--;
      stockByChassis.set(norm(chassis), { id: stockId, sid, chassis } as RowDataPacket);
    }

    // Imported reservations earn the same points as reservations made in the UI.
    if (opts.commit && customerId && !existing?.customer_account_id) {
      await exec(
        `INSERT INTO points (customer_account_id, points, created_at, updated_at) VALUES (?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE points = points + VALUES(points), updated_at = NOW()`,
        [customerId, POINTS_PER_RESERVATION],
      );
    }

    // Purchase & costs
    if (opts.costs) {
      const auctionText = text(r.get("auction"));
      const auction = auctionText ? await auctionFor(auctionText) : null;
      const boughtVal = amount(r.get("bought"));
      if (boughtVal.split) messages.push(`Bought "${r.get("bought")}" — used the last price, ${boughtVal.value}`);
      const termVal = amount(r.get("term")).value;
      const term = termVal === null ? null : Math.round(termVal <= 1 ? termVal * 100 : termVal);
      let rate = amount(r.get("rate")).value;
      const cnfJpy = amount(r.get("cnfJpy")).value;
      if ((!rate || rate <= 0) && cnf && cnfJpy) rate = Math.round((cnfJpy / cnf) * 1000) / 1000;
      if (rate !== null && (rate <= 0 || rate >= 1e7)) rate = null;
      const purchaseDate = dateValue(r.get("date"));
      if (text(r.get("date")) && !purchaseDate) messages.push("Invalid purchase date — date was not imported");
      const notes = text(r.get("notes"))?.slice(0, 500) ?? null;
      const lot = lotText(r.get("lot"));
      if (opts.commit) {
        await exec(
          `INSERT INTO stock_purchases (stock_id, auction_id, lot_no, purchase_date, deposit_percent, exchange_rate,
             bought_price, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE auction_id = COALESCE(VALUES(auction_id), auction_id), lot_no = COALESCE(VALUES(lot_no), lot_no),
             purchase_date = COALESCE(VALUES(purchase_date), purchase_date),
             deposit_percent = COALESCE(VALUES(deposit_percent), deposit_percent),
             exchange_rate = COALESCE(VALUES(exchange_rate), exchange_rate),
             bought_price = IF(VALUES(bought_price) > 0, VALUES(bought_price), bought_price),
             notes = COALESCE(VALUES(notes), notes), updated_at = NOW()`,
          [stockId, auction?.id ?? null, lot, purchaseDate, term !== null && term >= 0 && term <= 100 ? term : null, rate,
            boughtVal.value === null ? 0 : Math.round(boughtVal.value), notes],
        );
      }
      for (const [field, typeName] of Object.entries(EXPENSE_FIELDS)) {
        const v = amount(r.get(field as Field)).value;
        if (!v || v <= 0) continue;
        const typeId = await expenseTypeId(typeName);
        if (opts.commit) {
          await exec(
            `INSERT INTO stock_expenses (stock_id, expense_type_id, amount, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE amount = VALUES(amount), updated_at = NOW()`,
            [stockId, typeId, Math.round(v)],
          );
        }
      }
    }

    // Vessel
    const vesselName = text(r.get("vessel")) ?? r.vessel?.name ?? null;
    if (vesselName) {
      if (!opts.shipments) messages.push("Vessel not linked (needs the Manage shipments permission)");
      else {
        const etd = dateValue(r.get("etd")) ?? r.vessel?.etd ?? null;
        const eta = dateValue(r.get("eta")) ?? r.vessel?.eta ?? null;
        const ship = await shipmentFor(vesselName, etd, eta);
        if (ship.error) messages.push(ship.error);
        else {
          out.vessel = vesselName;
          if (opts.commit) {
            await exec(
              `INSERT INTO shipment_stock (shipment_id, stock_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())
               ON DUPLICATE KEY UPDATE shipment_id = VALUES(shipment_id), updated_at = NOW()`,
              [ship.id, stockId],
            );
          }
        }
      }
    }
  }

  const summary: ImportSummary = {
    create: rows.filter((r) => r.action === "create").length,
    update: rows.filter((r) => r.action === "update").length,
    skip: rows.filter((r) => r.action === "skip").length,
    newCustomers: created.customers,
    newAuctions: created.auctions,
    newCountries: created.countries,
    newShipments: created.shipments,
    unmatchedStaff: [...unmatched].map(([name, n]) => ({ name, rows: n })).sort((a, b) => b.rows - a.rows),
  };
  return { rows, summary };
}

const toIso = (v: Date | string) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}` : String(v).slice(0, 10));
