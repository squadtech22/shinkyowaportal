"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, Wand2 } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "./forms";
import { Card, CardHeader } from "./ui";
import type { ActionState } from "@/lib/admin/actions";

type Option = { id: number; name: string };

export type CustomerValues = Record<
  "name" | "company" | "email" | "phone" | "whatsapp" | "address" | "city" | "country_id" | "currency_id" | "agent_id" | "description",
  string
>;

export default function CustomerForm({
  action,
  values,
  countries,
  currencies,
  agents,
  hasLogin,
  submitLabel,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  values: CustomerValues;
  countries: Option[];
  currencies: Option[];
  /** Null when the user may not assign customers to other staff. */
  agents: Option[] | null;
  /** Null for a new customer; otherwise whether they already have a portal password. */
  hasLogin: boolean | null;
  submitLabel: string;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState(values.email);
  const [copied, setCopied] = useState(false);
  // What the agent sends the customer (WhatsApp, email): the password is not
  // shown again after saving, so this is the moment to copy it.
  async function copyLogin() {
    const text = [
      "Your Shinkyowa customer portal",
      `Sign in: ${window.location.origin}/login`,
      `Email: ${email}`,
      `Password: ${password}`,
      "See your vehicles, shipping, documents and payments.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy the login details:", text);
    }
  }
  function generate() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    setPassword(Array.from(bytes, (b) => chars[b % chars.length]).join(""));
    setShow(true);
  }
  const input = (name: keyof CustomerValues, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={name} name={name} defaultValue={values[name]} className="input-base" {...props} />
  );
  return (
    <AdminForm action={action} className="space-y-6">
      <Card>
        <CardHeader title="Contact" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Full name" name="name" required>{input("name")}</Field>
          <Field label="Company" name="company">{input("company")}</Field>
          <Field label="Email" name="email" required={hasLogin === null} hint={hasLogin === null ? "The customer signs in to the portal with it" : undefined}>
            {input("email", { type: "email", onChange: (e) => setEmail(e.target.value.trim()) })}
          </Field>
          <Field label="Phone" name="phone">{input("phone", { type: "tel" })}</Field>
          <Field label="WhatsApp" name="whatsapp">{input("whatsapp", { type: "tel" })}</Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Address & account" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Address" name="address" className="sm:col-span-2">{input("address")}</Field>
          <Field label="City" name="city">{input("city")}</Field>
          <Field label="Country" name="country_id">
            <select id="country_id" name="country_id" defaultValue={values.country_id} className="input-base">
              <option value="">Not set</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Currency" name="currency_id" required hint="Prices and payments for this customer use this currency">
            <select id="currency_id" name="currency_id" defaultValue={values.currency_id} className="input-base">
              <option value="">Select currency</option>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          {agents && (
            <Field label="Assigned agent" name="agent_id" hint="Agents only see customers assigned to them (team leaders also see their team's)">
              <select id="agent_id" name="agent_id" defaultValue={values.agent_id} className="input-base">
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Notes" name="description" className="sm:col-span-2">
            <textarea id="description" name="description" defaultValue={values.description} rows={4} className="input-base" />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Customer portal login"
          description="The customer signs in with their email and this password (website → Login, or /login) to see their vehicles, shipping, documents and payments."
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field
            label={hasLogin ? "New password" : "Password"}
            name="portal_password"
            required={hasLogin === null}
            hint={
              hasLogin
                ? "Leave empty to keep the current password"
                : hasLogin === null
                  ? "Share it with the customer — copy the login details before saving, it is not shown again."
                  : "This customer has no login yet — set a password to give them access"
            }
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="portal_password"
                  name="portal_password"
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
              <button type="button" onClick={generate} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50" title="Generate a password">
                <Wand2 className="size-4" /> Generate
              </button>
            </div>
            {password && email && (
              <button
                type="button"
                onClick={copyLogin}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied — paste it to the customer" : "Copy login details for the customer"}
              </button>
            )}
          </Field>
          {hasLogin && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Access</p>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-accent-100 has-[:checked]:bg-accent-50/60">
                <input type="checkbox" name="portal_remove" className="mt-0.5 size-4 accent-accent-600" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">Remove portal access</span>
                  <span className="block text-xs text-slate-500">Deletes the password and signs the customer out.</span>
                </span>
              </label>
            </div>
          )}
        </div>
      </Card>
      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </AdminForm>
  );
}
