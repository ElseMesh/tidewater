# Grass density asset, version 1

`grass-density/1` is a renderer-neutral RGBA population field. It carries density data only; it does not define a renderer, geometry, or placement algorithm. Dense vegetation references the content-addressed asset through `elsemesh.ground-cover-field/1` and its `densityAssetId`. The field's authored expression defines how the four channels contribute to occupancy.

The 16-byte little-endian header contains the ASCII `TGD1` signature, a `uint32` square resolution, and `float32` world-space terrain size and origin. The remaining bytes are exactly `resolution × resolution × 4` RGBA8 texels. Channels encode dune grass, meadow grass, sea oats, and beach creeper in that order. Resolution is 2–2048, size is finite and positive, origin is finite, and the complete asset is limited to 16 MiB.

Tidewater's exporter derives this field from its authored terrain and scatter inputs and signs it alongside the near, mid, and far patch GLBs. Both engine backends use the same signed density, patch geometry, and shared LOD policy. Neither backend may regenerate a different arrangement or assign new meanings to the channels.
