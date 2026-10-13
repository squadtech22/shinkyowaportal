import type { Metadata } from "next";
import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import {
  AlertTriangle,
  Award,
  Bell,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  Ship,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import UpdatesFeed from "@/components/admin/UpdatesFeed";
import { Card, cx, EmptyState } from "@/components/admin/ui";
import { clientLogout } from "@/actions/client/auth";
import { loadCustomerAccount } from "@/lib/admin/customers";
import { date, dateTime, money } from "@/lib/admin/format";
import { shipmentStatus } from "@/lib/admin/shipments";
import { listUpdates, type CustomerUpdate } from "@/lib/admin/updates";
import { requireCustomer } from "@/lib/client/auth";
import { DOCUMENT_TYPES } from "@/lib/documents";
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipment-status";
import { stockImage } from "@/lib/stock";
import ChangePasswordForm from "./ChangePasswordForm";
import StatusSteps, { currentStep, paymentSteps, vehicleSteps } from "./VehicleProgress";

export const metadata: Metadata = { title: "My account" };

// Customer portal: the signed-in buyer's own account, one tab at a time.
// The tab lives in the URL (?tab=), so back/forward and links work.
const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "vehicles", label: "Vehicles", icon: Car },
  { key: "updates", label: "Updates", icon: Bell },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "account", label: "Account", icon: UserRound },
] as const;
type Tab = (typeof TABS)[number]["key"];

const tabHref = (tab: Tab) => (tab === "overview" ? "/client" : `/client?tab=${tab}`);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

type Row = RowDataPacket;
type Account = NonNullable<Awaited<ReturnType<typeof loadCustomerAccount>>>;

/** What each reserved vehicle needs for its card and its status. */
function vehicleView(car: Row, payments: Row[], symbol: string) {
  const cnf = Number(car.cnf ?? 0);
  const carPaid = Number(car.paid);
  const due = Math.max(cnf - carPaid, 0);
  const docs = DOCUMENT_TYPES.filter((d) => car[d.key]);
  const shipment = car.shipment_id ? shipmentStatus(car.etd, car.eta, car.shipment_status) : null;
  const steps = vehicleSteps({
    vessel: car.shipment_id ? car.vessel_name : null,
    shipment,
    etd: car.etd,
    eta: car.eta,
    docsReady: docs.length,
    docsTotal: DOCUMENT_TYPES.length,
  });
  const paySteps = paymentSteps(cnf, carPaid, payments.filter((p) => Number(p.stock_id) === Number(car.id)), symbol);
  const current = currentStep(steps);
  const payCurrent = currentStep(paySteps);
  return {
    cnf,
    carPaid,
    due,
    docs,
    shipment,
    steps,
    paySteps,
    /** Where the vehicle is now (null once everything is done). */
    stage: current === -1 ? null : steps[current].label,
    /** The payment step now, e.g. "Balance due" (null once paid in full). */
    payStage: payCurrent === -1 ? null : paySteps[payCurrent],
    img: stockImage(car.thumbnail),
  };
}

function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export default async function ClientDashboard({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireCustomer();
  const [data, updates, { tab: tabParam }] = await Promise.all([loadCustomerAccount(me.id), listUpdates(me.id), searchParams]);
  if (!data) return null;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "overview";
  const { customer: c, cars, payments } = data;
  const overdue = payments.filter((p) => p.alert);
  const badge: Partial<Record<Tab, number>> = { vehicles: cars.length, payments: overdue.length };

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 sm:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-brand-900">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/" className="shrink-0">
            <img src="/logo.png" alt="Shinkyowa International" className="h-7 w-auto sm:h-8" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-amber-300 sm:inline-flex">
              <Award className="size-3.5" /> {Number(c.points)} points
            </span>
            <Link href={tabHref("account")} className="flex items-center gap-2 rounded-full bg-white/10 p-1 hover:bg-white/15 sm:pr-3">
              <span className="flex size-7 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-900">
                {initials(String(c.name))}
              </span>
              <span className="hidden max-w-40 truncate text-sm font-medium text-white sm:block">{c.name}</span>
            </Link>
            <form action={clientLogout}>
              <button
                className="flex size-9 items-center justify-center rounded-lg text-brand-100 hover:bg-white/10 hover:text-white sm:w-auto sm:gap-1.5 sm:px-3"
                aria-label="Sign out"
              >
                <LogOut className="size-4" /> <span className="hidden text-sm font-medium sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
        {/* Tabs: across the top from sm (on phones they sit at the bottom). */}
        <nav className="hidden border-t border-white/10 sm:block" aria-label="Sections">
          <div className="mx-auto flex max-w-6xl gap-1 px-5">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={cx(
                  "relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition",
                  tab === t.key ? "text-white" : "text-brand-200 hover:text-white",
                )}
              >
                <t.icon className="size-4" /> {t.label}
                {Boolean(badge[t.key]) && (
                  <span
                    className={cx(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      t.key === "payments" ? "bg-accent-600 text-white" : "bg-white/15",
                    )}
                  >
                    {badge[t.key]}
                  </span>
                )}
                {tab === t.key && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-white" />}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {tab === "overview" && <Overview account={data} updates={updates} />}
        {tab === "vehicles" && <Vehicles account={data} />}
        {tab === "updates" && (
          <>
            <PageTitle title="Updates" description="News about your vehicles, shipping, documents and payments" />
            <Card>
              <UpdatesFeed updates={updates} audience="customer" />
            </Card>
          </>
        )}
        {tab === "payments" && <Payments account={data} />}
        {tab === "account" && <AccountTab account={data} />}
      </main>

      {/* Bottom tab bar on phones */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        aria-label="Sections"
      >
        <div className="grid grid-cols-5">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={cx(
                "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                tab === t.key ? "text-brand-700" : "text-slate-500",
              )}
            >
              {tab === t.key && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-brand-700" />}
              <span className="relative">
                <t.icon className="size-5" />
                {Boolean(badge[t.key]) && t.key === "payments" && (
                  <span className="absolute -top-1 -right-2 flex size-4 items-center justify-center rounded-full bg-accent-600 text-[10px] text-white">
                    {badge[t.key]}
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* ---------------------------------------------------------------- Overview */

function Overview({ account, updates }: { account: Account; updates: CustomerUpdate[] }) {
  const { customer: c, cars, payments } = account;
  const symbol = c.symbol ?? "";
  const owed = Number(c.owed);
  const paid = Number(c.paid);
  const pending = Number(c.pending);
  const balance = Math.max(owed - paid, 0);
  const pct = owed > 0 ? Math.min(100, Math.round((paid / owed) * 100)) : 0;
  const overdue = payments.filter((p) => p.alert);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Welcome back</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{c.name}</h1>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {[
            { label: "Total (CNF)", value: money(owed, symbol), cls: "text-slate-900" },
            { label: "Paid", value: money(paid, symbol), cls: "text-emerald-600" },
            { label: "Being confirmed", value: money(pending, symbol), cls: pending ? "text-amber-600" : "text-slate-400" },
            { label: "Still to pay", value: money(balance, symbol), cls: balance ? "text-accent-600" : "text-emerald-600" },
          ].map((s, i) => (
            <div
              key={s.label}
              className={cx(
                "border-slate-100 px-4 py-4 sm:px-6 sm:py-5",
                // 2×2 on phones, one row from sm: lines between the cells only.
                i < 2 && "border-b sm:border-b-0",
                i % 2 === 0 && "border-r sm:border-r-0",
                i > 0 && "sm:border-l",
              )}
            >
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <p className={cx("mt-1 text-lg font-semibold tabular-nums sm:text-2xl", s.cls)}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 px-4 py-3.5 sm:px-6">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">Payment progress</span>
            <span className="font-semibold text-slate-900 tabular-nums">{pct}% paid</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {overdue.length > 0 && (
          <Link href={tabHref("payments")} className="flex items-start gap-2.5 border-t border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700 sm:px-6">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span className="flex-1">
              <span className="font-semibold">Payment overdue.</span>{" "}
              {overdue.length === 1
                ? `${money(Number(overdue[0].balance_remaining), "$")} was due ${dateTime(overdue[0].pending_due_at)}.`
                : `${overdue.length} balances are past their due date.`}{" "}
              Please pay or contact your sales agent.
            </span>
            <ChevronRight className="mt-0.5 size-4 shrink-0" />
          </Link>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Vehicles at a glance */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <h2 className="font-semibold text-slate-900">Your vehicles</h2>
              <Link href={tabHref("vehicles")} className="text-sm font-medium text-brand-700 hover:text-brand-800">View all</Link>
            </div>
            {cars.length === 0 ? (
              <EmptyState icon={Car} title="No vehicles reserved yet" description="Vehicles your agent reserves for you appear here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {cars.map((car) => {
                  const v = vehicleView(car, payments, symbol);
                  return (
                    <li key={car.id}>
                      <Link href={tabHref("vehicles")} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                        <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {v.img ? <img src={v.img} alt="" className="size-full object-cover" /> : <Car className="m-auto mt-3 size-6 text-slate-300" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {car.year} {car.make} {car.model}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-medium">
                            <span className={cx("rounded-full px-2 py-0.5", v.stage ? "bg-brand-50 text-brand-700" : "bg-emerald-50 text-emerald-700")}>
                              <Car className="mr-1 inline size-3" />
                              {v.stage ?? "Delivered"}
                            </span>
                            <span
                              className={cx(
                                "rounded-full px-2 py-0.5",
                                !v.payStage ? "bg-emerald-50 text-emerald-700" : v.payStage.alert ? "bg-accent-50 text-accent-700" : "bg-amber-50 text-amber-700",
                              )}
                            >
                              <Wallet className="mr-1 inline size-3" />
                              {v.payStage ? `${v.payStage.label}${v.due > 0 ? ` · ${money(v.due, symbol)}` : ""}` : "Paid in full"}
                            </span>
                          </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-slate-400" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Latest updates */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <h2 className="font-semibold text-slate-900">Latest updates</h2>
              {updates.length > 3 && (
                <Link href={tabHref("updates")} className="text-sm font-medium text-brand-700 hover:text-brand-800">View all</Link>
              )}
            </div>
            <UpdatesFeed updates={updates.slice(0, 3)} audience="customer" />
          </Card>
        </div>

        <AgentCard account={account} />
      </div>
    </div>
  );
}

function AgentCard({ account: { customer: c } }: { account: Account }) {
  const whatsapp = c.agent_phone ? String(c.agent_phone).replace(/\D/g, "") : "";
  return (
    <div className="min-w-0 space-y-6">
      <Card className="p-5">
        <p className="text-xs font-medium text-slate-500">Your sales agent</p>
        <p className="mt-0.5 text-base font-semibold text-slate-900">{c.agent ?? "Shinkyowa International"}</p>
        <p className="text-xs text-slate-500">Questions about your order? Get in touch.</p>
        <div className="mt-4 grid gap-2">
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          )}
          <div className="grid grid-cols-2 gap-2">
            {c.agent_phone && (
              <a href={`tel:${c.agent_phone}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Phone className="size-4" /> Call
              </a>
            )}
            {c.agent_email && (
              <a
                href={`mailto:${c.agent_email}`}
                className={cx(
                  "flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50",
                  !c.agent_phone && "col-span-2",
                )}
              >
                <Mail className="size-4" /> Email
              </a>
            )}
          </div>
        </div>
      </Card>
      <Card className="flex items-center gap-4 p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
          <Award className="size-5" />
        </span>
        <div>
          <p className="text-xl font-semibold tabular-nums">{Number(c.points)} points</p>
          <p className="text-xs text-slate-500">Earned with every vehicle you reserve</p>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- Vehicles */

function Vehicles({ account: { customer: c, cars, payments } }: { account: Account }) {
  const symbol = c.symbol ?? "";
  return (
    <>
      <PageTitle title="Your vehicles" description="Where each vehicle is, its shipping and its export documents" />
      {cars.length === 0 ? (
        <Card>
          <EmptyState icon={Car} title="No vehicles reserved yet" description="Vehicles your agent reserves for you appear here." />
        </Card>
      ) : (
        <div className="space-y-5">
          {cars.map((car) => {
            const v = vehicleView(car, payments, symbol);
            return (
              <Card key={car.id} className="overflow-hidden">
                <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <div className="relative aspect-[16/10] bg-slate-100 md:aspect-auto md:min-h-56">
                    {v.img ? (
                      <img src={v.img} alt={`${car.year} ${car.make} ${car.model}`} className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <Car className="absolute inset-0 m-auto size-12 text-slate-300" />
                    )}
                    <span
                      className={cx(
                        "absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm",
                        v.stage ? "bg-white/95 text-brand-800" : "bg-emerald-500 text-white",
                      )}
                    >
                      {v.stage ? `Now: ${v.stage}` : "✓ Delivered"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="p-4 sm:p-5">
                      <h3 className="text-lg leading-snug font-semibold text-slate-900">
                        {car.year} {car.make} {car.model}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        SKI-{car.sid} · Chassis {car.chassis}
                      </p>
                    </div>
                    {/* Money lives on the Payments tab; here just where the payment stands. */}
                    <Link
                      href={tabHref("payments")}
                      className={cx(
                        "mt-auto flex items-center gap-3 border-t px-4 py-3 text-sm sm:px-5",
                        !v.payStage
                          ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                          : v.payStage.alert
                            ? "border-accent-100 bg-accent-50 text-accent-700"
                            : "border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100",
                      )}
                    >
                      <Wallet className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">Payment: </span>
                        {v.payStage ? `${v.payStage.label} — ${v.payStage.detail}` : "Paid in full"}
                      </span>
                      <ChevronRight className="size-4 shrink-0 opacity-60" />
                    </Link>
                  </div>
                </div>

                <div className="border-t border-slate-100 px-4 py-4 sm:px-5 sm:py-5">
                  <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Vehicle status</p>
                  <StatusSteps steps={v.steps} />
                </div>

                <div className="grid border-t border-slate-100 sm:grid-cols-2">
                  <div className="px-4 py-4 sm:px-5">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <Ship className="size-3.5" /> Shipping
                    </p>
                    {car.shipment_id ? (
                      <div className="text-sm">
                        <p className="font-medium text-slate-900">{car.vessel_name}</p>
                        <p className="mt-0.5 text-xs font-medium text-brand-700">{SHIPMENT_STATUS_LABELS[v.shipment!]}</p>
                        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                            <dt className="text-slate-500">Departs Japan</dt>
                            <dd className="font-semibold text-slate-900">{date(car.etd)}</dd>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                            <dt className="text-slate-500">Arrives</dt>
                            <dd className="font-semibold text-slate-900">{date(car.eta)}</dd>
                          </div>
                        </dl>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Not booked on a vessel yet. We will update you once it is.</p>
                    )}
                  </div>
                  <div className="border-t border-slate-100 px-4 py-4 sm:border-t-0 sm:border-l sm:px-5">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <FileText className="size-3.5" /> Documents · {v.docs.length}/{DOCUMENT_TYPES.length}
                    </p>
                    {v.docs.length === 0 ? (
                      <p className="text-sm text-slate-500">Documents will appear here once they are ready.</p>
                    ) : (
                      <ul className="grid gap-1.5">
                        {v.docs.map((d) => (
                          <li key={d.key}>
                            <a
                              href={`/client/files/${car[d.key]}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-brand-200 hover:bg-brand-50"
                            >
                              <span className="truncate">{d.label}</span>
                              <Download className="size-4 shrink-0 text-brand-600" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- Payments */

function Payments({ account: { customer: c, cars, payments } }: { account: Account }) {
  const symbol = c.symbol ?? "";
  const owed = Number(c.owed);
  const balance = Math.max(owed - Number(c.paid), 0);
  return (
    <>
      <PageTitle title="Payments" description="Advance, balance due and done for each vehicle, and every payment you sent" />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card className="px-4 py-3">
          <p className="text-xs font-medium text-slate-500">Paid</p>
          <p className="text-lg font-semibold text-emerald-600 tabular-nums">{money(Number(c.paid), symbol)}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs font-medium text-slate-500">Still to pay</p>
          <p className={cx("text-lg font-semibold tabular-nums", balance ? "text-accent-600" : "text-emerald-600")}>{money(balance, symbol)}</p>
        </Card>
      </div>

      {cars.length > 0 && (
        <div className="mb-8 space-y-4">
          <h3 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">Payment status per vehicle</h3>
          {cars.map((car) => {
            const v = vehicleView(car, payments, symbol);
            return (
              <Card key={car.id} className="overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <span className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {v.img && <img src={v.img} alt="" className="size-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">
                      {car.year} {car.make} {car.model}
                    </span>
                    <span className="block text-xs text-slate-500">SKI-{car.sid}</span>
                  </span>
                  {!v.payStage && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="size-3.5" /> Paid
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-3 border-t border-slate-100 text-center">
                  {[
                    { label: "Price", value: money(v.cnf, symbol), cls: "text-slate-900" },
                    { label: "Paid", value: money(v.carPaid, symbol), cls: "text-emerald-600" },
                    { label: "To pay", value: money(v.due, symbol), cls: v.due > 0 ? "text-accent-600" : "text-emerald-600" },
                  ].map((s, i) => (
                    <div key={s.label} className={cx("px-2 py-3", i > 0 && "border-l border-slate-100")}>
                      <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{s.label}</dt>
                      <dd className={cx("mt-0.5 text-sm font-semibold tabular-nums sm:text-base", s.cls)}>{s.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="border-t border-slate-100 px-4 py-4 sm:px-5 sm:py-5">
                  <StatusSteps steps={v.paySteps} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <h3 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">All payments</h3>
      {payments.length === 0 ? (
        <Card>
          <EmptyState icon={Wallet} title="No payments yet" description="Payments you send appear here once your agent records them." />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {payments.map((p) => {
              const status =
                p.status === "approved"
                  ? { label: "Received", cls: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 }
                  : p.status === "rejected"
                    ? { label: "Not received yet", cls: "bg-accent-50 text-accent-700", icon: XCircle }
                    : { label: "Being confirmed", cls: "bg-amber-50 text-amber-700", icon: Clock };
              return (
                <li key={p.id} className={cx("px-4 py-4 sm:px-5", p.alert && "bg-accent-50/50")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-900">
                        <span
                          className={cx(
                            "rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase",
                            p.kind === "balance" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {p.kind === "balance" ? "Balance" : "Advance"}
                        </span>
                        <span className="truncate">{p.description}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Sent {date(p.payment_date)}
                        {p.sid ? ` · SKI-${p.sid}` : ""}
                        {p.payment_recieved_date && p.status === "approved" ? ` · Received ${date(p.payment_recieved_date)}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-semibold text-slate-900 tabular-nums">{money(p.amount, "$")}</p>
                      <span className={cx("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", status.cls)}>
                        <status.icon className="size-3" /> {status.label}
                      </span>
                    </div>
                  </div>
                  {(p.status === "rejected" && p.reject_reason) || p.file || p.balance_state ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                      {p.status === "rejected" && p.reject_reason && (
                        <span className="rounded-lg bg-accent-50 px-2.5 py-1.5 text-accent-700">{p.reject_reason}</span>
                      )}
                      {p.balance_state === "done" && (
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 font-medium text-emerald-700">
                          Balance of {money(Number(p.pending_amount), "$")} paid ✓
                        </span>
                      )}
                      {(p.balance_state === "open" || p.balance_state === "sent") && (
                        <span
                          className={cx(
                            "rounded-lg px-2.5 py-1.5 font-medium",
                            p.balance_state === "sent"
                              ? "bg-amber-50 text-amber-800"
                              : p.alert
                                ? "bg-accent-100 text-accent-700"
                                : "bg-slate-100 text-slate-700",
                          )}
                        >
                          {p.balance_state === "sent"
                            ? "Balance payment being confirmed"
                            : `Balance ${money(Number(p.balance_remaining), "$")} due ${dateTime(p.pending_due_at)}${p.alert ? " · overdue" : ""}`}
                        </span>
                      )}
                      {p.file && (
                        <a
                          href={`/client/files/${p.file}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-brand-700 hover:bg-brand-50"
                        >
                          <Paperclip className="size-3" /> TT copy
                        </a>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- Account */

function AccountTab({ account }: { account: Account }) {
  const { customer: c } = account;
  const rows = [
    { label: "Name", value: c.name },
    { label: "Customer number", value: c.cid },
    { label: "Company", value: c.company },
    { label: "Email", value: c.email },
    { label: "Phone", value: c.phone },
    { label: "Country", value: c.country },
  ].filter((r) => r.value);
  return (
    <>
      <PageTitle title="Account" description="Your details, your sales agent and your password" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
              <span className="flex size-12 items-center justify-center rounded-full bg-brand-800 text-base font-bold text-white">
                {initials(String(c.name))}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{c.name}</p>
                <p className="text-sm text-slate-500">Customer {c.cid}</p>
              </div>
            </div>
            <dl className="divide-y divide-slate-100">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm sm:px-5">
                  <dt className="text-slate-500">{r.label}</dt>
                  <dd className="min-w-0 truncate text-right font-medium text-slate-900">{r.value}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
              Need to change these details? Ask your sales agent.
            </p>
          </Card>
          <Card>
            <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <h2 className="font-semibold text-slate-900">Change password</h2>
              <p className="text-xs text-slate-500">You sign in at /login with {c.email}</p>
            </div>
            <ChangePasswordForm />
          </Card>
        </div>
        <AgentCard account={account} />
      </div>
      <form action={clientLogout} className="mt-6 sm:hidden">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700">
          <LogOut className="size-4" /> Sign out
        </button>
      </form>
    </>
  );
}
