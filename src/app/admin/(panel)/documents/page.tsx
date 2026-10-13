import Link from "next/link";
import { FileText } from "lucide-react";
import DocumentChips from "@/components/admin/DocumentChips";
import { Card, EmptyState, PageHeader, Pager, SearchBar, Table, Tabs, Td, Th } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/admin/auth";
import { DOCUMENT_FILTERS, DOCUMENTS_PER_PAGE, listDocuments, type DocumentFilter } from "@/lib/admin/documents";
import { date } from "@/lib/admin/format";

export const metadata = { title: "Documents" };

type Search = Promise<{ q?: string; status?: string; page?: string }>;

const LABELS: Record<DocumentFilter, string> = { missing: "Missing papers", complete: "Complete", all: "All" };

export default async function Documents({ searchParams }: { searchParams: Search }) {
  const user = await requireUser("documents.view");
  const { q = "", status: statusParam = "missing", page: pageParam } = await searchParams;
  const status = (DOCUMENT_FILTERS as readonly string[]).includes(statusParam) ? (statusParam as DocumentFilter) : "missing";
  const page = Math.max(1, Number(pageParam) || 1);
  const { rows, counts, total } = await listDocuments(user, q, status, page);
  const lastPage = Math.max(1, Math.ceil(total / DOCUMENTS_PER_PAGE));
  const href = (p: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, ...p })) if (v && !(k === "status" && v === "missing")) sp.set(k, String(v));
    return `/admin/documents${sp.size ? `?${sp}` : ""}`;
  };
  const canManage = can(user, "documents.manage");

  return (
    <>
      <PageHeader
        title="Documents"
        description="Export paperwork for reserved vehicles: export certificates, final invoice, inspection and bill of lading."
      />
      <Tabs
        active={status}
        tabs={DOCUMENT_FILTERS.map((key) => ({ key, label: LABELS[key], href: href({ status: key, page: undefined }), count: counts[key] }))}
      />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchBar placeholder="Stock no., model, chassis or customer" value={q} keep={{ status: status === "missing" ? undefined : status }} />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={q ? "No vehicles match your search" : status === "missing" ? "Every reserved vehicle has all its papers" : "Nothing here yet"}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Vehicle</Th>
                <Th>Customer</Th>
                <Th>Documents</Th>
                <Th className="md:max-lg:hidden">Last upload</Th>
                <Th className="text-right"><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`/admin/documents/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {r.year} {r.make} {r.model}
                    </Link>
                    <p className="text-xs text-slate-500">SKI-{r.sid} · {r.chassis}</p>
                  </Td>
                  <Td label="Customer">
                    <Link href={`/admin/customers/${r.customer_id}`} className="hover:text-brand-700">{r.customer}</Link>
                  </Td>
                  <Td label="Documents"><DocumentChips row={r} fileBase="/admin/files/" /></Td>
                  <Td label="Last upload" className="md:max-lg:hidden whitespace-nowrap text-slate-500">{date(r.documents_updated)}</Td>
                  <Td actions className="text-right">
                    <Link href={`/admin/documents/${r.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-800">
                      {canManage ? "Upload" : "View"}
                    </Link>
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
