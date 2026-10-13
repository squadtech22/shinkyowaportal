import "server-only";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { db } from "@/lib/db";
import { can, managesOnlyTeam, type AdminUser } from "./auth";
import { isPermission } from "./permissions";

// Someone who only manages their own team cannot make other team managers
// or user admins.
const TEAM_MANAGER_FORBIDDEN = new Set(["users.manage", "users.manage_team", "roles.manage"]);

/** True when a non-super actor may give a role with these permissions. */
function mayGive(actor: AdminUser, permissions: string[]) {
  if (managesOnlyTeam(actor) && permissions.some((p) => TEAM_MANAGER_FORBIDDEN.has(p))) return false;
  return permissions.every((p) => !isPermission(p) || can(actor, p));
}

/**
 * True when the actor may give someone this role: Super Admins any role,
 * others only non-super roles whose permissions they have themselves.
 */
export async function canAssignRole(actor: AdminUser, roleId: number, connection?: PoolConnection) {
  const executor = connection ?? db;
  const [[role]] = await executor.query<RowDataPacket[]>("SELECT is_super FROM roles WHERE id = ?", [roleId]);
  if (!role) return false;
  if (actor.isSuper) return true;
  if (role.is_super) return false;
  const [perms] = await executor.query<RowDataPacket[]>("SELECT permission FROM role_permissions WHERE role_id = ?", [roleId]);
  return mayGive(actor, perms.map((p) => String(p.permission)));
}

/** Roles (with descriptions) the actor may give, for select boxes. */
export async function rolesAssignableBy(actor: AdminUser) {
  const [[roles], [perms]] = await Promise.all([
    db.query<RowDataPacket[]>("SELECT id, name, COALESCE(description, '') AS description, is_super FROM roles ORDER BY is_super DESC, name"),
    db.query<RowDataPacket[]>("SELECT role_id, permission FROM role_permissions"),
  ]);
  return roles
    .filter((r) => {
      if (actor.isSuper) return true;
      if (r.is_super) return false;
      return mayGive(
        actor,
        perms.filter((p) => p.role_id === r.id).map((p) => String(p.permission)),
      );
    })
    .map((r) => ({ id: Number(r.id), name: String(r.name), description: String(r.description) }));
}
