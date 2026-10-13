"use client";

import { useState } from "react";
import { Eye, EyeOff, Wand2 } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "./forms";
import { Card, CardHeader } from "./ui";
import type { ActionState } from "@/lib/admin/actions";

type Role = { id: number; name: string; description: string };
type Option = { id: number; name: string };
export type CommissionValues = { type: "" | "percent" | "fixed"; value: string };

export default function UserForm({
  action,
  values,
  roles,
  managers,
  isNew,
  isSelf,
  teamOnly = false,
  commission,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  values: { name: string; email: string; role_id: string; manager_id: string; is_active: boolean };
  roles: Role[];
  /** Possible team leaders (every active user except this one). */
  managers: Option[];
  isNew: boolean;
  isSelf: boolean;
  /** The signed-in user only manages their own team: the user reports to them. */
  teamOnly?: boolean;
  /** Commission rate fields, shown to users with commission.manage. */
  commission?: CommissionValues;
}) {
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(values.role_id);
  const role = roles.find((r) => String(r.id) === roleId);
  const [commissionType, setCommissionType] = useState(commission?.type ?? "");

  function generate() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    setPassword(Array.from(bytes, (b) => chars[b % chars.length]).join(""));
    setShow(true);
  }

  return (
    <AdminForm action={action} className="space-y-6">
      <Card>
        <CardHeader title="Account" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Full name" name="name" required>
            <input id="name" name="name" defaultValue={values.name} className="input-base" />
          </Field>
          <Field label="Email" name="email" required hint="Used to sign in">
            <input id="email" name="email" type="email" defaultValue={values.email} autoComplete="off" className="input-base" />
          </Field>
          <Field label={isNew ? "Password" : "New password"} name="password" required={isNew} hint={isNew ? "At least 8 characters" : "Leave empty to keep the current password"}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="input-base pr-10"
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600" aria-label="Toggle password visibility">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <button type="button" onClick={generate} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50" title="Generate a strong password">
                <Wand2 className="size-4" /> Generate
              </button>
            </div>
          </Field>
          {teamOnly ? (
            <Field label="Reports to" hint="Staff you add join your team.">
              <p className="input-base bg-slate-50 text-slate-600">You</p>
            </Field>
          ) : (
            <Field
              label="Reports to"
              name="manager_id"
              hint="Their team leader or manager. Users with “See team's customers” see the customers of everyone reporting to them."
            >
              <select id="manager_id" name="manager_id" defaultValue={values.manager_id} className="input-base">
                <option value="">Nobody</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
          )}
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Status</p>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
              <input type="checkbox" name="is_active" defaultChecked={values.is_active} disabled={isSelf} className="size-4 accent-emerald-600" />
              <span className="text-sm text-slate-700">Active — can sign in</span>
            </label>
            {/* A disabled checkbox is not submitted; keep your own account active. */}
            {isSelf && <input type="hidden" name="is_active" value="on" />}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Role" description="What this user can see and do." />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition hover:border-brand-200 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/60 has-[:checked]:ring-1 has-[:checked]:ring-brand-500"
            >
              <input type="radio" name="role_id" value={r.id} checked={roleId === String(r.id)} onChange={() => setRoleId(String(r.id))} className="mt-0.5 size-4 accent-brand-700" />
              <span>
                <span className="block text-sm font-medium text-slate-900">{r.name}</span>
                {r.description && <span className="mt-0.5 block text-xs text-slate-500">{r.description}</span>}
              </span>
            </label>
          ))}
        </div>
        {!role && <p className="px-5 pb-5 text-sm text-slate-500">Choose a role.</p>}
      </Card>

      {commission && (
        <Card>
          <CardHeader
            title="Commission"
            description="Default commission on vehicles this person sells. It is suggested when commission is added under Commissions, and can be changed per vehicle."
          />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Field label="Commission type" name="commission_type">
              <select
                id="commission_type"
                name="commission_type"
                value={commissionType}
                onChange={(e) => setCommissionType(e.target.value as CommissionValues["type"])}
                className="input-base"
              >
                <option value="">No commission</option>
                <option value="percent">Percentage of vehicle profit</option>
                <option value="fixed">Fixed amount per vehicle (JPY)</option>
              </select>
            </Field>
            {commissionType && (
              <Field
                label={commissionType === "percent" ? "Percentage" : "Amount per vehicle (¥)"}
                name="commission_value"
                required
                hint={commissionType === "percent" ? "e.g. 10 for 10% of profit" : "e.g. 10000"}
              >
                <input id="commission_value" name="commission_value" inputMode="decimal" defaultValue={commission.value} className="input-base" />
              </Field>
            )}
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <SubmitButton>{isNew ? "Create user" : "Save changes"}</SubmitButton>
      </div>
    </AdminForm>
  );
}
