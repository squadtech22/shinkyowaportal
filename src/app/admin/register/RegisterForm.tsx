"use client";

import { AdminForm, Field, SubmitButton } from "@/components/admin/forms";
import { register } from "@/actions/admin/auth";

export default function RegisterForm() {
  return (
    <AdminForm action={register} className="mt-8 space-y-5">
      <Field label="Full name" name="name" required>
        <input id="name" name="name" autoComplete="name" required autoFocus className="input-base" />
      </Field>
      <Field label="Email" name="email" required>
        <input id="email" name="email" type="email" autoComplete="email" required className="input-base" />
      </Field>
      <Field label="Phone" name="phone">
        <input id="phone" name="phone" type="tel" autoComplete="tel" className="input-base" />
      </Field>
      <Field label="Password" name="password" required hint="At least 8 characters">
        <input id="password" name="password" type="password" autoComplete="new-password" required className="input-base" />
      </Field>
      <Field label="Confirm password" name="confirm_password" required>
        <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required className="input-base" />
      </Field>
      <SubmitButton className="w-full">Create account</SubmitButton>
    </AdminForm>
  );
}
