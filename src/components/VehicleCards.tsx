import Link from "next/link";
import type { Vehicle } from "@/lib/data";
import { formatNumber, stockNo } from "@/lib/site";

// components/home-vehicle-card.blade.php
export function HomeVehicleCard({ data }: { data: Vehicle }) {
  return (
    <div className="item">
      <Link href={`/vehicle-info/${data.id}`}>
        <img src={data.thumbnail} alt="stock-image" loading="lazy" />
        <h4>
          {data.make.toUpperCase()} {data.model.toUpperCase()}
          <br />
          <span className="pill">(SKI-{data.sid})</span>
        </h4>
        {data.fob === 0 ? (
          <button className="primary">Inquiry</button>
        ) : (
          <p>
            {data.currency.symbol}
            <span>{formatNumber(data.fob)}</span>
          </p>
        )}
      </Link>
    </div>
  );
}

// components/vehicle-listing-card.blade.php
export function VehicleListingCard({ v }: { v: Vehicle }) {
  const chassis = v.chassis.length > 6 ? `${v.chassis.slice(0, 6)}...` : v.chassis;
  return (
    <Link href={`/vehicle-info/${v.id}`}>
      <div className="item flex">
        <img src={v.thumbnail} alt="" loading="lazy" />
        <div className="content">
          <h3>
            {v.year} {v.make.toUpperCase()} {v.model.toUpperCase()}
          </h3>
          <div className="text">
            <p>Stock Id: <span>{stockNo(v.sid)}</span></p>
            <p>Chassis: <span>{chassis}</span></p>
            <p>Year: <span>{v.year}</span></p>
            <p>Mileage: <span>{v.mileage}</span></p>
            <p>Doors: <span>{v.doors}</span></p>
            <p>Transmission: <span>{v.transmission}</span></p>
          </div>
          <h3>Features:</h3>
          <div className="features">
            {v.features.slice(0, 10).map((f) => (
              <div key={f}>
                <p>{f.replace(/_/g, " ").toUpperCase()}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="action">
          {v.fob !== 0 && (
            <p>
              {v.currency.symbol}
              {formatNumber(v.fob)} {v.currency.code}
            </p>
          )}
          <button>Get Quote</button>
        </div>
      </div>
    </Link>
  );
}
