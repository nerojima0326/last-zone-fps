// tools/attachments/build-procedural.mjs — 실사 모델을 찾지 못한 부착물 2종을 직접 만든다 (v61)
//  · rmr.glb   : 권총 미니 도트 (Trijicon RMR 꼴 — 사다리꼴 후드, 앞뒤 경사 기둥, 렌즈, 밑판·조절 나사)
//  · choke.glb : 산탄총 연장 초크 (총구에서 나오는 관 + 세로 홈 고리 + 앞 끝 포트)
//  약속은 build-real.cjs 와 같다: 단위 m, 앞 = −Z, 조준경은 바닥 y=0 · 루트 extras.eye, 총구 부품은 뒤 끝 z=0 · 축 y=0. 렌즈 재질 'Glass'
// 쓰는 법: NODE_PATH=<three · @gltf-transform> node tools/attachments/build-procedural.mjs <three 폴더>
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const THREE_DIR = process.argv[2];
const T = await import(path.join(THREE_DIR, 'build/three.module.js'));
const { mergeGeometries } = await import(path.join(THREE_DIR, 'examples/jsm/utils/BufferGeometryUtils.js'));
const { Document, NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { weld, dedup } = require('@gltf-transform/functions');
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '../../assets/models/attachments');

function toDoc(parts, name, extras) {
  const doc = new Document(); const buf = doc.createBuffer();
  const top = doc.createNode(name); if (extras) top.setExtras(extras);
  doc.createScene().addChild(top);
  for (const { geo, mat } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals();
    const m = doc.createMaterial(mat.name).setBaseColorFactor(mat.color).setMetallicFactor(mat.metal).setRoughnessFactor(mat.rough);
    if (mat.alpha) m.setAlphaMode('BLEND');
    const prim = doc.createPrimitive().setMaterial(m)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.attributes.position.array)).setBuffer(buf))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.attributes.normal.array)).setBuffer(buf));
    top.addChild(doc.createNode(mat.name).setMesh(doc.createMesh(mat.name).addPrimitive(prim)));
  }
  return doc;
}
const BLACK = { name: 'anodized', color: [0.035, 0.036, 0.038, 1], metal: 0.55, rough: 0.42 };
const STEEL = { name: 'steel', color: [0.09, 0.09, 0.095, 1], metal: 0.85, rough: 0.35 };
const GLASS = { name: 'Glass', color: [0.55, 0.75, 0.7, 0.25], metal: 0, rough: 0.05, alpha: true };
const LED = { name: 'led', color: [0.6, 0.05, 0.03, 1], metal: 0, rough: 0.6 };
const box = (w, h, d, x, y, z) => new T.BoxGeometry(w, h, d).translate(x, y, z);

// ---- RMR (길이 46 · 너비 26 · 높이 26 mm) ----
{
  const L = 0.046, W = 0.026, Hb = 0.009, H = 0.026;
  const parts = [];
  // 밑판(앞뒤 경사 모서리)
  const base = new T.Shape([new T.Vector2(-L / 2, 0), new T.Vector2(L / 2, 0), new T.Vector2(L / 2 - 0.002, Hb), new T.Vector2(-L / 2 + 0.003, Hb)].map(v => v));
  const baseG = new T.ExtrudeGeometry(base, { depth: W, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 2 }).rotateY(Math.PI / 2).translate(-W / 2, 0, 0);
  // 후드: 옆에서 본 사다리꼴 틀 (바깥 - 안쪽 창) 을 너비 방향으로 — 앞(-Z) 기둥은 앞으로, 뒤 기둥은 뒤로 기울어진 RMR 꼴
  const outer = new T.Shape([[-0.021, Hb], [0.02, Hb], [0.012, H], [-0.016, H]].map(([z, y]) => new T.Vector2(z, y)));
  const inner = new T.Path([[-0.0165, Hb + 0.001], [0.016, Hb + 0.001], [0.0095, H - 0.0035], [-0.0125, H - 0.0035]].map(([z, y]) => new T.Vector2(z, y)));
  outer.holes.push(inner);
  // 후드는 양옆 벽(두께 3 mm) 과 윗판으로: 옆판 둘 + 윗판
  const side = d => new T.ExtrudeGeometry(outer, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0006, bevelSegments: 2 }).rotateY(Math.PI / 2).translate(d, 0, 0);
  const topG = new T.BoxGeometry(W, 0.0035, 0.029).translate(0, H - 0.00175, -0.002);
  parts.push({ geo: mergeGeometries([baseG, side(-W / 2), side(W / 2 - 0.003), topG].map(g => g.index ? g.toNonIndexed() : g)), mat: BLACK });
  // 조절 나사 두 개 (위 · 오른쪽), 배터리 판 밑
  const knob = new T.CylinderGeometry(0.0032, 0.0032, 0.002, 16);
  parts.push({ geo: mergeGeometries([knob.clone().translate(0.004, H + 0.001, -0.002), knob.clone().rotateZ(Math.PI / 2).translate(W / 2 + 0.001, 0.016, -0.006), box(0.016, 0.002, 0.02, 0, 0.0005, 0.004)].map(g => g.index ? g.toNonIndexed() : g)), mat: STEEL });
  // 렌즈 (창 가운데, 앞으로 살짝 기울게)
  const lens = new T.PlaneGeometry(W - 0.006, H - Hb - 0.006).rotateX(-0.25).translate(0, (Hb + H) / 2 - 0.001, -0.012);
  parts.push({ geo: lens, mat: GLASS });
  // 뒤쪽 밑판 위 LED 창
  parts.push({ geo: box(0.004, 0.0015, 0.003, 0, Hb + 0.0007, 0.015), mat: LED });
  const eye = +((Hb + H) / 2).toFixed(4);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = toDoc(parts, 'rmr', { eye }); await doc.transform(dedup(), weld());
  fs.writeFileSync(path.join(OUT, 'rmr.glb'), await io.writeBinary(doc));
  console.log('rmr.glb', fs.statSync(path.join(OUT, 'rmr.glb')).size, 'eye', eye);
}
// ---- 연장 초크 (길이 50 mm) ----
{
  const parts = [];
  // 관: 뒤 끝 z=0, 앞 = −Z. 선반 단면 (r, z)
  const prof = [[0.0, 0], [0.0102, 0], [0.0102, -0.03], [0.0118, -0.031], [0.0118, -0.05], [0.0095, -0.0505], [0.0095, -0.045], [0.0, -0.045]].map(([r, z]) => new T.Vector2(r, z));
  // LatheGeometry 는 Y 축 둘레 (r, y) → X 축 90° 돌려 y 를 z 로
  const t2 = new T.LatheGeometry(prof, 28).rotateX(Math.PI / 2);
  parts.push({ geo: t2, mat: STEEL });
  // 세로 홈 (손으로 돌리는 고리) 16개
  const flutes = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; flutes.push(box(0.0018, 0.0012, 0.015, 0, 0, 0).translate(0, 0.0122, -0.04).applyMatrix4(new T.Matrix4().makeRotationZ(a))); }
  // 앞 끝 가스 포트 4개
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; flutes.push(box(0.003, 0.0016, 0.006, 0, 0, 0).translate(0, 0.0105, -0.035).applyMatrix4(new T.Matrix4().makeRotationZ(a))); }
  parts.push({ geo: mergeGeometries(flutes.map(g => g.toNonIndexed())), mat: BLACK });
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = toDoc(parts, 'choke'); await doc.transform(dedup(), weld());
  fs.writeFileSync(path.join(OUT, 'choke.glb'), await io.writeBinary(doc));
  console.log('choke.glb', fs.statSync(path.join(OUT, 'choke.glb')).size);
}
