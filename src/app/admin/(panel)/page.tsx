import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Car,
  Clock,
  Inbox,
  Paperclip,
  Plus,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import ChartsMenu from "@/components/admin/ChartsMenu";
import DashboardChart from "@/components/admin/DashboardChart";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/admin/ui";
import { approvePayment, rejectPayment, unapprovePayment } from "@/actions/admin/payments";
import PaymentReview from "@/components/admin/PaymentReview";
import { can, requireUser } from "@/lib/admin/auth";
import { CHARTS, parseChartPrefs, type ChartId } from "@/lib/admin/chart-prefs";
import { customersPerMonth, dashboardData, inquiriesPerDay } from "@/lib/admin/dashboard";
import { fiscalYearLabel, fiscalYearOf, ledger, totals } from "@/lib/admin/finance";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { getDisplay, getFormat } from "@/lib/admin/display";
import { date, number } from "@/lib/admin/format";
import type { Permission } from "@/lib/admin/permissions";

export const metadata = { title: "Dashboard" };

// Where to send users whose role has no dashboard access.
const FALLBACKS: [Permission, string][] = [
  ["stock.view", "/admin/stock"],
  ["customers.view", "/admin/customers"],
  ["payments.view", "/admin/payments"],
  ["shipments.view", "/admin/shipments"],
  ["documents.view", "/admin/documents"],
  ["finance.view", "/admin/finance"],
  ["commission.manage", "/admin/commissions"],
  ["commission.pay", "/admin/commissions"],
  ["inquiries.view", "/admin/inquiries"],
  ["website.manage", "/admin/website"],
  ["catalog.manage", "/admin/catalog"],
  ["users.approve", "/admin/approvals"],
  ["users.manage", "/admin/users"],
  ["users.manage_team", "/admin/users"],
  ["roles.manage", "/admin/roles"],
];

export default async function Dashboard() {
  const { yen, money, yenCompact } = await getFormat();
  const user = await requireUser();
  if (!can(user, "dashboard.view")) {
    redirect(FALLBACKS.find(([p]) => can(user, p))?.[1] ?? "/admin/profile");
  }

  // Charts this user may see (by permission), and their saved chart settings.
  const allowedCharts: ChartId[] = [
    "revenue",
    ...(can(user, "inquiries.view") ? (["inquiries"] as const) : []),
    ...(can(user, "customers.view") ? (["customers"] as const) : []),
  ];
  const fy = fiscalYearOf(new Date());
  const [d, inquirySeries, customerSeries, [[prefRow]], deals] = await Promise.all([
    dashboardData(user),
    allowedCharts.includes("inquiries") ? inquiriesPerDay() : Promise.resolve([]),
    allowedCharts.includes("customers") ? customersPerMonth(user) : Promise.resolve([]),
    db.query<RowDataPacket[]>("SELECT dashboard_prefs FROM users WHERE id = ?", [user.id]),
    can(user, "finance.view") ? ledger({ year: fy }) : Promise.resolve(null),
  ]);
  const fyTotals = deals && totals(deals);
  const prefs = parseChartPrefs(prefRow?.dashboard_prefs);
  const shows = (id: ChartId) => allowedCharts.includes(id) && !prefs.hidden.includes(id);
  const change = d.lastMonth > 0 ? ((d.thisMonth - d.lastMonth) / d.lastMonth) * 100 : null;
  const canApprove = can(user, "payments.approve");
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          can(user, "customers.view_all")
            ? "Here is how sales are going across all customers."
            : "Here is how sales are going for your customers."
        }
        actions={
          <>
            <ChartsMenu charts={allowedCharts.map((id) => ({ id, title: CHARTS[id].title, visible: shows(id) }))} />
            {can(user, "payments.manage") && (
              <ButtonLink href="/admin/payments/new" icon={Plus}>
                Record payment
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total received"
          value={yen(d.received)}
          icon={Wallet}
          tone="green"
          hint="All approved payments"
        />
        <StatCard
          label="Received this month"
          value={yen(d.thisMonth)}
          icon={TrendingUp}
          tone="brand"
          hint={
            change === null ? (
              "No payments last month to compare"
            ) : (
              <span className={change >= 0 ? "text-emerald-600" : "text-accent-600"}>
                {change >= 0 ? <ArrowUpRight className="inline size-3.5" /> : <ArrowDownRight className="inline size-3.5" />}{" "}
                {Math.abs(change).toFixed(0)}% vs last month ({yenCompact(d.lastMonth)})
              </span>
            )
          }
        />
        <StatCard
          label="Pending TT"
          value={money(d.pendingUsd, "$")}
          icon={Clock}
          tone="amber"
          href={can(user, "payments.view") ? "/admin/payments?status=pending" : undefined}
          hint={`${d.pendingCount} ${d.pendingCount === 1 ? "payment" : "payments"} waiting for approval`}
        />
        <StatCard
          label="Outstanding balance"
          value={
            d.outstanding.length ? (
              <span className="flex flex-col">
                {d.outstanding.map((o) => (
                  <span key={o.code} className={d.outstanding.length > 1 ? "text-base sm:text-lg" : undefined}>
                    {money(o.amount, o.symbol)}
                  </span>
                ))}
              </span>
            ) : (
              "None"
            )
          }
          icon={Scale}
          tone="red"
          hint="Reserved vehicles not yet fully paid"
        />
      </div>

      {fyTotals && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-4">
          <StatCard label={`Vehicles · ${fiscalYearLabel(fy)}`} value={fyTotals.units} icon={Car} href="/admin/finance/ledger" />
          <StatCard label="Sales this business year" value={yen(fyTotals.saleJpy)} icon={TrendingUp} tone="blue" href="/admin/finance" />
          <StatCard label="Costs this business year" value={yen(fyTotals.cost)} icon={Banknote} tone="slate" href="/admin/finance" />
          <StatCard
            label="Profit this business year"
            value={<span className={fyTotals.profit < 0 ? "text-accent-600" : "text-emerald-600"}>{yen(fyTotals.profit)}</span>}
            icon={TrendingUp}
            tone="green"
            href="/admin/finance"
            hint="Shown only to Finance access"
          />
        </div>
      )}

      <div className={shows("revenue") ? "mt-6 grid gap-6 xl:grid-cols-3" : "mt-6"}>
        {shows("revenue") && (
          <DashboardChart
            id="revenue"
            className="xl:col-span-2"
            title="Money received"
            description="Approved payments per month, last 12 months"
            points={d.months}
            unit="yen"
            initialType={prefs.types.revenue}
            averageWindow={3}
            averageLabel="3-month average"
            display={await getDisplay()}
          />
        )}

        <div className={shows("revenue") ? "grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-1" : "grid gap-3 sm:grid-cols-2 sm:gap-4"}>
          <StatCard
            label="Vehicles in stock"
            value={number(d.stock.total)}
            icon={Car}
            tone="blue"
            href={can(user, "stock.view") ? "/admin/stock" : undefined}
            hint={`${number(d.stock.total - d.stock.reserved)} available · ${number(d.stock.reserved)} reserved`}
          />
          <StatCard
            label="New inquiries"
            value={number(d.newInquiries)}
            icon={Inbox}
            tone="slate"
            href={can(user, "inquiries.view") ? "/admin/inquiries" : undefined}
            hint="Vehicle enquiries and contact messages not yet answered"
          />
        </div>
      </div>

      {(shows("inquiries") || shows("customers")) && (
        <div className={shows("inquiries") && shows("customers") ? "mt-6 grid gap-6 lg:grid-cols-2" : "mt-6"}>
          {shows("inquiries") && (
            <DashboardChart
              id="inquiries"
              title="Inquiries received"
              description="Vehicle enquiries and contact messages per day, last 30 days"
              points={inquirySeries}
              unit="count"
              initialType={prefs.types.inquiries}
              averageWindow={7}
              averageLabel="7-day average"
            />
          )}
          {shows("customers") && (
            <DashboardChart
              id="customers"
              title="New customers"
              description="Customer accounts added per month, last 12 months"
              points={customerSeries}
              unit="count"
              initialType={prefs.types.customers}
              averageWindow={3}
              averageLabel="3-month average"
            />
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={canApprove ? "Waiting for your approval" : "Waiting for the admin's approval"}
            description="TT payments your team recorded, oldest first. Approve once the money is in the bank."
            actions={
              can(user, "payments.view") && (
                <Link href="/admin/payments?status=pending" className="text-sm font-medium text-brand-600 hover:text-brand-800">
                  View all
                </Link>
              )
            }
          />
          {d.pending.length === 0 ? (
            <EmptyState icon={Clock} title="Nothing waiting" description="Every recorded payment has been approved or marked not received." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex-1 basis-40">
                    <Link href={`/admin/customers/${p.customer_id}`} className="truncate font-medium text-slate-900 hover:text-brand-700">
                      {p.customer}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <Badge tone={p.kind === "balance" ? "blue" : "slate"}>{p.kind === "balance" ? "Balance" : "Advance"}</Badge>
                      {p.recorded_by && (
                        <span>
                          Recorded by <span className="font-medium text-slate-700">{p.recorded_by}</span>
                          {p.recorded_role && ` (${p.recorded_role})`}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      Sent {date(p.payment_date)} · {p.description}
                      {p.file && (
                        <a href={`/admin/files/${p.file}`} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-brand-600 hover:underline">
                          <Paperclip className="size-3" /> TT copy
                        </a>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900 tabular-nums">{money(p.amount, "$")}</p>
                    <p className="text-xs text-slate-500 tabular-nums">{yen(p.in_yen)}</p>
                  </div>
                  {canApprove && (
                    <PaymentReview
                      status={p.status}
                      approve={approvePayment.bind(null, p.id)}
                      reject={rejectPayment.bind(null, p.id)}
                      undo={unapprovePayment.bind(null, p.id)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Highest balances"
            description="Customers who still owe the most"
            actions={
              can(user, "customers.view") && (
                <Link href="/admin/customers" className="text-sm font-medium text-brand-600 hover:text-brand-800">
                  All customers
                </Link>
              )
            }
          />
          {d.owing.length === 0 ? (
            <EmptyState icon={Scale} title="No open balances" description="Every reserved vehicle is fully paid." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.owing.map((c) => {
                const paidPct = Math.min(100, Math.round((Number(c.paid) / Number(c.owed)) * 100));
                return (
                  <li key={c.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <Link href={`/admin/customers/${c.id}`} className="truncate font-medium text-slate-900 hover:text-brand-700">
                          {c.name}
                        </Link>
                        <p className="truncate text-xs text-slate-500">{c.company || "—"}</p>
                      </div>
                      <p className="font-semibold text-slate-900 tabular-nums">{money(c.balance, c.symbol ?? "")}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
                      </div>
                      <span className="w-20 text-right text-xs text-slate-500">{paidPct}% paid</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Latest received payments" />
        {d.recent.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments yet" description="Approved payments will show up here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {d.recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
                <span className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 sm:flex">
                  <Wallet className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/customers/${p.customer_id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {p.customer}
                  </Link>
                  <p className="truncate text-xs text-slate-500">{p.description}</p>
                </div>
                <span className="hidden sm:inline-flex">
                  <Badge tone="green">Approved</Badge>
                </span>
                <div className="shrink-0 text-right sm:w-32">
                  <p className="font-semibold tabular-nums">{money(p.amount, "$")}</p>
                  <p className="text-xs text-slate-500">{date(p.payment_date)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
