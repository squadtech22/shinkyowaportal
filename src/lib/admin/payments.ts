import "server-only";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { customerScope, type AdminUser } from "./auth";
import type { PaymentCustomer } from "@/components/admin/PaymentForm";
import { EFFECTIVE_STATUS_SQL } from "./shipments";

// The payment flow. An advance (kind 'advance') may leave a pending balance
// (pending_amount, due at pending_due_at). When the customer pays it, a
// balance payment (kind 'balance', parent_id = the advance) is recorded.
// Each payment is approved (money received) or rejected (not received) by
// someone with payments.approve; only approved money counts as paid.
//
// The SQL below is on advance payment alias `p`.

/** Balance payments of `p` the admin approved, in USD. */
const BALANCE_PAID_SQL =
  "(SELECT COALESCE(SUM(b.amount), 0) FROM payments b WHERE b.parent_id = p.id AND b.status = 'approved')";

/** What is still owed of the pending balance once approved balance payments are taken off. */
const BALANCE_REMAINING_SQL = `GREATEST(COALESCE(p.pending_amount, 0) - ${BALANCE_PAID_SQL}, 0)`;

/**
 * NULL (no balance), 'done' (fully paid and approved), 'sent' (a balance
 * payment is waiting for approval) or 'open' (still owed).
 */
const BALANCE_STATE_SQL = `CASE
  WHEN p.kind <> 'advance' OR COALESCE(p.pending_amount, 0) <= 0 THEN NULL
  WHEN ${BALANCE_REMAINING_SQL} = 0 THEN 'done'
  WHEN EXISTS (SELECT 1 FROM payments b WHERE b.parent_id = p.id AND b.status = 'not approved') THEN 'sent'
  ELSE 'open' END`;

/**
 * Why a balance still owed needs chasing: 'overdue' once the due date and
 * time has passed, 'arrived' once the vehicle's ship has arrived, else NULL
 * (nothing owed, a payment is waiting for approval, or not yet due).
 */
export const PAYMENT_ALERT_SQL = `CASE
  WHEN p.status = 'rejected' OR COALESCE(${BALANCE_STATE_SQL}, '') <> 'open' THEN NULL
  WHEN p.pending_due_at IS NOT NULL AND p.pending_due_at <= NOW() THEN 'overdue'
  WHEN EXISTS (SELECT 1 FROM shipment_stock ss JOIN shipments sh ON sh.id = ss.shipment_id
               WHERE ss.stock_id = p.stock_id AND ${EFFECTIVE_STATUS_SQL} = 'arrived') THEN 'arrived'
  END`;

/** Columns for PaymentBalance and PaymentReview: select them with `p.*`. */
export const PAYMENT_FLOW_COLUMNS = `${BALANCE_STATE_SQL} AS balance_state,
  ${BALANCE_REMAINING_SQL} AS balance_remaining,
  (SELECT MAX(b.payment_date) FROM payments b WHERE b.parent_id = p.id AND b.status = 'approved') AS balance_paid_date,
  (SELECT b.reject_reason FROM payments b WHERE b.parent_id = p.id AND b.status = 'rejected'
   ORDER BY b.id DESC LIMIT 1) AS balance_reject_reason,
  ${PAYMENT_ALERT_SQL} AS alert,
  (SELECT CONCAT(ru.name, ' (', COALESCE(rr.name, 'no role'), ')') FROM users ru LEFT JOIN roles rr ON rr.id = ru.role_id
   WHERE ru.id = p.user_id) AS recorded_by,
  (SELECT vu.name FROM users vu WHERE vu.id = p.reviewed_by) AS reviewed_by_name`;

/** An advance the user can see, with what is left of its balance, for the balance payment form. */
export async function balanceParent(user: AdminUser, id: number) {
  const scope = customerScope(user);
  const [[row]] = await db.query<RowDataPacket[]>(
    `SELECT p.id, p.kind, p.status, p.description, p.pending_amount, p.pending_due_at, p.customer_account_id,
            ${BALANCE_REMAINING_SQL} AS remaining, c.name AS customer,
            CONCAT('SKI-', s.sid, ' · ', s.year, ' ', COALESCE(m.name, ''), ' ', s.model) AS vehicle
     FROM payments p JOIN customer_accounts c ON c.id = p.customer_account_id
     LEFT JOIN stocks s ON s.id = p.stock_id LEFT JOIN makes m ON m.id = s.make_id
     WHERE p.id = ? AND ${scope.sql}`,
    [id, ...scope.params],
  );
  return row ?? null;
}

/** Customers the user may record payments for, with their reserved vehicles. */
export async function paymentCustomers(user: AdminUser): Promise<PaymentCustomer[]> {
  const scope = customerScope(user);
  const [[customers], [cars]] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT c.id, c.name, cur.symbol, cur.code FROM customer_accounts c
       LEFT JOIN currencies cur ON cur.id = c.currency_id WHERE ${scope.sql} ORDER BY c.name`,
      scope.params,
    ),
    db.query<RowDataPacket[]>(
      `SELECT s.id, s.sid, s.year, s.model, m.name AS make, s.customer_account_id
       FROM stocks s LEFT JOIN makes m ON m.id = s.make_id WHERE s.customer_account_id IS NOT NULL`,
    ),
  ]);
  return customers.map((c) => ({
    id: Number(c.id),
    name: String(c.name),
    symbol: String(c.symbol ?? ""),
    code: String(c.code ?? ""),
    vehicles: cars
      .filter((s) => s.customer_account_id === c.id)
      .map((s) => ({ id: Number(s.id), label: `SKI-${s.sid} · ${s.year} ${s.make ?? ""} ${s.model}` })),
  }));
}
