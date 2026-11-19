// tools/attachments/build-real.cjs — 실사 부착물 GLB 만들기 (v59)
//  원본: Sketchfab CC-BY-4.0 부착물 모델 (assets/models/attachments/CREDITS.md)
//        GitHub 사본 trusthemind/game apps/web/public/models/attach.glb (부착물마다 최상위 노드 하나)
//  결과: assets/models/attachments/<파일>.glb — 게임(attachments.js · asset-viewmodels.js · m4-viewmodel.js)이 쓰던 Flat 모델과 같은 약속
//    · 단위 m(실제 크기), 좌우 가운데 x=0
//    · 조준경: 바닥 y=0, 앞뒤 가운데. 도트·홀로·x2 는 앞 = −Z, x4·x8 은 앞 = +Z (예전 망원 조준경과 같게 — 게임이 180° 돌린다)
//      조준선 높이(바닥 기준 m)는 루트 노드 extras.eye 에 적는다. 렌즈 재질 이름은 'Glass' (게임이 반투명하게)
//    · 소음기·제퇴기: 뒤 끝 z=0, 앞 = −Z, 축 y=0 · 손잡이: 윗면 y=0, 앞뒤 가운데 · 레이저: 바닥 y=0, 앞뒤 가운데, 앞 = −Z
//    · 텍스처 512 px WebP, 위치·법선 양자화, meshopt 압축 (무거운 원본은 단순화)
// 쓰는 법: NODE_PATH=<@gltf-transform·meshoptimizer·sharp> node tools/attachments/build-real.cjs <attach.glb> [이름,...]
const fs = require('fs'), path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { dedup, prune, weld, reorder, quantize, dequantize, flatten, clearNodeTransform, transformMesh, textureCompress, getBounds, simplify, join } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder } = require('meshoptimizer');
const sharp = require('sharp');

const OUT = path.join(__dirname, '../../assets/models/attachments');
// node: 원본 최상위 노드, kind: optic | muzzle | grip | side, turn: 길이 방향을 Z 로 놓은 뒤 더 돌릴 각(도, Y 축)
//  glass: 렌즈로 칠 메시(노드 이름) · eye: 'glass'(렌즈 중심) | 'tube'(뒤쪽 끝 단면 가운데) · simplify: 남길 비율
const PARTS = {
  'rd-aimpoint': { node: 'red_dot', kind: 'optic', turn: 0, glass: /^wSphere/, eye: 'glass' },
  'holo-eotech': { node: 'holo', kind: 'optic', turn: 180, glass: /_(Holo|Sight)_0$/, eye: 'glass' },
  'scope-acog': { node: 'scope_4x', kind: 'optic', turn: 0, eye: 'tube', eyeMin: 0.025, simplify: 0.3 },
  'scope-sniper': { node: 'scope_8x', kind: 'optic', turn: 180, eye: 'tube', simplify: 0.6 },
  'sup-rifle': { node: 'sup_556', kind: 'muzzle', turn: 180 },
  'brake-rifle': { node: 'brake', kind: 'muzzle', turn: 180 },
  'grip-vertical': { node: 'fgrip', kind: 'grip', turn: 0 },
  'laser-perst': { node: 'tac_light', kind: 'side', turn: 180, simplify: 0.35 }
};
const TURN = (process.env.TURN || '').split(',').filter(Boolean).reduce((o, s) => { const [k, v] = s.split('='); o[k] = +v; return o; }, {});

function rotY(deg) { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
const ROT_X = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1], ROT_Z = rotY(90);
const tr = t => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];

(async () => {
  const src = process.argv[2];
  if (!src) throw Error('attach.glb 경로를 주세요');
  const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(PARTS);
  await MeshoptEncoder.ready; await MeshoptSimplifier.ready; await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  for (const id of only) {
    const C = PARTS[id], doc = await io.read(src), root = doc.getRoot(), scene = root.listScenes()[0];
    for (const n of scene.listChildren()) if (n.getName() !== C.node) { n.traverse(x => x.dispose()); }
    if (!scene.listChildren().length) throw Error(C.node + ' 노드 없음');
    await doc.transform(prune(), dequantize(), flatten());   // 원본 법선이 양자화(int8)돼 있어 회전·재양자화 전에 실수로 푼다
    for (const n of root.listNodes()) if (n.getMesh()) {
      // 거울 변환(행렬식 < 0)을 구우면 삼각형 감기 방향이 뒤집혀 앞면이 잘려 나간다 → 순서를 바꿔 준다
      const m = n.getWorldMatrix(), det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
      clearNodeTransform(n);
      if (det < 0) for (const p of n.getMesh().listPrimitives()) { const ix = p.getIndices(), a = ix.getArray().slice(); for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } ix.setArray(a); }
    }
    // 렌즈 재질 이름
    const glassMeshes = new Set();
    if (C.glass) for (const n of root.listNodes()) if (n.getMesh() && C.glass.test(n.getName())) {
      glassMeshes.add(n.getMesh());
      const m = doc.createMaterial('Glass').setBaseColorFactor([0.55, 0.75, 0.7, 0.25]).setAlphaMode('BLEND').setRoughnessFactor(0.05).setMetallicFactor(0);
      for (const p of n.getMesh().listPrimitives()) p.setMaterial(m);
    }
    const meshes = root.listMeshes();
    let b = getBounds(scene), ext = [0, 1, 2].map(i => b.max[i] - b.min[i]);
    if (C.kind !== 'grip') {
      if (ext[1] > ext[0] && ext[1] > ext[2]) for (const m of meshes) transformMesh(m, ROT_X);
      b = getBounds(scene); ext = [0, 1, 2].map(i => b.max[i] - b.min[i]);
      if (ext[0] > ext[2]) for (const m of meshes) transformMesh(m, ROT_Z);
    }
    const turn = TURN[id] ?? C.turn;
    if (turn) for (const m of meshes) transformMesh(m, rotY(turn));
    b = getBounds(scene);
    const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    const t = C.kind === 'muzzle' ? [-cx, -cy, -b.max[2]] : C.kind === 'grip' ? [-cx, -b.max[1], -cz] : [-cx, -b.min[1], -cz];
    for (const m of meshes) transformMesh(m, tr(t));
    // 조준선 높이
    let eye;
    if (C.kind === 'optic') {
      const el = [], pts = [];
      for (const m of meshes) for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { a.getElement(i, el); pts.push([...el, glassMeshes.has(m)]); } }
      if (C.eye === 'glass') { const g = pts.filter(p => p[3]); eye = (Math.min(...g.map(p => p[1])) + Math.max(...g.map(p => p[1]))) / 2; }
      else {
        // 뒤쪽 끝 (x4·x8: 앞 = +Z → 뒤 = −Z 끝) 4 mm 단면의 위아래 가운데
        b = getBounds(scene);
        const r = pts.filter(p => p[2] < b.min[2] + 0.006 && p[1] > (C.eyeMin || 0));
        eye = (Math.min(...r.map(p => p[1])) + Math.max(...r.map(p => p[1]))) / 2;   // eyeMin: 그보다 낮은 점(마운트)은 뺀다
      }
    }
    const top = doc.createNode(id); scene.addChild(top);
    for (const n of root.listNodes()) if (n !== top && n.getMesh()) { scene.removeChild(n); top.addChild(n); }
    if (eye !== undefined) top.setExtras({ eye: +eye.toFixed(4) });
    await doc.transform(dedup(), prune(), join({ keepNamed: false }), weld(),
      ...(C.simplify ? [simplify({ simplifier: MeshoptSimplifier, ratio: C.simplify, error: 0.002 })] : []),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 82 }),
      reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 10 }));
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const bin = await io.writeBinary(doc);
    fs.writeFileSync(path.join(OUT, id + '.glb'), bin);
    b = getBounds(scene);
    let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
    console.log(id.padEnd(14), (bin.length / 1024).toFixed(0) + ' KB', 'tris', tris, 'min', b.min.map(x => x.toFixed(3)).join(','), 'max', b.max.map(x => x.toFixed(3)).join(','), eye !== undefined ? 'eye ' + eye.toFixed(4) : '');
  }
})().catch(e => { console.error(e); process.exit(1); });
