import { notFound } from "next/navigation";
import PaymentEditor from "../../../payments/[id]/_editor";

export default async function PaymentEditorDrawer({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <PaymentEditor id={id} inDrawer />;
}
