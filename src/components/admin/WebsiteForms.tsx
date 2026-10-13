"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "./forms";
import { buttonClass } from "./ui";
import type { ActionState } from "@/lib/admin/actions";
import type { SettingField } from "@/lib/admin/website";

type Action = (state: ActionState, data: FormData) => Promise<ActionState>;

export function SettingsGroupForm({
  action,
  fields,
  values,
}: {
  action: Action;
  fields: SettingField[];
  values: Record<string, string>;
}) {
  return (
    <AdminForm action={action} className="p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((f) =>
          f.type === "toggle" ? (
            <label key={f.key} className="flex items-center gap-3 sm:col-span-2">
              <input type="checkbox" name={f.key} defaultChecked={values[f.key] === "1"} className="peer sr-only" />
              <span className="relative h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
              <span className="text-sm font-medium text-slate-700">{f.label}</span>
            </label>
          ) : (
            <Field key={f.key} label={f.label} name={f.key} hint={f.hint} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
              {f.type === "textarea" ? (
                <textarea id={f.key} name={f.key} defaultValue={values[f.key] ?? ""} rows={4} className="input-base" />
              ) : (
                <input id={f.key} name={f.key} type={f.type ?? "text"} defaultValue={values[f.key] ?? ""} className="input-base" />
              )}
            </Field>
          ),
        )}
      </div>
      <div className="mt-5 flex justify-end">
        <SubmitButton>Save</SubmitButton>
      </div>
    </AdminForm>
  );
}

/** Editable label/value table with add, remove and reorder. */
export function InfoRowsForm({ action, rows: initial }: { action: Action; rows: { label: string; value: string }[] }) {
  const [rows, setRows] = useState(initial.length ? initial : [{ label: "", value: "" }]);
  const update = (i: number, key: "label" | "value", value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const move = (i: number, by: number) =>
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(i, 1);
      next.splice(i + by, 0, row);
      return next;
    });

  return (
    <AdminForm action={action} className="p-5">
      <input type="hidden" name="rows" value={JSON.stringify(rows)} />
      <div className="space-y-2">
        <div className="hidden grid-cols-[200px_1fr_auto] gap-2 px-1 text-xs font-medium text-slate-500 sm:grid">
          <span>Label</span>
          <span>Value</span>
          <span className="w-[104px]" />
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[200px_1fr_auto] sm:border-0 sm:p-0">
            <input value={r.label} onChange={(e) => update(i, "label", e.target.value)} placeholder="Label" className="input-base" aria-label="Label" />
            <input value={r.value} onChange={(e) => update(i, "value", e.target.value)} placeholder="Value" className="input-base" aria-label="Value" />
            <div className="flex gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={buttonClass("ghost", "sm")} title="Move up">
                <ArrowUp className="size-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className={buttonClass("ghost", "sm")} title="Move down">
                <ArrowDown className="size-3.5" />
              </button>
              <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className={buttonClass("ghost", "sm")} title="Remove row">
                <Trash2 className="size-3.5 text-accent-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => setRows((rs) => [...rs, { label: "", value: "" }])} className={buttonClass("secondary", "sm")}>
          <Plus className="size-3.5" /> Add row
        </button>
        <SubmitButton>Save</SubmitButton>
      </div>
    </AdminForm>
  );
}
