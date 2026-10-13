"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "./forms";
import { Card, CardHeader, cx } from "./ui";
import type { ActionState } from "@/lib/admin/actions";
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUSES, type ShipmentStatus } from "@/lib/shipment-status";

type Vehicle = { id: number; label: string; customer: string };

export default function ShipmentForm({
  action,
  values,
  vehicles,
  submitLabel,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  values: {
    vessel_name: string; method: string; container_no: string; bl_no: string; etd: string; eta: string;
    /** A status set by hand, or "automatic" to follow the dates. */
    status?: ShipmentStatus | "automatic";
    stock_ids: number[];
  };
  vehicles: Vehicle[];
  submitLabel: string;
}) {
  const [checked, setChecked] = useState(() => new Set(values.stock_ids));
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const shown = vehicles.filter((v) => !needle || `${v.label} ${v.customer}`.toLowerCase().includes(needle));

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <AdminForm action={action} className="space-y-6">
      <Card>
        <CardHeader title="Vessel" />
        <div className="grid gap-5 p-5 sm:grid-cols-3">
          <Field label="Vessel name" name="vessel_name" required className="sm:col-span-3">
            <input id="vessel_name" name="vessel_name" defaultValue={values.vessel_name} placeholder="e.g. Morning Cello V.123" className="input-base" />
          </Field>
          <Field label="Shipping method" name="method" required>
            <select id="method" name="method" defaultValue={values.method} className="input-base">
              <option value="roro">RoRo</option>
              <option value="container">Container</option>
            </select>
          </Field>
          <Field label="Container no." name="container_no" hint="For container shipments">
            <input id="container_no" name="container_no" defaultValue={values.container_no} className="input-base" />
          </Field>
          <Field label="B/L no." name="bl_no">
            <input id="bl_no" name="bl_no" defaultValue={values.bl_no} className="input-base" />
          </Field>
          <Field label="Departure (ETD)" name="etd" required hint="Leaves the Japanese port">
            <input id="etd" name="etd" type="date" defaultValue={values.etd} className="input-base" />
          </Field>
          <Field label="Arrival (ETA)" name="eta" required hint="Reaches the destination port">
            <input id="eta" name="eta" type="date" defaultValue={values.eta} className="input-base" />
          </Field>
          <Field label="Status" name="status" hint="Automatic follows the ETD/ETA dates">
            <select id="status" name="status" defaultValue={values.status ?? "automatic"} className="input-base">
              <option value="automatic">Automatic (from dates)</option>
              {SHIPMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{SHIPMENT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Vehicles on board"
          description={`${checked.size} selected · reserved vehicles not already on another vessel`}
        />
        {vehicles.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No reserved vehicles are waiting for a vessel.</p>
        ) : (
          <>
            <div className="border-b border-slate-100 p-4">
              <div className="relative sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by stock no., model, chassis or customer"
                  className="input-base pl-9"
                />
              </div>
            </div>
            <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
              {/* Every vehicle stays in the form (hidden when filtered out) so ticks are submitted. */}
              {vehicles.map((v) => (
                <li key={v.id} className={cx(!shown.includes(v) && "hidden")}>
                  <label className="flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-slate-50 has-[:checked]:bg-brand-50/50">
                    <input
                      type="checkbox"
                      name="stock_ids"
                      value={v.id}
                      checked={checked.has(v.id)}
                      onChange={() => toggle(v.id)}
                      className="mt-0.5 size-4 accent-brand-700"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{v.label}</span>
                      <span className="block text-xs text-slate-500">{v.customer}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {shown.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">No vehicles match “{filter}”.</p>}
          </>
        )}
      </Card>

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </AdminForm>
  );
}
