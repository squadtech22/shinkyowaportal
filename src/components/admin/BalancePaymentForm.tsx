"use client";

import { Paperclip } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "./forms";
import { Card, CardHeader } from "./ui";
import type { ActionState } from "@/lib/admin/actions";

/** A payment of an advance's pending balance: recorded when the customer pays it, then approved by the admin. */
export default function BalancePaymentForm({
  action,
  context,
  values,
  canApprove,
  returnTo,
  submitLabel,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  /** The advance it pays: customer, vehicle, what is left and when it was due. */
  context: { customer: string; vehicle: string | null; remaining: string; due: string };
  values: { amount: string; in_yen: string; payment_date: string; payment_recieved_date: string; status: string; file: string | null };
  canApprove: boolean;
  returnTo?: "customer";
  submitLabel: string;
}) {
  return (
    <AdminForm action={action} className="space-y-6">
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      <Card>
        <CardHeader
          title="Balance payment"
          description={`${context.customer}${context.vehicle ? ` · ${context.vehicle}` : ""} · ${context.remaining} left, due ${context.due}`}
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Amount paid (USD)" name="amount" required hint="The balance, or part of it">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">$</span>
              <input id="amount" name="amount" defaultValue={values.amount} inputMode="numeric" className="input-base pl-8" />
            </div>
          </Field>
          <Field label="Amount in yen" name="in_yen" required hint="The JPY value received — used for dashboard totals">
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
                  <span className="block text-xs text-slate-500">Leave unticked to keep it waiting for approval.</span>
                </span>
              </label>
            </div>
          ) : (
            <p className="self-end rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              The admin approves this once the money is in the bank. Until then the balance shows as sent, waiting for approval.
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
