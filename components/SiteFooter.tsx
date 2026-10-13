"use client";

import { useEffect, useRef } from "react";
import { brand } from "@/content/brand";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { useExperience } from "./Experience";
import { Arrow, Wordmark } from "./ui";

export function Marquee() {
  const { lite } = useExperience();
  const trackRef = useRef<HTMLDivElement>(null);

  // Pita berjalan sendiri, lalu melaju, berbalik arah, dan miring mengikuti
  // kecepatan serta arah scroll.
  useEffect(() => {
    if (lite !== false) return;
    const track = trackRef.current!;
    const loop = gsap.to(track, { xPercent: -33.333, duration: 30, ease: "none", repeat: -1 });
    loop.totalTime(loop.duration() * 50);
    const skew = gsap.quickTo(track, "skewX", { duration: 0.5, ease: "power3.out" });
    const trigger = ScrollTrigger.create({
      onUpdate: (self) => {
        const v = gsap.utils.clamp(-3000, 3000, self.getVelocity());
        const direction = v < 0 ? -1 : 1;
        skew(v / -140);
        gsap.to(loop, {
          timeScale: direction * (1 + Math.abs(v) / 260),
          duration: 0.25,
          overwrite: true,
          onComplete: () => {
            skew(0);
            gsap.to(loop, { timeScale: direction, duration: 1.4, ease: "power2.out" });
          },
        });
      },
    });
    return () => {
      trigger.kill();
      loop.kill();
      gsap.set(track, { clearProps: "transform" });
    };
  }, [lite]);

  const words = ["Dimsum by Kalili", "Buka kukusannya", "Pilih favoritmu", "Kalili Steam Club"];
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined}>
      {words.map((w) => (
        <li key={w}>{w}<span aria-hidden="true">✦</span></li>
      ))}
    </ul>
  );
  return (
    <div className="marquee" data-tone-section="dark" data-header="clear">
      <div ref={trackRef} className="marquee__track">{row(false)}{row(true)}{row(true)}</div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer" data-tone-section="light">
      <div className="footer__main">
        <Wordmark />
        <div>
          <p className="footer__tagline">Kecil bentuknya. Besar godaannya.</p>
          <nav className="footer__nav" aria-label="Footer">
            <a href="#menu">Menu</a>
            <a href="#black-series">Black Series</a>
            <a href="#cerita">Cerita Kalili</a>
            <a href="#top">Kembali ke atas <Arrow direction="up" /></a>
          </nav>
          {brand.outlets.length > 0 && (
            <ul className="footer__outlets">
              {brand.outlets.map((o) => (
                <li key={o.name}><strong>{o.name}</strong><span>{o.address}</span><span>{o.hours}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="footer__base">
        <span>{brand.displayName}</span>
      </div>
    </footer>
  );
}
