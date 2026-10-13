import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { BadgePercent, CarFront, ChevronRight, Clock, HandCoins, Wallet } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { requireUser } from "@/lib/admin/auth";
import {
  COMMISSION_STATUS_INFO,
  commissionBasis,
  listCommissions,
  listPayouts,
  periodLabel,
  teamMembers,
  type CommissionRow,
  type CommissionStatus,
} from "@/lib/admin/commissions";
import { getFormat } from "@/lib/admin/display";
import { date } from "@/lib/admin/format";
import { db } from "@/lib/db";

export const metadata = { title: "My commission" };

const sumBy = (rows: CommissionRow[], status: CommissionStatus) =>
  rows.filter((r) => r.status === status).reduce((n, r) => n + r.amount, 0);

// Every staff member sees their own commission here, month by month; people
// with a team also see their team's totals. Vehicle profit is not shown (that
// needs finance.view), only the commission itself. Super Admin earns none.
export default async function MyCommission() {
  const { yen } = await getFormat();
  const me = await requireUser();
  if (me.isSuper) redirect("/admin/commissions");
  const [[[rate]], rows, payouts, team, [waiting]] = await Promise.all([
    db.query<RowDataPacket[]>("SELECT commission_type, commission_value FROM users WHERE id = ?", [me.id]),
    listCommissions({ userIds: [me.id] }),
    listPayouts({ userIds: [me.id] }),
    teamMembers(me.id),
    // Sold vehicles of theirs that have no commission yet.
    db.query<RowDataPacket[]>(
      `SELECT s.id, s.sid, s.year, s.model, s.chassis, m.name AS make, c.name AS customer, c.company
       FROM stocks s
       LEFT JOIN makes m ON m.id = s.make_id
       LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
       WHERE s.cnf IS NOT NULL AND COALESCE(c.agent_id, s.agent_id) = ?
         AND NOT EXISTS (SELECT 1 FROM commissions k WHERE k.stock_id = s.id AND k.user_id = ?)
       ORDER BY s.id DESC`,
      [me.id, me.id],
    ),
  ]);
  const teamRows = team.length ? await listCommissions({ userIds: team.map((t) => t.id) }) : [];

  // Months, newest first.
  const months = [...new Set(rows.map((r) => r.period))].sort().reverse();

  const myRate =
    rate?.commission_type === "percent"
      ? `${Number(rate.commission_value)}% of vehicle profit`
      : rate?.commission_type === "fixed"
        ? `${yen(Number(rate.commission_value))} per vehicle`
        : "Not set yet — ask your admin";

  return (
    <>
      <PageHeader
        title="My commission"
        description={<>Paid monthly. Your rate: <span className="font-medium text-slate-700">{myRate}</span></>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Waiting for approval" value={yen(sumBy(rows, "pending"))} icon={Clock} tone="amber" />
        <StatCard label="Approved — with finance" value={yen(sumBy(rows, "approved"))} icon={Wallet} tone="blue" />
        <StatCard label="Paid to you" value={yen(sumBy(rows, "paid"))} icon={HandCoins} tone="green" />
        <StatCard label="Sold, commission not added" value={waiting.length} hint="Admin adds commission after the sale" icon={CarFront} tone="slate" />
      </div>

      <Card className="mb-5">
        <CardHeader title="By month" />
        {months.length === 0 ? (
          <EmptyState icon={BadgePercent} title="No commission yet" description="Commission appears here once admin adds it to a vehicle you sold." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {months.map((month) => {
              const list = rows.filter((r) => r.period === month);
              const payout = payouts.find((p) => p.period === month);
              const status: CommissionStatus = list.some((r) => r.status === "pending")
                ? "pending"
                : list.some((r) => r.status === "approved")
                  ? "approved"
                  : "paid";
              return (
                <li key={month}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-slate-50/60">
                      <ChevronRight className="size-4 text-slate-400 transition group-open:rotate-90" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{periodLabel(month)}</p>
                        <p className="text-xs text-slate-500">
                          {list.length} vehicle{list.length === 1 ? "" : "s"}
                          {payout?.paidAt && ` · paid ${date(payout.paidAt)}`}
                          {payout?.paymentRef && ` · ref ${payout.paymentRef}`}
                        </p>
                      </div>
                      <span className="text-lg font-semibold tabular-nums text-slate-900">{yen(list.reduce((n, r) => n + r.amount, 0))}</span>
                      <Badge tone={COMMISSION_STATUS_INFO[status].tone}>{COMMISSION_STATUS_INFO[status].label}</Badge>
                    </summary>
                    <div className="border-t border-slate-100 bg-slate-50/40">
                      <Table>
                        <thead>
                          <tr>
                            <Th>Vehicle</Th>
                            <Th className="md:max-lg:hidden">Basis</Th>
                            <Th className="text-right">Amount</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((r) => (
                            <tr key={r.id}>
                              <Td>
                                <p className="font-medium text-slate-900">{r.vehicle}</p>
                                <p className="text-xs text-slate-500">
                                  {r.sid ? `SKI-${r.sid} · ${r.chassis}` : ""}
                                  {r.customer ? ` · ${r.customer}` : ""}
                                </p>
                                {r.note && <p className="mt-0.5 text-xs text-slate-500 italic">{r.note}</p>}
                              </Td>
                              <Td label="Basis" className="md:max-lg:hidden text-slate-600">{commissionBasis(r.type, r.rate)}</Td>
                              <Td label="Amount" className="text-right font-semibold tabular-nums">{yen(r.amount)}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {waiting.length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Sold — commission not added yet" description="Your admin adds commission to these vehicles." />
          <ul className="divide-y divide-slate-100">
            {waiting.map((v) => (
              <li key={v.id} className="px-5 py-3 text-sm">
                <span className="font-medium text-slate-900">{`${v.year} ${v.make ?? ""} ${v.model}`.replace(/\s+/g, " ")}</span>
                <span className="text-slate-500"> · SKI-{v.sid} · {v.chassis}{v.company || v.customer ? ` · ${v.company || v.customer}` : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {team.length > 0 && (
        <Card>
          <CardHeader title="My team" description="Commission of the people who report to you." />
          <Table>
            <thead>
              <tr>
                <Th>Staff</Th>
                <Th className="text-right">Waiting for approval</Th>
                <Th className="text-right">With finance</Th>
                <Th className="text-right">Paid</Th>
              </tr>
            </thead>
            <tbody>
              {team.map((t) => {
                const tr = teamRows.filter((r) => r.userId === t.id);
                return (
                  <tr key={t.id}>
                    <Td><span className="font-medium text-slate-900">{t.name}</span></Td>
                    <Td label="Waiting for approval" className="text-right tabular-nums">{yen(sumBy(tr, "pending"))}</Td>
                    <Td label="With finance" className="text-right tabular-nums">{yen(sumBy(tr, "approved"))}</Td>
                    <Td label="Paid" className="text-right tabular-nums">{yen(sumBy(tr, "paid"))}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
