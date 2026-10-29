# Tidewater package checks

These checks belong to the Tidewater content repository. They cover authored
world data and Tidewater gameplay contracts against the ElseMesh runtime. The
runtime integration checks import engine code from the containing ElseMesh
checkout, so run them from that checkout with `npm test`. The engine test runner
preserves the Tidewater submodule path when it launches them, keeping imports
in the external build tree when testing there.

`fishing-rules.mjs` checks authored behavior data. The remaining checks cover
the exported package, Reef assets, terrain, vegetation, geometry LOD, village
material maps, whale assets, pier collision and height, vendor stands, boat
design and idle stability, and Tidewater fishing and boat gameplay in WebGPU
and WebGL. They run as part of the engine's `npm test` sequence while their
sources remain with the Tidewater package.

`life-player.mjs` adds a GPU-free smoke of island walking, swimming, boarding,
boat handling, and flying to the engine test sequence.

The optional Blender authoring checks use the Tidewater package as their source
fixture:

```sh
python3 worlds/tidewater/test/blender-world-actions.py
BLENDER_EXECUTABLE=/path/to/blender python3 worlds/tidewater/test/blender-world-actions-runtime.py
```

The manual scene review scripts also live here because their fixtures are the
Tidewater island, village, and pier. They use the shared engine headless harness
from the containing ElseMesh checkout:

```sh
node worlds/tidewater/test/world-all.mjs
node worlds/tidewater/test/world-village.mjs
node worlds/tidewater/test/taa-pier.mjs
```
