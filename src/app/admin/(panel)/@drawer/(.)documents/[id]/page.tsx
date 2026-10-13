import { notFound } from "next/navigation";
import DocumentsEditor from "../../../documents/[id]/_editor";

export default async function DocumentsEditorDrawer({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <DocumentsEditor id={id} inDrawer />;
}
