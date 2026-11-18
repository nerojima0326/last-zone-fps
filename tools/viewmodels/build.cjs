// tools/viewmodels/build.cjs — 총기별 1인칭 장전 애니메이션 팩 GLB 만들기 (v51)
//  원본: Sketchfab CC-BY-4.0 FPS 애니메이션 팩 (assets/models/viewmodels/CREDITS.md 참고)
//  결과: assets/models/viewmodels/<id>.glb
//    · Specular-Glossiness 재질은 Metal-Rough 로 바꾸고, 텍스처는 1024 px WebP
//    · 애니메이션은 그대로 두되 겹치는 키는 줄이고(resample), 위치·법선 양자화 + meshopt 압축
// 쓰는 법: NODE_PATH=<@gltf-transform·meshoptimizer·sharp> node tools/viewmodels/build.cjs <원본 폴더> [id,...]
//   <원본 폴더>/<id>/scene.gltf (+ scene.bin, textures/)
const fs = require('fs'), path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { dedup, prune, weld, reorder, quantize, resample, metalRough, textureCompress } = require('@gltf-transform/functions');
const { MeshoptEncoder } = require('meshoptimizer');
const sharp = require('sharp');

const OUT = path.join(__dirname, '../../assets/models/viewmodels');
// 팩 → 원본 glTF 파일. drop: 쓰지 않는 메시(이름 정규식)
const PACKS = {
  ak74:      { file: 'scene.gltf' },
  saiga:     { file: 'scene.gltf' },
  remington: { file: 'scene.gltf' },
  acr:       { file: 'scene.gltf', drop: /Silencer|Scope/ },
  xdm:       { file: 'scene.gltf' },
  p9mm:      { file: 'scene.gltf', drop: /Skybox|Aim/ },
  // cut: 메시(이름) 안에서 무게중심이 상자(메시 좌표) 안인 삼각형을 지운다 — 저격소총의 붙박이 조준경(게임 조준경 부품을 대신 단다)
  sniper:    { file: 'scene.gltf', cut: [{ mesh: /^base_sniper/, box: [[-10, 9.6, 0], [10, 30, 58]] }] },     // v56 DJMaesen 'sniper animated' (볼트액션 저격소총)
  revolver:  { file: 'scene.gltf' },     // v56 DJMaesen 'revolver animated'
};

(async () => {
  const src = process.argv[2];
  if (!src) throw Error('원본 폴더를 주세요');
  const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(PACKS);
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of only) {
    const P = PACKS[id], file = path.join(src, id, P.file);
    const doc = await io.read(file), root = doc.getRoot();
    if (P.drop) for (const n of root.listNodes()) if (n.getMesh() && P.drop.test(n.getMesh().getName() + ' ' + n.getName() + ' ' + (n.getParentNode()?.getName() || ''))) { n.getMesh().dispose(); n.dispose(); }
    for (const c of P.cut || []) for (const m of root.listMeshes()) {
      if (!c.mesh.test(m.getName())) continue;
      for (const prim of m.listPrimitives()) {
        const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), keep = [], a = [], b = [], d = [];
        for (let i = 0; i < idx.getCount(); i += 3) {
          const t = [idx.getScalar(i), idx.getScalar(i + 1), idx.getScalar(i + 2)];
          pos.getElement(t[0], a); pos.getElement(t[1], b); pos.getElement(t[2], d);
          const ctr = [0, 1, 2].map(j => (a[j] + b[j] + d[j]) / 3);
          if (!ctr.every((v, j) => v >= c.box[0][j] && v <= c.box[1][j])) keep.push(...t);
        }
        console.log(id, m.getName(), '삼각형', idx.getCount() / 3, '→', keep.length / 3);
        idx.setArray(new Uint32Array(keep));
      }
    }
    // 가중치가 0 인 정점(원본 탄창 메시 일부)은 뼈대 원점으로 끌려가 가는 선으로 보인다 → 그 메시의 주 뼈에 묶는다
    for (const n of root.listNodes()) {
      if (!n.getSkin() || !n.getMesh()) continue;
      for (const prim of n.getMesh().listPrimitives()) {
        const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), j = [], w = [], tot = new Map();
        if (!J || !W) continue;
        for (let i = 0; i < J.getCount(); i++) { J.getElement(i, j); W.getElement(i, w); for (let k = 0; k < 4; k++) if (w[k] > 0) tot.set(j[k], (tot.get(j[k]) || 0) + w[k]); }
        const main = [...tot].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
        let fixed = 0;
        for (let i = 0; i < J.getCount(); i++) {
          W.getElement(i, w);
          if (w[0] + w[1] + w[2] + w[3] < 0.5) { J.setElement(i, [main, 0, 0, 0]); W.setElement(i, [1, 0, 0, 0]); fixed++; }
        }
        if (fixed) console.log(id, n.getMesh().getName(), '가중치 없는 정점', fixed, '개 →', n.getSkin().listJoints()[main].getName());
      }
    }
    // 텍스처 하나가 여러 용도(색·노멀)로 쓰이면 sharp 변환에서 꼬이므로 빈 스케일러 텍스처는 그대로 둔다
    const ops = [];
    if (root.listExtensionsUsed().some(e => e.extensionName === 'KHR_materials_pbrSpecularGlossiness')) ops.push(metalRough());
    ops.push(
      resample({ tolerance: 1e-4 }),
      dedup(), prune({ keepLeaves: true }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [P.tex || 1024, P.tex || 1024], quality: 80 }),
      weld(),
      reorder({ encoder: MeshoptEncoder }),
      ...(P.noQuant ? [] : [quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 10 })])
    );
    await doc.transform(...ops);
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const bin = await io.writeBinary(doc);
    fs.writeFileSync(path.join(OUT, id + '.glb'), bin);
    console.log(id.padEnd(10), (bin.length / 1048576).toFixed(2) + ' MB', 'anims', root.listAnimations().map(a => a.getName()).join(','));
  }
})().catch(e => { console.error(e); process.exit(1); });
