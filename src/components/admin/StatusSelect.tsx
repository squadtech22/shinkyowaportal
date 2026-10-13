"use client";

import { useState } from "react";
import { cx } from "./ui";
import type { ActionState } from "@/lib/admin/actions";

const STYLES: Record<string, string> = {
  new: "border-sky-200 bg-sky-50 text-sky-700",
  contacted: "border-amber-200 bg-amber-50 text-amber-700",
  closed: "border-slate-200 bg-slate-50 text-slate-600",
};

/** Status dropdown that saves on change. */
export default function StatusSelect({
  value,
  action,
  disabled,
}: {
  value: string;
  action: (status: string) => Promise<ActionState>;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState(value);
  const [pending, setPending] = useState(false);
  return (
    <select
      value={status}
      disabled={disabled || pending}
      onChange={async (e) => {
        const next = e.target.value;
        setStatus(next);
        setPending(true);
        const result = await action(next);
        setPending(false);
        if (result?.error) setStatus(value);
      }}
      className={cx("rounded-full border px-2.5 py-1 text-xs font-medium capitalize disabled:opacity-70", STYLES[status])}
    >
      <option value="new">New</option>
      <option value="contacted">Contacted</option>
      <option value="closed">Closed</option>
    </select>
  );
}
