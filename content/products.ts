export type Product = {
  id: string;
  name: string;
  /** Nama dasar file di public/products (tersedia -480.webp dan -960.webp). */
  image: string;
  alt: string;
  category: "dimsum" | "pangsit";
  priceIDR: number | null;
  portionLabel: string | null;
  availability: "available" | "unavailable" | "unknown";
  /** "draft" = nama mengikuti nama file aset, belum dikonfirmasi pemilik. */
  verificationStatus: "draft" | "verified";
  layout: "card" | "feature";
};

const draft = {
  priceIDR: null,
  portionLabel: null,
  availability: "unknown",
  verificationStatus: "draft",
} as const;

export const products: Product[] = [
  { id: "original", name: "Original", image: "original", alt: "Kukusan bambu berisi siomay terbuka dengan topping oranye", category: "dimsum", layout: "card", ...draft },
  { id: "cheese-mentai", name: "Cheese Mentai", image: "cheese-mentai", alt: "Kukusan bambu berisi dimsum dengan saus mentai dan keju panggang", category: "dimsum", layout: "card", ...draft },
  { id: "nori-cheese-mentai", name: "Nori Cheese Mentai", image: "nori-cheese-mentai", alt: "Kukusan bambu berisi dimsum berbalut nori dengan topping mentai", category: "dimsum", layout: "card", ...draft },
  { id: "hakaw", name: "Hakaw", image: "hakaw", alt: "Kukusan bambu berisi hakaw berkulit bening", category: "dimsum", layout: "card", ...draft },
  { id: "gyoza", name: "Gyoza", image: "gyoza", alt: "Sepiring gyoza panggang dengan saus cocol di tengah", category: "dimsum", layout: "card", ...draft },
  { id: "black-series", name: "Black Series", image: "black-series", alt: "Kukusan bambu berisi dimsum berkulit hitam dengan topping panggang", category: "dimsum", layout: "card", ...draft },
  { id: "pangsit-pedas-rebus", name: "Pangsit Pedas Rebus", image: "pangsit-pedas-rebus", alt: "Semangkuk pangsit rebus dalam saus merah pedas", category: "pangsit", layout: "feature", ...draft },
];

export const productById = (id: string) => products.find((p) => p.id === id);

/** Tiga sorotan di hero; dikurasi sementara, ganti sesuai data pemilik. */
export const spotlightIds = ["original", "cheese-mentai", "black-series"];

export const formatIDR = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
