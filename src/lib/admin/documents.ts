import "server-only";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { DOCUMENT_KEYS, documentColumns } from "@/lib/documents";
import { customerScope, type AdminUser } from "./auth";

// Export paperwork per reserved vehicle (one `documents` row per stock).

export const DOCUMENT_FILTERS = ["missing", "complete", "all"] as const;
export type DocumentFilter = (typeof DOCUMENT_FILTERS)[number];

const COMPLETE_SQL = DOCUMENT_KEYS.map((k) => `d.${k} IS NOT NULL`).join(" AND ");
const FILTER_SQL: Record<DocumentFilter, string> = {
  missing: `NOT (${COMPLETE_SQL}) OR d.id IS NULL`,
  complete: COMPLETE_SQL,
  all: "1 = 1",
};

export const DOCUMENTS_PER_PAGE = 25;

/** Reserved vehicles of customers the user can see, with which papers are uploaded. */
export async function listDocuments(user: AdminUser, q: string, filter: DocumentFilter, page: number) {
  const scope = customerScope(user);
  const where = ["s.customer_account_id IS NOT NULL", scope.sql];
  const params: unknown[] = [...scope.params];
  if (q.trim()) {
    where.push("CONCAT_WS(' ', CONCAT('SKI-', s.sid), s.chassis, s.model, m.name, c.name, c.company) LIKE ?");
    params.push(`%${q.trim().replace(/[\\%_]/g, "\\$&")}%`);
  }
  const base = `
    FROM stocks s
    JOIN customer_accounts c ON c.id = s.customer_account_id
    LEFT JOIN makes m ON m.id = s.make_id
    LEFT JOIN documents d ON d.stock_id = s.id
    WHERE ${where.join(" AND ")}`;
  const counts = Object.fromEntries(
    await Promise.all(
      DOCUMENT_FILTERS.map(async (key) => {
        const [[row]] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${base} AND (${FILTER_SQL[key]})`, params);
        return [key, Number(row.n)] as const;
      }),
    ),
  ) as Record<DocumentFilter, number>;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT s.id, s.sid, s.year, s.model, s.chassis, m.name AS make, c.id AS customer_id, c.name AS customer,
            d.updated_at AS documents_updated, ${documentColumns("d")}
     ${base} AND (${FILTER_SQL[filter]})
     ORDER BY d.updated_at IS NULL, d.updated_at DESC, s.id DESC LIMIT ? OFFSET ?`,
    [...params, DOCUMENTS_PER_PAGE, (page - 1) * DOCUMENTS_PER_PAGE],
  );
  return { rows, counts, total: counts[filter] };
}

/**
 * A vehicle with its documents row (null columns when nothing is uploaded),
 * or null when the user may not see it. Users with customers.view_all can
 * also open vehicles that are no longer reserved.
 */
export async function getVehicleDocuments(user: AdminUser, stockId: number) {
  const scope = customerScope(user);
  const [[row]] = await db.query<RowDataPacket[]>(
    `SELECT s.id, s.sid, s.year, s.model, s.chassis, m.name AS make, c.id AS customer_id, c.name AS customer,
            d.id AS document_id, d.updated_at AS documents_updated, ${documentColumns("d")}
     FROM stocks s
     LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
     LEFT JOIN makes m ON m.id = s.make_id
     LEFT JOIN documents d ON d.stock_id = s.id
     WHERE s.id = ? AND ${scope.sql}`,
    [stockId, ...scope.params],
  );
  return row ?? null;
}
