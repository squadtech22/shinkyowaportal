"use server";

import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import type { ActionState } from "@/lib/admin/actions";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/admin/password";
import { destroyClientSession, getCurrentCustomer, revokeOtherClientSessions } from "@/lib/client/auth";

export async function clientLogout() {
  await destroyClientSession();
  redirect("/login");
}

export async function changeClientPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");
  const current = String(form.get("current_password") ?? "");
  const next = String(form.get("new_password") ?? "");
  const confirm = String(form.get("confirm_password") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (next.length < MIN_PASSWORD_LENGTH) fieldErrors.new_password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  else if (next !== confirm) fieldErrors.confirm_password = "Passwords do not match";
  const [[row]] = await db.query<RowDataPacket[]>("SELECT password FROM customer_accounts WHERE id = ?", [customer.id]);
  if (!row?.password || !(await verifyPassword(current, row.password))) fieldErrors.current_password = "Incorrect password";
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

  await db.query("UPDATE customer_accounts SET password = ?, updated_at = NOW() WHERE id = ?", [
    await hashPassword(next),
    customer.id,
  ]);
  await revokeOtherClientSessions(customer.id);
  return { ok: true, message: "Password changed." };
}
