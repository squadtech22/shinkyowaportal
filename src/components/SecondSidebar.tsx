"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import { IMAGE_API_URL, type Vehicle } from "@/lib/data";
import { stockNo } from "@/lib/site";

const OFFERS = [
  { href: "/stock", src: "offer-one.gif" },
  { href: "/stock", src: "offer-two.gif" },
  { href: "/filter?yearfrom=2024", src: "offer-three.gif" },
  { href: "/stock", src: "offer-four.gif" },
  { href: "/filter?yearfrom=2026", src: "offer-five.gif" },
];

export default function SecondSidebar({ vehicleOfDay }: { vehicleOfDay: Vehicle[] }) {
  return (
    <aside className="second-sidebar">
      <div className="vehicle-of-day">
        <h2>Vehicles Of The Day</h2>
        <div className="stage">
          <div className="item">
            <Swiper
              id="vehicleOfDay"
              className="mySwiper"
              modules={[Autoplay]}
              autoplay={{ delay: 2000, disableOnInteraction: false }}
            >
              {vehicleOfDay.map((item) => (
                <SwiperSlide key={item.id}>
                  <Link href={`/vehicle-info/${item.id}`}>
                    <img src={item.thumbnail} alt="vehicle-of-the-day" loading="lazy" />
                    <p>
                      {item.make.toUpperCase()} / {item.model.toUpperCase()} {item.year}
                    </p>
                    <span>Stock No. {stockNo(item.sid)}</span>
                    <button>Details</button>
                  </Link>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </div>
      <hr />
      <div className="offers">
        {OFFERS.map((o) => (
          <Link key={o.src} href={o.href}>
            <img src={`${IMAGE_API_URL}images/offers/${o.src}`} alt="" loading="lazy" />
          </Link>
        ))}
      </div>
      <hr />
    </aside>
  );
}
