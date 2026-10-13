import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge, cx } from "./ui";
import { date, dateTime } from "@/lib/admin/format";

export type PaymentAlert = "overdue" | "arrived" | null;

/** A payment row selected with `p.*` and PAYMENT_FLOW_COLUMNS (lib/admin/payments.ts). */
export type PaymentFlowRow = {
  id: number;
  kind: "advance" | "balance";
  status: "approved" | "not approved" | "rejected";
  reject_reason: string | null;
  reviewed_by_name: string | null;
  pending_amount: number | null;
  pending_due_at: Date | string | null;
  balance_state: "open" | "sent" | "done" | null;
  balance_remaining: number | string | null;
  balance_paid_date: Date | string | null;
  balance_reject_reason: string | null;
  alert: PaymentAlert;
};

/** Row classes for a payment whose pending balance needs chasing. */
export const alertRowClass = (alert: PaymentAlert) =>
  alert ? "bg-accent-50/70 shadow-[inset_3px_0_0_var(--color-accent-600)] hover:bg-accent-50" : "hover:bg-slate-50/60";

/** Approved / waiting for the admin / not received, with the admin's reason. */
export function PaymentStatus({ row }: { row: Pick<PaymentFlowRow, "status" | "reject_reason" | "reviewed_by_name"> }) {
  if (row.status === "approved") {
    return (
      <div>
        <Badge tone="green"><CheckCircle2 className="size-3" /> Approved</Badge>
        {row.reviewed_by_name && <p className="mt-0.5 text-xs text-slate-500">by {row.reviewed_by_name}</p>}
      </div>
    );
  }
  if (row.status === "rejected") {
    return (
      <div className="max-w-48">
        <Badge tone="red"><XCircle className="size-3" /> Not received</Badge>
        {row.reject_reason && <p className="mt-0.5 text-xs text-accent-600">{row.reject_reason}</p>}
      </div>
    );
  }
  return <Badge tone="amber"><Clock className="size-3" /> Waiting for approval</Badge>;
}

/** Whole days the balance was paid after its due date (0 when on time). */
function daysLate(paid: Date | string | null, due: Date | string | null) {
  if (!paid || !due) return 0;
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((new Date(paid).getTime() - dueDay.getTime()) / 86_400_000));
}

/**
 * The pending balance of an advance: still owed (red once overdue or the ship
 * has arrived), a payment waiting for approval, or done (noting a late payment).
 */
export default function PaymentBalance({
  row,
  money,
  payHref,
}: {
  row: PaymentFlowRow;
  money: (n: number) => string;
  /** "Customer paid balance" link, for users who record payments. */
  payHref?: string;
}) {
  if (row.kind === "balance") return <Badge tone="blue">Balance payment</Badge>;
  if (!row.balance_state || !row.pending_amount) return <span className="text-slate-400">—</span>;

  if (row.balance_state === "done") {
    const late = daysLate(row.balance_paid_date, row.pending_due_at);
    return (
      <div className="space-y-0.5">
        <Badge tone="green"><CheckCircle2 className="size-3" /> Done</Badge>
        <p className="text-xs text-slate-500 tabular-nums">{money(Number(row.pending_amount))} paid {date(row.balance_paid_date)}</p>
        {late > 0 && <p className="text-xs font-medium text-amber-700">Paid {late} day{late === 1 ? "" : "s"} late</p>}
      </div>
    );
  }

  const remaining = Number(row.balance_remaining);
  const alert = row.alert;
  return (
    <div className="space-y-0.5">
      <p className={cx("font-semibold tabular-nums", alert ? "text-accent-600" : "text-slate-900")}>
        {money(remaining)}
        {remaining < Number(row.pending_amount) && (
          <span className="font-normal text-slate-500"> of {money(Number(row.pending_amount))}</span>
        )}
      </p>
      <p className={cx("text-xs whitespace-nowrap", alert ? "font-medium text-accent-600" : "text-slate-500")}>Due {dateTime(row.pending_due_at)}</p>
      {row.balance_state === "sent" ? (
        <Badge tone="amber"><Clock className="size-3" /> Balance sent · waiting for approval</Badge>
      ) : (
        <>
          {alert && (
            <Badge tone="red">
              <AlertTriangle className="size-3" /> {alert === "overdue" ? "Overdue — not paid" : "Ship arrived — not paid"}
            </Badge>
          )}
          {row.balance_reject_reason && (
            <p className="text-xs text-accent-600">Last balance TT not received: {row.balance_reject_reason}</p>
          )}
          {payHref && row.status !== "rejected" && (
            <Link href={payHref} className="block text-xs font-medium text-brand-600 hover:text-brand-800">
              + Customer paid balance
            </Link>
          )}
        </>
      )}
    </div>
  );
}
