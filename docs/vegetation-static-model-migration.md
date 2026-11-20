# Vegetation static-model migration artifact

`tools/export-world.mjs` emits `vegetation-static-model-instance-set.json` and
two content-addressed GLBs under `vegetation-static-models/` as an **inactive
migration artifact**. The signed world package continues to use its existing
vegetation component and renderer paths.

The first exported category is coconut palms. The far mesh is low detail and
the near mesh is high detail; both come from the same `buildPalmNear()` and
`buildPalmFar()` builders used by Tidewater's WebGPU path. The generic model-set
contract follows the common convention: LOD0 is highest detail, with increasing
indices becoming coarser. The sidecar stores near then far and follows the same
shadow LOD family with zero extra coarsening bias. The GLBs retain the three VEC4
per-vertex streams (`aVeg`, `aMat`, and `aLobe`) and each instance retains the
existing `iPos`/`iDat` values in the generic eight-float `materialData` field.
Placements are copied after scatter has applied the palm group-lean adjustment.

Tidewater authors the 120 m handoff and 112.8–127.2 m transition band in
`vegetation/LODRules.js`. The exported palm set uses the generic engine's
scale-independent world-distance metric and screen-door transition curve. Its
near model casts shadows to the authored 120 m limit; the source smoothstep fade
and actual shadow images still require matched review. A bounded material graph
describes palm albedo, roughness, underside tint, thin transmission, and
value-noise bark mottling for both engine compilers. It does not yet express the
full procedural bark relief, frond aging/variation, or plant wind deformation.
The sidecar is still inactive. Do not install it into the signed world package
or remove either existing renderer path until the complete renderer-neutral
contract and matched WebGPU/WebGL review against the pre-split WebGPU reference
pass.

The exporter now also emits an inactive near-model sidecar for trees and
shrubs. It contains the three tree and two shrub lobe variants as content-
addressed GLBs, preserves their three VEC4 source streams, and maps every
authored placement to a model variant with the same fractional seed-bin rule
used by the canopy atlas. The export now includes the source leaf-mask atlas as
a content-addressed linear RGBA8 data PNG, with its 2×2 tile layout and channel
semantics recorded beside the impostor atlases. This is still only geometry,
placement, and texture evidence: these GLBs use a provisional glTF PBR
material, are not referenced by a signed canopy component, and do not yet carry
the renderer-neutral canopy material graph. Do not activate this sidecar.

The exporter now joins the near set, both octahedral impostor atlases, the leaf
mask, appearance inputs, and LOD rules into
`vegetation-canopy-runtime-package.json`. Its component descriptor validates
through the ElseMesh codec and asset loader against the actual content-addressed
files. This package remains inactive and outside `world-source.json`: its near
GLBs still use provisional PBR, the complete canopy material graph is absent,
and neither engine backend consumes it. The far representation still requires
the view-dependent octahedral atlas with view blending, ray reprojection, wind,
and distance thinning. ElseMesh must implement both adapters and pass matched
review before replacing either current presenter. The remaining finite
vegetation categories also need their source meshes, distance fades, and
material inputs exported and validated.
