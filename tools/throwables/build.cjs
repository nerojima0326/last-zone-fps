// tools/throwables/build.cjs — 투척무기 4종 GLB 만들기 (v46)
//  원본: 3DModelsCC0 "Free CC0 Guns & Explosives Pack" GLB 변환본 (BoQsc/cc0-guns-explosives-pack-glb releases, CC0)
//        FragGrenadeModel.glb · Flashbang.glb · Smoke_Grenade.glb · Molotov_Cocktail.glb
//  결과: assets/models/throwables/<frag|flash|smoke|molotov>.glb
//    · 노드 변환을 정점에 굽고, 가운데를 원점에 (위 = +Y = 신관/병목), 안전손잡이(레버)는 +X 쪽
//    · 텍스처는 512 px WebP, 위치·법선 양자화 + meshopt 압축
//    · 'Pin' 메시 이름은 pin 으로 남긴다 (손에 든 모델에서 핀을 뽑는 데 쓴다)
// 쓰는 법: NODE_PATH=<@gltf-transform·meshoptimizer·sharp 가 있는 node_modules> node tools/throwables/build.cjs <원본 폴더>
const fs = require('fs'), path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { dedup, prune, weld, reorder, quantize, flatten, clearNodeTransform, transformMesh, textureCompress, getBounds } = require('@gltf-transform/functions');
const { MeshoptEncoder } = require('meshoptimizer');
const sharp = require('sharp');

const OUT = path.join(__dirname, '../../assets/models/throwables');
const SRC = { frag: 'FragGrenadeModel.glb', flash: 'Flashbang.glb', smoke: 'Smoke_Grenade.glb', molotov: 'Molotov_Cocktail.glb' };
// 원본의 레버는 -Z 쪽: Y 축으로 -90° 돌려 +X 로 (화염병은 심지가 -Z 쪽으로 기운 병)
const TURN = -Math.PI / 2;

function mat4(rotY, t) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  // 열 우선 (glTF): 회전 후 이동
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, t[0], t[1], t[2], 1];
}

(async () => {
  const src = process.argv[2];
  if (!src) throw Error('원본 GLB 폴더를 주세요');
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  fs.mkdirSync(OUT, { recursive: true });
  for (const [id, file] of Object.entries(SRC)) {
    const doc = await io.read(path.join(src, file));
    const root = doc.getRoot(), scene = root.getDefaultScene() || root.listScenes()[0];
    await doc.transform(flatten());
    for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
    // 돌린 뒤의 경계 상자 중심을 원점으로
    for (const n of root.listNodes()) if (n.getMesh()) transformMesh(n.getMesh(), mat4(TURN, [0, 0, 0]));
    if (id === 'molotov') {
      // 원본 병은 옆으로 기울어 있다: 병 바닥·병목의 중심을 잇는 축을 세운다 (Z 축 회전)
      const bottle = root.listMeshes().find(m => /bottle/i.test(m.getName()) || m.listPrimitives().some(p => /bottle/i.test(p.getMaterial()?.getName() || '')));
      const pos = bottle.listPrimitives()[0].getAttribute('POSITION'), v = [0, 0, 0], P = [];
      for (let i = 0; i < pos.getCount(); i++) P.push(pos.getElement(i, v).slice());
      const ys = P.map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys);
      const mid = (a, b) => { const s = P.filter(p => p[1] >= lo + (hi - lo) * a && p[1] <= lo + (hi - lo) * b); return [s.reduce((t, p) => t + p[0], 0) / s.length, s.reduce((t, p) => t + p[1], 0) / s.length]; };
      const bot = mid(0, 0.15), top = mid(0.85, 1), a = Math.atan2(top[0] - bot[0], top[1] - bot[1]);
      const c = Math.cos(a), s = Math.sin(a);
      for (const n of root.listNodes()) if (n.getMesh()) transformMesh(n.getMesh(), [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      console.log('molotov 기울기 보정', (a * 180 / Math.PI).toFixed(1) + '°');
    }
    const b = getBounds(scene), c = [0, 1, 2].map(i => -(b.min[i] + b.max[i]) / 2);
    for (const n of root.listNodes()) if (n.getMesh()) transformMesh(n.getMesh(), mat4(0, c));
    for (const n of root.listNodes()) if (n.getMesh() && /pin/i.test(n.getName())) { n.setName('pin'); n.getMesh().setName('pin'); }
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 82 }),
      dedup(), prune(), weld(),
      reorder({ encoder: MeshoptEncoder }),
      quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 10 })
    );
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const bin = await io.writeBinary(doc);
    fs.writeFileSync(path.join(OUT, id + '.glb'), bin);
    const s = getBounds(scene);
    console.log(id.padEnd(8), (fs.statSync(path.join(src, file)).size / 1048576).toFixed(1) + ' MB →', (bin.length / 1024).toFixed(0) + ' KB',
      'size', [0, 1, 2].map(i => (s.max[i] - s.min[i]).toFixed(3)).join('x'), 'nodes', root.listNodes().map(n => n.getName()).join(','));
  }
})().catch(e => { console.error(e); process.exit(1); });
