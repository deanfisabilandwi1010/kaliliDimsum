"use client";

import { useEffect, useRef, useState } from "react";
import { productById, spotlightIds } from "@/content/products";
import { gsap } from "@/lib/motion/gsap";
import { useExperience } from "./Experience";
import { Arrow, ProductImage } from "./ui";

export function HeroStage() {
  const { lite, entered, warm } = useExperience();
  const rootRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const withVideo = lite === false;

  // Video berjalan selama hero terlihat. Dimulai sejak video pembuka diputar
  // (warm), supaya sudah bergerak ketika iris terbuka.
  useEffect(() => {
    const video = videoRef.current;
    if (!withVideo || !video || !warm) return;
    let visible = true;
    const sync = () => {
      if (visible && !document.hidden) video.play().catch(() => {});
      else video.pause();
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { threshold: 0.05 });
    io.observe(rootRef.current!);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [withVideo, warm]);

  useEffect(() => {
    if (lite !== false || !entered) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero__line > span", { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: 0.09, delay: 0.25 });
      gsap.from(".hero__fade", { autoAlpha: 0, y: 18, duration: 0.8, ease: "power2.out", stagger: 0.08, delay: 0.7 });
      // Hero menempel dengan ukuran penuh. Babak 1: judul naik baris demi baris
      // dan kamera mendekat ke kukusan, lalu kalimat kedua muncul. Babak 2:
      // pita merah dan bagian ritual naik menutupi hero yang masih menempel.
      gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: pinRef.current, start: "top top", end: "bottom bottom", scrub: 0.5 } })
        .to(".hero__line", { y: (i) => -90 - i * 46, autoAlpha: 0, duration: 0.2, stagger: 0.025, ease: "power2.in" }, 0)
        .to(".hero__meta", { y: -40, autoAlpha: 0, duration: 0.14, ease: "power1.in" }, 0)
        .to(".hero__foot", { autoAlpha: 0, duration: 0.1 }, 0)
        .fromTo(".hero__next > *", { y: 46, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.14, stagger: 0.04, ease: "power2.out" }, 0.2)
        .fromTo(".hero__poster, .hero__video", { scale: 1 }, { scale: 1.24, duration: 1, ease: "sine.inOut" }, 0)
        .fromTo(".hero__shade", { opacity: 0 }, { opacity: 0.4, duration: 0.5 }, 0.5);
    }, rootRef);
    return () => ctx.revert();
  }, [lite, entered]);

  return (
    <div ref={pinRef} className="hero-pin">
    <section ref={rootRef} id="top" className="hero" data-tone-section="light" data-header="clear">
      <div className="hero__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero__poster" src="/video/hero-poster.jpg" alt="Kukusan bambu terbuka berisi siomay di atas meja kedai, dengan uap mengepul" width={1280} height={720} fetchPriority="high" />
        {withVideo && (
          <video
            ref={videoRef}
            className="hero__video"
            data-ready={videoReady}
            src="/video/hero-loop.mp4"
            muted
            loop
            playsInline
            preload="auto"
            onPlaying={() => setVideoReady(true)}
            aria-hidden="true"
            tabIndex={-1}
          />
        )}
      </div>

      <div className="hero__content">
        <p className="eyebrow hero__fade hero__meta">Selamat datang di Kalili Steam Club</p>
        <h1 className="hero__title">
          <span className="hero__line"><span>Kecil</span></span>{" "}
          <span className="hero__line"><span>bentuknya.</span></span>{" "}
          <span className="hero__line"><span>Besar</span></span>{" "}
          <span className="hero__line"><span>godaannya.</span></span>
        </h1>
        <p className="hero__lede hero__fade hero__meta">
          Satu kukusan. Banyak alasan untuk penasaran. Temukan pilihan dimsum yang memanggil namamu.
        </p>
        <div className="hero__cta hero__fade hero__meta">
          <a className="btn btn--oxblood" href="#menu">Lihat menu <Arrow /></a>
          <a className="btn btn--ghost" href="#ritual">Jelajahi Kalili <Arrow direction="down" /></a>
        </div>
      </div>

      <div className="hero__next" aria-hidden="true">
        <p className="eyebrow">Gulir pelan-pelan</p>
        <p className="hero__next-title">Kukusannya<br />sudah menunggu.</p>
      </div>
      <span className="hero__shade" aria-hidden="true" />

      <div className="hero__foot hero__fade">
        <ul className="hero__spot" aria-label="Sorotan menu">
          {spotlightIds.map((id) => {
            const p = productById(id)!;
            return (
              <li key={id}>
                <a href={`#menu-${id}`}>
                  <ProductImage image={p.image} alt="" sizes="56px" eager />
                  <span>{p.name}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
    </div>
  );
}
