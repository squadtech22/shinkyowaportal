"use client";

import { useState } from "react";
import { ImagePlus, Trash2, Undo2 } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "./forms";
import FeatureEditor from "./FeatureEditor";
import PurchaseFields, { type PurchaseFieldsProps } from "./PurchaseFields";
import { Card, CardHeader, cx } from "./ui";
import type { ActionState } from "@/lib/admin/actions";
import { STOCK_IMG_URL } from "@/lib/data";
import { STATUS_INFO, VEHICLE_STATUSES, type VehicleStatus } from "@/lib/vehicle-status";

/** Stored photo value -> URL (relative values live on the CRM storage host). */
const photoUrl = (stored: string) => (/^(https?:\/\/|\/)/.test(stored) ? stored : STOCK_IMG_URL + stored);

type Option = { id: number; name: string };

export type StockValues = {
  sid: string;
  make_id: string;
  model: string;
  year: string;
  chassis: string;
  body_type_id: string;
  fuel: string;
  transmission: string;
  mileage: string;
  engine: string;
  doors: string;
  color: string;
  category_id: string;
  country_id: string;
  currency_id: string;
  fob: string;
  is_listed: boolean;
  sales_status?: VehicleStatus | "automatic";
  automatic_status?: VehicleStatus;
  features: { name: string; value: string }[];
  thumbnail: string | null;
  images: string[];
};

function Select({ name, value, options, placeholder }: { name: string; value: string; options: Option[]; placeholder: string }) {
  return (
    <select id={name} name={name} defaultValue={value} className="input-base">
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );
}

/** File input with local previews of the chosen files. */
function PhotoPicker({ name, multiple, label }: { name: string; multiple?: boolean; label: string }) {
  const [previews, setPreviews] = useState<string[]>([]);
  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/40">
        <ImagePlus className="size-6 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">JPG, PNG, WebP or AVIF · up to 8 MB each</span>
        <input
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            previews.forEach(URL.revokeObjectURL);
            setPreviews(Array.from(e.target.files ?? []).map((f) => URL.createObjectURL(f)));
          }}
        />
      </label>
      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map((src) => (
            <img key={src} src={src} alt="" className="aspect-[4/3] w-full rounded-lg object-cover ring-2 ring-brand-200" />
          ))}
        </div>
      )}
    </div>
  );
}

function ExistingPhoto({ url, isMain }: { url: string; isMain?: boolean }) {
  const [removed, setRemoved] = useState(false);
  return (
    <div className="group relative">
      <img src={photoUrl(url)} alt="" className={cx("aspect-[4/3] w-full rounded-lg object-cover", removed && "opacity-30 grayscale")} />
      {isMain && !removed && (
        <span className="absolute top-1.5 left-1.5 rounded-md bg-brand-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white">Main</span>
      )}
      {removed && <input type="hidden" name="remove_image" value={url} />}
      <button
        type="button"
        onClick={() => setRemoved((r) => !r)}
        className="absolute top-1.5 right-1.5 rounded-md bg-surface/90 p-1 text-slate-600 shadow-sm hover:text-accent-600"
        title={removed ? "Keep photo" : "Remove photo"}
      >
        {removed ? <Undo2 className="size-3.5" /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  );
}

export default function StockForm({
  action,
  values,
  options,
  featureSuggestions,
  submitLabel,
  finance,
  canPublish = true,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  /** False for users with only stock.add: no website or sales status options. */
  canPublish?: boolean;
  values: StockValues;
  options: { makes: Option[]; bodyTypes: Option[]; categories: Option[]; countries: Option[]; currencies: Option[] };
  /** Feature names used on other vehicles, suggested while typing. */
  featureSuggestions: string[];
  submitLabel: string;
  /** Purchase & costs card, only passed for users with finance.view. */
  finance?: PurchaseFieldsProps;
}) {
  // Vehicles bought for a customer need not be on the website; then only the
  // vehicle card is required.
  const [listed, setListed] = useState(values.is_listed);
  const [websiteSection, setWebsiteSection] = useState(values.category_id || (values.is_listed ? "all" : ""));
  const gridInput = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <AdminForm action={action} className="space-y-6">
      {!canPublish ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This vehicle is saved in stock only and is <strong>not shown on the website</strong>. A manager decides when it goes
          on the website.
          <input type="hidden" name="category_id" value={values.category_id} />
        </p>
      ) : (
        <Card>
          <label className="flex cursor-pointer items-start gap-3 p-5">
            <input type="checkbox" name="is_listed" checked={listed} onChange={(e) => setListed(e.target.checked)} aria-controls="stock-website-section" className="mt-0.5 size-4 accent-brand-700" />
            <span>
              <span className="block text-sm font-medium text-slate-900">Show on website</span>
              <span className="block text-sm text-slate-500">
                {listed
                  ? "Choose where this vehicle appears on the website."
                  : "Saved in stock. You can show it on the website later by editing the vehicle."}
              </span>
            </span>
          </label>
          {listed ? (
            <div id="stock-website-section" className="border-t border-slate-200 p-5">
              <Field label="Website section" name="category_id" required hint="Vehicles in a section also appear in All Vehicles. Choose All Vehicles to show it only in the general listing.">
                <select id="category_id" name="category_id" value={websiteSection} onChange={(e) => setWebsiteSection(e.target.value)} required className="input-base">
                  <option value="">Choose a section</option>
                  {options.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name === "New Arrival" ? "New Arrivals" : category.name}
                    </option>
                  ))}
                  <option value="all">All Vehicles</option>
                </select>
              </Field>
            </div>
          ) : (
            <input type="hidden" name="category_id" value={websiteSection} />
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Vehicle" description="Shown as the vehicle title on the website." />
        <div className={cx("p-5", gridInput)}>
          <Field label="Stock number" name="sid" required hint="Shown as SKI-number">
            <input id="sid" name="sid" defaultValue={values.sid} inputMode="numeric" className="input-base" />
          </Field>
          <Field label="Make" name="make_id" required>
            <Select name="make_id" value={values.make_id} options={options.makes} placeholder="Select make" />
          </Field>
          <Field label="Model" name="model" required>
            <input id="model" name="model" defaultValue={values.model} className="input-base" placeholder="e.g. Hilux" />
          </Field>
          <Field label="Year" name="year" required>
            <input id="year" name="year" defaultValue={values.year} inputMode="numeric" className="input-base" />
          </Field>
          <Field label="Chassis number" name="chassis" required>
            <input id="chassis" name="chassis" defaultValue={values.chassis} className="input-base" />
          </Field>
          <Field label="Body type" name="body_type_id" required={listed}>
            <Select name="body_type_id" value={values.body_type_id} options={options.bodyTypes} placeholder="Select body type" />
          </Field>
          {canPublish && (
            <Field label="Sales status" name="sales_status" hint="Automatic follows reservations, shipments and approved payments.">
              <select id="sales_status" name="sales_status" defaultValue={values.sales_status ?? "automatic"} className="input-base">
                <option value="automatic">Automatic ({STATUS_INFO[values.automatic_status ?? "available"].label})</option>
                {VEHICLE_STATUSES.map((status) => (
                  <option key={status} value={status}>{STATUS_INFO[status].label}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Specifications" />
        <div className={cx("p-5", gridInput)}>
          <Field label="Fuel" name="fuel" required={listed}>
            <select id="fuel" name="fuel" defaultValue={values.fuel} className="input-base capitalize">
              {["petrol", "diesel", "hybrid", "electric", "gasoline"].map((v) => (
                <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>
              ))}
            </select>
          </Field>
          <Field label="Transmission" name="transmission" required={listed}>
            <select id="transmission" name="transmission" defaultValue={values.transmission} className="input-base">
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </Field>
          <Field label="Mileage (km)" name="mileage" required={listed}>
            <input id="mileage" name="mileage" defaultValue={values.mileage} inputMode="numeric" className="input-base" />
          </Field>
          <Field label="Engine (cc)" name="engine" required={listed}>
            <input id="engine" name="engine" defaultValue={values.engine} inputMode="numeric" className="input-base" />
          </Field>
          <Field label="Doors" name="doors" required={listed}>
            <input id="doors" name="doors" defaultValue={values.doors} inputMode="numeric" className="input-base" />
          </Field>
          <Field label="Color" name="color">
            <input id="color" name="color" defaultValue={values.color} className="input-base" placeholder="e.g. Pearl white" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Price & listing" description="Set FOB to 0 to show “Inquiry” instead of a price." />
        <div className={cx("p-5", gridInput)}>
          <Field label="FOB price" name="fob" required={listed}>
            <input id="fob" name="fob" defaultValue={values.fob} inputMode="numeric" className="input-base" />
          </Field>
          <Field label="Currency" name="currency_id" required>
            <Select name="currency_id" value={values.currency_id} options={options.currencies} placeholder="Select currency" />
          </Field>
          <Field label="Stock country" name="country_id" hint="Used by “Search by country”">
            <Select name="country_id" value={values.country_id} options={options.countries} placeholder="Not set" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Features" description="Add your own, e.g. Seats: 7, Navigation: Yes. Shown on the website as “SEATS: 7”." />
        <div className="p-5">
          <Field label="Name and value" name="features">
            <FeatureEditor initial={values.features} suggestions={featureSuggestions} />
          </Field>
        </div>
      </Card>

      {finance && <PurchaseFields {...finance} />}

      <Card>
        <CardHeader title="Photos" description="The main photo is used on listings; the others appear in the vehicle gallery." />
        <div className="space-y-6 p-5">
          {(values.thumbnail || values.images.length > 0) && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Current photos</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {values.thumbnail && <ExistingPhoto url={values.thumbnail} isMain />}
                {values.images.map((url) => (
                  <ExistingPhoto key={url} url={url} />
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            <PhotoPicker name="thumbnail" label={values.thumbnail ? "Replace main photo" : "Upload main photo"} />
            <PhotoPicker name="images" multiple label="Add gallery photos" />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </AdminForm>
  );
}
