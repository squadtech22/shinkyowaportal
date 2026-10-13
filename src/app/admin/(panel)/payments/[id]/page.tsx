import { notFound } from "next/navigation";
import PaymentEditor from "./_editor";

export const metadata = { title: "Edit payment" };

export default async function EditPayment({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <PaymentEditor id={id} />;
}
