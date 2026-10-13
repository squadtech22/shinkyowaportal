import { notFound } from "next/navigation";
import CustomerEditor from "../../../../customers/[id]/edit/_editor";

export default async function CustomerEditorDrawer({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <CustomerEditor id={id} inDrawer />;
}
