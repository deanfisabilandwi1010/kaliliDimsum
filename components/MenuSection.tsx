"use client";

import { useEffect, useRef } from "react";
import { formatIDR, products, type Product } from "@/content/products";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { useExperience } from "./Experience";
import { Arrow, ProductImage } from "./ui";

function AddButton({ product }: { product: Product }) {
  const { selection, toggle } = useExperience();
  const selected = Boolean(selection[product.id]);
  return (
    <button
      className="add"
      type="button"
      aria-pressed={selected}
      aria-label={selected ? `Hapus ${product.name} dari pilihan` : `Tambah ${product.name} ke pilihan`}
      onClick={() => toggle(product.id)}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path className="add__h" d="M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path className="add__v" d="M8 3v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function Meta({ product }: { product: Product }) {
  if (product.priceIDR === null && !product.portionLabel) return null;
  return (
    <p className="card__meta">
      {[product.portionLabel, product.priceIDR !== null ? formatIDR(product.priceIDR) : null].filter(Boolean).join(" · ")}
    </p>
  );
}

/** Produk sedikit mengikuti pointer; hanya mengubah CSS variable. */
function tilt(e: React.PointerEvent<HTMLElement>) {
  if (e.pointerType !== "mouse") return;
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
  e.currentTarget.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
}
function untilt(e: React.PointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty("--px", "0");
  e.currentTarget.style.setProperty("--py", "0");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Debu di dalam berkas cahaya: [posisi x %, posisi y %, durasi dtk, jeda dtk, ukuran px]. */
const DUST = [
  [46, 22, 9, 0, 3], [53, 34, 11, -3, 2], [41, 48, 8, -5, 3], [58, 52, 12, -1, 2], [49, 63, 10, -7, 4],
  [36, 70, 9, -2, 2], [62, 72, 13, -6, 3], [51, 80, 8, -4, 2], [44, 38, 14, -9, 2], [56, 16, 10, -8, 3],
];

export function MenuSection() {
  const { lite, count, selection, openDrawer } = useExperience();
  const rootRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const indexRef = useRef<HTMLSpanElement>(null);

  // Mode penuh: section menempel, lampu padam, dan scroll vertikal menggeser
  // deretan menu ke samping melewati sorot lampu di tengah, seperti layar
  // pilih karakter game fighting. Mode ringan / tanpa JS memakai grid biasa.
  useEffect(() => {
    if (lite !== false) return;
    const root = rootRef.current!;
    const pin = pinRef.current!;
    const track = trackRef.current!;
    const distance = () => Math.max(0, track.scrollWidth - pin.clientWidth);
    // 1 px scroll = 1 px geser. Setelah deretan habis, menu tetap menempel satu
    // layar lagi (hold) sementara panel Black Series naik menutupinya.
    const hold = () => pin.offsetHeight;
    const setHeight = () => {
      root.style.height = `${pin.offsetHeight + distance() + hold()}px`;
    };
    setHeight();
    ScrollTrigger.addEventListener("refreshInit", setHeight);
    // Di mode ini panggungnya gelap, jadi header ikut memakai warna terang.
    root.dataset.toneSection = "dark";
    root.dataset.header = "clear";

    // Sorot lampu: tiap kartu mendapat --f (1 tepat di tengah, 0 di luar sorot).
    // Posisi dihitung dari offset + x, tanpa membaca layout tiap frame.
    const items = Array.from(track.children) as HTMLElement[];
    let centres: number[] = [];
    let active = -1;
    const spot = pin.querySelector<HTMLElement>(".menu__spot");
    const measure = () => {
      centres = items.map((el) => el.offsetLeft + el.offsetWidth / 2);
      // Tinggi pusat sajian di dalam panggung: lampu, podium, dan penunjuk
      // diletakkan relatif terhadap titik ini.
      const stage = items[0].querySelector<HTMLElement>(".card__stage");
      if (stage) pin.style.setProperty("--sy", `${track.offsetTop + stage.offsetTop + stage.offsetHeight / 2}px`);
    };
    const light = () => {
      const x = Number(gsap.getProperty(track, "x")) || 0;
      const mid = pin.clientWidth / 2;
      const reach = items[0].offsetWidth * 0.95;
      let best = 0;
      let bestF = -1;
      items.forEach((el, i) => {
        const f = Math.max(0, 1 - Math.abs(centres[i] + x - mid) / reach);
        el.style.setProperty("--f", f.toFixed(3));
        if (f > bestF) {
          bestF = f;
          best = i;
        }
      });
      if (best === active) return;
      items[active]?.removeAttribute("data-active");
      items[best].dataset.active = "true";
      // Denyut cahaya di podium tiap kali sajian di bawah sorot berganti.
      if (spot && active >= 0) spot.dataset.hit = spot.dataset.hit === "a" ? "b" : "a";
      active = best;
      if (indexRef.current) indexRef.current.textContent = pad(Math.min(best + 1, products.length));
    };
    const relight = () => {
      measure();
      light();
    };
    ScrollTrigger.addEventListener("refresh", relight);

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".card");
      const range = { trigger: root, start: "top top", end: () => `+=${distance()}` };
      const travel = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        onUpdate: light,
        scrollTrigger: { ...range, scrub: 0.5, invalidateOnRefresh: true },
      });
      // Lampu ruangan padam saat section mulai menempel.
      gsap.fromTo(pin, { "--night": 0 }, {
        "--night": 1, ease: "none",
        scrollTrigger: { trigger: root, start: "top 62%", end: "top top", scrub: true },
      });
      gsap.fromTo(".menu__bar-fill", { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { ...range, scrub: 0.5 } });

      // Tiap sajian berputar seperti piring saat melintasi layar, dan nomor
      // besarnya bergeser dengan laju berbeda (parallax horizontal).
      cards.forEach((card) => {
        const pass = { containerAnimation: travel, trigger: card, start: "left right", end: "right left", scrub: true };
        gsap.fromTo(card.querySelector(".card__stage img"), { rotate: -34 }, { rotate: 34, ease: "none", scrollTrigger: pass });
        gsap.fromTo(card.querySelector(".card__no"), { xPercent: 40 }, { xPercent: -40, ease: "none", scrollTrigger: { ...pass } });
      });

      // Selama hold: menu mundur dan meredup di bawah panel yang naik.
      gsap.to(pin, {
        scale: 0.93, yPercent: -4, "--dim": 0.55, ease: "none",
        scrollTrigger: { trigger: root, start: () => `top+=${distance()} top`, end: "bottom bottom", scrub: 0.3, invalidateOnRefresh: true },
      });

      gsap.from(".menu__head > *", {
        autoAlpha: 0, y: 32, duration: 0.9, ease: "power3.out", stagger: 0.1,
        scrollTrigger: { trigger: root, start: "top 70%" },
      });
    }, root);

    // Tautan #menu-<id> harus mendarat di kartu yang benar di dalam deretan.
    const toCard = (card: HTMLElement, behavior: ScrollBehavior) => {
      const top = root.getBoundingClientRect().top + window.scrollY;
      const x = card.offsetLeft - (pin.clientWidth - card.offsetWidth) / 2;
      window.scrollTo({ top: top + Math.min(distance(), Math.max(0, x)), behavior });
    };
    const cardFor = (hash: string) => (hash.startsWith("#menu-") ? track.querySelector<HTMLElement>(`[id="${hash.slice(1)}"]`) : null);
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element).closest?.<HTMLAnchorElement>('a[href^="#menu-"]');
      const card = link && cardFor(link.hash);
      if (!card) return;
      e.preventDefault();
      history.replaceState(null, "", link.hash);
      toCard(card, "smooth");
    };
    // Fokus keyboard ke kartu di luar layar: geser halaman, bukan kontainernya.
    const onFocus = (e: FocusEvent) => {
      const card = (e.target as Element).closest<HTMLElement>(".card, .menu__end");
      if (!card) return;
      const r = card.getBoundingClientRect();
      if (r.left < 0 || r.right > window.innerWidth) toCard(card, "instant");
    };
    const onHash = () => {
      const card = cardFor(window.location.hash);
      if (card) toCard(card, "instant");
    };
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    track.addEventListener("focusin", onFocus);
    // Tinggi section baru saja berubah: trigger lain harus menghitung ulang posisi.
    const initial = cardFor(window.location.hash);
    const land = () => {
      ScrollTrigger.removeEventListener("refresh", land);
      if (initial) toCard(initial, "instant");
    };
    ScrollTrigger.addEventListener("refresh", land);
    ScrollTrigger.refresh();

    return () => {
      ScrollTrigger.removeEventListener("refreshInit", setHeight);
      ScrollTrigger.removeEventListener("refresh", land);
      ScrollTrigger.removeEventListener("refresh", relight);
      root.dataset.toneSection = "light";
      delete root.dataset.header;
      pin.style.removeProperty("--sy");
      items.forEach((el) => {
        el.style.removeProperty("--f");
        el.removeAttribute("data-active");
      });
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHash);
      track.removeEventListener("focusin", onFocus);
      ctx.revert();
      root.style.height = "";
      ScrollTrigger.refresh();
    };
  }, [lite]);

  return (
    <section ref={rootRef} id="menu" className="menu" data-tone-section="light" aria-labelledby="menu-title">
      <div ref={pinRef} className="menu__pin">
        <span className="menu__spot" aria-hidden="true">
          <span className="menu__beam" />
          <span className="menu__lamp" />
          <span className="menu__podium"><i /><i /><i /></span>
          <span className="menu__dust">
            {DUST.map(([x, y, duration, delay, size], i) => (
              <b key={i} style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, animationDuration: `${duration}s`, animationDelay: `${delay}s` }} />
            ))}
          </span>
          <span className="menu__arrow" />
          <span className="menu__arrow" />
        </span>
        <div className="menu__head">
          <p className="eyebrow">02 / Jelajahi menu</p>
          <h2 id="menu-title" className="display">Pilih yang bikin penasaran.</h2>
          <p className="menu__aside">Kenali satu per satu. Simpan yang ingin kamu tanyakan.</p>
        </div>

        <ul ref={trackRef} className="menu__track">
          {products.map((p, i) => (
            <li className="card" id={`menu-${p.id}`} key={p.id}>
              <div className="card__stage" onPointerMove={tilt} onPointerLeave={untilt}>
                <span className="card__no" aria-hidden="true">{pad(i + 1)}</span>
                {selection[p.id] ? <span className="card__picked" aria-hidden="true">Dipilih</span> : null}
                <ProductImage image={p.image} alt={p.alt} sizes="(max-width: 760px) 70vw, 30vw" />
              </div>
              <div className="card__row">
                <div>
                  <h3 className="card__name">{p.name}</h3>
                  <Meta product={p} />
                </div>
                <AddButton product={p} />
              </div>
            </li>
          ))}
          <li className="menu__end">
            <p className="eyebrow">Sudah ada yang bikin penasaran?</p>
            <p className="menu__end-title">{count > 0 ? `${count} menu tersimpan.` : "Simpan dengan tombol +."}</p>
            <button className="btn btn--oxblood" type="button" onClick={openDrawer}>Lihat pilihanmu <Arrow /></button>
          </li>
        </ul>

        <div className="menu__progress" aria-hidden="true">
          <span className="menu__index"><span ref={indexRef}>01</span> / {pad(products.length)}</span>
          <span className="menu__bar"><span className="menu__bar-fill" /></span>
          <span className="menu__hint">Gulir <Arrow /></span>
        </div>
      </div>
    </section>
  );
}
