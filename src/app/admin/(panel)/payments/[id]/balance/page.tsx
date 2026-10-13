import { notFound } from "next/navigation";
import BalancePaymentEditor from "./_form";

export const metadata = { title: "Customer paid balance" };

export default async function BalancePayment({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <BalancePaymentEditor id={id} />;
}
