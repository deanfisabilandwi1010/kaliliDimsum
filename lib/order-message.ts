import { brand } from "@/content/brand";
import { productById } from "@/content/products";

export type Selection = Record<string, number>;

export function buildOrderMessage(selection: Selection): string {
  const lines = Object.entries(selection)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `• ${productById(id)?.name ?? id} (${qty})`);
  return ["Halo Kalili, saya ingin menanyakan:", ...lines, "", "Boleh info harga dan ketersediaannya?"].join("\n");
}

/** null bila nomor belum dikonfirmasi; UI menampilkan status, bukan tautan palsu. */
export function buildWhatsAppUrl(selection: Selection): string | null {
  const number = brand.orderChannel.whatsapp?.replace(/\D/g, "");
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(buildOrderMessage(selection))}`;
}
