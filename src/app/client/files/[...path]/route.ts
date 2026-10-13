import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/client/auth";
import { DOCUMENT_KEYS } from "@/lib/documents";
import { readUpload } from "@/lib/uploads";

// The signed-in customer's own files:
//   /client/files/documents/<name>  export paperwork of a vehicle reserved for them
//   /client/files/payments/<name>   TT copy of one of their payments
export async function GET(_req: Request, ctx: RouteContext<"/client/files/[...path]">) {
  const customer = await getCurrentCustomer();
  if (!customer) return new Response("Forbidden", { status: 403 });
  const { path } = await ctx.params;
  const folder = path[0];
  if ((folder !== "payments" && folder !== "documents") || path.length !== 2) return new Response("Not found", { status: 404 });

  const stored = path.join("/");
  const [rows] =
    folder === "payments"
      ? await db.query<RowDataPacket[]>("SELECT id FROM payments WHERE file = ? AND customer_account_id = ?", [stored, customer.id])
      : await db.query<RowDataPacket[]>(
          `SELECT d.id FROM documents d JOIN stocks s ON s.id = d.stock_id
           WHERE ? IN (${DOCUMENT_KEYS.map((k) => `d.${k}`).join(", ")}) AND s.customer_account_id = ?`,
          [stored, customer.id],
        );
  if (!rows.length) return new Response("Not found", { status: 404 });

  const file = await readUpload(stored, folder);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.type, "Cache-Control": "private, no-store" },
  });
}
