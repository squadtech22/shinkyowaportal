import StockPage, { readQuery, type SearchParams } from "@/components/StockPage";
import { stockSearch } from "@/lib/stock";

export const metadata = { title: "Japanese Used Car Exporter" };

export default async function StockSearch({ searchParams }: { searchParams: SearchParams }) {
  const query = await readQuery(searchParams);
  return <StockPage where={stockSearch(query.search ?? "")} query={query} basePath="/stock-search" />;
}
