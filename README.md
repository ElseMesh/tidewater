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
- `experience.behaviors["elsemesh.fishing-game/1"].biteRateSchedule` authors
  bounded time-of-day multipliers for the shared browser fishing behavior. Its
  windows use 0.1-hour precision and include their start but exclude their end.
  Tidewater uses 1.4 from 05:00 through 08:00 and 17:00 through 20:00, 0.8
  before 05:00 and from 22:00 onward, and 1.0 at other times, preserving the
  previous behavior's 0.1-hour boundary precision.

The asset catalogue is generated, not hand-edited. Exporter and format
validators live in ElseMesh. Run `npm run export:island` from an ElseMesh
checkout to regenerate `world-source.json`, `assets/`, the terrain validation
report, and `ASSET-INDEX.md`. Review generated package changes together with
the source edits. See [world repository layout and file definitions](../../docs/world-repository-layout.md)
for the shared package contract.
