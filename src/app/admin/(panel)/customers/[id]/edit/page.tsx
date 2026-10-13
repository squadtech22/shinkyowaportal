import { notFound } from "next/navigation";
import CustomerEditor from "./_editor";

export const metadata = { title: "Edit customer" };

export default async function EditCustomer({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <CustomerEditor id={id} />;
}
