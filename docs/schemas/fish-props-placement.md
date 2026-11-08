# Static fish-prop placements

`elsemesh.fish-props-placement/1` is deterministic JSON placement data for the
standard static fish-prop component. The world registers its component and
placement decoder and its WebGPU and WebGL backend adapters; ElseMesh selects
the registered renderer. A signed
`elsemesh.static-fish-props/1` component references one content-addressed asset
through `placementAssetId` and declares `streamingBounds`. The component is streamed at its declared priority;
the Example Island uses `visible` so a distant portal preview does not download
market contents prematurely.

Each record carries the original prop kind, species, world position and
quaternion, length, skin-pattern ID, deterministic seed, body bend/jaw
parameters, and four renderer flags. Tidewater's adapters rebuild fish
geometry and materials and submit them through the generic component registry;
ElseMesh supplies backend dispatch and scene rendering. Tidewater owns its fish
geometry and shader implementation under `fish/`. The asset does not contain executable shader code, geometry,
textures, collision, or procedural RNG state. Missing or non-finite seeds are
rejected rather than replaced with runtime randomness. One component may hold
up to 20,000 records and its asset is capped at 16 MiB.

The fish appearance therefore remains tied to this versioned trusted renderer
feature. A client that does not support `elsemesh.static-fish-props/1` must
reject the world through its required-feature check instead of silently
substituting lower-fidelity generic PBR fish.
