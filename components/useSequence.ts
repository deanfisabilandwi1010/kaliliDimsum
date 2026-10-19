"use client";

import { useEffect, useRef } from "react";
import media from "@/content/media.json";
import { FrameSequence, type SequenceOptions } from "@/lib/motion/frame-sequence";

type Layout = Pick<SequenceOptions, "cx" | "cy" | "focus">;
type Name = "story" | "black";

const PORTRAIT = "(max-aspect-ratio: 1/1), (max-width: 760px)";

/**
 * Memasang FrameSequence pada canvas. Frame pertama dimuat langsung; sisanya
 * baru diunduh ketika section mendekati viewport.
 */
export function useSequence(
  name: Name,
  enabled: boolean,
  layouts: { landscape: Layout; portrait: Layout },
  fade?: string,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seqRef = useRef<FrameSequence | null>(null);
  const layoutsRef = useRef(layouts);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;
    const mq = window.matchMedia(PORTRAIT);
    // Layar kecil memakai varian frame yang lebih ringan.
    const small = Math.min(window.innerWidth, 1280) * Math.min(window.devicePixelRatio || 1, 1.5) <= 900;
    const variant = small ? "m" : "d";
    const pick = () => (mq.matches ? layoutsRef.current.portrait : layoutsRef.current.landscape);
    const seq = new FrameSequence(canvas, {
      base: `/frames/${name}/${variant}`,
      count: media[name][variant].count,
      fade,
      ...pick(),
    });
    seqRef.current = seq;
    const onChange = () => seq.setLayout(pick());
    mq.addEventListener("change", onChange);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          seq.preload();
          io.disconnect();
        }
      },
      { rootMargin: "250% 0px" },
    );
    io.observe(canvas);
    return () => {
      mq.removeEventListener("change", onChange);
      io.disconnect();
      seq.destroy();
      seqRef.current = null;
    };
  }, [name, enabled, fade]);

  return { canvasRef, seqRef };
}

export const lastFrame = (name: Name) =>
  `/frames/${name}/d/${String(media[name].d.count).padStart(4, "0")}.webp`;
