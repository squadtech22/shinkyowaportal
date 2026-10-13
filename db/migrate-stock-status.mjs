import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

/** Adds the optional manual sales label without changing any existing stock data. */
export async function migrateStockStatus(conn) {
  const [columns] = await conn.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stocks' AND COLUMN_NAME = 'status_override'",
  );
  if (columns.length) return false;
  try {
    await conn.query(
      "ALTER TABLE stocks ADD COLUMN status_override ENUM('available', 'reserved', 'shipped', 'cleared') NULL DEFAULT NULL AFTER is_listed",
    );
  } catch (error) {
    // Another setup process may have added the same column after our check.
    if (error?.code === "ER_DUP_FIELDNAME") return false;
    throw error;
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
  });
  try {
    const added = await migrateStockStatus(conn);
    console.log(added ? "Added stocks.status_override. Existing stock data preserved." : "stocks.status_override already exists. No changes needed.");
  } finally {
    await conn.end();
  }
}
