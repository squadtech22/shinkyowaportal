"use server";

import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import type { ActionState } from "@/lib/admin/actions";
import { clearLoginFailures, createSession, loginBlocked, recordLoginFailure } from "@/lib/admin/auth";
import { verifyPassword } from "@/lib/admin/password";
import { createClientSession } from "@/lib/client/auth";
import { clientIp } from "@/lib/request";

/**
 * The one sign-in (/login) for everyone: staff (users) go to the admin panel,
 * customers (customer_accounts with a portal password) to their portal. The
 * email decides which; staff win if the same email and password match both.
 */
export async function signIn(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const throttleKey = `${email}|${await clientIp()}`;
  if (loginBlocked(throttleKey)) {
    return { error: "Too many failed attempts. Please wait 15 minutes and try again." };
  }
  const next = String(form.get("next") ?? "");

  const [[staff]] = await db.query<RowDataPacket[]>(
    "SELECT id, password, is_active, approval_status FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  if (staff && (await verifyPassword(password, staff.password))) {
    clearLoginFailures(throttleKey);
    if (staff.approval_status === "pending") redirect("/admin/register/pending");
    if (staff.approval_status === "rejected") {
      return { error: "Your registration was not approved. Contact Shinkyowa International if you think this is a mistake." };
    }
    if (!staff.is_active) return { error: "This account is disabled. Contact a Super Admin." };
    await createSession(staff.id);
    redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
  }

  const [[customer]] = await db.query<RowDataPacket[]>(
    "SELECT id, password FROM customer_accounts WHERE email = ? AND password IS NOT NULL LIMIT 1",
    [email],
  );
  if (customer && (await verifyPassword(password, customer.password))) {
    clearLoginFailures(throttleKey);
    await createClientSession(customer.id);
    redirect(next.startsWith("/client") && !next.startsWith("//") ? next : "/client");
  }

  recordLoginFailure(throttleKey);
  return { error: "Incorrect email or password. Customers: your Shinkyowa sales agent can reset your password." };
}
