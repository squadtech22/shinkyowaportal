"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { AreaChart, BarChart3, EyeOff, LineChart, MoreHorizontal, Table2 } from "lucide-react";
import { Card, cx } from "./ui";
import { setChartHidden, setChartType } from "@/actions/admin/dashboard";
import type { ChartId, ChartType } from "@/lib/admin/chart-prefs";
import type { ChartPoint } from "@/lib/admin/dashboard";
import { formatters, number, type Display } from "@/lib/admin/format";

// Dashboard chart with a user-selectable form (bar / line / area).
// Marks follow the dataviz spec: one validated hue for the series (#2f5fb3,
// passes lightness/chroma/contrast on white), 2px lines, area fill at ~10%,
// bars <= 24px with 4px rounded tops, hairline solid gridlines, and a dashed
// neutral reference line for the moving average. Two series -> legend plus
// one sparse direct label (the peak). Tooltip on hover/focus, and a
// table view so no value depends on hovering.
const SERIES = "#2f5fb3";
const AVERAGE = "#64748b";
const HEIGHT = 240;
const PAD = { top: 18, right: 16, bottom: 28, left: 52 };

type Unit = "yen" | "count";

function niceMax(value: number, unit: Unit) {
  if (value <= 0) return unit === "yen" ? 10_000 : 4;
  const exp = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp >= value / 4)! * exp;
  const max = step * 4;
  return unit === "count" ? Math.max(4, Math.ceil(max / 4) * 4) : max;
}

/** Trailing moving average (uses fewer points at the start). */
function movingAverage(values: number[], window: number) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

const TYPES: { type: ChartType; label: string; icon: typeof BarChart3 }[] = [
  { type: "bar", label: "Bar", icon: BarChart3 },
  { type: "line", label: "Line", icon: LineChart },
  { type: "area", label: "Area", icon: AreaChart },
];

export default function DashboardChart({
  id,
  title,
  description,
  points,
  unit,
  initialType,
  averageWindow,
  averageLabel,
  display,
  className,
}: {
  id: ChartId;
  title: string;
  description: string;
  points: ChartPoint[];
  unit: Unit;
  initialType: ChartType;
  averageWindow: number;
  averageLabel: string;
  /** Needed for unit "yen": amounts are shown in the user's display currency. */
  display?: Display;
  className?: string;
}) {
  const [type, setType] = useState<ChartType>(initialType);
  const [table, setTable] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  // Draw at the real container width so strokes and text stay crisp.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const changeType = (next: ChartType) => {
    setType(next);
    startTransition(() => setChartType(id, next));
  };

  // Yen amounts are converted first, so the axis gets round numbers in the
  // display currency.
  const money = unit === "yen" && display ? formatters(display) : null;
  const fmt = (v: number) => (money ? money.amount(v) : number(v));
  const fmtAxis = (v: number) => (money ? money.amountCompact(v) : number(v));
  const values = points.map((p) => (money ? money.fromYen(p.value) : p.value));
  const avg = movingAverage(values, averageWindow);
  const max = niceMax(Math.max(...values, ...avg), unit);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const n = points.length;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = n ? plotW / n : 0;
  const x = (i: number) => PAD.left + band * i + band / 2;
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const linePath = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const peak = values.indexOf(Math.max(...values));
  // Show only as many x labels as fit (~56px each).
  const labelStep = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 56))));
  const barW = Math.min(24, Math.max(4, band * 0.6));
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <Card className={cx("flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label="Chart type">
            {TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                role="radio"
                aria-checked={type === t.type}
                title={`${t.label} chart`}
                onClick={() => changeType(t.type)}
                className={cx(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition",
                  type === t.type ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
                )}
              >
                <t.icon className="size-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenu((m) => !m);
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Chart options"
              aria-expanded={menu}
            >
              <MoreHorizontal className="size-4" />
            </button>
            {menu && (
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-slate-200 bg-surface p-1.5 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => { setTable((t) => !t); setMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <Table2 className="size-4 text-slate-400" /> {table ? "Show chart" : "View as table"}
                </button>
                <button type="button" onClick={() => startTransition(() => setChartHidden(id, true))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <EyeOff className="size-4 text-slate-400" /> Hide this chart
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-5">
        {/* Legend: two series, so it is always shown; keys mirror the marks. */}
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
          <span className="inline-flex items-center gap-2">
            {type === "bar" ? (
              <span className="size-2.5 rounded-[3px]" style={{ background: SERIES }} />
            ) : (
              <span className="h-0.5 w-4 rounded-full" style={{ background: SERIES }} />
            )}
            {title}
          </span>
          <span className="inline-flex items-center gap-2">
            <svg width="16" height="4" aria-hidden="true">
              <line x1="0" y1="2" x2="16" y2="2" stroke={AVERAGE} strokeWidth="2" strokeDasharray="3 3" />
            </svg>
            {averageLabel}
          </span>
          <span className="ml-auto text-slate-500">
            Total <span className="font-semibold text-slate-900 tabular-nums">{fmt(total)}</span>
          </span>
        </div>

        {table ? (
          <div className="max-h-[260px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1.5 font-medium">Period</th>
                  <th className="py-1.5 text-right font-medium">{title}</th>
                  <th className="py-1.5 text-right font-medium">{averageLabel}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={p.key} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{p.key}</td>
                    <td className="py-1.5 text-right font-medium text-slate-900 tabular-nums">{fmt(values[i])}</td>
                    <td className="py-1.5 text-right text-slate-500 tabular-nums">{fmt(avg[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={boxRef} className="relative" style={{ height: HEIGHT }}>
            {width > 0 && n > 0 && (
              <svg width={width} height={HEIGHT} className="block overflow-visible" role="img" aria-label={`${title} chart`}>
                {/* Gridlines + y labels */}
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-slate-100" strokeWidth="1" />
                    <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[11px] tabular-nums">
                      {fmtAxis(t)}
                    </text>
                  </g>
                ))}
                {/* X labels */}
                {points.map((p, i) =>
                  i % labelStep === 0 || i === n - 1 ? (
                    <text key={p.key} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-400 text-[11px]">
                      {p.label}
                    </text>
                  ) : null,
                )}

                {/* Hover band / crosshair */}
                {hover !== null && type === "bar" && (
                  <rect x={PAD.left + band * hover + 1} y={PAD.top} width={Math.max(0, band - 2)} height={plotH} rx="6" className="fill-slate-100" />
                )}
                {hover !== null && type !== "bar" && (
                  <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-slate-300" strokeWidth="1" />
                )}

                {/* Series */}
                {type === "bar" &&
                  values.map((v, i) => {
                    const h = v > 0 ? Math.max(2, (v / max) * plotH) : 0;
                    const bx = x(i) - barW / 2;
                    const by = PAD.top + plotH - h;
                    const r = Math.min(4, h, barW / 2);
                    return h > 0 ? (
                      <path
                        key={i}
                        d={`M${bx},${by + h}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + barW - r}Q${bx + barW},${by} ${bx + barW},${by + r}V${by + h}Z`}
                        fill={SERIES}
                        opacity={hover === null || hover === i ? 1 : 0.55}
                      />
                    ) : null;
                  })}
                {type === "area" && (
                  <path
                    d={`${linePath(values)}L${x(n - 1)},${PAD.top + plotH}L${x(0)},${PAD.top + plotH}Z`}
                    fill={SERIES}
                    opacity="0.1"
                  />
                )}
                {type !== "bar" && (
                  <path d={linePath(values)} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                )}

                {/* Moving average: dashed neutral reference line */}
                <path d={linePath(avg)} fill="none" stroke={AVERAGE} strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />

                {/* Sparse direct label: the series peak (the legend names the average) */}
                {values[peak] > 0 && (
                  <text
                    x={x(peak)}
                    y={(type === "bar" ? y(values[peak]) : y(values[peak])) - 8}
                    textAnchor={peak > n * 0.8 ? "end" : peak < n * 0.2 ? "start" : "middle"}
                    className="fill-slate-700 text-[11px] font-semibold"
                  >
                    {fmtAxis(values[peak])}
                  </text>
                )}

                {/* Hovered markers (line/area) */}
                {hover !== null && type !== "bar" && (
                  <>
                    <circle cx={x(hover)} cy={y(avg[hover])} r="4" fill={AVERAGE} className="stroke-surface" strokeWidth="2" />
                    <circle cx={x(hover)} cy={y(values[hover])} r="5" fill={SERIES} className="stroke-surface" strokeWidth="2" />
                  </>
                )}
              </svg>
            )}

            {/* Hit areas: one full-height band per point (bigger than the marks), keyboard focusable */}
            <div className="absolute flex" style={{ left: PAD.left, right: PAD.right, top: PAD.top, bottom: PAD.bottom }}>
              {points.map((p, i) => (
                <div
                  key={p.key}
                  tabIndex={0}
                  className="h-full flex-1 outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${p.key}: ${fmt(values[i])}, ${averageLabel.toLowerCase()} ${fmt(avg[i])}`}
                />
              ))}
            </div>

            {/* Tooltip: values lead, line keys */}
            {hover !== null && width > 0 && (
              <div
                className="pointer-events-none absolute z-10 w-max min-w-40 rounded-lg bg-brand-950 px-3 py-2 text-xs text-white shadow-lg"
                style={{
                  top: Math.max(0, Math.min(y(values[hover]), y(avg[hover])) - 74),
                  ...(x(hover) > width * 0.6 ? { right: width - x(hover) + 10 } : { left: x(hover) + 10 }),
                }}
              >
                <p className="mb-1 text-slate-400">{points[hover].label}{points[hover].key.length === 7 ? ` ${points[hover].key.slice(0, 4)}` : ""}</p>
                <p className="flex items-center gap-2">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: "#7aa2e8" }} />
                  <span className="font-semibold tabular-nums">{fmt(values[hover])}</span>
                  <span className="text-slate-400">{points[hover].note ?? title}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-2">
                  <svg width="12" height="2" aria-hidden="true">
                    <line x1="0" y1="1" x2="12" y2="1" className="stroke-slate-300" strokeWidth="2" strokeDasharray="2 2" />
                  </svg>
                  <span className="font-semibold tabular-nums">{fmt(avg[hover])}</span>
                  <span className="text-slate-400">{averageLabel}</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
