# GPU-compressed world textures (v78)

Derived from the existing Poly Haven CC0 JPEG textures in `assets/tex/`.
Their original asset IDs and links are in `js/assets.js` and `assets/CREDITS.md`.
The original files remain as automatic fallbacks.

Albedo: ETC1S, quality 200, sRGB. Packed AO/roughness/metalness: ETC1S,
quality 200, linear. Normals: UASTC level 2, linear, normalized mipmaps.
All files include mipmaps and are vertically flipped to match TextureLoader's
original upload orientation. No resolution reduction is applied.

The browser chooses supported ASTC/BC/ETC/PVRTC formats using Three.js r160's
KTX2Loader. Devices without a supported GPU format use the original JPEGs.
Failed KTX2 downloads/transcodes also fall back per texture. `?textures=jpeg`
forces the original path for comparison.

Rebuild with `tools/optimize/build-gpu-textures.cjs`, Sharp 0.34.5 and the
`basisu` 1.16.3 npm package's Linux x64 binary (reports encoder v1.15).
Set `BASISU` to that binary. Its source is BinomialLLC/basis_universal,
Apache-2.0. The bundled runtime transcoder and licenses are in `vendor/basis/`.
`manifest.json` records color spaces, original mean colors and encoded sizes.
