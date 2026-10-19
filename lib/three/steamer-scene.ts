// Adegan Three.js untuk kukusan interaktif di hero.
//
// Gerak dipisah agar tidak berebut transform yang sama:
//   - klip model (entrance_open, hero_lift) hanya menggerakkan tutup dan siomay
//     Original di dalam GLB;
//   - seret dan arah pointer hanya memutar `presentation`, grup pembungkus di
//     luar model;
//   - reaksi, angkat-hover, dan sorotan pilihan hanya menyentuh grup poros milik
//     tiap siomay (bukan node yang dianimasikan klip), dari pose istirahat yang
//     disimpan sekali, jadi interaksi berulang tidak pernah menggeser posisinya;
//   - scroll hanya menggerakkan kamera.
// Modul three dimuat dinamis; tidak ada loop render permanen.

import type { SteamerSlot } from "@/content/steamer-slots";

export type SteamerScene = {
  /** Putar entrance_open satu kali (tutup terangkat). */
  /**
   * Buka tutup dari posisinya sekarang (entrance_open). instant = langsung
   * terbuka tanpa animasi, mis. hero di balik gerbang yang sudah dibuka pengunjung.
   */
  open: (instant?: boolean) => void;
  /** Angkat tutup sebagian (0–1 dari klip pembuka) selama kukusan masih tertutup. */
  setLid: (amount: number) => void;
  /** Tutup kembali (entrance_open diputar mundur); siomay yang terangkat diturunkan dulu. */
  close: () => void;
  /** Angkat siomay Original (hero_lift). */
  lift: () => void;
  /** Progress scroll hero 0–1 → kamera mendekat dan sedikit merendah. */
  setScroll: (progress: number) => void;
  /** Kembalikan putaran dari pengguna ke sudut awal. */
  resetView: () => void;
  /**
   * Pilih produk dari kontrol HTML: instance utamanya disorot dan bereaksi.
   * false jika kukusan belum terbuka atau tidak ada instance dengan produk itu.
   */
  select: (productId: string) => boolean;
  /** Lepas sorotan pilihan (kartu ditutup). */
  clearSelection: () => void;
  /** Titik tengah dan lebar satu siomay di kanvas (px CSS), untuk transisi antarbagian. */
  screenRect: (instanceId: string) => { x: number; y: number; width: number } | null;
  dispose: () => void;
};

export type Reaction = "hop" | "pop" | "wobble" | "flip";

/** Siomay yang dipilih atau disorot; x/y = titik puncaknya di kanvas (px CSS). */
export type FoodPick = {
  instanceId: string;
  productId: string;
  x: number;
  y: number;
  reaction: Reaction | null;
  via: "pointer" | "control";
};

type Options = {
  canvas: HTMLCanvasElement;
  /**
   * Kotak tempat kukusan dibingkai. Kanvasnya sendiri selebar hero, supaya
   * bagian model yang berputar keluar dari kotak ini tidak terpotong.
   */
  frame: HTMLElement;
  url: string;
  /** Logo asli untuk lencana kosong di badan kukusan. */
  logoUrl?: string | null;
  /** Komposisi ringkas (mobile): transisi lebih singkat. */
  compact: boolean;
  /**
   * false = hanya tampilan (mis. gerbang pembuka): tanpa seret, klik, hover,
   * atau kemiringan kursor; pemanggil yang menggerakkan tutup lewat setLid().
   */
  interactive?: boolean;
  /**
   * "open" (bawaan) = bingkai kamera memuat pose tertutup dan terbuka;
   * "closed" = hanya pose tertutup, kukusan mengisi bingkai (gerbang).
   */
  framing?: "open" | "closed";
  onOpening?: () => void;
  onOpened?: () => void;
  onClosing?: () => void;
  onClosed?: () => void;
  /** Kursor di atas tutup yang bisa diklik untuk menutup (x/y di kanvas); null = tidak. */
  onLidHover?: (point: { x: number; y: number } | null) => void;
  onLifted?: () => void;
  /** Isi kukusan: tempat, identitas menu, dan model penggantinya. */
  slots?: SteamerSlot[];
  /** Produk yang diwakili siomay bawaan kukusan (dipakai selama/jika varian gagal dimuat). */
  builtInProduct?: string;
  /** Siomay dipilih (klik/ketuk atau kontrol HTML); null = pilihan dilepas. */
  onSelect?: (pick: FoodPick | null) => void;
  /** Kursor di atas siomay (mouse saja); null = tidak ada. */
  onHover?: (pick: FoodPick | null) => void;
  /** Daftar instance dan produknya berubah (varian selesai dimuat). */
  onInstances?: (list: { instanceId: string; productId: string }[]) => void;
  /** Pengguna mulai menyeret atau memilih (untuk menyembunyikan petunjuk). */
  onInteract?: () => void;
  onContextLost?: () => void;
};

const ROOT = "kalili_steamer_root";
const CLIPS = ["entrance_open", "hero_lift", "ingredients_cycle"] as const;
const HERO = "dimsum_hero_root";
const SHELL = ["steamer_lid", "steamer_base", "brand_badge"];
const MAX_DPR = 1.75;
const FOV = 28;
/** Batas kemiringan mengikuti kursor: ±4°. */
const MAX_TILT = (4 * Math.PI) / 180;
const MAX_PITCH = 0.3;
const DRAG_YAW = 0.008;
const DRAG_PITCH = 0.004;
const AZIMUTH = -0.34;
const ELEVATION = 0.56;
const HOP_SECONDS = 0.7;
const HOP_HEIGHT = 0.02;
/** Reaksi siomay saat diklik, bergiliran: lompat-putar, meletup, kenyal, salto. */
const REACTIONS: Record<Reaction, number> = { hop: HOP_SECONDS, pop: 1.15, wobble: 0.95, flip: 0.85 };
const ORDER: Reaction[] = ["hop", "pop", "wobble", "flip"];
/** Angkat halus saat disorot kursor / saat dipilih (meter). */
const LIFT_HOVER = 0.003;
const LIFT_SELECTED = 0.005;

export async function createSteamerScene(options: Options): Promise<SteamerScene> {
  const noop = () => {};
  const {
    canvas, frame: frameEl, url, logoUrl, compact, interactive = true, framing = "open", slots = [], builtInProduct = "original",
    onOpening = noop, onOpened = noop, onClosing = noop, onClosed = noop, onLidHover = noop, onLifted = noop,
    onSelect = noop, onHover = noop, onInstances = noop, onInteract = noop, onContextLost = noop,
  } = options;
  const [THREE, { GLTFLoader }, { RoomEnvironment }] = await Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/environments/RoomEnvironment.js"),
  ]);
  type Object3D = InstanceType<typeof THREE.Object3D>;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  // Uap membuat loop berjalan terus selama kukusan terbuka; bayangan cukup
  // dihitung ulang saat model atau putarannya benar-benar berubah.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.82;

  const key = new THREE.DirectionalLight(0xffe9c8, 1.2);
  key.position.set(-0.55, 0.9, 0.5);
  key.target.position.set(0.04, 0.03, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 5;
  key.shadow.blurSamples = 8;
  key.shadow.bias = -0.0002;
  const shadowCamera = key.shadow.camera;
  shadowCamera.left = shadowCamera.bottom = -0.34;
  shadowCamera.right = shadowCamera.top = 0.34;
  shadowCamera.near = 0.1;
  shadowCamera.far = 3;
  shadowCamera.updateProjectionMatrix();
  const rim = new THREE.DirectionalLight(0xffd08a, 1.3);
  rim.position.set(0.6, 0.5, -0.8);
  scene.add(key, key.target, rim, new THREE.HemisphereLight(0xfff1dc, 0x8f6f4c, 0.3));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShadowMaterial({ color: 0x4a2a12, opacity: 0.28 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene.getObjectByName(ROOT);
  const clips = CLIPS.map((name) => gltf.animations.find((c) => c.name === name));
  if (!root || clips.some((c) => !c)) {
    renderer.dispose();
    pmrem.dispose();
    throw new Error("Model kukusan tidak memuat root atau klip animasi yang diharapkan.");
  }
  gltf.scene.traverse((object) => {
    const mesh = object as InstanceType<typeof THREE.Mesh>;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  // Pembungkus presentasi: satu-satunya yang diputar oleh seret dan pointer.
  const presentation = new THREE.Group();
  presentation.rotation.order = "YXZ";
  presentation.add(gltf.scene);
  scene.add(presentation);

  // Klip dijeda dan digeser lewat `time` (tanpa mixer.update(delta)), mengikuti
  // contoh integrasi bawaan aset: tiap klip punya target node sendiri.
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const actions = clips.map((clip) => {
    const action = mixer.clipAction(clip!);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    return { clip: clip!, action };
  });
  const progress = [0, 0, 0];
  const apply = () => {
    actions.forEach(({ clip, action }, i) => {
      action.reset().setLoop(THREE.LoopOnce, 1).setEffectiveWeight(1).play();
      action.clampWhenFinished = true;
      action.time = progress[i] * clip.duration;
      action.paused = true;
    });
    mixer.update(0);
    gltf.scene.updateMatrixWorld(true);
    renderer.shadowMap.needsUpdate = true;
  };

  // Bingkai kamera memuat gabungan pose tertutup dan terbuka (tutup bergeser ke
  // kanan-belakang, siomay terangkat), bukan hanya pose tertutup yang lebih kecil.
  const bounds = new THREE.Box3();
  const box = new THREE.Box3();
  for (const pose of framing === "closed" ? [[0, 0]] : [[0, 0], [1, 1]]) {
    progress[0] = pose[0];
    progress[1] = pose[1];
    apply();
    bounds.union(box.setFromObject(gltf.scene));
  }
  progress[0] = progress[1] = 0;
  apply();
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const centre = sphere.center.clone();

  // ---------- Isi kukusan ----------
  // Tiap siomay yang terlihat = satu instance (instanceId) yang mewakili satu
  // produk menu (productId). Identitasnya datang dari daftar slot, tidak pernah
  // dari urutan, warna, posisi layar, atau nama mesh.
  //
  // Tiap instance punya grup poros sendiri. Pendamping: grup baru di tempat
  // node aslinya (node dipindah ke dalamnya dengan transform nol), supaya isinya
  // bisa diganti model varian. Original di depan digerakkan klip (hero_lift
  // pada root-nya, ingredients_cycle pada isinya), maka isinya dipindah ke grup
  // poros di dalam root itu: klip tetap menulis node miliknya sendiri, dan
  // animasi isi hanya pernah menyentuh siomay Original tersebut.
  type Dimsum = {
    instanceId: string; productId: string; object: Object3D; content: Object3D[];
    /** Titik dasar saat istirahat di ruang root (untuk cincin pilihan). */
    base: InstanceType<typeof THREE.Vector3>;
    y: number; z: number; rx: number; turn: number; size: number;
    bottom: number; top: number; radius: number;
    start: number; kind: Reaction; landed: boolean; lift: number; liftGoal: number;
  };
  const toLocal = new THREE.Matrix4();
  const partBox = new THREE.Box3();
  /** Kotak isi poros dalam koordinat porosnya sendiri (tidak terpengaruh pose). */
  const measure = (item: Dimsum) => {
    const box = new THREE.Box3();
    item.object.updateWorldMatrix(true, true);
    const inverse = item.object.matrixWorld.clone().invert();
    item.object.traverse((object) => {
      const mesh = object as InstanceType<typeof THREE.Mesh>;
      if (!mesh.isMesh) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      box.union(partBox.copy(mesh.geometry.boundingBox!).applyMatrix4(toLocal.multiplyMatrices(inverse, mesh.matrixWorld)));
    });
    item.bottom = box.min.y;
    item.top = box.max.y;
    item.radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
    return box;
  };
  const heroNode = root.getObjectByName(HERO) ?? null;
  const items: Dimsum[] = [];
  const itemBySlot = new Map<SteamerSlot, Dimsum>();
  for (const slot of slots) {
    const node = root.getObjectByName(slot.node);
    if (!node?.parent) {
      console.warn(`[kalili] Tempat "${slot.node}" tidak ada di model kukusan; ${slot.instanceId} dilewati.`);
      continue;
    }
    const pivot = new THREE.Group();
    let content: Object3D[];
    if (node === heroNode) {
      content = [...node.children];
      for (const child of content) pivot.add(child);
      node.add(pivot);
    } else {
      pivot.position.copy(node.position);
      pivot.quaternion.copy(node.quaternion);
      pivot.scale.copy(node.scale);
      node.parent.add(pivot);
      pivot.add(node);
      node.position.set(0, 0, 0);
      node.quaternion.identity();
      node.scale.set(1, 1, 1);
      content = [node];
    }
    pivot.name = slot.instanceId;
    pivot.userData.instanceId = slot.instanceId;
    const item: Dimsum = {
      instanceId: slot.instanceId,
      // Tempat yang menunggu model varian tetap jujur: isinya siomay bawaan.
      productId: slot.variant ? builtInProduct : slot.productId,
      object: pivot, content,
      base: (node === heroNode ? node.position : pivot.position).clone(),
      y: pivot.position.y, z: pivot.position.z, rx: pivot.rotation.x, turn: pivot.rotation.y, size: pivot.scale.y,
      bottom: 0, top: 0, radius: 0, start: -1, kind: "hop", landed: true, lift: 0, liftGoal: 0,
    };
    measure(item);
    items.push(item);
    itemBySlot.set(slot, item);
  }
  const instances = () => items.map(({ instanceId, productId }) => ({ instanceId, productId }));
  const itemOf = (object: Object3D | null) => {
    for (let o = object; o; o = o.parent) {
      if (o.userData.instanceId) return items.find((item) => item.object === o) ?? null;
    }
    return null;
  };

  let reactions = 0;
  let hovered: Dimsum | null = null;
  let selected: Dimsum | null = null;
  const react = (item: Dimsum, kind: Reaction, start = performance.now()) => {
    item.kind = kind;
    item.start = start;
    item.landed = kind !== "pop";
  };
  const updateLifts = () => {
    for (const item of items) item.liftGoal = item === selected ? LIFT_SELECTED : item === hovered ? LIFT_HOVER : 0;
  };
  /** Pose satu siomay pada waktu t (0–1) dari reaksinya; t = 0 = istirahat (+ angkat). */
  const pose = (item: Dimsum, t: number) => {
    let y = 0;
    let rx = 0;
    let ry = 0;
    let sx = 1;
    let sy = 1;
    const out = 1 - Math.pow(1 - t, 3);
    if (item.kind === "hop") {
      y = Math.sin(t * Math.PI) * HOP_HEIGHT;
      ry = out * Math.PI * 2;
    } else if (item.kind === "pop") {
      // Meletup tinggi keluar dari kukusan, membesar di puncak, lalu mendarat
      // dengan pantulan pipih.
      const air = Math.min(1, t / 0.78);
      y = 4 * air * (1 - air) * HOP_HEIGHT * 4.6;
      ry = (1 - Math.pow(1 - air, 2)) * Math.PI * 4;
      sx = sy = 1 + Math.sin(air * Math.PI) * 0.38;
      if (t < 0.1) {
        const k = Math.sin((t / 0.1) * Math.PI) * 0.2;
        sy = 1 - k;
        sx = 1 + k * 0.6;
      } else if (t > 0.78) {
        const land = (t - 0.78) / 0.22;
        const k = Math.sin(land * Math.PI * 2) * 0.24 * (1 - land);
        sy = 1 - k;
        sx = 1 + k * 0.6;
      }
    } else if (item.kind === "wobble") {
      // Kenyal seperti puding: memipih dan memanjang bergantian, makin reda.
      const k = Math.sin(t * Math.PI * 6) * Math.pow(1 - t, 1.6);
      sy = 1 + k * 0.26;
      sx = 1 - k * 0.13;
      ry = Math.sin(t * Math.PI * 4) * 0.25 * (1 - t);
    } else {
      // Salto ke depan sambil melompat.
      const crouch = t < 0.14 ? Math.sin((t / 0.14) * Math.PI) * 0.18 : 0;
      sy = 1 - crouch;
      sx = 1 + crouch * 0.6;
      const air = Math.max(0, (t - 0.1) / 0.9);
      y = Math.sin(air * Math.PI) * HOP_HEIGHT * 2.6;
      rx = (air < 0.5 ? 4 * air * air * air : 1 - Math.pow(-2 * air + 2, 3) / 2) * Math.PI * 2;
    }
    const { object } = item;
    // Selalu dihitung dari pose istirahat yang disimpan: tidak ada penumpukan.
    // Skala ditahan di dasar siomay; salto berputar di sekitar titik tengahnya.
    const bottom = item.bottom * item.size;
    const centre = ((item.bottom + item.top) / 2) * item.size * sy;
    object.position.y = item.y + item.lift + y - bottom * (sy - 1) + centre * (1 - Math.cos(rx));
    object.position.z = item.z - centre * Math.sin(rx);
    object.rotation.x = item.rx + rx;
    object.rotation.y = item.turn + ry;
    object.scale.set(item.size * sx, item.size * sy, item.size * sx);
  };

  // Sorotan pilihan: cincin emas tipis di lantai kukusan, di bawah siomay yang
  // dipilih. Material bersama siomay tidak pernah diubah.
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 72),
    new THREE.MeshBasicMaterial({ color: 0xd99a37, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.renderOrder = 1;
  marker.visible = false;
  // Di luar root: tidak ikut terkena raycast pemilihan.
  gltf.scene.add(marker);
  const markerMaterial = marker.material as InstanceType<typeof THREE.MeshBasicMaterial>;
  const placeMarker = (item: Dimsum) => {
    // Lantai di bawah pose istirahat (gltf.scene dan root tanpa transform).
    marker.position.set(item.base.x, item.base.y + 0.0006, item.base.z);
    marker.scale.setScalar(item.radius * item.size * 1.12);
  };

  // Titik puncak siomay di kanvas, untuk kartu dan label nama.
  const top = new THREE.Vector3();
  const screenOf = (item: Dimsum) => {
    item.object.updateWorldMatrix(true, false);
    item.object.localToWorld(top.set(0, item.top, 0));
    top.project(camera);
    return { x: ((top.x + 1) / 2) * canvas.clientWidth, y: ((1 - top.y) / 2) * canvas.clientHeight };
  };
  const pickOf = (item: Dimsum, reaction: Reaction | null, via: FoodPick["via"]): FoodPick => ({
    instanceId: item.instanceId, productId: item.productId, reaction, via, ...screenOf(item),
  });

  // ---------- Uap ----------
  // Partikel GPU: tiap butir adalah gumpalan tekstur noise yang naik, melebar,
  // berputar pelan, lalu memudar. Gerak dihitung di shader dari waktu, jadi
  // tidak ada simulasi di CPU. Dua lapis: kepulan terus-menerus saat terbuka,
  // dan semburan sekali jalan saat tutup terangkat atau sajian dipilih.
  const basket = new THREE.Box3().setFromObject(root.getObjectByName("steamer_base") ?? root);
  const reach = (basket.max.x - basket.min.x + basket.max.z - basket.min.z) / 4;
  const steamOrigin = new THREE.Vector3(
    (basket.min.x + basket.max.x) / 2,
    basket.max.y - (basket.max.y - basket.min.y) * 0.2,
    (basket.min.z + basket.max.z) / 2,
  );
  const puffs = (() => {
    // Atlas 2×2 berisi empat gumpalan berbeda: noise berlapis × redaman radial.
    const cell = 128;
    const surface = document.createElement("canvas");
    surface.width = surface.height = cell * 2;
    const ctx = surface.getContext("2d")!;
    const image = ctx.createImageData(cell * 2, cell * 2);
    for (let c = 0; c < 4; c++) {
      const grid = 9;
      const lattice = Array.from({ length: (grid + 1) * (grid + 1) * 3 }, () => Math.random());
      const noise = (x: number, y: number, octave: number) => {
        const size = grid >> octave || 1;
        const gx = x * size;
        const gy = y * size;
        const ix = Math.floor(gx);
        const iy = Math.floor(gy);
        const fx = gx - ix;
        const fy = gy - iy;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const at = (i: number, j: number) => lattice[(Math.min(j, grid) * (grid + 1) + Math.min(i, grid)) * 3 + octave];
        const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
        const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
        return top + (bottom - top) * sy;
      };
      const ox = (c % 2) * cell;
      const oy = Math.floor(c / 2) * cell;
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const u = x / cell;
          const v = y / cell;
          const r = Math.hypot(u - 0.5, v - 0.5) * 2;
          const fbm = noise(u, v, 2) * 0.5 + noise(u, v, 1) * 0.3 + noise(u, v, 0) * 0.2;
          const falloff = Math.max(0, 1 - r);
          const density = Math.max(0, Math.min(1, (fbm - 0.32) * 1.9)) * falloff * falloff * (3 - 2 * falloff);
          const index = ((oy + y) * cell * 2 + ox + x) * 4;
          image.data[index] = image.data[index + 1] = image.data[index + 2] = 255;
          image.data[index + 3] = Math.round(density * 255);
        }
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(surface);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  })();
  const sizeRange = renderer.getContext().getParameter(renderer.getContext().ALIASED_POINT_SIZE_RANGE) as Float32Array;
  const steamUniforms = {
    uTime: { value: 0 },
    uMap: { value: puffs },
    uScale: { value: 1 },
    uMaxSize: { value: sizeRange?.[1] || 256 },
    uOrigin: { value: steamOrigin },
    uRadius: { value: reach * 0.55 },
    uRise: { value: reach * 2.6 },
    uSize: { value: reach * 0.95 },
    uIntensity: { value: 0 },
    uBurstStart: { value: -100 },
    uBurstStrength: { value: 1 },
  };
  const steamVertex = /* glsl */ `
    attribute vec4 aSeed;
    uniform float uTime, uScale, uMaxSize, uRadius, uRise, uSize, uIntensity, uBurstStart, uBurstStrength;
    uniform vec3 uOrigin;
    varying float vAlpha;
    varying float vSpin;
    varying float vCell;
    void main() {
      #ifdef BURST
        // Semburan: tiap butir berangkat sedikit berselang lalu habis sekali.
        float life = (uTime - uBurstStart) / mix(1.6, 2.6, aSeed.y) - aSeed.x * 0.22;
        float strength = uBurstStrength;
        float rise = uRise * 1.25;
        float spread = 2.4;
      #else
        float life = fract(uTime * mix(0.13, 0.2, aSeed.y) + aSeed.x);
        float strength = uIntensity;
        float rise = uRise;
        float spread = 1.5;
      #endif
      float angle = aSeed.z * 6.2832;
      float r = sqrt(aSeed.w) * uRadius;
      // Naik cepat di awal lalu melambat saat uap mendingin dan bercampur udara.
      float lift = 1.0 - pow(1.0 - clamp(life, 0.0, 1.0), 1.7);
      float h = rise * lift;
      vec3 p = uOrigin;
      float rr = r * (1.0 + life * spread) + life * uRadius * 0.35;
      p.x += cos(angle) * rr;
      p.z += sin(angle) * rr;
      p.y += h;
      // Liukan merambat ke atas: butir di ketinggian sama bergerak serempak,
      // sehingga terbentuk gulungan, bukan bintik acak.
      float phase = h / uRise * 7.0 - uTime * 1.1;
      p.x += (sin(phase + aSeed.z * 2.0) * 0.6 + sin(phase * 2.3 + 1.7) * 0.25) * uRadius * 0.55 * lift;
      p.z += cos(phase * 0.8 + aSeed.w * 3.0) * uRadius * 0.4 * lift;
      p.x += lift * lift * uRise * 0.12;
      vec4 view = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * view;
      float size = uSize * mix(0.32, 1.25, sqrt(clamp(life, 0.0, 1.0))) * mix(0.7, 1.3, aSeed.y);
      gl_PointSize = min(uMaxSize, size * uScale / -view.z);
      float fade = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.42, 1.0, life));
      vAlpha = fade * strength * mix(0.45, 1.0, aSeed.w) * step(0.0, life) * step(life, 1.0);
      vSpin = aSeed.z * 6.2832 + life * (aSeed.y - 0.5) * 3.0;
      vCell = floor(aSeed.x * 3.999);
    }
  `;
  const steamFragment = /* glsl */ `
    uniform sampler2D uMap;
    varying float vAlpha;
    varying float vSpin;
    varying float vCell;
    void main() {
      if (vAlpha < 0.004) discard;
      vec2 q = gl_PointCoord - 0.5;
      if (dot(q, q) > 0.25) discard;
      float s = sin(vSpin), c = cos(vSpin);
      vec2 uv = vec2(c * q.x - s * q.y, s * q.x + c * q.y) + 0.5;
      vec2 cell = vec2(mod(vCell, 2.0), floor(vCell / 2.0));
      float density = texture2D(uMap, (cell + uv) * 0.5).a;
      // Cahaya palsu dari kiri atas: sisi bawah gumpalan sedikit lebih gelap,
      // memberi volume pada uap di atas latar terang.
      vec3 n = vec3(q.x * 2.0, -q.y * 2.0, 0.0);
      n.z = sqrt(max(0.0, 1.0 - dot(n.xy, n.xy)));
      float shade = 0.84 + 0.2 * max(0.0, dot(n, normalize(vec3(-0.45, 0.75, 0.5))));
      float a = density * vAlpha;
      if (a < 0.003) discard;
      gl_FragColor = vec4(vec3(1.0, 0.988, 0.965) * shade, min(1.0, a * 0.8));
    }
  `;
  const makeSteam = (count: number, burst: boolean) => {
    const geometry = new THREE.BufferGeometry();
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    // Butir kepulan dibagi rata sepanjang siklus supaya kolom uap tidak putus.
    if (!burst) for (let i = 0; i < count; i++) seeds[i * 4] = (i + Math.random() * 0.6) / count;
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const points = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: steamUniforms,
        vertexShader: steamVertex,
        fragmentShader: steamFragment,
        defines: burst ? { BURST: "" } : {},
        transparent: true,
        depthWrite: false,
      }),
    );
    points.frustumCulled = false;
    points.renderOrder = 2;
    gltf.scene.add(points);
    return points;
  };
  makeSteam(compact ? 54 : 90, false);
  makeSteam(compact ? 30 : 46, true);
  let steamGoal = 0;
  const burst = (strength: number, delay = 0) => {
    steamUniforms.uBurstStart.value = performance.now() / 1000 + delay;
    steamUniforms.uBurstStrength.value = strength;
    wake();
  };
  const steaming = (time: number) => steamGoal > 0 || steamUniforms.uIntensity.value > 0.002 || time < steamUniforms.uBurstStart.value + 3.2;

  // ---------- Meja saji ----------
  // Kukusan berdiri di atas baki pernis merah berlist emas, di tengah medali
  // ornamen emas yang berputar sangat pelan, dan debu emas berkilau di udara.
  // Semua di luar root: tidak bisa
  // dipilih, tetapi ikut berputar bersama kukusan (di dalam `presentation`).
  const TRAY = 0.142;
  const TRAY_DEPTH = 0.012;
  const decor: InstanceType<typeof THREE.Object3D>[] = [];
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x6a1414, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a548, metalness: 1, roughness: 0.26 });
  const tray = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [0, -TRAY_DEPTH], [TRAY - 0.007, -TRAY_DEPTH], [TRAY - 0.001, -TRAY_DEPTH + 0.004], [TRAY + 0.001, -0.002],
        [TRAY, 0.0045], [TRAY - 0.004, 0.005], [TRAY - 0.009, 0.0012], [TRAY - 0.014, 0], [0, 0],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      112,
    ),
    lacquer,
  );
  const trayRim = new THREE.Mesh(new THREE.TorusGeometry(TRAY - 0.002, 0.0017, 10, 160), gold);
  trayRim.rotation.x = -Math.PI / 2;
  trayRim.position.y = 0.0046;
  const inlay = new THREE.Mesh(new THREE.RingGeometry(0.1175, 0.1205, 128), gold);
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.y = 0.0004;
  decor.push(tray, trayRim, inlay);
  floor.position.y = -TRAY_DEPTH;

  // Medali lantai: tekstur kanvas, bukan gambar: cahaya hangat, cincin emas,
  // pita belah ketupat, dan delapan motif awan ruyi.
  const medallionMap = (() => {
    const size = 1024;
    const surface = document.createElement("canvas");
    surface.width = surface.height = size;
    const ctx = surface.getContext("2d")!;
    const c = size / 2;
    const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, "rgba(255, 240, 210, 0.75)");
    glow.addColorStop(0.55, "rgba(255, 232, 196, 0.35)");
    glow.addColorStop(1, "rgba(255, 232, 196, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(190, 128, 36, 0.62)";
    ctx.fillStyle = "rgba(190, 128, 36, 0.62)";
    const ring = (r: number, width: number, dash: number[] = []) => {
      ctx.setLineDash(dash);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(c, c, r * c, 0, Math.PI * 2);
      ctx.stroke();
    };
    ring(0.6, 3);
    ring(0.625, 1.5);
    ring(0.86, 1.5);
    ring(0.885, 3);
    ring(0.95, 2, [4, 14]);
    ctx.setLineDash([]);
    // Pita: belah ketupat dan titik bergantian.
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * 0.68 * c, c + Math.sin(a) * 0.68 * c);
      ctx.rotate(a + Math.PI / 4);
      ctx.lineWidth = 2;
      if (i % 2) ctx.strokeRect(-7, -7, 14, 14);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // Awan ruyi: tiga lengkung dan ekor, menghadap ke luar.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.save();
      ctx.translate(c + Math.cos(a) * 0.775 * c, c + Math.sin(a) * 0.775 * c);
      ctx.rotate(a + Math.PI / 2);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 14, Math.PI * 0.15, Math.PI * 1.85);
      ctx.moveTo(-12, -8);
      ctx.arc(-22, -4, 10, -Math.PI * 0.2, Math.PI * 1.1, true);
      ctx.moveTo(12, -8);
      ctx.arc(22, -4, 10, Math.PI * 1.2, Math.PI * -0.1);
      ctx.moveTo(-6, 13);
      ctx.quadraticCurveTo(0, 26, 10, 20);
      ctx.stroke();
      ctx.restore();
    }
    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  })();
  const medallion = new THREE.Mesh(
    new THREE.CircleGeometry(0.215, 96),
    new THREE.MeshBasicMaterial({ map: medallionMap, transparent: true, depthWrite: false, toneMapped: false }),
  );
  medallion.rotation.x = -Math.PI / 2;
  medallion.position.y = -TRAY_DEPTH + 0.0003;
  medallion.renderOrder = -1;

  for (const object of decor) {
    object.traverse((child) => {
      const mesh = child as InstanceType<typeof THREE.Mesh>;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }
  presentation.add(medallion, ...decor);

  // Debu emas: titik berkilau yang naik pelan di sekitar kukusan; muncul
  // bersama uap (intensitas dan waktu yang sama).
  const sparkleGeometry = new THREE.BufferGeometry();
  const sparkleCount = compact ? 36 : 64;
  const sparkleSeeds = new Float32Array(sparkleCount * 4);
  for (let i = 0; i < sparkleSeeds.length; i++) sparkleSeeds[i] = Math.random();
  sparkleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(sparkleSeeds, 4));
  sparkleGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sparkleCount * 3), 3));
  const sparkles = new THREE.Points(
    sparkleGeometry,
    new THREE.ShaderMaterial({
      uniforms: { uTime: steamUniforms.uTime, uIntensity: steamUniforms.uIntensity, uScale: steamUniforms.uScale },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime, uIntensity, uScale;
        varying float vAlpha;
        void main() {
          float life = fract(uTime * mix(0.03, 0.07, aSeed.y) + aSeed.x);
          float angle = aSeed.z * 6.2832 + uTime * 0.05;
          float radius = mix(0.12, 0.22, aSeed.w);
          vec3 p = vec3(cos(angle) * radius, -0.01 + life * 0.3, sin(angle) * radius);
          p.x += sin(uTime * 0.7 + aSeed.y * 9.0) * 0.008;
          vec4 view = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * view;
          float twinkle = pow(0.5 + 0.5 * sin(uTime * mix(1.5, 3.5, aSeed.z) + aSeed.w * 30.0), 2.0);
          gl_PointSize = mix(0.0045, 0.009, aSeed.y) * uScale / -view.z * (0.6 + twinkle * 0.6);
          vAlpha = uIntensity * (0.25 + twinkle * 0.75) * smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.7, 1.0, life));
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float d = length(q);
          if (d > 0.5 || vAlpha < 0.01) discard;
          // Inti terang + kilau silang tipis.
          float core = smoothstep(0.5, 0.0, d);
          float cross = max(smoothstep(0.06, 0.0, abs(q.x)), smoothstep(0.06, 0.0, abs(q.y))) * smoothstep(0.5, 0.1, d);
          float a = max(core * core, cross * 0.8) * vAlpha;
          gl_FragColor = vec4(mix(vec3(0.85, 0.58, 0.16), vec3(1.0, 0.93, 0.7), core), a);
        }
      `,
      transparent: true,
      depthWrite: false,
    }),
  );
  sparkles.frustumCulled = false;
  sparkles.renderOrder = 3;
  presentation.add(sparkles);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 10);
  const target = new THREE.Vector3();
  let scroll = 0;

  const render = () => {
    // Kamera: hanya dipengaruhi scroll. Mendekat dan merendah sedikit supaya isi
    // kukusan terbaca di atas bibir depan.
    const e = scroll * scroll * (3 - 2 * scroll);
    const vertical = (FOV * Math.PI) / 360;
    const half = Math.min(vertical, Math.atan(Math.tan(vertical) * camera.aspect));
    const distance = (sphere.radius / Math.sin(half)) * 0.9 * (1 - 0.24 * e);
    const elevation = ELEVATION - 0.14 * e;
    target.set(centre.x, centre.y - 0.012 + 0.014 * e, centre.z);
    camera.position.set(
      target.x + distance * Math.sin(AZIMUTH) * Math.cos(elevation),
      target.y + distance * Math.sin(elevation),
      target.z + distance * Math.cos(AZIMUTH) * Math.cos(elevation),
    );
    camera.lookAt(target);
    steamUniforms.uScale.value = camera.projectionMatrix.elements[5] * 0.5 * renderer.getContext().drawingBufferHeight;
    renderer.render(scene, camera);
  };

  // ---------- Loop sementara ----------
  // `shape` memetakan waktu 0–1 ke progress klip; default-nya linear (easing,
  // ancang-ancang, dan pendaratan sudah ada di dalam klip).
  type Tween = { index: number; seconds: number; start: number; shape: (t: number) => number; done?: () => void };
  let tween: Tween | null = null;
  let tiltX = 0;
  let tiltY = 0;
  let userYaw = 0;
  let userPitch = 0;
  let spin = 0;
  let dragging = false;
  let returning = false;
  let frame = 0;
  let lastTick = 0;
  let disposed = false;
  let interacted = false;
  let visible = true;
  let stage: "closed" | "opening" | "open" | "lifting" | "lifted" | "closing" = "closed";

  const tick = (now: number) => {
    frame = 0;
    if (disposed) return;
    const dt = Math.min(0.05, (now - lastTick) / 1000 || 0.016);
    lastTick = now;
    let moving = dragging;

    if (tween) {
      // Berbasis jam nyata, bukan jumlah frame: di perangkat lambat pun adegan
      // tetap selesai tepat waktu (frame dilewati, durasi tidak memanjang).
      const t = Math.min(1, (now - tween.start) / 1000 / tween.seconds);
      progress[tween.index] = tween.shape(t);
      apply();
      if (t >= 1) {
        const finished = tween;
        tween = null;
        finished.done?.();
      }
      moving = true;
    }
    // Siomay pendamping melompat dan berputar satu kali saat diklik.
    const kLift = 1 - Math.pow(0.0004, dt);
    for (const item of items) {
      let t = 0;
      let active = false;
      if (item.start >= 0) {
        t = Math.min(1, Math.max(0, (now - item.start) / 1000 / REACTIONS[item.kind]));
        active = true;
        // Siomay yang meletup mendarat dengan kepulan kecil.
        if (!item.landed && t > 0.8) {
          item.landed = true;
          burst(0.35);
        }
        if (t >= 1) {
          item.start = -1;
          t = 0;
        }
      }
      const gap = item.liftGoal - item.lift;
      if (Math.abs(gap) > 0.00002) {
        item.lift += gap * kLift;
        active = true;
      } else if (item.lift !== item.liftGoal) {
        item.lift = item.liftGoal;
        active = true;
      }
      if (active) {
        pose(item, t);
        moving = true;
      }
    }
    // Cincin pilihan memudar masuk/keluar.
    const ringGoal = selected ? 0.85 : 0;
    if (selected) placeMarker(selected);
    const ringGap = ringGoal - markerMaterial.opacity;
    if (Math.abs(ringGap) > 0.005) {
      markerMaterial.opacity += ringGap * (1 - Math.pow(0.002, dt));
      moving = true;
    } else markerMaterial.opacity = ringGoal;
    marker.visible = markerMaterial.opacity > 0.01;
    if (!dragging && Math.abs(spin) > 0.0004) {
      userYaw += spin;
      spin *= Math.pow(0.92, dt * 60);
      moving = true;
    }
    if (returning) {
      const k = 1 - Math.pow(0.001, dt);
      userYaw = Math.atan2(Math.sin(userYaw), Math.cos(userYaw));
      userYaw -= userYaw * k;
      userPitch -= userPitch * k;
      if (Math.abs(userYaw) < 0.002 && Math.abs(userPitch) < 0.002) {
        userYaw = 0;
        userPitch = 0;
        returning = false;
      } else moving = true;
    }
    // Putaran akhir = seret pengguna + kemiringan halus mengikuti kursor.
    const k = 1 - Math.pow(0.002, dt);
    const goalX = userPitch + tiltX;
    const goalY = userYaw + tiltY;
    const dx = goalX - presentation.rotation.x;
    const dy = goalY - presentation.rotation.y;
    if (dragging) {
      presentation.rotation.x = goalX;
      presentation.rotation.y = goalY;
    } else if (Math.abs(dx) > 0.0002 || Math.abs(dy) > 0.0002) {
      presentation.rotation.x += dx * k;
      presentation.rotation.y += dy * k;
      moving = true;
    }
    if (moving) renderer.shadowMap.needsUpdate = true;
    // Uap: kepulan menyusul targetnya perlahan, loop hidup selama masih ada uap
    // dan kanvas terlihat.
    const time = now / 1000;
    steamGoal = progress[0] > 0.3 ? 1 : 0;
    const intensity = steamUniforms.uIntensity;
    intensity.value += (steamGoal - intensity.value) * (1 - Math.pow(0.35, dt));
    if (Math.abs(steamGoal - intensity.value) < 0.002) intensity.value = steamGoal;
    // Medali lantai berputar sangat pelan selama kukusan terbuka.
    medallion.rotation.z += dt * 0.03 * intensity.value;
    steamUniforms.uTime.value = time;
    if (visible && steaming(time)) moving = true;
    render();
    if (moving) wake();
  };
  const wake = () => {
    if (frame || disposed) return;
    lastTick = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const open = (instant = false) => {
    if (stage !== "closed") return;
    stage = "opening";
    onOpening();
    if (instant) {
      tween = null;
      progress[0] = 1;
      apply();
      steamUniforms.uIntensity.value = 1;
      stage = "open";
      onOpened();
      wake();
      return;
    }
    // Lanjut dari posisi tutup sekarang (mis. sudah terangkat sebagian oleh
    // gerbang "tahan untuk membuka"); sisa durasi ikut memendek.
    const from = Math.min(progress[0], 0.95);
    const seconds = (compact ? 1.9 : 2.4) * Math.max(0.35, 1 - from);
    // Semburan uap tepat saat tutup lepas dari bibir kukusan.
    burst(1, from > 0.2 ? 0.05 : seconds * 0.28);
    tween = {
      index: 0, seconds, start: performance.now(), shape: (t) => from + (1 - from) * t,
      done: () => {
        stage = "open";
        onOpened();
      },
    };
    wake();
  };

  const touched = () => {
    if (interacted) return;
    interacted = true;
    onInteract();
  };

  // ---------- Pointer: seret memutar, klik memilih ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  /**
   * Bagian terdepan yang terkena sinar: poros satu siomay (mesh anak mana pun,
   * kulit, isi, atau taburan, berujung ke instance pemiliknya) atau tutup/badan
   * kukusan. Hanya hasil terdekat yang dipakai, jadi klik tidak tembus ke
   * siomay di belakangnya, dan tutup yang masih menutup menghalangi isinya.
   */
  const hit = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const found of raycaster.intersectObject(root, true)) {
      for (let o: Object3D | null = found.object; o && o !== root; o = o.parent) {
        if (o.userData.instanceId || SHELL.includes(o.name)) return o;
      }
    }
    return null;
  };
  const exposed = () => stage === "open" || stage === "lifted";
  const isLid = (object: Object3D | null) => object?.name === "steamer_lid";
  let lidHovered = false;
  const setLidHover = (point: { x: number; y: number } | null) => {
    if (!point && !lidHovered) return;
    lidHovered = Boolean(point);
    onLidHover(point);
  };
  // Menutup kembali: siomay Original yang terangkat turun dulu, lalu tutup
  // melayang pulang ke atas keranjang lewat klip pembuka yang diputar mundur.
  // Saat mendarat, sedikit uap lolos dari celahnya.
  const close = () => {
    if (!exposed()) return;
    const fromLifted = stage === "lifted";
    stage = "closing";
    selected = null;
    hovered = null;
    updateLifts();
    onSelect(null);
    onHover(null);
    setLidHover(null);
    onClosing();
    const shut = () => {
      tween = {
        index: 0, seconds: compact ? 1.1 : 1.4, start: performance.now(), shape: (t) => 1 - t,
        done: () => {
          stage = "closed";
          tiltX = tiltY = 0;
          burst(0.45, 0.05);
          onClosed();
        },
      };
    };
    if (fromLifted) tween = { index: 1, seconds: 0.5, start: performance.now(), shape: (t) => 1 - t, done: shut };
    else {
      tween = null;
      shut();
    }
    wake();
  };
  const setHover = (item: Dimsum | null) => {
    if (item === hovered) return;
    hovered = item;
    updateLifts();
    onHover(item ? pickOf(item, null, "pointer") : null);
    wake();
  };
  const choose = (item: Dimsum, kind: Reaction, via: FoodPick["via"]) => {
    // Posisi kartu diambil dari pose istirahat, sebelum reaksi dimulai.
    const pick = pickOf(item, kind, via);
    react(item, kind);
    selected = item;
    updateLifts();
    onSelect(pick);
    wake();
  };

  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  let pointerId = -1;
  let lastX = 0;
  let lastY = 0;
  let travelled = 0;
  let hoverPending = false;

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    setHover(null);
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    dragging = true;
    returning = false;
    spin = 0;
    travelled = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.dataset.dragging = "true";
    wake();
  };
  const onMove = (event: PointerEvent) => {
    if (dragging && event.pointerId === pointerId) {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      travelled += Math.abs(dx) + Math.abs(dy);
      userYaw += dx * DRAG_YAW;
      // Di layar sentuh, gerak vertikal dibiarkan untuk menggulir halaman.
      if (event.pointerType === "mouse") userPitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, userPitch + dy * DRAG_PITCH));
      spin = dx * DRAG_YAW;
      if (travelled > 6) touched();
      return;
    }
    if (event.pointerType !== "mouse" || hoverPending) return;
    // Kursor di atas bagian yang bisa diklik: beri tanda, dan saat kukusan masih
    // tertutup tutupnya "mengintip" sedikit (frame ancang-ancang klip pembuka).
    hoverPending = true;
    const { clientX, clientY } = event;
    requestAnimationFrame(() => {
      hoverPending = false;
      if (disposed) return;
      const found = hit(clientX, clientY);
      const food = exposed() ? itemOf(found) : null;
      const lid = exposed() && !food && isLid(found);
      const clickable = stage === "closed" ? Boolean(found) : Boolean(food) || lid;
      const was = canvas.dataset.hover === "true";
      canvas.dataset.hover = String(clickable);
      setHover(food);
      const rect = canvas.getBoundingClientRect();
      setLidHover(lid ? { x: clientX - rect.left, y: clientY - rect.top } : null);
      if (clickable && !was && stage === "closed" && !tween) {
        tween = { index: 0, seconds: 0.55, start: performance.now(), shape: (t) => Math.sin(t * Math.PI) * 0.075 };
        // Tutup yang mengintip melepas sedikit uap dari celahnya.
        burst(0.3, 0.12);
        wake();
      }
    });
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = -1;
    delete canvas.dataset.dragging;
    if (event.type === "pointercancel") {
      spin = 0;
      return;
    }
    if (travelled <= 6) {
      spin = 0;
      const found = hit(event.clientX, event.clientY);
      if (stage === "closed" && found) {
        // Mengeklik kukusan yang masih tertutup = membukanya.
        tween = null;
        progress[0] = 0;
        open();
        touched();
      } else if (exposed()) {
        const item = itemOf(found);
        if (item) {
          // Tiap klik memberi reaksi berikutnya dalam giliran; hanya membuka info.
          choose(item, ORDER[reactions++ % ORDER.length], "pointer");
          touched();
        } else if (isLid(found)) {
          // Mengeklik tutup yang sudah terbuka = menutup kukusan lagi.
          close();
          touched();
        } else if (selected) {
          // Klik di area kosong melepas pilihan.
          selected = null;
          updateLifts();
          onSelect(null);
        }
      }
    }
    wake();
  };
  // Kemiringan halus mengikuti kursor: hanya mouse, hanya setelah terbuka.
  const onWindowPointer = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || !fine.matches || dragging || stage === "closed" || stage === "opening" || stage === "closing") return;
    tiltY = (event.clientX / window.innerWidth - 0.5) * 2 * MAX_TILT;
    tiltX = (event.clientY / window.innerHeight - 0.5) * 2 * MAX_TILT * 0.6;
    wake();
  };
  if (interactive) {
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
  }
  const onLeave = () => {
    delete canvas.dataset.hover;
    setHover(null);
    setLidHover(null);
  };
  if (interactive) {
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointermove", onWindowPointer, { passive: true });
  }

  const fit = () => {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(width, height, false);
    // Kamera dibingkai untuk kotak panggung, lalu jendela pandangnya diperluas
    // ke seluruh kanvas: posisi dan ukuran kukusan tetap, tetapi area di luar
    // kotak ikut dirender.
    const outer = canvas.getBoundingClientRect();
    const inner = frameEl.getBoundingClientRect();
    const fw = inner.width || width;
    const fh = inner.height || height;
    camera.aspect = fw / fh;
    camera.setViewOffset(fw, fh, outer.left - inner.left, outer.top - inner.top, width, height);
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(fit);
  observer.observe(canvas);
  observer.observe(frameEl);
  // Uap berhenti mengepul (loop dihentikan) saat hero sudah lewat dari layar.
  const watcher = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
  });
  watcher.observe(canvas);
  const lost = (event: Event) => {
    event.preventDefault();
    onContextLost();
  };
  canvas.addEventListener("webglcontextlost", lost);

  // Lencana di badan kukusan sengaja kosong di aset; isi dengan logo asli.
  if (logoUrl) {
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      const surface = document.createElement("canvas");
      surface.width = 512;
      surface.height = 384;
      const ctx = surface.getContext("2d")!;
      ctx.fillStyle = "#f6ecd6";
      ctx.fillRect(0, 0, surface.width, surface.height);
      const scale = Math.min((surface.width * 0.86) / image.naturalWidth, (surface.height * 0.86) / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      ctx.drawImage(image, (surface.width - w) / 2, (surface.height - h) / 2, w, h);
      const texture = new THREE.CanvasTexture(surface);
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      gltf.scene.traverse((object) => {
        const mesh = object as InstanceType<typeof THREE.Mesh>;
        if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (!material.name.startsWith("Badge logo surface")) continue;
          const standard = material as InstanceType<typeof THREE.MeshStandardMaterial>;
          standard.map = texture;
          standard.color.set(0xffffff);
          standard.needsUpdate = true;
        }
      });
      render();
    };
    image.src = logoUrl;
  }

  fit();
  onInstances(instances());

  // ---------- Model varian ----------
  // Dimuat di latar setelah adegan siap; tidak pernah menahan apa pun. Satu
  // unduhan per file, lalu tiap tempat memakai salinan yang berbagi geometri
  // dan material (tidak ada yang mengubah material, jadi aman dibagi).
  const loader = new GLTFLoader();
  const sources = new Map<string, Promise<Object3D>>();
  const detached: Object3D[] = [];
  const sourceOf = (variant: NonNullable<SteamerSlot["variant"]>) => {
    let source = sources.get(variant.url);
    if (!source) {
      source = loader.loadAsync(variant.url).then((loaded) => {
        const model = loaded.scene.getObjectByName(variant.root);
        if (!model) throw new Error(`Root "${variant.root}" tidak ada di ${variant.url}`);
        model.traverse((object) => {
          const mesh = object as InstanceType<typeof THREE.Mesh>;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });
        return model;
      });
      sources.set(variant.url, source);
    }
    return source;
  };
  for (const slot of slots) {
    const item = itemBySlot.get(slot);
    if (!slot.variant || !item) continue;
    sourceOf(slot.variant)
      .then((source) => {
        if (disposed) return;
        // Ukuran disamakan dengan siomay bawaan yang digantikan (lebar terukur),
        // proporsi model dipertahankan; dasarnya diletakkan di lantai kukusan.
        const before = measure(item);
        const reference = Math.max(before.max.x - before.min.x, before.max.z - before.min.z);
        const model = source.clone(true);
        model.position.set(0, 0, 0);
        model.quaternion.identity();
        model.scale.set(1, 1, 1);
        const own = new THREE.Box3().setFromObject(model);
        const scale = reference / Math.max(own.max.x - own.min.x, own.max.z - own.min.z);
        model.scale.setScalar(scale);
        model.position.set(-((own.min.x + own.max.x) / 2) * scale, before.min.y - own.min.y * scale, -((own.min.z + own.max.z) / 2) * scale);
        for (const old of item.content) {
          item.object.remove(old);
          detached.push(old);
        }
        item.object.add(model);
        item.content = [model];
        item.productId = slot.productId;
        measure(item);
        pose(item, 0);
        renderer.shadowMap.needsUpdate = true;
        onInstances(instances());
        if (selected === item) onSelect(pickOf(item, null, "pointer"));
        wake();
      })
      .catch((error) => {
        // Tempat itu tetap menampilkan dan mewakili siomay bawaan; label tidak berubah.
        console.warn(`[kalili] Model ${slot.productId} untuk ${slot.instanceId} gagal dimuat; tempat ini tetap ${builtInProduct}.`, error);
      });
  }

  return {
    open,
    close,
    setLid: (amount: number) => {
      if (stage !== "closed") return;
      tween = null;
      progress[0] = Math.min(1, Math.max(0, amount));
      apply();
      wake();
    },
    lift: () => {
      if (stage !== "open") return;
      stage = "lifting";
      tween = {
        index: 1, seconds: compact ? 0.75 : 1, start: performance.now(), shape: (t) => t,
        done: () => {
          stage = "lifted";
          onLifted();
        },
      };
      wake();
    },
    setScroll: (value: number) => {
      scroll = Math.min(1, Math.max(0, value));
      if (!frame) render();
    },
    resetView: () => {
      spin = 0;
      returning = true;
      wake();
    },
    select: (productId: string) => {
      if (!exposed()) return false;
      const primary = slots.find((slot) => slot.primary && itemBySlot.get(slot)?.productId === productId);
      const item = (primary && itemBySlot.get(primary)) || items.find((candidate) => candidate.productId === productId);
      if (!item) return false;
      choose(item, "hop", "control");
      return true;
    },
    screenRect: (instanceId: string) => {
      const item = items.find((candidate) => candidate.instanceId === instanceId);
      if (!item) return null;
      item.object.updateWorldMatrix(true, false);
      const centre = item.object.localToWorld(new THREE.Vector3(0, (item.bottom + item.top) / 2, 0));
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(item.radius * item.size);
      const edge = centre.clone().add(right).project(camera);
      centre.project(camera);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      return {
        x: ((centre.x + 1) / 2) * w,
        y: ((1 - centre.y) / 2) * h,
        width: Math.abs(edge.x - centre.x) * w,
      };
    },
    clearSelection: () => {
      if (!selected) return;
      selected = null;
      updateLifts();
      wake();
    },
    dispose: () => {
      disposed = true;
      for (const old of detached) {
        old.traverse((object) => (object as InstanceType<typeof THREE.Mesh>).geometry?.dispose());
      }
      cancelAnimationFrame(frame);
      observer.disconnect();
      watcher.disconnect();
      window.removeEventListener("pointermove", onWindowPointer);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextlost", lost);
      mixer.stopAllAction();
      scene.traverse((object) => {
        const mesh = object as InstanceType<typeof THREE.Mesh>;
        if (!mesh.isMesh && !(object as InstanceType<typeof THREE.Points>).isPoints) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) value.dispose();
          }
          material.dispose();
        }
      });
      environment.dispose();
      puffs.dispose();
      medallionMap.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
