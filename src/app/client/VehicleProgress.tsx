import { AlertTriangle, Check } from "lucide-react";
import type { RowDataPacket } from "mysql2";
import { cx } from "@/components/admin/ui";
import { date, dateTime, money } from "@/lib/admin/format";
import type { ShipmentStatus } from "@/lib/shipment-status";

// Step trackers of the customer portal: where a vehicle is (vehicleSteps)
// and how far its payment is (paymentSteps), drawn the same way by StatusSteps.

export type Step = {
  label: string;
  detail: string;
  done: boolean;
  /** Needs the customer's attention (overdue, not received): drawn red while open. */
  alert?: boolean;
};

/** Index of the first open step, or -1 when every step is done. */
export const currentStep = (steps: Step[]) => steps.findIndex((s) => !s.done);

export type VehicleProgressProps = {
  vessel: string | null;
  shipment: ShipmentStatus | null;
  etd: Date | string | null;
  eta: Date | string | null;
  docsReady: number;
  docsTotal: number;
};

/** Reserved → on a vessel → at sea → arrived → documents. Nothing about money. */
export function vehicleSteps(p: VehicleProgressProps): Step[] {
  const sailed = p.shipment === "at_sea" || p.shipment === "arrived";
  return [
    { label: "Reserved", detail: "Reserved for you", done: true },
    { label: "On a vessel", detail: p.vessel ?? "Not booked yet", done: Boolean(p.vessel) },
    { label: "At sea", detail: sailed ? `Left ${date(p.etd)}` : p.vessel ? `Departs ${date(p.etd)}` : "—", done: sailed },
    {
      label: "Arrived",
      detail: p.vessel ? (p.shipment === "arrived" ? `Arrived ${date(p.eta)}` : `Expected ${date(p.eta)}`) : "—",
      done: p.shipment === "arrived",
    },
    {
      label: "Documents",
      detail: p.docsReady === p.docsTotal ? "All ready" : `${p.docsReady} of ${p.docsTotal} ready`,
      done: p.docsReady === p.docsTotal,
    },
  ];
}

/**
 * Advance → balance due → done, for one vehicle: from its price, what is
 * paid (approved) and its payments (selected with PAYMENT_FLOW_COLUMNS).
 */
export function paymentSteps(price: number, paid: number, payments: RowDataPacket[], symbol: string): Step[] {
  const due = Math.max(price - paid, 0);
  const fullyPaid = price > 0 && due === 0;
  const advances = payments.filter((p) => p.kind === "advance");
  const received = advances.filter((p) => p.status === "approved");
  const waiting = advances.some((p) => p.status === "not approved");
  const rejected = advances.find((p) => p.status === "rejected");

  const advance: Step = received.length
    ? { label: "Advance", detail: `${money(received.reduce((n, p) => n + Number(p.amount), 0), "$")} received`, done: true }
    : waiting
      ? { label: "Advance", detail: "Being confirmed", done: false }
      : rejected
        ? { label: "Advance", detail: "Not received yet", done: false, alert: true }
        : { label: "Advance", detail: fullyPaid ? "Paid" : "Waiting for your advance", done: fullyPaid };

  // The balance still owed, with its due date when one was agreed.
  const open = advances.find((p) => p.balance_state === "open" || p.balance_state === "sent");
  const balance: Step = fullyPaid
    ? { label: "Balance due", detail: "Paid", done: true }
    : open?.balance_state === "sent"
      ? { label: "Balance due", detail: `${money(Number(open.balance_remaining), "$")} being confirmed`, done: false }
      : open
        ? {
            label: "Balance due",
            detail: `${money(Number(open.balance_remaining), "$")} due ${dateTime(open.pending_due_at)}${open.alert ? " · overdue" : ""}`,
            done: false,
            alert: Boolean(open.alert),
          }
        : { label: "Balance due", detail: price > 0 ? `${money(due, symbol)} to pay` : "Price not set yet", done: false };

  return [advance, balance, { label: "Done", detail: fullyPaid ? "Paid in full" : "—", done: fullyPaid }];
}

/** A step tracker: vertical timeline on phones, stepper with connecting lines from `sm` up. */
export default function StatusSteps({ steps }: { steps: Step[] }) {
  const current = currentStep(steps);
  return (
    <ol className="flex flex-col sm:flex-row">
      {steps.map((s, i) => {
        const active = i === current;
        const danger = active && s.alert;
        const last = i === steps.length - 1;
        return (
          <li key={s.label} className="relative flex flex-1 gap-3 pb-4 last:pb-0 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center">
            {/* Connector to the next step: down on phones, across from sm. */}
            {!last && (
              <span
                aria-hidden
                className={cx(
                  "absolute top-7 bottom-0 left-[13px] w-0.5 sm:top-[13px] sm:right-[-50%] sm:bottom-auto sm:left-1/2 sm:h-0.5 sm:w-auto",
                  s.done ? "bg-emerald-400" : "bg-slate-200",
                )}
              />
            )}
            <span
              className={cx(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-white",
                s.done ? "bg-emerald-500 text-white" : danger ? "bg-accent-600 text-white" : active ? "bg-brand-700 text-white" : "bg-slate-200 text-slate-500",
              )}
            >
              {s.done ? <Check className="size-3.5" strokeWidth={3} /> : danger ? <AlertTriangle className="size-3.5" /> : i + 1}
            </span>
            <span className="min-w-0 pt-0.5 sm:px-1 sm:pt-0" aria-current={active ? "step" : undefined}>
              <span className={cx("block text-sm font-semibold sm:text-xs", s.done || active ? "text-slate-900" : "text-slate-400")}>
                {s.label}
              </span>
              <span className={cx("block text-xs", danger ? "font-medium text-accent-600" : active ? "font-medium text-brand-700" : "text-slate-500")}>
                {s.detail}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
