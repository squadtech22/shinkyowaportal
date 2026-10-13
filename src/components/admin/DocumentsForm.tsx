"use client";

import { CheckCircle2, CircleDashed, FileText } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "./forms";
import { Card, CardHeader } from "./ui";
import type { ActionState } from "@/lib/admin/actions";
import { DOCUMENT_TYPES, type DocumentKey } from "@/lib/documents";

const fileInput =
  "block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100";

/** One row per export document: current file, a file input to upload/replace, and a remove tick. */
export default function DocumentsForm({
  action,
  files,
  canManage,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  /** Stored file name per document, or null when not uploaded. */
  files: Record<DocumentKey, string | null>;
  canManage: boolean;
}) {
  const rows = (
    <ul className="divide-y divide-slate-100">
      {DOCUMENT_TYPES.map((doc) => {
        const stored = files[doc.key];
        return (
          <li key={doc.key} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
            <div className="flex items-start gap-3">
              {stored ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              ) : (
                <CircleDashed className="mt-0.5 size-5 shrink-0 text-slate-300" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{doc.label}</p>
                {stored ? (
                  <a href={`/admin/files/${stored}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                    <FileText className="size-3.5" /> Open current file
                  </a>
                ) : (
                  <p className="text-xs text-slate-500">Not uploaded yet</p>
                )}
              </div>
            </div>
            {canManage && (
              <div className="space-y-2">
                <Field label={stored ? "Replace with" : "Upload"} name={doc.key}>
                  <input id={doc.key} name={doc.key} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={fileInput} />
                </Field>
                {stored && (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" name={`remove_${doc.key}`} className="size-3.5 accent-accent-600" /> Remove this file
                  </label>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (!canManage) {
    return (
      <Card>
        <CardHeader title="Export documents" />
        {rows}
      </Card>
    );
  }
  return (
    <AdminForm action={action} resetOnSuccess className="space-y-6">
      <Card>
        <CardHeader title="Export documents" description="PDF or image, up to 8 MB each. The customer can download them from their portal." />
        {rows}
      </Card>
      <div className="flex justify-end">
        <SubmitButton>Save documents</SubmitButton>
      </div>
    </AdminForm>
  );
}
