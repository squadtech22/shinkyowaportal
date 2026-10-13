import Link from "next/link";
import { CarFront } from "lucide-react";
import DocumentChips from "@/components/admin/DocumentChips";
import { ReserveVehicleForm } from "@/components/admin/Reservations";
import ShipmentBadge from "@/components/admin/ShipmentBadge";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Pager, SearchBar, Table, Tabs, Td, Th } from "@/components/admin/ui";
import { reserveVehicleForCustomer } from "@/actions/admin/customers";
import { can, requireUser } from "@/lib/admin/auth";
import {
  availableVehicles,
  customerOptions,
  listReserved,
  RESERVED_FILTERS,
  RESERVED_PER_PAGE,
  type ReservedFilter,
} from "@/lib/admin/customers";
import { getFormat } from "@/lib/admin/display";
import { date } from "@/lib/admin/format";
import { shipmentStatus } from "@/lib/admin/shipments";
import { vehicleHref } from "@/lib/admin/vehicle-link";

export const metadata = { title: "Reserved vehicles" };

type Search = Promise<{ q?: string; status?: string; page?: string }>;

const LABELS: Record<ReservedFilter, string> = {
  all: "All",
  unpaid: "Balance due",
  paid: "Fully paid",
  unshipped: "Not shipped",
  shipped: "On a vessel",
};

export default async function Reserved({ searchParams }: { searchParams: Search }) {
  const { money } = await getFormat();
  const user = await requireUser("customers.view");
  const { q = "", status: statusParam = "all", page: pageParam } = await searchParams;
  const status = (RESERVED_FILTERS as readonly string[]).includes(statusParam) ? (statusParam as ReservedFilter) : "all";
  const page = Math.max(1, Number(pageParam) || 1);
  const canManage = can(user, "customers.manage");
  const [{ rows, counts, total }, vehicles, customers] = await Promise.all([
    listReserved(user, q, status, page),
    canManage ? availableVehicles() : [],
    canManage ? customerOptions(user) : [],
  ]);
  const lastPage = Math.max(1, Math.ceil(total / RESERVED_PER_PAGE));
  const href = (p: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, ...p })) if (v && !(k === "status" && v === "all")) sp.set(k, String(v));
    return `/admin/reserved${sp.size ? `?${sp}` : ""}`;
  };
  const showShipping = can(user, "shipments.view");
  const showDocuments = can(user, "documents.view");

  return (
    <>
      <PageHeader
        title="Reserved vehicles"
        description="Every vehicle reserved for a customer, with payment, shipping and paperwork status."
      />
      <Tabs
        active={status}
        tabs={RESERVED_FILTERS.filter((key) => showShipping || (key !== "shipped" && key !== "unshipped")).map((key) => ({
          key,
          label: LABELS[key],
          href: href({ status: key, page: undefined }),
          count: counts[key],
        }))}
      />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchBar placeholder="Stock no., chassis, model, customer or vessel" value={q} keep={{ status: status === "all" ? undefined : status }} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={CarFront} title={q ? "No reserved vehicles match your search" : "No reserved vehicles here"} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Vehicle</Th>
                <Th>Customer</Th>
                <Th className="text-right">CNF / paid</Th>
                {showShipping && <Th className="md:max-lg:hidden">Shipment</Th>}
                {showDocuments && <Th className="md:max-lg:hidden">Documents</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cnf = Number(r.cnf ?? 0);
                const paid = Number(r.paid);
                const due = Math.max(cnf - paid, 0);
                const carHref = vehicleHref(user, r);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <Td>
                      {carHref ? (
                        <Link href={carHref} className="font-medium text-slate-900 hover:text-brand-700">
                          {r.year} {r.make} {r.model}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900">{r.year} {r.make} {r.model}</span>
                      )}
                      <p className="text-xs text-slate-500">
                        SKI-{r.sid} · {r.chassis}
                        {Number(r.is_listed) !== 1 && " · not on website"}
                      </p>
                    </Td>
                    <Td label="Customer">
                      <div>
                        <Link href={`/admin/customers/${r.customer_id}`} className="font-medium hover:text-brand-700">{r.customer}</Link>
                        <p className="text-xs text-slate-500">{[r.company, r.agent && `Agent: ${r.agent}`].filter(Boolean).join(" · ")}</p>
                      </div>
                    </Td>
                    <Td label="CNF / paid" className="text-right">
                      <div>
                        <p className="font-semibold tabular-nums">{money(cnf, r.symbol ?? "")}</p>
                        <p className="text-xs whitespace-nowrap tabular-nums">
                          {due > 0 ? (
                            <span className="text-accent-600">{money(due, r.symbol ?? "")} due</span>
                          ) : (
                            <Badge tone="green">Paid</Badge>
                          )}
                        </p>
                      </div>
                    </Td>
                    {showShipping && (
                      <Td label="Shipment" className="md:max-lg:hidden">
                        {r.shipment_id ? (
                          <Link href={`/admin/shipments/${r.shipment_id}`} className="block hover:text-brand-700">
                            <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                              {r.vessel_name} <ShipmentBadge status={shipmentStatus(r.etd, r.eta, r.shipment_status)} />
                            </span>
                            <span className="text-xs text-slate-500">ETD {date(r.etd)} · ETA {date(r.eta)}</span>
                          </Link>
                        ) : can(user, "shipments.manage") ? (
                          <Link href={`/admin/shipments/new?stock=${r.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-800">
                            + Put on a vessel
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-400">Not shipped</span>
                        )}
                      </Td>
                    )}
                    {showDocuments && (
                      <Td label="Documents" className="md:max-lg:hidden">
                        <Link href={`/admin/documents/${r.id}`} className="block" title="Open documents">
                          <DocumentChips row={r} />
                        </Link>
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <div className="border-t border-slate-100">
          <Pager page={page} lastPage={lastPage} total={total} hrefFor={(p) => href({ page: p })} />
        </div>
      </Card>

      {canManage && (
        <Card className="mt-6">
          <CardHeader title="Reserve a vehicle" description="The customer earns loyalty points for each reservation." />
          <div className="p-5">
            {customers.length === 0 ? (
              <p className="text-sm text-slate-500">Add a customer first.</p>
            ) : (
              <ReserveVehicleForm action={reserveVehicleForCustomer} vehicles={vehicles} customers={customers} />
            )}
          </div>
        </Card>
      )}
    </>
  );
}
