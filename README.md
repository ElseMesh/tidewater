# Tidewater world content

This repository contains the authored Tidewater Example Island as data and
content-addressed assets. It is not a standalone application or buildable game.
ElseMesh imports it at `worlds/tidewater`, validates its
`elsemesh.world-source/3` document, and serves its package assets to visitors.

## Repository map

- `world-source.json` is the canonical unsigned world layout: identity, spawn,
  rules, placed objects, portals, versioned components, and asset references.
  Its field definitions are in the [ElseMesh world-source schema](../../docs/schemas/world-source.schema.json).
- `presentation.json` contains editable title copy, tips, and loading-stage text
  that the exporter copies into the source document's `experience` field.
- `fishing.json` contains Tidewater's authored fish species and fishing behavior
  data. The exporter adds it to the versioned fishing behavior in the signed
  world experience.
- `register-behavior.js` owns Tidewater's behavior registrations and
  world-authored experience validation. The built-in package bootstrap loads
  it into ElseMesh's generic behavior registry.
- `FishingGameRuntime.js` owns Tidewater's browser-side fishing event protocol,
  bounded request queues, and Worker result handling. It is created through
  the registered behavior descriptor and is not part of the generic engine
  behavior registry.
- `FishTable.js`, `Gear.js`, and `GameState.js` own Tidewater's authored fish
  catalog validation/calculations, upgrade economy, inventory, fuel, and
  browser-local per-ThruHold save state. `test/game-hud.html` is the standalone
  HUD review page for this package.
- `BoatGameplayRuntime.js` adapts Tidewater's signed JavaScript Worker to the
  WebGPU and WebGL presentations. The Worker owns engine upgrades, fuel burn,
  persistence transitions, and fish-finder sampling; the client supplies
  bounded terrain/habitat samples and applies fuel/save/UI results.
  Frame-by-frame historical parity is checked in
  `test/pre-split-boat-gameplay-parity.mjs`.
- `assets/<sha256>` contains exact runtime package bytes. Filenames are SHA-256
  digests without extensions; use the [human-readable asset index](ASSET-INDEX.md)
  to find an asset by purpose, format, size, or world object.
- `source/audio/` contains source recordings and `CREDITS.md`.
- `source/models/debris/`, `source/models/props/`, and `source/models/whale/`
  contain model inputs, texture maps, buffers, and attribution. `props.json` /
  `props.bin` and `humpback.json` / `humpback.bin` are glTF JSON and binary
  buffers, with adjacent files supplying their textures.
- `lod-source/` contains lower-detail village and moored-boat GLB inputs used
  during export.
- `terrain-validation.json` records hashes, dimensions, encodings, and renderer
  roles for the exported terrain package.
- `fishing.json` authors the bounded `biteRateSchedule` under
  `experience.behaviors["elsemesh.fishing-game/1"]`. Tidewater's signed
  `extensions/fishing-game-rules.js` module validates them in its Worker and
  compiles the table consumed by the shared browser fishing runtime. It also
  owns catch-fight initialization, ordered frame steps, and cancellation; the
  client applies inventory changes and presents the returned state. See the
  [fishing bite schedule contract](docs/schemas/fishing-bite-schedule.md).
- `fishing.json`'s `fishCatalog` owns species names, habitats, weights, catch
  values, fight parameters, length relations, and model keys. The engine
  applies generic fishing calculations to this signed world data. See the
  [fish catalog contract](docs/schemas/fish-catalog.md).

The asset catalogue is generated, not hand-edited. The world exporter lives in
this repository and uses shared format tools from ElseMesh. Run
`npm --prefix worlds/tidewater run export` from an ElseMesh checkout to
regenerate `world-source.json`, `assets/`, the terrain validation
report, and `ASSET-INDEX.md`. Review generated package changes together with
the source edits. See [world repository layout and file definitions](../../docs/world-repository-layout.md)
for the shared package contract.
