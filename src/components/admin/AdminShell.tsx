"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BadgePercent,
  BookOpen,
  Car,
  CarFront,
  ChevronDown,
  FileText,
  Globe,
  HandCoins,
  Inbox,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Ship,
  Tags,
  TrendingUp,
  UserCheck,
  UserCircle,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/actions/admin/auth";
import { cx } from "./ui";

export type NavKey =
  | "dashboard" | "finance" | "ledger" | "japan" | "stock" | "customers" | "payments" | "reserved" | "inquiries" | "shipments" | "documents" | "website"
  | "catalog" | "approvals" | "users" | "roles" | "commissions" | "mycommission";

/** Entries of the "+ New" menu; the layout only passes the ones the user may use. */
export type QuickAction = "vehicle" | "customer" | "payment" | "shipment" | "japanPayment" | "user";

type NavItem = { key: NavKey; label: string; short: string; href: string; icon: LucideIcon };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [{ key: "dashboard", label: "Dashboard", short: "Home", href: "/admin", icon: LayoutDashboard }],
  },
  {
    section: "Sales",
    items: [
      { key: "stock", label: "Stock", short: "Stock", href: "/admin/stock", icon: Car },
      { key: "customers", label: "Customers", short: "Customers", href: "/admin/customers", icon: Users },
      { key: "payments", label: "Payments", short: "Payments", href: "/admin/payments", icon: Wallet },
      { key: "reserved", label: "Reserved vehicles", short: "Reserved", href: "/admin/reserved", icon: CarFront },
      { key: "inquiries", label: "Inquiries", short: "Inquiries", href: "/admin/inquiries", icon: Inbox },
    ],
  },
  {
    section: "Finance",
    items: [
      { key: "finance", label: "Profit report", short: "Profit", href: "/admin/finance", icon: TrendingUp },
      { key: "ledger", label: "Purchase ledger", short: "Ledger", href: "/admin/finance/ledger", icon: BookOpen },
      { key: "japan", label: "Japan payments", short: "Japan", href: "/admin/finance/japan-payments", icon: Landmark },
      { key: "commissions", label: "Commissions", short: "Comm.", href: "/admin/commissions", icon: HandCoins },
    ],
  },
  {
    section: "Logistics",
    items: [
      { key: "shipments", label: "Shipments", short: "Ships", href: "/admin/shipments", icon: Ship },
      { key: "documents", label: "Documents", short: "Docs", href: "/admin/documents", icon: FileText },
    ],
  },
  {
    section: "Website",
    items: [
      { key: "website", label: "Website content", short: "Website", href: "/admin/website", icon: Globe },
      { key: "catalog", label: "Catalog lists", short: "Catalog", href: "/admin/catalog", icon: Tags },
    ],
  },
  {
    section: "Team",
    items: [
      { key: "approvals", label: "Approvals", short: "Approvals", href: "/admin/approvals", icon: UserCheck },
      { key: "users", label: "Users", short: "Users", href: "/admin/users", icon: UserCog },
      { key: "roles", label: "Roles & permissions", short: "Roles", href: "/admin/roles", icon: ShieldCheck },
    ],
  },
  {
    section: "Me",
    items: [{ key: "mycommission", label: "My commission", short: "Earnings", href: "/admin/my-commission", icon: BadgePercent }],
  },
];

const QUICK: Record<QuickAction, { label: string; href: string; icon: LucideIcon }> = {
  vehicle: { label: "Add vehicle", href: "/admin/stock/new", icon: Car },
  customer: { label: "Add customer", href: "/admin/customers/new", icon: Users },
  payment: { label: "Record payment", href: "/admin/payments/new", icon: Wallet },
  shipment: { label: "Add shipment", href: "/admin/shipments/new", icon: Ship },
  japanPayment: { label: "Record Japan payment", href: "/admin/finance/japan-payments/new", icon: Landmark },
  user: { label: "Add user", href: "/admin/users/new", icon: UserPlus },
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Closes a popover when clicking anywhere else. */
function useDismiss(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open, close]);
}

function Badge({ count, dot }: { count?: number; dot?: boolean }) {
  if (!count) return null;
  if (dot) return <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent-500 ring-2 ring-brand-900" />;
  return (
    <span className="ml-auto rounded-full bg-accent-600 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function AdminShell({
  user,
  allowed,
  badges,
  quickActions,
  children,
}: {
  user: { name: string; email: string; roleName: string };
  allowed: NavKey[];
  badges: Partial<Record<NavKey, number>>;
  quickActions: QuickAction[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [newMenu, setNewMenu] = useState(false);

  // Close every popover after navigating.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setDrawer(false);
    setUserMenu(false);
    setNewMenu(false);
  }
  useDismiss(userMenu, () => setUserMenu(false));
  useDismiss(newMenu, () => setNewMenu(false));

  // Lock page scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  // The longest matching href wins, so /admin/finance/ledger does not also
  // highlight /admin/finance.
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}.`);
  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : under(href) && !NAV.some((s) => s.items.some((i) => i.href.length > href.length && i.href.startsWith(href) && under(i.href)));
  const sections = NAV.map((s) => ({ ...s, items: s.items.filter((i) => allowed.includes(i.key)) })).filter(
    (s) => s.items.length,
  );
  const items = sections.flatMap((s) => s.items);
  const current = items.find((i) => isActive(i.href));
  // Phone tab bar: the first four sections the user has, plus "Menu".
  const tabs = items.slice(0, 4);

  /** Full sidebar (desktop and mobile drawer). */
  const fullNav = (
    <div className="flex h-full flex-col bg-brand-900 text-brand-100">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link href="/admin" className="block">
          <img src="/logo.png" alt="Shinkyowa" className="h-8 w-auto" />
        </Link>
        <button className="rounded-lg p-1.5 text-brand-300 hover:bg-white/10 lg:hidden" onClick={() => setDrawer(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <nav className="scrollbar-dark flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.section}>
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-brand-400 uppercase">{section.section}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                        active ? "bg-white/10 text-white" : "text-brand-200 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-accent-500" />}
                      <item.icon className={cx("size-[18px]", active ? "text-white" : "text-brand-300 group-hover:text-brand-100")} />
                      <span>{item.label}</span>
                      <Badge count={badges[item.key]} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-200 hover:bg-white/5 hover:text-white">
          <Globe className="size-[18px] text-brand-300" />
          View website
        </Link>
        <Link href="/admin/profile" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
            {initials(user.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">{user.name}</span>
            <span className="block truncate text-xs text-brand-300">{user.roleName}</span>
          </span>
        </Link>
      </div>
    </div>
  );

  /** Icon rail for tablets (768–1023px). */
  const rail = (
    <div className="flex h-full flex-col items-center bg-brand-900 py-3">
      {/* The "SK" mark: the left part of the logo image */}
      <Link href="/admin" className="mb-4 flex h-11 w-12 items-center justify-center" title="Dashboard">
        <span className="block h-7 w-9 overflow-hidden">
          <img src="/logo.png" alt="Shinkyowa" className="h-7 w-auto max-w-none" />
        </span>
      </Link>
      <nav className="scrollbar-dark flex flex-1 flex-col items-center gap-1 overflow-y-auto">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group relative flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition",
                active ? "bg-white/10 text-white" : "text-brand-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className="size-5" />
              <span className="leading-none">{item.short}</span>
              <Badge count={badges[item.key]} dot />
            </Link>
          );
        })}
      </nav>
      <Link href="/" title="View website" className="flex size-11 items-center justify-center rounded-xl text-brand-300 hover:bg-white/5 hover:text-white">
        <Globe className="size-5" />
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[84px] md:block lg:hidden">{rail}</aside>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{fullNav}</aside>

      {/* Phone/tablet drawer with the full menu */}
      <div className={cx("fixed inset-0 z-50 lg:hidden", drawer ? "visible" : "invisible")} aria-hidden={!drawer}>
        <div className={cx("absolute inset-0 bg-black/50 transition-opacity", drawer ? "opacity-100" : "opacity-0")} onClick={() => setDrawer(false)} />
        <aside className={cx("absolute inset-y-0 left-0 w-[min(18rem,85vw)] shadow-2xl transition-transform duration-200", drawer ? "translate-x-0" : "-translate-x-full")}>
          {fullNav}
        </aside>
      </div>

      <div className="md:pl-[84px] lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200/80 bg-surface/90 px-3 backdrop-blur sm:h-16 sm:px-6">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 md:text-base">{current?.label ?? "Shinkyowa Admin"}</p>
          </div>

          {quickActions.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNewMenu((o) => !o);
                  setUserMenu(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
                aria-expanded={newMenu}
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">New</span>
                <ChevronDown className="hidden size-3.5 opacity-70 sm:block" />
              </button>
              {newMenu && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-surface p-1.5 shadow-lg" onClick={(e) => e.stopPropagation()}>
                  {quickActions.map((key) => {
                    const a = QUICK[key];
                    return (
                      <Link key={key} href={a.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                        <a.icon className="size-4 text-slate-400" /> {a.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUserMenu((o) => !o);
                setNewMenu(false);
              }}
              className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-100 sm:gap-3 sm:py-1.5 sm:pr-2 sm:pl-1.5"
              aria-label="Account menu"
              aria-expanded={userMenu}
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-800 text-xs font-semibold text-white sm:size-9 sm:text-sm">
                {initials(user.name)}
              </span>
              <span className="hidden text-left lg:block">
                <span className="block text-sm leading-tight font-medium text-slate-900">{user.name}</span>
                <span className="block text-xs leading-tight text-slate-500">{user.roleName}</span>
              </span>
            </button>
            {userMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-surface p-1.5 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                  <p className="mt-1 text-xs text-brand-600">{user.roleName}</p>
                </div>
                <div className="my-1 border-t border-slate-100" />
                <Link href="/admin/profile" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <UserCircle className="size-4" /> My profile
                </Link>
                <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <Globe className="size-4" /> View website
                </Link>
                <form action={logout}>
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-accent-600 hover:bg-accent-50">
                    <LogOut className="size-4" /> Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pt-5 pb-28 sm:px-6 md:pb-10 lg:px-8 lg:pt-8">{children}</main>
      </div>

      {/* Phone tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
          {tabs.map((item) => {
            const active = isActive(item.href);
            const count = badges[item.key];
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium", active ? "text-brand-800" : "text-slate-500")}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-accent-600" />}
                <span className="relative">
                  <item.icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                  {!!count && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-accent-600 px-1 text-center text-[10px] leading-4 font-semibold text-white">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </span>
                {item.short}
              </Link>
            );
          })}
          <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium text-slate-500">
            <Menu className="size-[22px]" strokeWidth={1.8} />
            Menu
          </button>
        </div>
      </nav>
    </div>
  );
}
