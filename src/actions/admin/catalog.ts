"use server";

import { revalidatePath } from "next/cache";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { runAction, ValidationError, type ActionState } from "@/lib/admin/actions";
import { authorize } from "@/lib/admin/auth";
import { setFlash } from "@/lib/admin/flash";
import { CATALOG, isCatalogTable, type CatalogTable } from "@/lib/admin/catalog";

export async function saveCatalogItem(table: CatalogTable, id: number | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await authorize("catalog.manage");
    if (!isCatalogTable(table)) return { error: "Unknown list." };
    const config = CATALOG[table];
    const errors: Record<string, string> = {};
    const values = config.columns.map((col) => {
      const value = String(form.get(col.key) ?? "").trim();
      if ("required" in col && col.required && !value) errors[col.key] = `${col.label} is required`;
      else if (value.length > col.max) errors[col.key] = `At most ${col.max} characters`;
      return value || null;
    });
    if (Object.keys(errors).length) throw new ValidationError(errors);

    const cols = config.columns.map((c) => c.key);
    if (id) {
      await db.query(
        `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = NOW() WHERE id = ?`,
        [...values, id],
      );
    } else {
      await db.query(
        `INSERT INTO ${table} (${cols.join(", ")}, created_at, updated_at) VALUES (${cols.map(() => "?").join(", ")}, NOW(), NOW())`,
        values,
      );
    }
    await setFlash(id ? "Saved" : `Added to ${config.title.toLowerCase()}`);
    revalidatePath("/", "layout");
    revalidatePath("/admin/catalog");
    return { ok: true };
  });
}

export async function deleteCatalogItem(table: CatalogTable, id: number): Promise<ActionState> {
  return runAction(async () => {
    await authorize("catalog.manage");
    if (!isCatalogTable(table)) return { error: "Unknown list." };
    const config = CATALOG[table];
    const uses: string[] = [];
    for (const u of config.usage) {
      const [[row]] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${u.table} WHERE ${u.column} = ?`, [id]);
      if (Number(row.n) > 0) uses.push(`${row.n} ${u.label}`);
    }
    if (uses.length) return { error: `Still used by ${uses.join(" and ")}. Change those first.` };
    await db.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    await setFlash("Deleted");
    revalidatePath("/", "layout");
    revalidatePath("/admin/catalog");
  });
}
