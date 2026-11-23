# World weapon mesh LODs (v78)

`world-lods.glb` contains reduced, vertex-colored derivatives of the 30 weapon
models already distributed by this game. These are used only for third-person
weapons and ground loot; first-person models and reloads are unchanged.

Original artists, source URLs and licenses remain in:

- [Original guns](CREDITS.md)
- [Expansion guns](EXPANSION-CREDITS.md)
- [Viewmodel replacements](../viewmodels/CREDITS.md)

Changes: normalized world placement, sampled albedo into vertex colors, welded
positions, meshoptimizer simplification at two distances, meshopt compression
and attribute quantization. Runtime bounds/shape checks cover all 30 weapons.

Build: `tools/optimize/build-weapon-lods.cjs` (Three.js r160,
@gltf-transform/core/extensions/functions 4.4.1, meshoptimizer 0.23).
The source game must be available to its local headless browser fixture.
