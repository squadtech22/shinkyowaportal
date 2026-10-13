"use server";

import { revalidatePath } from "next/cache";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { formReader, runAction, ValidationError, type ActionState } from "@/lib/admin/actions";
import { authorize, getCurrentUser, NotAllowedError, revokeOtherSessions } from "@/lib/admin/auth";
import { getRates, rateKey } from "@/lib/admin/display";
import { DISPLAY_CURRENCIES, type DisplayCurrency } from "@/lib/admin/format";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/admin/password";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new NotAllowedError();
  return user;
}

export async function updateProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await me();
    const f = formReader(form);
    const name = f.text("name", { required: true, max: 255, label: "Name" });
    const email = f.email("email", { required: true });
    f.done();
    await db.query("UPDATE users SET name = ?, email = ?, updated_at = NOW() WHERE id = ?", [name, email, user.id]);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Profile saved." };
  });
}

export async function changePassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await me();
    const current = String(form.get("current_password") ?? "");
    const next = String(form.get("new_password") ?? "");
    const confirm = String(form.get("confirm_password") ?? "");
    const [[row]] = await db.query<RowDataPacket[]>("SELECT password FROM users WHERE id = ?", [user.id]);
    const errors: Record<string, string> = {};
    if (!(await verifyPassword(current, row.password))) errors.current_password = "Current password is incorrect";
    if (next.length < MIN_PASSWORD_LENGTH) errors.new_password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    else if (next !== confirm) errors.confirm_password = "Passwords do not match";
    if (Object.keys(errors).length) throw new ValidationError(errors);
    await db.query("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?", [await hashPassword(next), user.id]);
    await revokeOtherSessions(user.id);
    return { ok: true, message: "Password changed." };
  });
}

/** Display currency and light/dark theme, both per user. */
export async function updatePreferences(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await me();
    const currency = String(form.get("display_currency") ?? "");
    const theme = String(form.get("theme") ?? "");
    const errors: Record<string, string> = {};
    if (!DISPLAY_CURRENCIES.includes(currency as DisplayCurrency)) errors.display_currency = "Choose USD or PKR";
    if (theme !== "light" && theme !== "dark") errors.theme = "Choose light or dark";
    if (Object.keys(errors).length) throw new ValidationError(errors);
    await db.query("UPDATE users SET display_currency = ?, theme = ?, updated_at = NOW() WHERE id = ?", [currency, theme, user.id]);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Preferences saved." };
  });
}

/** Exchange rates (units per 1 USD) used to show amounts in USD or PKR, for everyone. */
export async function saveExchangeRates(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await authorize("finance.manage");
    const { list } = await getRates();
    const errors: Record<string, string> = {};
    const values: [string, string][] = [];
    for (const c of list) {
      const key = rateKey(c.code);
      const value = Number(String(form.get(key) ?? "").replace(/[,\s]/g, ""));
      if (!Number.isFinite(value) || value <= 0) errors[key] = "Enter a number above 0";
      else values.push([key, String(value)]);
    }
    if (Object.keys(errors).length) throw new ValidationError(errors);
    for (const [key, value] of values) {
      await db.query(
        "INSERT INTO settings (`key`, value, created_at, updated_at) VALUES (?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()",
        [key, value],
      );
    }
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Exchange rates saved." };
  });
}
