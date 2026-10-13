import { notFound } from "next/navigation";
import RoleEditor from "../../../roles/[id]/_editor";

export default async function RoleEditorDrawer({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <RoleEditor id={id} inDrawer />;
}
