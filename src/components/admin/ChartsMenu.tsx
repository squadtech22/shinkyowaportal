"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, LayoutGrid } from "lucide-react";
import { buttonClass, cx } from "./ui";
import { setChartHidden } from "@/actions/admin/dashboard";
import type { ChartId } from "@/lib/admin/chart-prefs";

/** "Charts" dropdown: choose which dashboard charts this user sees. */
export default function ChartsMenu({ charts }: { charts: { id: ChartId; title: string; visible: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={buttonClass("secondary")}
        aria-expanded={open}
      >
        <LayoutGrid className="size-4" /> Charts
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-slate-200 bg-surface p-1.5 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <p className="px-3 pt-1.5 pb-2 text-xs font-medium text-slate-500">Show on my dashboard</p>
          {charts.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => setChartHidden(c.id, c.visible))}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              <span
                className={cx(
                  "flex size-4 items-center justify-center rounded border",
                  c.visible ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300",
                )}
              >
                {c.visible && <Check className="size-3" strokeWidth={3} />}
              </span>
              {c.title}
            </button>
          ))}
          <p className="px-3 pt-2 pb-1 text-[11px] text-slate-400">Saved to your account. Chart types are chosen on each chart.</p>
        </div>
      )}
    </div>
  );
}
