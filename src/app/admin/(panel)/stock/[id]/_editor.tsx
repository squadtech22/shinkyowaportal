import Link from "next/link";
import { notFound } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { ExternalLink, Trash2 } from "lucide-react";
import EditorFrame from "@/components/admin/EditorFrame";
import StockForm from "@/components/admin/StockForm";
import { ConfirmButton } from "@/components/admin/forms";
import { ButtonLink } from "@/components/admin/ui";
import { deleteStock, saveStock } from "@/actions/admin/stock";
import { can, requireUser } from "@/lib/admin/auth";
import { getFormat } from "@/lib/admin/display";
import { db } from "@/lib/db";
import { AUTOMATIC_STATUS_SQL, STATUS_SQL } from "@/lib/admin/finance";
import { STATUS_INFO, type VehicleStatus } from "@/lib/vehicle-status";
import { parseFeatures } from "@/lib/features";
import { financeFormProps, stockFormOptions } from "../_options";

const list = (text: string | null): string[] => {
  try {
    const v = JSON.parse(text ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

/** Edit-vehicle form, as a page (stock/[id]) or in the drawer (@drawer/(.)stock/[id]). */
export default async function StockEditor({ id, inDrawer }: { id: number; inDrawer?: boolean }) {
  const { money } = await getFormat();
  const user = await requireUser(["stock.manage", "stock.add"]);
  const canPublish = can(user, "stock.manage");
  const [[[car]], { options, featureSuggestions }] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT s.*, m.name AS make, c.name AS customer, cur.symbol AS customer_symbol,
              COALESCE(cur.code, scur.code, 'USD') AS sale_code, COALESCE(cur.symbol, scur.symbol, '$') AS sale_symbol,
              ${STATUS_SQL} AS sales_status, ${AUTOMATIC_STATUS_SQL} AS automatic_status
       FROM stocks s LEFT JOIN makes m ON m.id = s.make_id
       LEFT JOIN customer_accounts c ON c.id = s.customer_account_id
       LEFT JOIN currencies cur ON cur.id = c.currency_id
       LEFT JOIN currencies scur ON scur.id = s.currency_id
       LEFT JOIN shipment_stock ss ON ss.stock_id = s.id
       WHERE s.id = ?`,
      [id],
    ),
    stockFormOptions(),
  ]);
  // With only stock.add: their own vehicles, while hidden from the website.
  if (!car || (!canPublish && (Number(car.created_by) !== user.id || car.is_listed === 1))) notFound();
  const finance = await financeFormProps(user, car.id, {
    cnf: car.customer_account_id && car.cnf ? Number(car.cnf) : null,
    symbol: String(car.sale_symbol),
    code: String(car.sale_code),
  });
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

  return (
    <EditorFrame
      inDrawer={inDrawer}
      title={`${car.year} ${car.make ?? ""} ${car.model}`}
      description={
        car.customer_account_id ? (
          <>
            {STATUS_INFO[car.sales_status as VehicleStatus].label} · Customer:{" "}
            <Link href={`/admin/customers/${car.customer_account_id}`} className="font-medium text-brand-700 hover:underline">
              {car.customer}
            </Link>
            {car.cnf ? ` at ${money(car.cnf, car.customer_symbol ?? "")} CNF` : ""}
          </>
        ) : (
          `SKI-${car.sid} · ${STATUS_INFO[car.sales_status as VehicleStatus].label}${car.is_listed ? "" : " · hidden from the website"}`
        )
      }
      back={{ href: "/admin/stock", label: "Stock" }}
      actions={
        <>
          {car.is_listed === 1 && (
            <ButtonLink href={`/vehicle-info/${car.id}`} variant="secondary" icon={ExternalLink} external>
              {inDrawer ? "Website" : "View on website"}
            </ButtonLink>
          )}
          {canPublish && (
            <ConfirmButton
              action={deleteStock.bind(null, car.id)}
              title="Delete this vehicle?"
              description="It will be removed from the website along with its uploaded photos. This cannot be undone."
              size="md"
            >
              <Trash2 className="size-4" /> Delete
            </ConfirmButton>
          )}
        </>
      }
    >
      <StockForm
        action={saveStock.bind(null, car.id)}
        options={options}
        featureSuggestions={featureSuggestions}
        submitLabel="Save changes"
        finance={finance}
        canPublish={canPublish}
        values={{
          sid: str(car.sid), make_id: str(car.make_id), model: str(car.model), year: str(car.year),
          chassis: str(car.chassis), body_type_id: str(car.body_type_id), fuel: str(car.fuel),
          transmission: str(car.transmission), mileage: str(car.mileage), engine: str(car.engine),
          doors: str(car.doors), color: str(car.color), category_id: str(car.category_id),
          country_id: str(car.country_id), currency_id: str(car.currency_id), fob: str(car.fob),
          is_listed: car.is_listed === 1, features: parseFeatures(car.features),
          sales_status: (car.status_override ?? "automatic") as VehicleStatus | "automatic",
          automatic_status: car.automatic_status as VehicleStatus,
          thumbnail: car.thumbnail || null, images: list(car.images),
        }}
      />
    </EditorFrame>
  );
}
