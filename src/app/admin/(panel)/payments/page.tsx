import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import { Paperclip, Plus, Wallet } from "lucide-react";
import PaymentBalance, { alertRowClass, PaymentStatus, type PaymentFlowRow } from "@/components/admin/PaymentDue";
import PaymentReview from "@/components/admin/PaymentReview";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Pager, SearchBar, Table, Tabs, Td, Th } from "@/components/admin/ui";
import { approvePayment, rejectPayment, unapprovePayment } from "@/actions/admin/payments";
import { can, customerScope, requireUser } from "@/lib/admin/auth";
import { getFormat } from "@/lib/admin/display";
import { date } from "@/lib/admin/format";
import { PAYMENT_ALERT_SQL, PAYMENT_FLOW_COLUMNS } from "@/lib/admin/payments";
import { db } from "@/lib/db";

export const metadata = { title: "Payments" };

const PER_PAGE = 25;
type Search = Promise<{ q?: string; status?: string; page?: string }>;

const STATUS_WHERE: Record<string, string> = {
  pending: "p.status = 'not approved'",
  approved: "p.status = 'approved'",
  rejected: "p.status = 'rejected'",
  overdue: `(${PAYMENT_ALERT_SQL}) IS NOT NULL`,
};

export default async function Payments({ searchParams }: { searchParams: Search }) {
  const { yen, money } = await getFormat();
  const user = await requireUser("payments.view");
  const { q = "", status = "all", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const scope = customerScope(user);

  const where = [scope.sql];
  const params: unknown[] = [...scope.params];
  if (STATUS_WHERE[status]) where.push(STATUS_WHERE[status]);
  if (q.trim()) {
    where.push("CONCAT_WS(' ', c.name, c.company, c.cid, p.description) LIKE ?");
    params.push(`%${q.trim().replace(/[\\%_]/g, "\\$&")}%`);
  }
  const joins = "FROM payments p JOIN customer_accounts c ON c.id = p.customer_account_id";
  const from = `${joins} WHERE ${where.join(" AND ")}`;

  const [[[sum]], [[overdue]], [counts], [rows]] = await Promise.all([
    db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total, COALESCE(SUM(p.in_yen), 0) AS yen ${from}`, params),
    db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM payments p JOIN customer_accounts c ON c.id = p.customer_account_id
       WHERE ${scope.sql} AND ${STATUS_WHERE.overdue}`,
      scope.params,
    ),
    db.query<RowDataPacket[]>(
      `SELECT p.status, COUNT(*) AS n FROM payments p JOIN customer_accounts c ON c.id = p.customer_account_id
       WHERE ${scope.sql} GROUP BY p.status`,
      scope.params,
    ),
    db.query<RowDataPacket[]>(
      `SELECT p.*, ${PAYMENT_FLOW_COLUMNS}, c.id AS customer_id, c.name AS customer, s.sid
       ${joins}
       LEFT JOIN stocks s ON s.id = p.stock_id
       WHERE ${where.join(" AND ")}
       ORDER BY p.payment_date DESC, p.id DESC LIMIT ? OFFSET ?`,
      [...params, PER_PAGE, (page - 1) * PER_PAGE],
    ),
  ]);
  const count = (s: string) => Number(counts.find((r) => r.status === s)?.n ?? 0);
  const total = Number(sum.total);
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, ...p })) if (v && !(k === "status" && v === "all")) sp.set(k, String(v));
    return `/admin/payments${sp.size ? `?${sp}` : ""}`;
  };
  const canApprove = can(user, "payments.approve");
  const canManage = can(user, "payments.manage");
  const tab = (key: string, label: string, n: number) => ({ key, label, href: href({ status: key, page: undefined }), count: n });

  return (
    <>
      <PageHeader
        title="Payments"
        description={
          canApprove
            ? "Telegraphic transfers (TT) recorded by your team. Approve each advance and balance once the money is in the bank."
            : "Telegraphic transfers (TT) received from customers. The admin approves each one once the money is in the bank."
        }
        actions={canManage && <ButtonLink href="/admin/payments/new" icon={Plus}>Record payment</ButtonLink>}
      />
      <Tabs
        active={status}
        tabs={[
          tab("all", "All", count("approved") + count("not approved") + count("rejected")),
          tab("pending", "Waiting for approval", count("not approved")),
          tab("approved", "Approved", count("approved")),
          tab("rejected", "Not received", count("rejected")),
          tab("overdue", "Not paid on time", Number(overdue.n)),
        ]}
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchBar placeholder="Search customer or description" value={q} keep={{ status: status === "all" ? undefined : status }} />
          <p className="text-sm text-slate-500">
            {total} {total === 1 ? "payment" : "payments"} · <span className="font-semibold text-slate-900">{yen(Number(sum.yen))}</span>
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={
              status === "pending" ? "Nothing waiting for approval"
                : status === "overdue" ? "Every balance is on time"
                : status === "rejected" ? "No payments marked as not received"
                : "No payments found"
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th className="md:max-lg:hidden">Description</Th>
                <Th className="text-right">Amount</Th>
                <Th>Balance &amp; due</Th>
                <Th>Status</Th>
                <Th className="text-right"><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {(rows as (RowDataPacket & PaymentFlowRow)[]).map((p) => (
                <tr key={p.id} className={alertRowClass(p.alert)}>
                  <Td label="Date" className="whitespace-nowrap text-slate-600">
                    <div>
                      {date(p.payment_date)}
                      {p.payment_recieved_date && <p className="text-xs text-slate-500">Received {date(p.payment_recieved_date)}</p>}
                    </div>
                  </Td>
                  <Td className="max-md:order-first">
                    <Link href={`/admin/customers/${p.customer_id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {p.customer}
                    </Link>
                    {p.recorded_by && <p className="text-xs text-slate-500">by {p.recorded_by}</p>}
                  </Td>
                  <Td label="Description" className="md:max-lg:hidden max-w-xs">
                    <div className="min-w-0">
                      <p className="truncate">
                        <Badge tone={p.kind === "balance" ? "blue" : "slate"}>{p.kind === "balance" ? "Balance" : "Advance"}</Badge>{" "}
                        {p.description}
                      </p>
                      <p className="text-xs text-slate-500">
                        {p.sid ? `SKI-${p.sid}` : "Whole account"}
                        {p.file && (
                          <a href={`/admin/files/${p.file}`} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 font-medium text-brand-600 hover:underline">
                            <Paperclip className="size-3" /> TT copy
                          </a>
                        )}
                      </p>
                    </div>
                  </Td>
                  <Td label="Amount" className="text-right">
                    <div>
                      <p className="font-semibold tabular-nums">{money(p.amount, "$")}</p>
                      <p className="text-xs text-slate-500 tabular-nums">{yen(p.in_yen)}</p>
                    </div>
                  </Td>
                  <Td label="Balance">
                    <PaymentBalance
                      row={p}
                      money={(n) => money(n, "$")}
                      payHref={canManage ? `/admin/payments/${p.id}/balance` : undefined}
                    />
                  </Td>
                  <Td label="Status"><PaymentStatus row={p} /></Td>
                  <Td actions className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-3">
                      {canApprove && (
                        <PaymentReview
                          status={p.status}
                          approve={approvePayment.bind(null, p.id)}
                          reject={rejectPayment.bind(null, p.id)}
                          undo={unapprovePayment.bind(null, p.id)}
                        />
                      )}
                      {canManage && (p.status !== "approved" || canApprove) && (
                        <Link href={`/admin/payments/${p.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-800">
                          Edit
                        </Link>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="border-t border-slate-100">
          <Pager page={page} lastPage={lastPage} total={total} hrefFor={(p) => href({ page: p })} />
        </div>
      </Card>
    </>
  );
}
