// Pemutar frame sequence di <canvas> untuk scroll scrub.
// Indeks frame selalu diturunkan dari progress 0–1, jadi maju/mundur identik.

export type SequenceOptions = {
  /** Folder berisi 0001.webp dst. */
  base: string;
  count: number;
  /** Titik viewport (0–1) tempat pusat frame diletakkan. */
  cx?: number;
  cy?: number;
  /**
   * Porsi lebar frame yang wajib terlihat. Di layar portrait frame diperkecil
   * sampai porsi ini muat, lalu sisa kanvas diisi perpanjangan tepi frame.
   */
  focus?: number;
  /** Jika diisi, sisa atas/bawah melebur ke warna ini alih-alih memperpanjang tepi. */
  fade?: string;
};

const MAX_DPR = 1.5;
const CONCURRENCY = 6;

export class FrameSequence {
  private images: (HTMLImageElement | undefined)[];
  private ready: boolean[];
  private ctx: CanvasRenderingContext2D;
  private strip: HTMLCanvasElement;
  private stripCtx: CanvasRenderingContext2D;
  private zoom = 1;
  private current = -1;
  private wanted = 0;
  private queue: number[] = [];
  private active = 0;
  private started = false;
  private destroyed = false;
  private resizeObserver: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement, private opts: SequenceOptions) {
    this.images = new Array(opts.count);
    this.ready = new Array(opts.count).fill(false);
    // Kanvas transparan: bila belum ada frame yang bisa digambar, yang terlihat
    // adalah latar section, bukan hitam.
    this.ctx = canvas.getContext("2d")!;
    this.strip = document.createElement("canvas");
    this.strip.height = 2;
    this.stripCtx = this.strip.getContext("2d", { alpha: false })!;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.load(0);
  }

  setLayout(layout: Pick<SequenceOptions, "cx" | "cy" | "focus">) {
    Object.assign(this.opts, layout);
    this.draw(true);
  }

  /** Mulai mengunduh sisa frame; dipanggil saat section mendekati viewport. */
  preload() {
    if (this.started) return;
    this.started = true;
    for (let i = 1; i < this.opts.count; i++) this.queue.push(i);
    this.pump();
  }

  /** zoom > 1 mendekatkan kamera secara halus di sepanjang scroll. */
  setProgress(p: number, zoom = 1) {
    const clamped = Math.min(1, Math.max(0, p));
    this.wanted = Math.round(clamped * (this.opts.count - 1));
    const zoomed = Math.abs(zoom - this.zoom) > 0.0005;
    if (zoomed) this.zoom = zoom;
    this.draw(zoomed);
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    this.queue = [];
    for (const img of this.images) if (img) img.src = "";
    this.images = [];
  }

  private url(i: number) {
    return `${this.opts.base}/${String(i + 1).padStart(4, "0")}.webp`;
  }

  private load(i: number) {
    if (this.images[i]) return;
    const img = new Image();
    img.decoding = "async";
    this.images[i] = img;
    this.active++;
    const done = (ok: boolean) => {
      this.active--;
      if (this.destroyed) return;
      this.ready[i] = ok;
      if (ok) this.draw();
      this.pump();
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = this.url(i);
  }

  private pump() {
    while (this.active < CONCURRENCY && this.queue.length) this.load(this.queue.shift()!);
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (!w || !h || (w === this.canvas.width && h === this.canvas.height)) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.draw(true);
  }

  /** Frame siap yang paling dekat dengan target, supaya tidak pernah kosong. */
  private nearest(target: number) {
    for (let d = 0; d < this.opts.count; d++) {
      if (this.ready[target - d]) return target - d;
      if (this.ready[target + d]) return target + d;
    }
    return -1;
  }

  private draw(force = false) {
    const index = this.nearest(this.wanted);
    if (index < 0 || (!force && index === this.current)) return;
    this.current = index;
    this.canvas.dataset.ready = "true";
    const img = this.images[index]!;
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const fw = img.naturalWidth;
    const fh = img.naturalHeight;
    const { cx = 0.5, cy = 0.5, focus } = this.opts;

    let s = Math.max(W / fw, H / fh);
    if (focus) s = Math.min(s, W / (fw * focus));
    s *= this.zoom;
    const dw = fw * s;
    const dh = fh * s;
    const dx = Math.round(W * cx - dw / 2);
    const dy = Math.round(H * cy - dh / 2);
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, dx, dy, dw, dh);

    if (this.opts.fade) {
      // Tepi atas/bawah frame melebur ke warna latar, seperti sorot lampu.
      const fade = (y0: number, y1: number) => {
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, this.opts.fade!);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
      };
      if (dy > 0) {
        ctx.fillStyle = this.opts.fade;
        ctx.fillRect(0, 0, W, dy + 1);
        fade(dy, dy + dh * 0.22);
      }
      if (dy + dh < H) {
        ctx.fillStyle = this.opts.fade;
        ctx.fillRect(0, dy + dh - 1, W, H - dy - dh + 1);
        fade(dy + dh, dy + dh * 0.78);
      }
      return;
    }

    // Kiri/kanan: sisa kanvas diisi cerminan frame. Sambungannya selalu pas
    // karena piksel di kedua sisi garis identik, tanpa resampling tambahan.
    const mirror = (edge: number, offset: number) => {
      ctx.save();
      ctx.translate(edge, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, offset, dy, dw, dh);
      ctx.restore();
    };
    if (dx > 0) mirror(dx, 0);
    if (dx + dw < W) mirror(dx + dw, -dw);
    // Atas/bawah: baris tepi kanvas dirata-rata lalu direntangkan (dinding dan
    // meja polos). Strip buram (tanpa alpha) agar tidak ada pencampuran transparan.
    const sc = this.strip;
    const sctx = this.stripCtx;
    const row = (sy: number, y: number, h: number) => {
      if (sc.width !== W) sc.width = W;
      sctx.drawImage(canvas, 0, sy, W, 12, 0, 0, W, 2);
      ctx.drawImage(sc, 0, 0, W, 2, 0, y, W, h);
    };
    if (dy > 0) row(dy + 1, 0, dy + 1);
    if (dy + dh < H) row(dy + dh - 13, dy + dh - 1, H - dy - dh + 1);
  }
}
