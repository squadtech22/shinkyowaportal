import Drawer from "@/components/admin/Drawer";
import NewShipmentForm from "../../../shipments/new/_form";

export default async function NewShipmentDrawer({ searchParams }: { searchParams: Promise<{ stock?: string }> }) {
  return (
    <Drawer title="Add shipment">
      <NewShipmentForm stock={(await searchParams).stock} />
    </Drawer>
  );
}
