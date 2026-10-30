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

`webgl-fish-props-adapter-build.mjs` checks WebGL fish-prop mesh construction
without a graphics context. `webgpu-fish-props-adapter-build.mjs` creates the
registered component with a headless WebGPU device and checks GPU buffer
creation and cleanup. Neither check renders pixels or measures FPS.

`webgl-shore-query-parity.mjs` compares WebGPU and WebGL against Tidewater's
packaged terrain and shoreline field, then records an 18-second underway boat
trace using FFT and shoreline inputs. That controlled trace omits interactive
wake and collision handling. Its headless WebGL harness uses synchronous pixel
readback because Chromium's async readback stopped completing after its first
sample; it does not measure live readback timing, pixels, or FPS.

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
