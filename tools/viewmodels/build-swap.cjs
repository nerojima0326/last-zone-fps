// tools/viewmodels/build-swap.cjs — 1인칭 팩의 총만 다른 실사 총으로 바꿔 끼우기 위한 GLB (v55)
//  같은 애니메이션 팩(팔·장전 동작)을 쓰는 두 총이 똑같아 보이지 않게, 총 메시만 따로 만든다.
//  원본: Sketchfab CC-BY-4.0 총 모델 (assets/models/viewmodels/CREDITS.md)
//  결과: assets/models/viewmodels/swap/<게임 총 id>.glb
//    · 단위 m(실제 길이), 길이 방향 Z, 총구 = −Z, 바닥 쪽 정렬은 게임(asset-viewmodels.js)이 정점 분포로 맞춘다
//    · 노드: 'body' (+ 'mag' 탄창, 'slide' 슬라이드 — 있으면 팩의 탄창·슬라이드 뼈를 따라 움직인다)
//    · 스킨(뼈대)은 바인드 자세로 굽고 지운다, 텍스처 1024 px WebP, meshopt 압축
// 쓰는 법: NODE_PATH=<@gltf-transform·meshoptimizer·sharp> node tools/viewmodels/build-swap.cjs <원본 폴더> [id,...]
//   <원본 폴더>/<src>/scene.gltf
const fs = require('fs'), path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { dedup, prune, weld, reorder, quantize, flatten, clearNodeTransform, transformMesh, textureCompress, getBounds, metalRough, joinPrimitives, simplify } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptSimplifier } = require('meshoptimizer');
const sharp = require('sharp');

const OUT = path.join(__dirname, '../../assets/models/viewmodels/swap');
// len: 실제 길이(m), turn: 길이 방향을 Z 로 놓은 뒤 총구가 −Z 가 되도록 더 돌릴 각(도, Y 축)
//  parts: 부위 나누기 — mat(재질 이름) · node(노드 이름) · joint(가장 크게 묶인 뼈 이름) · box(정규화 뒤 좌표 상자, 삼각형 중심 기준)
//  simplify: 삼각형을 이 비율로 줄인다 (너무 무거운 원본), drop: 빼 버릴 재질 이름
const SWAPS = {
  de7:   { src: 'deagle', len: 0.27, turn: 180, parts: { slide: { mat: /^Slide$/ }, mag: { mat: /^Magazine$/ } }, drop: /^Bullet$/ },
  m1911: { src: 'm1911b', len: 0.216, turn: 0, simplify: 0.08, parts: { slide: { node: /^slid_/ }, mag: { node: /^maguzin/ } } },
  sc17:  { src: 'scar', len: 0.97, turn: 180, parts: { mag: { box: [[-0.1, -0.5, -0.075], [0.1, -0.045, 0.045]] } } },
  m1014: { src: 'benelli', len: 1.01, turn: 0, parts: {} }
};

function rotY(deg) { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
function scaleTrans(k, t) { return [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, t[0] * k, t[1] * k, t[2] * k, 1]; }

function subPrim(doc, prim, tris) {
  const map = new Map(), order = [];
  for (const i of tris) if (!map.has(i)) { map.set(i, order.length); order.push(i); }
  const np = doc.createPrimitive().setMaterial(prim.getMaterial());
  for (const sem of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
    const a = prim.getAttribute(sem); if (!a) continue;
    const n = a.getElementSize(), arr = new Float32Array(order.length * n), el = [];
    order.forEach((i, k) => { a.getElement(i, el); for (let j = 0; j < n; j++) arr[k * n + j] = el[j]; });
    np.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(arr));
  }
  np.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(tris, i => map.get(i))));
  return np;
}

(async () => {
  const src = process.argv[2];
  if (!src) throw Error('원본 폴더를 주세요');
  const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(SWAPS);
  await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of only) {
    const C = SWAPS[id], doc = await io.read(path.join(src, C.src, 'scene.gltf')), root = doc.getRoot();
    for (const a of root.listAnimations()) a.dispose();
    if (root.listExtensionsUsed().some(e => e.extensionName === 'KHR_materials_pbrSpecularGlossiness')) await doc.transform(metalRough());
    // 스킨: 정점마다 가장 크게 묶인 뼈 이름을 기억해 두고 (부위 나누기용) 스킨은 지운다
    const jointOf = new Map();
    for (const n of root.listNodes()) {
      const skin = n.getSkin(); if (!skin || !n.getMesh()) continue;
      const joints = skin.listJoints();
      for (const p of n.getMesh().listPrimitives()) {
        const J = p.getAttribute('JOINTS_0'), W = p.getAttribute('WEIGHTS_0'), j = [], w = [], names = [];
        for (let i = 0; i < J.getCount(); i++) { J.getElement(i, j); W.getElement(i, w); let b = 0; for (let k = 1; k < 4; k++) if (w[k] > w[b]) b = k; names.push(joints[j[b]]?.getName() || ''); }
        jointOf.set(p, names);
        p.setAttribute('JOINTS_0', null); p.setAttribute('WEIGHTS_0', null);
      }
      n.setSkin(null);
    }
    for (const s of root.listSkins()) s.dispose();
    const nodeOf = new Map();
    for (const n of root.listNodes()) if (n.getMesh()) for (const p of n.getMesh().listPrimitives()) nodeOf.set(p, (n.getName() || '') + ' ' + (n.getParentNode()?.getName() || ''));
    await doc.transform(flatten());
    for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
    const scene = root.getDefaultScene() || root.listScenes()[0];
    let b = getBounds(scene);
    const ext = [0, 1, 2].map(i => b.max[i] - b.min[i]);
    // 가장 긴 축을 Z 로
    const turnX = ext[1] > ext[0] && ext[1] > ext[2], turnZ = ext[0] > ext[2] && !turnX;
    if (turnX) for (const m of root.listMeshes()) transformMesh(m, [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]);
    if (turnZ || C.turn) for (const m of root.listMeshes()) transformMesh(m, rotY((turnZ ? 90 : 0) + C.turn));
    b = getBounds(scene);
    const k = C.len / (b.max[2] - b.min[2]);
    const t = [-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, -(b.min[2] + b.max[2]) / 2];
    for (const m of root.listMeshes()) transformMesh(m, scaleTrans(k, t));
    // 부위 나누기
    const parts = { body: [] }; for (const k2 in C.parts) parts[k2] = [];
    const a3 = [0, 0, 0], b3 = [0, 0, 0], c3 = [0, 0, 0];
    for (const n of root.listNodes()) {
      if (!n.getMesh()) continue;
      for (const p of n.getMesh().listPrimitives()) {
        const pos = p.getAttribute('POSITION'), idx = p.getIndices(), mat = p.getMaterial()?.getName() || '', jn = jointOf.get(p);
        if (C.drop && C.drop.test(mat)) continue;   // 떨어져 떠 있는 부품(낱개 탄 등)은 뺀다
        const cnt = idx ? idx.getCount() : pos.getCount(), tri = idx ? i => idx.getScalar(i) : i => i;
        const bk = {}; for (const k2 in parts) bk[k2] = [];
        for (let i = 0; i < cnt; i += 3) {
          const t0 = tri(i), t1 = tri(i + 1), t2 = tri(i + 2);
          let tgt = 'body';
          for (const [k2, rule] of Object.entries(C.parts)) {
            if (rule.mat && rule.mat.test(mat)) { tgt = k2; break; }
            if (rule.node && (nodeOf.get(p) || '').split(' ').some(x => rule.node.test(x))) { tgt = k2; break; }
            if (rule.joint && jn && [t0, t1, t2].filter(v => rule.joint.test(jn[v])).length >= 2) { tgt = k2; break; }
            if (rule.box) {
              pos.getElement(t0, a3); pos.getElement(t1, b3); pos.getElement(t2, c3);
              const m = [0, 1, 2].map(j => (a3[j] + b3[j] + c3[j]) / 3), [lo, hi] = rule.box;
              if (m.every((v, j) => v >= lo[j] && v <= hi[j])) { tgt = k2; break; }
            }
          }
          bk[tgt].push(t0, t1, t2);
        }
        for (const k2 in bk) if (bk[k2].length) parts[k2].push(subPrim(doc, p, bk[k2]));
      }
    }
    for (const n of root.listNodes()) n.dispose();
    for (const m of root.listMeshes()) m.dispose();
    const top = doc.createNode('gun'); scene.addChild(top);
    const counts = {};
    for (const [k2, ps] of Object.entries(parts)) {
      if (!ps.length) continue;
      const mesh = doc.createMesh(k2);
      // 같은 재질끼리 합친다
      const byMat = new Map(); for (const p of ps) { const m = p.getMaterial(); (byMat.get(m) || byMat.set(m, []).get(m)).push(p); }
      for (const list of byMat.values()) {
        const sem = list[0].listSemantics().join();
        const ok = list.every(p => p.listSemantics().join() === sem);
        if (list.length > 1 && ok) { mesh.addPrimitive(joinPrimitives(list)); for (const p of list) p.dispose(); }
        else for (const p of list) mesh.addPrimitive(p);
      }
      top.addChild(doc.createNode(k2).setMesh(mesh));
      counts[k2] = mesh.listPrimitives().reduce((s, p) => s + p.getIndices().getCount() / 3, 0);
    }
    await doc.transform(
      dedup(), prune(), weld(),
      ...(C.simplify ? [simplify({ simplifier: MeshoptSimplifier, ratio: C.simplify, error: 0.0015 })] : []),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
      reorder({ encoder: MeshoptEncoder }),
      quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 10 })
    );
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const bin = await io.writeBinary(doc);
    fs.writeFileSync(path.join(OUT, id + '.glb'), bin);
    const s = getBounds(scene);
    console.log(id.padEnd(6), (bin.length / 1024).toFixed(0) + ' KB', 'size', [0, 1, 2].map(i => (s.max[i] - s.min[i]).toFixed(3)).join('x'), JSON.stringify(counts));
  }
})().catch(e => { console.error(e); process.exit(1); });
