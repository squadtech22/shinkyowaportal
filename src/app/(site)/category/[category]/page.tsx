import StockPage, { readQuery, type SearchParams } from "@/components/StockPage";
import { stockFilter } from "@/lib/stock";
import { decodeSegment } from "@/lib/site";

export const metadata = { title: "Japanese Used Car Exporter" };

export default async function CategoryStock({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: SearchParams;
}) {
  const category = decodeSegment((await params).category);
  const query = { ...(await readQuery(searchParams)), category: category };
  return <StockPage where={stockFilter(query)} query={query} basePath={`/category/${encodeURIComponent(category)}`} />;
}
