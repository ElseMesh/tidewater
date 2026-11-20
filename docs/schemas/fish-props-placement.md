# Static fish-prop placements

`elsemesh.fish-props-placement/1` is deterministic JSON placement data for the
current `elsemesh.static-fish-props/1` component. A signed component references
one content-addressed asset through `placementAssetId` and declares
`streamingBounds`. It is streamed at its declared priority;
the Example Island uses `visible` so a distant portal preview does not download
market contents prematurely.

Each record carries the original prop kind, species, world position and
quaternion, length, skin-pattern ID, deterministic seed, body bend/jaw
parameters, and four renderer flags. ElseMesh owns the current WebGPU and
WebGL adapters and fish shader, while the Tidewater provider supplies a
world-specific species and skin profile used to rebuild the geometry and
appearance. This trusted component is still migration debt: the signed
placement asset contains no species colors, material graph, geometry, textures,
collision, or procedural RNG state, so it cannot stand alone as portable world
content. Missing or non-finite seeds are rejected rather than replaced with
runtime randomness. One component may hold up to 20,000 records and its asset
is capped at 16 MiB.

The exporter also writes an inactive `static-model-instance-set/1` sidecar with
two GLB LODs per kind/species and the same material-data slots. Those GLBs use
white PBR materials plus `_ELSEMESH_VDATA`; they do not yet contain the fish
appearance graph or baked textures. The sidecar is not signed into the world
package, because switching to it now would lose the current fish shading. A
replacement must preserve that appearance through a bounded renderer-neutral
material graph or portable baked assets, then pass matched WebGPU/WebGL render
checks before the active component and fish-specific engine adapters are
removed.

Until that migration is complete, worlds requiring this component must be
rejected by clients that do not support it. Do not silently substitute
lower-fidelity generic PBR fish.
