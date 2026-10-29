# Tidewater fish catalog

Tidewater authors species under
`experience.behaviors["elsemesh.fishing-game/1"].fishCatalog` in
`fishing.json`. The exporter carries the values into the signed world
manifest. ElseMesh validates the catalog and supplies it to shared browser
gameplay and renderer adapters; the engine does not contain Tidewater species
definitions.

Each map key is a stable species ID. Each value contains:

- `name` and optional `sci`: display and scientific names.
- `lw`: positive `[a, b]` values for `weight_g = a * length_cm^b`.
- `model`: world fish model key used by Tidewater's fish presentation.
- `habitat`: nonnegative weights up to `1` for `shallows`, `reef`, `pier`,
  `bay`, or `deep`.
- `kg`: positive `[minimum, maximum]` catch weight range.
- `price`: positive value per kilogram.
- `fight`: pull strength from `0` through `1`.
- `stamina`: positive typical seconds to tire.
- `time`: one of `any`, `day`, `dawnDusk`, or `night`.
- `rarity`: relative encounter weight above `0` and up to `1`.

The catalog is limited to 128 species. Each model key must be recognized by
Tidewater's fish presentation code. Changes to catalog values can change
encounter distribution, catch weights, catch-card dimensions, prices, and
fight difficulty; compare the WebGPU and WebGL gameplay paths against the
pre-split WebGPU baseline after changing them.
