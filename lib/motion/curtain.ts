import { ARRIVE } from "./dive";
import { gsap, settleScroll } from "./gsap";

let running = false;

/**
 * Pindah ke bagian yang jauh tanpa menggulir melewati isi di antaranya:
 *   1. lampu padam: iris gelap berbingkai emas menutup layar dari titik klik;
 *   2. nama tujuan muncul sebentar di tengah, halaman melompat di baliknya;
 *   3. iris terbuka dari tengah layar (titik sorot panggung menu) dan
 *      memperlihatkan bagian tujuan yang sudah di pose akhirnya.
 * Total ±1,5 dtk. Klik berikutnya selama transisi diabaikan.
 */
export function curtainTo(options: {
  top: number;
  origin: { x: number; y: number };
  label: string;
  /** Dikirim sebagai detail event ARRIVE setelah tirai mulai terbuka. */
  arrive?: string;
  onDone?: () => void;
}) {
  if (running) return;
  running = true;
  const { top, origin, label, arrive, onDone } = options;
  const root = document.createElement("div");
  root.className = "curtain";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `<div class="curtain__veil"></div><div class="curtain__ring"></div><p class="curtain__label"><span class="curtain__mark">Kalili Steam Club</span><span class="curtain__name"></span></p>`;
  root.querySelector(".curtain__name")!.textContent = label;
  document.body.appendChild(root);
  const veil = root.querySelector<HTMLElement>(".curtain__veil")!;
  const ring = root.querySelector<HTMLElement>(".curtain__ring")!;
  const text = root.querySelector<HTMLElement>(".curtain__label")!;

  const reach = (x: number, y: number) => Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 4;
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const state = { cover: 0, hole: 0 };
  const coverReach = reach(origin.x, origin.y);
  const holeReach = reach(cx, cy);
  // Menutup: lingkaran gelap tumbuh dari titik klik, cincin emas di tepinya.
  const paintCover = () => {
    const r = state.cover * coverReach;
    veil.style.clipPath = `circle(${r}px at ${origin.x}px ${origin.y}px)`;
    ring.style.cssText = `left:${origin.x}px;top:${origin.y}px;width:${r * 2}px;height:${r * 2}px;opacity:${state.cover < 1 ? 1 : 0}`;
  };
  // Membuka: lubang tumbuh dari tengah; cincin emas mengikuti tepinya.
  const paintHole = () => {
    const r = state.hole * holeReach;
    const mask = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${r}px, #000 ${r + 1}px)`;
    veil.style.clipPath = "none";
    veil.style.maskImage = mask;
    veil.style.webkitMaskImage = mask;
    ring.style.cssText = `left:${cx}px;top:${cy}px;width:${r * 2}px;height:${r * 2}px;opacity:${1 - state.hole}`;
  };
  paintCover();

  gsap
    .timeline({
      onComplete: () => {
        root.remove();
        running = false;
        onDone?.();
      },
    })
    .to(state, { cover: 1, duration: 0.55, ease: "power2.in", onUpdate: paintCover }, 0)
    .fromTo(text, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, 0.42)
    .add(() => {
      window.scrollTo({ top, behavior: "instant" });
      settleScroll();
    }, 0.6)
    .to(text, { autoAlpha: 0, y: -10, duration: 0.3, ease: "power1.in" }, 0.9)
    .add(() => {
      settleScroll();
      if (arrive) window.dispatchEvent(new CustomEvent(ARRIVE, { detail: arrive }));
    }, 1)
    .fromTo(state, { hole: 0 }, { hole: 1, duration: 0.6, ease: "power2.inOut", onUpdate: paintHole, immediateRender: false }, 1);
}
