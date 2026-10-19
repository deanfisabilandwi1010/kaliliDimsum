import { gsap } from "./gsap";

let active: (() => void) | null = null;
const ease = gsap.parseEase("power3.inOut");

/**
 * Luncuran scroll terkendali ke `top`: mulai pelan, melaju, lalu mendarat
 * lembut. Pengganti `behavior: "smooth"` bawaan browser, yang durasinya tidak
 * bisa diatur dan terasa menyentak saat melewati bagian yang menempel.
 * Berbasis jam nyata: di perangkat lambat frame dilewati, durasi tetap.
 * Roda, sentuhan, atau tombol dari pengunjung langsung menghentikannya.
 */
export function glide(top: number, options: { onDone?: () => void } = {}) {
  active?.();
  const from = window.scrollY;
  const goal = Math.max(0, Math.min(top, document.documentElement.scrollHeight - window.innerHeight));
  const screens = Math.abs(goal - from) / window.innerHeight;
  if (screens < 0.01) {
    options.onDone?.();
    return;
  }
  // Satu layar ≈ 1,3 dtk; jarak jauh dibatasi agar tidak berlarut.
  const duration = Math.min(2.6, 0.75 + Math.sqrt(screens) * 0.55) * 1000;
  const start = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo({ top: from + (goal - from) * ease(t), behavior: "instant" });
    if (t < 1) {
      frame = requestAnimationFrame(step);
      return;
    }
    stop();
    options.onDone?.();
  };
  const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  const cancel = () => {
    cancelAnimationFrame(frame);
    stop();
  };
  const stop = () => {
    events.forEach((type) => window.removeEventListener(type, cancel));
    if (active === cancel) active = null;
  };
  events.forEach((type) => window.addEventListener(type, cancel, { passive: true }));
  active = cancel;
  frame = requestAnimationFrame(step);
}
