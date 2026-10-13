"use client";

import { AdminForm, Field, SubmitButton } from "@/components/admin/forms";
import { changeClientPassword } from "@/actions/client/auth";

export default function ChangePasswordForm() {
  return (
    <AdminForm action={changeClientPassword} resetOnSuccess className="grid gap-4 p-5 sm:grid-cols-3 sm:items-end">
      <Field label="Current password" name="current_password">
        <input id="current_password" name="current_password" type="password" autoComplete="current-password" className="input-base" />
      </Field>
      <Field label="New password" name="new_password">
        <input id="new_password" name="new_password" type="password" autoComplete="new-password" className="input-base" />
      </Field>
      <Field label="Repeat new password" name="confirm_password">
        <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" className="input-base" />
      </Field>
      <div className="sm:col-span-3 sm:flex sm:justify-end">
        <SubmitButton variant="secondary">Change password</SubmitButton>
      </div>
    </AdminForm>
  );
}
