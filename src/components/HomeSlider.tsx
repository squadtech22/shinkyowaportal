"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { IMAGE_API_URL } from "@/lib/data";

const BANNERS = [
  { href: "/stock", src: "images/banner-one.png" },
  { href: "/filter?make=toyota&model=hilux&yearfrom=2024&yearto=2024", src: "images/banner-two.webp" },
  { href: "/filter?make=honda&model=CR-V", src: "images/banner-three.webp" },
];

export default function HomeSlider() {
  return (
    <Swiper
      id="slider"
      className="mySwiper"
      modules={[Autoplay, Pagination]}
      pagination={{ clickable: true }}
      autoplay={{ delay: 2000, disableOnInteraction: false }}
    >
      {BANNERS.map((b) => (
        <SwiperSlide key={b.src}>
          <Link href={b.href}>
            <img src={IMAGE_API_URL + b.src} alt="slider-image" loading="lazy" />
          </Link>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
