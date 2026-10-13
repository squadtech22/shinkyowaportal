import { notFound } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { Trash2 } from "lucide-react";
import BalancePaymentForm from "@/components/admin/BalancePaymentForm";
import EditorFrame from "@/components/admin/EditorFrame";
import PaymentForm from "@/components/admin/PaymentForm";
import { ConfirmButton } from "@/components/admin/forms";
import { deletePayment, savePayment } from "@/actions/admin/payments";
import { can, customerScope, requireUser } from "@/lib/admin/auth";
import { dateTime, isoDate, isoDateTime, money } from "@/lib/admin/format";
import { balanceParent, paymentCustomers } from "@/lib/admin/payments";
import { db } from "@/lib/db";

/** Edit-payment form (an advance, or a balance payment), as a page or in the drawer. */
export default async function PaymentEditor({ id, inDrawer }: { id: number; inDrawer?: boolean }) {
  const user = await requireUser("payments.manage");
  const scope = customerScope(user);
  const [[[p]], customers] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT p.*, (SELECT COUNT(*) FROM payments b WHERE b.parent_id = p.id AND b.status = 'approved') AS approved_balances
       FROM payments p JOIN customer_accounts c ON c.id = p.customer_account_id WHERE p.id = ? AND ${scope.sql}`,
      [id, ...scope.params],
    ),
    paymentCustomers(user),
  ]);
  if (!p) notFound();
  const canApprove = can(user, "payments.approve");
  const canDelete = (p.status !== "approved" && !Number(p.approved_balances)) || canApprove;
  const parent = p.kind === "balance" ? await balanceParent(user, p.parent_id) : null;
  const values = {
    payment_date: isoDate(p.payment_date), amount: String(p.amount), in_yen: String(p.in_yen),
    payment_recieved_date: isoDate(p.payment_recieved_date), status: p.status, file: p.file,
  };

  return (
    <EditorFrame
      inDrawer={inDrawer}
      title={parent ? "Edit balance payment" : "Edit payment"}
      back={{ href: `/admin/customers/${p.customer_account_id}`, label: "Customer" }}
      actions={
        canDelete && (
          <ConfirmButton
            action={deletePayment.bind(null, p.id)}
            title="Delete this payment?"
            description={
              parent
                ? "The TT copy is deleted too. This cannot be undone."
                : "Its TT copy and any balance payments recorded on it are deleted too. This cannot be undone."
            }
            size="md"
          >
            <Trash2 className="size-4" /> Delete
          </ConfirmButton>
        )
      }
    >
      {p.status === "rejected" && (
        <p className="mb-6 rounded-xl border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700">
          <strong>The admin marked this as not received:</strong> {p.reject_reason}.{" "}
          {canApprove ? "Tick Approved below if the money has now arrived." : "Correct it and save to send it to the admin again."}
        </p>
      )}
      {parent ? (
        <BalancePaymentForm
          action={savePayment.bind(null, p.id)}
          context={{
            customer: parent.customer, vehicle: parent.vehicle,
            remaining: money(Number(parent.remaining), "$"), due: dateTime(parent.pending_due_at),
          }}
          canApprove={canApprove}
          returnTo="customer"
          submitLabel="Save changes"
          values={values}
        />
      ) : (
        <PaymentForm
          action={savePayment.bind(null, p.id)}
          customers={customers}
          canApprove={canApprove}
          returnTo="customer"
          submitLabel="Save changes"
          values={{
            ...values,
            customer_account_id: String(p.customer_account_id), stock_id: p.stock_id ? String(p.stock_id) : "",
            description: p.description, pending_amount: p.pending_amount ? String(p.pending_amount) : "",
            pending_due_at: isoDateTime(p.pending_due_at),
          }}
        />
      )}
    </EditorFrame>
  );
}
