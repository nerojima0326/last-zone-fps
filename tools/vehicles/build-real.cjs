// tools/vehicles/build-real.cjs — 실사 차량 GLB 만들기 (v53)
//  원본: Sketchfab CC-BY-4.0 차량 (assets/models/vehicles/CREDITS.md)
//  결과: assets/models/vehicles/<id>.glb — vehicles.js 가 읽는 Kenney 차와 같은 구조
//    · 단위 m, 바닥 y=0, 앞 = −Z, 좌우 가운데 x=0
//    · 노드 'body' (차체) + 'wheel_frontLeft' · 'wheel_frontRight' · 'wheel_backLeft' · 'wheel_backRight'
//      (바퀴는 원본에서 한 메시로 붙어 있어, 바퀴 원통 안에 든 삼각형을 떼어내 바퀴 중심을 원점으로 둔다)
//    · 텍스처 1024/512 px WebP, 위치·법선 양자화 + meshopt 압축 (필요하면 단순화)
// 쓰는 법: NODE_PATH=<@gltf-transform·meshoptimizer·sharp> node tools/vehicles/build-real.cjs <원본 폴더> [id,...]
//   <원본 폴더>/<id>/scene.gltf
const fs = require('fs'), path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { dedup, prune, weld, reorder, quantize, flatten, clearNodeTransform, transformMesh, textureCompress, getBounds, simplify, metalRough, join } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptSimplifier } = require('meshoptimizer');
const sharp = require('sharp');

const OUT = path.join(__dirname, '../../assets/models/vehicles');
// len: 실제 길이(m), rot: 앞이 −Z 가 되도록 Y 축 회전(도), r: 바퀴 반지름(m), tw: 바퀴 폭 절반(m), simplify: 남길 비율
const CARS = {
  porter: { len: 5.1, rot: 180, r: 0.33, tw: 0.12 },
  e2200:  { len: 4.7, rot: 180, r: 0.34, tw: 0.12, simplify: 0.5 },
  izh:    { len: 4.4, rot: 180, r: 0.33, tw: 0.11 }
};

const v3 = () => [0, 0, 0];
function rotY(deg) { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
function scaleTrans(k, t) { return [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, t[0] * k, t[1] * k, t[2] * k, 1]; }

// 정점 목록 [i...] 로 새 프리미티브 (속성 복사, 위치에서 c 를 뺀다)
function subPrim(doc, prim, tris, c) {
  const map = new Map(), order = [];
  for (const i of tris) if (!map.has(i)) { map.set(i, order.length); order.push(i); }
  const np = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
  for (const sem of prim.listSemantics()) {
    const a = prim.getAttribute(sem), n = a.getElementSize(), arr = new Float32Array(order.length * n), el = [];
    order.forEach((i, k) => { a.getElement(i, el); for (let j = 0; j < n; j++) arr[k * n + j] = el[j] - (sem === 'POSITION' ? c[j] : 0); });
    np.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(arr));
  }
  const idx = new Uint32Array(tris.length); tris.forEach((i, k) => idx[k] = map.get(i));
  np.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx));
  return np;
}

(async () => {
  const src = process.argv[2];
  if (!src) throw Error('원본 폴더를 주세요');
  const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(CARS);
  await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  for (const id of only) {
    const C = CARS[id], doc = await io.read(path.join(src, id, 'scene.gltf')), root = doc.getRoot();
    const scene = root.getDefaultScene() || root.listScenes()[0];
    if (root.listExtensionsUsed().some(e => e.extensionName === 'KHR_materials_pbrSpecularGlossiness')) await doc.transform(metalRough());
    await doc.transform(flatten());
    for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
    // 길이 방향을 Z 로, 앞을 −Z 로
    let b = getBounds(scene);
    const turn = (b.max[0] - b.min[0] > b.max[2] - b.min[2] ? 90 : 0) + C.rot;
    if (turn) for (const m of root.listMeshes()) transformMesh(m, rotY(turn));
    b = getBounds(scene);
    const k = C.len / (b.max[2] - b.min[2]);
    const t = [-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2];
    for (const m of root.listMeshes()) transformMesh(m, scaleTrans(k, t));
    b = getBounds(scene);
    const W = b.max[0] - b.min[0], L = b.max[2] - b.min[2];
    // 바퀴 중심: 사분면마다 바닥(높이 4 cm 아래) 정점의 평균
    const prims = [];
    for (const n of root.listNodes()) if (n.getMesh()) for (const p of n.getMesh().listPrimitives()) prims.push(p);
    const wheels = { frontLeft: [-1, -1], frontRight: [1, -1], backLeft: [-1, 1], backRight: [1, 1] }, centers = {};
    const el = [];
    for (const [nm, [sx, sz]] of Object.entries(wheels)) {
      let sxx = 0, szz = 0, n = 0;
      for (const p of prims) {
        const pos = p.getAttribute('POSITION');
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, el);
          if (el[1] < 0.04 && Math.sign(el[0]) === sx && Math.sign(el[2]) === sz && Math.abs(el[0]) > W * 0.2) { sxx += el[0]; szz += el[2]; n++; }
        }
      }
      if (!n) throw Error(id + ' ' + nm + ' 바퀴 바닥을 찾지 못했습니다');
      centers[nm] = [sxx / n, C.r, szz / n];
    }
    // 삼각형 나누기
    const parts = { body: [] }; for (const nm in wheels) parts[nm] = [];
    const a = v3(), bb = v3(), cc = v3();
    let moved = 0;
    for (const p of prims) {
      const pos = p.getAttribute('POSITION'), idx = p.getIndices();
      const tri = idx ? i => idx.getScalar(i) : i => i, cnt = idx ? idx.getCount() : pos.getCount();
      const buckets = { body: [] }; for (const nm in wheels) buckets[nm] = [];
      for (let i = 0; i < cnt; i += 3) {
        const i0 = tri(i), i1 = tri(i + 1), i2 = tri(i + 2);
        pos.getElement(i0, a); pos.getElement(i1, bb); pos.getElement(i2, cc);
        const m = [(a[0] + bb[0] + cc[0]) / 3, (a[1] + bb[1] + cc[1]) / 3, (a[2] + bb[2] + cc[2]) / 3];
        let tgt = 'body';
        for (const nm in centers) {
          const c = centers[nm];
          const inside = [a, bb, cc, m].every(q => Math.abs(q[0] - c[0]) < C.tw + 0.03 && Math.hypot(q[1] - c[1], q[2] - c[2]) < C.r * 1.04);
          if (inside) { tgt = nm; break; }
        }
        buckets[tgt].push(i0, i1, i2);
        if (tgt !== 'body') moved++;
      }
      for (const nm in buckets) if (buckets[nm].length) parts[nm].push(subPrim(doc, p, buckets[nm], nm === 'body' ? [0, 0, 0] : centers[nm]));
    }
    // 원래 노드·메시를 지우고 새로 만든다
    for (const n of root.listNodes()) n.dispose();
    for (const m of root.listMeshes()) m.dispose();
    const top = doc.createNode('car');
    scene.addChild(top);
    for (const nm in parts) {
      if (!parts[nm].length) throw Error(id + ' ' + nm + ' 삼각형 없음');
      const mesh = doc.createMesh(nm);
      for (const p of parts[nm]) mesh.addPrimitive(p);
      const node = doc.createNode(nm === 'body' ? 'body' : 'wheel_' + nm).setMesh(mesh);
      if (nm !== 'body') node.setTranslation(centers[nm]);
      top.addChild(node);
    }
    const ops = [dedup(), prune(), join({ keepNamed: true }), weld()];
    if (C.simplify) ops.push(simplify({ simplifier: MeshoptSimplifier, ratio: C.simplify, error: 0.002 }));
    ops.push(
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 80 }),
      dedup(), prune(), reorder({ encoder: MeshoptEncoder }),
      quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 10 })
    );
    await doc.transform(...ops);
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const bin = await io.writeBinary(doc);
    fs.writeFileSync(path.join(OUT, id + '.glb'), bin);
    let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() || 0) / 3;
    console.log(id.padEnd(8), (bin.length / 1048576).toFixed(2) + ' MB', 'size', W.toFixed(2) + 'x' + (b.max[1] - b.min[1]).toFixed(2) + 'x' + L.toFixed(2),
      'tris', tris, 'wheel tris moved', moved, 'centers', Object.values(centers).map(c => c.map(x => x.toFixed(2)).join(',')).join(' | '));
  }
})().catch(e => { console.error(e); process.exit(1); });
