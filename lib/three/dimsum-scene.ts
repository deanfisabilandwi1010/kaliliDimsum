// Adegan Three.js untuk model siomay yang bahannya bisa terurai.
// Seluruh modul three dimuat dinamis di dalam createDimsumScene, jadi tidak
// masuk bundel awal. Tidak ada loop render permanen: frame digambar saat
// progress scroll berubah, dan loop sementara hanya berjalan selama pengguna
// memutar model atau kamera sedang berpindah fokus.

export type DimsumScene = {
  /** Progress scroll 0–1 → waktu klip (progress × durasi). Tidak ada autoplay. */
  setProgress: (progress: number) => void;
  /** Dekatkan kamera ke satu bahan dan redupkan yang lain; null = kembali. */
  focus: (node: string | null) => void;
  /** Kembalikan putaran model ke sudut awal. */
  resetView: () => void;
  /** Putaran sambutan satu kali (inersia yang sama dengan seret), mis. saat pengunjung tiba. */
  nudge: (amount: number) => void;
  dispose: () => void;
};

/** dx/dy (meter): geser titik penunjuk dari pusat bahan, searah kanan/atas layar. */
export type DimsumLabel = { node: string; el: HTMLElement; dx?: number; dy?: number };

type Options = {
  canvas: HTMLCanvasElement;
  url: string;
  labels: DimsumLabel[];
  /** Bahan yang bisa dipilih lewat klik pada model. */
  parts: readonly string[];
  /** Elemen cincin di lantai; diposisikan di bawah model. */
  shadow?: HTMLElement | null;
  /** Elemen riak yang muncul di bahan setiap kali bahan dipilih. */
  ping?: HTMLElement | null;
  /** Dipanggil saat bahan diklik (atau null saat fokus dilepas oleh scroll/klik kosong). */
  onPick: (node: string | null) => void;
  /** Dipanggil sekali saat pengguna pertama kali memutar atau memilih. */
  onInteract: () => void;
  onContextLost: () => void;
};

const CLIP = "assemble_explode_reassemble";
const ROOT = "kalili_dimsum_root";
const MAX_DPR = 1.75;
// Kotak pandang (meter, ruang model) untuk pose utuh dan pose terurai. Arah
// dan sudut kamera tetap; hanya jaraknya yang mengikuti seberapa jauh bahan
// terpisah, supaya siomay utuh tampil besar dan pose terurai tetap muat.
const FRAME_ASSEMBLED = { targetY: 0.03, halfHeight: 0.05, halfWidth: 0.058 };
const FRAME_EXPLODED = { targetY: 0.08, halfHeight: 0.104, halfWidth: 0.104 };
// Tinggi node isi pada pose utuh dan terurai (ingredient-transforms.json).
const MEAT_Y = { assembled: 0.02041, exploded: 0.05874 };
const ELEVATION = (12 * Math.PI) / 180;
const FOV = 26;
const BASE_YAW = -0.32;
/** Total sudut putar (radian) yang ditempuh model sepanjang scroll section. */
const SCROLL_YAW = 0.95;
/** Kecepatan putar pelan (rad/dtk) saat satu bahan sedang difokuskan. */
const SHOWCASE_SPIN = 0.24;
const MAX_PITCH = 0.55;
const DRAG_YAW = 0.0085;
const DRAG_PITCH = 0.005;
/** Detik yang dibutuhkan kamera untuk berpindah ke/dari fokus bahan. */
const FOCUS_SECONDS = 0.7;
/** Detik untuk berpindah dari satu bahan ke bahan lain, dan untuk memudar. */
const SWITCH_SECONDS = 0.65;
const FADE_SECONDS = 0.45;
/** Opasitas bahan lain saat satu bahan difokuskan. */
const DIMMED = 0.14;

export async function createDimsumScene(options: Options): Promise<DimsumScene> {
  const { canvas, url, labels, parts, shadow, ping, onPick, onInteract, onContextLost } = options;
  const [THREE, { GLTFLoader }, { RoomEnvironment }] = await Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/environments/RoomEnvironment.js"),
  ]);
  type Object3D = InstanceType<typeof THREE.Object3D>;
  type Material = InstanceType<typeof THREE.Material>;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral menjaga warna bahan; ACES membuat kulit dan isi tampak pucat.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.92;
  // Bayangan nyata: bahan yang melayang menjatuhkan bayangan ke lantai dan ke
  // bahan di bawahnya, sehingga susunannya terbaca berlapis.
  renderer.shadowMap.enabled = true;
  // VSM memberi tepi bayangan yang lembut (shadow.radius).
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  // Pencahayaan studio netral yang lembut: modelnya kecil, lampu dekat yang
  // kuat akan membuat warnanya pucat.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.5;
  const key = new THREE.DirectionalLight(0xffe9c8, 1.15);
  key.position.set(-0.5, 0.85, 0.45);
  key.target.position.set(0, 0.06, 0);
  key.castShadow = true;
  // 1024 px dengan blur sedang: cukup lembut, tetap ringan di ponsel.
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 5;
  key.shadow.blurSamples = 8;
  key.shadow.bias = -0.0002;
  const shadowCamera = key.shadow.camera;
  shadowCamera.left = shadowCamera.bottom = -0.2;
  shadowCamera.right = shadowCamera.top = 0.2;
  shadowCamera.near = 0.1;
  shadowCamera.far = 3;
  shadowCamera.updateProjectionMatrix();
  // Cahaya tepi hangat dari belakang: garis terang tipis di lipatan kulit dan
  // tepi isi, yang memisahkan model dari latar.
  const rim = new THREE.DirectionalLight(0xffd08a, 1.55);
  rim.position.set(0.55, 0.5, -0.8);
  const rimLeft = new THREE.DirectionalLight(0xfff3df, 0.5);
  rimLeft.position.set(-0.7, 0.25, -0.5);
  scene.add(key, key.target, rim, rimLeft, new THREE.HemisphereLight(0xfff1dc, 0x8f6f4c, 0.26));
  // Lantai tak terlihat yang hanya menangkap bayangan.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.ShadowMaterial({ color: 0x4a2a12, opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.005, 10);

  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene.getObjectByName(ROOT);
  const clip = gltf.animations.find((c) => c.name === CLIP);
  if (!root || !clip) {
    renderer.dispose();
    pmrem.dispose();
    throw new Error("Model siomay tidak memuat root atau klip animasi yang diharapkan.");
  }
  // Model diputar lewat pembungkus ini; node bahan hanya digerakkan klip.
  const model = gltf.scene;
  model.rotation.order = "YXZ";
  scene.add(model);

  // Klip hanya digerakkan lewat setTime: tidak ada mixer.update(delta).
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  // Tiap bahan: materialnya dipisah (clone) agar bisa diredupkan sendiri, dan
  // radiusnya diukur sekali untuk menentukan jarak kamera saat difokuskan.
  type Mesh = InstanceType<typeof THREE.Mesh>;
  const ingredients = new Map<string, { object: Object3D; materials: Material[]; meshes: Mesh[]; radius: number; level: number }>();
  const box = new THREE.Box3();
  const sphere = new THREE.Sphere();
  for (const name of parts) {
    const object = root.getObjectByName(name);
    if (!object) continue;
    const materials: Material[] = [];
    const meshes: Mesh[] = [];
    object.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const list = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => m.clone());
      mesh.material = Array.isArray(mesh.material) ? list : list[0];
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      materials.push(...list);
      meshes.push(mesh);
    });
    box.setFromObject(object).getBoundingSphere(sphere);
    // level = opasitas saat ini (1 penuh); dianimasikan sendiri per bahan.
    ingredients.set(name, { object, materials, meshes, radius: Math.max(sphere.radius, 0.012), level: 1 });
  }

  const tracked = labels.flatMap(({ node, el, dx = 0, dy = 0 }) => {
    const object = root.getObjectByName(node);
    return object ? [{ object, el, dx, dy }] : [];
  });
  const meat = root.getObjectByName("meat_filling");
  const point = new THREE.Vector3();
  const baseTarget = new THREE.Vector3();
  const focusTarget = new THREE.Vector3();
  const partCentre = new THREE.Vector3();
  // Titik dan jarak fokus saat perpindahan dimulai (untuk meluncur antar-bahan).
  const fromCentre = new THREE.Vector3();
  let fromNear = 0;
  let currentNear = 0;
  let switchAmount = 1;
  let pinging = false;
  const target = new THREE.Vector3();
  const tanHalfFov = Math.tan((FOV * Math.PI) / 360);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const ease = (t: number) => t * t * (3 - 2 * t);
  let width = 1;
  let height = 1;

  // Keadaan interaksi.
  let focused: string | null = null;
  let shownFocus: string | null = null;
  let focusAmount = 0;
  let spin = 0;
  // Putaran dari pengguna, terpisah dari putaran yang mengikuti scroll.
  let userYaw = 0;
  let userPitch = 0;
  let dragging = false;
  let returning = false;
  let frame = 0;
  let lastTick = 0;
  let lastProgress = 0;
  let focusProgress = 0;
  let interacted = false;
  let disposed = false;

  const toScreen = (v: InstanceType<typeof THREE.Vector3>) => {
    v.project(camera);
    return [(v.x * 0.5 + 0.5) * width, (-v.y * 0.5 + 0.5) * height] as const;
  };

  const render = () => {
    // Model berputar pelan mengikuti scroll (seperti meja putar), ditambah
    // putaran dari pengguna; lampu utama ikut menyapu dari kiri ke kanan.
    model.rotation.set(userPitch, BASE_YAW + (lastProgress - 0.5) * SCROLL_YAW + userYaw, 0);
    key.position.x = mix(-0.65, 0.45, lastProgress);

    // Seberapa jauh bahan terpisah (0 utuh, 1 terurai), dibaca dari pose model
    // sendiri sehingga kamera selalu sinkron dengan animasi, maju maupun mundur.
    const spread = meat
      ? Math.min(1, Math.max(0, (meat.position.y - MEAT_Y.assembled) / (MEAT_Y.exploded - MEAT_Y.assembled)))
      : 1;
    const halfHeight = mix(FRAME_ASSEMBLED.halfHeight, FRAME_EXPLODED.halfHeight, spread);
    const halfWidth = mix(FRAME_ASSEMBLED.halfWidth, FRAME_EXPLODED.halfWidth, spread);
    let distance = Math.max(halfHeight / tanHalfFov, halfWidth / (tanHalfFov * camera.aspect)) * 1.12;
    baseTarget.set(0, mix(FRAME_ASSEMBLED.targetY, FRAME_EXPLODED.targetY, spread), 0);
    target.copy(baseTarget);

    // Fokus bahan: kamera meluncur ke pusat bahan dan mendekat. Saat berpindah
    // dari satu bahan ke bahan lain, titik dan jarak fokus meluncur dari posisi
    // lama (fromCentre/fromNear) ke yang baru, jadi setiap klik punya gerak.
    const amount = ease(focusAmount);
    const part = shownFocus ? ingredients.get(shownFocus) : undefined;
    if (part && amount > 0) {
      model.updateMatrixWorld(true);
      box.setFromObject(part.object).getCenter(partCentre);
      const near = (part.radius / tanHalfFov / Math.min(1, camera.aspect)) * 1.75;
      const glide = ease(switchAmount);
      focusTarget.copy(fromCentre).lerp(partCentre, glide);
      currentNear = mix(fromNear, near, glide);
      target.lerp(focusTarget, amount);
      // Sedikit menjauh di tengah perpindahan, seperti kamera yang berayun.
      const swing = 1 + Math.sin(glide * Math.PI) * 0.14;
      distance = mix(distance, Math.min(distance, currentNear * swing), amount);
    }
    for (const { materials, meshes, level } of ingredients.values()) {
      for (const material of materials) {
        material.transparent = level < 0.999;
        material.opacity = level;
        material.depthWrite = level > 0.5;
      }
      // Bahan yang memudar tidak lagi menjatuhkan bayangan penuh.
      for (const mesh of meshes) mesh.castShadow = level > 0.5;
    }

    camera.position.set(target.x, target.y + distance * Math.sin(ELEVATION), target.z + distance * Math.cos(ELEVATION));
    camera.lookAt(target);
    renderer.render(scene, camera);

    for (const { object, el, dx, dy } of tracked) {
      object.getWorldPosition(point);
      point.x += dx;
      point.y += dy;
      const [x, y] = toScreen(point);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
    if (shadow) {
      const [x, y] = toScreen(point.set(0, 0, 0));
      const [edge] = toScreen(point.set(0.034, 0, 0));
      shadow.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      shadow.style.width = `${(Math.abs(edge - x) * 2.7).toFixed(1)}px`;
      shadow.style.opacity = String(1 - amount);
    }
    // Riak di titik bahan yang baru dipilih; atribut diganti agar animasi CSS
    // diputar ulang pada setiap pilihan.
    if (pinging && ping && part) {
      pinging = false;
      const [x, y] = toScreen(point.copy(partCentre));
      ping.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      ping.dataset.hit = ping.dataset.hit === "a" ? "b" : "a";
    }
  };

  // Loop sementara: hidup hanya selama ada yang masih bergerak.
  const tick = (now: number) => {
    frame = 0;
    if (disposed) return;
    const dt = Math.min(0.05, (now - lastTick) / 1000 || 0.016);
    lastTick = now;
    let moving = dragging;

    const goal = focused ? 1 : 0;
    if (focusAmount !== goal) {
      const step = dt / FOCUS_SECONDS;
      focusAmount = goal > focusAmount ? Math.min(goal, focusAmount + step) : Math.max(goal, focusAmount - step);
      if (focusAmount === 0) shownFocus = null;
      moving = true;
    }
    if (switchAmount < 1) {
      switchAmount = Math.min(1, switchAmount + dt / SWITCH_SECONDS);
      moving = true;
    }
    // Tiap bahan memudar/muncul sendiri menuju targetnya (silang-pudar saat berpindah).
    for (const [name, item] of ingredients) {
      const goalLevel = focused && name !== focused ? DIMMED : 1;
      if (item.level === goalLevel) continue;
      const step = dt / FADE_SECONDS;
      item.level = goalLevel > item.level ? Math.min(goalLevel, item.level + step) : Math.max(goalLevel, item.level - step);
      moving = true;
    }
    if (!dragging && Math.abs(spin) > 0.0004) {
      userYaw += spin;
      spin *= Math.pow(0.92, dt * 60);
      moving = true;
    }
    // Bahan yang difokuskan dipamerkan: model berputar pelan dengan sendirinya.
    if (focused && !dragging && !returning) {
      userYaw += SHOWCASE_SPIN * dt;
      moving = true;
    }
    if (returning) {
      const k = 1 - Math.pow(0.001, dt);
      // Kembali lewat jalur terpendek, berapa pun putaran yang sudah ditempuh.
      userYaw = Math.atan2(Math.sin(userYaw), Math.cos(userYaw));
      userYaw -= userYaw * k;
      userPitch -= userPitch * k;
      if (Math.abs(userYaw) < 0.002 && Math.abs(userPitch) < 0.002) {
        userYaw = 0;
        userPitch = 0;
        returning = false;
      } else moving = true;
    }
    render();
    if (moving) wake();
  };
  const wake = () => {
    if (frame || disposed) return;
    lastTick = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const focus = (node: string | null) => {
    const next = node && ingredients.has(node) ? node : null;
    if (next) {
      const item = ingredients.get(next)!;
      if (shownFocus && shownFocus !== next && focusAmount > 0) {
        // Berpindah bahan: mulai meluncur dari titik fokus yang sedang tampil.
        fromCentre.copy(focusTarget);
        fromNear = currentNear;
        switchAmount = 0;
      } else if (!shownFocus || focusAmount === 0) {
        model.updateMatrixWorld(true);
        box.setFromObject(item.object).getCenter(fromCentre);
        fromNear = (item.radius / tanHalfFov / Math.min(1, camera.aspect)) * 1.75;
        switchAmount = 1;
      }
      shownFocus = next;
      focusProgress = lastProgress;
      pinging = true;
    }
    focused = next;
    wake();
  };

  const touched = () => {
    if (interacted) return;
    interacted = true;
    onInteract();
  };

  // ---------- Putar dengan seret, pilih dengan klik ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pick = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const hit of raycaster.intersectObject(root, true)) {
      for (let o: Object3D | null = hit.object; o && o !== root; o = o.parent) {
        if (ingredients.has(o.name)) return o.name;
      }
    }
    return null;
  };

  let pointerId = -1;
  let lastX = 0;
  let lastY = 0;
  let travelled = 0;
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
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
    if (!dragging || event.pointerId !== pointerId) {
      // Kursor mouse di atas bahan: tunjukkan bahwa bahan bisa diklik.
      if (event.pointerType === "mouse") canvas.dataset.hover = String(Boolean(pick(event)));
      return;
    }
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    travelled += Math.abs(dx) + Math.abs(dy);
    userYaw += dx * DRAG_YAW;
    // Di layar sentuh, gerak vertikal dibiarkan untuk menggulir halaman.
    if (event.pointerType === "mouse") {
      userPitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, userPitch + dy * DRAG_PITCH));
    }
    spin = dx * DRAG_YAW;
    if (travelled > 6) touched();
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
      // Klik tanpa menyeret: pilih bahan, atau lepas fokus bila mengenai ruang kosong.
      spin = 0;
      const name = pick(event);
      focus(name === focused ? null : name);
      onPick(focused);
      touched();
    }
    wake();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  const fit = () => {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };

  const setProgress = (progress: number) => {
    const clamped = Math.min(1, Math.max(0, progress));
    // Menggulir lagi berarti kembali ke cerita: fokus bahan dilepas.
    // Ambang kecil: sisa perataan scrub sesaat setelah berhenti tidak dihitung.
    if (focused && Math.abs(clamped - focusProgress) > 0.012) {
      focus(null);
      onPick(null);
    }
    lastProgress = clamped;
    // LoopOnce menjeda action di frame terakhir; aktifkan lagi agar bisa mundur.
    action.enabled = true;
    action.paused = false;
    mixer.setTime(clamped * clip.duration);
    render();
  };

  const observer = new ResizeObserver(fit);
  observer.observe(canvas);
  const lost = (event: Event) => {
    event.preventDefault();
    onContextLost();
  };
  canvas.addEventListener("webglcontextlost", lost);
  fit();
  setProgress(0);

  return {
    setProgress,
    focus,
    resetView: () => {
      spin = 0;
      returning = true;
      wake();
    },
    nudge: (amount: number) => {
      returning = false;
      spin = amount;
      wake();
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      mixer.stopAllAction();
      scene.traverse((object) => {
        const mesh = object as InstanceType<typeof THREE.Mesh>;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) value.dispose();
          }
          material.dispose();
        }
      });
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
