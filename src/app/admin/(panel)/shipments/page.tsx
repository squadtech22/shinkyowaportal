import Link from "next/link";
import { Plus, Ship } from "lucide-react";
import ShipmentBadge from "@/components/admin/ShipmentBadge";
import ShipmentStatusSelect from "@/components/admin/ShipmentStatusSelect";
import { ButtonLink, Card, EmptyState, PageHeader, Pager, SearchBar, Table, Tabs, Td, Th } from "@/components/admin/ui";
import { updateShipmentStatus } from "@/actions/admin/shipments";
import { can, canAny, requireUser } from "@/lib/admin/auth";
import { date } from "@/lib/admin/format";
import {
  automaticShipmentStatus,
  isShipmentStatus,
  listShipments,
  SHIPMENT_FILTERS,
  SHIPMENTS_PER_PAGE,
  shipmentStatus,
  type ShipmentFilter,
} from "@/lib/admin/shipments";

export const metadata = { title: "Shipments" };

type Search = Promise<{ q?: string; status?: string; page?: string }>;

const LABELS: Record<ShipmentFilter, string> = { upcoming: "Loading", at_sea: "At sea", arrived: "Arrived", all: "All" };

export default async function Shipments({ searchParams }: { searchParams: Search }) {
  const user = await requireUser("shipments.view");
  const { q = "", status: statusParam = "upcoming", page: pageParam } = await searchParams;
  const status = (SHIPMENT_FILTERS as readonly string[]).includes(statusParam) ? (statusParam as ShipmentFilter) : "upcoming";
  const page = Math.max(1, Number(pageParam) || 1);
  const { rows, counts, total } = await listShipments(user, q, status, page);
  const lastPage = Math.max(1, Math.ceil(total / SHIPMENTS_PER_PAGE));
  const href = (p: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, ...p })) if (v && !(k === "status" && v === "upcoming")) sp.set(k, String(v));
    return `/admin/shipments${sp.size ? `?${sp}` : ""}`;
  };
  const canManage = can(user, "shipments.manage");
  const canChangeStatus = canAny(user, ["shipments.manage", "shipments.status"]);

  return (
    <>
      <PageHeader
        title="Shipments"
        description="Vessels carrying reserved vehicles: departure (ETD) from Japan and arrival (ETA) at the destination."
        actions={canManage && <ButtonLink href="/admin/shipments/new" icon={Plus}>Add shipment</ButtonLink>}
      />
      <Tabs
        active={status}
        tabs={SHIPMENT_FILTERS.map((key) => ({ key, label: LABELS[key], href: href({ status: key, page: undefined }), count: counts[key] }))}
      />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchBar placeholder="Vessel, stock no., chassis or customer" value={q} keep={{ status: status === "upcoming" ? undefined : status }} />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={Ship}
            title={q ? "No shipments match your search" : `No ${LABELS[status].toLowerCase()} shipments`}
            action={canManage && !q && <ButtonLink href="/admin/shipments/new" icon={Plus}>Add shipment</ButtonLink>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Vessel</Th>
                <Th>Departure (ETD)</Th>
                <Th>Arrival (ETA)</Th>
                <Th className="text-right">Vehicles</Th>
                <Th>Status</Th>
                <Th className="text-right"><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`/admin/shipments/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {s.vessel_name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {s.method === "container" ? `Container${s.container_no ? ` · ${s.container_no}` : ""}` : "RoRo"}
                      {s.bl_no ? ` · B/L ${s.bl_no}` : ""}
                    </p>
                  </Td>
                  <Td label="ETD" className="whitespace-nowrap text-slate-600">{date(s.etd)}</Td>
                  <Td label="ETA" className="whitespace-nowrap text-slate-600">{date(s.eta)}</Td>
                  <Td label="Vehicles" className="text-right tabular-nums">{s.cars}</Td>
                  <Td label="Status">
                    {canChangeStatus ? (
                      <ShipmentStatusSelect
                        key={`${s.id}:${s.status ?? "automatic"}`}
                        vessel={s.vessel_name}
                        statusOverride={isShipmentStatus(s.status) ? s.status : null}
                        automaticStatus={automaticShipmentStatus(s.etd, s.eta)}
                        action={updateShipmentStatus.bind(null, Number(s.id))}
                      />
                    ) : (
                      <ShipmentBadge status={shipmentStatus(s.etd, s.eta, s.status)} />
                    )}
                  </Td>
                  <Td actions className="text-right">
                    <Link href={`/admin/shipments/${s.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-800">
                      {canManage ? "Edit" : "View"}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="border-t border-slate-100">
          <Pager page={page} lastPage={lastPage} total={total} hrefFor={(p) => href({ page: p })} />
        </div>
      </Card>
    </>
  );
}
