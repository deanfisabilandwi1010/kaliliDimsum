// Membuat turunan web di public/ dari master di Assets/. Master tidak diubah.
// Jalankan: npm run assets
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "Assets");
const OUT = path.join(root, "public");
const src = (name) => path.join(SRC, name);
const out = (...p) => path.join(OUT, ...p);
const dir = (...p) => {
  const d = out(...p);
  mkdirSync(d, { recursive: true });
  return d;
};
const ffmpeg = (args) =>
  execFileSync(ffmpegPath, ["-v", "error", "-y", ...args], { stdio: "inherit" });

const VIDEO = {
  intro: "pembuka kartun, 8 detik.mp4",
  hero: "hero ambient loop, 6 detik.mp4",
  story: "master scroll scrub, 8 detik.mp4",
  black: "Black Series reveal.mp4",
};
const X264 = ["-c:v", "libx264", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

// ---------- Video ----------
function videos() {
  dir("video");
  // Intro: berhenti di 6.2 dtk (kukusan masih terbuka, sebelum tutup kembali
  // dan sebelum cut). delogo menghapus tulisan "24 fps" di kanan bawah.
  ffmpeg([
    "-i", src(VIDEO.intro), "-t", "6.2",
    "-vf", "delogo=x=1136:y=658:w=104:h=42",
    ...X264, "-crf", "22", "-c:a", "aac", "-b:a", "96k",
    out("video", "intro.mp4"),
  ]);
  ffmpeg(["-i", src(VIDEO.intro), "-vf", "delogo=x=1136:y=658:w=104:h=42", "-frames:v", "1", "-q:v", "3", out("video", "intro-poster.jpg")]);

  // Hero: sumber punya cut di 1.5 dtk, jadi dipakai 1.7–10 dtk. Detik pertama
  // di-crossfade ke ekor klip supaya sambungan loop tidak terlihat.
  ffmpeg([
    "-i", src(VIDEO.hero),
    "-filter_complex",
    "[0:v]trim=1.7:10,setpts=PTS-STARTPTS,split[a][b];" +
      "[a]trim=1:8.3,setpts=PTS-STARTPTS[main];" +
      "[b]trim=0:1,setpts=PTS-STARTPTS[head];" +
      "[main][head]xfade=transition=fade:duration=1:offset=6.3[v]",
    "-map", "[v]", "-an", ...X264, "-crf", "23",
    out("video", "hero-loop.mp4"),
  ]);
  ffmpeg(["-i", out("video", "hero-loop.mp4"), "-frames:v", "1", "-q:v", "3", out("video", "hero-poster.jpg")]);
}

// ---------- Frame sequence untuk scroll scrub ----------
function sequence(name, file, seconds, variants) {
  const meta = {};
  for (const [key, { width, step, quality }] of Object.entries(variants)) {
    const d = out("frames", name, key);
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
    ffmpeg([
      "-i", src(file), "-t", String(seconds),
      "-vf", `select='not(mod(n\\,${step}))',scale=${width}:-2:flags=lanczos`,
      "-fps_mode", "passthrough",
      "-c:v", "libwebp", "-q:v", String(quality), "-compression_level", "6",
      path.join(d, "%04d.webp"),
    ]);
    const count = readdirSync(d).length;
    meta[key] = { count, width, height: Math.round((width * 9) / 16 / 2) * 2 };
  }
  return meta;
}

// ---------- Gambar ----------
const PRODUCTS = {
  original: "original-transparent-4k.png",
  "cheese-mentai": "cheese-mentai-transparent-4k.png",
  "nori-cheese-mentai": "nori-cheese-mentai-transparent-4k.png",
  hakaw: "hakaw-transparent-4k.png",
  gyoza: "gyoza-transparent-4k.png",
  "black-series": "black-series-transparent-4k.png",
  "pangsit-pedas-rebus": "pangsit-pedas-rebus-transparent-4k.png",
};

async function images() {
  dir("products");
  for (const [id, file] of Object.entries(PRODUCTS)) {
    // trim membuang kanvas transparan kosong supaya skala antarproduk seragam.
    const trimmed = await sharp(src(file)).trim().toBuffer();
    for (const w of [480, 960]) {
      await sharp(trimmed)
        .resize(w, w, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 84, alphaQuality: 90 })
        .toFile(out("products", `${id}-${w}.webp`));
    }
  }

  dir("retro");
  const retro = [
    ["Retro Shumai Mascot in Rubber-Hose Style.png", "mascot", 760],
    ["Retro Shumai Steamer with Lifted Lid-1.png", "steamer", 1000],
    ["Retro Oxblood Dimsum Lantern.png", "lantern", 420],
  ];
  for (const [file, name, w] of retro) {
    await sharp(src(file)).trim().resize({ width: w }).webp({ quality: 86, alphaQuality: 92 }).toFile(out("retro", `${name}.webp`));
  }
  await sharp(src("Retro Dimsum Steam Club Portal.png")).resize({ width: 1672 }).webp({ quality: 82 }).toFile(out("retro", "portal.webp"));

  // Logo resmi: hanya dipotong kanvas kosongnya, tidak digambar ulang.
  dir("brand");
  const logo = await sharp(src("Logo_Kalili-removebg-preview.png")).trim().toBuffer();
  await sharp(logo).webp({ lossless: true }).toFile(out("brand", "logo.webp"));
  await sharp(logo)
    .resize(168, 168, { fit: "contain", background: "#fff2da" })
    .extend({ top: 12, bottom: 12, left: 12, right: 12, background: "#fff2da" })
    .flatten({ background: "#fff2da" })
    .png()
    .toFile(path.join(root, "app", "icon.png"));

  // Model 3D siomay: GLB dipakai apa adanya; pratinjau utuh jadi poster/fallback.
  dir("models");
  copyFileSync(src("kalili-dimsum-3d/kalili-dimsum-ingredients.glb"), out("models", "kalili-dimsum.glb"));
  await sharp(src("kalili-dimsum-3d/kalili-assembled.png")).trim().resize({ width: 900 }).webp({ quality: 86, alphaQuality: 92 }).toFile(out("models", "dimsum-assembled.webp"));

  // Kukusan interaktif untuk hero: GLB apa adanya; pratinjau tertutup/terbuka
  // jadi poster (pengisi sebelum model siap, dan pengganti bila 3D tidak tersedia).
  copyFileSync(src("kalili-interactive-steamer-3d/kalili-steamer/kalili-interactive-steamer.glb"), out("models", "kalili-steamer.glb"));
  for (const state of ["closed", "open"]) {
    await sharp(src(`kalili-interactive-steamer-3d/kalili-steamer/kalili-steamer-${state}.png`))
      .trim().resize({ width: 1000 }).webp({ quality: 86, alphaQuality: 92 }).toFile(out("models", `steamer-${state}.webp`));
  }
  // Varian sajian untuk isi kukusan (hanya makanan, tanpa kukusan): dipakai apa adanya.
  for (const variant of ["cheese-mentai", "black-series"]) {
    copyFileSync(src(`kalili-menu-variants-3d/kalili-${variant}.glb`), out("models", `kalili-${variant}.glb`));
  }

  dir("moments");
  for (const id of ["1140", "1180", "1205"]) {
    await sharp(src(`IMG_${id}.PNG`)).resize({ width: 880 }).webp({ quality: 80 }).toFile(out("moments", `img-${id}.webp`));
  }
  await sharp(src("Black Series.jpeg")).resize({ width: 640 }).webp({ quality: 80 }).toFile(out("moments", "black-series-detail.webp"));
}

// Warna tepi frame: dipakai CSS agar latar halaman menyatu dengan video.
async function edgeColor(file, region) {
  const img = sharp(file);
  const { width, height } = await img.metadata();
  const box = {
    top: { left: 0, top: 0, width, height: Math.round(height * 0.04) },
    bottom: { left: 0, top: Math.round(height * 0.96), width, height: Math.round(height * 0.04) },
    left: { left: 0, top: Math.round(height * 0.6), width: Math.round(width * 0.04), height: Math.round(height * 0.3) },
  }[region];
  const { data } = await sharp(file).extract(box).resize(1, 1).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return "#" + [...data.subarray(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

const only = process.argv[2];
if (!only || only === "video") videos();
let frames;
if (!only || only === "frames") {
  frames = {
    // 7.25 dtk = puncak showcase, sebelum siomay turun dan tutup menutup lagi.
    story: sequence("story", VIDEO.story, 7.25, {
      d: { width: 1280, step: 1, quality: 70 },
      m: { width: 854, step: 2, quality: 66 },
    }),
    black: sequence("black", VIDEO.black, 8, {
      d: { width: 1280, step: 2, quality: 72 },
      m: { width: 854, step: 3, quality: 68 },
    }),
  };
  const last = (n, v) => out("frames", n, v, String(frames[n][v].count).padStart(4, "0") + ".webp");
  const first = (n, v) => out("frames", n, v, "0001.webp");
  frames.colors = {
    storyStartTop: await edgeColor(first("story", "d"), "top"),
    storyStartBottom: await edgeColor(first("story", "d"), "bottom"),
    storyEndTop: await edgeColor(last("story", "d"), "top"),
    storyEndBottom: await edgeColor(last("story", "d"), "bottom"),
    blackEndBottom: await edgeColor(last("black", "d"), "bottom"),
    blackEndLeft: await edgeColor(last("black", "d"), "left"),
    heroTop: await edgeColor(out("video", "hero-poster.jpg"), "top"),
    heroBottom: await edgeColor(out("video", "hero-poster.jpg"), "bottom"),
  };
  mkdirSync(path.join(root, "content"), { recursive: true });
  writeFileSync(path.join(root, "content", "media.json"), JSON.stringify(frames, null, 2) + "\n");
  console.log(frames);
}
if (!only || only === "images") await images();
console.log("Aset siap di public/");
