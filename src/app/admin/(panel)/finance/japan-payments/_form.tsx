import { notFound } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import JapanPaymentForm from "@/components/admin/JapanPaymentForm";
import { saveJapanPayment } from "@/actions/admin/finance";
import { requireUser } from "@/lib/admin/auth";
import { dealVehicleOptions, payeeSuggestions } from "@/lib/admin/finance";
import { isoDate } from "@/lib/admin/format";
import { db } from "@/lib/db";

/** Add (id null) or edit form of a Japan payment, shown as a page and in the drawer. */
export default async function JapanPaymentEditor({ id }: { id: number | null }) {
  await requireUser("finance.manage");
  const [vehicles, payees, payment] = await Promise.all([
    dealVehicleOptions(),
    payeeSuggestions(),
    id ? db.query<RowDataPacket[]>("SELECT * FROM japan_payments WHERE id = ?", [id]).then(([r]) => r[0]) : null,
  ]);
  if (id && !payment) notFound();
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return (
    <JapanPaymentForm
      action={saveJapanPayment.bind(null, id)}
      vehicles={vehicles}
      payees={payees}
      submitLabel={id ? "Save changes" : "Record payment"}
      values={
        payment
          ? {
              payment_date: isoDate(payment.payment_date), payee: str(payment.payee), stock_id: str(payment.stock_id),
              amount: str(payment.amount), reference: str(payment.reference), note: str(payment.note),
            }
          : { payment_date: isoDate(new Date()), payee: "", stock_id: "", amount: "", reference: "", note: "" }
      }
    />
  );
}
