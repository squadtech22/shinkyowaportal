"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "@/components/admin/forms";
import { signIn } from "@/actions/auth";

export default function SignInForm({ next }: { next?: string }) {
  const [show, setShow] = useState(false);
  return (
    <AdminForm action={signIn} className="mt-8 space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" name="email">
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus className="input-base" />
      </Field>
      <Field label="Password" name="password">
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="input-base pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <SubmitButton className="w-full">Sign in</SubmitButton>
    </AdminForm>
  );
}
