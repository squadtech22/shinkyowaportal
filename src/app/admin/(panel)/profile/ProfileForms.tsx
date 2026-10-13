"use client";

import { Moon, Sun } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "@/components/admin/forms";
import { changePassword, saveExchangeRates, updatePreferences, updateProfile } from "@/actions/admin/profile";
import type { DisplayCurrency } from "@/lib/admin/format";

/** Radio buttons styled as one segmented control. */
function Choice({ name, value, options }: { name: string; value: string; options: { value: string; label: React.ReactNode }[] }) {
  return (
    <div id={name} className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === value} className="peer sr-only" />
          <span className="flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium text-slate-600 transition peer-checked:bg-surface peer-checked:text-slate-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function PreferencesForm({ currency, theme, rateNote }: { currency: DisplayCurrency; theme: "light" | "dark"; rateNote: string }) {
  return (
    <AdminForm action={updatePreferences} className="space-y-5 p-5">
      <Field label="Show amounts in" name="display_currency" hint={rateNote}>
        <div>
          <Choice
            name="display_currency"
            value={currency}
            options={[
              { value: "USD", label: "$ USD" },
              { value: "PKR", label: "Rs PKR" },
            ]}
          />
        </div>
      </Field>
      <Field label="Theme" name="theme">
        <div>
          <Choice
            name="theme"
            value={theme}
            options={[
              { value: "light", label: <><Sun className="size-4" /> Light</> },
              { value: "dark", label: <><Moon className="size-4" /> Dark</> },
            ]}
          />
        </div>
      </Field>
      <div className="flex justify-end">
        <SubmitButton>Save preferences</SubmitButton>
      </div>
    </AdminForm>
  );
}

export function ExchangeRatesForm({ rates }: { rates: { code: string; rate: number | null; saved: boolean }[] }) {
  return (
    <AdminForm action={saveExchangeRates} className="space-y-5 p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {rates.map((r) => (
          <Field
            key={r.code}
            label={`1 USD = ? ${r.code}`}
            name={`fx_${r.code.toLowerCase()}`}
            required
            hint={r.saved ? undefined : "Default value, not saved yet"}
          >
            <input
              id={`fx_${r.code.toLowerCase()}`}
              name={`fx_${r.code.toLowerCase()}`}
              defaultValue={r.rate ?? ""}
              inputMode="decimal"
              className="input-base"
            />
          </Field>
        ))}
      </div>
      <div className="flex justify-end">
        <SubmitButton>Save rates</SubmitButton>
      </div>
    </AdminForm>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  return (
    <AdminForm action={updateProfile} className="space-y-5 p-5">
      <Field label="Full name" name="name" required>
        <input id="name" name="name" defaultValue={name} className="input-base" />
      </Field>
      <Field label="Email" name="email" required hint="Used to sign in">
        <input id="email" name="email" type="email" defaultValue={email} className="input-base" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </AdminForm>
  );
}

export function PasswordForm() {
  return (
    <AdminForm action={changePassword} resetOnSuccess className="space-y-5 p-5">
      <Field label="Current password" name="current_password" required>
        <input id="current_password" name="current_password" type="password" autoComplete="current-password" className="input-base" />
      </Field>
      <Field label="New password" name="new_password" required hint="At least 8 characters">
        <input id="new_password" name="new_password" type="password" autoComplete="new-password" className="input-base" />
      </Field>
      <Field label="Confirm new password" name="confirm_password" required>
        <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" className="input-base" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>Change password</SubmitButton>
      </div>
    </AdminForm>
  );
}
