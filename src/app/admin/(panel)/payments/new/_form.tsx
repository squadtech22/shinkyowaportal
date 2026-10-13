import PaymentForm from "@/components/admin/PaymentForm";
import { savePayment } from "@/actions/admin/payments";
import { can, requireUser } from "@/lib/admin/auth";
import { isoDate } from "@/lib/admin/format";
import { paymentCustomers } from "@/lib/admin/payments";

/** The ?customer= id when the user may record payments for that customer, else "". */
export async function presetCustomer(customer: string | undefined) {
  const user = await requireUser("payments.manage");
  const customers = await paymentCustomers(user);
  return customers.some((c) => String(c.id) === customer) ? customer! : "";
}

/** "Record payment" form, shown as a page and in the drawer. */
export default async function NewPaymentForm({ customer }: { customer?: string }) {
  const user = await requireUser("payments.manage");
  const customers = await paymentCustomers(user);
  const preset = customers.some((c) => String(c.id) === customer) ? customer! : "";
  return (
    <PaymentForm
      action={savePayment.bind(null, null)}
      customers={customers}
      canApprove={can(user, "payments.approve")}
      returnTo={preset ? "customer" : undefined}
      submitLabel="Save payment"
      values={{
        customer_account_id: preset, stock_id: "", description: "", payment_date: isoDate(new Date()),
        amount: "", in_yen: "", pending_amount: "", pending_due_at: "", payment_recieved_date: "", status: "not approved", file: null,
      }}
    />
  );
}
