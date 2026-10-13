"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "./forms";
import { Card, CardHeader } from "./ui";
import type { ActionState } from "@/lib/admin/actions";

export type PaymentCustomer = {
  id: number;
  name: string;
  symbol: string;
  code: string;
  vehicles: { id: number; label: string }[];
};

export type PaymentValues = {
  customer_account_id: string;
  stock_id: string;
  description: string;
  payment_date: string;
  amount: string;
  in_yen: string;
  pending_amount: string;
  /** YYYY-MM-DDTHH:MM for <input type="datetime-local">, or "". */
  pending_due_at: string;
  payment_recieved_date: string;
  status: string;
  file: string | null;
};

export default function PaymentForm({
  action,
  customers,
  values,
  canApprove,
  returnTo,
  submitLabel,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  customers: PaymentCustomer[];
  values: PaymentValues;
  canApprove: boolean;
  returnTo?: "customer";
  submitLabel: string;
}) {
  const [customerId, setCustomerId] = useState(values.customer_account_id);
  const customer = customers.find((c) => String(c.id) === customerId);

  return (
    <AdminForm action={action} className="space-y-6">
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      <Card>
        <CardHeader title="Payment" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Customer" name="customer_account_id" required>
            <select
              id="customer_account_id"
              name="customer_account_id"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="input-base"
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="For vehicle" name="stock_id" hint="Optional — the customer's reserved vehicles">
            <select id="stock_id" name="stock_id" key={customerId} defaultValue={customerId === values.customer_account_id ? values.stock_id : ""} className="input-base">
              <option value="">Whole account</option>
              {customer?.vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Description" name="description" required className="sm:col-span-2">
            <input id="description" name="description" defaultValue={values.description} placeholder="e.g. Advance for Toyota Hilux" className="input-base" />
          </Field>
          <Field label="Advance (USD)" name="amount" required hint="The amount the customer has paid now">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">$</span>
              <input id="amount" name="amount" defaultValue={values.amount} inputMode="numeric" className="input-base pl-8" />
            </div>
          </Field>
          <Field label="Advance in yen" name="in_yen" required hint="The JPY value received — used for dashboard totals">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">¥</span>
              <input id="in_yen" name="in_yen" defaultValue={values.in_yen} inputMode="numeric" className="input-base pl-8" />
            </div>
          </Field>
          <Field label="Payment date" name="payment_date" required hint="When the customer sent the transfer">
            <input id="payment_date" name="payment_date" type="date" defaultValue={values.payment_date} className="input-base" />
          </Field>
          <Field label="Received date" name="payment_recieved_date" hint="When it arrived in the bank">
            <input id="payment_recieved_date" name="payment_recieved_date" type="date" defaultValue={values.payment_recieved_date} className="input-base" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Pending balance"
          description="What the customer still has to pay. Shown in red once the due time passes or the vehicle's ship has arrived."
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Pending (USD)" name="pending_amount" hint="Leave empty when nothing is owed">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">$</span>
              <input id="pending_amount" name="pending_amount" defaultValue={values.pending_amount} inputMode="numeric" className="input-base pl-8" />
            </div>
          </Field>
          <Field label="Pending due date & time" name="pending_due_at" hint="When the balance should be paid">
            <input id="pending_due_at" name="pending_due_at" type="datetime-local" defaultValue={values.pending_due_at} className="input-base" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="TT copy & approval" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="TT copy / receipt" name="file" hint="PDF or image, up to 8 MB">
            <input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
            {values.file && (
              <a href={`/admin/files/${values.file}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                <Paperclip className="size-3.5" /> Current file
              </a>
            )}
          </Field>
          {canApprove ? (
            <div>
              <p className="mb-1.5 block text-sm font-medium text-slate-700">Status</p>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50/60">
                <input type="checkbox" name="status" value="approved" defaultChecked={values.status === "approved"} className="mt-0.5 size-4 accent-emerald-600" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">Approved — money received</span>
                  <span className="block text-xs text-slate-500">Leave unticked to keep it as a pending TT.</span>
                </span>
              </label>
            </div>
          ) : (
            <p className="self-end rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              New payments wait as a pending TT until the admin approves them (money received) or marks them not received.
            </p>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </AdminForm>
  );
}
