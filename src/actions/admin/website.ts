"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { runAction, ValidationError, type ActionState } from "@/lib/admin/actions";
import { authorize } from "@/lib/admin/auth";
import { setFlash } from "@/lib/admin/flash";
import { INFO_SECTIONS, SETTING_GROUPS, type InfoSection } from "@/lib/admin/website";

export async function saveSettings(groupIndex: number, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await authorize("website.manage");
    const group = SETTING_GROUPS[groupIndex];
    if (!group) return { error: "Unknown settings group." };
    const errors: Record<string, string> = {};
    const values: [string, string][] = [];
    for (const field of group.fields) {
      let value = field.type === "toggle" ? (form.get(field.key) === "on" ? "1" : "0") : String(form.get(field.key) ?? "").trim();
      if (field.type === "url" && value && !/^https?:\/\//.test(value)) errors[field.key] = "Must start with https://";
      if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.key] = "Enter a valid email";
      if (field.key === "whatsapp_number") value = value.replace(/\D/g, "");
      if (value.length > 5000) errors[field.key] = "Too long";
      values.push([field.key, value]);
    }
    if (Object.keys(errors).length) throw new ValidationError(errors);
    for (const [key, value] of values) {
      await db.query(
        `INSERT INTO settings (\`key\`, value, created_at, updated_at) VALUES (?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
        [key, value],
      );
    }
    revalidatePath("/", "layout");
    return { ok: true, message: `${group.title} saved — the website is updated.` };
  });
}

/** Replaces all rows of one info section with the submitted list (JSON in field "rows"). */
export async function saveInfoRows(section: InfoSection, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await authorize("website.manage");
    if (!(section in INFO_SECTIONS)) return { error: "Unknown section." };
    let rows: { label: string; value: string }[];
    try {
      rows = JSON.parse(String(form.get("rows") ?? "[]"));
    } catch {
      return { error: "Could not read the rows." };
    }
    rows = rows.map((r) => ({ label: String(r.label ?? "").trim(), value: String(r.value ?? "").trim() })).filter((r) => r.value);
    if (rows.some((r) => !r.label)) return { error: "Every row with a value needs a label." };
    if (rows.some((r) => r.label.length > 100 || r.value.length > 500)) return { error: "Labels are limited to 100 and values to 500 characters." };
    if (new Set(rows.map((r) => r.label.toLowerCase())).size !== rows.length) return { error: "Each label can only be used once." };

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM info_rows WHERE section = ?", [section]);
      for (const [i, r] of rows.entries()) {
        await conn.query(
          "INSERT INTO info_rows (section, label, value, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
          [section, r.label, r.value, i + 1],
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    await setFlash(`${INFO_SECTIONS[section].title} saved`);
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
