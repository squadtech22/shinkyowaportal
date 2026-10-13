// Dashboard chart settings, saved per user in users.dashboard_prefs (JSON).
// Shared by the server (reading/validating) and the chart components.

export const CHART_TYPES = ["bar", "line", "area"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const CHARTS = {
  revenue: { title: "Money received", defaultType: "bar" },
  inquiries: { title: "Inquiries received", defaultType: "line" },
  customers: { title: "New customers", defaultType: "area" },
} as const satisfies Record<string, { title: string; defaultType: ChartType }>;

export type ChartId = keyof typeof CHARTS;
export const CHART_IDS = Object.keys(CHARTS) as ChartId[];

export type ChartPrefs = { types: Record<ChartId, ChartType>; hidden: ChartId[] };

/** Parses stored JSON, falling back to defaults for anything missing or invalid. */
export function parseChartPrefs(json: string | null | undefined): ChartPrefs {
  let raw: { types?: Record<string, unknown>; hidden?: unknown } = {};
  try {
    raw = JSON.parse(json ?? "{}") ?? {};
  } catch {
    /* use defaults */
  }
  const types = Object.fromEntries(
    CHART_IDS.map((id) => {
      const t = raw.types?.[id];
      return [id, CHART_TYPES.includes(t as ChartType) ? (t as ChartType) : CHARTS[id].defaultType];
    }),
  ) as Record<ChartId, ChartType>;
  const hidden = Array.isArray(raw.hidden) ? CHART_IDS.filter((id) => (raw.hidden as unknown[]).includes(id)) : [];
  return { types, hidden };
}
