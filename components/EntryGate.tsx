"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { brand } from "@/content/brand";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { ENTERED_KEY } from "@/lib/motion/quality-mode";
import type { SteamerScene } from "@/lib/three/steamer-scene";
import { useExperience } from "./Experience";
import { Arrow, Wordmark } from "./ui";

/** Batas tunggu pemuatan: setelah ini gerbang tetap dibuka apa pun yang terjadi. */
const LOAD_TIMEOUT_MS = 7000;
const MODEL_URL = "/models/kalili-steamer.glb";
/** Lama menahan sampai kukusan terbuka. */
const HOLD_SECONDS = 1.4;
/** Dilepas sebelum penuh: tutup jatuh lebih cepat daripada saat naik. */
const FALL_SECONDS = 0.5;
/** Bagian klip pembuka yang mengikuti tekanan: tutup terangkat, belum bergeser. */
const LID_RANGE = 0.6;

/** Aset yang benar-benar dipakai gerbang dan layar pertama; progres mengikuti unduhannya. */
function preloadList() {
  const frames = window.innerWidth <= 900 ? "m" : "d";
  return [
    "/retro/steamer.webp",
    "/models/steamer-closed.webp",
    `/frames/story/${frames}/0001.webp`,
    ...(brand.logo ? [brand.logo] : []),
  ];
}

type Phase = "idle" | "opening" | "leaving" | "done";

/**
 * Gerbang pembuka: kukusan 3D yang sama dengan di hero, dibuka sendiri oleh
 * pengunjung. Menekan dan menahan tombol (atau kukusannya) mengangkat tutup
 * sedikit demi sedikit dengan uap yang menebal; dilepas sebelum penuh, tutup
 * jatuh kembali. Saat penuh, uap memenuhi layar lalu memudar memperlihatkan
 * hero yang kukusannya sudah terbuka. Keyboard / pembaca layar: satu aktivasi
 * langsung membuka. Mode ringan: tombol biasa tanpa 3D.
 */
export function EntryGate() {
  const { lite, enter, warmUp } = useExperience();
  const [phase, setPhase] = useState<Phase>("idle");
  const [loaded, setLoaded] = useState(false);
  const [has3d, setHas3d] = useState(false);
  const [holding, setHolding] = useState(false);
  const [nudged, setNudged] = useState(false);
  const gateRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SteamerScene | null>(null);
  const holdRef = useRef({ value: 0, dir: 0, raf: 0, last: 0, started: 0 });
  const nudgeTimer = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const release = useCallback(() => {
    document.documentElement.dataset.entered = "1";
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {}
    cancelAnimationFrame(holdRef.current.raf);
    sceneRef.current?.dispose();
    sceneRef.current = null;
    setPhase("done");
    ScrollTrigger.refresh();
  }, []);

  // Sudah ditandai oleh boot script: jangan tampilkan gerbang sama sekali.
  useEffect(() => {
    if (document.documentElement.dataset.entered) {
      try {
        sessionStorage.setItem(ENTERED_KEY, "1");
      } catch {}
      setPhase("done");
      enter();
    }
  }, [enter]);

  // Layar pemuatan: angka dan garis mengikuti aset yang selesai diunduh,
  // termasuk model kukusan 3D; lalu tirai naik dan isi gerbang masuk.
  useEffect(() => {
    if (lite === null || document.documentElement.dataset.entered) return;
    const gate = gateRef.current;
    const loader = loaderRef.current;
    if (!gate || !loader) return;
    const images = preloadList();
    const total = images.length + 1 + (lite ? 0 : 1);
    const shown = { value: 0 };
    let done = 0;
    let finished = false;
    let cancelled = false;

    const paint = () => {
      const value = Math.round(shown.value);
      if (percentRef.current) percentRef.current.textContent = String(value).padStart(2, "0");
      if (barRef.current) barRef.current.style.transform = `scaleX(${shown.value / 100})`;
      loader.setAttribute("aria-valuenow", String(value));
    };

    const reveal = () => {
      if (finished || cancelled) return;
      finished = true;
      window.clearTimeout(cap);
      if (lite) return setLoaded(true);
      const q = gsap.utils.selector(gate);
      gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          gsap.set(q(".gate__stage, .gate__hold, .gate__hint"), { clearProps: "transform,opacity,visibility" });
          setLoaded(true);
        },
      })
        .to(shown, { value: 100, duration: 0.3, ease: "none", onUpdate: paint })
        .to(q(".gate__loader-inner, .gate__loader-skip"), { autoAlpha: 0, y: -24, duration: 0.4, ease: "power2.in" }, "+=0.15")
        .to(loader, { autoAlpha: 0, duration: 0.45, ease: "none" })
        // Garis portal tergambar dari bawah, lalu judul, kukusan, dan tombol menyusul.
        .fromTo(q(".gate__arch"), { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "power3.inOut" }, "<")
        .from(q(".gate__line > span"), { yPercent: 115, duration: 1.1, stagger: 0.12, ease: "power4.out" }, "<0.3")
        .from(q(".gate__center .eyebrow, .gate__lede"), { autoAlpha: 0, y: 14, duration: 0.7, stagger: 0.25 }, "<0.15")
        .from(q(".gate__stage"), { yPercent: 30, autoAlpha: 0, duration: 1.2, ease: "back.out(1.2)" }, "<0.1")
        .from(q(".gate__hold, .gate__hint"), { y: 22, autoAlpha: 0, duration: 0.7, stagger: 0.12 }, "<0.45")
        .from(q(".gate__top > *"), { autoAlpha: 0, duration: 0.6, stagger: 0.06 }, "<0.1");
    };

    const bump = () => {
      if (cancelled || finished) return;
      done += 1;
      gsap.to(shown, {
        value: (done / total) * 100, duration: 0.45, ease: "power2.out", overwrite: true,
        onUpdate: paint,
        onComplete: () => {
          if (done >= total) reveal();
        },
      });
    };

    const cap = window.setTimeout(reveal, LOAD_TIMEOUT_MS);
    for (const src of images) {
      const img = new Image();
      img.onload = img.onerror = bump;
      img.src = src;
    }
    (document.fonts?.ready ?? Promise.resolve()).then(bump, bump);
    // Kukusan 3D gerbang: modul adegan yang sama dengan hero, hanya tampilan
    // (tutupnya digerakkan oleh tekanan pengunjung lewat setLid).
    if (!lite) {
      import("@/lib/three/steamer-scene")
        .then(({ createSteamerScene }) =>
          createSteamerScene({
            canvas: canvasRef.current!,
            frame: stageRef.current!,
            url: MODEL_URL,
            logoUrl: brand.logo,
            compact: window.matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)").matches,
            interactive: false,
            framing: "closed",
          }),
        )
        .then((scene) => {
          if (cancelled || phaseRef.current === "done") return scene.dispose();
          sceneRef.current = scene;
          setHas3d(true);
          bump();
        })
        .catch(bump);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(cap);
      gsap.killTweensOf(shown);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [lite]);

  /** Garis portal dan judul sedikit mengikuti kursor. */
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || lite || !loaded || phaseRef.current !== "idle") return;
    const el = e.currentTarget;
    el.style.setProperty("--mx", (e.clientX / el.clientWidth - 0.5).toFixed(3));
    el.style.setProperty("--my", (e.clientY / el.clientHeight - 0.5).toFixed(3));
  };

  /** Langsung masuk tanpa animasi (mis. "Langsung lihat menu"). */
  const skip = useCallback(() => {
    if (phaseRef.current === "leaving" || phaseRef.current === "done") return;
    setPhase("leaving");
    enter();
    release();
  }, [enter, release]);

  // Kukusan terbuka penuh: tutup menyelesaikan klip pembukanya, uap memenuhi
  // layar dari kukusan, lalu gerbang memudar memperlihatkan hero yang
  // kukusannya sudah terbuka (warmUp → hero membuka tanpa animasi kedua).
  const complete = useCallback(() => {
    const gate = gateRef.current;
    if (phaseRef.current !== "idle" || !gate) return;
    setPhase("opening");
    setHolding(false);
    cancelAnimationFrame(holdRef.current.raf);
    holdRef.current.dir = 0;
    gate.style.setProperty("--hold", "1");
    navigator.vibrate?.([14, 40, 26]);
    warmUp();
    if (lite) {
      enter();
      return release();
    }
    sceneRef.current?.open();
    const q = gsap.utils.selector(gate);
    gsap
      .timeline()
      .to(q(".gate__center, .gate__top, .gate__arch"), { autoAlpha: 0, duration: 0.45, ease: "power1.in" }, 0.1)
      .fromTo(q(".gate__whiteout"), { scale: 0.12, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.9, ease: "power2.in" }, 0.4)
      .add(() => {
        // Di balik uap: gerbang menjadi tembus, hero (sudah terbuka) menunggu di belakang.
        setPhase("leaving");
        enter();
        gate.style.background = "transparent";
        gsap.set(q(".gate__canvas, .gate__ui"), { autoAlpha: 0 });
      }, 1.3)
      .to(q(".gate__whiteout"), { scale: 1.6, duration: 1.2, ease: "power1.out" }, 1.3)
      .to(gate, { autoAlpha: 0, duration: 0.95, ease: "power1.inOut" }, 1.45)
      .add(() => {
        release();
        document.getElementById("main")?.focus({ preventScroll: true });
      }, 2.45);
  }, [lite, enter, warmUp, release]);

  // ---------- Tahan untuk membuka ----------
  const step = useCallback((now: number) => {
    const hold = holdRef.current;
    // Jam nyata (batas 0,1 dtk): di perangkat lambat durasi tahan tetap ±1,4 dtk.
    const dt = Math.min(0.1, (now - hold.last) / 1000);
    hold.last = now;
    hold.value = Math.min(1, Math.max(0, hold.value + (hold.dir > 0 ? dt / HOLD_SECONDS : -dt / FALL_SECONDS)));
    gateRef.current?.style.setProperty("--hold", hold.value.toFixed(3));
    // Naik melambat di ujung (seperti tutup yang makin berat ditahan uap).
    sceneRef.current?.setLid((1 - (1 - hold.value) * (1 - hold.value)) * LID_RANGE);
    if (hold.value >= 1) {
      hold.raf = 0;
      return complete();
    }
    if (hold.dir < 0 && hold.value <= 0) {
      hold.raf = 0;
      hold.dir = 0;
      return;
    }
    hold.raf = requestAnimationFrame(step);
  }, [complete]);

  const startHold = (event: React.PointerEvent) => {
    if (!loaded || phaseRef.current !== "idle" || event.button > 0) return;
    event.preventDefault();
    if (lite) return complete();
    const hold = holdRef.current;
    hold.dir = 1;
    hold.started = performance.now();
    setHolding(true);
    setNudged(false);
    navigator.vibrate?.(8);
    if (!hold.raf) {
      hold.last = performance.now();
      hold.raf = requestAnimationFrame(step);
    }
  };

  // Lepas di mana pun (jari bisa bergeser keluar tombol).
  useEffect(() => {
    if (!loaded) return;
    const end = () => {
      const hold = holdRef.current;
      if (hold.dir <= 0 || phaseRef.current !== "idle") return;
      hold.dir = -1;
      setHolding(false);
      // Hanya diklik/diketuk: beri tahu bahwa tombolnya perlu ditahan.
      if (performance.now() - hold.started < 450) {
        setNudged(true);
        window.clearTimeout(nudgeTimer.current);
        nudgeTimer.current = window.setTimeout(() => setNudged(false), 2200);
      }
      if (!hold.raf) {
        hold.last = performance.now();
        hold.raf = requestAnimationFrame(step);
      }
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  }, [loaded, step]);

  useEffect(
    () => () => {
      cancelAnimationFrame(holdRef.current.raf);
      window.clearTimeout(nudgeTimer.current);
    },
    [],
  );

  if (phase === "done") return null;

  return (
    <div
      ref={gateRef}
      className="gate"
      data-phase={phase}
      data-ready={loaded}
      data-3d={has3d || undefined}
      data-holding={holding || undefined}
      role="region"
      aria-label="Pembuka Kalili Steam Club"
      onPointerMove={onPointerMove}
    >
      {/* Kanvas selebar layar (uap tidak terpotong); kukusannya dibingkai di .gate__stage. */}
      {lite === false && <canvas ref={canvasRef} className="gate__canvas" aria-hidden="true" />}
      <span className="gate__whiteout" aria-hidden="true" />

      <div className="gate__ui" inert={!loaded}>
        <span className="gate__arch" aria-hidden="true" />

        <div className="gate__top">
          <span className="gate__logo"><Wordmark /></span>
          <a className="gate__skip" href="#menu" onClick={skip}>
            Langsung lihat menu <Arrow />
          </a>
        </div>

        <div className="gate__center">
          <p className="eyebrow eyebrow--gold">Selamat datang di</p>
          <h2 className="gate__title">
            <span className="gate__line"><span>Kalili</span></span>{" "}
            <span className="gate__line"><span>Steam Club.</span></span>
          </h2>
          <p className="gate__lede">Perjalanan kecil dari kukusan menuju pilihanmu.</p>
          <button
            className="gate__hold"
            type="button"
            aria-describedby="gate-hint"
            onPointerDown={startHold}
            onContextMenu={(e) => e.preventDefault()}
            // Keyboard atau pembaca layar (detail 0): satu aktivasi langsung membuka.
            onClick={(e) => e.detail === 0 && complete()}
          >
            <span className="gate__hold-dial" aria-hidden="true">
              <svg className="gate__hold-svg" viewBox="0 0 100 100">
                <circle className="gate__hold-track" cx="50" cy="50" r="46" pathLength={100} />
                <circle className="gate__hold-ring" cx="50" cy="50" r="46" pathLength={100} />
              </svg>
              <Arrow direction="up" />
            </span>
            <span className="gate__hold-label">{lite ? "Buka kukusannya" : holding ? "Terus tahan…" : "Tahan untuk membuka"}</span>
          </button>
          <p id="gate-hint" className="gate__hint" aria-live="polite">
            {lite ? "" : nudged ? "Tahan sedikit lebih lama, jangan dilepas" : "Tekan dan tahan tombol atau kukusannya"}
          </p>
        </div>

        {/* Kukusan: area tekan-tahan juga. Gambar diam tampil sampai 3D siap
            (atau seterusnya jika WebGL tidak tersedia). */}
        <div ref={stageRef} className="gate__stage" aria-hidden="true" onPointerDown={startHold} onContextMenu={(e) => e.preventDefault()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gate__steamer" src="/retro/steamer.webp" alt="" width={1000} height={1000} />
        </div>
      </div>

      {!loaded && (
        <div
          ref={loaderRef}
          className="gate__loader"
          role="progressbar"
          aria-label="Memuat Kalili Steam Club"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          <div className="gate__loader-inner">
            <span className="gate__loader-logo"><Wordmark /></span>
            <p className="gate__loader-count" aria-hidden="true"><span ref={percentRef}>00</span><small>%</small></p>
            <span className="gate__loader-bar" aria-hidden="true"><span ref={barRef} /></span>
            <p className="gate__loader-label">Menyiapkan kukusan</p>
          </div>
          <a className="gate__loader-skip" href="#menu" onClick={skip}>Langsung lihat menu</a>
        </div>
      )}
    </div>
  );
}
