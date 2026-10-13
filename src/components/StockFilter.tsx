"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Options = {
  make: string[];
  model: string[];
  bodytype: string[];
  year: number[];
  country: string[];
};

const FUEL = ["petrol", "diesel", "hybrid", "electric", "gasoline"];
const TRANSMISSION = ["manual", "automatic"];
const MILEAGE = ["under 50,000", "under 100,000", "under 200,000", "under 300,000"];
const CATEGORY = ["all", "new arrival", "discounted", "commercial"];

function Select({
  label, id, name, placeholder, value, onChange, options,
}: {
  label: string;
  id: string;
  name: string;
  placeholder: string;
  value?: string;
  onChange?: (v: string) => void;
  options: (string | number)[];
}) {
  const match = options.map(String).find((o) => o.toLowerCase() === value?.toLowerCase()) ?? "";
  return (
    <div className="row-filter">
      <label htmlFor={id}>{label}</label>
      <select
        name={name}
        id={id}
        key={`${options.join("|")}:${match}`}
        defaultValue={match}
        onChange={onChange && ((e) => onChange(e.target.value))}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{String(o).toUpperCase()}</option>
        ))}
      </select>
    </div>
  );
}

// The "Filter Results" box of web/stock.blade.php. Choosing a make narrows the
// model list and choosing a model narrows the years (the old /get-models and
// /get-years AJAX calls).
export function StockFilter({
  options,
  modelsByMake,
  yearsByModel,
  query,
}: {
  options: Options;
  modelsByMake: Record<string, string[]>;
  yearsByModel: Record<string, number[]>;
  query: Record<string, string | undefined>;
}) {
  const [make, setMake] = useState(query.make ?? "");
  const [model, setModel] = useState(query.model ?? "");
  const makeKey = options.make.find((m) => m.toLowerCase() === make.toLowerCase());
  const models = makeKey ? modelsByMake[makeKey] ?? [] : options.model;
  const modelKey = Object.keys(yearsByModel).find((m) => m.toLowerCase() === model.toLowerCase());
  const years = modelKey ? yearsByModel[modelKey] : options.year;

  return (
    <div className="filter">
      <h2>Filter Results</h2>
      <form action="/filter" method="get">
        <div className="row">
          <Select label="Make:" id="filtermake" name="make" placeholder="Select Make" value={make}
            onChange={(v) => { setMake(v); setModel(""); }} options={options.make} />
          <Select label="Model:" id="filtermodel" name="model" placeholder="Select Model" value={model}
            onChange={setModel} options={models} />
          <Select label="Body Type:" id="bodytype" name="bodytype" placeholder="Body Type"
            value={query.bodytype ?? query.bodyType} options={options.bodytype} />
          <Select label="Fuel Type:" id="filterfueltype" name="fueltype" placeholder="Select Fuel Type"
            value={query.fueltype} options={FUEL} />
          <Select label="Transmission:" id="transmission" name="transmission" placeholder="Select Transmission"
            value={query.transmission} options={TRANSMISSION} />
          <Select label="Mileage:" id="mileage" name="mileage" placeholder="Select Mileage"
            value={query.mileage} options={MILEAGE} />
          <Select label="Year From:" id="yearfrom" name="yearfrom" placeholder="Year From"
            value={query.yearfrom} options={years} />
          <Select label="Year To:" id="yearto" name="yearto" placeholder="Year To"
            value={query.yearto} options={years} />
          <Select label="Category:" id="filtercategory" name="category" placeholder="Select Category"
            value={query.category} options={CATEGORY} />
          <Select label="Country:" id="country" name="country" placeholder="Country"
            value={query.country} options={options.country} />
        </div>
        <button type="submit">Filter</button>
      </form>
    </div>
  );
}

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <form action="" onSubmit={(e) => e.preventDefault()}>
      <div>
        <label htmlFor="sort">Sort By:</label>
        <select
          name="sort"
          id="sort"
          value={params.get("sortBy") ?? ""}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set("sortBy", e.target.value);
            next.delete("page");
            router.push(`${pathname}?${next}`);
          }}
        >
          <option value="">Default</option>
          <option value="hightolow">High to Low</option>
          <option value="lowtohigh">Low to High</option>
        </select>
      </div>
    </form>
  );
}
