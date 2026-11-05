// kit.js — 총기 모델 제작 도구 (브라우저 ES 모듈)
//  · 옆/위/앞 단면을 둥글게 다듬어 돌출(베벨)시키는 모델러, 선반(lathe), 레일·나사 같은 부품
//  · 질감(나뭇결·미세 요철·그립 돌기) 생성, 공통 재질
//  · 결과를 게임용 GLB 로 내보내기 (메시 userData.part = 부품, 재질 이름 = 재질 키, scene.userData.lz = 기준점)
// 좌표: 총 공간 (m), 원점 = 방아쇠, 총구 -Z, 위 +Y, 오른쪽 +X
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const V2 = THREE.Vector2, V3 = THREE.Vector3;
export { THREE };

/* ------------------------------------------------------------------ */
/* 단면 다듬기                                                          */
/* ------------------------------------------------------------------ */
// 닫힌 다각형의 꼭짓점을 둥글게: pts = [[u, v, r?], ...]  (r 생략 시 defR)
export function fillet(pts, defR = 0, seg = 4) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const r = p[2] !== undefined ? p[2] : defR;
    const P = new V2(p[0], p[1]);
    if (!r) { out.push(P); continue; }
    const d1 = new V2(a[0] - p[0], a[1] - p[1]), d2 = new V2(b[0] - p[0], b[1] - p[1]);
    const l1 = d1.length(), l2 = d2.length();
    if (l1 < 1e-6 || l2 < 1e-6) { out.push(P); continue; }
    d1.divideScalar(l1); d2.divideScalar(l2);
    const ang = Math.acos(THREE.MathUtils.clamp(d1.dot(d2), -1, 1));
    if (ang < 1e-3 || Math.PI - ang < 1e-3) { out.push(P); continue; }
    let t = r / Math.tan(ang / 2), rr = r;
    const tmax = Math.min(l1, l2) * 0.5;
    if (t > tmax) { t = tmax; rr = t * Math.tan(ang / 2); }
    const p1 = P.clone().addScaledVector(d1, t), p2 = P.clone().addScaledVector(d2, t);
    const C = P.clone().addScaledVector(d1.clone().add(d2).normalize(), rr / Math.sin(ang / 2));
    const a1 = Math.atan2(p1.y - C.y, p1.x - C.x);
    let da = Math.atan2(p2.y - C.y, p2.x - C.x) - a1;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const s = Math.max(1, Math.round(seg * Math.abs(da) / (Math.PI / 2)));
    for (let k = 0; k <= s; k++) { const aa = a1 + da * k / s; out.push(new V2(C.x + Math.cos(aa) * rr, C.y + Math.sin(aa) * rr)); }
  }
  return out;
}
// 원호 점들 (단면 정의용): 중심 (cu, cv), 반지름 r, 각도 a0→a1 (라디안)
export function arc(cu, cv, r, a0, a1, n = 6) {
  const o = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r, 0]); }
  return o;
}

function extrudeShape(pts, holes, depth, o) {
  const seg = o.seg || 4;
  const sh = new THREE.Shape(fillet(pts, o.r || 0, seg));
  for (const h of holes || []) sh.holes.push(new THREE.Path(fillet(h, o.hr !== undefined ? o.hr : (o.r || 0), seg)));
  const bv = Math.min(o.bevel !== undefined ? o.bevel : 0.0012, depth * 0.3);
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: Math.max(1e-4, depth - 2 * bv), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv, bevelOffset: -bv,
    bevelSegments: o.bs || 2, curveSegments: 3
  });
  g.translate(0, 0, bv);
  return g;
}

/* ------------------------------------------------------------------ */
/* 모델러                                                               */
/* ------------------------------------------------------------------ */
const PERM_TOP = new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
export class Model {
  constructor(id) { this.id = id; this.list = []; this.meta = { pivots: {}, extra: {} }; }
  add(part, mat, g, xf) {
    if (xf) g.applyMatrix4(xf);
    this.list.push({ part, mat, geo: g });
    return g;
  }
  // 회전 (도 단위가 아니라 라디안), 기준점 c 를 중심으로
  _rot(g, o) {
    if (!(o.rx || o.ry || o.rz)) return g;
    const c = o.pivot || [0, 0, 0];
    g.translate(-c[0], -c[1], -c[2]);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0)));
    g.translate(c[0], c[1], c[2]);
    return g;
  }
  // 옆 단면 [[z, y, r?]] 를 x 방향 두께 w 로 (중심 x)
  side(part, mat, pts, w, o = {}) {
    const g = extrudeShape(pts, o.holes, w, o);
    g.rotateY(-Math.PI / 2).translate(w / 2 + (o.x || 0), 0, 0);
    return this.add(part, mat, this._rot(g, o));
  }
  // 위 단면 [[z, x, r?]] 를 y 방향 높이 h 로 (바닥 y)
  top(part, mat, pts, h, o = {}) {
    const g = extrudeShape(pts, o.holes, h, o);
    g.applyMatrix4(PERM_TOP).translate(0, o.y || 0, 0);
    return this.add(part, mat, this._rot(g, o));
  }
  // 앞 단면 [[x, y, r?]] 를 z0→z1 로
  front(part, mat, pts, z0, z1, o = {}) {
    const g = extrudeShape(pts, o.holes, Math.abs(z1 - z0), o);
    g.translate(0, 0, Math.min(z0, z1));
    return this.add(part, mat, this._rot(g, o));
  }
  // 선반: prof [[z, r], ...] (앞→뒤), 축 (x, y) — 각지게 하려면 같은 점을 두 번
  lathe(part, mat, prof, o = {}) {
    const pts = prof.map(p => new V2(Math.max(0, p[1]), p[0]));
    const g = new THREE.LatheGeometry(pts, o.seg || 16, o.phi || 0, o.len || Math.PI * 2);
    g.rotateX(Math.PI / 2);                 // 선반 축 y → z (h 가 그대로 z)
    g.translate(o.x || 0, o.y || 0, 0);
    return this.add(part, mat, this._rot(g, o));
  }
  // 원기둥 (z 축)
  tube(part, mat, r, z0, z1, o = {}) {
    const a = Math.min(z0, z1), b = Math.max(z0, z1), r1 = o.r1 !== undefined ? o.r1 : r;
    const prof = o.open ? [[a, r], [b, r1]] : [[a, 0], [a, r], [a, r], [b, r1], [b, r1], [b, 0]];
    return this.lathe(part, mat, prof, o);
  }
  // 원기둥 (x 축 / y 축)
  cylX(part, mat, r, len, x, y, z, o = {}) {
    const g = new THREE.CylinderGeometry(r, o.r1 !== undefined ? o.r1 : r, len, o.seg || 12).rotateZ(Math.PI / 2).translate(x, y, z);
    return this.add(part, mat, this._rot(g, o));
  }
  cylY(part, mat, r, len, x, y, z, o = {}) {
    const g = new THREE.CylinderGeometry(o.r1 !== undefined ? o.r1 : r, r, len, o.seg || 12).translate(x, y, z);
    return this.add(part, mat, this._rot(g, o));
  }
  // 모서리 둥근 상자 (앞 단면 돌출)
  rbox(part, mat, w, h, d, x, y, z, o = {}) {
    const r = Math.min(o.r !== undefined ? o.r : 0.0015, w * 0.45, h * 0.45);
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    const g = extrudeShape(pts, null, d, { r, bevel: Math.min(r, d * 0.3), seg: 2 });
    g.translate(x, y, z - d / 2);
    return this.add(part, mat, this._rot(g, o));
  }
  box(part, mat, w, h, d, x, y, z, o = {}) {
    const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    return this.add(part, mat, this._rot(g, o));
  }
  sphere(part, mat, r, x, y, z, o = {}) {
    const g = new THREE.SphereGeometry(r, o.seg || 12, o.seg2 || 8).scale(o.sx || 1, o.sy || 1, o.sz || 1).translate(x, y, z);
    return this.add(part, mat, g);
  }
  // 피카티니 레일: 윗면 y, z0~z1 (z0 < z1), 폭 w
  rail(part, mat, y, z0, z1, w = 0.0212, o = {}) {
    const x = o.x || 0, rot = o.rz || 0, base = 0.004, tooth = 0.003;
    const xf = rot ? new THREE.Matrix4().makeTranslation(x, y, 0).multiply(new THREE.Matrix4().makeRotationZ(rot)).multiply(new THREE.Matrix4().makeTranslation(-x, -y, 0)) : null;
    // 사다리꼴 받침
    const prof = [[x - w / 2 + 0.0015, y - base - tooth], [x + w / 2 - 0.0015, y - base - tooth], [x + w / 2, y - tooth - 0.0015], [x + w / 2 - 0.001, y - tooth], [x - w / 2 + 0.001, y - tooth], [x - w / 2, y - tooth - 0.0015]];
    const g = extrudeShape(prof, null, z1 - z0, { bevel: 0.0004 });
    g.translate(0, 0, z0);
    this.add(part, mat, g, xf);
    const n = Math.max(1, Math.floor((z1 - z0) / 0.01));
    const pad = ((z1 - z0) - n * 0.01) / 2;
    for (let i = 0; i < n; i++) {
      const zc = z0 + pad + 0.01 * i + 0.005;
      const tg = extrudeShape([[x - w / 2 + 0.001, 0], [x + w / 2 - 0.001, 0], [x + w / 2 - 0.0025, tooth], [x - w / 2 + 0.0025, tooth]], null, 0.0053, { bevel: 0.0003 });
      tg.translate(0, y - tooth, zc - 0.00265);
      this.add(part, mat, tg, xf);
    }
  }
  // 나사 머리 (축 방향 'x'|'y'|'z' 에 수직인 원판)
  screw(part, mat, x, y, z, r = 0.0025, axis = 'x', s = 1) {
    const g = new THREE.CylinderGeometry(r, r * 0.92, 0.0016, 10);
    if (axis === 'x') g.rotateZ(-Math.PI / 2 * s); else if (axis === 'z') g.rotateX(Math.PI / 2 * s);
    g.translate(x, y, z);
    return this.add(part, mat, g);
  }
  // 톱니 홈 (슬라이드 세레이션): 옆면에 얇은 홈들 — 실제로는 튀어나온 능선을 붙인다
  serr(part, mat, x, y0, y1, z0, z1, n, depth = 0.0008) {
    for (let i = 0; i < n; i++) {
      const z = z0 + (z1 - z0) * (i + 0.5) / n, w = Math.abs(z1 - z0) / n * 0.45;
      for (const s of [-1, 1]) this.box(part, mat, depth, y1 - y0, w, s * x, (y0 + y1) / 2, z);
    }
  }
  // 결과: 부품·재질별 병합, 부드러운 법선(주름각), 상자 투영 UV
  build(crease = 0.75, uvScale = 5) {
    const groups = {};
    for (const it of this.list) {
      let g = it.geo;
      for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
      if (g.index) g = g.toNonIndexed();
      const key = it.part + '|' + it.mat;
      (groups[key] || (groups[key] = [])).push(g);
    }
    const out = [];
    let tris = 0;
    for (const key in groups) {
      const [part, mat] = key.split('|');
      let g = groups[key].length === 1 ? groups[key][0] : mergeGeometries(groups[key], false);
      g = toCreasedNormals(g, crease);
      boxUV(g, uvScale);
      g.computeBoundingBox();
      tris += g.attributes.position.count / 3;
      out.push({ part, mat, geo: g });
    }
    return { meshes: out, tris };
  }
}

// 상자 투영 UV (정점 법선의 주축 기준): 옆면 (z, y) / 위아래 (z, x) / 앞뒤 (x, y)
export function boxUV(g, s) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getZ(i); v = p.getX(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * s; uv[i * 2 + 1] = v * s;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/* ------------------------------------------------------------------ */
/* 질감                                                                 */
/* ------------------------------------------------------------------ */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// 타일링 값 잡음 (주기 p)
function valueNoise(size, p, seed) {
  const r = rng(seed), g = new Float32Array(p * p);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = x / size * p, fy = y / size * p, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g[(y0 % p) * p + x0 % p], b = g[(y0 % p) * p + (x0 + 1) % p], c = g[((y0 + 1) % p) * p + x0 % p], d = g[((y0 + 1) % p) * p + (x0 + 1) % p];
    out[y * size + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
  return out;
}
function canvasTex(w, h, fill, srgb) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
  fill(img.data, w, h);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.userData.mimeType = 'image/jpeg';
  return t;
}
const TEX = {};
export function textures() {
  if (TEX.noise) return TEX;
  // 미세 요철·얼룩 (G: 거칠기 배율, B: 금속 배율)
  const n1 = valueNoise(256, 64, 11), n2 = valueNoise(256, 8, 23), n3 = valueNoise(256, 128, 37);
  TEX.noise = canvasTex(256, 256, (d) => {
    for (let i = 0; i < 256 * 256; i++) {
      const v = 0.8 + 0.12 * n2[i] + 0.06 * n1[i] + 0.05 * n3[i];
      d[i * 4] = 255; d[i * 4 + 1] = Math.min(255, v * 255); d[i * 4 + 2] = 255; d[i * 4 + 3] = 255;
    }
  });
  // 호두나무 결 (u = 총 길이 방향)
  const w1 = valueNoise(512, 16, 51), w2 = valueNoise(512, 64, 52);
  TEX.wood = canvasTex(512, 512, (d) => {
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = y * 512 + x;
      const warp = w1[i] * 7 + w2[i] * 1.2;
      const ring = 0.5 + 0.5 * Math.sin((y / 512) * Math.PI * 2 * 40 + warp);
      const fine = w2[(y * 512 + ((x * 7) & 511))] * 0.12;
      const k = Math.pow(ring, 4) * 0.38 + fine + w1[i] * 0.18;
      const r = 104 - 46 * k, g = 62 - 30 * k, b = 32 - 15 * k;
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
  }, true);
  // 그립 돌기 (법선 맵)
  const st = valueNoise(128, 32, 77);
  TEX.stipple = canvasTex(128, 128, (d) => {
    const h = (x, y) => st[((y + 128) % 128) * 128 + (x + 128) % 128];
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 3, dy = (h(x, y + 1) - h(x, y - 1)) * 3;
      const l = Math.hypot(dx, dy, 1), i = y * 128 + x;
      d[i * 4] = (-dx / l * 0.5 + 0.5) * 255; d[i * 4 + 1] = (dy / l * 0.5 + 0.5) * 255; d[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
    }
  });
  // 체크무늬 (나무·금속 손잡이 격자)
  TEX.knurl = canvasTex(64, 64, (d) => {
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const u = (x / 64) * Math.PI * 2 * 4, v = (y / 64) * Math.PI * 2 * 4;
      const dx = Math.cos(u + v) * 0.55 + Math.cos(u - v) * 0.55, dy = Math.cos(u + v) * 0.55 - Math.cos(u - v) * 0.55;
      const l = Math.hypot(dx, dy, 1), i = y * 64 + x;
      d[i * 4] = (-dx / l * 0.5 + 0.5) * 255; d[i * 4 + 1] = (dy / l * 0.5 + 0.5) * 255; d[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
    }
  });
  // 표면경화 강철 (중절식 산탄총 기관부): 푸른·갈색 얼룩
  const c1 = valueNoise(256, 6, 91), c2 = valueNoise(256, 16, 92);
  TEX.cased = canvasTex(256, 256, (d) => {
    for (let i = 0; i < 256 * 256; i++) {
      const a = c1[i], b = c2[i];
      const r = 70 + 70 * a + 30 * b, g = 62 + 40 * b + 20 * a, bl = 70 + 70 * (1 - a) * b;
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = bl; d[i * 4 + 3] = 255;
    }
  }, true);
  return TEX;
}

// 공통 재질 (키 = 재질 이름)
export function materials() {
  const T = textures();
  const std = (name, o, rough) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ name }, o));
    if (rough !== false) { m.roughnessMap = T.noise; m.metalnessMap = T.noise; }
    return m;
  };
  const rep = (t, n) => { const c = t.clone(); c.repeat.set(n, n); c.userData = Object.assign({}, t.userData); return c; };
  return {
    metal: std('metal', { color: 0x2c2e33, metalness: 0.78, roughness: 0.42 }),      // 블루잉 강철
    dark: std('dark', { color: 0x1d1e21, metalness: 0.55, roughness: 0.55 }),        // 파커라이징
    alu: std('alu', { color: 0x26272b, metalness: 0.6, roughness: 0.4 }),            // 검정 아노다이징
    tan: std('tan', { color: 0x8c7654, metalness: 0.12, roughness: 0.6 }),           // FDE
    olive: std('olive', { color: 0x4a5232, metalness: 0.08, roughness: 0.65 }),
    poly: std('poly', { color: 0x18191b, metalness: 0.0, roughness: 0.66 }),         // 폴리머
    grip: std('grip', { color: 0x1b1b1d, metalness: 0.0, roughness: 0.8, normalMap: rep(T.stipple, 16), normalScale: new THREE.Vector2(0.45, 0.45) }),
    tanGrip: std('tanGrip', { color: 0x8c7654, metalness: 0.0, roughness: 0.75, normalMap: rep(T.stipple, 16), normalScale: new THREE.Vector2(0.45, 0.45) }),
    rubber: std('rubber', { color: 0x141415, metalness: 0.0, roughness: 0.88, normalMap: rep(T.stipple, 10), normalScale: new THREE.Vector2(0.35, 0.35) }),
    wood: std('wood', { color: 0xffffff, map: T.wood, metalness: 0.0, roughness: 0.48 }),
    woodGrip: std('woodGrip', { color: 0xffffff, map: T.wood, metalness: 0.0, roughness: 0.55, normalMap: rep(T.knurl, 14), normalScale: new THREE.Vector2(0.7, 0.7) }),
    steel: std('steel', { color: 0x9a9fa5, metalness: 0.85, roughness: 0.3 }),       // 스테인리스
    chrome: std('chrome', { color: 0xc4c8cd, metalness: 1.0, roughness: 0.16 }),
    cased: std('cased', { color: 0xffffff, map: T.cased, metalness: 0.85, roughness: 0.33 }),
    brass: std('brass', { color: 0xc9a040, metalness: 1.0, roughness: 0.3 }),
    shell: std('shell', { color: 0x9c2020, metalness: 0.0, roughness: 0.5 }),
    white: std('white', { color: 0xe6e6de, metalness: 0.0, roughness: 0.5 }, false),
    fiber: std('fiber', { color: 0x40ff50, emissive: 0x18a020, metalness: 0.0, roughness: 0.4 }, false),
    lens: std('lens', { color: 0x1a2a34, metalness: 0.2, roughness: 0.1 }, false)
  };
}

/* ------------------------------------------------------------------ */
/* 내보내기                                                             */
/* ------------------------------------------------------------------ */
// meshes: [{part, mat, geo}], mats: {key: Material}, meta: 기준점 (총 공간)
export async function exportGLB(id, meshes, mats, meta, opts = {}) {
  const scene = new THREE.Scene();
  scene.name = id;
  const root = new THREE.Group(); root.name = id; scene.add(root);
  let i = 0;
  for (const m of meshes) {
    const mat = mats[m.mat];
    if (!mat) throw new Error(id + ': 재질 없음 ' + m.mat);
    const mesh = new THREE.Mesh(m.geo, mat);
    mesh.name = m.part + '_' + m.mat + '_' + (i++);
    mesh.userData = { part: m.part };
    root.add(mesh);
  }
  root.userData = { lz: meta };
  const ex = new GLTFExporter();
  const buf = await ex.parseAsync(scene, { binary: true, maxTextureSize: opts.maxTextureSize || 1024 });
  return new Uint8Array(buf);
}

// 메타데이터 정리: V3 → 배열, 소수 5자리
export function cleanMeta(meta) {
  const f = (v) => Array.isArray(v) ? v.map(f) : v && v.isVector3 ? [f(v.x), f(v.y), f(v.z)] : typeof v === 'number' ? +v.toFixed(5) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, f(x)])) : v;
  return f(meta);
}
