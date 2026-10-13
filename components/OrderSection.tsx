"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/motion/gsap";
import { useExperience } from "./Experience";
import { Arrow } from "./ui";

export function OrderSection() {
  const { lite, count, openDrawer } = useExperience();
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (lite !== false) return;
    const ctx = gsap.context(() => {
      // Section merah membuka seperti iris dari bawah, menggemakan gerbang pembuka.
      gsap.fromTo(
        rootRef.current,
        { clipPath: "circle(12% at 50% 100%)" },
        {
          clipPath: "circle(125% at 50% 100%)", ease: "none",
          scrollTrigger: { trigger: rootRef.current, start: "top bottom", end: "top 20%", scrub: 0.4 },
        },
      );
      const tl = gsap.timeline({ scrollTrigger: { trigger: rootRef.current, start: "top 65%" } });
      tl.from(".order__line > span", { yPercent: 110, duration: 1, ease: "power4.out", stagger: 0.1 })
        .from(".order__fade", { autoAlpha: 0, y: 20, duration: 0.7, stagger: 0.08 }, 0.4)
        .from(".order__mascot", { yPercent: 40, rotate: 12, autoAlpha: 0, duration: 1.1, ease: "back.out(1.5)" }, 0.2)
        .from(".order__lantern", { yPercent: -100, duration: 1.2, ease: "bounce.out", stagger: 0.15 }, 0);
    }, rootRef);
    return () => ctx.revert();
  }, [lite]);

  return (
    <section ref={rootRef} id="pilihanmu" className="order" data-tone-section="dark" data-header="clear" aria-labelledby="order-title">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="order__lantern order__lantern--a" src="/retro/lantern.webp" alt="" width={420} height={504} loading="lazy" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="order__lantern order__lantern--b" src="/retro/lantern.webp" alt="" width={420} height={504} loading="lazy" />

      <div className="order__copy">
        <p className="eyebrow eyebrow--gold order__fade">05 / Pilihanmu, ceritamu</p>
        <h2 id="order-title" className="order__title">
          <span className="order__line"><span>Giliran kamu</span></span>{" "}
          <span className="order__line"><span>buka kukusan.</span></span>
        </h2>
        <p className="order__lede order__fade">
          {count > 0
            ? `${count} menu sudah tersimpan. Tinjau ringkasannya sebelum kamu tanyakan.`
            : "Mulai dari yang paling bikin penasaran."}
        </p>
        <div className="order__cta order__fade">
          {count > 0 ? (
            <button className="btn btn--ivory" type="button" onClick={openDrawer}>Lihat pilihanmu <Arrow /></button>
          ) : (
            <a className="btn btn--ivory" href="#menu">Pilih menu favoritmu <Arrow /></a>
          )}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="order__mascot" src="/retro/mascot.webp" alt="Si Kali, maskot siomay Kalili, melambaikan tangan" width={760} height={760} loading="lazy" />
    </section>
  );
}
