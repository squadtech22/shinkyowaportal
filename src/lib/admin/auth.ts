import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { db } from "@/lib/db";
import type { DisplayCurrency } from "./format";
import { ALL_PERMISSIONS, isPermission, type Permission } from "./permissions";

export const SESSION_COOKIE = "skw_admin_session";
const SESSION_DAYS = 7;

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  roleId: number | null;
  roleName: string;
  isSuper: boolean;
  permissions: Set<Permission>;
  currency: DisplayCurrency;
  theme: "light" | "dark";
};

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  await db.query(
    `INSERT INTO admin_sessions (id, user_id, ip, user_agent, expires_at, created_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), NOW())`,
    [
      tokenId(token),
      userId,
      (h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 45) || null,
      (h.get("user-agent") ?? "").slice(0, 255),
      SESSION_DAYS,
    ],
  );
  await db.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [userId]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.query("DELETE FROM admin_sessions WHERE id = ?", [tokenId(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Revoke other browsers after a password change, keeping this session. */
export async function revokeOtherSessions(userId: number, connection?: PoolConnection) {
  const executor = connection ?? db;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await executor.query("DELETE FROM admin_sessions WHERE user_id = ? AND id <> ?", [userId, tokenId(token)]);
  } else {
    await executor.query("DELETE FROM admin_sessions WHERE user_id = ?", [userId]);
  }
}

/** Signed-in, active staff user for this request, or null. */
export const getCurrentUser = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT u.id, u.name, u.email, u.role_id, u.display_currency, u.theme, r.name AS role_name, r.is_super
     FROM admin_sessions s
     JOIN users u ON u.id = s.user_id AND u.is_active = 1 AND u.approval_status = 'approved'
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE s.id = ? AND s.expires_at > NOW()`,
    [tokenId(token)],
  );
  const row = rows[0];
  if (!row) return null;

  const isSuper = row.is_super === 1;
  let permissions: Permission[] = [];
  if (isSuper) {
    permissions = ALL_PERMISSIONS;
  } else if (row.role_id) {
    const [perms] = await db.query<RowDataPacket[]>("SELECT permission FROM role_permissions WHERE role_id = ?", [
      row.role_id,
    ]);
    permissions = perms.map((p) => String(p.permission)).filter(isPermission);
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roleId: row.role_id,
    roleName: row.role_name ?? "No role",
    isSuper,
    permissions: new Set(permissions),
    currency: row.display_currency === "PKR" ? "PKR" : "USD",
    theme: row.theme === "dark" ? "dark" : "light",
  };
});

export const can = (user: AdminUser | null, permission: Permission) =>
  Boolean(user && (user.isSuper || user.permissions.has(permission)));

/** True when the user has at least one of the permissions. */
export const canAny = (user: AdminUser | null, permissions: Permission[]) => permissions.some((p) => can(user, p));

/**
 * For pages: the signed-in user, redirecting to the login page when signed
 * out and to the "no access" page when the permission is missing (with a
 * list, when all of them are missing).
 */
export async function requireUser(permission?: Permission | Permission[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (permission && !canAny(user, Array.isArray(permission) ? permission : [permission])) redirect("/admin/no-access");
  return user;
}

export class NotAllowedError extends Error {
  constructor() {
    super("You do not have permission to do that.");
  }
}

/** For server actions: the signed-in user, or throws when not allowed. */
export async function authorize(...permissions: Permission[]) {
  const user = await getCurrentUser();
  if (!user || !permissions.every((p) => can(user, p))) throw new NotAllowedError();
  return user;
}

/** For server actions: like authorize(), but one of the permissions is enough. */
export async function authorizeAny(...permissions: Permission[]) {
  const user = await getCurrentUser();
  if (!user || !canAny(user, permissions)) throw new NotAllowedError();
  return user;
}

/**
 * users.manage manages every user; users.manage_team only the people who
 * report to them (users.manager_id), and new users report to them.
 */
export const managesOnlyTeam = (user: AdminUser) => !can(user, "users.manage") && can(user, "users.manage_team");

/**
 * Users without customers.view_all only see customers assigned to them
 * (customer_accounts.agent_id), plus, with customers.view_team, customers of
 * the users who report to them (users.manager_id). Returns a SQL condition on
 * alias `c`.
 */
export function customerScope(user: AdminUser, alias = "c"): { sql: string; params: unknown[] } {
  if (can(user, "customers.view_all")) return { sql: "1 = 1", params: [] };
  if (can(user, "customers.view_team")) {
    return {
      sql: `(${alias}.agent_id = ? OR ${alias}.agent_id IN (SELECT tm.id FROM users tm WHERE tm.manager_id = ?))`,
      params: [user.id, user.id],
    };
  }
  return { sql: `${alias}.agent_id = ?`, params: [user.id] };
}

/**
 * Staff a customer may be assigned to by this user: everyone with
 * customers.view_all, the user and their team with customers.view_team, and
 * otherwise nobody else (null: the customer is always assigned to the user).
 */
export async function assignableAgents(user: AdminUser): Promise<{ id: number; name: string }[] | null> {
  let sql: string;
  let params: unknown[] = [];
  if (can(user, "customers.view_all")) sql = "SELECT id, name FROM users WHERE is_active = 1 AND approval_status = 'approved' ORDER BY name";
  else if (can(user, "customers.view_team")) {
    sql = "SELECT id, name FROM users WHERE is_active = 1 AND approval_status = 'approved' AND (id = ? OR manager_id = ?) ORDER BY name";
    params = [user.id, user.id];
  } else return null;
  const [rows] = await db.query<RowDataPacket[]>(sql, params);
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

// Simple in-memory login throttle: 8 failed attempts per email+IP per 15 min.
const failures = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;

export function loginBlocked(key: string) {
  const entry = failures.get(key);
  if (!entry || entry.until < Date.now()) return false;
  return entry.count >= 8;
}

export function recordLoginFailure(key: string) {
  const entry = failures.get(key);
  if (!entry || entry.until < Date.now()) failures.set(key, { count: 1, until: Date.now() + WINDOW_MS });
  else entry.count++;
}

export const clearLoginFailures = (key: string) => failures.delete(key);
