import { PageHeader } from "@/components/admin/ui";
import NewShipmentForm from "./_form";

export const metadata = { title: "Add shipment" };

// ?stock=<id> pre-ticks a vehicle (the "Ship" link on Reserved vehicles).
export default async function NewShipment({ searchParams }: { searchParams: Promise<{ stock?: string }> }) {
  return (
    <>
      <PageHeader title="Add shipment" back={{ href: "/admin/shipments", label: "Shipments" }} />
      <NewShipmentForm stock={(await searchParams).stock} />
    </>
  );
}
