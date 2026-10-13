// Mode ringan: poster statis, tanpa scrub, tanpa video. Aktif otomatis untuk
// prefers-reduced-motion dan Save-Data; tidak ada tombol di halaman.

export function detectLite(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || conn?.saveData === true;
}

/**
 * Dijalankan inline sebelum paint. CSS memakai layout statis sebagai dasar dan
 * baru mengaktifkan layout pinned saat data-motion="full", jadi tanpa JavaScript
 * halaman tetap terbaca.
 */
export const liteBootScript = `try{var c=navigator.connection;document.documentElement.dataset.motion=(matchMedia("(prefers-reduced-motion: reduce)").matches||(c&&c.saveData))?"lite":"full"}catch(e){}`;

export const ENTERED_KEY = "kalili:entered";

/** Inline sebelum paint: lewati gerbang untuk tautan ber-hash atau sesi yang sudah masuk. */
export const gateBootScript = `try{if(location.hash.length>1||sessionStorage.getItem("${ENTERED_KEY}"))document.documentElement.dataset.entered="1"}catch(e){}`;
