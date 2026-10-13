import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/admin/ui";
import JapanPaymentEditor from "../_form";

export const metadata = { title: "Edit Japan payment" };

export default async function EditJapanPayment({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return (
    <>
      <PageHeader title="Edit Japan payment" back={{ href: "/admin/finance/japan-payments", label: "Japan payments" }} />
      <Card>
        <JapanPaymentEditor id={id} />
      </Card>
    </>
  );
}
