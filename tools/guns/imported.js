// CC0 models baked into the same movable-part format as the existing guns.
// Source downloads, pinned revisions and SHA-256 hashes: imported-sources.json.
import { THREE } from './kit.js';
import { DESIGNS } from './designs.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export const IMPORTED = {
  sc17: 'Rifle_Battle_West.glb',
  m1014: 'Shotgun_Pump_East.glb',
  sa12: 'Shotgun_Auto_East.glb',
  aa12: 'Shotgun_Auto_West.glb',
  db2: 'doublebarrelshotgun.gltf',
  // v42: 권총·DMR (Flat Guns) + 리볼버 (Quaternius Ultimate Gun Pack)
  m1911: 'Pistol_Compact_East.glb',
  de7: 'Pistol_Full_East.glb',
  mk14: 'Sniper_Material_West.glb',
  r45: 'Revolver_2.fbx'
};
const PISTOLS = new Set(['m1911', 'de7']);
// 설계 모델(designs.js)의 부품 상자 — 손 IK 기준(손잡이 위치)을 그대로 쓰기 위해 맞춘다
function designBox(id, test) {
  const b = new THREE.Box3();
  for (const m of DESIGNS[id]().build().meshes) if (test(m)) { m.geo.computeBoundingBox(); b.union(m.geo.boundingBox); }
  return b;
}
function meshesBox(meshes, test) {
  const b = new THREE.Box3();
  for (const m of meshes) if (test(m)) { m.geo.computeBoundingBox(); b.union(m.geo.boundingBox); }
  return b;
}
const dir = './src/imported/';
const key = name => name.toLowerCase().replace(/[^a-z]/g, '');

function partFor(name, id) {
  const n = key(name);
  if (n === 'shell') return null; // Gameplay supplies the loading/ejected shells.
  if (n === 'magazine') return 'mag';
  if (n === 'rearsights') return 'rearsight';
  if (n === 'bolt' || n.startsWith('charginghandle')) return 'charge';
  if (id === 'db2' && n === 'barrel') return 'barrel';
  if (n === 'slide') return 'slide';
  // M-1014 uses a fixed fore-end; it must not pump on a semi-auto shot.
  return 'body';
}

async function texture(name, srgb) {
  const original = await new THREE.TextureLoader().loadAsync(dir + name);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  canvas.getContext('2d').drawImage(original.image, 0, 0, 1024, 1024);
  const result = new THREE.Texture(canvas);
  result.flipY = false;
  result.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  result.userData.mimeType = 'image/jpeg';
  result.needsUpdate = true;
  original.dispose();
  return result;
}

export async function buildImported(id) {
  if (IMPORTED[id].endsWith('.fbx')) return buildRevolver(id);
  const gltf = await new GLTFLoader().loadAsync(dir + IMPORTED[id]);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
  const bounds = new THREE.Box3().setFromObject(root);
  const triggerNode = root.getObjectByName('Trigger');
  const trigger = triggerNode.isMesh
    ? new THREE.Box3().setFromObject(triggerNode).getCenter(new THREE.Vector3())
    : triggerNode.getWorldPosition(new THREE.Vector3());
  // Keep muzzle length close to the previous rig, except the short DB-2 asset.
  const meta = structuredClone(DESIGNS[id]().meta);
  const scale = id === 'db2' ? 1.1 : Math.abs(meta.muzzle[2] / (bounds.min.z - trigger.z));
  const point = p => p.clone().sub(trigger).multiplyScalar(scale);
  let post = p => p;   // 권총은 아래에서 손잡이 기준으로 다시 맞춘다
  const namedPoint = name => {
    let node;
    root.traverse(o => { if (key(o.name) === key(name)) node = o; });
    return node ? post(point(node.getWorldPosition(new THREE.Vector3()))).toArray() : null;
  };
  const mats = {}, meshes = [];
  let boomstick;
  if (id === 'db2') {
    const [map, normalMap, arm] = await Promise.all([
      texture('Boomstick_baseColor.png', true), texture('Boomstick_normal.png', false),
      texture('Boomstick_occlusionRoughnessMetallic.png', false)
    ]);
    boomstick = new THREE.MeshStandardMaterial({ name: 'boomstick', map, normalMap,
      roughnessMap: arm, metalnessMap: arm, roughness: 1, metalness: 1 });
  }
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const g = mesh.geometry, pos = g.attributes.position, normal = g.attributes.normal;
    const joints = g.attributes.skinIndex, weights = g.attributes.skinWeight;
    const buckets = new Map();
    const material = boomstick || mesh.material.clone();
    material.name = boomstick ? 'boomstick' : material.name;
    mats[material.name] = material;
    // Split whole triangles by the strongest bone influence. The source rigs
    // have rigid gun parts; never export skinning or split a triangle's vertices.
    const count = g.index ? g.index.count : pos.count;
    for (let t = 0; t < count; t += 3) {
      const indices = [0, 1, 2].map(k => g.index ? g.index.getX(t + k) : t + k);
      const votes = new Map();
      if (mesh.isSkinnedMesh) for (const i of indices) for (let k = 0; k < 4; k++) {
        const bone = joints.getComponent(i, k);
        votes.set(bone, (votes.get(bone) || 0) + weights.getComponent(i, k));
      }
      const bone = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
      const part = partFor(bone === undefined ? mesh.name : mesh.skeleton.bones[bone].name, id);
      if (!part) continue;
      if (!buckets.has(part)) buckets.set(part, { p: [], n: [], uv: [] });
      const out = buckets.get(part);
      for (const i of indices) {
        const p = new THREE.Vector3().fromBufferAttribute(pos, i);
        if (mesh.isSkinnedMesh) mesh.applyBoneTransform(i, p);
        point(p.applyMatrix4(mesh.matrixWorld)).toArray(out.p, out.p.length);
        const n = new THREE.Vector3().fromBufferAttribute(normal, i)
          .transformDirection(mesh.matrixWorld);
        n.toArray(out.n, out.n.length);
        out.uv.push(g.attributes.uv?.getX(i) || 0, g.attributes.uv?.getY(i) || 0);
      }
    }
    for (const [part, out] of buckets) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(out.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
      meshes.push({ part, mat: material.name, geo });
    }
  });
  if (PISTOLS.has(id)) {
    const all = meshesBox(meshes, () => true), dAll = designBox(id, () => true);
    const ours = meshesBox(meshes, m => m.part === 'mag'), dm = designBox(id, m => m.part === 'mag');
    // 손잡이(탄창) 높이를 설계와 같게: 손 IK가 쥐는 크기가 그대로다
    const k = (dm.max.y - dm.min.y) / (ours.max.y - ours.min.y);
    const oc = ours.getCenter(new THREE.Vector3()), dc = dm.getCenter(new THREE.Vector3());
    post = p => p.set((p.x - oc.x) * k, (p.y - oc.y) * k + dc.y, (p.z - oc.z) * k + dc.z);
    const v = new THREE.Vector3();
    for (const m of meshes) {
      const a = m.geo.attributes.position;
      for (let i = 0; i < a.count; i++) { post(v.fromBufferAttribute(a, i)); a.setXYZ(i, v.x, v.y, v.z); }
      a.needsUpdate = true; m.geo.boundingBox = null;
    }
  }
  const box = part => {
    const b = new THREE.Box3();
    for (const m of meshes) if (!part || m.part === part) {
      m.geo.computeBoundingBox(); b.union(m.geo.boundingBox);
    }
    return b;
  };
  const B = box(), muzzleBone = namedPoint('Attach_Muzzle');
  // Muzzle attachment bones can sit behind a flash hider: use the geometry tip.
  const front = meshes.flatMap(m => {
    const a = m.geo.attributes.position, result = [];
    for (let i = 0; i < a.count; i++) if (a.getZ(i) < B.min.z + .008) result.push(a.getY(i));
    return result;
  });
  meta.muzzle = [0, muzzleBone?.[1] ?? (Math.min(...front) + Math.max(...front)) / 2, B.min.z];
  meta.sight = [B.max.y + .002, Math.min(.075, B.max.z - .05)];
  const rail = namedPoint('Attach_Scope');
  meta.rail = rail ? [rail[1], rail[2], 'body'] : [meta.sight[0] - .012, -.07, 'body'];
  meta.pivots = {};
  for (const part of ['mag', 'charge']) {
    const b = box(part);
    if (!b.isEmpty()) {
      const c = b.getCenter(new THREE.Vector3());
      if (part === 'mag') c.y = b.max.y;
      meta.pivots[part] = c.toArray();
      if (part === 'charge') meta.charge = [b.max.x + .008, c.y, c.z];
    }
  }
  // A bolt's bounding box includes its internal slide. Hook the actual exposed
  // charging handle, rather than the centre of that combined moving assembly.
  const handle = namedPoint('Charging Handle End') || namedPoint('Charging Handle');
  if (handle) meta.charge = handle;
  if (id === 'sa12') {
    const chargeBox = box('charge');
    const a = meshes.filter(m => m.part === 'charge').flatMap(m => {
      const p = m.geo.attributes.position, result = [];
      for (let i = 0; i < p.count; i++) if (p.getX(i) > chargeBox.max.x - .004)
        result.push(new THREE.Vector3().fromBufferAttribute(p, i));
      return result;
    });
    meta.charge = a.reduce((v, p) => v.add(p), new THREE.Vector3()).divideScalar(a.length).toArray();
  }
  if (id === 'sa12') meta.extra.chargeMode = 'under';
  if (id === 'sc17') {
    meta.extra.chargeApproachLift = .025;
    // The source magazine includes the feed lips and rounds inside the receiver.
    // Its insertion pivot belongs at the magwell mouth, below those hidden tips.
    meta.pivots.mag[1] -= .035;
  }
  if (PISTOLS.has(id)) {
    // 권총: 조준·레일·당기는 점은 슬라이드 위, 탄창 축은 탄창 바닥 (설계 모델과 같은 규칙)
    const sb = box('slide'), mb = box('mag');
    meta.sight = [sb.max.y + .0015, sb.max.z - .012];
    const rail = namedPoint('Attach_Scope');
    meta.rail = [sb.max.y - .0005, rail ? Math.min(rail[2], sb.max.z - .03) : sb.max.z - .045, 'slide'];
    meta.slideTop = [0, sb.max.y - .004, sb.max.z - .014];
    meta.pivots.slide = [0, 0, 0];
    if (!mb.isEmpty()) {
      meta.pivots.mag = [0, mb.min.y + .006, (mb.min.z + mb.max.z) / 2];
      // 탄창이 빠지는 방향 = 손잡이 기울기 (탄창 앞면 아래 끝 → 위 끝)
      const pts = meshes.filter(m => m.part === 'mag').flatMap(m => { const a = m.geo.attributes.position, r = []; for (let i = 0; i < a.count; i++) r.push([a.getY(i), a.getZ(i)]); return r; });
      const lo = pts.filter(p => p[0] < mb.min.y + .01), hi = pts.filter(p => p[0] > mb.max.y - .01);
      const avg = (q, k) => q.reduce((v, p) => v + p[k], 0) / q.length;
      const dy = avg(lo, 0) - avg(hi, 0), dz = avg(lo, 1) - avg(hi, 1), L = Math.hypot(dy, dz) || 1;
      meta.magDir = [0, dy / L, dz / L];
    }
  }
  if (PISTOLS.has(id)) {
    // 받치는 왼손은 손잡이 왼쪽 면 바깥에
    const grip = meshes.filter(m => m.part === 'body').flatMap(m => { const a = m.geo.attributes.position, r = []; for (let i = 0; i < a.count; i++) if (a.getY(i) < meta.fore[1] + .025 && a.getY(i) > meta.fore[1] - .025 && Math.abs(a.getZ(i) - meta.fore[2]) < .05) r.push(a.getX(i)); return r; });
    if (grip.length) meta.fore[0] = Math.min(meta.fore[0], Math.min(...grip) - .008);
  }
  if (id === 'mk14') {
    // 받치는 손: 총열 덮개 아랫면 바로 아래
    const near = meshes.filter(m => m.part === 'body').flatMap(m => { const a = m.geo.attributes.position, r = []; for (let i = 0; i < a.count; i++) if (Math.abs(a.getZ(i) - meta.fore[2]) < .03) r.push(a.getY(i)); return r; }); meta.fore[1] = Math.min(...near) - .01;
    meta.extra = Object.assign({}, meta.extra, { chargeApproachLift: .035 });
  }
  if (id === 'm1014') {
    const pump = namedPoint('Pump');
    meta.fore = [pump[0] - .004, pump[1] - .025, pump[2]];
    const lifter = namedPoint('Lifter');
    meta.port = [0, lifter[1] - .006, lifter[2]];
  }
  if (id === 'db2') {
    meta.pivots.barrel = point(new THREE.Vector3(0, -.018, -.082)).toArray();
    meta.fore = point(new THREE.Vector3(-.004, -.026, -.23)).toArray();
    meta.port = point(new THREE.Vector3(0, .018, -.083)).toArray();
  }
  meta.credit = id === 'db2' ? 'Boomstick / Godot-Dojo (CC0)' : 'Flat Guns / Pichuliru (CC0)';
  if (PISTOLS.has(id)) delete meta.charge;
  meta.sourceAsset = IMPORTED[id];
  meta.license = 'CC0-1.0';
  return { meshes, mats, meta, tris: meshes.reduce((n, m) => n + m.geo.attributes.position.count / 3, 0) };
}

// Quaternius 리볼버 (FBX, 한 덩어리 메시): 실린더를 기하로 떼어 내고, 실린더 축·반지름을
// 기존 설계(R-45)와 같게 맞춰 장전 동작(실린더 꺾기·탄 6발)이 그대로 맞물리게 한다.
const REV_MATS = {
  Metal: { color: 0x2b2e32, metalness: .75, roughness: .42 },
  LightMetal: { color: 0x6a6f75, metalness: .8, roughness: .35 },
  Grey: { color: 0x3c4045, metalness: .6, roughness: .5 },
  DarkWood: { color: 0x5b3420, metalness: 0, roughness: .72 }
};
async function buildRevolver(id) {
  const src = await new FBXLoader().loadAsync(dir + IMPORTED[id]);
  src.updateMatrixWorld(true);
  const design = DESIGNS[id]();
  const meta = structuredClone(design.meta);
  // 설계의 실린더: 축 높이 CY, 앞·뒤 z, 반지름
  const cylAxis = meta.extra.cylAxis, CR = 0.0205, CZ0 = -0.057, CZ1 = -0.011;
  // 1) 세계 좌표 삼각형 모으기
  const tris = [];
  src.traverse(mesh => {
    if (!mesh.isMesh) return;
    const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : pos.count, materialIndex: 0 }];
    const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for (const gr of groups) for (let t = gr.start; t < gr.start + gr.count; t += 3) {
      const ids = [0, 1, 2].map(k => g.index ? g.index.getX(t + k) : t + k);
      tris.push({ mat: mats[gr.materialIndex]?.name || 'Metal', p: ids.map(i => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)), n: ids.map(i => new THREE.Vector3().fromBufferAttribute(nor, i).applyMatrix3(nm).normalize()) });
    }
  });
  const all = tris.flatMap(t => t.p), B = new THREE.Box3().setFromPoints(all), size = B.getSize(new THREE.Vector3());
  // 2) 축 정하기: 가장 긴 축 = 총열, 가장 얇은 축 = 좌우. 총열은 손잡이(원점)에서 먼 쪽
  const ax = ['x', 'y', 'z'], long = ax.reduce((a, b) => size[a] >= size[b] ? a : b), thin = ax.reduce((a, b) => size[a] <= size[b] ? a : b), up = ax.find(a => a !== long && a !== thin);
  const fwd = Math.abs(B.max[long]) > Math.abs(B.min[long]) ? 1 : -1;
  // 손잡이가 아래: 위축 방향은 총열(앞쪽 끝 부근 점들)의 높이가 손잡이보다 높은 쪽
  const front = all.filter(p => (p[long] - B.min[long]) / size[long] * fwd + (fwd < 0 ? 1 : 0) > .9);
  const frontUp = front.reduce((v, p) => v + p[up], 0) / front.length;
  const upSign = frontUp > (B.min[up] + B.max[up]) / 2 ? 1 : -1;
  // 총 공간: -Z 총구, +Y 위, +X 오른쪽 (오른손 좌표계가 되도록 좌우 부호를 고른다)
  const conv = p => {
    const z = -fwd * p[long], y = upSign * p[up];
    return new THREE.Vector3(0, y, z);
  };
  const thinSign = (() => { const a = new THREE.Vector3(), b = new THREE.Vector3(); a[long] = fwd; b[up] = upSign; const c = new THREE.Vector3().crossVectors(a, b); return c[thin] >= 0 ? 1 : -1; })();
  // 위 × 앞 = 오른쪽? 앞(-Z)×위(+Y) = +X 이므로 (앞 × 위) 방향이 +X
  const toGun = p => { const v = conv(p); v.x = thinSign * p[thin]; return v; };
  for (const t of tris) { t.p = t.p.map(toGun); t.n = t.n.map(toGun); }
  // 3) 실린더 찾기: 위쪽 절반에서 좌우 폭이 가장 넓은 구간
  const P = tris.flatMap(t => t.p), GB = new THREE.Box3().setFromPoints(P), gs = GB.getSize(new THREE.Vector3());
  const N = 120, lo = new Array(N).fill(Infinity), hi = new Array(N).fill(-Infinity), yMid = GB.min.y + gs.y * .45;
  // 큰 면이 많아 꼭짓점만으로는 빈 구간이 생긴다: 삼각형 면 위를 촘촘히 표본한다
  const S = [];
  for (const t of tris) for (let a = 0; a <= 12; a++) for (let b = 0; b <= 12 - a; b++) {
    const u = a / 12, v = b / 12, w = 1 - u - v;
    S.push(new THREE.Vector3().addScaledVector(t.p[0], u).addScaledVector(t.p[1], v).addScaledVector(t.p[2], w));
  }
  for (const p of S) if (p.y > yMid) { const i = Math.min(N - 1, Math.floor((p.z - GB.min.z) / gs.z * N)); lo[i] = Math.min(lo[i], p.x); hi[i] = Math.max(hi[i], p.x); }
  const wid = lo.map((l, i) => hi[i] > l ? hi[i] - l : 0);
  const wmax = Math.max(...wid), band = wid.map(w => w > wmax * .9);
  let best = [0, 0], cur = null;
  band.forEach((b, i) => { if (b) { if (!cur) cur = [i, i]; else cur[1] = i; if (cur[1] - cur[0] > best[1] - best[0]) best = cur.slice(); } else cur = null; });
  const z0 = GB.min.z + best[0] / N * gs.z, z1 = GB.min.z + (best[1] + 1) / N * gs.z;
  const inCyl = S.filter(p => p.z > z0 && p.z < z1 && p.y > yMid);
  const cB = new THREE.Box3().setFromPoints(inCyl), rad = (cB.max.x - cB.min.x) / 2, cx = (cB.min.x + cB.max.x) / 2;
  // 실린더 축 높이: 좌우로 가장 튀어나온 점들의 높이
  const side = inCyl.filter(p => Math.abs(p.x - cx) > rad * .97), cy = side.reduce((v, p) => v + p.y, 0) / side.length, cz = (z0 + z1) / 2;
  // 4) 실린더 반지름을 설계와 같게, 손잡이(나무)를 설계 손잡이 위치에 맞춘다 (손 IK 기준)
  const scale = CR / rad;
  const wood = new THREE.Box3().setFromPoints(tris.filter(t => t.mat === 'DarkWood').flatMap(t => t.p));
  const dg = designBox(id, m => m.mat === 'woodGrip').getCenter(new THREE.Vector3()), gc = wood.getCenter(new THREE.Vector3());
  const off = new THREE.Vector3(-cx * scale, dg.y - gc.y * scale, dg.z - gc.z * scale);
  const axis = new THREE.Vector3(0, cy * scale + off.y, cz * scale + off.z), shift = axis.clone().sub(new THREE.Vector3(...cylAxis));
  const mats = {}, buckets = new Map();
  for (const name of Object.keys(REV_MATS)) mats['rev' + name] = new THREE.MeshStandardMaterial(Object.assign({ name: 'rev' + name }, REV_MATS[name]));
  const cz0 = z0 * scale + off.z - .001, cz1 = z1 * scale + off.z + .001;
  for (const t of tris) {
    const q = t.p.map(p => p.clone().multiplyScalar(scale).add(off));
    const c = q.reduce((v, p) => v.add(p), new THREE.Vector3()).divideScalar(3);
    const r = Math.hypot(c.x, c.y - axis.y);   // 실린더 축은 x = 0
    const part = c.z > cz0 && c.z < cz1 && r < CR * 1.08 ? 'cyl' : 'body';
    const mat = 'rev' + (REV_MATS[t.mat] ? t.mat : 'Metal');
    const k = part + '|' + mat;
    if (!buckets.has(k)) buckets.set(k, { part, mat, p: [], n: [], uv: [] });
    const out = buckets.get(k);
    q.forEach((p, i) => { p.toArray(out.p, out.p.length); t.n[i].toArray(out.n, out.n.length); out.uv.push(0, 0); });
  }
  const meshes = [];
  for (const out of buckets.values()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(out.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
    meshes.push({ part: out.part, mat: out.mat, geo });
  }
  // 5) 실린더 안의 탄 6발은 설계 모델의 것을 그대로 (같은 축·반지름)
  const built = design.build(), lib = (await import('./kit.js')).materials();
  for (const m of built.meshes) if (m.part === 'mag') { m.geo.translate(shift.x, shift.y, shift.z); meshes.push(m); mats[m.mat] = lib[m.mat]; }
  meta.extra.cylAxis = axis.toArray();
  meta.pivots.cyl = [0, meta.pivots.cyl[1] + shift.y, meta.pivots.cyl[2] + shift.z];
  meta.pivots.mag = [0, meta.pivots.mag[1] + shift.y, meta.pivots.mag[2] + shift.z];
  // 6) 기준점
  const all2 = meshes.flatMap(m => { const a = m.geo.attributes.position, r = []; for (let i = 0; i < a.count; i++) r.push(new THREE.Vector3().fromBufferAttribute(a, i)); return r; });
  const FB = new THREE.Box3().setFromPoints(all2);
  const tip = all2.filter(p => p.z < FB.min.z + .006);
  meta.muzzle = [0, tip.reduce((v, p) => v + p.y, 0) / tip.length, FB.min.z];
  const rear = all2.filter(p => p.z > cz1 && p.z < cz1 + .03 && Math.abs(p.x) < .006);
  meta.sight = [Math.max(...rear.map(p => p.y)) + .001, cz1 + .02];
  meta.credit = 'Ultimate Gun Pack / Quaternius (CC0)';
  meta.sourceAsset = IMPORTED[id];
  meta.license = 'CC0-1.0';
  return { meshes, mats, meta, tris: meshes.reduce((n, m) => n + m.geo.attributes.position.count / 3, 0) };
}
