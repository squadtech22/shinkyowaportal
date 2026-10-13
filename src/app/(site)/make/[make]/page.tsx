import StockPage, { readQuery, type SearchParams } from "@/components/StockPage";
import { stockFilter } from "@/lib/stock";
import { decodeSegment } from "@/lib/site";

export const metadata = { title: "Japanese Used Car Exporter" };

export default async function MakeStock({
  params,
  searchParams,
}: {
  params: Promise<{ make: string }>;
  searchParams: SearchParams;
}) {
  const make = decodeSegment((await params).make);
  const query = { ...(await readQuery(searchParams)), make: make };
  return <StockPage where={stockFilter(query)} query={query} basePath={`/make/${encodeURIComponent(make)}`} />;
}
