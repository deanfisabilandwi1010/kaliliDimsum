"use client";

import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { brand } from "@/content/brand";
import { productById } from "@/content/products";
import type { Selection } from "@/lib/order-message";
import { detectLite } from "@/lib/motion/quality-mode";

type ExperienceValue = {
  /** null sampai klien selesai mendeteksi; komponen motion menunggu nilai ini. */
  lite: boolean | null;
  /** true setelah gerbang pembuka selesai, dilewati, atau gagal. */
  entered: boolean;
  enter: () => void;
  /** true jika pengunjung menekan "Buka kukusannya" di gerbang: hero lalu membuka kukusan 3D-nya sendiri. */
  warm: boolean;
  warmUp: () => void;
  sound: boolean;
  setSound: (value: boolean) => void;
  selection: Selection;
  count: number;
  setQuantity: (id: string, qty: number) => void;
  toggle: (id: string) => void;
  /** Tambah satu satuan jual; jika sudah ada, jumlah di baris yang sama bertambah. */
  add: (id: string) => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  announcement: string;
};

const ExperienceContext = createContext<ExperienceValue | null>(null);
const SELECTION_KEY = "kalili:selection";
/** Batas komposisi ringkas (mobile/potret) yang dipakai CSS dan semua adegan scroll. */
const COMPACT_QUERY = "(max-width: 760px), (max-aspect-ratio: 1/1)";

export function useExperience() {
  const value = useContext(ExperienceContext);
  if (!value) throw new Error("useExperience harus dipakai di dalam <Experience>");
  return value;
}

export function Experience({ children }: { children: React.ReactNode }) {
  const [lite, setLiteState] = useState<boolean | null>(null);
  const [entered, setEntered] = useState(false);
  const [sound, setSound] = useState(brand.audioEnabledByDefault);
  const [selection, setSelection] = useState<Selection>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const restored = useRef(false);

  useEffect(() => {
    setLiteState(detectLite());
    try {
      const saved = JSON.parse(sessionStorage.getItem(SELECTION_KEY) ?? "{}") as Selection;
      setSelection(Object.fromEntries(Object.entries(saved).filter(([id, qty]) => productById(id) && qty > 0)));
    } catch {}
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
    } catch {}
  }, [selection]);

  useEffect(() => {
    if (lite === null) return;
    document.documentElement.dataset.motion = lite ? "lite" : "full";
  }, [lite]);

  // Adegan scroll dan 3D mengukur tata letak sekali saat dipasang. Jika
  // jendela berpindah antara komposisi lebar dan ringkas (mis. diperkecil di
  // DevTools atau tablet diputar), semua bagian dipasang ulang seperti baru
  // dibuka di ukuran itu, supaya tidak ada posisi sisa komposisi lama.
  // Pilihan menu dan status gerbang tetap (disimpan di sini/sessionStorage).
  const [layoutVersion, setLayoutVersion] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const onChange = () => setLayoutVersion((v) => v + 1);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const [warm, setWarm] = useState(false);
  const warmUp = useCallback(() => setWarm(true), []);
  const enter = useCallback(() => setEntered(true), []);

  const setQuantity = useCallback((id: string, qty: number) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(qty, 99);
      return next;
    });
  }, []);

  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const toggle = useCallback(
    (id: string) => {
      const name = productById(id)?.name ?? id;
      const selected = Boolean(selectionRef.current[id]);
      setQuantity(id, selected ? 0 : 1);
      setAnnouncement(selected ? `${name} dihapus dari pilihan` : `${name} ditambahkan ke pilihan`);
    },
    [setQuantity],
  );

  const add = useCallback(
    (id: string) => {
      const product = productById(id);
      if (!product) return;
      const qty = (selectionRef.current[id] ?? 0) + 1;
      // Ref diperbarui langsung: dua klik cepat sebelum render tetap terhitung dua.
      selectionRef.current = { ...selectionRef.current, [id]: Math.min(qty, 99) };
      setQuantity(id, qty);
      setAnnouncement(qty > 1 ? `${product.name} ditambahkan, jumlah ${qty}` : `${product.name} ditambahkan ke pilihan`);
    },
    [setQuantity],
  );

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo<ExperienceValue>(
    () => ({
      lite, entered, enter, warm, warmUp, sound, setSound, selection,
      count: Object.keys(selection).length,
      setQuantity, toggle, add, drawerOpen, openDrawer, closeDrawer, announcement,
    }),
    [lite, entered, enter, warm, warmUp, sound, selection, setQuantity, toggle, add, drawerOpen, openDrawer, closeDrawer, announcement],
  );

  return (
    <ExperienceContext.Provider value={value}>
      <Fragment key={layoutVersion}>{children}</Fragment>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </ExperienceContext.Provider>
  );
}
