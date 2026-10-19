import { gsap, settleScroll } from "./gsap";

/** Dikirim saat transisi tiba di bagian tujuan; bagian itu memainkan sambutannya. */
export const ARRIVE = "kalili:arrive";

type Rect = { x: number; y: number; width: number };

let running = false;

/**
 * Transisi "menyelam" dari satu siomay ke bagian lain, tanpa menggulir melewati
 * isi di antaranya:
 *   1. salinan 2D siomay muncul tepat di atas siomay 3D-nya;
 *   2. tirai berwarna latar tujuan melebar seperti iris dari siomay itu;
 *   3. di balik tirai, halaman melompat ke bagian tujuan;
 *   4. siomay meluncur ke tempatnya di bagian tujuan, lalu tirai memudar dan
 *      memperlihatkan bagian aslinya di posisi yang sama.
 * Elemen sementara dihapus setelahnya; pengunjung yang menggulir di tengah
 * jalan tidak terkunci (tirai tetap selesai sendiri dalam ±1,6 dtk).
 */
export function dive(options: {
  from: Rect;
  image: string;
  section: HTMLElement;
  /** Kelas latar tirai (sama dengan latar bagian tujuan). */
  veilClass: string;
  /** Letak siomay di bagian tujuan, diukur setelah halaman melompat. */
  target: () => Rect;
  onArrive?: () => void;
}) {
  // Klik ganda cepat tidak boleh memutar dua transisi (dan dua sambutan) sekaligus.
  if (running) return;
  running = true;
  const { from, image, section, veilClass, target, onArrive } = options;
  const root = document.createElement("div");
  root.className = "dive";
  root.setAttribute("aria-hidden", "true");
  const veil = document.createElement("div");
  veil.className = `dive__veil ${veilClass}`;
  const dish = document.createElement("img");
  dish.className = "dive__dish";
  dish.src = image;
  dish.alt = "";
  root.append(veil, dish);
  document.body.appendChild(root);

  const place = (rect: Rect) => ({ left: rect.x - rect.width / 2, top: rect.y - rect.width / 2, width: rect.width, height: rect.width });
  gsap.set(dish, { ...place(from), autoAlpha: 0, scale: 0.9 });
  const iris = { r: 0 };
  const reach = Math.hypot(Math.max(from.x, innerWidth - from.x), Math.max(from.y, innerHeight - from.y));
  const paint = () => (veil.style.clipPath = `circle(${iris.r}px at ${from.x}px ${from.y}px)`);
  paint();

  gsap
    .timeline({
      onComplete: () => {
        root.remove();
        running = false;
      },
    })
    .to(dish, { autoAlpha: 1, scale: 1.08, duration: 0.3, ease: "power2.out" }, 0)
    .to(iris, { r: reach, duration: 0.62, ease: "power2.in", onUpdate: paint }, 0.12)
    .add(() => {
      // Di balik tirai: lompat langsung ke awal bagian tujuan.
      window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY, behavior: "instant" });
      settleScroll();
    }, 0.76)
    .add(() => {
      const to = target();
      gsap
        .timeline()
        .to(dish, { ...place(to), scale: 1, duration: 0.7, ease: "power3.inOut" }, 0)
        .to(dish, { rotate: -12, duration: 0.35, ease: "sine.out" }, 0)
        .to(dish, { rotate: 0, duration: 0.35, ease: "sine.in" }, 0.35)
        .add(() => onArrive?.(), 0.55)
        .to([dish, veil], { autoAlpha: 0, duration: 0.4, ease: "power1.out" }, 0.7);
    }, 0.8)
    .set({}, {}, 1.95);
}
