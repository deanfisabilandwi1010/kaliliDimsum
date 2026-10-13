"use client";

import { useEffect, useRef, useState } from "react";
import { productById } from "@/content/products";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/order-message";
import { useExperience } from "./Experience";
import { Arrow, ProductImage } from "./ui";

export function SelectionDrawer() {
  const { selection, count, setQuantity, drawerOpen, closeDrawer } = useExperience();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  // <dialog> modal menangani jebakan fokus, Escape, dan pengembalian fokus.
  useEffect(() => {
    const dialog = dialogRef.current!;
    if (drawerOpen && !dialog.open) dialog.showModal();
    if (!drawerOpen && dialog.open) dialog.close();
    if (drawerOpen) setCopied("idle");
  }, [drawerOpen]);

  const items = Object.entries(selection);
  const message = buildOrderMessage(selection);
  const whatsappUrl = buildWhatsAppUrl(selection);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="drawer"
      aria-labelledby="drawer-title"
      onClose={closeDrawer}
      onClick={(e) => e.target === dialogRef.current && closeDrawer()}
    >
      <div className="drawer__panel">
        <div className="drawer__head">
          <p className="eyebrow">Menu yang ingin kamu coba</p>
          <button className="icon-btn" type="button" aria-label="Tutup pilihan" onClick={closeDrawer}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
        <h2 id="drawer-title" className="drawer__title">Pilihanmu.</h2>

        {count === 0 ? (
          <div className="drawer__empty">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/retro/mascot.webp" alt="" width={760} height={760} loading="lazy" />
            <p>Kukusanmu masih kosong. Tambahkan menu yang bikin penasaran.</p>
            <a className="btn btn--oxblood" href="#menu" onClick={closeDrawer}>Lihat menu <Arrow /></a>
          </div>
        ) : (
          <>
            <p className="drawer__count">{count} menu tersimpan</p>
            <ul className="drawer__list">
              {items.map(([id, qty]) => {
                const p = productById(id);
                if (!p) return null;
                return (
                  <li key={id}>
                    <ProductImage image={p.image} alt="" sizes="104px" />
                    <div>
                      <h3>{p.name}</h3>
                      <div className="stepper">
                        <button type="button" aria-label={qty > 1 ? `Kurangi ${p.name}` : `Hapus ${p.name}`} onClick={() => setQuantity(id, qty - 1)}>−</button>
                        <span aria-label={`Jumlah ${p.name}: ${qty}`}>{qty}</span>
                        <button type="button" aria-label={`Tambah ${p.name}`} onClick={() => setQuantity(id, qty + 1)}>+</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="eyebrow">Ringkasan untuk ditanyakan</p>
            <pre className="drawer__summary">{message}</pre>

            <button className="btn btn--oxblood btn--block" type="button" onClick={copy}>
              {copied === "ok" ? "Ringkasan tersalin" : "Salin ringkasan"} <Arrow />
            </button>
            {copied === "fail" && <p className="drawer__note" role="alert">Tidak bisa menyalin otomatis. Pilih teks ringkasan di atas lalu salin manual.</p>}

            {whatsappUrl ? (
              <a className="btn btn--outline btn--block" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                Tanyakan pesanan via WhatsApp <Arrow />
              </a>
            ) : (
              <p className="drawer__unavailable">Kanal pesan belum tersedia</p>
            )}
            <p className="drawer__note">Harga belum ditampilkan. Pesan tidak dikirim otomatis: kamu yang meninjau dan mengirimnya.</p>
          </>
        )}
      </div>
    </dialog>
  );
}
