"use client";

import { startTransition, useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "./forms";
import { buttonClass, Card, CardHeader } from "./ui";
import type { ActionState } from "@/lib/admin/actions";

type Action = (state: ActionState, data: FormData) => Promise<ActionState>;
type Option = { id: number; name: string };
type CommissionType = "percent" | "fixed";

/** Compact one-row form: a type, a rate and a button, with the result under it. */
function InlineForm({ action, children, button }: { action: Action; children: React.ReactNode; button: string }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form
      className="flex flex-col items-end gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      <div className="flex items-center gap-1.5">
        {children}
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          {button}
        </button>
      </div>
      {state?.error && (
        <p className="max-w-64 text-right text-xs text-accent-600">
          {state.fieldErrors ? Object.values(state.fieldErrors)[0] : state.error}
        </p>
      )}
      {state?.ok && state.message && <p className="text-xs text-emerald-700">{state.message}</p>}
    </form>
  );
}

/** "Add" on a sold vehicle, pre-filled with the salesperson's default rate. */
export function QuickAddCommission({
  action,
  defaultType,
  defaultRate,
}: {
  action: Action;
  defaultType: CommissionType | null;
  defaultRate: number | null;
}) {
  return (
    <InlineForm action={action} button="Add">
      <select name="type" defaultValue={defaultType ?? "percent"} className="input-base w-auto! py-1! text-xs" aria-label="Commission type">
        <option value="percent">% of profit</option>
        <option value="fixed">Fixed ¥</option>
      </select>
      <input
        name="rate"
        inputMode="decimal"
        defaultValue={defaultRate ?? ""}
        placeholder="0"
        className="input-base w-24! py-1! text-right text-xs"
        aria-label="Rate"
      />
    </InlineForm>
  );
}

/** Finance: "Mark complete" for a staff member's month, with an optional bank / cash reference. */
export function CompletePayout({ action }: { action: Action }) {
  return (
    <InlineForm action={action} button="Mark complete">
      <input name="payment_ref" placeholder="Reference (optional)" maxLength={150} className="input-base w-40! py-1! text-xs" aria-label="Payment reference" />
    </InlineForm>
  );
}

/** Full add / edit form. Vehicle and staff member are only chosen when adding. */
export function CommissionForm({
  action,
  vehicles,
  staff,
  values,
}: {
  action: Action;
  /** Omitted when editing. */
  vehicles?: Option[];
  staff?: Option[];
  values: { stock_id: string; user_id: string; type: CommissionType; rate: string; note: string };
}) {
  const [type, setType] = useState<CommissionType>(values.type);
  return (
    <AdminForm action={action} className="space-y-6">
      <Card>
        <CardHeader
          title="Commission"
          description="Percentage commission is worked out from the vehicle's profit in the purchase ledger. It goes into the staff member's open month, which is approved and then paid by finance."
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          {vehicles && (
            <Field label="Vehicle" name="stock_id" required className="sm:col-span-2">
              <select id="stock_id" name="stock_id" defaultValue={values.stock_id} className="input-base">
                <option value="">Choose a vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </Field>
          )}
          {staff && (
            <Field label="Staff member" name="user_id" required hint="The agent who sold it, or e.g. their manager for a team bonus">
              <select id="user_id" name="user_id" defaultValue={values.user_id} className="input-base">
                <option value="">Choose…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Commission type" name="type" required>
            <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as CommissionType)} className="input-base">
              <option value="percent">Percentage of vehicle profit</option>
              <option value="fixed">Fixed amount (JPY)</option>
            </select>
          </Field>
          <Field label={type === "percent" ? "Percentage" : "Amount (¥)"} name="rate" required hint={type === "percent" ? "e.g. 10 for 10%" : "e.g. 10000"}>
            <input id="rate" name="rate" inputMode="decimal" defaultValue={values.rate} className="input-base" />
          </Field>
          <Field label="Note" name="note" className="sm:col-span-2">
            <input id="note" name="note" defaultValue={values.note} maxLength={255} className="input-base" />
          </Field>
        </div>
      </Card>
      <div className="flex justify-end">
        <SubmitButton>Save commission</SubmitButton>
      </div>
    </AdminForm>
  );
}
