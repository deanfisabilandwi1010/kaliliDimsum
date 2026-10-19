// Isi kukusan 3D di hero: tiap siomay yang terlihat = satu instance dengan
// identitas menu sendiri. productId harus id yang sudah ada di content/products.
//
// Posisi mengikuti lima tempat yang sudah ada di model kukusan (dilihat dari
// kamera hero yang sedikit dari kiri-depan):
//   depan-tengah  dimsum_hero_root   Original (satu-satunya yang punya animasi isi)
//   tengah-kiri   dimsum_support_01  Original
//   tengah-kanan  dimsum_support_02  Cheese Mentai
//   belakang-kiri dimsum_support_03  Black Series
//   belakang-kanan dimsum_support_04 Cheese Mentai
//
// Selama model varian dimuat, atau jika gagal dimuat, tempat itu tetap
// menampilkan siomay Original bawaan kukusan DAN dianggap Original: label
// tidak pernah mendahului modelnya.

export type SlotVariant = { url: string; root: string };

export type SteamerSlot = {
  /** Node penanda tempat di GLB kukusan. */
  node: string;
  instanceId: string;
  productId: string;
  /** Model pengganti; tanpa ini tempat memakai siomay Original bawaan kukusan. */
  variant?: SlotVariant;
  /** Instance yang dipilih tombol HTML untuk produk yang muncul lebih dari sekali. */
  primary?: boolean;
};

const CHEESE_MENTAI: SlotVariant = { url: "/models/kalili-cheese-mentai.glb", root: "cheese_mentai_root" };
const BLACK_SERIES: SlotVariant = { url: "/models/kalili-black-series.glb", root: "black_series_root" };

/** Produk yang diwakili siomay bawaan kukusan. */
export const BUILT_IN_PRODUCT = "original";

export const steamerSlots: SteamerSlot[] = [
  { node: "dimsum_hero_root", instanceId: "slot_front_center_original", productId: "original", primary: true },
  { node: "dimsum_support_01", instanceId: "slot_mid_left_original", productId: "original" },
  { node: "dimsum_support_02", instanceId: "slot_mid_right_cheese", productId: "cheese-mentai", variant: CHEESE_MENTAI, primary: true },
  { node: "dimsum_support_03", instanceId: "slot_back_left_black", productId: "black-series", variant: BLACK_SERIES, primary: true },
  { node: "dimsum_support_04", instanceId: "slot_back_right_cheese", productId: "cheese-mentai", variant: CHEESE_MENTAI },
];
