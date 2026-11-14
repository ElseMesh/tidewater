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

`live-fishing-extension-browser.mjs` signs and serves Tidewater's owner-signed
fishing module through `worldd` and compares WebGPU and WebGL game paths. Its
Joe-buyer step now uses the engine `Player` from Tidewater's authored start and
generated `TerrainData`, rather than positioning the test player inside the
vendor radius. Cast and fight still use the synthetic water-query fixture, and
the browser uses a test HUD, so this does not establish rendered scene or panel
parity.

`webgl-fish-props-adapter-build.mjs` checks WebGL fish-prop mesh construction
without a graphics context. `webgpu-fish-props-adapter-build.mjs` creates the
registered component with a headless WebGPU device and checks GPU buffer
creation and cleanup. Neither check renders pixels or measures FPS.

`webgl-fish-props-render.mjs` and `fish-props-webgpu-render.mjs` render the same
fixed market-prop records from the same camera in isolated WebGL and headless
WebGPU fixtures. They confirm visible output and shader/device success and save
captures under `/var/tmp`. The captures are intended for visual review; they do
not yet assert pixel-level parity or prove that every WebGPU fish marking and
material feature has a WebGL equivalent.

`webgl-shore-query-parity.mjs` compares WebGPU and WebGL against Tidewater's
packaged terrain and shoreline field, then records two 18-second underway boat
traces. The first uses FFT and shoreline inputs without interactive wake or
collision handling. The second includes WakeSim and the authored Tidewater pier
colliders. Before generating the WebGPU reference it pins the wake solver,
water query, boat design, boat physics, berth, and pier inputs to pre-split
ElseMesh `23c30bf`. The comparison checks boat motion and fixed-position water
height and normals. It also runs Tidewater's `FishingRod` cast and landing from
the authored central beach over the production WebGPU and WebGL FFT, terrain,
shore, and water-query paths. The generated WebGPU trace is tied to the same
pre-split source check; the WebGL trace compares bobber motion, water samples,
state transitions, and landing frame. This verifies cast-and-landing behavior,
not the signed Worker fight or a rendered fishing scene. Its headless WebGL
harness uses synchronous pixel readback because Chromium's async readback
stopped completing after its first sample. It does not measure live readback
timing, rendered pixels, or FPS.

To run its WebGL side on the AMD hardware in the isolated Weston display, start
`worlds/Hogwarts/tools/hogwartsmp-parity/start-weston-review.sh`, then run the
check with `ELSEMESH_TEST_HARDWARE_GPU=1`. This uses `tools/review-browser.mjs`
on the Weston Wayland socket, selects the WebGL ANGLE path, and verifies the
reported renderer contains AMD/Radeon before starting the parity trace. The
default headless mode explicitly disables GPU acceleration and is intended for
software-only query checks.

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
