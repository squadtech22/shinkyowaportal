"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { buttonClass } from "./ui";

type Row = { key: number; name: string; value: string };

/**
 * Features typed by the user as name / value pairs (e.g. "Seats" / "7").
 * Submitted as parallel feature_name / feature_value fields; names used on
 * other vehicles are suggested.
 */
export default function FeatureEditor({
  initial,
  suggestions,
}: {
  initial: { name: string; value: string }[];
  suggestions: string[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    (initial.length ? initial : [{ name: "", value: "" }]).map((f, i) => ({ key: i, ...f })),
  );
  const [nextKey, setNextKey] = useState(rows.length);

  const add = () => {
    setRows((r) => [...r, { key: nextKey, name: "", value: "" }]);
    setNextKey((k) => k + 1);
  };
  const update = (key: number, field: "name" | "value", v: string) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, [field]: v } : row)));
  const remove = (key: number) => setRows((r) => r.filter((row) => row.key !== key));

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[1fr_1fr_auto] gap-3 text-xs font-medium text-slate-500 sm:grid">
        <span>Name</span>
        <span>Value (optional)</span>
        <span className="w-8" />
      </div>
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 sm:gap-3">
          <input
            name="feature_name"
            value={row.name}
            onChange={(e) => update(row.key, "name", e.target.value)}
            list="feature-names"
            placeholder="e.g. Seats"
            maxLength={60}
            aria-label="Feature name"
            className="input-base"
          />
          <input
            name="feature_value"
            value={row.value}
            onChange={(e) => update(row.key, "value", e.target.value)}
            placeholder="e.g. 7"
            maxLength={120}
            aria-label="Feature value"
            className="input-base"
          />
          <button
            type="button"
            onClick={() => remove(row.key)}
            className="rounded-lg p-2 text-slate-400 hover:bg-accent-50 hover:text-accent-600"
            title="Remove feature"
            aria-label="Remove feature"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <datalist id="feature-names">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <button type="button" onClick={add} className={buttonClass("secondary", "sm")}>
        <Plus className="size-3.5" /> Add feature
      </button>
    </div>
  );
}
