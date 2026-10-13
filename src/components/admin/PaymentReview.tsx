"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/admin/actions";
import { buttonClass } from "./ui";

/**
 * The admin's buttons on a payment: Approve (money received) or Not received
 * (asks why) while it waits; Undo once decided.
 */
export default function PaymentReview({
  status,
  approve,
  reject,
  undo,
}: {
  status: string;
  approve: () => Promise<ActionState>;
  reject: (reason: string) => Promise<ActionState>;
  undo: () => Promise<ActionState>;
}) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (action: () => Promise<ActionState>, after?: () => void) =>
    start(async () => {
      setError(null);
      const result = await action();
      if (result?.error) setError(result.error);
      else after?.();
    });

  if (status !== "not approved") {
    return (
      <button type="button" disabled={pending} className={buttonClass("ghost", "sm")} onClick={() => run(undo)}>
        {pending && <Loader2 className="size-3.5 animate-spin" />}
        {status === "approved" ? "Undo approval" : "Undo"}
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col items-end gap-1.5">
      {asking ? (
        <form
          className="flex flex-wrap items-center justify-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => reject(reason), () => setAsking(false));
          }}
        >
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? e.g. TT not in bank"
            maxLength={255}
            className="input-base w-48 py-1 text-xs"
          />
          <button type="submit" disabled={pending} className={buttonClass("accent", "sm")}>
            {pending && <Loader2 className="size-3.5 animate-spin" />} Not received
          </button>
          <button type="button" disabled={pending} className={buttonClass("ghost", "sm")} onClick={() => setAsking(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-1.5">
          <button type="button" disabled={pending} className={buttonClass("primary", "sm")} onClick={() => run(approve)}>
            {pending && <Loader2 className="size-3.5 animate-spin" />} Approve
          </button>
          <button type="button" disabled={pending} className={buttonClass("secondary", "sm")} onClick={() => setAsking(true)}>
            Not received
          </button>
        </div>
      )}
      {error && <p className="text-xs text-accent-600" role="alert">{error}</p>}
    </div>
  );
}
