# Tidewater package checks

These checks belong to the Tidewater content repository. They verify Tidewater's
authored package and its integration with the ElseMesh runtime. The runtime
integration checks import engine code from the containing ElseMesh checkout, so
run them from that checkout with `npm test`. The engine test runner preserves
the Tidewater submodule path when it launches these checks, keeping imports in
the external build tree when testing there.

`fishing-rules.mjs` checks the authored behavior data. The other checks cover
the exported package and its Reef assets, terrain, vegetation, geometry LOD,
village material maps, whale assets, authored pier collision, and vendor stand
models in WebGPU and WebGL. These remain in the engine's `npm test` sequence
because they exercise the package through the ElseMesh runtime.

The optional Blender authoring checks use the Tidewater package as their source
fixture:

```sh
python3 worlds/tidewater/test/blender-world-actions.py
BLENDER_EXECUTABLE=/path/to/blender python3 worlds/tidewater/test/blender-world-actions-runtime.py
```
