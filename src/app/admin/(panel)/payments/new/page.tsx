import { PageHeader } from "@/components/admin/ui";
import NewPaymentForm, { presetCustomer } from "./_form";

export const metadata = { title: "Record payment" };

export default async function NewPayment({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const preset = await presetCustomer((await searchParams).customer);
  return (
    <>
      <PageHeader
        title="Record payment"
        description="Add a telegraphic transfer (TT) received from a customer."
        back={preset ? { href: `/admin/customers/${preset}`, label: "Customer" } : { href: "/admin/payments", label: "Payments" }}
      />
      <NewPaymentForm customer={preset} />
    </>
  );
}
