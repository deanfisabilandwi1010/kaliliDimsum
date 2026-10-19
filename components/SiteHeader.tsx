"use client";

import { useEffect, useRef, useState } from "react";
import { curtainTo } from "@/lib/motion/curtain";
import { CART_BUMP } from "@/lib/motion/fly";
import { ScrollTrigger } from "@/lib/motion/gsap";
import { useExperience } from "./Experience";
import { Arrow, Wordmark } from "./ui";

/** Nama tujuan yang tampil sebentar di tengah tirai transisi. */
const DESTINATIONS: Record<string, string> = {
  top: "Selamat datang",
  anatomi: "Di dalam satu gigitan",
  ritual: "Ritual kecil Kalili",
  menu: "Pilih yang bikin penasaran",
  "black-series": "Black Series",
  cerita: "Cerita Kalili",
};

const LINKS = [
  { href: "#menu", label: "Menu" },
  { href: "#black-series", label: "Black Series" },
  { href: "#cerita", label: "Cerita Kalili" },
];

export function SiteHeader() {
  const { count, openDrawer } = useExperience();
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLDialogElement>(null);

  // Warna header mengikuti section di bawahnya (data-tone-section). Di atas
  // section bermedia penuh (data-header="clear") header transparan; di section
  // konten header diberi latar agar tidak bertabrakan dengan isi.
  useEffect(() => {
    const header = headerRef.current!;
    const triggers = gsapTones(header);
    return () => triggers.forEach((t) => t.kill());
  }, []);

  // Sajian yang "terbang" ke tombol Pilihanmu: tombol menangkapnya dengan denyut.
  // Nilai a/b bergantian supaya animasinya diputar ulang tiap kali.
  const [bump, setBump] = useState("");
  useEffect(() => {
    const onBump = () => setBump((v) => (v === "a" ? "b" : "a"));
    window.addEventListener(CART_BUMP, onBump);
    return () => window.removeEventListener(CART_BUMP, onBump);
  }, []);

  // Tautan ke bagian yang jauh (Menu, Black Series, Cerita, Lihat Menu, logo):
  // bukan menggulir melewati semua bagian di antaranya, tetapi tirai transisi
  // yang memindahkan halaman di balik layar. Jarak dekat tetap menggulir biasa.
  // Tautan kartu menu (#menu-…) ditangani MenuSection; tautan yang sudah
  // ditangani komponennya sendiri (defaultPrevented) dan skip link dilewati.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (document.documentElement.dataset.motion !== "full") return;
      const link = (e.target as Element).closest?.<HTMLAnchorElement>('a[href^="#"]');
      if (!link || link.classList.contains("skip-link")) return;
      const hash = link.getAttribute("href") ?? "";
      if (hash.length < 2 || hash.startsWith("#menu-")) return;
      const id = hash.slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY;
      if (Math.abs(top - window.scrollY) < window.innerHeight * 1.5) return;
      e.preventDefault();
      history.replaceState(null, "", hash);
      // Diaktifkan dengan keyboard: titik asal = tengah tautannya.
      const box = link.getBoundingClientRect();
      const origin = e.detail === 0 || (!e.clientX && !e.clientY)
        ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
        : { x: e.clientX, y: e.clientY };
      curtainTo({ top, origin, label: DESTINATIONS[id] ?? link.textContent?.trim() ?? "", arrive: id });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const closeNav = () => navRef.current?.close();

  return (
    <>
      <header ref={headerRef} className="header" data-tone="light">
        <a className="header__brand" href="#top" aria-label="Dimsum by Kalili, kembali ke atas">
          <Wordmark />
        </a>
        <nav className="header__nav" aria-label="Utama">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>
        <div className="header__actions">
          <button className="header__cart" type="button" data-bump={bump || undefined} onClick={openDrawer} aria-label={`Pilihanmu, ${count} menu tersimpan`}>
            <span className="header__cart-label">Pilihanmu</span>
            <span className="header__cart-count" key={count}>{count}</span>
            <Arrow />
          </button>
          <button className="header__burger" type="button" aria-label="Buka navigasi" onClick={() => navRef.current?.showModal()}>
            <span /><span />
          </button>
        </div>
      </header>

      <dialog ref={navRef} className="mobile-nav" aria-label="Navigasi">
        <div className="mobile-nav__top">
          <Wordmark />
          <button className="icon-btn" type="button" aria-label="Tutup navigasi" onClick={closeNav}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="eyebrow">Jelajahi Kalili</p>
        <ol className="mobile-nav__list">
          {LINKS.map((l, i) => (
            <li key={l.href}>
              <a href={l.href} onClick={closeNav}><span>0{i + 1}</span>{l.label}</a>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => { closeNav(); openDrawer(); }}><span>04</span>Pilihanmu</button>
          </li>
        </ol>
        <div className="mobile-nav__foot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/retro/mascot.webp" alt="" width={760} height={760} loading="lazy" />
          <p>Kecil bentuknya.<br />Besar godaannya.</p>
        </div>
      </dialog>
    </>
  );
}

function gsapTones(header: HTMLElement) {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-tone-section]")).map((section) =>
    ScrollTrigger.create({
      trigger: section,
      start: "top 40px",
      end: "bottom 40px",
      onToggle: (self) => {
        if (!self.isActive) return;
        header.dataset.tone = section.dataset.toneSection!;
        header.dataset.solid = String(section.dataset.header !== "clear");
      },
    }),
  );
}
