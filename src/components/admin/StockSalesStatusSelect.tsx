"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/admin/actions";
import { STATUS_INFO, VEHICLE_STATUSES, type VehicleStatus } from "@/lib/vehicle-status";
import { cx } from "./ui";

const STYLES: Record<VehicleStatus, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  reserved: "border-amber-200 bg-amber-50 text-amber-700",
  shipped: "border-sky-200 bg-sky-50 text-sky-700",
  cleared: "border-slate-200 bg-slate-50 text-slate-600",
};

export default function StockSalesStatusSelect({
  stockNumber,
  statusOverride,
  automaticStatus,
  action,
}: {
  stockNumber: string;
  statusOverride: VehicleStatus | null;
  automaticStatus: VehicleStatus;
  action: (status: string) => Promise<ActionState>;
}) {
  const [choice, setChoice] = useState<VehicleStatus | "automatic">(statusOverride ?? "automatic");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const displayedStatus = choice === "automatic" ? automaticStatus : choice;

  return (
    <div className="max-w-56" aria-busy={pending}>
      <select
        value={choice}
        aria-label={`Sales status for SKI-${stockNumber}`}
        disabled={pending}
        className={cx("max-w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60", STYLES[displayedStatus])}
        onChange={(event) => {
          const previous = choice;
          const next = event.target.value as VehicleStatus | "automatic";
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
        <option value="automatic">Automatic ({STATUS_INFO[automaticStatus].label})</option>
        {VEHICLE_STATUSES.map((status) => (
          <option key={status} value={status}>{STATUS_INFO[status].label}</option>
        ))}
      </select>
      {pending && <p className="mt-1 text-xs text-slate-500" role="status">Saving...</p>}
      {error && <p className="mt-1 text-xs text-accent-600" role="alert">{error}</p>}
    </div>
  );
}
