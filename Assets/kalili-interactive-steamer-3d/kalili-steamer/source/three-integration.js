// Example integration. Requires one consistent installed version of Three.js.
import { AnimationMixer, Box3, LoopOnce, MathUtils } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadKaliliSteamer(scene, url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene.getObjectByName('kalili_steamer_root');
  if (!root) throw new Error('Kalili steamer root is missing');
  scene.add(gltf.scene);
  const mixer = new AnimationMixer(gltf.scene);
  const names = ['entrance_open', 'hero_lift', 'ingredients_cycle'];
  const actions = names.map(name => {
    const clip = gltf.animations.find(c => c.name === name);
    if (!clip) throw new Error(`Missing animation: ${name}`);
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    return { clip, action };
  });
  const progress = [0, 0, 0];
  function apply() {
    actions.forEach(({ clip, action }, index) => {
      action.reset().setLoop(LoopOnce, 1).setEffectiveWeight(1).play();
      action.clampWhenFinished = true;
      action.time = progress[index] * clip.duration;
      action.paused = true;
    });
    mixer.update(0);
    gltf.scene.updateMatrixWorld(true);
  }
  function setProgress(entrance, hero, ingredients) {
    [entrance, hero, ingredients].forEach((v, i) => {
      if (v !== undefined) progress[i] = MathUtils.clamp(v, 0, 1);
    });
    apply();
  }
  function setState(state) {
    const poses = {
      closed: [0, 0, 0],
      open: [1, 0, 0],
      hero_lifted: [1, 1, 0],
      exploded: [1, 1, 0.5], // 4 seconds, within the exploded hold.
    };
    if (!poses[state]) throw new Error(`Unknown state: ${state}`);
    setProgress(...poses[state]);
  }
  setState('closed');
  return {
    root, mixer, setProgress, setState,
    lid: root.getObjectByName('steamer_lid'),
    hero: root.getObjectByName('dimsum_hero_root'),
    getBounds: () => new Box3().setFromObject(gltf.scene),
  };
}

// Drive entrance from click/tween: setProgress(0..1, 0, 0).
// After opening: setProgress(1, 0..1, 0).
// Ingredient scroll: setProgress(1, 1, scrollProgress).
// Do not also advance mixer.update(delta) when using this paused scrub helper.
// Add steam as a separate website effect; it is intentionally absent from the GLB.
