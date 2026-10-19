# Kalili — Cheese Mentai and Black Series

Two standalone, assembled shumai assets for the existing Kalili interactive
steamer. Each GLB is actual multi-part glTF 2.0 geometry, with five independently
transformable mesh nodes beneath one root. No basket, props, camera, light rig,
background, logo, smoke, or text is included in either GLB.

## Files

| Asset | GLB | Editable source | Three-quarter preview |
|---|---|---|---|
| Cheese Mentai | `kalili-cheese-mentai.glb` | `kalili-cheese-mentai.blend` | `kalili-cheese-mentai-preview.png` |
| Black Series | `kalili-black-series.glb` | `kalili-black-series.blend` | `kalili-black-series-preview.png` |

Both files contain 13,858 triangles. Cheese Mentai is 1,834,464 bytes;
Black Series is 1,835,608 bytes. Each has three embedded 1024 × 1024 maps:
base color, tangent-space normal, and metallic–roughness. Metallic is zero.
The editable Blender files have the source texture images packed internally.

The geometry interprets the two supplied product photos in the stylized visual
language of the previously delivered Original. It is not a photogrammetry scan
or an exact reproduction of every photographic surface detail. The dark wrapper
does not imply any particular ingredient. Small physical surface details and
textured flecks illustrate toasting; no unsupported ingredient identity is added.

## Hierarchy

Cheese Mentai: `cheese_mentai_root` with direct children `wrapper_shell`,
`filling_core`, `mentai_cap`, `cheese_surface`, and `garnish_details`.

Black Series: `black_series_root` with direct children `wrapper_shell`,
`filling_core`, `topping_cap`, `cheese_surface`, and `garnish_details`.

Every child has closed, complete geometry, including its underside. The wrapper
is a continuous open-mouth cup with an inner wall and floor. Sauce/cheese and
filling intentionally nest into one another to keep the assembled surface
continuous. The default pose has all components assembled. There are no
animation clips in these static menu assets.

## Placement and manipulation

- GLB units are metres and Y-up. The front faces +Z, matching the existing steamer.
- Both models are 0.060 m wide, use positive unit scales, and have the root at the
  bottom-center in the same coordinate system as Original.
- Cheese Mentai is approximately 0.04182 m high; Black Series is 0.04221 m high.
  Their raised topping accounts for the small height increase over Original.
- Place a loaded variant root at local position `(0, 0, 0)`, rotation identity,
  scale `(1, 1, 1)` beneath the existing `dimsum_hero_root` anchor. Hide or remove
  the Original ingredient meshes first. The steamer anchor already provides the
  resting position; do not apply its translation a second time.
- Retain the existing hero anchor so `hero_lift` can continue to move the whole
  selected item. `entrance_open` remains independent because it targets the lid.
- Stop the Original `ingredients_cycle` while a menu variant is selected. Its
  ingredient names and trajectories belong to Original; these variants have
  different component names and do not supply an ingredient cycle.
- Look up component names beneath the selected variant root, not globally:
  multiple variants intentionally reuse names such as `wrapper_shell`.
- Store each child's initial position/quaternion/scale before interaction and
  restore those values for exact reassembly. `variant-manifest.json` also records
  the exported assembled transforms in GLB/Y-up coordinates.

Blender source coordinates are Z-up; Blender's glTF exporter converts them to
Y-up. No additional rotation is required when loading either GLB.

## Verification included

- Khronos glTF Validator: zero errors, zero warnings, zero informational issues
  for both final GLBs. Reports are included.
- Re-imported each final GLB in Blender and rendered those imported meshes.
- Verified all five children, independent motion and exact transform restoration,
  complete closed surfaces, outward normals, useful pivots, unit scales, flat
  bottom at zero, and 60 mm width.
- Independently decoded every embedded image and checked the GLB binary,
  indices, non-degenerate triangles, normals, and orthonormal tangent frames.
- Verified both editable `.blend` files and compared their three packed image
  payloads with the source maps.
- Placed each variant at the actual existing steamer hero anchor at scale 1.
  Tested five components against the basket, closed lid, badge, and four support
  dimsums: 35 mesh pairs per variant, zero external surface intersections.
- Inspected front, side, top, underside, and three-quarter views. The `qa/` folder
  includes same-light comparison with Original and cream/dark thumbnail checks
  in 120 px and 180 px image slots.

Validation covers the delivered assets and their placement in the existing
steamer model. Browser integration, application animation logic, and performance
on the target site's devices have not been measured in this task. Studio lights
and preview backgrounds are only used for the PNG/JPEG previews and are absent
from the delivered GLBs and editable asset scenes.

## Rebuild

The `source/` folder contains deterministic atlas generation, Blender modeling,
validation, and preview scripts. The baseline Original `.blend` and previously
delivered reference GLBs are included for reproducibility and fit checks.

Dependencies: Blender 4.5.3 LTS; Python with NumPy, SciPy, and Pillow. Generate
maps with `python source/make_atlases.py`, then run Blender in background with
`--python-exit-code 1 --python source/build_variants.py`. Verify using
`source/check_binary.py`, `source/verify_render.py`, `source/check_blend_source.py`,
and `source/check_steamer_fit.py`. `source/make_preview_boards.py` assembles the
contact sheets from the actual model renders.

All preview food pixels come from the exported 3D geometry. The user-supplied
product photos are used as references and are not projected onto image planes.
