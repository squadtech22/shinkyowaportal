import type { RowDataPacket } from "mysql2";
import { can, customerScope, getCurrentUser } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { DOCUMENT_KEYS } from "@/lib/documents";
import { readUpload } from "@/lib/uploads";

// Private files for staff:
//   /admin/files/payments/<name>   TT copies, payments.view
//   /admin/files/documents/<name>  export paperwork, documents.view
// Either way only for customers the user can see.
export async function GET(_req: Request, ctx: RouteContext<"/admin/files/[...path]">) {
  const user = await getCurrentUser();
  const { path } = await ctx.params;
  const folder = path[0];
  if ((folder !== "payments" && folder !== "documents") || path.length !== 2) return new Response("Not found", { status: 404 });
  if (!user || !can(user, folder === "payments" ? "payments.view" : "documents.view")) {
    return new Response("Forbidden", { status: 403 });
  }

  const stored = path.join("/");
  const scope = customerScope(user);
  const [rows] =
    folder === "payments"
      ? await db.query<RowDataPacket[]>(
          `SELECT p.id FROM payments p LEFT JOIN customer_accounts c ON c.id = p.customer_account_id
           WHERE p.file = ? AND ${scope.sql}`,
          [stored, ...scope.params],
        )
      : await db.query<RowDataPacket[]>(
          `SELECT d.id FROM documents d JOIN stocks s ON s.id = d.stock_id
           LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
           WHERE ? IN (${DOCUMENT_KEYS.map((k) => `d.${k}`).join(", ")}) AND ${scope.sql}`,
          [stored, ...scope.params],
        );
  if (!rows.length) return new Response("Not found", { status: 404 });

  const file = await readUpload(stored, folder);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.type, "Cache-Control": "private, no-store" },
  });
}
