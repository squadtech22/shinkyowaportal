"use server";

import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { runAction, type ActionState } from "@/lib/admin/actions";
import { destroySession, loginBlocked, recordLoginFailure } from "@/lib/admin/auth";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/admin/password";
import { clientIp, isEmail } from "@/lib/request";

export async function logout() {
  await destroySession();
  redirect("/login");
}

/**
 * Self sign-up. The account is created as 'pending' with no role; it cannot
 * sign in until someone with users.approve approves it and picks a role.
 */
export async function register(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const phone = String(form.get("phone") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm_password") ?? "");

    const fieldErrors: Record<string, string> = {};
    if (!name) fieldErrors.name = "Enter your name";
    else if (name.length > 255) fieldErrors.name = "Name is too long";
    if (!isEmail(email) || email.length > 150) fieldErrors.email = "Enter a valid email";
    if (phone.length > 30 || (phone && !/^[0-9+\-\s()]+$/.test(phone))) fieldErrors.phone = "Enter a valid phone number";
    if (password.length < MIN_PASSWORD_LENGTH) fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    else if (password !== confirm) fieldErrors.confirm_password = "Passwords do not match";
    if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

    // Same throttle as sign-in, keyed by IP, to slow down automated sign-ups.
    const throttleKey = `register|${await clientIp()}`;
    if (loginBlocked(throttleKey)) return { error: "Too many sign-ups from this network. Please try again later." };

    const [existing] = await db.query<RowDataPacket[]>("SELECT approval_status FROM users WHERE email = ?", [email]);
    if (existing[0]) {
      if (existing[0].approval_status === "pending") redirect("/admin/register/pending");
      return { error: "An account with this email already exists. Sign in instead.", fieldErrors: { email: "Already registered" } };
    }
    recordLoginFailure(throttleKey);
    await db.query(
      `INSERT INTO users (name, email, phone, password, role_id, is_active, approval_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, 1, 'pending', NOW(), NOW())`,
      [name, email, phone || null, await hashPassword(password)],
    );
    redirect("/admin/register/pending");
  });
}
