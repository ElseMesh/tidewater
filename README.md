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
- `source/wasm/fishing-rhythm.c` is the source for the signed fishing-rule
  extension. Build its bounded browser module with
  `node worlds/tidewater/tools/build-fishing-rhythm-wasm.mjs`; update the hash
  in `world-source.json` and regenerate `ASSET-INDEX.md` after source changes.

The asset catalogue is generated, not hand-edited. Exporter and format
validators live in ElseMesh. Run `npm run export:island` from an ElseMesh
checkout to regenerate `world-source.json`, `assets/`, the terrain validation
report, and `ASSET-INDEX.md`. Review generated package changes together with
the source edits. See [world repository layout and file definitions](../../docs/world-repository-layout.md)
for the shared package contract.
