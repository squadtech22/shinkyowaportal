import type { NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2";
import { can, getCurrentUser } from "@/lib/admin/auth";
import { fiscalYearLabel, ledger, parseLedgerSearch, STATUS_INFO } from "@/lib/admin/finance";
import { db } from "@/lib/db";

// The purchase ledger as a CSV that opens in Excel, with one column per
// expense type (the columns of the old yearly sheets).
export async function GET(request: NextRequest) {
  if (!can(await getCurrentUser(), "finance.view")) return new Response("Forbidden", { status: 403 });
  const filters = parseLedgerSearch(Object.fromEntries(request.nextUrl.searchParams));
  const [rows, [types]] = await Promise.all([
    ledger(filters),
    db.query<RowDataPacket[]>("SELECT id, name FROM expense_types ORDER BY id"),
  ]);

  const header = [
    "Stock ID", "Salesperson (CSR)", "Country", "Customer", "Company", "Make/Model", "Mileage", "Color", "Chassis",
    "Lot #", "Auction", "Purchase date", "Payment term %", "Currency", "C&F", "Ex-rate", "CNF in JPY", "Bought",
    ...types.map((t) => String(t.name)), "Total cost", "Profit/Loss", "Received", "Balance", "Paid in Japan", "Vessel",
    "ETD", "ETA", "Status", "On website", "Notes",
  ];
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      `SKI-${r.sid}`, r.agent, r.country, r.customer, r.company, r.title, r.mileage, r.color, r.chassis, r.lotNo,
      r.auction, r.purchaseDate, r.depositPercent, r.currency, r.cnf, r.rate, r.saleJpy, r.bought,
      ...types.map((t) => r.expenses[Number(t.id)] ?? ""), r.totalCost, r.profit, r.cnf ? r.paid : "", r.balance,
      r.japanPaid, r.vessel, r.etd, r.eta, STATUS_INFO[r.status].label, r.isListed ? "Yes" : "No", r.notes,
    ]
      .map(cell)
      .join(","),
  );
  const name = filters.year === null ? "all-years" : fiscalYearLabel(filters.year).replace(/[^\w]+/g, "-");
  // BOM so Excel reads the file as UTF-8.
  return new Response("﻿" + [header.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shinkyowa-ledger-${name}.csv"`,
    },
  });
}
