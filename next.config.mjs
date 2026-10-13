/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Turunan gambar sudah dibuat oleh scripts/prepare-assets.mjs.
  images: { unoptimized: true },
  // NEXT_DIST_DIR memungkinkan build verifikasi berjalan tanpa menimpa folder
  // .next milik `npm run dev` yang sedang aktif.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
