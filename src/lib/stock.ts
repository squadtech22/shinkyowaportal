import "server-only";
import { cache } from "react";
import type { RowDataPacket } from "mysql2";
import { db } from "./db";
import { featureText, parseFeatures } from "./features";
import { IMAGE_API_URL, STOCK_IMG_URL, type Country, type SidebarEntry, type Vehicle } from "./data";

// SQL ports of the Laravel queries (HomeController, WebStockPageController and
// the view-composer providers). The tables use utf8mb4_unicode_ci, so string
// comparisons are case-insensitive like on the Laravel site.

export const PER_PAGE = 8;

const SELECT_STOCK = `
  SELECT s.*, m.name AS make_name, bt.name AS body_type_name, cat.name AS category_name,
         co.name AS country_name, cur.symbol AS currency_symbol, cur.code AS currency_code
  FROM website_stocks s
  LEFT JOIN makes m ON m.id = s.make_id
  LEFT JOIN body_types bt ON bt.id = s.body_type_id
  LEFT JOIN categories cat ON cat.id = s.category_id
  LEFT JOIN countries co ON co.id = s.country_id
  LEFT JOIN currencies cur ON cur.id = s.currency_id`;

// Full URLs and site paths (photos uploaded in the admin panel, "/uploads/...")
// are used as-is; other paths are relative to the CRM storage host.
export const stockImage = (path: string | null) =>
  !path ? "" : /^(https?:\/\/|\/)/.test(path) ? path : STOCK_IMG_URL + path;

// images/features are TEXT columns holding JSON arrays (as Laravel stores them).
function jsonList(text: string | null): string[] {
  if (!text) return [];
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return text.split(",").map((s) => s.trim().replace(/^[\["]+|[\]"]+$/g, "")).filter(Boolean);
  }
}

function toVehicle(r: RowDataPacket): Vehicle {
  return {
    id: r.id,
    sid: Number(r.sid),
    thumbnail: stockImage(r.thumbnail),
    images: jsonList(r.images).map(stockImage),
    chassis: r.chassis,
    make: r.make_name ?? "",
    model: r.model,
    year: Number(r.year),
    fob: r.fob,
    currency: { symbol: r.currency_symbol ?? "$", code: r.currency_code ?? "USD" },
    mileage: Number(r.mileage),
    doors: Number(r.doors),
    transmission: r.transmission,
    bodyType: r.body_type_name ?? "",
    fuel: r.fuel,
    category: r.category_name ?? "",
    country: r.country_name ?? "",
    engine: r.engine,
    color: r.color ?? "",
    features: parseFeatures(r.features).map(featureText),
  };
}

async function selectStock(where = "", params: unknown[] = [], tail = "ORDER BY s.id DESC") {
  const [rows] = await db.query<RowDataPacket[]>(`${SELECT_STOCK} ${where} ${tail}`, params);
  return rows.map(toVehicle);
}

export async function getVehicle(id: number) {
  if (!Number.isInteger(id) || id < 1) return undefined;
  const [vehicle] = await selectStock("WHERE s.id = ?", [id], "");
  return vehicle;
}

export const totalStock = cache(async () => {
  const [[row]] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM website_stocks");
  return Number(row.total);
});

export async function homeSections() {
  const byCategory = (name: string) =>
    selectStock("WHERE cat.name = ?", [name], "ORDER BY s.id DESC LIMIT 15");
  const [newArrival, discounted, commercial, all] = await Promise.all([
    byCategory("New Arrival"),
    byCategory("Discounted"),
    byCategory("Commercial"),
    selectStock("", [], "ORDER BY s.id DESC LIMIT 15"),
  ]);
  return { "New Arrival": newArrival, Discounted: discounted, Commercial: commercial, All: all };
}

export const vehiclesOfTheDay = cache(() => selectStock("", [], "ORDER BY s.id DESC LIMIT 3"));

export function relatedStock(vehicle: Vehicle) {
  return selectStock("WHERE cat.name = ? AND s.id <> ?", [vehicle.category, vehicle.id], "ORDER BY s.id LIMIT 6");
}

export const countries = cache(async (): Promise<Country[]> => {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, name FROM countries ORDER BY id");
  return rows.map((r) => ({ id: r.id, name: r.name }));
});

// Body-type icons whose file names differ from the type name.
const TYPE_ICON: Record<string, string> = { Buses: "bus", "Mini Buses": "minibus" };

/** Make / body type / country tiles with vehicle counts, in table order. */
export const sidebarData = cache(async () => {
  const [[makes], [types], [places]] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT m.name, m.image, COUNT(s.id) AS n FROM makes m
       LEFT JOIN website_stocks s ON s.make_id = m.id GROUP BY m.id ORDER BY m.id`,
    ),
    db.query<RowDataPacket[]>(
      `SELECT b.name, COUNT(s.id) AS n FROM body_types b
       LEFT JOIN website_stocks s ON s.body_type_id = b.id GROUP BY b.id ORDER BY b.id`,
    ),
    db.query<RowDataPacket[]>(
      `SELECT c.name, COUNT(s.id) AS n FROM countries c
       LEFT JOIN website_stocks s ON s.country_id = c.id GROUP BY c.id ORDER BY c.id`,
    ),
  ]);
  const imageUrl = (path: string) => (/^https?:\/\//.test(path) ? path : IMAGE_API_URL + path);
  const entries = (rows: RowDataPacket[], prefix: string, img: (r: RowDataPacket) => string): SidebarEntry[] =>
    rows.map((r) => ({ name: r.name, href: `/${prefix}/${encodeURIComponent(r.name)}`, img: img(r), count: Number(r.n) }));

  return {
    makes: entries(makes, "make", (r) =>
      imageUrl(r.image ?? `images/makes/${r.name.toLowerCase().replace(/\s+/g, "-")}.avif`),
    ),
    types: entries(types, "type", (r) =>
      imageUrl(`images/type/${TYPE_ICON[r.name] ?? r.name.toLowerCase()}.avif`),
    ),
    countries: entries(places, "country", (r) => imageUrl(`images/flags/${r.name.toLowerCase()}.avif`)),
  };
});

/** Distinct models per make, for the dependent "Model" dropdowns. */
export const modelsByMake = cache(async () => {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT DISTINCT m.name AS make, s.model FROM website_stocks s JOIN makes m ON m.id = s.make_id ORDER BY s.model`,
  );
  const map: Record<string, string[]> = {};
  for (const r of rows) (map[r.make] ??= []).push(r.model);
  return map;
});

/** Distinct years per model, for the dependent "Year" dropdowns. */
export async function yearsByModel() {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT DISTINCT model, CAST(year AS UNSIGNED) AS year FROM website_stocks ORDER BY year",
  );
  const map: Record<string, number[]> = {};
  for (const r of rows) {
    const years = (map[r.model] ??= []);
    if (!years.includes(Number(r.year))) years.push(Number(r.year));
  }
  return map;
}

export async function filterOptions() {
  const [[makes], [models], [types], [years], places] = await Promise.all([
    db.query<RowDataPacket[]>("SELECT name FROM makes ORDER BY name"),
    db.query<RowDataPacket[]>("SELECT DISTINCT model FROM website_stocks ORDER BY model"),
    db.query<RowDataPacket[]>("SELECT name FROM body_types ORDER BY name"),
    db.query<RowDataPacket[]>("SELECT DISTINCT CAST(year AS UNSIGNED) AS year FROM website_stocks ORDER BY year"),
    countries(),
  ]);
  return {
    make: makes.map((r) => r.name as string),
    model: models.map((r) => r.model as string),
    bodytype: types.map((r) => r.name as string),
    year: years.map((r) => Number(r.year)),
    country: places.map((c) => c.name),
  };
}

export type StockQuery = Record<string, string | undefined>;

const MILEAGE_LIMITS: Record<string, number> = {
  "under 50,000": 50000,
  "under 100,000": 100000,
  "under 200,000": 200000,
  "under 300,000": 300000,
};

export type Where = { sql: string[]; params: unknown[] };

/** WHERE clause for the /filter form and the /make, /type, /country, /category routes. */
export function stockFilter(q: StockQuery): Where {
  const w: Where = { sql: [], params: [] };
  const add = (sql: string, ...params: unknown[]) => {
    w.sql.push(sql);
    w.params.push(...params);
  };
  if (q.make) add("m.name = ?", q.make);
  if (q.model) add("s.model = ?", q.model);
  if (q.stock) add("CAST(s.sid AS UNSIGNED) = ?", parseInt(q.stock.replace(/SKI-/i, ""), 10) || 0);
  const body = q.bodytype ?? q.bodyType;
  if (body) add("bt.name = ?", body);
  if (q.mileage && MILEAGE_LIMITS[q.mileage]) add("CAST(s.mileage AS UNSIGNED) < ?", MILEAGE_LIMITS[q.mileage]);
  if (q.country) add("co.name = ?", q.country);
  if (q.category && !["all", "stock"].includes(q.category.toLowerCase())) add("cat.name = ?", q.category);
  if (q.fueltype) add("s.fuel = ?", q.fueltype);
  if (q.transmission) add("s.transmission = ?", q.transmission);
  if (q.yearfrom) add("CAST(s.year AS UNSIGNED) >= ?", Number(q.yearfrom) || 0);
  if (q.yearto) add("CAST(s.year AS UNSIGNED) <= ?", Number(q.yearto) || 0);
  return w;
}

/** WHERE clause for the header search box (/stock-search). */
export function stockSearch(search: string): Where {
  const term = search.trim();
  if (!term) return { sql: [], params: [] };
  const like = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  if (term.split(/\s+/).length === 1) {
    return {
      sql: ["(m.name LIKE ? OR s.model LIKE ? OR s.year LIKE ? OR s.chassis LIKE ?)"],
      params: [like, like, like, like],
    };
  }
  return { sql: ["CONCAT_WS(' ', m.name, s.model, s.year, s.chassis) LIKE ?"], params: [like] };
}

const ORDER: Record<string, string> = {
  hightolow: "ORDER BY s.fob DESC, s.id DESC",
  lowtohigh: "ORDER BY s.fob ASC, s.id DESC",
};

/** One page of stock for the listing pages, newest first unless `sortBy` is set. */
export async function listStock(where: Where, sortBy: string | undefined, page: number) {
  const whereSql = where.sql.length ? `WHERE ${where.sql.join(" AND ")}` : "";
  const [[{ total }]] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM website_stocks s
     LEFT JOIN makes m ON m.id = s.make_id
     LEFT JOIN body_types bt ON bt.id = s.body_type_id
     LEFT JOIN categories cat ON cat.id = s.category_id
     LEFT JOIN countries co ON co.id = s.country_id
     ${whereSql}`,
    where.params,
  );
  const lastPage = Math.max(1, Math.ceil(Number(total) / PER_PAGE));
  const requestedPage = Number.isFinite(page) ? Math.floor(page) : 1;
  const currentPage = Math.min(Math.max(1, requestedPage), lastPage);
  const items = await selectStock(
    whereSql,
    [...where.params, PER_PAGE, (currentPage - 1) * PER_PAGE],
    `${ORDER[sortBy ?? ""] ?? "ORDER BY s.id DESC"} LIMIT ? OFFSET ?`,
  );
  return { items, total: Number(total), currentPage, lastPage };
}

