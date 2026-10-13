import Link from "next/link";
import { notFound } from "next/navigation";
import { Car, Trash2 } from "lucide-react";
import ShipmentBadge from "@/components/admin/ShipmentBadge";
import EditorFrame from "@/components/admin/EditorFrame";
import ShipmentForm from "@/components/admin/ShipmentForm";
import ShipmentStatusSelect from "@/components/admin/ShipmentStatusSelect";
import { ConfirmButton } from "@/components/admin/forms";
import { Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/admin/ui";
import { deleteShipment, saveShipment, updateShipmentStatus } from "@/actions/admin/shipments";
import { can, requireUser } from "@/lib/admin/auth";
import { date, isoDate } from "@/lib/admin/format";
import {
  automaticShipmentStatus,
  getShipment,
  isShipmentStatus,
  shipmentStatus,
  shippableVehicles,
} from "@/lib/admin/shipments";

/** A vessel: edit form for shipments.manage, else the vehicles on board. As a page or in the drawer. */
export default async function ShipmentEditor({ id, inDrawer }: { id: number; inDrawer?: boolean }) {
  const user = await requireUser("shipments.view");
  const data = await getShipment(user, id);
  if (!data) notFound();
  const { shipment: s, cars, hidden } = data;
  const canManage = can(user, "shipments.manage");
  const canChangeStatus = can(user, "shipments.status");

  return (
    <EditorFrame
      inDrawer={inDrawer}
      title={s.vessel_name}
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          <ShipmentBadge status={shipmentStatus(s.etd, s.eta, s.status)} />
          {s.method === "container" ? `Container${s.container_no ? ` ${s.container_no}` : ""}` : "RoRo"} ·
          ETD {date(s.etd)} → ETA {date(s.eta)}
          {s.bl_no && <span>· B/L {s.bl_no}</span>}
          {hidden > 0 && (
            <span>
              · plus {hidden} vehicle{hidden === 1 ? "" : "s"} of other agents&apos; customers
            </span>
          )}
        </span>
      }
      back={{ href: "/admin/shipments", label: "Shipments" }}
      actions={
        canManage && (
          <ConfirmButton
            action={deleteShipment.bind(null, s.id)}
            title="Delete this shipment?"
            description="The vehicles stay reserved for their customers; they are just no longer on a vessel."
            size="md"
          >
            <Trash2 className="size-4" /> Delete
          </ConfirmButton>
        )
      }
    >
      {canManage ? (
        <ShipmentForm
          action={saveShipment.bind(null, s.id)}
          vehicles={await shippableVehicles(user, s.id)}
          submitLabel="Save changes"
          values={{
            vessel_name: s.vessel_name, method: s.method, container_no: s.container_no ?? "", bl_no: s.bl_no ?? "",
            etd: isoDate(s.etd), eta: isoDate(s.eta), status: isShipmentStatus(s.status) ? s.status : "automatic",
            stock_ids: cars.map((c) => Number(c.id)) }}
        />
      ) : (
        <div className="space-y-6">
          {canChangeStatus && (
            <Card>
              <CardHeader title="Status" description="Automatic follows the ETD/ETA dates" />
              <div className="p-5">
                <ShipmentStatusSelect
                  key={s.status ?? "automatic"}
                  vessel={s.vessel_name}
                  statusOverride={isShipmentStatus(s.status) ? s.status : null}
                  automaticStatus={automaticShipmentStatus(s.etd, s.eta)}
                  action={updateShipmentStatus.bind(null, Number(s.id))}
                />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Vehicles on board" />
            {cars.length === 0 ? (
              <EmptyState icon={Car} title="No vehicles on this vessel yet" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Vehicle</Th>
                    <Th>Chassis</Th>
                    <Th>Customer</Th>
                    <Th>Destination</Th>
                  </tr>
                </thead>
                <tbody>
                  {cars.map((c) => (
                    <tr key={c.id}>
                      <Td>
                        <p className="font-medium">
                          {c.year} {c.make} {c.model}
                        </p>
                        <p className="text-xs text-slate-500">SKI-{c.sid}</p>
                      </Td>
                      <Td label="Chassis" className="text-slate-600">{c.chassis}</Td>
                      <Td label="Customer">
                        {c.customer_id ? (
                          <Link href={`/admin/customers/${c.customer_id}`} className="hover:text-brand-700">
                            {c.customer}
                          </Link>
                        ) : (
                          <span className="text-slate-400">No longer reserved</span>
                        )}
                      </Td>
                      <Td label="Destination" className="text-slate-600">{c.country ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </EditorFrame>
  );
}
