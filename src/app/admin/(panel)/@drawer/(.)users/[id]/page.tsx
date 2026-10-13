import { notFound } from "next/navigation";
import UserEditor from "../../../users/[id]/_editor";

export default async function UserEditorDrawer({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <UserEditor id={id} inDrawer />;
}
