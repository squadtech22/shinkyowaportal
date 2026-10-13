"use client";

import { useState } from "react";
import { AdminForm, Field, SubmitButton } from "./forms";
import { Card, CardHeader, cx } from "./ui";
import type { ActionState } from "@/lib/admin/actions";

type Group = { label: string; permissions: { key: string; label: string; hint: string }[] };

export default function RoleForm({
  action,
  groups,
  values,
  grantable,
  submitLabel,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  groups: Group[];
  values: { name: string; description: string; permissions: string[] };
  /** Permissions the current user may grant (their own). */
  grantable: string[];
  submitLabel: string;
}) {
  const [selected, setSelected] = useState(new Set(values.permissions));
  const toggle = (key: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <AdminForm action={action} className="space-y-6">
      <Card>
        <CardHeader title="Role" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Role name" name="name" required>
            <input id="name" name="name" defaultValue={values.name} placeholder="e.g. Recruiter" className="input-base" />
          </Field>
          <Field label="Description" name="description">
            <input id="description" name="description" defaultValue={values.description} placeholder="What this role is for" className="input-base" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Permissions"
          description={`${selected.size} selected. Users with this role only see the sections they have permission for.`}
        />
        <div className="divide-y divide-slate-100">
          {groups.map((group) => {
            const keys = group.permissions.map((p) => p.key).filter((k) => grantable.includes(k));
            const all = keys.length > 0 && keys.every((k) => selected.has(k));
            return (
              <div key={group.label} className="grid gap-4 p-5 lg:grid-cols-[200px_1fr]">
                <div>
                  <p className="font-medium text-slate-900">{group.label}</p>
                  {keys.length > 1 && (
                    <button type="button" onClick={() => keys.forEach((k) => toggle(k, !all))} className="mt-1 text-xs font-medium text-brand-600 hover:text-brand-800">
                      {all ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.permissions.map((p) => {
                    const allowed = grantable.includes(p.key);
                    return (
                      <label
                        key={p.key}
                        className={cx(
                          "flex items-start gap-3 rounded-xl border p-3 transition",
                          selected.has(p.key) ? "border-brand-300 bg-brand-50/60" : "border-slate-200",
                          allowed ? "cursor-pointer hover:border-brand-200" : "cursor-not-allowed opacity-50",
                        )}
                      >
                        <input
                          type="checkbox"
                          name="permissions"
                          value={p.key}
                          checked={selected.has(p.key)}
                          disabled={!allowed}
                          onChange={(e) => toggle(p.key, e.target.checked)}
                          className="mt-0.5 size-4 accent-brand-700"
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-800">{p.label}</span>
                          <span className="block text-xs text-slate-500">{p.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </AdminForm>
  );
}
