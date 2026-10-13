import { can, getCurrentUser } from "@/lib/admin/auth";
import { IMPORT_COLUMNS } from "@/lib/admin/stock-import";
import { writeXlsx } from "@/lib/admin/xlsx";

// Empty import sheet with the same columns as the yearly "SHINKYOWA" sheets,
// one example row (skipped on import) and a sheet explaining every column.
export async function GET() {
  if (!can(await getCurrentUser(), "stock.manage")) return new Response("Forbidden", { status: 403 });
  const file = writeXlsx([
    {
      name: "Vehicles",
      rows: [IMPORT_COLUMNS.map((c) => c.header), IMPORT_COLUMNS.map((c) => c.example)],
      widths: IMPORT_COLUMNS.map((c) => Math.max(10, c.header.length + 4, String(c.example ?? "").length + 2)),
    },
    {
      name: "How to fill",
      rows: [
        ["Column", "What to enter"],
        ...IMPORT_COLUMNS.map((c) => [c.header, c.help]),
        ["", ""],
        ["", "One row per vehicle. Only CHASSIS is required; empty cells keep what is already saved."],
        ["", "Importing the same file again updates the vehicles (matched on chassis) instead of adding them twice."],
        ["", "The example row (chassis starting with EXAMPLE) is skipped — overwrite or delete it."],
        ["", "Your existing yearly sheets can be imported as they are; columns are found by their header."],
      ],
      widths: [18, 110],
    },
  ]);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="shinkyowa-stock-import-template.xlsx"',
    },
  });
}
