"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { formReader, runAction, type ActionState } from "@/lib/admin/actions";
import { authorize, can } from "@/lib/admin/auth";
import { setFlash } from "@/lib/admin/flash";
import { isPermission } from "@/lib/admin/permissions";

export async function saveRole(id: number | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await authorize("roles.manage");
    const f = formReader(form);
    const name = f.text("name", { required: true, max: 100, label: "Role name" });
    const description = f.optional("description", 255);
    f.done();

    const requested = [...new Set(form.getAll("permissions").map(String))].filter(isPermission);
    // Nobody can hand out a permission they do not have themselves.
    if (requested.some((p) => !can(actor, p))) {
      return { error: "You can only grant permissions that your own role has." };
    }

    // Permissions the actor cannot grant are shown disabled and not submitted;
    // keep the ones the role already had instead of silently dropping them.
    let kept: string[] = [];
    if (id) {
      const [[role]] = await db.query<RowDataPacket[]>("SELECT is_super FROM roles WHERE id = ?", [id]);
      if (!role) return { error: "Role not found." };
      if (role.is_super) return { error: "The Super Admin role always has every permission and cannot be changed." };
      const [current] = await db.query<RowDataPacket[]>("SELECT permission FROM role_permissions WHERE role_id = ?", [id]);
      kept = current.map((r) => String(r.permission)).filter((p) => isPermission(p) && !can(actor, p));
    }
    const permissions = [...new Set([...requested, ...kept])];

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      let roleId = id;
      if (id) {
        await conn.query("UPDATE roles SET name = ?, description = ?, updated_at = NOW() WHERE id = ?", [name, description, id]);
        await conn.query("DELETE FROM role_permissions WHERE role_id = ?", [id]);
      } else {
        const [res] = await conn.query<ResultSetHeader>(
          "INSERT INTO roles (name, description, is_super, created_at, updated_at) VALUES (?, ?, 0, NOW(), NOW())",
          [name, description],
        );
        roleId = res.insertId;
      }
      for (const permission of permissions) {
        await conn.query("INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)", [roleId, permission]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    await setFlash(id ? "Role updated" : `Role "${name}" created`);
    revalidatePath("/admin", "layout");
    redirect("/admin/roles");
  });
}

export async function deleteRole(id: number): Promise<ActionState> {
  return runAction(async () => {
    await authorize("roles.manage");
    const [[role]] = await db.query<RowDataPacket[]>(
      "SELECT is_super, (SELECT COUNT(*) FROM users WHERE role_id = roles.id) AS users FROM roles WHERE id = ?",
      [id],
    );
    if (!role) return { error: "Role not found." };
    if (role.is_super) return { error: "The Super Admin role cannot be deleted." };
    if (Number(role.users) > 0) return { error: `${role.users} user(s) still have this role. Give them another role first.` };
    await db.query("DELETE FROM roles WHERE id = ?", [id]);
    await setFlash("Role deleted");
    revalidatePath("/admin/roles");
    redirect("/admin/roles");
  });
}
