# Tidewater world content

This repository contains the authored Tidewater example world as data and
content-addressed assets. It is not a standalone application or buildable game.
ElseMesh imports it as the `worlds/tidewater` Git submodule, validates its
`tidewater.world-source/1` document, and serves its package assets to visitors.

The package includes the world source and presentation, deterministic runtime
assets, LOD sources, and terrain validation report. `source/audio` and
`source/models` retain source recordings, scanned models, textures, and their
attribution. Runtime behavior is described by versioned world components;
ElseMesh implements and validates those behaviors.

The exporter and format validators live in the ElseMesh engine repository. Run
`npm run export:island` from an ElseMesh checkout to regenerate this package.
Changes to `world-source.json` and packaged bytes should be reviewed together.
