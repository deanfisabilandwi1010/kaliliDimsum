import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/**
 * Selesaikan semua scrub yang masih "menyusul" setelah lompatan scroll, supaya
 * bagian tujuan langsung tampil di pose akhirnya saat tirai transisi terbuka.
 */
export function settleScroll() {
  ScrollTrigger.update();
  for (const trigger of ScrollTrigger.getAll()) {
    const scrub = trigger.vars.scrub;
    if (typeof scrub !== "number" || !trigger.animation) continue;
    // scrubDuration(0) menuntaskan tween "menyusul" milik ScrollTrigger (tidak
    // ada di tipe resminya), lalu kehalusan scrub dipasang kembali.
    const self = trigger as typeof trigger & { scrubDuration?: (value: number) => void };
    self.scrubDuration?.(0);
    trigger.animation.progress(trigger.progress);
    self.scrubDuration?.(scrub);
  }
}
