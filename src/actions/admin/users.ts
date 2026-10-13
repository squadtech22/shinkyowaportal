"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { db } from "@/lib/db";
import { formReader, runAction, ValidationError, type ActionState } from "@/lib/admin/actions";
import { authorizeAny, can, managesOnlyTeam, NotAllowedError, revokeOtherSessions, type AdminUser } from "@/lib/admin/auth";
import { setFlash } from "@/lib/admin/flash";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/admin/password";
import { canAssignRole } from "@/lib/admin/roles";

const isSuperRole = async (connection: PoolConnection, roleId: number | null) => {
  if (!roleId) return false;
  const [rows] = await connection.query<RowDataPacket[]>("SELECT is_super FROM roles WHERE id = ?", [roleId]);
  return rows[0]?.is_super === 1;
};

const activeSuperAdmins = async (connection: PoolConnection, excludeUserId: number) => {
  const [[row]] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.is_super = 1 AND u.is_active = 1 AND u.approval_status = 'approved' AND u.id <> ?`,
    [excludeUserId],
  );
  return Number(row.n);
};

/** Serialize user changes before counting Super Admins, and commit them atomically. */
async function userTransaction(body: (connection: PoolConnection) => Promise<ActionState>): Promise<ActionState> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // Every competing save/delete locks the same role before its first read.
    // The next transaction therefore sees the previous one's committed count.
    await connection.query("SELECT id FROM roles WHERE is_super = 1 ORDER BY id FOR UPDATE");
    const result = await body(connection);
    if (result?.error) await connection.rollback();
    else await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Only Super Admins may manage Super Admin accounts or hand out that role,
 * and team managers (users.manage_team) only the people reporting to them.
 */
async function assertCanTouch(connection: PoolConnection, actor: AdminUser, targetUserId: number | null, newRoleId: number | null) {
  if (actor.isSuper) return;
  if (await isSuperRole(connection, newRoleId)) throw new NotAllowedError();
  if (targetUserId) {
    const [rows] = await connection.query<RowDataPacket[]>("SELECT role_id, manager_id FROM users WHERE id = ? FOR UPDATE", [targetUserId]);
    if (await isSuperRole(connection, rows[0]?.role_id ?? null)) throw new NotAllowedError();
    if (managesOnlyTeam(actor) && rows[0] && rows[0].manager_id !== actor.id) throw new NotAllowedError();
  }
}

/** Commission fields of the user form (only read with commission.manage). */
function readCommission(f: ReturnType<typeof formReader>) {
  const type = f.raw("commission_type");
  if (type !== "percent" && type !== "fixed") return { type: null, value: null };
  const text = f.raw("commission_value").replace(/[,\s%¥]/g, "");
  const value = Number(text);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) f.errors.commission_value = "Enter a number with at most 2 decimals";
  else if (type === "percent" && value > 100) f.errors.commission_value = "At most 100%";
  return { type, value: Number.isFinite(value) ? value : null };
}

export async function saveUser(id: number | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await authorizeAny("users.manage", "users.manage_team");
    const f = formReader(form);
    const name = f.text("name", { required: true, max: 255, label: "Name" });
    const email = f.email("email", { required: true });
    const roleId = f.id("role_id", { required: true, label: "Role" });
    // Team managers' staff always report to them.
    const managerId = managesOnlyTeam(actor) ? actor.id : f.id("manager_id");
    const commission = can(actor, "commission.manage") ? readCommission(f) : null;
    if (managerId && managerId === id) f.errors.manager_id = "Someone cannot report to themselves";
    const active = f.checked("is_active");
    const password = String(form.get("password") ?? "");
    if ((!id || password) && password.length < MIN_PASSWORD_LENGTH) {
      f.errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    f.done();
    const result = await userTransaction(async (connection) => {
      await assertCanTouch(connection, actor, id, roleId);
      if (!(await canAssignRole(actor, roleId!, connection))) throw new ValidationError({ role_id: "You cannot give this role" });
      if (managerId) {
        const [rows] = await connection.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ? AND is_active = 1 AND approval_status = 'approved'", [managerId]);
        if (!rows.length) throw new ValidationError({ manager_id: "Choose someone from the list" });
      }

      if (id) {
        if (id === actor.id && !active) throw new ValidationError({ is_active: "You cannot disable your own account" });
        const [[current]] = await connection.query<RowDataPacket[]>("SELECT role_id FROM users WHERE id = ? FOR UPDATE", [id]);
        if (!current) return { error: "User not found." };
        // Never leave the system without an active Super Admin.
        const wasSuper = await isSuperRole(connection, current.role_id);
        if (wasSuper && (!(await isSuperRole(connection, roleId)) || !active) && (await activeSuperAdmins(connection, id)) === 0) {
          return { error: "This is the last active Super Admin. Make someone else a Super Admin first." };
        }
        await connection.query(
          `UPDATE users SET name = ?, email = ?, role_id = ?, manager_id = ?, is_active = ?, updated_at = NOW() WHERE id = ?`,
          [name, email, roleId, managerId, active ? 1 : 0, id],
        );
        if (password) {
          await connection.query("UPDATE users SET password = ? WHERE id = ?", [await hashPassword(password), id]);
          // Sign the user out everywhere else after a password reset.
          if (id !== actor.id) await connection.query("DELETE FROM admin_sessions WHERE user_id = ?", [id]);
          else await revokeOtherSessions(id, connection);
        }
        if (!active) await connection.query("DELETE FROM admin_sessions WHERE user_id = ?", [id]);
        if (commission) {
          await connection.query("UPDATE users SET commission_type = ?, commission_value = ? WHERE id = ?", [commission.type, commission.value, id]);
        }
      } else {
        await connection.query(
          `INSERT INTO users (name, email, password, role_id, manager_id, is_active, commission_type, commission_value,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [name, email, await hashPassword(password), roleId, managerId, active ? 1 : 0, commission?.type ?? null,
            commission?.value ?? null],
        );
      }
      return null;
    });
    if (result?.error) return result;
    await setFlash(id ? "User updated" : `${name} can now sign in at /login`);
    revalidatePath("/admin/users");
    redirect("/admin/users");
  });
}

export async function deleteUser(id: number): Promise<ActionState> {
  return runAction(async () => {
    const actor = await authorizeAny("users.manage", "users.manage_team");
    if (id === actor.id) return { error: "You cannot delete your own account." };
    const result = await userTransaction(async (connection) => {
      await assertCanTouch(connection, actor, id, null);
      const [rows] = await connection.query<RowDataPacket[]>("SELECT role_id FROM users WHERE id = ? FOR UPDATE", [id]);
      if (!rows[0]) return { error: "User not found." };
      if ((await isSuperRole(connection, rows[0].role_id)) && (await activeSuperAdmins(connection, id)) === 0) {
        return { error: "This is the last active Super Admin and cannot be deleted." };
      }
      const [[paid]] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM commissions WHERE user_id = ?", [id]);
      if (Number(paid.n) > 0) return { error: "This user has commission records. Disable the account instead of deleting it." };
      // Their customers become unassigned (FK ON DELETE SET NULL).
      await connection.query("DELETE FROM users WHERE id = ?", [id]);
      return null;
    });
    if (result?.error) return result;
    await setFlash("User deleted");
    revalidatePath("/admin/users");
    redirect("/admin/users");
  });
}
