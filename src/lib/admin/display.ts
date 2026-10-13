import "server-only";
import { cache } from "react";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { getCurrentUser } from "./auth";
import { formatters, type Display } from "./format";

/** Units per 1 USD until someone sets the real rate under Finance. */
export const DEFAULT_RATES: Record<string, number> = { JPY: 150, PKR: 280, EUR: 0.92, GBP: 0.79 };

/** Exchange rates are stored in `settings` as fx_<code> (units per 1 USD). */
export const rateKey = (code: string) => `fx_${code.toLowerCase()}`;

/** Every currency that needs a rate: the currencies table (except USD) plus PKR. */
export const getRates = cache(async () => {
  const [currencies] = await db.query<RowDataPacket[]>("SELECT symbol, code FROM currencies ORDER BY id");
  const [settings] = await db.query<RowDataPacket[]>("SELECT `key`, value FROM settings WHERE `key` LIKE 'fx\\_%'");
  const stored = new Map(settings.map((r) => [String(r.key), Number(r.value)]));
  const list = [
    ...currencies.map((c) => ({ code: String(c.code).toUpperCase(), symbol: String(c.symbol) })),
    { code: "PKR", symbol: "Rs" },
  ]
    .filter((c) => c.code !== "USD")
    .map((c) => {
      const value = stored.get(rateKey(c.code));
      return { ...c, rate: value && value > 0 ? value : (DEFAULT_RATES[c.code] ?? null), saved: Boolean(value && value > 0) };
    });
  const rates: Record<string, number> = { USD: 1, $: 1 };
  for (const c of list) {
    if (c.rate) rates[c.code] = rates[c.symbol] = c.rate;
  }
  return { list, rates };
});

/** The signed-in user's display currency with the rates, for client components. */
export const getDisplay = cache(async (): Promise<Display> => {
  const [user, { rates }] = await Promise.all([getCurrentUser(), getRates()]);
  return { currency: user?.currency ?? "USD", rates };
});

/** yen()/money()/yenCompact() in the signed-in user's display currency. */
export const getFormat = cache(async () => formatters(await getDisplay()));
