"use client";

import { useState } from "react";
import { Field } from "./forms";
import { Card, CardHeader, cx } from "./ui";
import { formatters, money, yen, type Display } from "@/lib/admin/format";

type Option = { id: number; name: string };

export type PurchaseFieldsProps = {
  canEdit: boolean;
  values: {
    auction_id: string;
    lot_no: string;
    purchase_date: string;
    deposit_percent: string;
    exchange_rate: string;
    bought_price: string;
    notes: string;
    expenses: Record<string, string>;
  };
  auctions: Option[];
  expenseTypes: Option[];
  /** Agreed sale price (CNF) once the vehicle is reserved for a customer. */
  sale: { cnf: number | null; symbol: string; code: string };
  /** The user's display currency, for the totals under the form. */
  display: Display;
};

const num = (v: string) => {
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** "Purchase & costs" card of the stock form (finance.view; editable with finance.manage). */
export default function PurchaseFields({ canEdit, values, auctions, expenseTypes, sale, display }: PurchaseFieldsProps) {
  const shown = formatters(display);
  const [bought, setBought] = useState(values.bought_price);
  const [rate, setRate] = useState(values.exchange_rate);
  const [costs, setCosts] = useState<Record<string, string>>(values.expenses);

  const totalCost = num(bought) + expenseTypes.reduce((sum, t) => sum + num(costs[t.id] ?? ""), 0);
  const fx = sale.code === "JPY" && !rate ? 1 : num(rate);
  const saleJpy = sale.cnf && fx ? Math.round(sale.cnf * fx) : null;
  const profit = saleJpy !== null && totalCost > 0 ? saleJpy - totalCost : null;
  const grid = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <Card>
      <CardHeader
        title="Purchase & costs"
        description="Only people with Finance access see this. Amounts in yen."
      />
      <fieldset disabled={!canEdit} className="space-y-6 p-5">
        {canEdit && <input type="hidden" name="finance" value="1" />}
        <div className={grid}>
          <Field label="Auction" name="auction_id" hint="Edit the list in Catalog lists > Auctions">
            <select id="auction_id" name="auction_id" defaultValue={values.auction_id} className="input-base">
              <option value="">Not set</option>
              {auctions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Lot no." name="lot_no">
            <input id="lot_no" name="lot_no" defaultValue={values.lot_no} className="input-base" />
          </Field>
          <Field label="Purchase date" name="purchase_date" hint="Decides which business year (Sep–Aug) it counts in">
            <input id="purchase_date" name="purchase_date" type="date" defaultValue={values.purchase_date} className="input-base" />
          </Field>
          <Field label="Payment term (deposit %)" name="deposit_percent" hint="Share the customer pays before shipping, e.g. 50">
            <input id="deposit_percent" name="deposit_percent" defaultValue={values.deposit_percent} inputMode="numeric" className="input-base" />
          </Field>
          <Field
            label={`Exchange rate (¥ per 1 ${sale.code})`}
            name="exchange_rate"
            hint={`Converts the sale price to yen, e.g. ${sale.code === "EUR" ? "175" : "150"}`}
          >
            <input id="exchange_rate" name="exchange_rate" value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="input-base" />
          </Field>
          <Field label="Bought price (¥)" name="bought_price" hint="Hammer price at auction">
            <input id="bought_price" name="bought_price" value={bought} onChange={(e) => setBought(e.target.value)} inputMode="numeric" className="input-base" />
          </Field>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-slate-700">Expenses (¥)</p>
          <div className={grid}>
            {expenseTypes.map((t) => (
              <Field key={t.id} label={t.name} name={`expense_${t.id}`}>
                <input
                  id={`expense_${t.id}`}
                  name={`expense_${t.id}`}
                  value={costs[t.id] ?? ""}
                  onChange={(e) => setCosts((c) => ({ ...c, [t.id]: e.target.value }))}
                  inputMode="numeric"
                  className="input-base"
                />
              </Field>
            ))}
          </div>
          {expenseTypes.length === 0 && (
            <p className="text-sm text-slate-500">No expense types yet. Add them in Catalog lists &gt; Expense types.</p>
          )}
        </div>

        <Field label="Notes" name="notes">
          <textarea id="notes" name="notes" defaultValue={values.notes} rows={2} className="input-base" />
        </Field>
      </fieldset>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl border-t border-slate-100 bg-slate-100 sm:grid-cols-4">
        {[
          // Shown in the user's display currency, with the amount as entered below.
          { label: "Total cost", value: shown.yen(totalCost), hint: yen(totalCost) },
          {
            label: "Sale price (CNF)",
            value: sale.cnf ? shown.money(sale.cnf, sale.symbol) : "—",
            hint: sale.cnf ? money(sale.cnf, sale.symbol) : "Set when reserved for a customer",
          },
          {
            label: "Sale at your rate",
            value: saleJpy !== null ? shown.yen(saleJpy) : "—",
            hint: sale.cnf && !fx ? "Enter the exchange rate" : saleJpy !== null ? yen(saleJpy) : undefined,
          },
          {
            label: "Profit / loss",
            value: profit !== null ? shown.yen(profit) : "—",
            hint: profit !== null ? yen(profit) : undefined,
            cls: profit === null ? undefined : profit >= 0 ? "text-emerald-600" : "text-accent-600",
          },
        ].map((s) => (
          <div key={s.label} className="bg-surface px-5 py-3.5">
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className={cx("mt-1 text-lg font-semibold tabular-nums", s.cls ?? "text-slate-900")}>{s.value}</p>
            {s.hint && <p className="text-[11px] text-slate-400">{s.hint}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
