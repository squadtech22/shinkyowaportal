import { notFound } from "next/navigation";
import StockEditor from "./_editor";

export const metadata = { title: "Edit vehicle" };

export default async function EditStock({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <StockEditor id={id} />;
}
