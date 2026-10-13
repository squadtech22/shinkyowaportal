"use server";

import { revalidatePath } from "next/cache";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/admin/auth";
import { CHART_IDS, CHART_TYPES, parseChartPrefs, type ChartId, type ChartType } from "@/lib/admin/chart-prefs";

async function update(change: (prefs: ReturnType<typeof parseChartPrefs>) => void) {
  const user = await getCurrentUser();
  if (!user) return;
  const [[row]] = await db.query<RowDataPacket[]>("SELECT dashboard_prefs FROM users WHERE id = ?", [user.id]);
  const prefs = parseChartPrefs(row?.dashboard_prefs);
  change(prefs);
  await db.query("UPDATE users SET dashboard_prefs = ? WHERE id = ?", [JSON.stringify(prefs), user.id]);
  revalidatePath("/admin");
}

/** Remembers which chart type this user wants for one chart. */
export async function setChartType(chart: ChartId, type: ChartType) {
  if (!CHART_IDS.includes(chart) || !CHART_TYPES.includes(type)) return;
  await update((prefs) => {
    prefs.types[chart] = type;
  });
}

/** Shows or hides a chart on this user's dashboard. */
export async function setChartHidden(chart: ChartId, hidden: boolean) {
  if (!CHART_IDS.includes(chart)) return;
  await update((prefs) => {
    prefs.hidden = hidden ? [...new Set([...prefs.hidden, chart])] : prefs.hidden.filter((c) => c !== chart);
  });
}
