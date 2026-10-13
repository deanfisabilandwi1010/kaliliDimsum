"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/motion/gsap";
import { useExperience } from "./Experience";
import { Arrow } from "./ui";
import { lastFrame, useSequence } from "./useSequence";

const ID = "black-series";
/** Porsi awal sekuens yang masih hitam total dan dilewati. */
const START_FRAME = 0.08;

export function BlackSeriesFeature() {
  const { lite, selection, toggle } = useExperience();
  const rootRef = useRef<HTMLElement>(null);
  const motion = lite === false;
  const selected = Boolean(selection[ID]);
  const { canvasRef, seqRef } = useSequence("black", motion, {
    landscape: { cx: 0.5, cy: 0.5, focus: 0.74 },
    portrait: { cx: 0.5, cy: 0.5, focus: 0.66 },
  }, "#120b08");

  useEffect(() => {
    if (!motion) return;
    const root = rootRef.current!;
    const ctx = gsap.context(() => {
      const state = { frame: 0 };
      // Scrub dimulai saat section baru masuk layar, dan frame awal yang masih
      // gelap total dilewati: ketika section menempel, cahayanya sudah menyala.
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: root, start: "top 80%", end: "bottom bottom", scrub: 0.6 },
      });
      tl.to(state, { frame: 1, duration: 0.94, onUpdate: () => seqRef.current?.setProgress(START_FRAME + (1 - START_FRAME) * state.frame) }, 0)
        .fromTo(".black__window", { scale: 0.84 }, { scale: 1, duration: 0.45, ease: "power1.out" }, 0)
        .set({}, {}, 1);
      // Teks tidak ikut scrub: langsung tampil begitu section terlihat.
      gsap.timeline({ scrollTrigger: { trigger: root, start: "top 55%" } })
        .from(".black__line > span", { yPercent: 110, duration: 0.9, stagger: 0.09, ease: "power4.out" })
        .from(".black__fade", { autoAlpha: 0, y: 24, duration: 0.7, stagger: 0.08, ease: "power2.out" }, 0.35);
    }, root);
    return () => ctx.revert();
  }, [motion, seqRef]);

  return (
    <section ref={rootRef} id={ID} className="black" data-tone-section="dark" data-header="clear" aria-labelledby="black-title">
      <div className="black__sticky">
        <div className="black__copy">
          <p className="eyebrow eyebrow--gold">03 / Sisi lain Kalili</p>
          <h2 id="black-title" className="black__title">
            <span className="black__line"><span>Kenalan</span></span>{" "}
            <span className="black__line"><span>dengan</span></span>{" "}
            <span className="black__line"><span>Black Series.</span></span>
          </h2>
          <p className="black__lede black__fade">Tampilan yang berbeda. Godaan yang sulit dilewatkan.</p>
          <div className="black__fade">
            <button className="btn btn--ivory" type="button" aria-pressed={selected} onClick={() => toggle(ID)}>
              {selected ? "Sudah di pilihanmu" : "Tambah ke pilihan"} <Arrow />
            </button>
          </div>
          <figure className="black__detail black__fade">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/moments/black-series-detail.webp" alt="Poster Black Series: dimsum hitam dengan topping panggang" width={640} height={960} loading="lazy" />
            <figcaption>
              <span className="eyebrow eyebrow--gold">Lihat lebih dekat</span>
              Black Series, dalam detail.
            </figcaption>
          </figure>
        </div>

        <div className="black__window">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="black__poster" src={lastFrame("black")} alt="Kukusan bambu berisi enam dimsum Black Series di atas meja gelap" width={1280} height={720} loading="lazy" />
          {motion && <canvas ref={canvasRef} className="black__canvas" aria-hidden="true" />}
        </div>
      </div>
    </section>
  );
}
