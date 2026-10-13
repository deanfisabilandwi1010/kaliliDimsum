"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { brand } from "@/content/brand";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { ENTERED_KEY } from "@/lib/motion/quality-mode";
import { useExperience } from "./Experience";
import { Arrow, SteamCurl, Wordmark } from "./ui";

/** Jika video tidak mulai dalam waktu ini, pembuka dilewati agar tidak ada loader abadi. */
const START_TIMEOUT_MS = 5000;
/** Iris dimulai sebelum video habis, supaya layar tidak pernah diam membeku. */
const LEAD_SECONDS = 0.9;
/** Batas tunggu pemuatan: setelah ini gerbang tetap dibuka apa pun yang terjadi. */
const LOAD_TIMEOUT_MS = 7000;

/** Aset yang benar-benar dipakai gerbang dan layar pertama; progres mengikuti unduhannya. */
function preloadList(lite: boolean) {
  const frames = window.innerWidth <= 900 ? "m" : "d";
  const images = [
    "/retro/steamer.webp",
    "/video/hero-poster.jpg",
    "/video/intro-poster.jpg",
    `/frames/story/${frames}/0001.webp`,
    ...(brand.logo ? [brand.logo] : []),
  ];
  // Mode ringan tidak memutar video, jadi tidak ikut diunduh.
  const media = lite ? [] : ["/video/intro.mp4", "/video/hero-loop.mp4"];
  return { images, media };
}

type Phase = "idle" | "opening" | "playing" | "leaving" | "done";

export function EntryGate() {
  const { lite, enter, warmUp, sound, setSound } = useExperience();
  const [phase, setPhase] = useState<Phase>("idle");
  const [loaded, setLoaded] = useState(false);
  const gateRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<number>(undefined);
  const frameRef = useRef<number>(undefined);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const release = useCallback(() => {
    document.documentElement.dataset.entered = "1";
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {}
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

  // Layar pemuatan: angka dan garis mengikuti jumlah aset yang selesai diunduh,
  // lalu tirai naik dan isi gerbang masuk satu per satu.
  useEffect(() => {
    if (lite === null || document.documentElement.dataset.entered) return;
    const gate = gateRef.current;
    const loader = loaderRef.current;
    if (!gate || !loader) return;
    const { images, media } = preloadList(lite);
    const total = images.length + media.length + 1;
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
          gsap.set(q(".gate__object, .gate__cta"), { clearProps: "transform,opacity,visibility" });
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
        .from(q(".gate__object"), { yPercent: 55, rotate: -10, autoAlpha: 0, duration: 1.2, ease: "back.out(1.3)" }, "<0.1")
        .from(q(".gate__cta"), { y: 22, autoAlpha: 0, duration: 0.7 }, "<0.45")
        .from(q(".gate__top > *, .gate__bottom > *"), { autoAlpha: 0, duration: 0.6, stagger: 0.06 }, "<0.1");
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
    for (const src of media) fetch(src).then((r) => r.blob()).catch(() => {}).finally(bump);
    (document.fonts?.ready ?? Promise.resolve()).then(bump, bump);

    return () => {
      cancelled = true;
      window.clearTimeout(cap);
      gsap.killTweensOf(shown);
    };
  }, [lite]);

  /** Garis portal dan judul sedikit mengikuti kursor; kukusan sengaja tetap di tempat. */
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || lite || !loaded || phaseRef.current !== "idle") return;
    const el = e.currentTarget;
    el.style.setProperty("--mx", (e.clientX / el.clientWidth - 0.5).toFixed(3));
    el.style.setProperty("--my", (e.clientY / el.clientHeight - 0.5).toFixed(3));
  };

  const leave = useCallback(
    (animate: boolean) => {
      if (phaseRef.current === "leaving" || phaseRef.current === "done") return;
      window.clearTimeout(timeoutRef.current);
      window.cancelAnimationFrame(frameRef.current!);
      setPhase("leaving");
      enter();
      const video = videoRef.current;
      if (!animate || !gateRef.current) {
        video?.pause();
        release();
        return;
      }
      // Iris menutup ke arah kukusan, memperlihatkan hero di baliknya. Radius
      // awal pas menutupi layar, jadi gerakan langsung terlihat sejak frame pertama.
      const gate = gateRef.current;
      const cx = gate.clientWidth * 0.5;
      const cy = gate.clientHeight * 0.86;
      const radius = Math.ceil(Math.hypot(Math.max(cx, gate.clientWidth - cx), Math.max(cy, gate.clientHeight - cy)));
      gsap.fromTo(
        gate,
        { clipPath: `circle(${radius}px at 50% 86%)` },
        {
          clipPath: "circle(0px at 50% 86%)",
          duration: 1.15,
          ease: "power2.inOut",
          onComplete: () => {
            video?.pause();
            release();
            document.getElementById("main")?.focus({ preventScroll: true });
          },
        },
      );
    },
    [enter, release],
  );

  const open = useCallback(() => {
    const video = videoRef.current;
    const gate = gateRef.current;
    if (lite || !video || !gate) return leave(!lite);
    if (phaseRef.current !== "idle") return;
    setPhase("opening");
    warmUp();
    video.muted = !sound;
    video.src = "/video/intro.mp4";
    // Dipanggil di dalam gesture klik agar pemutaran diizinkan browser, lalu
    // ditahan di frame pertama sampai layar video mulai terbuka.
    video
      .play()
      .then(() => {
        if (phaseRef.current !== "opening") return;
        video.pause();
        video.currentTime = 0;
      })
      .catch(() => {
        video.muted = true;
      });

    const start = () => {
      timeoutRef.current = window.setTimeout(() => leave(true), START_TIMEOUT_MS);
      video.play().catch(() => {
        // Pemutaran bersuara ditolak: coba lagi tanpa suara, lalu menyerah.
        video.muted = true;
        video.play().catch(() => leave(true));
      });
      // timeupdate terlalu jarang (±4x/dtk); rAF menjaga titik mulai iris tetap presisi.
      const watch = () => {
        if (video.duration && video.currentTime >= video.duration - LEAD_SECONDS) return leave(true);
        frameRef.current = window.requestAnimationFrame(watch);
      };
      frameRef.current = window.requestAnimationFrame(watch);
    };

    // Isi gerbang keluar; kukusan tetap di tempatnya, mengembang sedikit, lalu
    // kepulan uap membuka layar video tepat dari titik kukusan.
    const q = gsap.utils.selector(gate);
    const h = gate.clientHeight;
    const radius = Math.ceil(Math.hypot(gate.clientWidth / 2, h * 0.88));
    gsap.timeline({
      onComplete: () => {
        gsap.set(q(".gate__screen"), { clearProps: "clipPath" });
        setPhase((current) => (current === "opening" ? "playing" : current));
      },
    })
      .to(q(".gate__cta"), { scale: 0.86, autoAlpha: 0, duration: 0.3, ease: "power2.in" }, 0)
      .to(q(".gate__center .eyebrow, .gate__lede, .gate__top, .gate__bottom"), { autoAlpha: 0, duration: 0.35 }, 0)
      .to(q(".gate__line > span"), { yPercent: -115, duration: 0.6, stagger: 0.07, ease: "power3.in" }, 0.05)
      .to(q(".gate__arch"), { scale: 1.35, autoAlpha: 0, duration: 0.9, ease: "power2.in", transformOrigin: "50% 100%" }, 0.1)
      .to(q(".gate__object"), { y: -h * 0.05, scale: 1.1, duration: 0.6, ease: "back.out(2)" }, 0.15)
      .addLabel("puff", 0.75)
      .fromTo(q(".gate__puff"), { scale: 0, autoAlpha: 1 }, { scale: 1, duration: 1, ease: "power2.inOut" }, "puff")
      .to(q(".gate__object"), { scale: 1.35, autoAlpha: 0, duration: 0.45, ease: "power2.in" }, "puff")
      .call(start, undefined, "puff+=0.1")
      .fromTo(
        q(".gate__screen"),
        { clipPath: "circle(0px at 50% 88%)" },
        { clipPath: `circle(${radius}px at 50% 88%)`, duration: 1, ease: "power2.inOut" },
        "puff+=0.1",
      );
  }, [lite, sound, leave, warmUp]);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
      window.cancelAnimationFrame(frameRef.current!);
    },
    [],
  );

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !sound;
  }, [sound]);

  if (phase === "done") return null;

  return (
    <div
      ref={gateRef}
      className="gate"
      data-phase={phase}
      data-ready={loaded}
      role="region"
      aria-label="Pembuka Kalili Steam Club"
      onPointerMove={onPointerMove}
    >
      <span className="gate__puff" aria-hidden="true" />
      <div className="gate__screen">
        <video
          ref={videoRef}
          className="gate__video"
          playsInline
          preload="none"
          poster="/video/intro-poster.jpg"
          onPlaying={() => window.clearTimeout(timeoutRef.current)}
          onEnded={() => leave(true)}
          onError={() => (phaseRef.current === "playing" || phaseRef.current === "opening") && leave(true)}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      <div className="gate__ui" inert={!loaded}>
        <span className="gate__arch" aria-hidden="true" />

        <div className="gate__top">
          <span className="gate__logo"><Wordmark /></span>
          <a className="gate__skip" href="#menu" onClick={() => leave(false)}>
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
          <button className="btn btn--ivory gate__cta" type="button" onClick={open}>
            Buka kukusannya <Arrow />
          </button>
        </div>

        <div className="gate__object" aria-hidden="true">
          <span className="gate__steam"><SteamCurl /><SteamCurl /><SteamCurl /></span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gate__steamer" src="/retro/steamer.webp" alt="" width={1000} height={1000} />
        </div>

        <div className="gate__bottom">
          <button className="gate__sound" type="button" aria-pressed={sound} onClick={() => setSound(!sound)}>
            Suara: {sound ? "Nyala" : "Mati"}
          </button>
          <span className="gate__note">Lebih hidup dengan suara</span>
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
            <span className="gate__loader-steam" aria-hidden="true"><SteamCurl /><SteamCurl /></span>
            <span className="gate__loader-logo"><Wordmark /></span>
            <p className="gate__loader-count" aria-hidden="true"><span ref={percentRef}>00</span><small>%</small></p>
            <span className="gate__loader-bar" aria-hidden="true"><span ref={barRef} /></span>
            <p className="gate__loader-label">Menyiapkan kukusan</p>
          </div>
          <a className="gate__loader-skip" href="#menu" onClick={() => leave(false)}>Langsung lihat menu</a>
        </div>
      )}

      {phase === "playing" && (
        <div className="gate__playing">
          <button className="gate__sound" type="button" aria-pressed={sound} onClick={() => setSound(!sound)}>
            Suara: {sound ? "Nyala" : "Mati"}
          </button>
          <button className="btn btn--ivory" type="button" onClick={() => leave(true)} autoFocus>
            Lewati <Arrow />
          </button>
        </div>
      )}
    </div>
  );
}
