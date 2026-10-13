import type { RowDataPacket } from "mysql2";
import { can, getCurrentUser } from "@/lib/admin/auth";
import { db } from "@/lib/db";

// Newsletter subscribers as a CSV download.
export async function GET() {
  if (!can(await getCurrentUser(), "inquiries.view")) return new Response("Forbidden", { status: 403 });
  const [rows] = await db.query<RowDataPacket[]>("SELECT email, created_at FROM newsletter_subscribers ORDER BY id");
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = ["email,subscribed_at", ...rows.map((r) => `${escape(r.email)},${escape(new Date(r.created_at).toISOString())}`)].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="newsletter-subscribers.csv"',
    },
  });
}
