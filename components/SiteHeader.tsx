"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger } from "@/lib/motion/gsap";
import { useExperience } from "./Experience";
import { Arrow, Wordmark } from "./ui";

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
          <button className="header__cart" type="button" onClick={openDrawer} aria-label={`Pilihanmu, ${count} menu tersimpan`}>
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
