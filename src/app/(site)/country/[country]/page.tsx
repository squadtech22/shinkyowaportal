import StockPage, { readQuery, type SearchParams } from "@/components/StockPage";
import { stockFilter } from "@/lib/stock";
import { decodeSegment } from "@/lib/site";

export const metadata = { title: "Japanese Used Car Exporter" };

export default async function CountryStock({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>;
  searchParams: SearchParams;
}) {
  const country = decodeSegment((await params).country);
  const query = { ...(await readQuery(searchParams)), country: country };
  return <StockPage where={stockFilter(query)} query={query} basePath={`/country/${encodeURIComponent(country)}`} />;
}
