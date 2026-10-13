"use client";

import { AdminForm, Field, SubmitButton } from "./forms";
import type { ActionState } from "@/lib/admin/actions";

type Option = { id: number; name: string };

export type JapanPaymentValues = {
  payment_date: string;
  payee: string;
  stock_id: string;
  amount: string;
  reference: string;
  note: string;
};

export default function JapanPaymentForm({
  action,
  values,
  vehicles,
  payees,
  submitLabel,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  values: JapanPaymentValues;
  vehicles: Option[];
  payees: string[];
  submitLabel: string;
}) {
  return (
    <AdminForm action={action} className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Date" name="payment_date" required>
        <input id="payment_date" name="payment_date" type="date" defaultValue={values.payment_date} className="input-base" />
      </Field>
      <Field label="Paid to" name="payee" required hint="Auction house, transport or freight company">
        <input id="payee" name="payee" list="payee-list" defaultValue={values.payee} className="input-base" />
        <datalist id="payee-list">
          {payees.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label="Amount (¥)" name="amount" required>
        <input id="amount" name="amount" defaultValue={values.amount} inputMode="numeric" className="input-base" />
      </Field>
      <Field label="For vehicle" name="stock_id" hint="Optional" className="sm:col-span-2">
        <select id="stock_id" name="stock_id" defaultValue={values.stock_id} className="input-base">
          <option value="">Not for one vehicle</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Reference" name="reference" hint="Bank ref. or invoice no.">
        <input id="reference" name="reference" defaultValue={values.reference} className="input-base" />
      </Field>
      <Field label="Note" name="note" className="sm:col-span-2 lg:col-span-3">
        <input id="note" name="note" defaultValue={values.note} className="input-base" />
      </Field>
      <div className="flex justify-end sm:col-span-2 lg:col-span-3">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </AdminForm>
  );
}
