import { notFound } from "next/navigation";
import ShipmentEditor from "../../../shipments/[id]/_editor";

export default async function ShipmentEditorDrawer({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <ShipmentEditor id={id} inDrawer />;
}
