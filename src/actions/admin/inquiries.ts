"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { runAction, type ActionState } from "@/lib/admin/actions";
import { authorize } from "@/lib/admin/auth";
import { setFlash } from "@/lib/admin/flash";

const TABLES = { vehicle: "inquiries", contact: "contact_messages" } as const;
export type InquiryKind = keyof typeof TABLES;
const STATUSES = ["new", "contacted", "closed"] as const;

export async function setInquiryStatus(kind: InquiryKind, id: number, status: string): Promise<ActionState> {
  return runAction(async () => {
    await authorize("inquiries.manage");
    if (!(kind in TABLES) || !STATUSES.includes(status as (typeof STATUSES)[number])) return { error: "Invalid status." };
    await db.query(`UPDATE ${TABLES[kind]} SET status = ?, updated_at = NOW() WHERE id = ?`, [status, id]);
    revalidatePath("/admin", "layout");
  });
}

export async function deleteInquiry(kind: InquiryKind, id: number): Promise<ActionState> {
  return runAction(async () => {
    await authorize("inquiries.manage");
    if (!(kind in TABLES)) return { error: "Invalid item." };
    await db.query(`DELETE FROM ${TABLES[kind]} WHERE id = ?`, [id]);
    await setFlash("Deleted");
    revalidatePath("/admin", "layout");
  });
}

export async function deleteSubscriber(id: number): Promise<ActionState> {
  return runAction(async () => {
    await authorize("inquiries.manage");
    await db.query("DELETE FROM newsletter_subscribers WHERE id = ?", [id]);
    await setFlash("Subscriber removed");
    revalidatePath("/admin/inquiries");
  });
}
