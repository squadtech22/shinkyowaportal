import { notFound } from "next/navigation";
import ShipmentEditor from "./_editor";

export const metadata = { title: "Shipment" };

export default async function ShipmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <ShipmentEditor id={id} />;
}
