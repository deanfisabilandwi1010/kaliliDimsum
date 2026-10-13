# Dimsum by Kalili — Kalili Steam Club

Website interaktif satu halaman: gerbang pembuka → hero → ritual kukusan (scroll scrub) → menu → Black Series → cerita → pilihan.

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start   # build produksi
```

`npm run assets` membuat ulang seluruh turunan di `public/` dari master di `Assets/` (video dipotong, frame sequence, gambar WebP). Master tidak pernah diubah.

## Stack

Next.js (App Router) + TypeScript, GSAP + ScrollTrigger, CSS biasa dengan custom properties. Tanpa smooth-scroll library; scroll native.

Sebagian besar gerak berasal dari empat video yang disediakan (2.5D). Satu bagian memakai model 3D nyata: `Assets/kalili-dimsum-3d/kalili-dimsum-ingredients.glb`, dirender dengan Three.js (tanpa React Three Fiber) di `components/DimsumAnatomy.tsx` dan `lib/three/dimsum-scene.ts`. Uraian bahan pada model bersifat ilustratif, bukan verifikasi resep.

## Pemakaian empat video

| Sumber di `Assets/` | Dipakai sebagai | Pengolahan |
|---|---|---|
| `pembuka kartun, 8 detik.mp4` | Film pembuka setelah tombol "Buka kukusannya" | Dipotong di 6,2 dtk (sebelum tutup menutup lagi dan sebelum cut); tulisan "24 fps" dihapus |
| `hero ambient loop, 6 detik.mp4` | Latar hero | Dipakai dari 1,7 dtk (ada cut di 1,5 dtk); ujungnya di-crossfade agar loop mulus; audio dibuang |
| `master scroll scrub, 8 detik.mp4` | Ritual kukusan, digerakkan scroll | 174 frame WebP (0–7,25 dtk, sampai puncak siomay terangkat) |
| `Black Series reveal.mp4` | Jendela Black Series, digerakkan scroll | 96 frame WebP (0–8 dtk) |

Scroll scrub memakai frame sequence di `<canvas>`, bukan `video.currentTime`, supaya maju/mundur selalu menghasilkan frame yang sama. Layar kecil memuat varian frame yang lebih ringan.

Agar video menyatu dengan halaman: warna latar section diambil dari tepi frame (`content/media.json`), dan bagian kanvas yang tidak tertutup frame diisi perpanjangan tepi frame itu sendiri (`lib/motion/frame-sequence.ts`).

## Mengisi data bisnis

- `content/brand.ts`: nomor WhatsApp, outlet, path logo. Selama `whatsapp` masih `null`, panel pilihan menampilkan "Kanal pesan belum tersedia" dan hanya menyediakan tombol salin.
- `content/products.ts`: nama, harga, porsi. Harga/porsi `null` tidak ditampilkan.

## Gerak per bagian (mode penuh)

| Bagian | Mekanik scroll |
|---|---|
| Layar pemuatan | Angka dan garis progres mengikuti aset yang benar-benar selesai diunduh (gambar gerbang, poster, frame pertama, font, dua video); batas tunggu 7 dtk; lalu garis portal tergambar dan isi gerbang masuk satu per satu |
| Gerbang | Bidang merah polos, garis portal tipis, judul besar, satu kukusan, satu tombol; portal, judul, dan kukusan bergeser mengikuti kursor |
| Hero | Menempel 70svh: teks naik, panggung menyusut menjadi portal lengkung di atas merah |
| Pita merek | Berjalan sendiri; laju, arah, dan kemiringan mengikuti kecepatan scroll |
| Ritual kukusan | Menempel; frame video di-scrub, kamera mendekat pelan |
| Anatomi siomay (3D) | Menempel; model GLB dirender Three.js, scroll menentukan waktu klip `assemble_explode_reassemble` (progress × 8 dtk, tanpa autoplay): utuh → terurai dengan label Kulit/Daging/Sayuran/Wortel → menyatu → tombol Lihat Menu. Three.js dan model baru dimuat saat section mendekat; jika WebGL gagal atau mode ringan, tampil gambar siomay utuh + daftar bahan. Interaktif: seret untuk memutar (di layar sentuh hanya mendatar, gerak tegak tetap menggulir), klik bahan atau tombol namanya untuk mendekat dan melihat detail; menggulir lagi atau Escape melepas fokus. Tiap pilihan punya gerak sendiri (kamera meluncur antar-bahan, silang-pudar, riak emas, kartu detail masuk ulang). Adegan memakai bayangan nyata (VSM 1024), cahaya tepi, dan model berputar pelan mengikuti scroll |
| Serah-terima 3D → menu | Kedua section menumpuk 120svh (`lib/motion/handoff.ts`): di adegan yang sama lampu padam, siomay 3D meluncur ke titik sorot dan mengecil seukuran satu siomay, lalu panggung menu muncul di tempat di sekelilingnya (sorot dan kukusan pertama dulu, judul menyusul). Tautan `#menu` mendarat setelah serah-terima |
| Menu | Menempel; lampu padam, scroll vertikal menggeser deretan menu ke samping melewati sorot lampu di tengah (gaya layar pilih karakter game fighting); sajian di bawah sorot membesar dan terang, lainnya meredup |
| Black Series | Menempel; cahaya video menyala mengikuti scroll |
| Cerita | Foto menyebar dari satu tumpukan; pita teks besar melintas ke samping |
| Ajakan memilih | Section merah terbuka dengan iris dari bawah |

Tautan `#menu-<id>` (mis. `#menu-gyoza`) mendarat tepat di kartu yang dimaksud di dalam deretan.

## Build verifikasi tanpa mengganggu `npm run dev`

`next build` menimpa `.next` dan merusak server dev yang sedang jalan. Untuk build sambil dev tetap aktif:

```bash
NEXT_DIST_DIR=.next-verify npx next build && NEXT_DIST_DIR=.next-verify npx next start -p 3210
```

## Mode ringan

Aktif otomatis untuk `prefers-reduced-motion` dan Save-Data (tidak ada tombol di halaman). Tanpa video, tanpa frame sequence, tanpa pin. Tanpa JavaScript halaman memakai layout yang sama dan gerbang pembuka disembunyikan.

## Belum ada / perlu konfirmasi pemilik

- Harga, porsi, alamat, jam buka, nomor pemesanan.
- Logo memakai `Assets/Logo_Kalili-removebg-preview.png` (raster 294 × 320 px setelah dipotong). Cukup untuk ukuran sekarang; untuk tampil lebih besar perlu master vektor.
- Nama menu mengikuti nama file aset.
- Izin pemakaian foto pengunjung di bagian "Cerita Kalili".
- Video pembuka dan hero memuat poster dinding beraksara Mandarin dari hasil generasi video.
- Belum diuji di perangkat fisik maupun Safari/iOS; pengujian sejauh ini di Chrome desktop dan emulasi viewport 390 × 844.
