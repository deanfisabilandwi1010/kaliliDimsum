# Kalili Dimsum — separated ingredient asset

A real glTF 2.0 binary model, with an editable Blender source and a reversible
8-second ingredient animation. The initial exported pose is assembled.

## Files

- `kalili-dimsum-ingredients.glb`: web-delivery model; textures embedded.
- `kalili-dimsum-ingredients.blend`: editable meshes, packed textures and location keyframes.
- `ingredient-transforms.json`: assembled and exploded local transforms in glTF coordinates.
- `kalili-assembled.png` and `kalili-exploded.png`: transparent previews rendered from a re-imported GLB.
- `validation-report.json`: geometry, hierarchy and reassembly checks after Blender import.
- `gltf-validator-report.json`: Khronos glTF Validator output.
- `source/build_model.py`: deterministic Blender model builder and GLB animation writer.
- `source/make_textures.py`: procedural generation of the unlit image texture maps.
- `source/scroll-integration.js`: Three.js loading and reversible scroll scrubbing example.
- `textures/`: editable 512 × 512 PBR texture images; these are already packed into the deliverables.

## Design and reference

The open-top shumai in `Original.png` from the supplied `Menu 2(1).rar` guided
the ivory pleated wrapper, compact shape and central chopped topping.
This is a hand-parameterized stylized interpretation, not a 3D scan or exact
photogrammetric reconstruction. The similarly named `Dimsum Original.png`
shows a closed dumpling and was not used as the shape reference.

The meat/vegetable/carrot breakdown is illustrative and does not verify the
product's recipe. No additional ingredient species are represented.

## Structure

All five ingredient nodes are direct children of `kalili_dimsum_root`.

| Node | Triangles | Geometry |
| --- | ---: | --- |
| `wrapper_shell` | 15,040 | Continuous pleated cup, inner wall, rim and closed flat base |
| `meat_filling` | 10,528 | Complete rounded filling, including its hidden underside |
| `vegetable_pieces` | 1,836 | 17 green chopped pieces |
| `carrot_mix` | 2,376 | 22 diced pieces |
| `carrot_topping` | 9,504 | 88 small chopped topping pieces |
| **Total** | **39,284** | **Five independently transformable ingredient nodes** |

Several nodes contain multiple material primitives. A loader may represent
such a node as a group with child meshes. Move the named ingredient node,
not an arbitrary child primitive. Different ingredients are never fused.

The solid filling and chopped ingredients intentionally overlap internally,
as a food assembly. There is no void carved around each internal dice. The
wrapper is a continuous closed-volume sheet surrounding an open cavity;
its open mouth is not capped. The filling has no open hidden surfaces.

## Scale and axes

- GLB: Y up, X right, metres. Width is 0.060 m in the assembled state.
- Root: bottom centre of the assembled dimsum, identity scale.
- Local pivots: near each ingredient's centre; scales remain `[1,1,1]`.
- Blender source: Z up; the exporter converts this to glTF Y up.
- The JSON transforms use GLB axes, not Blender axes.
- Scale/position the whole asset using the root or an outer parent if needed.

## Animation

Clip: `assemble_explode_reassemble`, duration 8 seconds. Only translations
are animated. Counts, topology, materials, rotations and scales remain fixed.
The GLB uses CUBICSPLINE with zero endpoint tangents: smoothstep movement and
constant holds. Each ingredient returns along the same straight path.

| Time | State |
| --- | --- |
| 0.0–1.0 s | Assembled hold |
| 1.0–3.2 s | Smooth separation |
| 3.2–4.8 s | Exploded hold |
| 4.8–7.2 s | Smooth reassembly |
| 7.2–8.0 s | Assembled hold |

glTF does not define a universal playback loop flag. The clip includes
`extras.loop=false`; the application must configure non-looping playback
(for example `LoopOnce` in Three.js). For scroll, map progress 0–1 to time
0–8 seconds. Reset an action's paused state before backward scrubbing after
it reaches the end; the included integration helper does this.

If using the JSON transforms directly, stop the animation action first so
the mixer does not overwrite manual positions. The five nodes can then be
interpolated independently. Avoid animating individual ingredient counts or
scaling pieces during separation.

## Materials and lighting

All materials use nonmetallic metallic–roughness PBR. Subtle texture and
normal detail are image maps; no runtime procedural shader is required.
Tangents are exported for consistent normal mapping. There are no external
texture references, lighting objects, cameras, backgrounds or props in the GLB.

Use soft neutral lighting or a studio environment. The model is physically
small: nearby high-power point/area lights can wash out its natural colors.
Transparent previews contain no baked background or ground plane. Preview
lighting is not stored in the model textures.

## Rebuild

1. Install Python dependencies `numpy`, `scipy` and `Pillow` for texture creation.
2. Run `python source/make_textures.py` if changing texture generation.
3. Run `blender --background --threads 4 --python source/build_model.py` with Blender 4.5 LTS.

The builder regenerates the GLB, packed `.blend`, transform JSON, validation
report and previews. It is destructive only to those generated outputs in
this folder; retain a copy before hand-editing the source `.blend`.

The `.blend` contains editable per-object location actions. The builder adds
the named unified GLB clip explicitly after export. Re-exporting manually
from Blender requires configuring animation tracks/clips to preserve that
single clip name and the 8-second range.

## Validation scope

The supplied reports record final structural validation and Blender
re-import. Every ingredient volume is closed after welding duplicated UV
seam vertices for diagnosis. Moving the filling leaves the four other
ingredient nodes unchanged. The first and last imported poses match exactly.

These checks validate the asset. Final website lighting, scroll integration
and frame rate on target phones still depend on the application and device.
