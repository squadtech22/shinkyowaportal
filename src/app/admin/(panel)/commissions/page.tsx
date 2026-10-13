import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, HandCoins, Plus, Wallet } from "lucide-react";
import {
  approveMonth,
  approveWholeMonth,
  completePayout,
  deleteCommission,
  quickAddCommission,
  unapprovePayout,
} from "@/actions/admin/commissions";
import { CompletePayout, QuickAddCommission } from "@/components/admin/CommissionForms";
import { ActionButton, ConfirmButton } from "@/components/admin/forms";
import { Badge, ButtonLink, buttonClass, Card, CardHeader, EmptyState, PageHeader, StatCard, Table, Tabs, Td, Th } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/admin/auth";
import {
  COMMISSION_STATUS_INFO,
  commissionBasis,
  commissionPeriods,
  isPeriod,
  listCommissions,
  listPayouts,
  monthGroups,
  periodLabel,
  periodOf,
  shiftPeriod,
  vehiclesWithoutCommission,
  type CommissionRow,
  type PayoutRow,
} from "@/lib/admin/commissions";
import { getFormat } from "@/lib/admin/display";
import { date } from "@/lib/admin/format";

export const metadata = { title: "Commissions" };

type Tab = "month" | "add" | "finance" | "completed";

// Monthly commission: admin adds commission to sold vehicles (month tab /
// "Sold, no commission yet"), the CEO approves each staff member's month, and
// finance completes it ("To pay"). Finance-only users just see their tabs.
export default async function Commissions({ searchParams }: { searchParams: Promise<{ tab?: string; month?: string }> }) {
  const { yen } = await getFormat();
  const me = await requireUser(["commission.manage", "commission.approve", "commission.pay"]);
  const manage = can(me, "commission.manage");
  const approve = can(me, "commission.approve");
  const pay = can(me, "commission.pay");
  const sp = await searchParams;

  const allowedTabs: Tab[] = [
    ...(manage || approve ? (["month"] as Tab[]) : []),
    ...(manage ? (["add"] as Tab[]) : []),
    "finance",
    "completed",
  ];
  const tab: Tab = allowedTabs.includes(sp.tab as Tab) ? (sp.tab as Tab) : sp.month && allowedTabs.includes("month") ? "month" : allowedTabs[0];
  const month = isPeriod(sp.month) ? sp.month : periodOf();

  const [toPay, completed, missing] = await Promise.all([
    listPayouts({ status: "approved" }),
    listPayouts({ status: "paid" }),
    manage ? vehiclesWithoutCommission() : Promise.resolve([]),
  ]);
  const toPayTotal = toPay.reduce((n, p) => n + p.amount, 0);
  const completedTotal = completed.reduce((n, p) => n + p.amount, 0);

  const tabs = [
    ...(allowedTabs.includes("month") ? [{ key: "month", label: "Monthly commission", href: `?tab=month&month=${month}` }] : []),
    ...(manage ? [{ key: "add", label: "Sold, no commission yet", href: "?tab=add", count: missing.length }] : []),
    { key: "finance", label: "With finance — to pay", href: "?tab=finance", count: toPay.length },
    { key: "completed", label: "Completed", href: "?tab=completed", count: completed.length },
  ];

  return (
    <>
      <PageHeader
        title="Commissions"
        description="Paid monthly: admin adds commission to sold vehicles, the CEO approves each staff member's month, finance pays it and marks it complete."
        actions={manage && <ButtonLink href="/admin/commissions/new" icon={Plus}>Add commission</ButtonLink>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {allowedTabs.includes("month") && (
          <StatCard label={`${periodLabel(periodOf())} so far`} value={<MonthTotal period={periodOf()} />} icon={CalendarDays} tone="amber" href={`?tab=month&month=${periodOf()}`} />
        )}
        <StatCard label="With finance — to pay" value={yen(toPayTotal)} hint={`${toPay.length} staff months`} icon={Wallet} tone="blue" href="?tab=finance" />
        <StatCard label="Completed" value={yen(completedTotal)} hint={`${completed.length} staff months`} icon={HandCoins} tone="green" href="?tab=completed" />
      </div>

      <Tabs tabs={tabs} active={tab} />

      {tab === "month" && <MonthView month={month} manage={manage} approve={approve} />}
      {tab === "add" && <MissingView missing={missing} />}
      {tab === "finance" && (
        <PayoutsView
          payouts={toPay}
          empty="Nothing to pay. Approved months appear here."
          actions={(p) => (
            <div className="flex flex-wrap items-start justify-end gap-2">
              {pay && <CompletePayout action={completePayout.bind(null, p.id)} />}
              {approve && <ActionButton action={unapprovePayout.bind(null, p.id)}>Withdraw approval</ActionButton>}
            </div>
          )}
        />
      )}
      {tab === "completed" && <PayoutsView payouts={completed} empty="No completed commission yet." />}
    </>
  );
}

async function MonthTotal({ period }: { period: string }) {
  const { yen } = await getFormat();
  const rows = await listCommissions({ period });
  return <>{yen(rows.reduce((n, r) => n + r.amount, 0))}</>;
}

async function MonthView({ month, manage, approve }: { month: string; manage: boolean; approve: boolean }) {
  const { yen } = await getFormat();
  const [groups, periods] = await Promise.all([monthGroups(month), commissionPeriods()]);
  const pendingGroups = groups.filter((g) => g.status === "pending");
  const pendingTotal = pendingGroups.reduce((n, g) => n + g.rows.filter((r) => r.status === "pending").reduce((a, r) => a + r.amount, 0), 0);
  const total = groups.reduce((n, g) => n + g.amount, 0);

  return (
    <Card>
      <CardHeader
        title={periodLabel(month)}
        description={`${groups.length} staff · ${yen(total)} in total${pendingGroups.length ? ` · ${yen(pendingTotal)} waiting for approval` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`?tab=month&month=${shiftPeriod(month, -1)}`} className={buttonClass("secondary", "sm")} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Link>
            <form className="flex">
              <input type="hidden" name="tab" value="month" />
              <select name="month" defaultValue={month} className="input-base w-auto! py-1! text-sm" aria-label="Month">
                {[...new Set([month, ...periods])].sort().reverse().map((p) => (
                  <option key={p} value={p}>{periodLabel(p)}</option>
                ))}
              </select>
              <button className={buttonClass("secondary", "sm")}>Go</button>
            </form>
            <Link href={`?tab=month&month=${shiftPeriod(month, 1)}`} className={buttonClass("secondary", "sm")} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Link>
            {approve && pendingGroups.length > 1 && (
              <ConfirmButton
                action={approveWholeMonth.bind(null, month)}
                title={`Approve ${periodLabel(month)} for everyone?`}
                description={`${pendingGroups.length} staff, ${yen(pendingTotal)}. It goes to finance to pay.`}
                confirmLabel="Approve all"
                variant="primary"
              >
                <CheckCircle2 className="size-3.5" /> Approve all
              </ConfirmButton>
            )}
          </div>
        }
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No commission this month"
          description={manage ? "Add commission from “Sold, no commission yet”." : "Commission appears here once admin adds it."}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {groups.map((g) => {
            const pendingAmount = g.rows.filter((r) => r.status === "pending").reduce((n, r) => n + r.amount, 0);
            return (
              <li key={g.userId} className="flex flex-wrap items-start sm:flex-nowrap">
                <details className="group min-w-0 flex-1">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-slate-50/60">
                    <ChevronRight className="size-4 text-slate-400 transition group-open:rotate-90" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{g.user}</p>
                      <p className="text-xs text-slate-500">
                        {g.rows.length} vehicle{g.rows.length === 1 ? "" : "s"}
                        {g.payout?.approvedBy && ` · approved by ${g.payout.approvedBy}`}
                        {g.payout?.paidAt && ` · paid ${date(g.payout.paidAt)}`}
                      </p>
                    </div>
                    <span className="text-lg font-semibold tabular-nums text-slate-900">{yen(g.amount)}</span>
                    <Badge tone={COMMISSION_STATUS_INFO[g.status].tone}>{COMMISSION_STATUS_INFO[g.status].label}</Badge>
                  </summary>
                  <CommissionList rows={g.rows} manage={manage} />
                </details>
                {approve && g.status === "pending" && (
                  <div className="shrink-0 px-5 py-4 max-sm:w-full max-sm:pt-0 max-sm:text-right">
                    <ActionButton action={approveMonth.bind(null, g.userId, month)} variant="primary">
                      Approve {yen(pendingAmount)}
                    </ActionButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

async function CommissionList({ rows, manage }: { rows: CommissionRow[]; manage: boolean }) {
  const { yen } = await getFormat();
  return (
    <div className="border-t border-slate-100 bg-slate-50/40">
      <Table>
        <thead>
          <tr>
            <Th>Vehicle</Th>
            <Th className="md:max-lg:hidden">Basis</Th>
            <Th className="text-right">Amount</Th>
            <Th>Status</Th>
            <Th className="text-right"><span className="sr-only">Actions</span></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>
                <p className="font-medium text-slate-900">{r.vehicle}</p>
                <p className="text-xs text-slate-500">
                  {r.sid ? `SKI-${r.sid} · ${r.chassis}` : ""}
                  {r.customer ? ` · ${r.customer}` : ""}
                </p>
                {r.note && <p className="mt-0.5 text-xs text-slate-500 italic">{r.note}</p>}
              </Td>
              <Td label="Basis" className="md:max-lg:hidden text-slate-600">
                {commissionBasis(r.type, r.rate)}
                {r.type === "percent" && r.profit !== null && <p className="text-xs text-slate-500">of {yen(r.profit)}</p>}
              </Td>
              <Td label="Amount" className="text-right font-semibold tabular-nums">{yen(r.amount)}</Td>
              <Td label="Status"><Badge tone={COMMISSION_STATUS_INFO[r.status].tone}>{COMMISSION_STATUS_INFO[r.status].label}</Badge></Td>
              <Td actions className="text-right">
                {manage && r.status === "pending" && (
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/commissions/${r.id}`} className="px-1 py-1.5 text-xs font-medium text-brand-600 hover:text-brand-800">Edit</Link>
                    <ConfirmButton action={deleteCommission.bind(null, r.id)} title="Remove this commission?" description={`${yen(r.amount)} for ${r.user}.`} confirmLabel="Remove">
                      Remove
                    </ConfirmButton>
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

async function MissingView({ missing }: { missing: Awaited<ReturnType<typeof vehiclesWithoutCommission>> }) {
  const { yen } = await getFormat();
  return (
    <Card>
      {missing.length === 0 ? (
        <EmptyState icon={HandCoins} title="Every sold vehicle has commission" description="Vehicles appear here once they have a sale price (C&F) and a salesperson." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Vehicle</Th>
              <Th>Salesperson</Th>
              <Th className="text-right">Profit</Th>
              <Th className="text-right">Default rate</Th>
              <Th className="text-right">Add to this month</Th>
            </tr>
          </thead>
          <tbody>
            {missing.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50/60">
                <Td>
                  <p className="font-medium text-slate-900">{v.title}</p>
                  <p className="text-xs text-slate-500">SKI-{v.sid} · {v.chassis}{v.company || v.customer ? ` · ${v.company || v.customer}` : ""}</p>
                </Td>
                <Td label="Salesperson">{v.agent}</Td>
                <Td label="Profit" className="text-right tabular-nums">
                  {v.profit === null ? <span className="text-xs text-slate-400">Costs incomplete</span> : <span className={v.profit < 0 ? "text-accent-600" : ""}>{yen(v.profit)}</span>}
                </Td>
                <Td label="Default rate" className="text-right text-slate-600">
                  {v.defaultType ? (
                    <>
                      {v.defaultType === "percent" ? `${v.defaultRate}%` : yen(v.defaultRate ?? 0)}
                      {v.suggested !== null && <p className="text-xs text-slate-500">= {yen(v.suggested)}</p>}
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Not set</span>
                  )}
                </Td>
                <Td actions className="text-right">
                  <QuickAddCommission action={quickAddCommission.bind(null, v.id, v.agentId!)} defaultType={v.defaultType} defaultRate={v.defaultRate} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

async function PayoutsView({ payouts, empty, actions }: { payouts: PayoutRow[]; empty: string; actions?: (p: PayoutRow) => React.ReactNode }) {
  const { yen } = await getFormat();
  if (!payouts.length) {
    return (
      <Card>
        <EmptyState icon={Clock} title={empty} />
      </Card>
    );
  }
  return (
    <Card>
      <ul className="divide-y divide-slate-100">
        {await Promise.all(
          payouts.map(async (p) => (
            <li key={p.id} className="flex flex-wrap items-start sm:flex-nowrap">
              <details className="group min-w-0 flex-1">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-slate-50/60">
                  <ChevronRight className="size-4 text-slate-400 transition group-open:rotate-90" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{p.user} · {periodLabel(p.period)}</p>
                    <p className="text-xs text-slate-500">
                      {p.cars} vehicle{p.cars === 1 ? "" : "s"}
                      {p.approvedBy && ` · approved by ${p.approvedBy} on ${date(p.approvedAt)}`}
                      {p.paidAt && ` · completed ${date(p.paidAt)}${p.paidBy ? ` by ${p.paidBy}` : ""}`}
                      {p.paymentRef && ` · ref ${p.paymentRef}`}
                    </p>
                  </div>
                  <span className="text-lg font-semibold tabular-nums text-slate-900">{yen(p.amount)}</span>
                  {!actions && <Badge tone="green">Completed</Badge>}
                </summary>
                <CommissionList rows={await listCommissions({ payoutId: p.id })} manage={false} />
              </details>
              {actions && <div className="shrink-0 px-5 py-4 max-sm:w-full max-sm:pt-0">{actions(p)}</div>}
            </li>
          )),
        )}
      </ul>
    </Card>
  );
}
