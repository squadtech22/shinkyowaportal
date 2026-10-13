"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { formReader, runAction, ValidationError, type ActionState } from "@/lib/admin/actions";
import { authorize } from "@/lib/admin/auth";
import { commissionAmount, isPeriod, openPeriodFor, periodLabel, vehicleProfit, type CommissionType } from "@/lib/admin/commissions";
import { setFlash } from "@/lib/admin/flash";
import { getFormat } from "@/lib/admin/display";

const refresh = () => {
  revalidatePath("/admin/commissions");
  revalidatePath("/admin/my-commission");
};

async function transaction<T>(body: (conn: PoolConnection) => Promise<T>) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await body(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Serializes approval, payment and new commission for the same staff member.
async function lockStaff(conn: PoolConnection, userId: number) {
  const [[user]] = await conn.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId]);
  if (!user) throw new ValidationError({ user_id: "Staff member not found" });
}

async function payoutTransaction<T>(payoutId: number, body: (conn: PoolConnection, payout: RowDataPacket | undefined) => Promise<T>) {
  return transaction(async (conn) => {
    const [[initial]] = await conn.query<RowDataPacket[]>("SELECT user_id FROM commission_payouts WHERE id = ?", [payoutId]);
    if (initial) await lockStaff(conn, Number(initial.user_id));
    const [[payout]] = await conn.query<RowDataPacket[]>(
      "SELECT p.*, u.name FROM commission_payouts p JOIN users u ON u.id = p.user_id WHERE p.id = ? FOR UPDATE", [payoutId],
    );
    return body(conn, payout);
  });
}

/** Type and rate fields: a percentage (0–100) or a fixed JPY amount. */
function readRate(f: ReturnType<typeof formReader>) {
  const type = f.oneOf("type", ["percent", "fixed"] as const, "Commission type") as CommissionType;
  const text = f.raw("rate").replace(/[,\s%¥]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) f.errors.rate = type === "fixed" ? "Enter an amount" : "Enter a percentage";
  else if (type === "percent" && Number(text) > 100) f.errors.rate = "At most 100%";
  return { type, rate: Number(text) };
}

/** Works out the amount from the vehicle's current profit. */
async function amountFor(stockId: number, type: CommissionType, rate: number) {
  const vehicle = await vehicleProfit(stockId);
  if (!vehicle) throw new ValidationError({ stock_id: "Vehicle not found" });
  const amount = commissionAmount(type, rate, vehicle.profit);
  if (amount === null) {
    throw new ValidationError({
      rate: "This vehicle has no profit yet (it needs a sale price, exchange rate and costs). Use a fixed amount or complete the costs first.",
    });
  }
  return { amount, profit: vehicle.profit };
}

/** Adds commission to the staff member's open month; returns the amount and month. */
async function insertCommission(
  actorId: number,
  c: { stockId: number; userId: number; type: CommissionType; rate: number; note: string | null },
) {
  const { amount, profit } = await amountFor(c.stockId, c.type, c.rate);
  return transaction(async (conn) => {
    await lockStaff(conn, c.userId);
    const [dupe] = await conn.query<RowDataPacket[]>("SELECT id FROM commissions WHERE stock_id = ? AND user_id = ?", [c.stockId, c.userId]);
    if (dupe.length) throw new ValidationError({ user_id: "This person already has commission on this vehicle" });
    const period = await openPeriodFor(c.userId, conn);
    await conn.query(
      `INSERT INTO commissions (stock_id, user_id, period, type, rate, profit, amount, note, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())`,
      [c.stockId, c.userId, period, c.type, c.rate, profit, amount, c.note, actorId],
    );
    return { amount, period };
  });
}

/** Add (id null) or edit a commission from the full form. Only commission not yet approved can be edited. */
export async function saveCommission(id: number | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { yen } = await getFormat();
  return runAction(async () => {
    const actor = await authorize("commission.manage");
    const f = formReader(form);
    const { type, rate } = readRate(f);
    const note = f.optional("note", 255);
    let period: string;
    if (id) {
      f.done();
      const [[row]] = await db.query<RowDataPacket[]>("SELECT stock_id, status, period FROM commissions WHERE id = ?", [id]);
      if (!row) return { error: "Commission not found." };
      if (row.status !== "pending") return { error: "This month is already approved; the commission can no longer be changed." };
      const { amount, profit } = row.stock_id
        ? await amountFor(Number(row.stock_id), type, rate)
        : { amount: type === "fixed" ? Math.round(rate) : 0, profit: null };
      const [updated] = await db.query<ResultSetHeader>(
        "UPDATE commissions SET type = ?, rate = ?, profit = ?, amount = ?, note = ?, updated_at = NOW() WHERE id = ? AND status = 'pending'",
        [type, rate, profit, amount, note, id],
      );
      if (!updated.affectedRows) return { error: "This month was just approved; the commission can no longer be changed." };
      period = String(row.period);
      await setFlash(`Commission updated: ${yen(amount)}`);
    } else {
      const stockId = f.id("stock_id", { required: true, label: "Vehicle" });
      const userId = f.id("user_id", { required: true, label: "Staff member" });
      f.done();
      const added = await insertCommission(actor.id, { stockId: stockId!, userId: userId!, type, rate, note });
      period = added.period;
      await setFlash(`Commission of ${yen(added.amount)} added to ${periodLabel(period)}`);
    }
    refresh();
    redirect(`/admin/commissions?month=${period}`);
  });
}

/** Inline "Add" on the Commissions page for a sold vehicle's salesperson. */
export async function quickAddCommission(stockId: number, userId: number, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { yen } = await getFormat();
  return runAction(async () => {
    const actor = await authorize("commission.manage");
    const f = formReader(form);
    const { type, rate } = readRate(f);
    f.done();
    const { amount, period } = await insertCommission(actor.id, { stockId, userId, type, rate, note: null });
    refresh();
    return { ok: true, message: `${yen(amount)} added to ${periodLabel(period)}` };
  });
}

/**
 * Approves one staff member's month: a payout with the total goes to finance.
 * Returns false when they had nothing waiting.
 */
async function approveMonthFor(actorId: number, userId: number, period: string) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await lockStaff(conn, userId);
    const [pending] = await conn.query<RowDataPacket[]>(
      "SELECT id, amount FROM commissions WHERE user_id = ? AND period = ? AND status = 'pending' FOR UPDATE",
      [userId, period],
    );
    if (!pending.length) {
      await conn.rollback();
      return false;
    }
    const total = pending.reduce((sum, row) => sum + Number(row.amount), 0);
    const [[existing]] = await conn.query<RowDataPacket[]>(
      "SELECT id, status FROM commission_payouts WHERE user_id = ? AND period = ? FOR UPDATE",
      [userId, period],
    );
    if (existing?.status === "paid") throw new ValidationError({ period: "This month was already paid. Move the new commission to next month." });
    let payoutId: number;
    if (existing) {
      // Commission added after approval joins the payout finance has not paid yet.
      payoutId = Number(existing.id);
      await conn.query(
        "UPDATE commission_payouts SET amount = amount + ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?",
        [total, actorId, payoutId],
      );
    } else {
      const [res] = await conn.query<ResultSetHeader>(
        `INSERT INTO commission_payouts (user_id, period, amount, status, approved_by, approved_at, created_at, updated_at)
         VALUES (?, ?, ?, 'approved', ?, NOW(), NOW(), NOW())`,
        [userId, period, total, actorId],
      );
      payoutId = res.insertId;
    }
    await conn.query(
      "UPDATE commissions SET status = 'approved', payout_id = ?, updated_at = NOW() WHERE id IN (?) AND status = 'pending'",
      [payoutId, pending.map((row) => row.id)],
    );
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function approveMonth(userId: number, period: string): Promise<ActionState> {
  return runAction(async () => {
    const actor = await authorize("commission.approve");
    if (!isPeriod(period)) return { error: "Invalid month." };
    if (!(await approveMonthFor(actor.id, userId, period))) return { error: "Nothing waiting for approval." };
    await setFlash(`${periodLabel(period)} approved — sent to finance`);
    refresh();
  });
}

export async function approveWholeMonth(period: string): Promise<ActionState> {
  return runAction(async () => {
    const actor = await authorize("commission.approve");
    if (!isPeriod(period)) return { error: "Invalid month." };
    const [users] = await db.query<RowDataPacket[]>(
      "SELECT DISTINCT user_id FROM commissions WHERE period = ? AND status = 'pending'",
      [period],
    );
    let n = 0;
    for (const u of users) if (await approveMonthFor(actor.id, Number(u.user_id), period)) n++;
    await setFlash(`${periodLabel(period)}: ${n} staff member${n === 1 ? "" : "s"} approved — sent to finance`);
    refresh();
  });
}

/** Takes an approved month back from finance (before it is paid). */
export async function unapprovePayout(payoutId: number): Promise<ActionState> {
  return runAction(async () => {
    await authorize("commission.approve");
    const error = await payoutTransaction(payoutId, async (conn, p) => {
      if (!p) return "Not found.";
      if (p.status !== "approved") return "Already completed by finance.";
      await conn.query("UPDATE commissions SET status = 'pending', payout_id = NULL, updated_at = NOW() WHERE payout_id = ?", [payoutId]);
      await conn.query("DELETE FROM commission_payouts WHERE id = ?", [payoutId]);
    });
    if (error) return { error };
    await setFlash("Approval withdrawn — back to waiting for approval");
    refresh();
  });
}

/** Finance: the staff member's month is paid. */
export async function completePayout(payoutId: number, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { yen } = await getFormat();
  return runAction(async () => {
    const actor = await authorize("commission.pay");
    const f = formReader(form);
    const ref = f.optional("payment_ref", 150);
    f.done();
    const result = await payoutTransaction(payoutId, async (conn, p) => {
      if (!p) return { error: "Not found." };
      if (p.status !== "approved") return { error: "Already completed." };
      await conn.query(
        "UPDATE commission_payouts SET status = 'paid', paid_by = ?, paid_at = NOW(), payment_ref = ?, updated_at = NOW() WHERE id = ?",
        [actor.id, ref, payoutId],
      );
      await conn.query("UPDATE commissions SET status = 'paid', updated_at = NOW() WHERE payout_id = ?", [payoutId]);
      return { payout: p };
    });
    if (result.error) return { error: result.error };
    const p = result.payout!;
    await setFlash(`${p.name} · ${periodLabel(String(p.period))}: ${yen(Number(p.amount))} completed`);
    refresh();
  });
}

export async function deleteCommission(id: number): Promise<ActionState> {
  return runAction(async () => {
    await authorize("commission.manage");
    const [[row]] = await db.query<RowDataPacket[]>("SELECT status FROM commissions WHERE id = ?", [id]);
    if (!row) return { error: "Commission not found." };
    if (row.status !== "pending") return { error: "This month is already approved. Withdraw the approval first." };
    const [deleted] = await db.query<ResultSetHeader>("DELETE FROM commissions WHERE id = ? AND status = 'pending'", [id]);
    if (!deleted.affectedRows) return { error: "This month was just approved. Withdraw the approval first." };
    await setFlash("Commission removed");
    refresh();
  });
}
