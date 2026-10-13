import "server-only";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { isShipmentStatus, type ShipmentStatus } from "@/lib/shipment-status";
import { customerScope, type AdminUser } from "./auth";

// A shipment is a vessel sailing (ETD departure, ETA arrival) carrying
// reserved vehicles (shipment_stock). Users without customers.view_all only
// see the vehicles of their own customers, and shipments carrying none of
// them are hidden (empty shipments are shown to everyone).
//
// The status follows the ETD/ETA dates unless set by hand (shipments.status).

export const SHIPMENT_FILTERS = ["upcoming", "at_sea", "arrived", "all"] as const;
export type ShipmentFilter = (typeof SHIPMENT_FILTERS)[number];

/** The status from the dates alone: SQL on shipment alias `sh`. */
const AUTOMATIC_STATUS_SQL = `CASE WHEN sh.etd > CURDATE() THEN 'upcoming'
  WHEN sh.eta > CURDATE() THEN 'at_sea' ELSE 'arrived' END`;
/** The status shown: set by hand, else from the dates. SQL on shipment alias `sh`. */
export const EFFECTIVE_STATUS_SQL = `COALESCE(sh.status, ${AUTOMATIC_STATUS_SQL})`;

const STATUS_SQL: Record<ShipmentFilter, string> = {
  upcoming: `${EFFECTIVE_STATUS_SQL} = 'upcoming'`,
  at_sea: `${EFFECTIVE_STATUS_SQL} = 'at_sea'`,
  arrived: `${EFFECTIVE_STATUS_SQL} = 'arrived'`,
  all: "1 = 1",
};

export { SHIPMENT_STATUSES, SHIPMENT_STATUS_LABELS, isShipmentStatus, type ShipmentStatus } from "@/lib/shipment-status";

/** The status set by hand, else the one the dates give. */
export function shipmentStatus(etd: Date | string, eta: Date | string, override?: string | null): ShipmentStatus {
  if (isShipmentStatus(override)) return override;
  return automaticShipmentStatus(etd, eta);
}

export function automaticShipmentStatus(etd: Date | string, eta: Date | string): ShipmentStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(etd) > today) return "upcoming";
  if (new Date(eta) > today) return "at_sea";
  return "arrived";
}

/** Vehicles on board visible to the user: SQL on shipment alias `sh`. */
function visibleCars(user: AdminUser) {
  const scope = customerScope(user);
  return {
    sql: `(SELECT COUNT(*) FROM shipment_stock ss JOIN stocks s ON s.id = ss.stock_id
           LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
           WHERE ss.shipment_id = sh.id AND ${scope.sql})`,
    params: scope.params,
  };
}

export const SHIPMENTS_PER_PAGE = 25;

export async function listShipments(user: AdminUser, q: string, filter: ShipmentFilter, page: number) {
  const visible = visibleCars(user);
  const scope = customerScope(user);
  const where = [`(${visible.sql} > 0 OR NOT EXISTS (SELECT 1 FROM shipment_stock x WHERE x.shipment_id = sh.id))`];
  const params: unknown[] = [...visible.params];
  if (q.trim()) {
    // Vessel name, or the stock number / chassis / customer of a vehicle on board.
    where.push(`(CONCAT_WS(' ', sh.vessel_name, sh.container_no, sh.bl_no) LIKE ? OR EXISTS (
      SELECT 1 FROM shipment_stock ss JOIN stocks s ON s.id = ss.stock_id
      LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
      WHERE ss.shipment_id = sh.id AND CONCAT_WS(' ', CONCAT('SKI-', s.sid), s.chassis, c.name, c.company) LIKE ? AND ${scope.sql}))`);
    const like = `%${q.trim().replace(/[\\%_]/g, "\\$&")}%`;
    params.push(like, like, ...scope.params);
  }
  const base = `FROM shipments sh WHERE ${where.join(" AND ")}`;
  const counts = Object.fromEntries(
    await Promise.all(
      SHIPMENT_FILTERS.map(async (key) => {
        const [[row]] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${base} AND ${STATUS_SQL[key]}`, params);
        return [key, Number(row.n)] as const;
      }),
    ),
  ) as Record<ShipmentFilter, number>;
  // Upcoming and at-sea vessels soonest first; arrived ones latest first.
  const order = filter === "arrived" || filter === "all" ? "sh.eta DESC" : "sh.etd ASC";
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT sh.id, sh.vessel_name, sh.method, sh.container_no, sh.bl_no, sh.etd, sh.eta, sh.status, ${visible.sql} AS cars
     ${base} AND ${STATUS_SQL[filter]} ORDER BY ${order}, sh.id DESC LIMIT ? OFFSET ?`,
    [...visible.params, ...params, SHIPMENTS_PER_PAGE, (page - 1) * SHIPMENTS_PER_PAGE],
  );
  return { rows, counts, total: counts[filter] };
}

/** The shipment with the vehicles on board the user can see, or null. */
export async function getShipment(user: AdminUser, id: number) {
  const scope = customerScope(user);
  const [[shipment]] = await db.query<RowDataPacket[]>(
    "SELECT sh.*, (SELECT COUNT(*) FROM shipment_stock x WHERE x.shipment_id = sh.id) AS total_cars FROM shipments sh WHERE sh.id = ?",
    [id],
  );
  if (!shipment) return null;
  const [cars] = await db.query<RowDataPacket[]>(
    `SELECT s.id, s.sid, s.year, s.model, s.chassis, m.name AS make, c.id AS customer_id, c.name AS customer,
            c.company, co.name AS country
     FROM shipment_stock ss
     JOIN stocks s ON s.id = ss.stock_id
     LEFT JOIN makes m ON m.id = s.make_id
     LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
     LEFT JOIN countries co ON co.id = c.country_id
     WHERE ss.shipment_id = ? AND ${scope.sql}
     ORDER BY c.name, s.id`,
    [id, ...scope.params],
  );
  const hidden = Number(shipment.total_cars) - cars.length;
  if (cars.length === 0 && hidden > 0) return null;
  return { shipment, cars, hidden };
}

export type ShippableVehicle = { id: number; label: string; customer: string };

/**
 * Reserved vehicles of customers the user can see that are not on another
 * vessel: the choices on the shipment form.
 */
export async function shippableVehicles(user: AdminUser, shipmentId: number | null): Promise<ShippableVehicle[]> {
  const scope = customerScope(user);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT s.id, s.sid, s.year, s.model, s.chassis, m.name AS make, c.name AS customer
     FROM stocks s
     LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
     LEFT JOIN makes m ON m.id = s.make_id
     LEFT JOIN shipment_stock ss ON ss.stock_id = s.id
     WHERE ((ss.shipment_id IS NULL AND s.customer_account_id IS NOT NULL) OR ss.shipment_id = ?) AND ${scope.sql}
     ORDER BY c.name IS NULL, c.name, s.id`,
    [shipmentId ?? 0, ...scope.params],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    label: `SKI-${r.sid} · ${r.year} ${r.make ?? ""} ${r.model} · ${r.chassis}`,
    // Released after being put on this vessel.
    customer: r.customer ? String(r.customer) : "No longer reserved",
  }));
}
