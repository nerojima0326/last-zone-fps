# Credits

- Sandbag Wall Section by Polyfork (https://polyfork.dev/asset/sandbag-wall-section-7075ee), CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/. Changed by Patch: a compressed preview copy added for the viewer (web and src are as published).
- "Concrete Floor Painted" by Rob Tuytel (Poly Haven, https://polyhaven.com/a/concrete_floor_painted), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: 1K JPEG maps selected, credit added to each file.
- "Plastic Crate 01" by PierreB3D (Poly Haven, https://polyhaven.com/a/plastic_crate_01), licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Changed by Patch: packed the 1K glTF into one GLB, pivot moved to the bottom centre, credit added to the file, simplified LODs added.

## Game integration

The game scales and instances the models, adjusts rendering materials, and tiles the floor maps. Only base colour, OpenGL normal and packed ARM maps are distributed; the separately supplied AO, roughness and displacement maps are omitted because the packed maps provide what the game uses.
