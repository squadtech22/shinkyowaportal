import { notFound } from "next/navigation";
import BalancePaymentForm from "@/components/admin/BalancePaymentForm";
import EditorFrame from "@/components/admin/EditorFrame";
import { recordBalancePayment } from "@/actions/admin/payments";
import { can, requireUser } from "@/lib/admin/auth";
import { dateTime, isoDate, money } from "@/lib/admin/format";
import { balanceParent } from "@/lib/admin/payments";

/** "Customer paid balance" for advance `id`, as a page or in the drawer. */
export default async function BalancePaymentEditor({ id, inDrawer }: { id: number; inDrawer?: boolean }) {
  const user = await requireUser("payments.manage");
  const parent = await balanceParent(user, id);
  if (!parent || parent.kind !== "advance" || !Number(parent.remaining)) notFound();
  return (
    <EditorFrame
      inDrawer={inDrawer}
      title="Customer paid balance"
      description="Record the TT for the pending balance. The admin approves it once the money is in the bank."
      back={{ href: `/admin/customers/${parent.customer_account_id}`, label: "Customer" }}
    >
      <BalancePaymentForm
        action={recordBalancePayment.bind(null, parent.id)}
        context={{
          customer: parent.customer, vehicle: parent.vehicle, remaining: money(Number(parent.remaining), "$"),
          due: dateTime(parent.pending_due_at),
        }}
        canApprove={can(user, "payments.approve")}
        returnTo="customer"
        submitLabel="Save balance payment"
        values={{
          amount: String(parent.remaining), in_yen: "", payment_date: isoDate(new Date()), payment_recieved_date: "",
          status: "not approved", file: null,
        }}
      />
    </EditorFrame>
  );
}
