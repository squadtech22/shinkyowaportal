import { notFound } from "next/navigation";
import StockEditor from "../../../stock/[id]/_editor";

export default async function StockEditorDrawer({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <StockEditor id={id} inDrawer />;
}
