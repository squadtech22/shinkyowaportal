import Link from "next/link";
import { Search, type LucideIcon } from "lucide-react";

// Presentational building blocks for admin pages (server-component safe).

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-slate-200/80 bg-surface shadow-sm shadow-slate-900/[0.03]", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

const TONES = {
  brand: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-accent-50 text-accent-600",
  blue: "bg-sky-50 text-sky-700",
  slate: "bg-slate-100 text-slate-600",
} as const;

export type Tone = keyof typeof TONES;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <Card className={cx("h-full p-4 sm:p-5", href && "transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md")}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
          <div className="mt-1.5 text-lg font-semibold tracking-tight text-slate-900 tabular-nums sm:mt-2 sm:text-2xl">{value}</div>
        </div>
        <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-10 sm:rounded-xl", TONES[tone])}>
          <Icon className="size-4 sm:size-5" strokeWidth={2} />
        </span>
      </div>
      {hint && <div className="mt-2 text-[11px] leading-snug text-slate-500 sm:mt-3 sm:text-xs">{hint}</div>}
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function Badge({ tone = "slate", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone])}>
      {children}
    </span>
  );
}

const BUTTONS = {
  primary: "bg-brand-800 text-white hover:bg-brand-700 shadow-sm",
  accent: "bg-accent-600 text-white hover:bg-accent-700 shadow-sm",
  secondary: "bg-surface text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-surface text-accent-600 border border-accent-100 hover:bg-accent-50",
} as const;

export type ButtonVariant = keyof typeof BUTTONS;

export const buttonClass = (variant: ButtonVariant = "primary", size: "sm" | "md" = "md") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
    size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
    BUTTONS[variant],
  );

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon: Icon,
  children,
  external,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: LucideIcon;
  children: React.ReactNode;
  external?: boolean;
}) {
  const content = (
    <>
      {Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} />}
      {children}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={buttonClass(variant, size)}>
      {content}
    </a>
  ) : (
    <Link href={href} className={buttonClass(variant, size)}>
      {content}
    </Link>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Data table. From 768px up it is a normal table (scrolling sideways if it
 * must); below that each row becomes a card (see .rtable in admin.css), so
 * give every <Td> except the title cell a `label`.
 */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    // relative: absolutely positioned children (e.g. sr-only labels) stay
    // inside the scroll box instead of widening the page.
    <div className="relative overflow-x-auto">
      <table className="rtable w-full text-left text-sm md:min-w-[680px]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cx("border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500", className)}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  label,
  actions,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Column name shown beside the value in the mobile card layout. */
  label?: string;
  /** Action buttons cell: right-aligned row at the bottom of the mobile card. */
  actions?: boolean;
}) {
  return (
    <td data-label={label} className={cx("border-b border-slate-100 px-4 py-3 align-middle", actions && "rtable-actions", className)}>
      {children}
    </td>
  );
}

/** Tab bar made of links (state lives in the URL). */
export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cx(
            "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition",
            t.key === active ? "bg-surface text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cx("rounded-full px-1.5 text-xs", t.key === active ? "bg-brand-50 text-brand-700" : "bg-slate-300/60")}>
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function Pager({
  page,
  lastPage,
  total,
  hrefFor,
}: {
  page: number;
  lastPage: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (lastPage <= 1) return <p className="px-5 py-3 text-xs text-slate-500">{total} total</p>;
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
      <p className="text-xs text-slate-500">
        Page {page} of {lastPage} · {total} total
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={buttonClass("secondary", "sm")}>Previous</Link>
        ) : (
          <span className={cx(buttonClass("secondary", "sm"), "pointer-events-none opacity-50")}>Previous</span>
        )}
        {page < lastPage ? (
          <Link href={hrefFor(page + 1)} className={buttonClass("secondary", "sm")}>Next</Link>
        ) : (
          <span className={cx(buttonClass("secondary", "sm"), "pointer-events-none opacity-50")}>Next</span>
        )}
      </div>
    </div>
  );
}

/** GET search form that keeps other query params as hidden fields. */
export function SearchBar({
  placeholder,
  value,
  keep = {},
  children,
}: {
  placeholder: string;
  value?: string;
  keep?: Record<string, string | undefined>;
  children?: React.ReactNode;
}) {
  return (
    <form className="flex w-full gap-2 sm:max-w-md">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input name="q" type="search" defaultValue={value} placeholder={placeholder} className="input-base pl-9" />
      </div>
      {children}
      <button className={buttonClass("secondary")}>Search</button>
    </form>
  );
}
