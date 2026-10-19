"use client";

import { useEffect, useRef, useState } from "react";
import { ARRIVE } from "@/lib/motion/dive";
import { gsap } from "@/lib/motion/gsap";
import { CURTAIN } from "@/lib/motion/handoff";
import type { DimsumScene } from "@/lib/three/dimsum-scene";
import { useExperience } from "./Experience";
import { Arrow, SteamCurl } from "./ui";

const MODEL_URL = "/models/kalili-dimsum.glb";

// Uraian bahan pada model bersifat ilustratif (lihat README aset 3D); teks
// detail hanya menggambarkan bentuk pada model, bukan klaim resep.
// `side` = arah label saat terurai; bahan tanpa `side` tidak diberi label.
// `dx`/`dy` (meter) menggeser titik penunjuk dari pusat bahan ke tepinya.
const PARTS = [
  { node: "wrapper_shell", label: "Kulit", side: "right", dx: 0.027, dy: 0.004, detail: "Lembaran tipis berlipat yang membungkus seluruh isi." },
  { node: "meat_filling", label: "Daging", side: "left", dx: -0.024, dy: 0, detail: "Isi padat yang mengisi bagian tengah." },
  { node: "vegetable_pieces", label: "Sayuran", side: "up", dx: 0, dy: 0.014, detail: "Potongan hijau kecil di sela-sela isi." },
  { node: "carrot_mix", label: "Wortel", side: "up", dx: 0, dy: 0.014, detail: "Dadu jingga yang tersebar di dalam isi." },
  { node: "carrot_topping", label: "Taburan", side: null, dx: 0, dy: 0, detail: "Wortel cincang halus di puncak siomay." },
] as const;
const LABELLED = PARTS.filter((p) => p.side);

const PHASES = ["Satu siomay, utuh.", "Dibuka lapis demi lapis.", "Lalu kembali menyatu."];
/** Debu emas di sekitar model: [x %, y %, durasi dtk, jeda dtk, ukuran px]. */
const DUST = [
  [22, 30, 11, 0, 3], [74, 24, 13, -4, 2], [34, 62, 9, -6, 2], [66, 58, 12, -2, 3], [48, 18, 14, -8, 2],
  [82, 44, 10, -5, 2], [16, 52, 12, -9, 3], [58, 74, 9, -3, 2], [40, 40, 15, -11, 2],
];
/** Kata besar di belakang model, satu per babak. */
const GHOSTS = ["Utuh", "Terurai", "Menyatu"];

export function DimsumAnatomy() {
  const { lite } = useExperience();
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
  const pingRef = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef<(HTMLLIElement | null)[]>([]);
  const sceneRef = useRef<DimsumScene | null>(null);
  const progressRef = useRef(0);
  const [live, setLive] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [hinted, setHinted] = useState(true);
  const motion = lite === false;
  const detail = PARTS.find((p) => p.node === picked);

  // Model 3D baru dimuat ketika section mendekati layar. Jika WebGL atau model
  // gagal, gambar siomay utuh dan daftar bahan statis tetap tampil.
  useEffect(() => {
    if (!motion) return;
    const root = rootRef.current!;
    let disposed = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        import("@/lib/three/dimsum-scene")
          .then(({ createDimsumScene }) =>
            createDimsumScene({
              canvas: canvasRef.current!,
              url: MODEL_URL,
              labels: LABELLED.flatMap((part, i) =>
                labelRefs.current[i] ? [{ node: part.node, el: labelRefs.current[i]!, dx: part.dx, dy: part.dy }] : [],
              ),
              parts: PARTS.map((p) => p.node),
              shadow: shadowRef.current,
              ping: pingRef.current,
              onPick: setPicked,
              onInteract: () => setHinted(false),
              onContextLost: () => setLive(false),
            }),
          )
          .then((scene) => {
            if (disposed) return scene.dispose();
            sceneRef.current = scene;
            scene.setProgress(progressRef.current);
            setLive(true);
          })
          .catch(() => setLive(false));
      },
      { rootMargin: "200% 0px" },
    );
    observer.observe(root);
    return () => {
      disposed = true;
      observer.disconnect();
      sceneRef.current?.dispose();
      sceneRef.current = null;
      setLive(false);
      setPicked(null);
    };
  }, [motion]);

  // Posisi scroll menentukan waktu animasi; berhenti dan mundur ikut scroll.
  useEffect(() => {
    if (!motion) return;
    const root = rootRef.current!;
    const ctx = gsap.context(() => {
      const state = { progress: 0 };
      const phases = gsap.utils.toArray<HTMLElement>(".anatomy__phase");
      const ghosts = gsap.utils.toArray<HTMLElement>(".anatomy__ghost span");
      gsap.set(phases.slice(1), { autoAlpha: 0, y: 24 });
      gsap.set(ghosts.slice(1), { autoAlpha: 0 });
      // Babak berganti: kalimat dan kata besar di belakang model bertukar bersama.
      const swap = (from: number, to: number, at: number) =>
        tl
          .to(phases[from], { autoAlpha: 0, y: -24, duration: 0.03, ease: "power1.in" }, at)
          .to(ghosts[from], { autoAlpha: 0, duration: 0.05 }, at)
          .to(phases[to], { autoAlpha: 1, y: 0, duration: 0.04, ease: "power2.out" }, at + 0.03)
          .to(ghosts[to], { autoAlpha: 1, duration: 0.06 }, at + 0.02);

      // Section = cerita utama + ekor tempat tirai ritual naik menutupinya.
      const pin = root.querySelector<HTMLElement>(".anatomy__pin")!;
      const stage = root.querySelector<HTMLElement>(".anatomy__stage")!;
      const tail = () => pin.offsetHeight * CURTAIN;
      const mainSpan = () => root.offsetHeight - pin.offsetHeight - tail();

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: root, start: "top top", end: () => `+=${mainSpan()}`, scrub: 0.5, invalidateOnRefresh: true },
      });
      tl.to(state, {
        progress: 1,
        duration: 1,
        onUpdate: () => {
          progressRef.current = state.progress;
          sceneRef.current?.setProgress(state.progress);
        },
      }, 0);
      // 0–12,5% utuh · 12,5–40% terpisah · 40–60% terurai + label · 60–90% menyatu · 90–100% CTA.
      swap(0, 1, 0.115);
      // Uap hanya ada selama siomay utuh; cincin di lantai melebar saat terurai.
      tl.to(".anatomy__steam", { autoAlpha: 0, duration: 0.07 }, 0.1);
      tl.fromTo(".anatomy__shadow", { "--ring": 1 }, { "--ring": 1.5, duration: 0.275, ease: "sine.inOut" }, 0.125);
      // Penunjuk tergambar satu per satu: titik, garis, lalu nama.
      tl.fromTo(".anatomy__label", { autoAlpha: 0, "--draw": 0 }, { autoAlpha: 1, "--draw": 1, duration: 0.06, stagger: 0.016, ease: "power2.out" }, 0.355);
      tl.to(".anatomy__label", { autoAlpha: 0, "--draw": 0, duration: 0.04, ease: "power1.in" }, 0.585);
      swap(1, 2, 0.6);
      tl.to(".anatomy__shadow", { "--ring": 1, duration: 0.3, ease: "sine.inOut" }, 0.6);
      tl.to(".anatomy__steam", { autoAlpha: 1, duration: 0.07 }, 0.86);
      tl.to(phases[2], { autoAlpha: 0, y: -24, duration: 0.03, ease: "power1.in" }, 0.87);
      tl.fromTo(".anatomy__cta", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.05, ease: "power2.out" }, 0.9);
      tl.fromTo(".anatomy__bar-fill", { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
      // Kata besar bergeser pelan ke samping sepanjang cerita.
      tl.fromTo(".anatomy__ghost", { xPercent: 5 }, { xPercent: -5, duration: 1 }, 0);

      // ---------- Tirai ritual ----------
      // Bagian ritual naik menutupi adegan ini dari bawah. Selama itu adegan
      // tetap menempel, mundur sedikit, dan meredup supaya tirai terasa di depan.
      gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root, start: () => `top+=${mainSpan()} top`, end: "bottom bottom", scrub: 0.4, invalidateOnRefresh: true,
          // Bahan yang sedang difokuskan dilepas begitu tirai mulai naik.
          onEnter: () => {
            sceneRef.current?.focus(null);
            setPicked(null);
          },
        },
      })
        // Kotaknya hanya memudar; yang bergeser anak-anaknya. Transform pada
        // .anatomy__copy akan mengganti acuan posisi isinya dan menelan
        // `translate` CSS-nya di desktop.
        .to(".anatomy__copy", { autoAlpha: 0, duration: 0.5, ease: "power1.in" }, 0)
        .to(".anatomy__copy > *", { y: -40, duration: 0.5, ease: "power1.in" }, 0)
        .to(".anatomy__hint", { autoAlpha: 0, duration: 0.3 }, 0)
        .to(stage, { scale: 0.9, yPercent: -6, duration: 1 }, 0)
        .fromTo(".anatomy__night", { opacity: 0 }, { opacity: 0.55, duration: 1, ease: "power1.in" }, 0);
    }, root);
    return () => ctx.revert();
  }, [motion]);

  // Tiba dari "Kenali Isinya" di hero: siomay berputar menyambut, teks naik
  // satu per satu begitu tirai transisi memudar.
  useEffect(() => {
    if (!motion) return;
    const onArrive = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== "anatomi") return;
      sceneRef.current?.nudge(0.16);
      // fromTo dengan nilai akhir eksplisit, bukan from(): from() memakai
      // keadaan saat dipanggil sebagai tujuan, dan elemen yang sedang memudar
      // (mis. transisi opacity .anatomy__phases) bisa berakhir tak terlihat.
      // Setelah selesai semua gaya inline dihapus, kembali ke stylesheet.
      gsap.fromTo(
        rootRef.current!.querySelectorAll(".anatomy__copy > .eyebrow, .anatomy__title, .anatomy__phases, .anatomy__explore"),
        { y: 34, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", stagger: 0.08, overwrite: "auto", clearProps: "transform,opacity,visibility" },
      );
    };
    window.addEventListener(ARRIVE, onArrive);
    return () => window.removeEventListener(ARRIVE, onArrive);
  }, [motion]);

  const choose = (node: string | null) => {
    setPicked(node);
    setHinted(false);
    sceneRef.current?.focus(node);
  };

  // Escape melepas fokus bahan.
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPicked(null);
      sceneRef.current?.focus(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked]);

  return (
    <section
      ref={rootRef}
      id="anatomi"
      className="anatomy"
      data-live={live}
      data-picked={picked ? "true" : undefined}
      data-tone-section="light"
      data-header="clear"
      aria-labelledby="anatomy-title"
    >
      <div className="anatomy__pin">
        <span className="anatomy__night" aria-hidden="true" />
        <div className="anatomy__stage">
          <span className="anatomy__arch" aria-hidden="true" />
          <div className="anatomy__ghost" aria-hidden="true">
            {GHOSTS.map((word) => <span key={word}>{word}</span>)}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="anatomy__poster" src="/models/dimsum-assembled.webp" alt="Model 3D siomay utuh dengan taburan wortel di atasnya" width={900} height={900} loading="lazy" />
          <span ref={shadowRef} className="anatomy__shadow" aria-hidden="true" />
          <span className="anatomy__steam" aria-hidden="true"><SteamCurl /><SteamCurl /><SteamCurl /></span>
          <span className="anatomy__dust" aria-hidden="true">
            {DUST.map(([x, y, duration, delay, size], i) => (
              <b key={i} style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, animationDuration: `${duration}s`, animationDelay: `${delay}s` }} />
            ))}
          </span>
          {motion && <canvas ref={canvasRef} className="anatomy__canvas" aria-hidden="true" />}
          <span ref={pingRef} className="anatomy__ping" aria-hidden="true" />
          <ul className="anatomy__labels" aria-hidden="true">
            {LABELLED.map((part, i) => (
              <li key={part.node} ref={(el) => { labelRefs.current[i] = el; }} className="anatomy__label" data-side={part.side}>
                <i className="anatomy__dot" />
                <i className="anatomy__lead" />
                <span className="anatomy__tag"><small>Bahan 0{i + 1}</small>{part.label}</span>
              </li>
            ))}
          </ul>
          <p className="anatomy__hint" data-show={hinted} aria-hidden="true">
            <span className="anatomy__hint-mouse">Seret untuk memutar · klik bahan untuk detail</span>
            <span className="anatomy__hint-touch">Geser untuk memutar · ketuk bahan</span>
          </p>
        </div>

        <div className="anatomy__copy">
          <p className="eyebrow">Di dalam satu gigitan</p>
          <h2 id="anatomy-title" className="anatomy__title">Lihat lebih dekat.</h2>
          <div className="anatomy__phases" aria-hidden="true">
            {PHASES.map((text) => (
              <p className="anatomy__phase" key={text}>{text}</p>
            ))}
          </div>
          <ul className="anatomy__list" aria-label="Bahan">
            {LABELLED.map((part, i) => (
              <li key={part.node}><span>0{i + 1}</span>{part.label}</li>
            ))}
          </ul>

          {/* Jalan pintas (juga untuk keyboard) ke fokus tiap bahan pada model. */}
          <div className="anatomy__explore">
            <div className="anatomy__chips" role="group" aria-label="Lihat detail bahan pada model 3D">
              {PARTS.map((part) => (
                <button key={part.node} type="button" className="anatomy__chip" aria-pressed={picked === part.node} onClick={() => choose(picked === part.node ? null : part.node)}>
                  {part.label}
                </button>
              ))}
            </div>
            <div className="anatomy__detail" role="status">
              {detail && (
                <div className="anatomy__detail-card" key={detail.node}>
                  <p className="anatomy__detail-index">Bahan 0{PARTS.indexOf(detail) + 1} / 0{PARTS.length}</p>
                  <p className="anatomy__detail-name">{detail.label}</p>
                  <p className="anatomy__detail-text">{detail.detail}</p>
                  <div className="anatomy__detail-actions">
                    <button type="button" onClick={() => choose(null)}>Kembali</button>
                    <button type="button" onClick={() => sceneRef.current?.resetView()}>Atur ulang putaran</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="anatomy__cta">
            <a className="btn btn--oxblood" href="#menu">Lihat Menu <Arrow /></a>
          </div>
          <span className="anatomy__bar" aria-hidden="true"><span className="anatomy__bar-fill" /></span>
        </div>
      </div>
    </section>
  );
}
