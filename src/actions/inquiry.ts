"use server";

import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { ALREADY_SUBMITTED, hasInquired } from "@/lib/inquiries";
import { clientIp, isEmail } from "@/lib/request";
import { getVehicle } from "@/lib/stock";

export type InquiryState = { ok: boolean; message: string } | null;

// Same rules as App\Http\Requests\WebInquiryRequest; saves to `inquiries`.
export async function sendInquiry(_prev: InquiryState, form: FormData): Promise<InquiryState> {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const data = {
    countryId: Number(get("country_id")),
    stockId: Number(get("stock_id")),
    name: get("name"),
    email: get("email"),
    phone: get("phone"),
    country: get("country"),
    message: get("message"),
  };

  const errors: string[] = [];
  if (!Number.isSafeInteger(data.countryId) || data.countryId < 1) errors.push("Select a vehicle destination");
  if (!Number.isSafeInteger(data.stockId) || data.stockId < 1) errors.push("Unknown vehicle");
  if (!data.name || data.name.length > 120) errors.push("Enter your full name");
  if (!isEmail(data.email) || data.email.length > 150) errors.push("Enter a valid email");
  if (!data.phone || data.phone.length > 15 || !/^[0-9+\-\s()]+$/.test(data.phone)) errors.push("Enter a valid phone number");
  if (!data.country || data.country.length > 30) errors.push("Enter your country");
  if (!data.message || data.message.length > 2000) errors.push("Enter a message");
  if (errors.length) return { ok: false, message: errors.join(", ") };

  try {
    const [countryRows] = await db.query<RowDataPacket[]>("SELECT id FROM countries WHERE id = ?", [data.countryId]);
    if (!countryRows.length) return { ok: false, message: "Select a vehicle destination" };
    if (!(await getVehicle(data.stockId))) return { ok: false, message: "Unknown vehicle" };
    if (await hasInquired(data.stockId)) return { ok: true, message: ALREADY_SUBMITTED };

    await db.query(
      `INSERT INTO inquiries (country_id, stock_id, name, email, phone, country, message, ip, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [data.countryId, data.stockId, data.name, data.email, data.phone, data.country, data.message, await clientIp()],
    );
    return { ok: true, message: "Inquiry Sent. Please wait till our agent get in touch with you" };
  } catch (err) {
    console.error("[inquiry]", err);
    return { ok: false, message: "Could not send your inquiry. Please try again." };
  }
}
