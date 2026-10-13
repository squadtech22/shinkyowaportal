import { unstable_rethrow } from "next/navigation";
import { NotAllowedError } from "./auth";
import { UploadError } from "@/lib/uploads";

// Result of an admin server action, rendered by <AdminForm>.
export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

/** Thrown inside an action to report per-field problems. */
export class ValidationError extends Error {
  constructor(public fieldErrors: Record<string, string>) {
    super("Please fix the highlighted fields.");
  }
}

/**
 * Runs an action body and turns expected failures (permission, validation,
 * uploads, duplicate rows) into an ActionState. redirect()/notFound() are
 * rethrown so Next.js can handle them.
 */
export async function runAction(body: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await body()) ?? { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ValidationError) return { error: err.message, fieldErrors: err.fieldErrors };
    if (err instanceof NotAllowedError || err instanceof UploadError) return { error: err.message };
    if (err && typeof err === "object" && "code" in err && err.code === "ER_DUP_ENTRY") {
      return { error: "That value is already in use. Please choose a different one." };
    }
    if (err && typeof err === "object" && "code" in err && err.code === "ER_ROW_IS_REFERENCED_2") {
      return { error: "This item is still in use elsewhere and cannot be deleted." };
    }
    console.error("[admin action]", err);
    return { error: "Something went wrong. Please try again." };
  }
}

/** Typed reader for FormData with simple validation that collects field errors. */
export function formReader(form: FormData) {
  const errors: Record<string, string> = {};
  const raw = (key: string) => String(form.get(key) ?? "").trim();

  const r = {
    errors,
    raw,
    text(key: string, opts: { required?: boolean; max?: number; label?: string } = {}) {
      const value = raw(key);
      const label = opts.label ?? "This field";
      if (opts.required && !value) errors[key] = `${label} is required`;
      else if (opts.max && value.length > opts.max) errors[key] = `${label} must be at most ${opts.max} characters`;
      return value;
    },
    optional(key: string, max?: number) {
      const value = r.text(key, { max });
      return value || null;
    },
    int(key: string, opts: { required?: boolean; min?: number; max?: number; label?: string } = {}) {
      const value = raw(key).replace(/[,\s]/g, "");
      const label = opts.label ?? "This field";
      if (!value) {
        if (opts.required) errors[key] = `${label} is required`;
        return null;
      }
      const n = Number(value);
      if (!Number.isSafeInteger(n)) errors[key] = `${label} must be a whole number within the supported range`;
      else if (opts.min !== undefined && n < opts.min) errors[key] = `${label} must be at least ${opts.min}`;
      else if (opts.max !== undefined && n > opts.max) errors[key] = `${label} must be at most ${opts.max}`;
      return Number.isSafeInteger(n) ? n : null;
    },
    id(key: string, opts: { required?: boolean; label?: string } = {}) {
      return r.int(key, { ...opts, min: 1 });
    },
    email(key: string, opts: { required?: boolean } = {}) {
      const value = raw(key).toLowerCase();
      if (!value) {
        if (opts.required) errors[key] = "Email is required";
        return null;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 150) errors[key] = "Enter a valid email";
      return value;
    },
    date(key: string, opts: { required?: boolean; label?: string } = {}) {
      const value = raw(key);
      if (!value) {
        if (opts.required) errors[key] = `${opts.label ?? "Date"} is required`;
        return null;
      }
      const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
      if (!date || !Number.isFinite(date.getTime()) || value < "1000-01-01" || date.toISOString().slice(0, 10) !== value) {
        errors[key] = "Enter a valid date";
      }
      return value;
    },
    oneOf<T extends string>(key: string, values: readonly T[], label = "This field") {
      const value = raw(key) as T;
      if (!values.includes(value)) errors[key] = `Choose a valid ${label.toLowerCase()}`;
      return value;
    },
    checked: (key: string) => form.get(key) === "on" || form.get(key) === "1",
    /** Throws ValidationError when any field failed. */
    done() {
      if (Object.keys(errors).length) throw new ValidationError(errors);
    },
  };
  return r;
}
