// Display helpers shared by admin server and client components.

export const yen = (n: number) => `¥${Math.round(n).toLocaleString("en-US")}`;

/** ¥12.4M / ¥830K style for chart axes and tight spaces. */
export function yenCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `¥${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `¥${Math.round(n / 1_000)}K`;
  return `¥${Math.round(n)}`;
}

export const money = (n: number, symbol = "$") => `${symbol}${Math.round(n).toLocaleString("en-US")}`;

export const number = (n: number) => Math.round(n).toLocaleString("en-US");

export const DISPLAY_CURRENCIES = ["USD", "PKR"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/**
 * The signed-in user's display currency and the exchange rates: units of a
 * currency per 1 USD, keyed by both code and symbol ("JPY" and "¥" → 150).
 * Plain data, so server pages can pass it to client components.
 */
export type Display = { currency: DisplayCurrency; rates: Record<string, number> };

/**
 * yen()/money()/yenCompact() that convert to the user's display currency.
 * Stored amounts are unchanged; only what is shown is converted. A currency
 * without a rate is shown as it is.
 */
export function formatters({ currency, rates }: Display) {
  const prefix = currency === "PKR" ? "Rs " : "$";
  const target = rates[currency] ?? 1;
  const convert = (n: number, from: string) => {
    const rate = rates[from || "USD"];
    return rate ? (n / rate) * target : null;
  };
  const show = (v: number) => {
    const r = Math.round(v);
    return `${r < 0 ? "-" : ""}${prefix}${Math.abs(r).toLocaleString("en-US")}`;
  };
  const compact = (v: number) => {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    const short = (d: number, unit: string) => `${sign}${prefix}${(abs / d).toFixed(abs >= d * 10 ? 0 : 1).replace(/\.0$/, "")}${unit}`;
    if (abs >= 1e9) return short(1e9, "B");
    if (abs >= 1e6) return short(1e6, "M");
    if (abs >= 1e3) return short(1e3, "K");
    return show(v);
  };
  return {
    currency,
    /** A yen amount as a number in the display currency (for charts). */
    fromYen: (n: number) => convert(n, "JPY") ?? n,
    /** Formats a number already in the display currency. */
    amount: show,
    amountCompact: compact,
    yen: (n: number) => {
      const v = convert(n, "JPY");
      return v === null ? yen(n) : show(v);
    },
    yenCompact: (n: number) => {
      const v = convert(n, "JPY");
      return v === null ? yenCompact(n) : compact(v);
    },
    money: (n: number, symbol = "$") => {
      const v = convert(n, symbol);
      return v === null ? money(n, symbol) : show(v);
    },
  };
}

export function date(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** YYYY-MM-DD for <input type="date"> from a DATE column (mysql2 returns Date objects). */
export function isoDate(value: Date | string | null | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** YYYY-MM-DDTHH:MM for <input type="datetime-local"> from a DATETIME column. */
export function isoDateTime(value: Date | string | null | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 16).replace(" ", "T");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${isoDate(value)}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
