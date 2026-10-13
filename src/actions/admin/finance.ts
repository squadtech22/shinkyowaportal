"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { formReader, runAction, type ActionState } from "@/lib/admin/actions";
import { authorize } from "@/lib/admin/auth";
import { setFlash } from "@/lib/admin/flash";

/** Adds or edits money paid out in Japan (auction, transport, freight...). */
export async function saveJapanPayment(id: number | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("finance.manage");
    const f = formReader(form);
    const data = {
      date: f.date("payment_date", { required: true, label: "Date" }),
      payee: f.text("payee", { required: true, max: 150, label: "Paid to" }),
      stockId: f.id("stock_id"),
      amount: f.int("amount", { required: true, min: 1, label: "Amount" }),
      reference: f.optional("reference", 150),
      note: f.optional("note", 500),
    };
    f.done();
    if (data.stockId) {
      const [rows] = await db.query<RowDataPacket[]>("SELECT id FROM stocks WHERE id = ?", [data.stockId]);
      if (!rows.length) return { error: "That vehicle no longer exists." };
    }
    const values = [data.date, data.payee, data.stockId, data.amount, data.reference, data.note];
    if (id) {
      await db.query(
        `UPDATE japan_payments SET payment_date = ?, payee = ?, stock_id = ?, amount = ?, reference = ?, note = ?,
           updated_at = NOW() WHERE id = ?`,
        [...values, id],
      );
    } else {
      await db.query(
        `INSERT INTO japan_payments (payment_date, payee, stock_id, amount, reference, note, user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [...values, user.id],
      );
    }
    await setFlash(id ? "Payment updated" : "Payment recorded");
    revalidatePath("/admin", "layout");
    redirect("/admin/finance/japan-payments");
  });
}

export async function deleteJapanPayment(id: number): Promise<ActionState> {
  return runAction(async () => {
    await authorize("finance.manage");
    await db.query("DELETE FROM japan_payments WHERE id = ?", [id]);
    await setFlash("Payment deleted");
    revalidatePath("/admin", "layout");
    redirect("/admin/finance/japan-payments");
  });
}
