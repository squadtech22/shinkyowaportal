"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react";
import type { ImportResult } from "@/actions/admin/stock-import";
import { Badge, buttonClass, Card, CardHeader, cx, Table, Td, Th } from "./ui";

type Action = (state: ImportResult, data: FormData) => Promise<ImportResult>;

const ACTION_BADGE = {
  create: { label: "New", tone: "green" },
  update: { label: "Update", tone: "blue" },
  skip: { label: "Skip", tone: "slate" },
} as const;

/**
 * Upload → "Check file" shows what will happen → "Import" writes it. The file
 * stays in the input, so the import sends the same file that was checked.
 */
export default function StockImportForm({ action }: { action: Action }) {
  const [state, run, pending] = useActionState(action, null);
  const [mode, setMode] = useState<"preview" | "import">("preview");
  const [fileKey, setFileKey] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // A result belongs to the file it was made from; a new file starts over.
  const [resultFile, setResultFile] = useState(0);
  const result = resultFile === fileKey ? state : null;
  const preview = result && !result.error && !result.committed ? result : null;
  const done = result?.committed ? result : null;

  function submit(next: "preview" | "import", sheet?: string) {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    data.set("mode", next);
    if (sheet !== undefined) data.set("sheet", sheet);
    setMode(next);
    setResultFile(fileKey);
    startTransition(() => run(data));
  }

  const rows = result?.rows ?? [];
  const problems = rows.filter((r) => r.messages.length);
  const shown = showAll ? rows : problems.length ? problems : rows.slice(0, 50);
  const toImport = (result?.summary?.create ?? 0) + (result?.summary?.update ?? 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="1. Choose the file" description="Excel (.xlsx) or CSV. Your yearly SHINKYOWA sheets work as they are, or use the template." />
        <form
          ref={formRef}
          className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            submit("preview");
          }}
        >
          <label className="flex-1">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">File</span>
            <input
              type="file"
              name="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              required
              onChange={() => setFileKey((k) => k + 1)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          </label>
          {result?.sheets && result.sheets.length > 1 && (
            <label className="sm:w-72">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Sheet (tab)</span>
              <select
                name="sheet"
                value={result.sheet}
                onChange={(e) => submit("preview", e.target.value)}
                className="input-base"
                disabled={pending}
              >
                {result.sheets.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending && mode === "preview" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
            Check file
          </button>
        </form>
      </Card>

      {result?.error && (
        <div className="flex items-start gap-2 rounded-xl border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{result.error}</span>
        </div>
      )}

      {done && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>
            Imported from “{done.sheet}”: {done.summary!.create} new vehicles, {done.summary!.update} updated
            {done.summary!.newCustomers.length > 0 && `, ${done.summary!.newCustomers.length} new customers`}
            {done.summary!.newShipments.length > 0 && `, ${done.summary!.newShipments.length} new vessels`}. You can import the same file
            again later — vehicles are matched on chassis.
          </span>
        </div>
      )}

      {result?.summary && (
        <>
          <Card>
            <CardHeader
              title={done ? "What was imported" : "2. Check what will happen"}
              description={`Sheet “${result.sheet}”, headers on row ${result.headerRow}. ${result.ignored ? `${result.ignored} rows without a chassis were ignored.` : ""}`}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <Stat label="New vehicles" value={result.summary.create} tone="text-emerald-700" />
              <Stat label="Existing vehicles updated" value={result.summary.update} tone="text-sky-700" />
              <Stat label="Skipped rows" value={result.summary.skip} tone="text-slate-600" />
            </div>
            <div className="space-y-3 border-t border-slate-100 p-5 text-sm">
              {result.summary.unmatchedStaff.length > 0 && (
                <Notice tone="warn">
                  <b>Staff not found under Users</b> — their vehicles will have no salesperson. Add them first (Team → Users), or
                  fix the name in the sheet, then check again:{" "}
                  {result.summary.unmatchedStaff.map((s) => `${s.name} (${s.rows})`).join(", ")}
                </Notice>
              )}
              {!result.costs && <Notice tone="warn">Purchase costs are not imported: that needs the “Edit costs & Japan payments” permission.</Notice>}
              {!result.shipments && <Notice tone="warn">Vessels are not linked: that needs the “Manage shipments” permission.</Notice>}
              <List label="New customers" items={result.summary.newCustomers} />
              <List label="New vessels" items={result.summary.newShipments} />
              <List label="New auction houses" items={result.summary.newAuctions} />
              <List label="New countries" items={result.summary.newCountries} />
              {result.columns && (
                <p className="text-xs text-slate-500">
                  Columns used: {result.columns.filter((c) => c.mapped).map((c) => c.header.trim()).join(", ")}.
                  {result.columns.some((c) => !c.mapped) && <> Not used (worked out by the system): {result.columns.filter((c) => !c.mapped).map((c) => c.header.trim()).join(", ")}.</>}
                </p>
              )}
            </div>
            {preview && (
              <div className="flex flex-col items-stretch gap-2 border-t border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-end">
                <p className="text-sm text-slate-500 sm:mr-auto">Nothing has been saved yet.</p>
                <button
                  type="button"
                  disabled={pending || toImport === 0}
                  onClick={() => submit("import", preview.sheet)}
                  className={buttonClass("primary")}
                >
                  {pending && mode === "import" && <Loader2 className="size-4 animate-spin" />}
                  Import {toImport} vehicles
                </button>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title={showAll || !problems.length ? "Rows" : `Rows with notes (${problems.length})`}
              actions={
                <button type="button" onClick={() => setShowAll((s) => !s)} className="text-sm font-medium text-brand-600 hover:text-brand-800">
                  {showAll ? "Only rows with notes" : `Show all ${rows.length} rows`}
                </button>
              }
            />
            <Table>
              <thead>
                <tr>
                  <Th>Row</Th>
                  <Th>Vehicle</Th>
                  <Th>Customer</Th>
                  <Th>Salesperson</Th>
                  <Th className="md:max-lg:hidden">Vessel</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.n} className={cx(r.action === "skip" && "opacity-60")}>
                    <Td label="Row" className="text-slate-500 tabular-nums">{r.n}</Td>
                    <Td>
                      <p className="font-medium text-slate-900">{r.title}</p>
                      <p className="text-xs text-slate-500">{r.chassis}</p>
                      {r.messages.map((m) => (
                        <p key={m} className="mt-0.5 flex items-start gap-1 text-xs text-amber-700">
                          <AlertTriangle className="mt-px size-3 shrink-0" />
                          {m}
                        </p>
                      ))}
                    </Td>
                    <Td label="Customer">{r.customer ?? <span className="text-slate-400">—</span>}</Td>
                    <Td label="Salesperson">{r.agent ?? <span className="text-slate-400">—</span>}</Td>
                    <Td label="Vessel" className="md:max-lg:hidden">{r.vessel ?? <span className="text-slate-400">—</span>}</Td>
                    <Td label="Action"><Badge tone={ACTION_BADGE[r.action].tone}>{ACTION_BADGE[r.action].label}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cx("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function Notice({ tone, children }: { tone: "warn"; children: React.ReactNode }) {
  return (
    <p className={cx("flex items-start gap-2 rounded-lg px-3 py-2", tone === "warn" && "bg-amber-50 text-amber-800")}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <p className="text-slate-600">
      <span className="font-medium text-slate-800">{label} ({items.length}):</span> {items.join(", ")}
    </p>
  );
}
