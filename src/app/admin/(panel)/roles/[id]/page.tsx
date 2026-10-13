import { notFound } from "next/navigation";
import RoleEditor from "./_editor";

export const metadata = { title: "Edit role" };

export default async function EditRole({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <RoleEditor id={id} />;
}
