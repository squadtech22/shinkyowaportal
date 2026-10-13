import { buttonClass } from "./ui";
import { fiscalYearLabel } from "@/lib/admin/finance";

type Option = { id: number; name: string };

/** GET filter bar for the finance pages; only the filters given are shown. */
export default function FinanceFilters({
  years,
  values,
  agents,
  countries,
  statuses,
  search,
}: {
  years: number[];
  values: { year: string; agent?: string; country?: string; status?: string; q?: string };
  agents?: Option[];
  countries?: Option[];
  statuses?: { key: string; label: string }[];
  search?: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-4">
      <label className="min-w-40">
        <span className="mb-1 block text-xs font-medium text-slate-500">Business year</span>
        <select name="year" defaultValue={values.year} className="input-base">
          {years.map((y) => (
            <option key={y} value={y}>{fiscalYearLabel(y)}</option>
          ))}
          <option value="all">All years</option>
        </select>
      </label>
      {agents && (
        <label className="min-w-36">
          <span className="mb-1 block text-xs font-medium text-slate-500">Salesperson</span>
          <select name="agent" defaultValue={values.agent ?? ""} className="input-base">
            <option value="">Everyone</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      )}
      {countries && (
        <label className="min-w-36">
          <span className="mb-1 block text-xs font-medium text-slate-500">Country</span>
          <select name="country" defaultValue={values.country ?? ""} className="input-base">
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      {statuses && (
        <label className="min-w-32">
          <span className="mb-1 block text-xs font-medium text-slate-500">Status</span>
          <select name="status" defaultValue={values.status ?? ""} className="input-base">
            <option value="">Any status</option>
            {statuses.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
      )}
      {search && (
        <label className="min-w-48 flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Search</span>
          <input name="q" type="search" defaultValue={values.q} placeholder={search} className="input-base" />
        </label>
      )}
      <button className={buttonClass("secondary")}>Apply</button>
    </form>
  );
}
