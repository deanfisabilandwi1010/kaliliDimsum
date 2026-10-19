# Kalili Interactive Steamer

Actual multi-part glTF 2.0 binary asset for an interactive entrance sequence:
closed steamer → open lid → raised hero → ingredient exploration.

## Deliverables

- `kalili-interactive-steamer.glb`: complete self-contained model and three clips.
- `kalili-interactive-steamer.blend`: editable meshes, packed textures, shared supporting-food mesh and native NLA actions.
- `state-transforms.json`: all four states, clip keyframes and exact local transforms in glTF coordinates.
- Four `kalili-steamer-*.png` files: transparent previews rendered from the exported and re-imported GLB.
- `validation-report.json`: hierarchy, geometry, independence, reassembly and sampled motion-clearance results.
- `gltf-validator-report.json`: Khronos glTF Validator output.
- `source-validation.json`: packed-image checks and verified native Blender NLA states.
- `source/`: reproducible builder, verification/render script, texture generator, source hero model and example Three.js controller.
- `textures/`: editable food and bamboo images. No external images are needed to load the GLB or the packed Blender source.

## Appearance and reference

The supplied website screenshot guided honey bamboo, warm ivory food and
restrained oxblood details. The original open-top Kalili shumai reference
guided the food shape. This is a stylized modeled interpretation, not a scan.

The lid has real interlaced bamboo strip geometry, a fitting rim and a modeled
arch handle. The basket has a modeled interior, inner rim and woven base.
There are five shumai: one detailed hero at the front and four lighter supports.
The four supports share one mesh resource and use different rotations.

The ingredient breakdown is illustrative and does not verify Kalili's recipe.
The asset has no logo, lettering, steam geometry, background, floor, lights or
cameras. The preview studio is not exported. The badge is intentionally blank.

## Hierarchy

| Parent | Direct children |
| --- | --- |
| `kalili_steamer_root` | `steamer_base`, `steamer_lid`, `brand_badge`, `dimsum_hero_root`, `dimsum_support_01` through `dimsum_support_04` |
| `dimsum_hero_root` | `wrapper_shell`, `meat_filling`, `vegetable_pieces`, `carrot_mix`, `carrot_topping` |

Some nodes have multiple material primitives. Depending on the loader, these
may appear as a named group containing meshes. Transform the named ingredient
or parent node, rather than an arbitrary material primitive.

The hero retains **25,206 triangles** across five independent, closed ingredient
meshes. The complete scene draws **69,106 triangles**, including all four support
instances. The wrapper has an inner surface, modeled thickness and a closed
bottom beneath its open mouth. All normally hidden filling surfaces are modeled.

## Axes and scale

- glTF: Y-up, metres. The front of the basket faces +Z.
- Root: bottom-centre of the basket, with positive identity scale.
- Basket body height: 0.056 m. Closed lid diameter: about 0.216 m.
- Hero width: about 0.060 m. Supporting food width: about 0.0546 m.
- Hero root rises vertically from Y = 0.010 m to Y = 0.038 m: a 0.028 m lift, exactly half the basket body height.
- The Blender source uses Z-up; export converts to glTF Y-up.
- The lid opens toward the right and rear to preserve a clear view of the hero and exploded ingredients.

## Animation clips

| Clip | Duration | Animated nodes |
| --- | ---: | --- |
| `entrance_open` | 2.4 s | Only `steamer_lid`: translation and rotation |
| `hero_lift` | 1.0 s | Only `dimsum_hero_root`: translation |
| `ingredients_cycle` | 8.0 s | Only the five hero ingredient nodes: translation |

The tracks have no competing targets. Geometry, ingredient counts, materials
and scales remain constant. glTF uses CUBICSPLINE with zero key tangents for
predictable holds and eased movement. Rotation values are normalized quaternions.
The entrance includes a small preparatory motion and restrained settling into
a final 20-degree lid tilt; the bamboo never deforms.

`ingredients_cycle` holds assembled for 0–1 s, separates over 1–3.2 s,
holds exploded for 3.2–4.8 s, reassembles over 4.8–7.2 s, and holds assembled
for 7.2–8 s. First and last local poses are exactly identical.

glTF has no universal playback-loop setting. Each clip includes `extras.loop=false`;
configure `LoopOnce` or the equivalent in the application. Hold the lid and hero
at their final poses before starting ingredient exploration. Do not begin the
ingredient clip while the lid is closed or while the hero is still resting.

`source/three-integration.js` provides explicit state changes and reversible
scrubbing without competing tracks. Its asset-loading and controller code is
an integration example; this delivery does not include a deployed website test.

For mobile and desktop, frame the union of open/exploded bounds rather than
fitting only the smaller closed pose. A slightly lower camera for hero inspection
helps the raised food read clearly above the front rim. Steam should be a separate,
lightweight website effect triggered after the lid begins lifting.

## Original logo application

The `brand_badge` has a flat, cream logo surface with UV coordinates and a thin
oxblood border. Replace the base-color map on the material whose name begins
`Badge logo surface` using the actual original logo, or attach a decal just in
front of that face. Avoid coplanar decal geometry. No logo has been recreated.

## Blender editing and rebuilding

The main `.blend` is saved in the closed entrance pose. Its native NLA timeline
demonstrates the sequence at 30 fps: lid frames 0–72, hero 72–102, and ingredients
102–342. The GLB contains the three independent clips with the durations above.

The base has a non-destructive Triangulate modifier for portable tangent export;
the underlying bamboo mesh remains editable. Food textures are packed in the
hero source, and all required textures are packed in the main source.

To regenerate:

1. If editing bamboo texture generation, run `python source/make_bamboo_textures.py` with numpy, scipy and Pillow installed.
2. Run `blender --background --threads 6 --python-exit-code 1 --python source/build_steamer.py` with Blender 4.5 LTS.
3. To re-render and inspect the existing GLB without rebuilding geometry, run `blender --background --threads 6 --python-exit-code 1 --python source/verify_render.py`.

The builder overwrites generated files in this folder. Keep a separate copy
before hand-editing the main `.blend`. Rebuilding uses `source/hero-source.blend`
and the builder parameters, not hand edits to the main output file.

## Verification scope

The final GLB's default transforms were checked directly against the closed
state before applying any animation or preview helper. It was then re-imported
into Blender. Hierarchy, sibling independence,
closed ingredient surfaces, embedded textures and exact ingredient reassembly
were checked. All scales remain positive. No steam simulation is included.

Motion clearance is checked against the basket, lid, badge and surrounding food
using BVH candidate pairs followed by triangle separating-axis tests: 19 samples
for the entrance, 11 for hero lifting, and 13 for ingredient separation. The
ingredient return follows the same path. Intended ingredient nesting and joins
inside a constructed bamboo object are excluded from external collision checks.

The supplied validation report records zero external intersections in those
samples. This is sampled geometric verification, not a claim of exhaustive
continuous collision proof or measured performance on every website/device.
The Khronos report may include informational notes for reserved UVs or tangents
on flat-color materials; these are not missing textures or animation errors.
