import { gsap } from "./gsap";

/** Dikirim saat sajian mendarat di tombol "Pilihanmu"; header membalas dengan denyut. */
export const CART_BUMP = "kalili:cart-bump";
/** Minta panggung menu menggeser ke kartu sajian lalu menyajikannya. */
export const GOTO_CARD = "kalili:goto-card";

type Target = { x: number; y: number; size: number };

/**
 * Salinan gambar sajian terbang melengkung dari `source` ke `target`, berputar
 * dan mengecil, lalu dihapus. Hanya hiasan: tidak dipanggil di mode ringan,
 * dan elemen aslinya tidak pernah disentuh.
 */
export function fly(source: HTMLImageElement, target: Target, options: { duration?: number; onLand?: () => void } = {}) {
  const from = source.getBoundingClientRect();
  if (!from.width) {
    options.onLand?.();
    return;
  }
  const clone = source.cloneNode() as HTMLImageElement;
  clone.removeAttribute("id");
  clone.alt = "";
  clone.setAttribute("aria-hidden", "true");
  clone.className = "fly";
  Object.assign(clone.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.appendChild(clone);

  const dx = target.x - (from.left + from.width / 2);
  const dy = target.y - (from.top + from.height / 2);
  const end = target.size / from.width;
  const duration = options.duration ?? 0.75;
  // Lengkung: bergerak mendatar rata, naik dulu lalu jatuh ke sasaran.
  const arc = Math.min(-60, -Math.abs(dx) * 0.25);
  gsap
    .timeline({
      onComplete: () => {
        clone.remove();
        options.onLand?.();
      },
    })
    .to(clone, { x: dx, rotate: dx >= 0 ? 300 : -300, duration, ease: "power1.inOut" }, 0)
    .to(clone, { y: arc, duration: duration * 0.42, ease: "power2.out" }, 0)
    .to(clone, { y: dy, duration: duration * 0.58, ease: "power2.in" }, duration * 0.42)
    .fromTo(clone, { scale: 1 }, { scale: end, duration, ease: "power2.in" }, 0)
    .to(clone, { autoAlpha: 0, duration: 0.12 }, duration - 0.1);
}

/** Terbangkan sajian ke tombol "Pilihanmu" di header, lalu header berdenyut. */
export function flyToCart(source: HTMLImageElement | null | undefined) {
  const cart = document.querySelector<HTMLElement>(".header__cart");
  const bump = () => window.dispatchEvent(new Event(CART_BUMP));
  const box = cart?.getBoundingClientRect();
  if (!source || !box?.width || document.documentElement.dataset.motion !== "full") return bump();
  fly(source, { x: box.left + box.width / 2, y: box.top + box.height / 2, size: 26 }, { onLand: bump });
}
