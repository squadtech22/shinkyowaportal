"use server";

import { revalidatePath } from "next/cache";
import type { ResultSetHeader } from "mysql2";
import { db } from "@/lib/db";
import { formReader, runAction, ValidationError, type ActionState } from "@/lib/admin/actions";
import { authorize } from "@/lib/admin/auth";
import { setFlash } from "@/lib/admin/flash";
import { canAssignRole } from "@/lib/admin/roles";

export async function approveRegistration(userId: number, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await authorize("users.approve");
    const f = formReader(form);
    const roleId = f.id("role_id", { required: true, label: "Role" });
    f.done();
    if (!(await canAssignRole(actor, roleId!))) {
      throw new ValidationError({ role_id: "You cannot give this role" });
    }
    const [res] = await db.query<ResultSetHeader>(
      `UPDATE users SET approval_status = 'approved', role_id = ?, is_active = 1, updated_at = NOW()
       WHERE id = ? AND approval_status <> 'approved'`,
      [roleId, userId],
    );
    if (res.affectedRows === 0) return { error: "This account was already handled." };
    await setFlash("Account approved — they can sign in now");
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function rejectRegistration(userId: number): Promise<ActionState> {
  return runAction(async () => {
    await authorize("users.approve");
    await db.query(
      "UPDATE users SET approval_status = 'rejected', updated_at = NOW() WHERE id = ? AND approval_status = 'pending'",
      [userId],
    );
    await setFlash("Registration rejected");
    revalidatePath("/admin", "layout");
  });
}

/** Removes a pending or rejected sign-up entirely (they may register again). */
export async function deleteRegistration(userId: number): Promise<ActionState> {
  return runAction(async () => {
    await authorize("users.approve");
    await db.query("DELETE FROM users WHERE id = ? AND approval_status <> 'approved'", [userId]);
    await setFlash("Registration deleted");
    revalidatePath("/admin", "layout");
  });
}
