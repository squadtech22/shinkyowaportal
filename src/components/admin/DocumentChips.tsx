import { cx } from "./ui";
import { DOCUMENT_TYPES } from "@/lib/documents";

/**
 * Which export documents a vehicle has, as small chips (green = uploaded).
 * `row` holds the document columns; with `fileBase` (e.g. "/admin/files/")
 * each uploaded chip opens its file.
 */
export default function DocumentChips({
  row,
  fileBase,
}: {
  row: Record<string, unknown>;
  fileBase?: string;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {DOCUMENT_TYPES.map((doc) => {
        const stored = row[doc.key] ? String(row[doc.key]) : null;
        const cls = cx(
          "rounded px-1.5 py-0.5 text-[11px] leading-none font-medium whitespace-nowrap",
          stored ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400",
        );
        return stored && fileBase ? (
          <a key={doc.key} href={`${fileBase}${stored}`} target="_blank" rel="noreferrer" title={`Open ${doc.label}`} className={cx(cls, "hover:bg-emerald-100")}>
            {doc.short}
          </a>
        ) : (
          <span key={doc.key} title={`${doc.label}: ${stored ? "uploaded" : "missing"}`} className={cls}>
            {doc.short}
          </span>
        );
      })}
    </span>
  );
}
