import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import WebLayout from "@/components/WebLayout";
import VehicleGallery from "@/components/VehicleGallery";
import InquiryForm from "@/components/InquiryForm";
import { HomeVehicleCard } from "@/components/VehicleCards";
import { ALREADY_SUBMITTED, hasInquired } from "@/lib/inquiries";
import { countries, getVehicle, relatedStock } from "@/lib/stock";
import { formatNumber, stockNo } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

// Shared by generateMetadata and the page, so the vehicle is queried once.
const vehicleById = cache(getVehicle);

async function load(params: Props["params"]) {
  const vehicle = await vehicleById(Number((await params).id));
  if (!vehicle) notFound();
  return vehicle;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await load(params);
  return { title: `${v.make} ${v.model} ${v.year}` };
}

export default async function VehicleInfo({ params }: Props) {
  const vehicle = await load(params);
  const [related, destinations, inquired] = await Promise.all([
    relatedStock(vehicle),
    countries(),
    hasInquired(vehicle.id),
  ]);
  const up = (s: string) => s.toUpperCase();

  const rows: [string, React.ReactNode][] = [
    ["S.No", stockNo(vehicle.sid)],
    ["Chassis", vehicle.chassis],
    ["Make / Model", `${up(vehicle.make)} / ${up(vehicle.model)}`],
    ["Year", vehicle.year],
    ["Body Type", up(vehicle.bodyType)],
    ["Fuel", up(vehicle.fuel)],
    ["Mileage", vehicle.mileage],
    ["Transmission", up(vehicle.transmission)],
    ["Doors", vehicle.doors],
    ["Engine", `${vehicle.engine}cc`],
    ["Color", vehicle.color || "N/A"],
    ["Country", up(vehicle.country)],
  ];

  return (
    <WebLayout css="vehicle-info" sidebar={false} mainSidebar={false}>
      <h2>
        {up(vehicle.make)} {up(vehicle.model)} {up(vehicle.transmission)} {vehicle.year} {vehicle.fuel} for Sale
      </h2>
      <div className="stage flex">
        <VehicleGallery key={vehicle.id} images={[vehicle.thumbnail, ...vehicle.images].filter(Boolean)} />
        <div className="item">
          <div className="tabs">
            <button disabled>
              <i className="bx bxs-car-garage"></i> Vehicle Details
            </button>
          </div>
          <div className="stage">
            <div className="vehicle-details">
              <div className="table">
                {rows.map(([label, value]) => (
                  <div className="col flex" key={label}>
                    <div className="row">
                      <p>{label}</p>
                    </div>
                    <div className="row">
                      <p>{value}</p>
                    </div>
                  </div>
                ))}
                <div className="col flex">
                  <div className="row">
                    <p>FOB Price</p>
                  </div>
                  <div className="row">
                    {vehicle.fob === 0 ? (
                      <label htmlFor="destination">Inquire</label>
                    ) : (
                      <p>{vehicle.currency.symbol + formatNumber(vehicle.fob)}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="extras">
                <h4>Features</h4>
                {/* The Blade view wrapped the list in <p>, which browsers split
                    into two empty padded paragraphs around it. */}
                <p></p>
                <ul>
                  {vehicle.features.map((f) => (
                    <li key={f}>{f.replace(/_/g, " ").toUpperCase()}</li>
                  ))}
                </ul>
                <p></p>
              </div>
            </div>
            <InquiryForm
              key={vehicle.id}
              stockId={vehicle.id}
              countries={destinations}
              alreadySentMessage={inquired ? ALREADY_SUBMITTED : undefined}
            />
          </div>
        </div>
      </div>
      <h1 className="related-vehicle-heading">Other Vehicles</h1>
      <div className="related-vehicle">
        {related.map((item) => (
          <HomeVehicleCard key={item.id} data={item} />
        ))}
      </div>
    </WebLayout>
  );
}
