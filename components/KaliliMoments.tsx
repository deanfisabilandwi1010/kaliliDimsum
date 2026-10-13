"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/motion/gsap";
import { useExperience } from "./Experience";

// Foto sudah berbingkai dari sumbernya; ditampilkan sebagai cetakan kenangan.
// Teks lokasi/tanggal di dalam foto adalah dokumentasi, bukan info outlet aktif.
const MOMENTS = [
  { src: "/moments/img-1140.webp", alt: "Cetakan bergaya prangko: gerai Dimsum by Kalili berwarna merah dengan konter kayu", caption: "Sudut kedai" },
  { src: "/moments/img-1180.webp", alt: "Cetakan berbingkai merah: seorang pengunjung menikmati dimsum", caption: "Momen bersama" },
  { src: "/moments/img-1205.webp", alt: "Cetakan berbingkai merah: meja kayu penuh kukusan dimsum, pangsit, dan minuman", caption: "Di atas meja" },
];

export function KaliliMoments() {
  const { lite } = useExperience();
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (lite !== false) return;
    const ctx = gsap.context(() => {
      gsap.from(".moments__head > *", {
        autoAlpha: 0, y: 32, duration: 0.9, ease: "power3.out", stagger: 0.1,
        scrollTrigger: { trigger: ".moments__head", start: "top 82%" },
      });
      // Cetakan mulai sebagai satu tumpukan di tengah, lalu menyebar ke
      // tempatnya seperti foto yang digelar di meja.
      const stacked = window.matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)").matches;
      const from = stacked
        ? [{ yPercent: 30, rotate: -10 }, { xPercent: 52, yPercent: -70, rotate: 14 }, { xPercent: -52, yPercent: -70, rotate: -16 }]
        : [{ xPercent: 104, yPercent: 26, rotate: -16 }, { yPercent: 40, rotate: 6 }, { xPercent: -104, yPercent: 26, rotate: 18 }];
      gsap.utils.toArray<HTMLElement>(".print").forEach((print, i) => {
        gsap.from(print, {
          ...from[i], scale: 0.82, ease: "power2.out",
          scrollTrigger: { trigger: ".moments__grid", start: "top 96%", end: "top 28%", scrub: 0.6 },
        });
        // Parallax ringan: tiap cetakan bergeser dengan laju berbeda.
        gsap.to(print.querySelector(".print__inner"), {
          yPercent: [-6, 6, -10][i], ease: "none",
          scrollTrigger: { trigger: rootRef.current, start: "top bottom", end: "bottom top", scrub: true },
        });
      });
      // Pita teks besar melintas ke samping mengikuti scroll.
      gsap.fromTo(".moments__band", { xPercent: 4 }, {
        xPercent: -42, ease: "none",
        scrollTrigger: { trigger: rootRef.current, start: "top bottom", end: "bottom top", scrub: 0.4 },
      });
    }, rootRef);
    return () => ctx.revert();
  }, [lite]);

  return (
    <section ref={rootRef} id="cerita" className="moments" data-tone-section="light" aria-labelledby="moments-title">
      <div className="moments__head">
        <p className="eyebrow">04 / Cerita Kalili</p>
        <h2 id="moments-title" className="display">Ada cerita di setiap meja.</h2>
        <p className="menu__aside">Sepotong suasana, wajah-wajah, dan momen yang tersimpan di Kalili.</p>
      </div>
      <p className="moments__band" aria-hidden="true">Cerita di setiap meja ✦ Cerita di setiap meja ✦ Cerita di setiap meja ✦</p>
      <ul className="moments__grid">
        {MOMENTS.map((m, i) => (
          <li className="print" key={m.src}>
            <figure className="print__inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.src} alt={m.alt} width={880} height={880} loading="lazy" decoding="async" />
              <figcaption><span>0{i + 1}</span>{m.caption}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
