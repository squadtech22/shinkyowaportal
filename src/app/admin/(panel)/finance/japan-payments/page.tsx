import Link from "next/link";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import FinanceFilters from "@/components/admin/FinanceFilters";
import { ConfirmButton } from "@/components/admin/forms";
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader, Pager, Table, Td, Th } from "@/components/admin/ui";
import { deleteJapanPayment } from "@/actions/admin/finance";
import { can, requireUser } from "@/lib/admin/auth";
import { fiscalYearLabel, fiscalYearOf, fiscalYears, JAPAN_PER_PAGE, listJapanPayments } from "@/lib/admin/finance";
import { getFormat } from "@/lib/admin/display";
import { date } from "@/lib/admin/format";

export const metadata = { title: "Japan payments" };

type Search = Promise<{ year?: string; q?: string; page?: string }>;

export default async function JapanPayments({ searchParams }: { searchParams: Search }) {
  const { yen } = await getFormat();
  const user = await requireUser("finance.view");
  const sp = await searchParams;
  const yearParam = sp.year === "all" || /^\d{4}$/.test(sp.year ?? "") ? sp.year! : String(fiscalYearOf(new Date()));
  const year = yearParam === "all" ? null : Number(yearParam);
  const page = Math.max(1, Number(sp.page) || 1);
  const canManage = can(user, "finance.manage");

  const [years, list] = await Promise.all([fiscalYears(), listJapanPayments(year, sp.q ?? "", page)]);
  const lastPage = Math.max(1, Math.ceil(list.count / JAPAN_PER_PAGE));
  const href = (p: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ year: yearParam, q: sp.q, ...p })) if (v) q.set(k, String(v));
    return `/admin/finance/japan-payments?${q}`;
  };

  return (
    <>
      <PageHeader
        title="Japan payments"
        description="Money paid out in Japan: auction houses, transport, freight. Link a payment to a vehicle to track what is still owed on it."
        actions={canManage && <ButtonLink href="/admin/finance/japan-payments/new" icon={Plus}>Record payment</ButtonLink>}
      />

      <Card>
        <CardHeader
          title={`${year === null ? "All years" : fiscalYearLabel(year)}: ${yen(list.total)}`}
          description={`${list.count} payment${list.count === 1 ? "" : "s"}`}
        />
        <FinanceFilters years={years} values={{ year: yearParam, q: sp.q }} search="Paid to, reference, vehicle" />
        {list.rows.length === 0 ? (
          <EmptyState icon={Landmark} title="No payments in this period" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Paid to</Th>
                <Th>Date</Th>
                <Th>Vehicle</Th>
                <Th>Reference</Th>
                <Th className="text-right">Amount</Th>
                {canManage && <Th className="text-right"><span className="sr-only">Actions</span></Th>}
              </tr>
            </thead>
            <tbody>
              {list.rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <Td>
                    <p className="font-medium">{p.payee}</p>
                    {p.note && <p className="text-xs text-slate-500">{p.note}</p>}
                  </Td>
                  <Td label="Date" className="whitespace-nowrap text-slate-600">{date(p.payment_date)}</Td>
                  <Td label="Vehicle" className="text-slate-600">
                    {p.stock_id ? (
                      <Link href={`/admin/stock/${p.stock_id}`} className="hover:text-brand-700">
                        SKI-{p.sid} · {p.car_year} {p.make} {p.model}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td label="Reference" className="text-slate-600">{p.reference ?? "—"}</Td>
                  <Td label="Amount" className="text-right font-medium tabular-nums">{yen(Number(p.amount))}</Td>
                  {canManage && (
                    <Td actions className="text-right whitespace-nowrap">
                      <span className="inline-flex gap-2">
                        <ButtonLink href={`/admin/finance/japan-payments/${p.id}`} variant="secondary" size="sm" icon={Pencil}>Edit</ButtonLink>
                        <ConfirmButton action={deleteJapanPayment.bind(null, Number(p.id))} title="Delete this payment?">
                          <Trash2 className="size-3.5" />
                        </ConfirmButton>
                      </span>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="border-t border-slate-100">
          <Pager page={page} lastPage={lastPage} total={list.count} hrefFor={(p) => href({ page: p })} />
        </div>
      </Card>
    </>
  );
}
