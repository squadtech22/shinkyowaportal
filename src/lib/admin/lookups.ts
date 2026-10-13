import "server-only";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { parseFeatures } from "@/lib/features";

// Select-box options for admin forms.

export type Option = { id: number; name: string };

const list = async (sql: string) => {
  const [rows] = await db.query<RowDataPacket[]>(sql);
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
};

export const makeOptions = () => list("SELECT id, name FROM makes ORDER BY name");
export const bodyTypeOptions = () => list("SELECT id, name FROM body_types ORDER BY name");
export const categoryOptions = () => list("SELECT id, name FROM categories ORDER BY name");
export const countryOptions = () => list("SELECT id, name FROM countries ORDER BY name");
export const currencyOptions = () => list("SELECT id, CONCAT(code, ' (', symbol, ')') AS name FROM currencies ORDER BY id");
export const auctionOptions = () => list("SELECT id, name FROM auctions ORDER BY name");
export const expenseTypeOptions = () => list("SELECT id, name FROM expense_types ORDER BY id");
export const roleOptions = () => list("SELECT id, name FROM roles ORDER BY is_super DESC, name");
export const staffOptions = () =>
  list("SELECT id, name FROM users WHERE is_active = 1 AND approval_status = 'approved' ORDER BY name");

export const FUELS = ["petrol", "diesel", "hybrid", "electric", "gasoline"] as const;
export const TRANSMISSIONS = ["automatic", "manual"] as const;

/** Feature names already used on vehicles, for suggestions on the stock form. */
export async function featureNames() {
  const [rows] = await db.query<RowDataPacket[]>("SELECT DISTINCT features FROM stocks WHERE features IS NOT NULL");
  const names = new Set(rows.flatMap((r) => parseFeatures(r.features).map((f) => f.name)));
  return [...names].sort((a, b) => a.localeCompare(b));
}
