// real.js — 실사 CC0 모델 정규화 (3DModelsCC0 "Free CC0 Guns & Explosives Pack")
//  원본 GLB 를 게임 총 공간(원점 = 방아쇠, 총구 -Z, 위 +Y, m)으로 옮기고
//  부품(body/mag/charge/bolt/pump) 분리, 텍스처 1K JPEG, 기준점(손·조준선·레일) 메타데이터를 붙인다.
//  측정값은 원본(수평 보정 후) 좌표 — 아래 코드가 방아쇠 기준으로 바꾼다.
import { THREE, Model, materials } from './kit.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;

export const REAL = {
  // KA-47 ← AK-47 (나무 개머리판, 곡선 탄창)
  ka47: {
    src: 'src/AK47.glb', cls: 'rifle', credit: 'AK-47 (3DModelsCC0)',
    part: n => /Magazine/i.test(n) ? 'mag' : /Ejection_Port/i.test(n) ? 'charge' : 'body',
    meta: T => ({
      muzzle: [T.x, -0.006, -0.316],
      sight: [0.0395, 0.07],                 // 가늠자(리시버 앞) — 가늠쇠 끝 높이와 같다
      rail: [0.029, 0.2],                    // 덮개 위
      fore: [T.x - 0.006, -0.035, -0.04],    // 나무 총열 덮개 아래
      magDir: [0, -0.97, -0.24]              // 앞으로 젖히며 빠진다
    }),
    charge: [0.008, 0.004, 0]                // 장전 손잡이 끝(오른쪽) 기준 손 위치 보정
  },
  // KR-98 ← Sniper (볼트액션, 일체형 조준경은 빼고 게임 조준경을 레일에)
  kr98: {
    src: 'src/Sniper.glb', cls: 'rifle', credit: 'Sniper Rifle (3DModelsCC0)',
    rx: -0.1859,                             // 원본이 10.6° 기울어져 있음 → 총열 수평
    remove: /Scope/i,
    move: { Magazine: [0, 0.054, 0] },       // 원본 탄창이 아래로 떨어져 있음 → 탄창 구멍 안으로
    part: n => /Magazine/i.test(n) ? 'mag' : /Bolt/i.test(n) ? 'bolt' : 'body',
    meta: T => ({
      muzzle: [-0.0037, 0.0285, -0.523],
      sight: [0.057, -0.03],                 // 가늠쇠(총구) 끝 높이, 가늠자는 아래에서 추가
      rail: [0.0445, 0.15],
      fore: [-0.0097, -0.024, -0.06],
      bolt: [-0.0037, 0.0285, 0.2],          // 볼트 회전축 = 총열 축
      magDir: [0, -1, 0],
      ironDist: 0.46
    }),
    charge: [0.006, 0, 0.004],
    // 가늠자: 총열 위 (조준경을 달면 숨김)
    extra(M, T) {
      const y0 = 0.0375 - T.y, z = -0.03 - T.z, top = 0.0612 - T.y, notch = 0.057 - T.y;
      M.side('rearsight', 'dark', [[z - 0.012, y0], [z + 0.012, y0], [z + 0.012, y0 + 0.006], [z + 0.004, y0 + 0.008], [z + 0.002, top], [z - 0.004, top], [z - 0.008, y0 + 0.006]], 0.016, { x: -0.0037 - T.x, r: 0.001 });
      for (const s of [-1, 1]) M.rbox('rearsight', 'dark', 0.0045, top - notch + 0.002, 0.005, -0.0037 - T.x + s * 0.0045, notch + (top - notch) / 2 + 0.001, z - 0.001, { r: 0.0008 });
    }
  },
  // S-12 ← Shotgun (펌프액션, 나무 포엔드가 펌프)
  s12: {
    src: 'src/Shotgun.glb', cls: 'shotgun', credit: 'Shotgun (3DModelsCC0)',
    part: n => /Fore_Stock/i.test(n) ? 'pump' : 'body',
    meta: T => ({
      muzzle: [0, 0.029, -0.405],
      sight: [0.057, 0.30],                  // 가늠쇠(구슬) 높이로 리시버 위를 따라 조준
      rail: [0.047, 0.30],
      port: [0, -0.027, 0.29],               // 리시버 아래 장전구
      magDir: [0, -1, 0]
    })
  }
};

// 원본 텍스처 → 1K 캔버스 (DirectX 법선 맵은 G 반전)
function shrink(tex, flipG, size = 1024) {
  if (!tex || !tex.image) return null;
  const img = tex.image, c = document.createElement('canvas');
  c.width = Math.min(size, img.width); c.height = Math.min(size, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  if (flipG) {
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 1; i < d.data.length; i += 4) d.data[i] = 255 - d.data[i];
    ctx.putImageData(d, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  t.userData.mimeType = 'image/jpeg';
  return t;
}

export async function buildReal(id, base) {
  const C = REAL[id];
  const gltf = await new GLTFLoader().loadAsync(base + C.src);
  const root = gltf.scene;
  root.rotation.x = C.rx || 0;
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse(o => { if (o.isMesh && !(C.remove && C.remove.test(o.name))) meshes.push(o); });
  // 방아쇠 중심 (수평 보정 후)
  const trg = meshes.find(m => /Trigger/i.test(m.name));
  const T = new THREE.Box3().setFromObject(trg).getCenter(new V3());
  const parts = {};
  let srcMat = null;
  for (const m of meshes) {
    srcMat = srcMat || m.material;
    const g = m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(m.matrixWorld);
    const mv = C.move && Object.keys(C.move).find(k => new RegExp(k, 'i').test(m.name));
    if (mv) g.translate(...C.move[mv]);
    g.translate(-T.x, -T.y, -T.z);
    const p = C.part(m.name);
    (parts[p] || (parts[p] = [])).push(g.index ? g : g);
  }
  const merged = {};
  for (const k in parts) { merged[k] = parts[k].length === 1 ? parts[k][0] : mergeGeometries(parts[k].map(g => g.index ? g : g), false); merged[k].computeBoundingBox(); }
  // 재질: 1K JPEG
  const mat = new THREE.MeshStandardMaterial({ name: 'm' });
  mat.map = shrink(srcMat.map, false);
  mat.normalMap = shrink(srcMat.normalMap, true);
  const mr = shrink(srcMat.roughnessMap || srcMat.metalnessMap, false);
  mat.roughnessMap = mr; mat.metalnessMap = mr;
  mat.roughness = srcMat.roughness; mat.metalness = srcMat.metalness;
  if (srcMat.normalScale) mat.normalScale.copy(srcMat.normalScale);
  // 기준점 (원본 좌표 → 방아쇠 기준)
  const raw = C.meta(T);
  const P = a => [a[0] - T.x, a[1] - T.y, a[2] - T.z];
  const meta = { cls: C.cls, credit: C.credit, pivots: {}, extra: {} };
  meta.muzzle = P(raw.muzzle);
  meta.sight = raw.sight ? [raw.sight[0] - T.y, raw.sight[1] - T.z] : null;
  meta.rail = raw.rail ? [raw.rail[0] - T.y, raw.rail[1] - T.z, 'body'] : null;
  meta.magDir = raw.magDir;
  if (raw.ironDist) meta.ironDist = raw.ironDist;
  if (raw.port) meta.port = P(raw.port);
  const bb = k => merged[k] && merged[k].boundingBox;
  if (merged.mag) {
    // 탄창 윗면 중심
    const pa = merged.mag.attributes.position, top = bb('mag').max.y;
    let zs = 0, n = 0;
    for (let i = 0; i < pa.count; i++) if (pa.getY(i) > top - 0.008) { zs += pa.getZ(i); n++; }
    meta.pivots.mag = [0, top, zs / n];
  }
  if (merged.charge || merged.bolt) {
    const g = merged.charge || merged.bolt, pa = g.attributes.position;
    let best = -1e9, k = new V3();
    for (let i = 0; i < pa.count; i++) if (pa.getX(i) > best) { best = pa.getX(i); k.fromBufferAttribute(pa, i); }
    const off = C.charge || [0, 0, 0];
    meta.charge = [k.x + off[0], k.y + off[1], k.z + off[2]];
    if (merged.charge) meta.pivots.charge = bb('charge').getCenter(new V3()).toArray();
  }
  if (raw.bolt) meta.pivots.bolt = P(raw.bolt);
  if (merged.pump) {
    const c = bb('pump').getCenter(new V3());
    meta.pivots.pump = c.toArray();
    meta.fore = [c.x - 0.005, c.y - 0.012, c.z];
  } else meta.fore = P(raw.fore);
  const out = Object.keys(merged).map(k => ({ part: k, mat: 'm', geo: merged[k] }));
  const mats = { m: mat };
  if (C.extra) {
    const M = new Model(id);
    C.extra(M, T);
    const r = M.build();
    const lib = materials();
    for (const e of r.meshes) { out.push(e); mats[e.mat] = lib[e.mat]; }
  }
  // 실사 메시와 추가 메시의 속성을 맞춘다 (position/normal/uv)
  return { meshes: out, mats, meta };
}
