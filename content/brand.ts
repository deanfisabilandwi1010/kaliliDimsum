// Data bisnis hanya diisi setelah dikonfirmasi pemilik. Nilai null ditangani UI
// dengan jujur (tombol nonaktif / bagian disembunyikan), bukan diganti karangan.

export type OrderChannel = {
  /** Nomor WhatsApp format internasional tanpa "+", contoh "6281234567890". */
  whatsapp: string | null;
};

export type Outlet = {
  name: string;
  address: string;
  hours: string;
  mapsUrl?: string;
};

export const brand = {
  displayName: "Dimsum by Kalili",
  conceptName: "Kalili Steam Club",
  // Dibuat scripts/prepare-assets.mjs dari Assets/Logo_Kalili-removebg-preview.png.
  // Set null untuk kembali ke wordmark teks.
  logo: "/brand/logo.webp" as string | null,
  orderChannel: { whatsapp: null } as OrderChannel,
  outlets: [] as Outlet[],
  socialLinks: [] as { label: string; href: string }[],
  audioEnabledByDefault: false,
};
