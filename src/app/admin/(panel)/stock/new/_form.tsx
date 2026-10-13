import type { RowDataPacket } from "mysql2";
import StockForm from "@/components/admin/StockForm";
import { saveStock } from "@/actions/admin/stock";
import { can, requireUser } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { financeFormProps, stockFormOptions } from "../_options";

/** "Add vehicle" form, shown as a page and in the drawer (@drawer/(.)stock/new). */
export default async function NewStockForm() {
  const user = await requireUser(["stock.manage", "stock.add"]);
  const [{ options, featureSuggestions }, [[next]], finance] = await Promise.all([
    stockFormOptions(),
    db.query<RowDataPacket[]>("SELECT COALESCE(MAX(CAST(sid AS UNSIGNED)), 1000) + 1 AS sid FROM stocks"),
    financeFormProps(user, null, { cnf: null, symbol: "$", code: "USD" }),
  ]);
  const usd = options.currencies.find((c) => c.name.startsWith("USD"));
  return (
    <StockForm
      action={saveStock.bind(null, null)}
      options={options}
      featureSuggestions={featureSuggestions}
      submitLabel="Add vehicle"
      finance={finance}
      canPublish={can(user, "stock.manage")}
      values={{
        sid: String(next.sid), make_id: "", model: "", year: String(new Date().getFullYear()), chassis: "",
        body_type_id: "", fuel: "petrol", transmission: "automatic", mileage: "", engine: "", doors: "4",
        color: "", category_id: "", country_id: "", currency_id: usd ? String(usd.id) : "", fob: "", is_listed: false,
        features: [], thumbnail: null, images: [],
      }}
    />
  );
}
