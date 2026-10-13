import Link from "next/link";
import { notFound } from "next/navigation";
import DocumentsForm from "@/components/admin/DocumentsForm";
import EditorFrame from "@/components/admin/EditorFrame";
import { saveDocuments } from "@/actions/admin/documents";
import { can, requireUser } from "@/lib/admin/auth";
import { getVehicleDocuments } from "@/lib/admin/documents";
import { DOCUMENT_KEYS, type DocumentKey } from "@/lib/documents";

/** Upload / replace a vehicle's export documents, as a page or in the drawer. `id` is the stock id. */
export default async function DocumentsEditor({ id, inDrawer }: { id: number; inDrawer?: boolean }) {
  const user = await requireUser("documents.view");
  const v = await getVehicleDocuments(user, id);
  if (!v) notFound();
  const files = Object.fromEntries(DOCUMENT_KEYS.map((k) => [k, v[k] ? String(v[k]) : null])) as Record<DocumentKey, string | null>;

  return (
    <EditorFrame
      inDrawer={inDrawer}
      title={`${v.year} ${v.make ?? ""} ${v.model}`}
      description={
        <>
          SKI-{v.sid} · {v.chassis} ·{" "}
          {v.customer_id ? (
            <Link href={`/admin/customers/${v.customer_id}`} className="font-medium text-brand-700 hover:underline">{v.customer}</Link>
          ) : (
            "Not reserved"
          )}
        </>
      }
      back={{ href: "/admin/documents", label: "Documents" }}
    >
      <DocumentsForm action={saveDocuments.bind(null, v.id)} files={files} canManage={can(user, "documents.manage")} />
    </EditorFrame>
  );
}
