// tools/viewmodels/pack-glb.cjs — 내보낸 GLB 를 게임용으로: 텍스처 WebP(최대 --max px), 양자화 없이 meshopt 압축
// 쓰는 법: NODE_PATH=<@gltf-transform·meshoptimizer·sharp> node tools/viewmodels/pack-glb.cjs [--max 1024] 입력.glb 출력.glb
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { textureCompress, reorder, prune, dedup } = require('@gltf-transform/functions');
const { MeshoptEncoder } = require('meshoptimizer');
const sharp = require('sharp');
(async () => {
  const a = process.argv.slice(2); let max = 1024; const i = a.indexOf('--max'); if (i >= 0) { max = +a[i + 1]; a.splice(i, 2); }
  const [inp, out] = a;
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.read(inp);
  await doc.transform(dedup(), prune({ keepExtras: true }), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [max, max] }), reorder({ encoder: MeshoptEncoder }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(out, doc);
  console.log(out, (require('fs').statSync(out).size / 1048576).toFixed(2) + ' MB');
})().catch(e => { console.error(e); process.exit(1); });
