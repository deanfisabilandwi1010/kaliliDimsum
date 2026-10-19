"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { brand } from "@/content/brand";
import { formatIDR, productById, spotlightIds, type Product } from "@/content/products";
import { BUILT_IN_PRODUCT, steamerSlots } from "@/content/steamer-slots";
import { gsap } from "@/lib/motion/gsap";
import type { FoodPick, SteamerScene } from "@/lib/three/steamer-scene";
import { useExperience } from "./Experience";
import { ARRIVE, dive } from "@/lib/motion/dive";
import { fly, flyToCart, GOTO_CARD } from "@/lib/motion/fly";
import { glide } from "@/lib/motion/glide";
import { Arrow, ProductImage } from "./ui";

const MODEL_URL = "/models/kalili-steamer.glb";
const STORY_ID = "anatomi";
/** Siomay Original di depan: yang terangkat oleh "Kenali Isinya". */
const HERO_INSTANCE = steamerSlots.find((slot) => slot.node === "dimsum_hero_root")?.instanceId ?? "";
/** Percik emas saat kukusan dibuka: [sudut derajat, jarak %, jeda dtk]. */
const SPARKS = [
  [-150, 46, 0], [-118, 60, 0.05], [-92, 52, 0.02], [-64, 62, 0.08], [-34, 48, 0.04],
  [-170, 30, 0.1], [-12, 34, 0.12], [-104, 36, 0.14], [-76, 30, 0.09], [-48, 68, 0.16],
];

/** Jeda kartu (ms) per reaksi siomay: kartu muncul saat siomay hampir mendarat. */
const CARD_DELAY = { hop: 420, pop: 880, wobble: 520, flip: 640 } as const;
/** Celoteh Si Kali saat diklik, bergiliran. */
const QUIPS = [
  "Psst… isinya ada tiga rasa, klik satu!",
  "Seret kukusannya, putar-putar!",
  "Uapnya hangat, kan?",
  "Tiap siomay punya gayanya sendiri.",
  "Sudah ketemu yang bikin penasaran?",
];

/** closed → opening → open → lifting → lifted. Tanpa 3D, hero dianggap "open". */
type Stage = "closed" | "opening" | "open" | "lifting" | "lifted" | "closing";

/** Info katalog yang benar-benar terisi; nilai kosong disembunyikan, bukan dikarang. */
function factsOf(product: Product) {
  return [
    product.portionLabel,
    product.priceIDR !== null ? formatIDR(product.priceIDR) : null,
    product.availability === "available" ? "Tersedia" : product.availability === "unavailable" ? "Sedang tidak tersedia" : null,
  ].filter(Boolean).join(" · ");
}

export function HeroStage() {
  const { lite, entered, warm, selection, add } = useExperience();
  const rootRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exploreRef = useRef<HTMLAnchorElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SteamerScene | null>(null);
  const scrollRef = useRef(0);
  const refocusRef = useRef(false);
  const pickedRef = useRef(false);
  const [live, setLive] = useState(false);
  // WebGL tidak tersedia, konteks hilang, atau model gagal dimuat.
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState<Stage>("open");
  const [burst, setBurst] = useState(false);
  const [hinted, setHinted] = useState(true);
  // Siomay yang dipilih: kartunya (posisi di kanvas) dan produk milik instance itu.
  const [picked, setPicked] = useState<(FoodPick & { n: number }) | null>(null);
  // Siomay di bawah kursor: label nama kecil.
  const [hover, setHover] = useState<FoodPick | null>(null);
  // Kursor di atas tutup yang terbuka: label "Tutup kukusan".
  const [lidTag, setLidTag] = useState<{ x: number; y: number } | null>(null);
  // Dekor panggung hanya disembunyikan sebelum kukusan pertama kali dibuka;
  // saat ditutup lagi, panggungnya tetap.
  const [openedOnce, setOpenedOnce] = useState(false);
  const autoOpenedRef = useRef(false);
  // Produk yang saat ini punya instance di kukusan (varian yang gagal dimuat tidak ikut).
  const [inScene, setInScene] = useState<string[]>([]);
  const cardTimer = useRef(0);
  const pickRef = useRef<FoodPick | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const pendingRef = useRef<{ id: string; opener: HTMLElement } | null>(null);
  const [quip, setQuip] = useState({ i: -1, on: false });
  // Nilai berganti a/b supaya animasi CSS diputar ulang pada tiap klik.
  const [swing, setSwing] = useState<[string, string]>(["", ""]);
  const [jump, setJump] = useState("");
  const motion = lite === false;
  const product = productById(picked?.productId ?? BUILT_IN_PRODUCT)!;
  const quantity = selection[product.id] ?? 0;
  const facts = factsOf(product);
  pickedRef.current = picked !== null;

  // Model dimuat di latar sejak awal, tetapi tidak pernah menahan halaman: poster
  // dan seluruh kontrol HTML sudah tampil lebih dulu. Jika WebGL atau model
  // gagal, poster kukusan terbuka tetap dipakai.
  useEffect(() => {
    if (!motion) return;
    let disposed = false;
    const compact = window.matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)").matches;
    import("@/lib/three/steamer-scene")
      .then(({ createSteamerScene }) =>
        createSteamerScene({
          canvas: canvasRef.current!,
          frame: stageRef.current!,
          url: MODEL_URL,
          logoUrl: brand.logo,
          compact,
          onOpening: () => {
            setStage("opening");
            setBurst(true);
          },
          onOpened: () => {
            setStage("open");
            setOpenedOnce(true);
          },
          onClosing: () => {
            setStage("closing");
            closeRef.current(false);
          },
          onClosed: () => setStage("closed"),
          onLidHover: setLidTag,
          onLifted: () => setStage("lifted"),
          slots: steamerSlots,
          builtInProduct: BUILT_IN_PRODUCT,
          onSelect: (pick) => {
            pickRef.current = pick;
            window.clearTimeout(cardTimer.current);
            setPicked(null);
            if (!pick) return;
            // x/y relatif terhadap kanvas (selebar hero); kartu dijaga tetap di layar.
            // Kartu menunggu reaksi siomay hampir selesai supaya gerakannya tidak tertutup.
            const width = canvasRef.current?.clientWidth ?? 0;
            cardTimer.current = window.setTimeout(() => {
              setPicked((prev) => ({
                ...pick,
                x: Math.min(Math.max(pick.x, 160), Math.max(160, width - 170)), y: Math.max(pick.y, 420),
                n: (prev?.n ?? 0) + 1,
              }));
            }, CARD_DELAY[pick.reaction ?? "hop"]);
          },
          onHover: setHover,
          onInstances: (list) => setInScene([...new Set(list.map((item) => item.productId))]),
          onInteract: () => setHinted(false),
          onContextLost: () => {
            setLive(false);
            setFailed(true);
            setStage("open");
          },
        }),
      )
      .then((scene) => {
        if (disposed) return scene.dispose();
        sceneRef.current = scene;
        scene.setScroll(scrollRef.current);
        setStage("closed");
        setLive(true);
      })
      .catch(() => {
        if (disposed) return;
        setLive(false);
        setFailed(true);
      });
    return () => {
      disposed = true;
      window.clearTimeout(cardTimer.current);
      sceneRef.current?.dispose();
      sceneRef.current = null;
      setLive(false);
      setStage("open");
      setPicked(null);
      setHover(null);
      setInScene([]);
    };
  }, [motion]);

  const open = useCallback(() => sceneRef.current?.open(), []);

  // Pengunjung yang menekan "Buka kukusannya" di gerbang sudah meminta kukusan
  // dibuka: tutupnya terangkat sendiri begitu hero terlihat, tanpa klik kedua.
  useEffect(() => {
    // Hanya sekali: kukusan yang ditutup lagi oleh pengunjung tidak membuka sendiri.
    if (live && entered && warm && stage === "closed" && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      open();
    }
  }, [live, entered, warm, stage, open]);

  // Tombol "Buka" diganti tautan "Kenali Isinya": jaga fokus keyboard.
  useEffect(() => {
    if (stage === "open" && refocusRef.current) {
      refocusRef.current = false;
      exploreRef.current?.focus();
    }
  }, [stage]);

  // Menutup kartu juga melepas sorotan siomay. Fokus kembali ke tombol HTML
  // yang membukanya (jika dibuka lewat tombol), bukan hilang ke body.
  const closeCard = useCallback((restore: boolean) => {
    window.clearTimeout(cardTimer.current);
    setPicked(null);
    sceneRef.current?.clearSelection();
    const opener = openerRef.current;
    openerRef.current = null;
    if (restore && opener?.isConnected) opener.focus({ preventScroll: true });
  }, []);
  const closeRef = useRef(closeCard);
  closeRef.current = closeCard;

  // Kartu siomay: tutup dengan Escape atau klik di luar kartu (kanvas
  // menangani kliknya sendiri: siomay lain = pilihan baru, area kosong = lepas).
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCard(true);
    const onDown = (e: PointerEvent) => {
      if (!cardRef.current?.contains(e.target as Node) && e.target !== canvasRef.current) closeCard(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [picked, closeCard]);

  // Dibuka lewat tombol HTML (keyboard): fokus pindah ke aksi utama kartu.
  useEffect(() => {
    if (picked?.via === "control") cardRef.current?.querySelector<HTMLElement>(".hero__card-add")?.focus({ preventScroll: true });
  }, [picked]);

  // Tombol sajian ditekan saat kukusan masih tertutup: buka dulu, lalu pilih.
  useEffect(() => {
    const pending = pendingRef.current;
    if (stage !== "open" || !pending) return;
    pendingRef.current = null;
    openerRef.current = pending.opener;
    if (!sceneRef.current?.select(pending.id)) window.dispatchEvent(new CustomEvent(GOTO_CARD, { detail: pending.id }));
  }, [stage]);

  // "Kenali Isinya": angkat siomay Original dulu, baru menuju bagian ceritanya.
  const explore = (event: React.MouseEvent) => {
    if (!live || stage !== "open" || !sceneRef.current) return;
    event.preventDefault();
    closeCard(false);
    setStage("lifting");
    const scene = sceneRef.current;
    scene.lift();
    // Saat siomay masih naik, ia "menyelam" ke bagian anatomi: iris terbuka
    // dari siomay itu, halaman pindah di balik tirai, dan siomay mendarat tepat
    // di tempat model 3D anatomi, tanpa menggulir melewati bagian di antaranya.
    window.setTimeout(() => {
      const section = document.getElementById(STORY_ID);
      const rect = scene.screenRect(HERO_INSTANCE);
      const box = canvasRef.current?.getBoundingClientRect();
      if (!section) return;
      if (!rect || !box) return glide(section.getBoundingClientRect().top + window.scrollY);
      dive({
        from: { x: box.left + rect.x, y: box.top + rect.y, width: rect.width * 1.2 },
        image: "/models/dimsum-assembled.webp",
        section,
        veilClass: "dive__veil--anatomy",
        // Model anatomi selalu di tengah panggungnya, selebar bingkai kamera pose utuh.
        target: () => {
          const stage = section.querySelector(".anatomy__stage")?.getBoundingClientRect();
          if (!stage) return { x: innerWidth / 2, y: innerHeight / 2, width: 200 };
          // Gambar poster dipotret sedikit lebih tinggi daripada kamera anatomi:
          // titiknya diturunkan agar puncak siomay jatuh tepat di puncak model.
          const width = Math.min(0.536 * stage.height, 0.4615 * stage.width);
          return { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2 + width * 0.2, width };
        },
        onArrive: () => window.dispatchEvent(new CustomEvent(ARRIVE, { detail: STORY_ID })),
      });
    }, 380);
  };

  // "Pilih sajian": memilih produk yang sama dengan siomay 3D-nya. Produk yang
  // muncul lebih dari sekali memakai instance utamanya; thumbnail tombol
  // terbang ke siomay itu, lalu kartunya terbuka. Produk yang tidak ada di
  // kukusan (mis. modelnya gagal dimuat) dan mode tanpa 3D: menuju kartunya di menu.
  const choose = (event: React.MouseEvent<HTMLElement>, id: string) => {
    const scene = sceneRef.current;
    if (!live || !scene || stage === "lifting" || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    setHinted(false);
    const opener = event.currentTarget;
    if (stage === "closed" || stage === "opening") {
      pendingRef.current = { id, opener };
      if (stage === "closed") open();
      return;
    }
    openerRef.current = opener;
    if (!scene.select(id)) {
      openerRef.current = null;
      window.dispatchEvent(new CustomEvent(GOTO_CARD, { detail: id }));
      return;
    }
    const image = opener.querySelector("img");
    const pick = pickRef.current;
    const box = canvasRef.current?.getBoundingClientRect();
    if (image && pick && box) fly(image, { x: box.left + pick.x, y: box.top + pick.y + 14, size: 30 }, { duration: 0.6 });
  };

  useEffect(() => {
    if (lite !== false || !entered) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero__line > span", { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: 0.09, delay: 0.25 });
      gsap.from(".hero__fade", { autoAlpha: 0, y: 18, duration: 0.8, ease: "power2.out", stagger: 0.08, delay: 0.7 });
      // Hero menempel dengan ukuran penuh. Babak 1: judul naik baris demi baris
      // dan kamera mendekat ke kukusan, lalu kalimat kedua muncul. Babak 2:
      // pita merah dan bagian ritual naik menutupi hero yang masih menempel.
      const state = { camera: 0 };
      gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: pinRef.current, start: "top top", end: "bottom bottom", scrub: 0.5 } })
        // fromTo dengan nilai awal eksplisit: kembali ke atas selalu memulihkan
        // teks, walau animasi masuk belum selesai saat scroll pertama terjadi.
        .fromTo(".hero__line", { y: 0, autoAlpha: 1 }, { y: (i) => -90 - i * 46, autoAlpha: 0, duration: 0.2, stagger: 0.025, ease: "power2.in", immediateRender: false }, 0)
        .fromTo(".hero__meta-wrap", { y: 0, autoAlpha: 1 }, { y: -40, autoAlpha: 0, duration: 0.14, ease: "power1.in", immediateRender: false }, 0)
        .fromTo(".hero__foot-wrap", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.1, immediateRender: false }, 0)
        .fromTo(".hero__decor-wrap", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3, immediateRender: false }, 0.3)
        .fromTo(".hero__next > *", { y: 46, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.14, stagger: 0.04, ease: "power2.out" }, 0.2)
        // Scroll hanya menggerakkan kamera (dan poster pengganti), bukan modelnya.
        .to(state, {
          camera: 1, duration: 0.62, ease: "sine.inOut",
          onUpdate: () => {
            scrollRef.current = state.camera;
            sceneRef.current?.setScroll(state.camera);
            if (state.camera > 0.04 && pickedRef.current) closeRef.current(false);
          },
        }, 0)
        .fromTo(".hero__poster", { scale: 1 }, { scale: 1.16, duration: 0.62, ease: "sine.inOut" }, 0)
        .fromTo(".hero__shade", { opacity: 0 }, { opacity: 0.4, duration: 0.5 }, 0.5);
    }, rootRef);
    return () => ctx.revert();
  }, [lite, entered]);

  const closed = live && (stage === "closed" || stage === "opening" || stage === "closing");
  const flip = (value: string) => (value === "a" ? "b" : "a");

  return (
    <div ref={pinRef} className="hero-pin">
    <section ref={rootRef} id="top" className="hero" data-live={live} data-failed={failed || undefined} data-stage={live ? stage : "open"} data-opened={openedOnce || undefined} data-card={picked ? "open" : undefined} data-tone-section="light" data-header="clear">
      <div className="hero__media">
        {/* Lapis belakang: dekor di belakang kukusan dan poster pengganti. */}
        <div ref={stageRef} className="hero__stage">
          <div className="hero__decor-wrap">
            <span className="hero__arch hero__decor" aria-hidden="true" />
            <span className="hero__rings hero__decor" aria-hidden="true" />
          </div>
          {/* Poster: kukusan terbuka untuk mode ringan / tanpa WebGL, kukusan
              tertutup sebagai pengisi sampai model siap. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero__poster hero__poster--open" src="/models/steamer-open.webp" alt="Kukusan bambu terbuka berisi lima siomay, tutupnya bersandar di samping" width={1000} height={670} fetchPriority="high" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero__poster hero__poster--closed" src="/models/steamer-closed.webp" alt="" width={1000} height={738} aria-hidden="true" />
        </div>

        {/* Kanvas selebar hero: kukusan yang diputar tidak terpotong di tepi panggung. */}
        {motion && <canvas ref={canvasRef} className="hero__canvas" aria-hidden="true" />}

        {/* Lapis depan: muncul saat kukusan dibuka. Lampion dan Si Kali bereaksi
            saat diklik; semuanya hiasan, jadi disembunyikan dari pembaca layar. */}
        <div className="hero__stage hero__stage--front">
          <div className="hero__decor-wrap">
            <span className="hero__sparks" data-on={burst} aria-hidden="true" onAnimationEnd={(e) => e.target === e.currentTarget.lastElementChild && setBurst(false)}>
              {SPARKS.map(([angle, distance, delay], i) => (
                <i key={i} style={{ "--a": `${angle}deg`, "--d": `${distance}%`, animationDelay: `${delay}s` } as React.CSSProperties}>✦</i>
              ))}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hero__lantern hero__lantern--a hero__decor" data-swing={swing[0]} src="/retro/lantern.webp" alt="" width={420} height={504} aria-hidden="true" onClick={() => setSwing(([a, b]) => [flip(a), b])} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hero__lantern hero__lantern--b hero__decor" data-swing={swing[1]} src="/retro/lantern.webp" alt="" width={420} height={504} aria-hidden="true" onClick={() => setSwing(([a, b]) => [a, flip(b)])} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="hero__mascot hero__decor" data-jump={jump} src="/retro/mascot.webp" alt="" width={760} height={760} aria-hidden="true"
              onClick={() => {
                setJump(flip);
                setQuip((q) => ({ i: (q.i + 1) % QUIPS.length, on: true }));
              }}
            />
            {quip.on && (
              <span className="hero__bubble" key={quip.i} aria-hidden="true" onAnimationEnd={(e) => e.animationName === "bubble-out" && setQuip((q) => ({ ...q, on: false }))}>
                {QUIPS[quip.i]}
              </span>
            )}
          </div>

          {live && (
            <p className="hero__hint" data-show={hinted && (stage === "closed" || stage === "open")} aria-hidden="true">
              {stage === "closed" ? (
                <span>Klik kukusannya untuk membuka</span>
              ) : (
                <>
                  <span className="hero__hint-mouse">Seret untuk memutar · klik siomay atau tutupnya</span>
                  <span className="hero__hint-touch">Geser untuk memutar · ketuk siomay atau tutupnya</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Label nama siomay di bawah kursor (mouse saja). */}
        {lidTag && !picked && (
          <p className="hero__tag hero__tag--cursor" style={{ left: lidTag.x, top: lidTag.y }} aria-hidden="true">Tutup kukusan</p>
        )}
        {hover && !picked && (
          <p className="hero__tag" style={{ left: hover.x, top: hover.y }} aria-hidden="true" key={hover.instanceId} data-instance={hover.instanceId}>
            {productById(hover.productId)?.name}
          </p>
        )}

        {picked && (
          <div
            ref={cardRef} className="hero__card" style={{ left: picked.x, top: picked.y }} key={picked.n}
            role="dialog" aria-label={product.name} data-product={product.id} data-instance={picked.instanceId}
          >
            {/* Sajian meletup keluar dari siomay yang dipilih lalu hinggap di atas kartu. */}
            <span className="hero__card-pop" aria-hidden="true">
              <span className="hero__card-puff" />
              <ProductImage image={product.image} alt="" sizes="120px" eager />
            </span>
            <button className="hero__card-close" type="button" aria-label={`Tutup info ${product.name}`} onClick={() => closeCard(true)}>
              <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            <p className="hero__card-eyebrow">Di kukusan ini</p>
            <p className="hero__card-name">{product.name}</p>
            {facts && <p className="hero__card-facts">{facts}</p>}
            {/* Menambah satu satuan jual; tidak pernah terjadi hanya karena siomay diklik. */}
            <button
              className="hero__card-add"
              type="button"
              disabled={product.availability === "unavailable"}
              onClick={(e) => {
                flyToCart(e.currentTarget.parentElement?.querySelector<HTMLImageElement>(".hero__card-pop img"));
                add(product.id);
              }}
            >
              {quantity > 0 ? `Tambah lagi · ${quantity} di pilihan` : "Tambah ke pilihan"}
            </button>
            <a className="hero__card-link" href={`#menu-${product.id}`} onClick={() => closeCard(false)}>Lihat di menu <Arrow /></a>
          </div>
        )}
      </div>

      <div className="hero__content">
        <div className="hero__meta-wrap"><p className="eyebrow hero__fade">Selamat datang di Kalili Steam Club</p></div>
        <h1 className="hero__title">
          <span className="hero__line"><span>Kecil</span></span>{" "}
          <span className="hero__line"><span>bentuknya.</span></span>{" "}
          <span className="hero__line"><span>Besar</span></span>{" "}
          <span className="hero__line"><span>godaannya.</span></span>
        </h1>
        <div className="hero__meta-wrap">
        <p className="hero__lede hero__fade">
          Satu kukusan. Banyak alasan untuk penasaran. Temukan pilihan dimsum yang memanggil namamu.
        </p>
        <div className="hero__cta hero__fade">
          {closed ? (
            <button
              className="btn btn--oxblood"
              type="button"
              aria-label="Buka Kukusan Kalili"
              disabled={stage === "opening" || stage === "closing"}
              onClick={() => {
                refocusRef.current = true;
                open();
              }}
            >
              <span>Buka Kukusan<span className="hero__long"> Kalili</span></span> <Arrow direction="up" />
            </button>
          ) : (
            <a ref={exploreRef} className="btn btn--oxblood" href={`#${STORY_ID}`} onClick={explore} aria-disabled={stage === "lifting" || undefined}>
              Kenali Isinya <Arrow direction="down" />
            </a>
          )}
          <a className="btn btn--ghost" href="#menu" aria-label="Langsung Lihat Menu"><span><span className="hero__long">Langsung </span>Lihat Menu</span> <Arrow /></a>
        </div>
        </div>
        <p className="sr-only" role="status">{live && stage === "open" ? "Kukusan terbuka." : ""}</p>
      </div>

      <div className="hero__next" aria-hidden="true">
        <p className="eyebrow">Gulir pelan-pelan</p>
        <p className="hero__next-title">Kukusannya<br />sudah menunggu.</p>
      </div>
      <span className="hero__shade" aria-hidden="true" />

      <div className="hero__foot-wrap">
      <div className="hero__foot hero__fade">
        <p className="eyebrow hero__spot-label" id="hero-spot-label">Pilih sajian</p>
        <ul className="hero__spot" aria-labelledby="hero-spot-label">
          {spotlightIds.map((id) => {
            const p = productById(id)!;
            const content = (
              <>
                <ProductImage image={p.image} alt="" sizes="56px" eager />
                <span>{p.name}</span>
              </>
            );
            return (
              <li key={id}>
                {/* Dengan kukusan 3D: tombol yang memilih siomaynya. Tanpa 3D, atau
                    jika produk itu tidak ada di kukusan: tautan ke kartunya di menu. */}
                {live && (inScene.includes(id) || closed) ? (
                  <button type="button" data-product={id} aria-haspopup="dialog" aria-expanded={picked?.productId === id} onClick={(e) => choose(e, id)}>
                    {content}
                  </button>
                ) : (
                  <a href={`#menu-${id}`} data-product={id}>{content}</a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      </div>
    </section>
    </div>
  );
}
