import { Suspense } from "react";
import WebLayout from "./WebLayout";
import { VehicleListingCard } from "./VehicleCards";
import { SortSelect, StockFilter } from "./StockFilter";
import Pagination from "./Pagination";
import { filterOptions, listStock, modelsByMake, yearsByModel, type StockQuery, type Where } from "@/lib/stock";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function readQuery(searchParams: SearchParams): Promise<StockQuery> {
  const raw = await searchParams;
  const q: StockQuery = {};
  for (const [k, v] of Object.entries(raw)) q[k] = Array.isArray(v) ? v[0] : v;
  return q;
}

function pageHref(basePath: string, query: StockQuery, page: number) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v && k !== "page") params.set(k, v);
  params.set("page", String(page));
  return `${basePath}?${params}`;
}

// web/stock.blade.php: every stock route (/stock, /filter, /make/x, /type/x,
// /country/x, /category/x, /stock-search) renders this page with its own list.
export default async function StockPage({
  where,
  query,
  basePath,
}: {
  where: Where;
  query: StockQuery;
  basePath: string;
}) {
  const [vehicles, options, models, years] = await Promise.all([
    listStock(where, query.sortBy, Number(query.page)),
    filterOptions(),
    modelsByMake(),
    yearsByModel(),
  ]);
  const empty = vehicles.items.length === 0;

  return (
    <WebLayout css="stock" sidebar={false} query={query}>
      <StockFilter key={JSON.stringify(query)} options={options} modelsByMake={models} yearsByModel={years} query={query} />
      <div className="sort-filter flex">
        <div>
          <p>Total number of vehicles: <span>{vehicles.total}</span></p>
          <p>Showing: <span>{vehicles.items.length}</span></p>
        </div>
        <Suspense>
          <SortSelect />
        </Suspense>
      </div>
      <div className="listing">
        {empty && <p className="msg">No Vehicle Present</p>}
        {vehicles.items.map((v) => (
          <VehicleListingCard key={v.id} v={v} />
        ))}
      </div>
      <div className="pagination">
        {!empty && (
          <Pagination
            currentPage={vehicles.currentPage}
            lastPage={vehicles.lastPage}
            hrefFor={Object.fromEntries(
              Array.from({ length: vehicles.lastPage }, (_, i) => [i + 1, pageHref(basePath, query, i + 1)]),
            )}
          />
        )}
      </div>
    </WebLayout>
  );
}
