import { notFound } from "next/navigation";
import UserEditor from "./_editor";

export const metadata = { title: "Edit user" };

export default async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <UserEditor id={id} />;
}
