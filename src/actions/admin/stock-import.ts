"use server";

import { revalidatePath } from "next/cache";
import { authorize, can, NotAllowedError } from "@/lib/admin/auth";
import { guessSheet, parseSheet, runImport, type ImportRow, type ImportSummary } from "@/lib/admin/stock-import";
import { readCsv, readXlsx, SpreadsheetError, type Sheet } from "@/lib/admin/xlsx";

const MAX_BYTES = 20 * 1024 * 1024;

export type ImportResult = {
  error?: string;
  fileName?: string;
  sheets?: string[];
  sheet?: string;
  headerRow?: number;
  columns?: { header: string; mapped: boolean }[];
  ignored?: number;
  rows?: ImportRow[];
  summary?: ImportSummary;
  committed?: boolean;
  costs?: boolean;
  shipments?: boolean;
} | null;

/**
 * Checks (mode "preview") or imports (mode "import") vehicles from an Excel
 * or CSV file. The same file is sent both times, so nothing is kept between.
 */
export async function importStock(_prev: ImportResult, form: FormData): Promise<ImportResult> {
  try {
    const user = await authorize("stock.manage", "customers.manage");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel (.xlsx) or CSV file." };
    if (file.size > MAX_BYTES) return { error: "The file is larger than 20 MB." };
    const buf = Buffer.from(await file.arrayBuffer());
    let sheets: Sheet[];
    if (/\.csv$/i.test(file.name)) sheets = [readCsv(buf.toString("utf8"), file.name)];
    else if (/\.xlsx$/i.test(file.name)) sheets = readXlsx(buf);
    else return { error: "Use an .xlsx file (Excel 2007 or newer) or a .csv file. Old .xls files: open in Excel and Save As .xlsx." };

    const requested = String(form.get("sheet") ?? "");
    const sheet = sheets.find((s) => s.name === requested) ?? guessSheet(sheets) ?? sheets[0];
    const base = { fileName: file.name, sheets: sheets.map((s) => s.name), sheet: sheet?.name };
    const parsed = sheet ? parseSheet(sheet) : null;
    if (!parsed) {
      return { ...base, error: `No header row with a CHASSIS column was found in "${sheet?.name ?? file.name}". Choose another sheet or use the template.` };
    }

    const commit = form.get("mode") === "import";
    const costs = can(user, "finance.manage");
    const shipments = can(user, "shipments.manage");
    const { rows, summary } = await runImport(parsed, { commit, costs, shipments, sheetName: sheet.name, actorId: user.id, user });
    if (commit) revalidatePath("/admin", "layout");
    return {
      ...base,
      headerRow: parsed.headerRow,
      columns: parsed.columns.map((c) => ({ header: c.header, mapped: c.field !== null })),
      ignored: parsed.ignored,
      rows,
      summary,
      committed: commit,
      costs,
      shipments,
    };
  } catch (err) {
    if (err instanceof SpreadsheetError || err instanceof NotAllowedError) return { error: err.message };
    console.error("[stock import]", err);
    return { error: "The file could not be imported. Nothing was changed." };
  }
}
