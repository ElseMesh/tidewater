# Vegetation static-model migration artifact

`tools/export-world.mjs` emits `vegetation-static-model-instance-set.json` and
two content-addressed GLBs under `vegetation-static-models/` as an **inactive
migration artifact**. The signed world package continues to use its existing
vegetation component and renderer paths.

The first exported category is coconut palms. Its near and far meshes come from
the same `buildPalmNear()` and `buildPalmFar()` builders used by Tidewater's
WebGPU path. The GLBs retain the three VEC4 per-vertex streams (`aVeg`, `aMat`,
and `aLobe`) and each instance retains the existing `iPos`/`iDat` values in the
generic eight-float `materialData` field. Placements are copied after scatter
has applied the palm group-lean adjustment.

The generic engine now supports a scale-independent world-distance LOD metric.
The exported palm transition band is set to the source WebGPU band's 112.8 m
to 127.2 m limits around its 120 m handoff. This uses the generic screen-door
transition curve, so it is still an approximation of the source smoothstep
curve. Shadow selection and the vegetation material graph also do not yet
reproduce the source path. Do not install this artifact into the signed world
package or remove either existing renderer path until both engine backends have
the complete renderer-neutral contract and matched AMD WebGPU/WebGL review
against the pre-split WebGPU reference.

Trees and shrubs are not included: their far representation is a view-dependent
octahedral impostor atlas with variant selection, view blending, reprojection,
and distance thinning. A static far mesh would not preserve that appearance.
The remaining finite vegetation categories also need their source meshes,
distance fades, and material inputs exported and validated.
