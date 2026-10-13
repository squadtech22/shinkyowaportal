import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { ButtonLink, Card, EmptyState, PageHeader, Pager, SearchBar, Table, Tabs, Td, Th } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/admin/auth";
import { CUSTOMERS_PER_PAGE, listCustomers } from "@/lib/admin/customers";
import { getFormat } from "@/lib/admin/display";

export const metadata = { title: "Customers" };

type Search = Promise<{ q?: string; page?: string; filter?: string }>;

export default async function Customers({ searchParams }: { searchParams: Search }) {
  const { money } = await getFormat();
  const user = await requireUser("customers.view");
  const { q = "", page: pageParam, filter = "all" } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { rows, total } = await listCustomers(user, q, page, filter);
  const lastPage = Math.max(1, Math.ceil(total / CUSTOMERS_PER_PAGE));
  const canManage = can(user, "customers.manage");
  const href = (p: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, filter, ...p })) if (v && !(k === "filter" && v === "all")) sp.set(k, String(v));
    return `/admin/customers${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Customers"
        description={can(user, "customers.view_all") ? "All customer accounts." : "Customers assigned to you."}
        actions={canManage && <ButtonLink href="/admin/customers/new" icon={Plus}>Add customer</ButtonLink>}
      />
      <Tabs
        active={filter}
        tabs={[
          { key: "all", label: "All", href: href({ filter: "all", page: undefined }) },
          { key: "owing", label: "Owing", href: href({ filter: "owing", page: undefined }) },
          { key: "settled", label: "Fully paid", href: href({ filter: "settled", page: undefined }) },
        ]}
      />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchBar placeholder="Search name, company, email, phone" value={q} keep={{ filter: filter === "all" ? undefined : filter }} />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? "No customers match your search" : "No customers yet"}
            description={q ? undefined : "Add a customer to reserve vehicles and record their payments."}
            action={canManage && !q && <ButtonLink href="/admin/customers/new" icon={Plus}>Add customer</ButtonLink>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th className="md:max-lg:hidden">Country</Th>
                <Th className="md:max-lg:hidden">Agent</Th>
                <Th className="text-right">Vehicles</Th>
                <Th className="text-right">Total</Th>
                <Th className="w-48">Paid</Th>
                <Th className="text-right">Balance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const owed = Number(c.owed);
                const paid = Number(c.paid);
                const balance = Math.max(owed - paid, 0);
                const pct = owed > 0 ? Math.min(100, Math.round((paid / owed) * 100)) : 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <Td>
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {c.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {c.cid}
                        {c.company ? ` · ${c.company}` : ""}
                      </p>
                    </Td>
                    <Td label="Country" className="md:max-lg:hidden text-slate-600">{c.country ?? "—"}</Td>
                    <Td label="Agent" className="md:max-lg:hidden text-slate-600">{c.agent ?? <span className="text-slate-400">Unassigned</span>}</Td>
                    <Td label="Vehicles" className="text-right tabular-nums">{c.cars}</Td>
                    <Td label="Total" className="text-right tabular-nums">{owed ? money(owed, c.symbol ?? "") : "—"}</Td>
                    <Td label="Paid">
                      {owed > 0 ? (
                        <div className="flex items-center gap-2 max-md:w-40">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={pct >= 100 ? "h-full bg-emerald-500" : "h-full bg-brand-500"} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-9 text-right text-xs text-slate-500 tabular-nums">{pct}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No vehicles</span>
                      )}
                    </Td>
                    <Td label="Balance" className="text-right font-semibold tabular-nums">
                      {balance > 0 ? money(balance, c.symbol ?? "") : <span className="font-normal text-emerald-600">Paid</span>}
                    </Td>
                  </tr>
                );
              })}
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
