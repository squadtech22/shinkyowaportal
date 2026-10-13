import "server-only";
import type { RowDataPacket } from "mysql2";
import { db } from "./db";
import { clientIp } from "./request";

export const ALREADY_SUBMITTED = "Inquiry Already Submitted, Please wait for reply";

/** True when this visitor already sent an inquiry for the vehicle (WebStockPageController::show). */
export async function hasInquired(stockId: number) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT 1 FROM inquiries WHERE stock_id = ? AND ip = ? LIMIT 1",
    [stockId, await clientIp()],
  );
  return rows.length > 0;
}
