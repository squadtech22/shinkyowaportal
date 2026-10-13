import Link from "next/link";
import { Car, Download, Plus } from "lucide-react";
import FinanceFilters from "@/components/admin/FinanceFilters";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/admin/auth";
import {
  fiscalYears, ledger, parseLedgerSearch, salespeopleOptions, STATUS_INFO, totals, VEHICLE_STATUSES, type LedgerSearch,
} from "@/lib/admin/finance";
import { getFormat } from "@/lib/admin/display";
import { date } from "@/lib/admin/format";
import { countryOptions } from "@/lib/admin/lookups";

export const metadata = { title: "Purchase ledger" };

async function Yen({ value, signed }: { value: number | null; signed?: boolean }) {
  const { yen } = await getFormat();
  return value === null ? (
    <span className="text-slate-400">—</span>
  ) : (
    <span className={signed ? (value < 0 ? "text-accent-600" : "text-emerald-600") : undefined}>{yen(value)}</span>
  );
}

export default async function Ledger({ searchParams }: { searchParams: Promise<LedgerSearch> }) {
  const { yen, money } = await getFormat();
  const user = await requireUser("finance.view");
  const sp = await searchParams;
  const filters = parseLedgerSearch(sp);
  const [years, agents, countries, rows] = await Promise.all([
    fiscalYears(), salespeopleOptions(), countryOptions(), ledger(filters),
  ]);
  const t = totals(rows);
  const query = new URLSearchParams(
    Object.entries({ ...sp, year: filters.yearParam }).filter(([, v]) => v) as [string, string][],
  );
  const canStock = can(user, "stock.manage");

  return (
    <>
      <PageHeader
        title="Purchase ledger"
        description="Every vehicle bought or reserved, with its costs, sale price, payments and shipping, like the yearly Excel sheet."
        actions={
          <>
            {canStock && <ButtonLink href="/admin/stock/new" icon={Plus}>Add vehicle</ButtonLink>}
            <ButtonLink href={`/admin/finance/ledger.csv?${query}`} variant="secondary" icon={Download} external>
              Download Excel (CSV)
            </ButtonLink>
          </>
        }
      />
      <Card>
        <FinanceFilters
          years={years}
          values={{ year: filters.yearParam, agent: sp.agent, country: sp.country, status: sp.status, q: sp.q }}
          agents={agents}
          countries={countries}
          statuses={VEHICLE_STATUSES.map((key) => ({ key, label: STATUS_INFO[key].label }))}
          search="Stock no., chassis, customer, lot no., vessel"
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={Car}
            title="No vehicles match"
            description="Vehicles appear here once they have purchase costs or are reserved for a customer."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Vehicle</Th>
                <Th>Customer</Th>
                <Th>Auction</Th>
                <Th className="text-right">Sale (CNF)</Th>
                <Th className="text-right">Bought</Th>
                <Th className="text-right">Expenses</Th>
                <Th className="text-right">Total cost</Th>
                <Th className="text-right">Sale at rate</Th>
                <Th className="text-right">Profit</Th>
                <Th className="text-right">Received</Th>
                <Th>Shipping</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-slate-50/60">
                  <Td>
                    {canStock ? (
                      <Link href={`/admin/stock/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">{r.title}</Link>
                    ) : (
                      <p className="font-medium text-slate-900">{r.title}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      SKI-{r.sid} · {r.chassis}
                      {r.color && ` · ${r.color}`}
                    </p>
                    {!r.isListed && <Badge tone="slate">Hidden</Badge>}
                  </Td>
                  <Td label="Customer">
                    {r.customerId ? (
                      <Link href={`/admin/customers/${r.customerId}`} className="hover:text-brand-700">{r.customer}</Link>
                    ) : (
                      <span className="text-slate-400">Not reserved</span>
                    )}
                    <p className="text-xs text-slate-500">{[r.country, r.agent].filter(Boolean).join(" · ")}</p>
                  </Td>
                  <Td label="Auction" className="text-xs text-slate-600">
                    {r.auction ?? "—"}
                    {r.lotNo && <p>Lot {r.lotNo}</p>}
                    <p>{date(r.purchaseDate)}</p>
                  </Td>
                  <Td label="Sale (CNF)" className="text-right tabular-nums whitespace-nowrap">
                    {r.cnf ? money(r.cnf, r.symbol) : <span className="text-slate-400">—</span>}
                    <p className="text-xs text-slate-500">
                      {r.rate ? `@ ${r.rate}` : r.cnf ? <span className="text-amber-600">no rate</span> : ""}
                      {r.depositPercent !== null && r.cnf ? ` · ${r.depositPercent}% dep.` : ""}
                    </p>
                  </Td>
                  <Td label="Bought" className="text-right tabular-nums"><Yen value={r.bought || null} /></Td>
                  <Td label="Expenses" className="text-right tabular-nums"><Yen value={r.expenseTotal || null} /></Td>
                  <Td label="Total cost" className="text-right font-medium tabular-nums">
                    <Yen value={r.totalCost || null} />
                    {r.totalCost > 0 && (
                      <p className={`text-xs font-normal ${r.japanPaid >= r.totalCost ? "text-emerald-600" : "text-slate-500"}`}>
                        paid in Japan {yen(r.japanPaid)}
                      </p>
                    )}
                  </Td>
                  <Td label="Sale at rate" className="text-right tabular-nums"><Yen value={r.saleJpy} /></Td>
                  <Td label="Profit" className="text-right font-semibold tabular-nums"><Yen value={r.profit} signed /></Td>
                  <Td label="Received" className="text-right tabular-nums whitespace-nowrap">
                    {r.cnf ? money(r.paid, r.symbol) : "—"}
                    {r.balance ? (
                      <p className="text-xs text-accent-600">owes {money(r.balance, r.symbol)}</p>
                    ) : r.cnf ? (
                      <p className="text-xs text-emerald-600">paid</p>
                    ) : null}
                    {r.depositDue !== null && r.paid < r.depositDue && (
                      <p className="text-xs text-amber-600">deposit {money(r.depositDue, r.symbol)} not met</p>
                    )}
                  </Td>
                  <Td label="Shipping">
                    <Badge tone={STATUS_INFO[r.status].tone}>{STATUS_INFO[r.status].label}</Badge>
                    {r.shipmentId && (
                      <p className="mt-1 text-xs text-slate-500">
                        <Link href={`/admin/shipments/${r.shipmentId}`} className="hover:text-brand-700">{r.vessel}</Link>
                        <br />
                        ETA {date(r.eta)}
                      </p>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <Td>{t.units} vehicles</Td>
                <Td label="" />
                <Td label="" />
                <Td label="" />
                <Td label="Bought" className="text-right tabular-nums">{yen(rows.reduce((a, r) => a + r.bought, 0))}</Td>
                <Td label="Expenses" className="text-right tabular-nums">{yen(rows.reduce((a, r) => a + r.expenseTotal, 0))}</Td>
                <Td label="Total cost" className="text-right tabular-nums">{yen(t.cost)}</Td>
                <Td label="Sale at rate" className="text-right tabular-nums">{yen(t.saleJpy)}</Td>
                <Td label="Profit" className="text-right tabular-nums"><Yen value={t.profit} signed /></Td>
                <Td label="Still owed" className="text-right tabular-nums">{yen(t.balanceJpy)}</Td>
                <Td label="" />
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </>
  );
}
