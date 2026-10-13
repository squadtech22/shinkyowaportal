"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "./forms";
import { buttonClass } from "./ui";
import type { ActionState } from "@/lib/admin/actions";

type Vehicle = { id: number; label: string; fob: number; symbol: string };

type Customer = { id: number; name: string; symbol: string };

/**
 * Pick an available vehicle and its CNF (sale) price; CNF starts at the FOB.
 * With `customers`, the customer is picked on the form too.
 */
export function ReserveVehicleForm({
  action,
  vehicles,
  currencySymbol,
  customers,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  vehicles: Vehicle[];
  currencySymbol?: string;
  customers?: Customer[];
}) {
  const [cnf, setCnf] = useState("");
  const [customerId, setCustomerId] = useState("");
  if (vehicles.length === 0) {
    return <p className="text-sm text-slate-500">All vehicles are already reserved.</p>;
  }
  const symbol = customers ? (customers.find((c) => String(c.id) === customerId)?.symbol ?? "") : (currencySymbol ?? "");
  return (
    <AdminForm
      action={action}
      resetOnSuccess
      className={customers ? "grid gap-4 lg:grid-cols-[1fr_1fr_160px_auto] lg:items-end" : "grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"}
    >
      {customers && (
        <Field label="Customer" name="customer_account_id">
          <select id="customer_account_id" name="customer_account_id" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-base">
            <option value="">Choose a customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Vehicle" name="stock_id">
        <select
          id="stock_id"
          name="stock_id"
          defaultValue=""
          className="input-base"
          onChange={(e) => {
            const v = vehicles.find((x) => x.id === Number(e.target.value));
            setCnf(v && v.fob > 0 ? String(v.fob) : "");
          }}
        >
          <option value="">Choose an available vehicle</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
              {v.fob > 0 ? ` — FOB ${v.symbol}${v.fob.toLocaleString("en-US")}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label={symbol ? `CNF price (${symbol})` : "CNF price"} name="cnf">
        <input id="cnf" name="cnf" value={cnf} onChange={(e) => setCnf(e.target.value)} inputMode="numeric" className="input-base" />
      </Field>
      <SubmitButton>Reserve</SubmitButton>
    </AdminForm>
  );
}

/** CNF price with an inline edit button. */
export function CnfEditor({
  value,
  symbol,
  action,
  editable,
}: {
  value: number;
  symbol: string;
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const display = `${symbol}${value.toLocaleString("en-US")}`;
  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
        {display}
        {editable && (
          <button type="button" onClick={() => setEditing(true)} className="text-slate-400 hover:text-brand-700" title="Change price">
            <Pencil className="size-3.5" />
          </button>
        )}
      </span>
    );
  }
  return (
    <AdminForm
      action={async (state, data) => {
        const result = await action(state, data);
        if (result?.ok) setEditing(false);
        return result;
      }}
      className="flex items-center justify-end gap-1"
    >
      <input name="cnf" defaultValue={value} inputMode="numeric" autoFocus className="input-base w-28 py-1 text-right" />
      <button type="submit" className={buttonClass("primary", "sm")} title="Save">
        <Check className="size-3.5" />
      </button>
      <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")} title="Cancel">
        <X className="size-3.5" />
      </button>
    </AdminForm>
  );
}
