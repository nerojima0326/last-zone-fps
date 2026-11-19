// tools/optimize/shrink-glb.cjs — 이미 만든 GLB 의 다운로드 크기·GPU 메모리 줄이기 (v61)
//  · 텍스처: 거의 한 색인(인코딩 크기가 작은) 텍스처는 128 px 로, 나머지는 --max px 이하로 (WebP 유지)
//      1024 px 텍스처 하나는 GPU 에서 밉맵 포함 약 5.3 MB — 차 한 대에 36 장이면 190 MB
//  · 애니메이션: 같은 값이 이어지는 키프레임을 지운다 (resample, 눈에 보이는 차이 없음)
//  · 이미 meshopt 로 압축된 정점은 그대로 다시 압축해 쓴다
// 쓰는 법: NODE_PATH=<@gltf-transform·meshoptimizer·sharp> node tools/optimize/shrink-glb.cjs [--max 512] [--flat 16] 파일.glb ...
const fs = require('fs');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { resample, prune } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder } = require('meshoptimizer');
const sharp = require('sharp');

(async () => {
  const args = process.argv.slice(2);
  let max = 1024, flatKB = 16;
  const files = [];
  for (let i = 0; i < args.length; i++) { if (args[i] === '--max') max = +args[++i]; else if (args[i] === '--flat') flatKB = +args[++i]; else files.push(args[i]); }
  await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  for (const f of files) {
    const before = fs.statSync(f).size, doc = await io.read(f), root = doc.getRoot();
    const usedExt = root.listExtensionsUsed().map(e => e.extensionName);
    let vram0 = 0, vram1 = 0;
    for (const t of root.listTextures()) {
      const im = Buffer.from(t.getImage()), md = await sharp(im).metadata();
      vram0 += md.width * md.height * 4 * 4 / 3;
      const flat = im.length < flatKB * 1024 && md.width > 128;
      const size = flat ? 128 : Math.min(max, md.width);
      if (size < md.width) {
        const out = await sharp(im).resize(size, Math.round(md.height * size / md.width)).webp({ quality: 85 }).toBuffer();
        t.setImage(new Uint8Array(out)).setMimeType('image/webp');
        vram1 += size * size * md.height / md.width * 4 * 4 / 3;
      } else vram1 += md.width * md.height * 4 * 4 / 3;
    }
    await doc.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true, keepAttributes: true }));
    if (usedExt.includes('EXT_meshopt_compression')) {
      const ext = root.listExtensionsUsed().find(e => e.extensionName === 'EXT_meshopt_compression');
      ext.setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    }
    fs.writeFileSync(f, await io.writeBinary(doc));
    const after = fs.statSync(f).size;
    console.log(f.split('/').pop().padEnd(22), (before / 1048576).toFixed(2), '→', (after / 1048576).toFixed(2), 'MB   GPU 텍스처', (vram0 / 1048576).toFixed(0), '→', (vram1 / 1048576).toFixed(0), 'MB');
  }
})().catch(e => { console.error(e); process.exit(1); });
