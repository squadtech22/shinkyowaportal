import { notFound } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { saveCommission } from "@/actions/admin/commissions";
import { CommissionForm } from "@/components/admin/CommissionForms";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/admin/auth";
import { periodLabel } from "@/lib/admin/commissions";
import { db } from "@/lib/db";

export const metadata = { title: "Edit commission" };

export default async function EditCommission({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("commission.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [[k]] = await db.query<RowDataPacket[]>(
    `SELECT k.*, u.name AS user_name, s.sid, s.year, s.model, m.name AS make FROM commissions k
     JOIN users u ON u.id = k.user_id LEFT JOIN stocks s ON s.id = k.stock_id LEFT JOIN makes m ON m.id = s.make_id
     WHERE k.id = ?`,
    [id],
  );
  if (!k) notFound();
  const vehicle = k.sid ? `SKI-${k.sid} · ${k.year} ${k.make ?? ""} ${k.model}` : "Vehicle removed";
  return (
    <>
      <PageHeader
        title={`Commission for ${k.user_name}`}
        description={
          k.status === "pending"
            ? `${vehicle} · ${periodLabel(k.period)}`
            : `${vehicle} — ${periodLabel(k.period)} is already approved, so it can no longer be changed.`
        }
        back={{ href: `/admin/commissions?month=${k.period}`, label: "Commissions" }}
      />
      <CommissionForm
        action={saveCommission.bind(null, id)}
        values={{ stock_id: String(k.stock_id ?? ""), user_id: String(k.user_id), type: k.type, rate: String(Number(k.rate)), note: k.note ?? "" }}
      />
    </>
  );
}
