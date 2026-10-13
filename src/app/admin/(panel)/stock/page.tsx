import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import { Car, ExternalLink, FileSpreadsheet, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Pager, SearchBar, Table, Tabs, Td, Th } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/admin/auth";
import { AUTOMATIC_STATUS_SQL, STATUS_SQL } from "@/lib/admin/finance";
import { STATUS_INFO, VEHICLE_STATUSES, type VehicleStatus } from "@/lib/vehicle-status";
import StockSalesStatusSelect from "@/components/admin/StockSalesStatusSelect";
import { updateStockStatus } from "@/actions/admin/stock";
import { getFormat } from "@/lib/admin/display";
import { number } from "@/lib/admin/format";
import { db } from "@/lib/db";
import { vehicleHref } from "@/lib/admin/vehicle-link";
import { STOCK_IMG_URL } from "@/lib/data";

export const metadata = { title: "Stock" };

const PER_PAGE = 20;

const photo = (path: string | null) =>
  !path ? null : /^(https?:\/\/|\/)/.test(path) ? path : STOCK_IMG_URL + path;

type Search = Promise<{ q?: string; status?: string; page?: string }>;

async function Profit({ value }: { value: number | null }) {
  const { yen } = await getFormat();
  if (value === null) return <span className="text-slate-400">—</span>;
  return <span className={value >= 0 ? "text-emerald-600" : "text-accent-600"}>{yen(value)}</span>;
}

export default async function StockList({ searchParams }: { searchParams: Search }) {
  const { money } = await getFormat();
  const user = await requireUser("stock.view");
  const { q = "", status = "all", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: string[] = [];
  const params: unknown[] = [];
  if (q.trim()) {
    const like = `%${q.trim().replace(/[\\%_]/g, "\\$&")}%`;
    where.push("(CONCAT_WS(' ', m.name, s.model, s.year, s.chassis, s.sid) LIKE ?)");
    params.push(like);
  }
  if ((VEHICLE_STATUSES as readonly string[]).includes(status)) {
    where.push(`${STATUS_SQL} = ?`);
    params.push(status);
  }
  if (status === "hidden") where.push("s.is_listed = 0");
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const showProfit = can(user, "finance.view");
  // Profit in yen: CNF × exchange rate − bought price − expenses (see lib/admin/finance).
  const profitSql = showProfit
    ? `, (SELECT COALESCE(SUM(e.amount), 0) FROM stock_expenses e WHERE e.stock_id = s.id) + COALESCE(sp.bought_price, 0) AS cost,
       sp.exchange_rate, ccur.code AS sale_code`
    : "";

  const [[counts], [[{ total }]], [rows]] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT ${STATUS_SQL} AS status, s.is_listed, COUNT(*) AS n FROM stocks s
       LEFT JOIN shipment_stock ss ON ss.stock_id = s.id GROUP BY status, s.is_listed`,
    ),
    db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM stocks s LEFT JOIN makes m ON m.id = s.make_id
       LEFT JOIN shipment_stock ss ON ss.stock_id = s.id ${whereSql}`,
      params,
    ),
    db.query<RowDataPacket[]>(
      `SELECT s.id, s.sid, s.thumbnail, s.model, s.year, s.chassis, s.fob, s.cnf, s.mileage, s.transmission, s.fuel,
              s.is_listed, s.status_override, s.created_by, m.name AS make, cat.name AS category, cur.symbol, c.id AS customer_id, c.name AS customer,
              sh.vessel_name, ${STATUS_SQL} AS status, ${AUTOMATIC_STATUS_SQL} AS automatic_status ${profitSql}
       FROM stocks s
       LEFT JOIN makes m ON m.id = s.make_id
       LEFT JOIN categories cat ON cat.id = s.category_id
       LEFT JOIN currencies cur ON cur.id = s.currency_id
       LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
       LEFT JOIN currencies ccur ON ccur.id = c.currency_id
       LEFT JOIN shipment_stock ss ON ss.stock_id = s.id
       LEFT JOIN shipments sh ON sh.id = ss.shipment_id
       LEFT JOIN stock_purchases sp ON sp.stock_id = s.id
       ${whereSql}
       ORDER BY s.id DESC LIMIT ? OFFSET ?`,
      [...params, PER_PAGE, (page - 1) * PER_PAGE],
    ),
  ]);
  const countOf = (key: string) =>
    counts
      .filter((r) => key === "all" || r.status === key || (key === "hidden" && r.is_listed === 0))
      .reduce((a, r) => a + Number(r.n), 0);
  const profitOf = (s: RowDataPacket) => {
    const rate = s.exchange_rate ? Number(s.exchange_rate) : s.sale_code === "JPY" ? 1 : 0;
    const cost = Number(s.cost ?? 0);
    return s.customer_id && s.cnf && rate && cost > 0 ? Math.round(Number(s.cnf) * rate) - cost : null;
  };
  const lastPage = Math.max(1, Math.ceil(Number(total) / PER_PAGE));
  const href = (p: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q, status, ...p };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "status" && v === "all")) sp.set(k, String(v));
    return `/admin/stock${sp.size ? `?${sp}` : ""}`;
  };
  const canManage = can(user, "stock.manage");
  const canAdd = canManage || can(user, "stock.add");
  // With only stock.add: their own vehicles, while hidden from the website.
  const canEdit = (s: RowDataPacket) => vehicleHref(user, s)?.startsWith("/admin/") ?? false;

  return (
    <>
      <PageHeader
        title="Stock"
        description="Vehicles marked “Show on website” are listed on the public website; hidden ones only appear here."
        actions={
          canAdd && (
            <>
              {canManage && can(user, "customers.manage") && (
                <ButtonLink href="/admin/stock-import" variant="secondary" icon={FileSpreadsheet}>Import from Excel</ButtonLink>
              )}
              <ButtonLink href="/admin/stock/new" icon={Plus}>Add vehicle</ButtonLink>
            </>
          )
        }
      />
      <Tabs
        active={status}
        tabs={[
          { key: "all", label: "All" },
          ...VEHICLE_STATUSES.map((key) => ({ key, label: STATUS_INFO[key].label })),
          { key: "hidden", label: "Hidden from website" },
        ].map((t) => ({ ...t, href: href({ status: t.key, page: undefined }), count: countOf(t.key) }))}
      />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchBar placeholder="Search make, model, year, chassis, stock no." value={q} keep={{ status: status === "all" ? undefined : status }} />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={Car}
            title={q ? "No vehicles match your search" : "No vehicles yet"}
            description={q ? "Try a different make, model or stock number." : "Add your first vehicle to list it on the website."}
            action={canAdd && !q && <ButtonLink href="/admin/stock/new" icon={Plus}>Add vehicle</ButtonLink>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Vehicle</Th>
                <Th>Stock no.</Th>
                <Th className="md:max-lg:hidden">Details</Th>
                <Th className="text-right">FOB</Th>
                {showProfit && <Th className="text-right">Profit</Th>}
                <Th>Status</Th>
                <Th className="text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const img = photo(s.thumbnail);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {img && <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />}
                        </div>
                        <div className="min-w-0">
                          {vehicleHref(user, s) ? (
                            <Link href={vehicleHref(user, s)!} className="font-medium text-slate-900 hover:text-brand-700">
                              {s.year} {s.make} {s.model}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-900">{s.year} {s.make} {s.model}</span>
                          )}
                          <p className="text-xs text-slate-500">{s.chassis}</p>
                        </div>
                      </div>
                    </Td>
                    <Td label="Stock no." className="whitespace-nowrap text-slate-600 tabular-nums">SKI-{s.sid}</Td>
                    <Td label="Details" className="md:max-lg:hidden text-xs text-slate-500">
                      <div>
                        <span className="capitalize">{s.transmission}</span> · <span className="capitalize">{s.fuel}</span> ·{" "}
                        {number(Number(s.mileage))} km
                        {s.category && (
                          <div className="mt-1">
                            <Badge tone="blue">{s.category}</Badge>
                          </div>
                        )}
                      </div>
                    </Td>
                    <Td label="FOB" className="text-right font-medium tabular-nums">
                      {s.fob > 0 ? money(s.fob, s.symbol ?? "$") : <span className="text-slate-400">Ask</span>}
                    </Td>
                    {showProfit && (
                      <Td label="Profit" className="text-right tabular-nums">
                        <Profit value={profitOf(s)} />
                      </Td>
                    )}
                    <Td label="Status">
                      <div className="flex flex-wrap items-center gap-1">
                        {canManage ? (
                          <StockSalesStatusSelect
                            key={`${s.id}:${s.status_override ?? "automatic"}:${s.automatic_status}`}
                            stockNumber={String(s.sid)}
                            statusOverride={s.status_override as VehicleStatus | null}
                            automaticStatus={s.automatic_status as VehicleStatus}
                            action={updateStockStatus.bind(null, Number(s.id))}
                          />
                        ) : (
                          <Badge tone={STATUS_INFO[s.status as VehicleStatus].tone}>
                            {STATUS_INFO[s.status as VehicleStatus].label}
                          </Badge>
                        )}
                        {s.is_listed === 0 && <Badge tone="slate">Hidden</Badge>}
                      </div>
                      {s.customer_id && (
                        <Link href={`/admin/customers/${s.customer_id}`} className="mt-1 block text-xs text-brand-600 hover:underline">
                          {s.customer}
                        </Link>
                      )}
                      {s.vessel_name && <p className="mt-1 text-xs text-slate-500">{s.vessel_name}</p>}
                    </Td>
                    <Td actions className="text-right whitespace-nowrap">
                      {s.is_listed === 1 && (
                        <a href={`/vehicle-info/${s.id}`} target="_blank" rel="noreferrer" className="mr-3 inline-flex text-slate-400 hover:text-slate-600" title="View on website">
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                      {canEdit(s) && (
                        <Link href={`/admin/stock/${s.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-800">
                          Edit
                        </Link>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <div className="border-t border-slate-100">
          <Pager page={page} lastPage={lastPage} total={Number(total)} hrefFor={(p) => href({ page: p })} />
        </div>
      </Card>
    </>
  );
}
