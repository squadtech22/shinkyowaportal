import "server-only";
import { cache } from "react";
import type { RowDataPacket } from "mysql2";
import { db } from "./db";
import type { SiteSettings } from "./data";

// Fallbacks for keys missing from the `settings` table.
const DEFAULTS: SiteSettings = {
  email: "",
  phones: [],
  whatsappNumber: "",
  facebookUrl: "",
  linkedinUrl: "",
  instagramUrl: "",
  headOffice: { address: "", postCode: "", telFax: "" },
  toyamaOffice: { address: "", postCode: "", telFax: "" },
  officeHours: "",
  notice: { enabled: false, title: "", body: "" },
};

/** Header/footer/contact details from the `settings` table (one query per request). */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  const [rows] = await db.query<RowDataPacket[]>("SELECT `key`, value FROM settings");
  const s = new Map<string, string>(rows.map((r) => [r.key, (r.value ?? "").trim()]));
  const get = (key: string) => s.get(key) ?? "";
  const office = (prefix: string) => ({
    address: get(`${prefix}_address`),
    postCode: get(`${prefix}_post_code`),
    telFax: get(`${prefix}_tel_fax`),
  });
  return {
    ...DEFAULTS,
    email: get("email"),
    phones: get("phones").split(",").map((p) => p.trim()).filter(Boolean),
    whatsappNumber: get("whatsapp_number").replace(/\D/g, ""),
    facebookUrl: get("facebook_url"),
    linkedinUrl: get("linkedin_url"),
    instagramUrl: get("instagram_url"),
    headOffice: office("head_office"),
    toyamaOffice: office("toyama_office"),
    officeHours: get("office_hours"),
    notice: { enabled: get("notice_enabled") === "1", title: get("notice_title"), body: get("notice_body") },
  };
});

/** Label/value rows of one `info_rows` section, e.g. "bank_details". */
export async function getInfoRows(section: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT label, value FROM info_rows WHERE section = ? ORDER BY sort_order, id",
    [section],
  );
  return rows.map((r) => [r.label as string, r.value as string] as const);
}
