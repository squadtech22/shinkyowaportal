"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { buttonClass, cx, type ButtonVariant } from "./ui";
import type { ActionState } from "@/lib/admin/actions";

// Pending state and field errors of the enclosing <AdminForm>.
const FormContext = createContext<{ pending: boolean; fieldErrors: Record<string, string> }>({
  pending: false,
  fieldErrors: {},
});

/**
 * Form bound to a server action returning ActionState. Shows the action's
 * error banner and exposes field errors to <Field>. Submits through
 * onSubmit so the inputs keep their values when validation fails (React
 * resets forms that use action={...}).
 */
export function AdminForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, run, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      action={run}
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      {state?.error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && state.message && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}
      <FormContext value={{ pending, fieldErrors: state?.fieldErrors ?? {} }}>{children}</FormContext>
    </form>
  );
}

export function Field({
  label,
  name,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  name?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { fieldErrors } = useContext(FormContext);
  const error = name ? fieldErrors[name] : undefined;
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-accent-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-accent-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending: formPending } = useContext(FormContext);
  const { pending: statusPending } = useFormStatus();
  const pending = formPending || statusPending;
  return (
    <button type="submit" disabled={pending} className={cx(buttonClass(variant), "max-sm:w-full", className)}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/**
 * Button that asks for confirmation in a dialog, then runs a server action
 * (typically a delete). The action receives no form data.
 */
export function ConfirmButton({
  action,
  title,
  description,
  confirmLabel = "Delete",
  children,
  variant = "danger",
  size = "sm",
}: {
  action: () => Promise<ActionState | void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (result && result.error) setError(result.error);
      else setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(variant, size)}>
        {children}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={() => !pending && setOpen(false)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
            {error && <p className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className={buttonClass(variant === "danger" ? "accent" : "primary")} onClick={confirm} disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Small inline action button (e.g. "Approve") that runs a server action without a dialog. */
export function ActionButton({
  action,
  children,
  variant = "secondary",
}: {
  action: () => Promise<ActionState | void>;
  children: React.ReactNode;
  variant?: ButtonVariant;
}) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass(variant, "sm")}
      onClick={async () => {
        setPending(true);
        try {
          await action();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

/** Shows the one-shot flash cookie set by setFlash() after a redirect. */
export function Toast() {
  const [flash, setFlash] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const check = () => {
      const match = document.cookie.match(/(?:^|; )skw_flash=([^;]*)/);
      if (!match) return;
      document.cookie = "skw_flash=; Max-Age=0; path=/admin";
      try {
        setFlash(JSON.parse(decodeURIComponent(decodeURIComponent(match[1]))));
      } catch {
        /* ignore malformed cookie */
      }
    };
    check();
    // Client navigations after a server action do not remount this component.
    const id = setInterval(check, 400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(id);
  }, [flash]);

  if (!flash) return null;
  const ok = flash.type === "success";
  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-surface px-4 py-3 shadow-lg shadow-slate-900/10" role="status">
      {ok ? <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" /> : <AlertCircle className="mt-0.5 size-5 text-accent-600" />}
      <p className="text-sm text-slate-700">{flash.message}</p>
      <button type="button" onClick={() => setFlash(null)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}
