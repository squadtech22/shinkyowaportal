"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { AdminForm, ConfirmButton, Field, SubmitButton } from "./forms";
import { buttonClass } from "./ui";
import type { ActionState } from "@/lib/admin/actions";
import type { CatalogColumn } from "@/lib/admin/catalog";

type Row = { id: number; usage: number; values: Record<string, string> };
type SaveAction = (id: number | null, state: ActionState, data: FormData) => Promise<ActionState>;

function Inputs({ columns, values }: { columns: CatalogColumn[]; values?: Record<string, string> }) {
  return (
    <>
      {columns.map((c) => (
        <Field key={c.key} label={c.label} name={c.key} hint={c.hint} required={c.required} className={c.key === "image" ? "sm:col-span-2" : undefined}>
          <input id={c.key} name={c.key} defaultValue={values?.[c.key] ?? ""} maxLength={c.max} className="input-base" />
        </Field>
      ))}
    </>
  );
}

/** Add form plus a list of rows that can be edited in place or deleted. */
export default function CatalogEditor({
  columns,
  rows,
  save,
  remove,
  imageBase,
}: {
  columns: CatalogColumn[];
  rows: Row[];
  save: SaveAction;
  remove: (id: number) => Promise<ActionState>;
  imageBase?: string;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const imageUrl = (v: string) => (/^https?:\/\//.test(v) ? v : `${imageBase ?? ""}${v}`);

  return (
    <div>
      <div className="border-b border-slate-100 p-4">
        {adding ? (
          <AdminForm
            action={async (state, data) => {
              const result = await save(null, state, data);
              if (result?.ok) setAdding(false);
              return result;
            }}
            className="grid gap-4 sm:grid-cols-3 sm:items-start"
          >
            <Inputs columns={columns} />
            <div className="flex gap-2 sm:pt-6">
              <SubmitButton>Add</SubmitButton>
              <button type="button" className={buttonClass("ghost")} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </AdminForm>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={buttonClass("secondary")}>
            <Plus className="size-4" /> Add new
          </button>
        )}
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) =>
          editing === row.id ? (
            <li key={row.id} className="bg-slate-50/60 p-4">
              <AdminForm
                action={async (state, data) => {
                  const result = await save(row.id, state, data);
                  if (result?.ok) setEditing(null);
                  return result;
                }}
                className="grid gap-4 sm:grid-cols-3 sm:items-start"
              >
                <Inputs columns={columns} values={row.values} />
                <div className="flex gap-2 sm:pt-6">
                  <SubmitButton>Save</SubmitButton>
                  <button type="button" className={buttonClass("ghost")} onClick={() => setEditing(null)} title="Cancel">
                    <X className="size-4" />
                  </button>
                </div>
              </AdminForm>
            </li>
          ) : (
            <li key={row.id} className="flex items-center gap-4 px-5 py-3">
              {imageBase !== undefined && (
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                  {row.values.image && <img src={imageUrl(row.values.image)} alt="" className="size-7 object-contain" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">
                  {columns.map((c) => row.values[c.key]).filter((v, i) => v && columns[i].key !== "image").join(" · ")}
                </p>
                <p className="text-xs text-slate-500">{row.usage ? `Used ${row.usage} ${row.usage === 1 ? "time" : "times"}` : "Not used yet"}</p>
              </div>
              <button type="button" onClick={() => setEditing(row.id)} className={buttonClass("ghost", "sm")}>
                <Pencil className="size-3.5" /> Edit
              </button>
              <ConfirmButton action={() => remove(row.id)} title="Delete this item?" description="Items that are still in use cannot be deleted.">
                <Trash2 className="size-3.5" />
              </ConfirmButton>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
