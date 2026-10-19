"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/motion/gsap";
import { HANDOFF } from "@/lib/motion/handoff";
import { useExperience } from "./Experience";
import { Arrow } from "./ui";
import { lastFrame, useSequence } from "./useSequence";

const BEATS = [
  { step: "Buka", title: "Buka kukusannya.", body: "Gulir pelan-pelan. Tutupnya terangkat mengikuti gerakmu." },
  { step: "Temukan", title: "Dari kukusan,", body: "Uap menyibak, dan isinya mulai terlihat." },
  { step: "Pilih", title: "menuju pilihanmu.", body: "Lihat lebih dekat, lalu temukan yang ingin kamu coba." },
];

// Rentang progress lokal tiap beat: [masuk, keluar]. Beat terakhir tidak keluar.
const RANGES: [number, number][] = [[0, 0.26], [0.32, 0.58], [0.64, 1]];
/** Sekuens selesai sedikit sebelum akhir agar pose final sempat diam. */
const FRAME_END = 0.9;

export function SteamStory() {
  const { lite } = useExperience();
  const rootRef = useRef<HTMLElement>(null);
  const motion = lite === false;
  const { canvasRef, seqRef } = useSequence("story", motion, {
    landscape: { cx: 0.62, cy: 0.5 },
    // Portrait: objek di paruh atas, teks di area meja di bawahnya.
    portrait: { cx: 0.5, cy: 0.43, focus: 0.52 },
  });

  useEffect(() => {
    if (!motion) return;
    const root = rootRef.current!;
    const ctx = gsap.context(() => {
      const beats = gsap.utils.toArray<HTMLElement>(".beat");
      const portrait = window.matchMedia("(max-aspect-ratio: 1/1), (max-width: 760px)").matches;
      const state = { frame: 0, zoom: portrait ? 0.9 : 1 };
      const render = () => seqRef.current?.setProgress(state.frame, state.zoom);
      gsap.set(beats.slice(1), { autoAlpha: 0, y: 40 });
      // Section = cerita utama + ekor serah-terima ke panggung menu.
      const sticky = root.querySelector<HTMLElement>(".story__sticky")!;
      const tail = () => sticky.offsetHeight * HANDOFF;
      const mainSpan = () => root.offsetHeight - sticky.offsetHeight - tail();

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: () => `+=${mainSpan()}`,
          invalidateOnRefresh: true,
          scrub: 0.6,
          onUpdate: (self) => {
            const step = RANGES.findLastIndex(([start]) => self.progress >= start - 0.03);
            if (root.dataset.step !== String(step)) root.dataset.step = String(step);
          },
        },
      });
      tl.to(state, { frame: 1, duration: FRAME_END, onUpdate: render }, 0);
      // Kamera mendekat pelan sepanjang cerita supaya adegan terasa hidup.
      tl.to(state, { zoom: portrait ? 1.1 : 1.05, duration: 1, ease: "sine.inOut", onUpdate: render }, 0);
      beats.forEach((beat, i) => {
        const [start, end] = RANGES[i];
        if (i > 0) tl.to(beat, { autoAlpha: 1, y: 0, duration: 0.07, ease: "power2.out" }, start);
        if (i < beats.length - 1) tl.to(beat, { autoAlpha: 0, y: -40, duration: 0.06, ease: "power2.in" }, end);
      });
      tl.fromTo(".story__rail-fill", { "--p": 0 }, { "--p": 1, duration: 1 }, 0);
      tl.set({}, {}, 1);

      // ---------- Serah-terima ke panggung menu ----------
      // Lampu ruangan padam seperti iris yang menutup ke arah kukusan, sementara
      // kamera terus mendekat. Panggung menu (MenuSection) lalu muncul di tempat
      // dengan sorot lampunya sendiri di titik yang sama.
      const iris = { hole: 120 };
      const night = root.querySelector<HTMLElement>(".story__night")!;
      gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: root, start: () => `top+=${mainSpan()} top`, end: "bottom bottom", scrub: 0.4, invalidateOnRefresh: true },
      })
        // Yang digeser elemen-elemennya, bukan .story__copy: transform pada
        // kotak itu menjadikannya acuan posisi label & teks beat yang di
        // mobile diletakkan absolut terhadap layar, sehingga semuanya bergeser.
        .to(".story__copy > .eyebrow, .story__beats, .story__rail", { autoAlpha: 0, y: -30, duration: 0.2, ease: "power1.in" }, 0)
        .fromTo(iris, { hole: 120 }, {
          hole: 0, duration: 0.5, ease: "power2.inOut",
          onUpdate: () => night.style.setProperty("--hole", `${iris.hole}%`),
        }, 0.04)
        .fromTo(night, { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0.02)
        .fromTo(state, { zoom: portrait ? 1.1 : 1.05 }, { zoom: portrait ? 1.24 : 1.18, duration: 0.56, ease: "power1.in", onUpdate: render, immediateRender: false }, 0)
        .set({}, {}, 1);
    }, root);
    return () => ctx.revert();
  }, [motion, seqRef]);

  return (
    <section ref={rootRef} id="ritual" className="story" data-step="0" data-tone-section="light" data-header="clear" aria-labelledby="story-title">
      <div className="story__sticky">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="story__poster" src={lastFrame("story")} alt="Kukusan bambu terbuka dengan lima siomay terangkat di antara uap" width={1280} height={720} loading="lazy" />
        {motion && <canvas ref={canvasRef} className="story__canvas" aria-hidden="true" />}
        <span className="story__night" aria-hidden="true" />

        <div className="story__copy">
          <p className="eyebrow">01 / Ritual kecil Kalili</p>
          <h2 id="story-title" className="sr-only">Dari kukusan, menuju pilihanmu.</h2>
          <div className="story__beats">
            {BEATS.map((beat, i) => (
              <div className="beat" key={beat.step}>
                <p className="beat__step"><span>0{i + 1}</span>{beat.step}</p>
                <p className="beat__title" aria-hidden="true">{beat.title}</p>
                <p className="beat__body">{beat.body}</p>
                {i === BEATS.length - 1 && (
                  <a className="btn btn--oxblood" href="#menu">Pilih yang bikin penasaran <Arrow direction="down" /></a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="story__rail" aria-hidden="true">
          <span className="story__rail-track"><span className="story__rail-fill" /></span>
          {BEATS.map((beat, i) => (
            <span className="story__rail-step" data-index={i} key={beat.step}>{beat.step}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
