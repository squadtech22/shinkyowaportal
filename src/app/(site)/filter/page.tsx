import StockPage, { readQuery, type SearchParams } from "@/components/StockPage";
import { stockFilter } from "@/lib/stock";

export const metadata = { title: "Japanese Used Car Exporter" };

export default async function Filter({ searchParams }: { searchParams: SearchParams }) {
  const query = await readQuery(searchParams);
  return <StockPage where={stockFilter(query)} query={query} basePath="/filter" />;
}
