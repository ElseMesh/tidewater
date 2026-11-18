# Vegetation static-model migration artifact

`tools/export-world.mjs` emits `vegetation-static-model-instance-set.json` and
two content-addressed GLBs under `vegetation-static-models/` as an **inactive
migration artifact**. The signed world package continues to use its existing
vegetation component and renderer paths.

The first exported category is coconut palms. The far mesh is low detail and
the near mesh is high detail; both come from the same `buildPalmNear()` and
`buildPalmFar()` builders used by Tidewater's WebGPU path. ElseMesh's current
generic model-set contract orders assets from coarsest to finest, so the
sidecar stores far then near and points `shadowLod` at the near mesh. The GLBs retain the three VEC4
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

Trees and shrubs are not included: their far representation is a view-dependent
octahedral impostor atlas with variant selection, view blending, reprojection,
and distance thinning. A static far mesh would not preserve that appearance.
The remaining finite vegetation categories also need their source meshes,
distance fades, and material inputs exported and validated.
