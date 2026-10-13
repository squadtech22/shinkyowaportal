import { notFound } from "next/navigation";
import DocumentsEditor from "./_editor";

export const metadata = { title: "Vehicle documents" };

// [id] is the stock (vehicle) id: each vehicle has one set of documents.
export default async function VehicleDocuments({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <DocumentsEditor id={id} />;
}
