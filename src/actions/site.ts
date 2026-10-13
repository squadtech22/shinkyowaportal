"use server";

import { db } from "@/lib/db";
import { clientIp, isEmail } from "@/lib/request";

export type FormResult = { ok: boolean; message: string };

/** Header "Contact Us" dialog → contact_messages. */
export async function sendContactMessage(form: FormData): Promise<FormResult> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  if (!name || name.length > 120) return { ok: false, message: "Enter your name" };
  if (!isEmail(email) || email.length > 150) return { ok: false, message: "Enter a valid email" };
  if (!message || message.length > 2000) return { ok: false, message: "Enter a message" };

  await db.query(
    "INSERT INTO contact_messages (name, email, message, ip, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
    [name, email, message, await clientIp()],
  );
  return { ok: true, message: "Message sent. We will get back to you soon." };
}

/** Footer newsletter boxes → newsletter_subscribers (one row per email). */
export async function subscribeNewsletter(form: FormData): Promise<FormResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email) || email.length > 150) return { ok: false, message: "Enter a valid email" };

  await db.query(
    "INSERT IGNORE INTO newsletter_subscribers (email, created_at, updated_at) VALUES (?, NOW(), NOW())",
    [email],
  );
  return { ok: true, message: "Subscribed!" };
}
