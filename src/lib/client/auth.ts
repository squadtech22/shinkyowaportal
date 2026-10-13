import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

// Customer portal (/client) sign-in. Kept apart from staff sessions
// (src/lib/admin/auth.ts): its own cookie and table, so a customer session
// can never open the admin panel and the other way round.

export const CLIENT_COOKIE = "skw_client_session";
const SESSION_DAYS = 14;

export type PortalCustomer = { id: number; name: string; email: string };

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createClientSession(customerId: number) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  await db.query(
    `INSERT INTO client_sessions (id, customer_account_id, ip, user_agent, expires_at, created_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), NOW())`,
    [
      tokenId(token),
      customerId,
      (h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 45) || null,
      (h.get("user-agent") ?? "").slice(0, 255),
      SESSION_DAYS,
    ],
  );
  await db.query("UPDATE customer_accounts SET last_login_at = NOW() WHERE id = ?", [customerId]);
  (await cookies()).set(CLIENT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroyClientSession() {
  const jar = await cookies();
  const token = jar.get(CLIENT_COOKIE)?.value;
  if (token) await db.query("DELETE FROM client_sessions WHERE id = ?", [tokenId(token)]);
  jar.delete(CLIENT_COOKIE);
}

/** Revoke other browsers after a password change, keeping this session. */
export async function revokeOtherClientSessions(customerId: number) {
  const token = (await cookies()).get(CLIENT_COOKIE)?.value;
  if (token) {
    await db.query("DELETE FROM client_sessions WHERE customer_account_id = ? AND id <> ?", [customerId, tokenId(token)]);
  } else {
    await db.query("DELETE FROM client_sessions WHERE customer_account_id = ?", [customerId]);
  }
}

/** Signed-in customer for this request, or null. Removing the password ends every session. */
export const getCurrentCustomer = cache(async (): Promise<PortalCustomer | null> => {
  const token = (await cookies()).get(CLIENT_COOKIE)?.value;
  if (!token) return null;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.id, c.name, c.email FROM client_sessions s
     JOIN customer_accounts c ON c.id = s.customer_account_id AND c.password IS NOT NULL
     WHERE s.id = ? AND s.expires_at > NOW()`,
    [tokenId(token)],
  );
  const row = rows[0];
  return row ? { id: Number(row.id), name: String(row.name), email: String(row.email) } : null;
});

/** For portal pages: the signed-in customer, or a redirect to /login. */
export async function requireCustomer() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");
  return customer;
}
