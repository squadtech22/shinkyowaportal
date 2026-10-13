import "server-only";
import mysql from "mysql2/promise";

// One pool per server process. In dev, hot reloads re-evaluate this module,
// so the pool is kept on globalThis to avoid opening a new one each time.
const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool };

export const db =
  globalForDb.mysqlPool ??
  mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
    connectionLimit: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.mysqlPool = db;
