import Link from "next/link";
import { AlertTriangle, Banknote, Car, Coins, Download, TrendingUp, Wallet } from "lucide-react";
import FinanceFilters from "@/components/admin/FinanceFilters";
import { ButtonLink, Card, CardHeader, PageHeader, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { requireUser } from "@/lib/admin/auth";
import {
  fiscalYearLabel, fiscalYears, groupTotals, ledger, parseLedgerSearch, salespeopleOptions, totals,
  type LedgerSearch, type Totals,
} from "@/lib/admin/finance";
import { getFormat } from "@/lib/admin/display";

export const metadata = { title: "Profit report" };

const margin = (t: Totals) => (t.saleJpy > 0 && t.profit ? `${((t.profit / t.saleJpy) * 100).toFixed(1)}%` : "—");

async function Breakdown({
  title,
  description,
  rows,
  label,
  linkFor,
}: {
  title: string;
  description?: string;
  rows: (Totals & { name: string })[];
  label: string;
  linkFor?: (name: string) => string | undefined;
}) {
  const { yen } = await getFormat();
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No vehicles in this period.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{label}</Th>
              <Th className="text-right">Units</Th>
              <Th className="text-right">Sales</Th>
              <Th className="text-right">Cost</Th>
              <Th className="text-right">Profit</Th>
              <Th className="text-right">Margin</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = linkFor?.(r.name);
              return (
                <tr key={r.name} className="hover:bg-slate-50/60">
                  <Td className="font-medium">
                    {href ? <Link href={href} className="hover:text-brand-700">{r.name}</Link> : r.name}
                  </Td>
                  <Td label="Units" className="text-right tabular-nums">{r.units}</Td>
                  <Td label="Sales" className="text-right tabular-nums">{yen(r.saleJpy)}</Td>
                  <Td label="Cost" className="text-right tabular-nums">{yen(r.cost)}</Td>
                  <Td label="Profit" className={`text-right font-medium tabular-nums ${r.profit < 0 ? "text-accent-600" : "text-emerald-600"}`}>
                    {yen(r.profit)}
                  </Td>
                  <Td label="Margin" className="text-right tabular-nums text-slate-600">{margin(r)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

export default async function FinanceReport({ searchParams }: { searchParams: Promise<LedgerSearch> }) {
  const { yen } = await getFormat();
  await requireUser("finance.view");
  const sp = await searchParams;
  const filters = parseLedgerSearch({ year: sp.year, agent: sp.agent });
  const [years, agents, rows] = await Promise.all([fiscalYears(), salespeopleOptions(), ledger(filters)]);
  const t = totals(rows);
  const period = filters.year === null ? "all years" : fiscalYearLabel(filters.year);
  const query = new URLSearchParams({ year: filters.yearParam, ...(filters.agentId ? { agent: String(filters.agentId) } : {}) });
  const ledgerHref = (extra: Record<string, string> = {}) =>
    `/admin/finance/ledger?${new URLSearchParams({ ...Object.fromEntries(query), ...extra })}`;

  const byAgent = groupTotals(rows, (r) => r.agent ?? "Not assigned").sort((a, b) => b.profit - a.profit);
  const byCountry = groupTotals(rows, (r) => r.country ?? "No customer yet").sort((a, b) => b.profit - a.profit);
  const byCustomer = groupTotals(rows, (r) => (r.customer ? `${r.customer}${r.company ? ` (${r.company})` : ""}` : "No customer yet"))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 15);
  const monthName = (iso: string) => new Date(`${iso.slice(0, 7)}-01`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const byMonth = groupTotals(rows, (r) => r.dealDate.slice(0, 7))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => ({ ...m, name: monthName(m.name) }));
  const agentId = new Map(agents.map((a) => [a.name, a.id]));

  return (
    <>
      <PageHeader
        title="Profit report"
        description={`Vehicles bought or sold in ${period}. Profit = sale price × exchange rate − bought price − expenses.`}
        actions={
          <>
            <ButtonLink href={ledgerHref()} variant="secondary" icon={Car}>Open ledger</ButtonLink>
            <ButtonLink href={`/admin/finance/ledger.csv?${query}`} variant="secondary" icon={Download} external>
              Download Excel (CSV)
            </ButtonLink>
          </>
        }
      />
      <Card className="mb-6">
        <FinanceFilters years={years} values={{ year: filters.yearParam, agent: sp.agent }} agents={agents} />
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Vehicles" value={t.units} hint={`${t.sold} with a sale price`} icon={Car} href={ledgerHref()} />
        <StatCard label="Sales" value={yen(t.saleJpy)} hint="CNF at each vehicle's exchange rate" icon={Coins} tone="blue" />
        <StatCard label="Total cost" value={yen(t.cost)} hint="Bought price + expenses" icon={Banknote} tone="slate" />
        <StatCard
          label="Profit"
          value={<span className={t.profit < 0 ? "text-accent-600" : "text-emerald-600"}>{yen(t.profit)}</span>}
          hint={`Margin ${margin(t)}`}
          icon={TrendingUp}
          tone="green"
        />
        <StatCard
          label="Customers still owe"
          value={yen(t.balanceJpy)}
          hint="Unpaid balances"
          icon={Wallet}
          tone="amber"
        />
      </div>

      {t.incomplete > 0 && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {t.incomplete} sold vehicle{t.incomplete === 1 ? " is" : "s are"} left out of profit because the exchange rate or
            costs are missing.{" "}
            <Link href={ledgerHref()} className="font-medium underline">Find them in the ledger</Link> (profit shows “—”).
          </span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Breakdown
          title="By salesperson"
          description="The customer's agent (CSR)"
          rows={byAgent}
          label="Salesperson"
          linkFor={(name) => (agentId.has(name) ? ledgerHref({ agent: String(agentId.get(name)) }) : undefined)}
        />
        <Breakdown title="By country" rows={byCountry} label="Country" />
        <Breakdown title="By month" description="Month of purchase" rows={byMonth} label="Month" />
        <Breakdown title="Top customers" description="15 most profitable" rows={byCustomer} label="Customer" />
      </div>
    </>
  );
}
