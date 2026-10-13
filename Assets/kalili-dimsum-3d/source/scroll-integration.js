// Integrate into an existing Three.js scene. No specific scroll library required.
// Requires Three.js and its GLTFLoader addon from the same installed version.
import { AnimationMixer, LoopOnce, MathUtils } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadKaliliDimsum(scene, url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  scene.add(gltf.scene);
  const root = gltf.scene.getObjectByName('kalili_dimsum_root');
  const clip = gltf.animations.find(c => c.name === 'assemble_explode_reassemble');
  if (!root || !clip) throw new Error('Kalili root or animation clip is missing.');
  const mixer = new AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  // Call this with scroll progress 0..1. Do not also advance mixer.update(delta).
  // Reset paused/enabled because LoopOnce clamps and pauses at the final frame.
  function setProgress(progress) {
    action.enabled = true;
    action.paused = false;
    mixer.setTime(MathUtils.clamp(progress, 0, 1) * clip.duration);
  }
  setProgress(0);

  const parts = Object.fromEntries([
    'wrapper_shell', 'meat_filling', 'vegetable_pieces',
    'carrot_mix', 'carrot_topping'
  ].map(name => [name, root.getObjectByName(name)]));

  return { root, parts, mixer, action, duration: clip.duration, setProgress };
}
