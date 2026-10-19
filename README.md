# Dimsum by Kalili — Kalili Steam Club

Website interaktif satu halaman: gerbang pembuka → hero → anatomi siomay 3D → ritual kukusan (scroll scrub) → menu → Black Series → cerita → pilihan.

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
| Hero (kukusan 3D) | Model `kalili-interactive-steamer.glb` dirender Three.js (`lib/three/steamer-scene.ts`). Tombol "Buka Kukusan Kalili" memutar `entrance_open` sekali (2,4 dtk; 1,9 dtk di mobile) dengan uap singkat; pengunjung yang sudah menekan "Buka kukusannya" di gerbang tidak perlu klik lagi. Setelah terbuka: model miring mengikuti kursor maksimal ±4° (mouse saja), tombol "Kenali Isinya" memutar `hero_lift` lalu siomay itu "menyelam" ke bagian anatomi (`lib/motion/dive.ts`): iris berwarna latar anatomi terbuka dari siomay, halaman pindah di balik tirai tanpa menggulir melewati bagian di antaranya, siomay mendarat tepat di posisi model anatomi, lalu model berputar menyambut dan teksnya naik, dan scroll hanya menggerakkan kamera. Kukusan berdiri di atas baki pernis merah berlist emas, di tengah medali ornamen emas (cincin, belah ketupat, awan ruyi; tekstur kanvas) yang berputar sangat pelan, dengan debu emas berkilau di udara. Uap berupa partikel GPU di dalam adegan (gumpalan noise yang naik, melebar, dan memudar; semburan saat tutup terangkat; berhenti saat hero tidak terlihat). Kukusan juga bisa disentuh langsung: klik kukusan tertutup untuk membukanya (tutup "mengintip" dan melepas sedikit uap saat disorot kursor), klik tutup yang sudah terbuka untuk menutupnya lagi (label "Tutup kukusan" saat disorot; tutup melayang pulang lewat klip pembuka yang diputar mundur, siomay yang terangkat turun dulu, lalu sedikit uap lolos dari celahnya), seret untuk memutar, klik siomay untuk reaksi bergiliran (lompat-putar, meletup tinggi lalu mendarat dengan kepulan, kenyal seperti puding, salto). Isi kukusan campuran (`content/steamer-slots.ts`): depan-tengah dan tengah-kiri Original (siomay bawaan; hanya yang depan punya `hero_lift`/`ingredients_cycle`), tengah-kanan dan belakang-kanan Cheese Mentai, belakang-kiri Black Series. Tiap siomay punya `instanceId` sendiri dan `productId` dari katalog. Model varian (`kalili-cheese-mentai.glb`, `kalili-black-series.glb`, hanya makanan) dimuat di latar setelah kukusan siap, disamakan lebarnya dengan siomay yang digantikan, dan dasarnya diletakkan di lantai kukusan. Selama memuat, atau jika gagal, tempat itu tetap siomay Original dan berlabel Original (kegagalan dicatat di konsol). Hover (mouse): siomay terangkat sedikit dan namanya muncul. Klik/ketuk: siomay bereaksi, cincin emas menandai pilihan, dan kartu produknya terbuka (nama, porsi/harga/ketersediaan bila sudah diisi di katalog). Klik tidak pernah menambah pesanan; "Tambah ke pilihan" menambah satu satuan ke baris produk yang sama (dua Original berbeda = satu baris berjumlah 2), lalu salinan sajian terbang ke "Pilihanmu". Di mobile kartu produk tampil sebagai bottom sheet (baris pilihan sajian minggir selama sheet terbuka). Tombol "Pilih sajian" di bawah hero memilih instance utama produk yang sama, dengan fokus keyboard pindah ke kartu dan kembali ke tombol saat Escape/tutup. Produk yang tidak ada di kukusan tetap berupa tautan ke kartunya di menu. Saat dibuka, dekor panggung ikut muncul (portal emas, cincin lantai, percik emas, lampion, dan Si Kali; lampion berayun dan Si Kali melompat sambil berceloteh saat diklik). "Langsung Lihat Menu" dan pilihan sajian selalu tersedia sebagai HTML. Tanpa WebGL / mode ringan / model gagal: poster kukusan terbuka |
| Pita merek | Berjalan sendiri; laju, arah, dan kemiringan mengikuti kecepatan scroll |
| Anatomi siomay (3D) | Menempel; model GLB dirender Three.js, scroll menentukan waktu klip `assemble_explode_reassemble` (progress × 8 dtk, tanpa autoplay): utuh → terurai dengan label Kulit/Daging/Sayuran/Wortel → menyatu → tombol Lihat Menu. Three.js dan model baru dimuat saat section mendekat; jika WebGL gagal atau mode ringan, tampil gambar siomay utuh + daftar bahan. Interaktif: seret untuk memutar (di layar sentuh hanya mendatar, gerak tegak tetap menggulir), klik bahan atau tombol namanya untuk mendekat dan melihat detail; menggulir lagi atau Escape melepas fokus. Tiap pilihan punya gerak sendiri (kamera meluncur antar-bahan, silang-pudar, riak emas, kartu detail masuk ulang). Adegan memakai bayangan nyata (VSM 1024), cahaya tepi, dan model berputar pelan mengikuti scroll |
| Ganti ukuran layar | Saat jendela berpindah antara komposisi lebar dan ringkas (`(max-width: 760px), (max-aspect-ratio: 1/1)`, mis. diperkecil di DevTools atau tablet diputar), semua bagian dipasang ulang seperti baru dibuka di ukuran itu (`components/Experience.tsx`); pilihan menu tetap |
| Tautan ke bagian jauh | "Menu", "Lihat Menu", "Black Series", "Cerita Kalili", dan logo (bila tujuannya lebih dari 1,5 layar) tidak menggulir melewati semua bagian: lampu padam lewat iris gelap berbingkai emas dari titik klik, nama tujuan tampil sebentar, halaman pindah di balik tirai (scrub langsung dituntaskan), lalu iris terbuka dari tengah layar (`lib/motion/curtain.ts`). Tiba di menu: sajian di bawah sorot langsung disajikan. Tautan kartu menu yang jauh memakai tirai yang sama, yang dekat meluncur. Skip link dan mode ringan tetap lompat biasa |
| Tirai 3D → ritual | Ritual naik seperti tirai (sudut atas membulat) menutupi adegan anatomi yang masih menempel selama 100svh; adegan itu mundur dan meredup (`CURTAIN` di `lib/motion/handoff.ts`) |
| Ritual kukusan | Menempel; frame video di-scrub, kamera mendekat pelan |
| Serah-terima ritual → menu | Kedua section menumpuk 120svh (`HANDOFF`): lampu ritual padam seperti iris yang menutup ke kukusan sementara kamera terus mendekat, lalu panggung menu muncul di tempat di sekelilingnya (sorot dan kukusan pertama dulu, judul menyusul). Tautan `#menu` mendarat setelah serah-terima |
| Menu | Menempel; lampu padam, scroll vertikal menggeser deretan menu ke samping melewati sorot lampu di tengah (gaya layar pilih karakter game fighting); sajian di bawah sorot membesar dan terang, lainnya meredup. Mengeklik sajian "menyajikannya" (melompat, berputar, uap mengepul, cincin emas di podium); tombol + juga menyajikannya lalu salinannya terbang ke tombol "Pilihanmu" yang berdenyut. Tautan ke kartu tertentu meluncur ke sana dan menyajikan kartunya saat tiba |
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
