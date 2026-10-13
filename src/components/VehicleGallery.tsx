"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { Swiper as SwiperType } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, FreeMode, Navigation, Thumbs } from "swiper/modules";

// Main image carousel (.mySwiper2) with its thumbnail strip (.mySwiper1) and
// the full-screen image modal opened by clicking a thumbnail.
export default function VehicleGallery({ images }: { images: string[] }) {
  const [thumbs, setThumbs] = useState<SwiperType | null>(null);
  const [modalSrc, setModalSrc] = useState<string | null>(null);

  return (
    <div className="item">
      <Swiper
        className="mySwiper2"
        modules={[Autoplay, Navigation, Thumbs]}
        loop={images.length > 1}
        autoplay={images.length > 1}
        thumbs={{ swiper: thumbs && !thumbs.destroyed ? thumbs : null }}
        navigation={{ nextEl: ".mySwiper2 .swiper-button-next", prevEl: ".mySwiper2 .swiper-button-prev" }}
      >
        {images.map((src, i) => (
          <SwiperSlide key={i}>
            <img src={src} alt="vehicle-image" className="main-image" />
          </SwiperSlide>
        ))}
        <div slot="container-end" className="swiper-button-next swiper-btn"></div>
        <div slot="container-end" className="swiper-button-prev swiper-btn"></div>
      </Swiper>
      <Swiper
        className="mySwiper1"
        modules={[FreeMode, Thumbs]}
        onSwiper={setThumbs}
        spaceBetween={10}
        slidesPerView={4}
        freeMode
        watchSlidesProgress
      >
        {images.map((src, i) => (
          <SwiperSlide key={i}>
            <img src={src} alt="vehicle-image" className="main-image vehicle-image" onClick={() => setModalSrc(src)} />
          </SwiperSlide>
        ))}
      </Swiper>
      {/* Portalled out of .stage .item, whose "img { width: 23.4% }" rule would shrink it. */}
      {modalSrc &&
        createPortal(
          <section className="modal" style={{ display: "flex" }}>
            <div className="container">
              <span className="close" onClick={() => setModalSrc(null)}>
                &times;
              </span>
              <img className="modal-content" id="modal-image" src={modalSrc} alt="vehicle-image" />
            </div>
          </section>,
          document.body,
        )}
    </div>
  );
}
