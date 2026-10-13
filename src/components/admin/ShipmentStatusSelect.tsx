"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/admin/actions";
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUSES, type ShipmentStatus } from "@/lib/shipment-status";
import { cx } from "./ui";

const STYLES: Record<ShipmentStatus, string> = {
  upcoming: "border-sky-200 bg-sky-50 text-sky-700",
  at_sea: "border-amber-200 bg-amber-50 text-amber-700",
  arrived: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

/** Shipment status dropdown that saves on change; "Automatic" follows the ETD/ETA dates. */
export default function ShipmentStatusSelect({
  vessel,
  statusOverride,
  automaticStatus,
  action,
}: {
  vessel: string;
  statusOverride: ShipmentStatus | null;
  automaticStatus: ShipmentStatus;
  action: (status: string) => Promise<ActionState>;
}) {
  const [choice, setChoice] = useState<ShipmentStatus | "automatic">(statusOverride ?? "automatic");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const displayedStatus = choice === "automatic" ? automaticStatus : choice;

  return (
    <div className="max-w-56" aria-busy={pending}>
      <select
        value={choice}
        aria-label={`Status of ${vessel}`}
        disabled={pending}
        className={cx("max-w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60", STYLES[displayedStatus])}
        onChange={(event) => {
          const previous = choice;
          const next = event.target.value as ShipmentStatus | "automatic";
          setChoice(next);
          setError(null);
          startTransition(async () => {
            try {
              const result = await action(next);
              if (result?.error) {
                setChoice(previous);
                setError(result.error);
              }
            } catch {
              setChoice(previous);
              setError("Could not update the status. Please try again.");
            }
          });
        }}
      >
        <option value="automatic">Automatic ({SHIPMENT_STATUS_LABELS[automaticStatus]})</option>
        {SHIPMENT_STATUSES.map((status) => (
          <option key={status} value={status}>{SHIPMENT_STATUS_LABELS[status]}</option>
        ))}
      </select>
      {pending && <p className="mt-1 text-xs text-slate-500" role="status">Saving...</p>}
      {error && <p className="mt-1 text-xs text-accent-600" role="alert">{error}</p>}
    </div>
  );
}
