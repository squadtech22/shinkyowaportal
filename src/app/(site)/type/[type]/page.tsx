import StockPage, { readQuery, type SearchParams } from "@/components/StockPage";
import { stockFilter } from "@/lib/stock";
import { decodeSegment } from "@/lib/site";

export const metadata = { title: "Japanese Used Car Exporter" };

export default async function TypeStock({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: SearchParams;
}) {
  const type = decodeSegment((await params).type);
  const query = { ...(await readQuery(searchParams)), bodytype: type };
  return <StockPage where={stockFilter(query)} query={query} basePath={`/type/${encodeURIComponent(type)}`} />;
}
