import ShipmentForm from "@/components/admin/ShipmentForm";
import { saveShipment } from "@/actions/admin/shipments";
import { requireUser } from "@/lib/admin/auth";
import { shippableVehicles } from "@/lib/admin/shipments";

/** "Add shipment" form, shown as a page and in the drawer. `stock` pre-ticks a vehicle. */
export default async function NewShipmentForm({ stock }: { stock?: string }) {
  const user = await requireUser("shipments.manage");
  const vehicles = await shippableVehicles(user, null);
  const preset = Number(stock);
  return (
    <ShipmentForm
      action={saveShipment.bind(null, null)}
      vehicles={vehicles}
      submitLabel="Add shipment"
      values={{
        vessel_name: "", method: "roro", container_no: "", bl_no: "", etd: "", eta: "",
        stock_ids: vehicles.some((v) => v.id === preset) ? [preset] : [],
      }}
    />
  );
}
