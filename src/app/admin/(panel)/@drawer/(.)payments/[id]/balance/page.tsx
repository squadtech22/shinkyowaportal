import { notFound } from "next/navigation";
import BalancePaymentEditor from "../../../../payments/[id]/balance/_form";

export default async function BalancePaymentDrawer({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <BalancePaymentEditor id={id} inDrawer />;
}
