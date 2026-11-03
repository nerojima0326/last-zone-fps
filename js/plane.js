// plane.js — 수송기 모델 (C-130 계열 4발 터보프롭). 절차적으로 매끈한 동체·날개·엔진을 만든다
(function () {
'use strict';
const THREE = window.THREE, G = window.G;
const V3 = THREE.Vector3;

/* ---------------- 동체 단면 ---------------- */
const R = 2.5;                         // 동체 반지름
const Z0 = -18, Z1 = 19.2;             // 기수 끝 ~ 꼬리 끝 (기수는 -z 쪽)
// z 위치의 단면: 반폭 w, 반높이 h, 중심 높이 c
function section(z) {
  if (z < -12) {                       // 둥근 기수 (살짝 아래로 처짐)
    const s = Math.min(1, (-12 - z) / (-12 - Z0));
    const k = Math.pow(Math.max(0, 1 - Math.pow(s, 2.3)), 0.5);
    const w = Math.max(0.04, R * k), h = Math.max(0.04, R * 1.04 * k);
    return { w, h, c: -0.55 * R * s * s };
  }
  if (z <= 7) return { w: R, h: R * 1.04, c: 0 };
  // 위로 들린 꼬리 (윗면은 거의 평평, 아랫면이 올라감 = 화물 램프)
  const s = Math.min(1, (z - 7) / (Z1 - 7));
  const h = R * 1.04 * (1 - 0.8 * Math.pow(s, 0.95));
  const w = R * (1 - 0.82 * Math.pow(s, 1.1));
  const top = R * 1.04 * (1 - 0.1 * s);
  return { w, h, c: top - h };
}
// 둥근 사각형(슈퍼타원) 단면 위의 점. th: 위(0)에서 시계 방향 각도
const E = 0.82;
const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
function surf(z, th, off, out) {
  const S = section(z);
  const sx = sp(Math.sin(th), E), sy = sp(Math.cos(th), E);
  const x = S.w * sx, y = S.h * sy;
  const n = Math.hypot(sx, sy) || 1;
  return out.set(x + (sx / n) * (off || 0), S.c + y + (sy / n) * (off || 0), z);
}

// z 구간 [z0,z1] × 각도 [t0,t1] 의 곡면 조각 (창문·문 등)
function patch(z0, z1, t0, t1, off, nz, nt) {
  nz = nz || 4; nt = nt || 6;
  const pos = [], uv = [], idx = [], p = new V3();
  for (let i = 0; i <= nz; i++) {
    const z = z0 + (z1 - z0) * i / nz;
    for (let j = 0; j <= nt; j++) {
      surf(z, t0 + (t1 - t0) * j / nt, off, p);
      pos.push(p.x, p.y, p.z); uv.push(j / nt, i / nz);
    }
  }
  for (let i = 0; i < nz; i++) for (let j = 0; j < nt; j++) {
    const a = i * (nt + 1) + j, b = a + nt + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function fuselageGeo() {
  // 기수·꼬리는 촘촘하게
  const zs = [];
  for (let i = 0; i <= 18; i++) zs.push(Z0 + (6 * (1 - Math.cos(i / 18 * Math.PI / 2))));   // -18 ~ -12
  for (let z = -11; z <= 7; z += 1) zs.push(z);
  for (let i = 1; i <= 16; i++) zs.push(7 + (Z1 - 7) * i / 16);
  const NT = 40, pos = [], uv = [], idx = [], p = new V3();
  zs.forEach((z, i) => {
    for (let j = 0; j <= NT; j++) {
      surf(z, j / NT * Math.PI * 2, 0, p);
      pos.push(p.x, p.y, p.z); uv.push(j / NT, (z - Z0) / (Z1 - Z0));
    }
  });
  for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < NT; j++) {
    const a = i * (NT + 1) + j, b = a + NT + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  // 꼬리 끝 마개
  const last = (zs.length - 1) * (NT + 1), S = section(Z1), ci = pos.length / 3;
  pos.push(0, S.c, Z1 + 0.05); uv.push(0.5, 1);
  for (let j = 0; j < NT; j++) idx.push(last + j, ci, last + j + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // 이음매(0°=360°) 법선 맞추기
  const n = g.attributes.normal;
  for (let i = 0; i < zs.length; i++) {
    const a = i * (NT + 1), b = a + NT;
    const x = (n.getX(a) + n.getX(b)) / 2, y = (n.getY(a) + n.getY(b)) / 2, z = (n.getZ(a) + n.getZ(b)) / 2;
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

/* ---------------- 날개 (에어포일 로프트) ---------------- */
// 닫힌 에어포일 단면 (뒷전 → 윗면 → 앞전 → 아랫면 → 뒷전)
const makeFoil = (camber) => {
  const N = 14, pts = [];
  const yt = t => 5 * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
  const cam = t => camber * Math.sin(Math.PI * t);
  for (let i = N; i >= 0; i--) { const t = (1 - Math.cos(i / N * Math.PI)) / 2; pts.push([t, cam(t) * 3 + yt(t)]); }
  for (let i = 1; i < N; i++) { const t = (1 - Math.cos(i / N * Math.PI)) / 2; pts.push([t, cam(t) * 3 - yt(t)]); }
  return pts;
};
const AIRFOIL = makeFoil(0.03), FOIL_SYM = makeFoil(0);
// sections: [{ le: V3 앞전, chord, thick, cd: 시위 방향, up: 두께 방향 }]
function loft(sections, sym) {
  const F = sym ? FOIL_SYM : AIRFOIL;
  const P = F.length, pos = [], idx = [];
  for (const s of sections) {
    for (const [t, y] of F) {
      pos.push(s.le.x + s.cd.x * t * s.chord + s.up.x * y * s.thick,
               s.le.y + s.cd.y * t * s.chord + s.up.y * y * s.thick,
               s.le.z + s.cd.z * t * s.chord + s.up.z * y * s.thick);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < P; j++) {
    const a = i * P + j, b = i * P + (j + 1) % P, c = a + P, d = b + P;
    idx.push(a, c, b, b, c, d);
  }
  // 양 끝 마개
  for (const [si, flip] of [[0, true], [sections.length - 1, false]]) {
    const s = sections[si], ci = pos.length / 3;
    pos.push(s.le.x + s.cd.x * 0.4 * s.chord, s.le.y + s.cd.y * 0.4 * s.chord, s.le.z + s.cd.z * 0.4 * s.chord);
    for (let j = 0; j < P; j++) {
      const a = si * P + j, b = si * P + (j + 1) % P;
      if (flip) idx.push(a, b, ci); else idx.push(b, a, ci);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  // 부드러운 음영을 위해 위치가 같은 정점의 법선을 합친다
  return ng;
}
function smoothNormals(g) {
  const p = g.attributes.position, n = g.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
    let e = map.get(k); if (!e) map.set(k, e = { x: 0, y: 0, z: 0, list: [] });
    e.list.push(i);
  }
  for (const e of map.values()) {
    // 각이 크게 꺾이는 곳(뒷전·마개)은 그대로 둔다
    for (const i of e.list) {
      let x = 0, y = 0, z = 0;
      for (const j of e.list) {
        const d = n.getX(i) * n.getX(j) + n.getY(i) * n.getY(j) + n.getZ(i) * n.getZ(j);
        if (d > 0.5) { x += n.getX(j); y += n.getY(j); z += n.getZ(j); }
      }
      const l = Math.hypot(x, y, z) || 1;
      e[i] = [x / l, y / l, z / l];
    }
    for (const i of e.list) n.setXYZ(i, e[i][0], e[i][1], e[i][2]);
  }
  return g;
}

/* ---------------- 동체 텍스처 (패널 선·리벳·그을음) ---------------- */
function bodyTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#6f776f'; x.fillRect(0, 0, 1024, 1024);
  // 은은한 얼룩
  for (let i = 0; i < 260; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.015 + Math.random() * 0.03})`;
    x.fillRect(Math.random() * 1024, Math.random() * 1024, 20 + Math.random() * 120, 6 + Math.random() * 40);
  }
  // 아랫면(u=0.5) 그을음
  const g = x.createLinearGradient(0, 0, 1024, 0);
  g.addColorStop(0.3, 'rgba(30,28,24,0)'); g.addColorStop(0.5, 'rgba(30,28,24,0.32)'); g.addColorStop(0.7, 'rgba(30,28,24,0)');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  // 패널 선: 세로(동체 둘레) / 가로(길이 방향)
  x.strokeStyle = 'rgba(25,28,32,0.28)'; x.lineWidth = 1.2;
  for (let v = 0; v < 1024; v += 1024 / 15) { x.beginPath(); x.moveTo(0, v); x.lineTo(1024, v); x.stroke(); }
  for (const u of [0.19, 0.36, 0.64, 0.81]) { x.beginPath(); x.moveTo(u * 1024, 0); x.lineTo(u * 1024, 1024); x.stroke(); }
  // 리벳
  x.fillStyle = 'rgba(20,22,26,0.18)';
  for (let v = 0; v < 1024; v += 1024 / 15) for (let u = 0; u < 1024; u += 9) x.fillRect(u, v + 4, 1.6, 1.6);
  // 옆면 띠 (u≈0.25, 0.75)
  x.fillStyle = 'rgba(40,46,50,0.55)';
  x.fillRect(0.245 * 1024, 0, 10, 1024); x.fillRect(0.755 * 1024 - 10, 0, 10, 1024);
  // 기수 윗면 눈부심 방지 도장 (u≈0/1, v 0~0.15 → 캔버스 아래쪽)
  x.fillStyle = '#2b2f33';
  x.fillRect(0, 1024 * 0.86, 120, 1024 * 0.14); x.fillRect(1024 - 120, 1024 * 0.86, 120, 1024 * 0.14);
  // 꼬리 띠
  x.fillStyle = 'rgba(200,170,40,0.75)'; x.fillRect(0, 1024 * 0.2, 1024, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/* ---------------- 조립 ---------------- */
let MAT = null;
function mats() {
  if (MAT) return MAT;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  MAT = {
    hull: std({ map: bodyTexture(), metalness: 0.35, roughness: 0.55 }),
    body: std({ color: 0x6f776f, metalness: 0.35, roughness: 0.55 }),
    dark: std({ color: 0x2c3035, metalness: 0.4, roughness: 0.6 }),
    black: std({ color: 0x15171a, metalness: 0.3, roughness: 0.7 }),
    prop: std({ color: 0x1b1d20, metalness: 0.2, roughness: 0.6 }),
    tip: std({ color: 0xd9b52a, metalness: 0.2, roughness: 0.5 }),
    spin: std({ color: 0x9aa1a7, metalness: 0.7, roughness: 0.35 }),
    glass: std({ color: 0x12202c, metalness: 0.7, roughness: 0.28 }),
    soot: std({ color: 0x232120, metalness: 0.1, roughness: 0.9 }),
    disc: new THREE.MeshBasicMaterial({ color: 0x1a1c1f, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
    red: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.15, 0.1) }),
    green: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 3.5, 0.4) }),
    white: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) }),
    beacon: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.15, 0.1) })
  };
  return MAT;
}

G.buildPlane = function () {
  const M = mats();
  const g = new THREE.Group(), props = [];
  const add = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; (parent || g).add(o); return o; };

  // 동체
  add(fuselageGeo(), M.hull);
  // 조종석 창 (앞유리 6장 + 옆창 + 눈썹창)
  const deg = Math.PI / 180;
  const wb = [-66, -44, -22, 0, 22, 44, 66];
  for (let i = 0; i < wb.length - 1; i++) add(patch(-16.1, -14.75, (wb[i] + 1.5) * deg, (wb[i + 1] - 1.5) * deg, 0.03), M.glass);
  for (const s of [1, -1]) {
    add(patch(-14.55, -13.4, s > 0 ? 70 * deg : -96 * deg, s > 0 ? 96 * deg : -70 * deg, 0.03), M.glass);
    add(patch(-13.2, -12.4, s > 0 ? 66 * deg : -92 * deg, s > 0 ? 92 * deg : -66 * deg, 0.03), M.glass);
    add(patch(-14.4, -13.6, s > 0 ? 18 * deg : -46 * deg, s > 0 ? 46 * deg : -18 * deg, 0.03), M.glass);
    // 객실 둥근 창
    for (let z = -9; z <= 5; z += 2.3) add(patch(z, z + 0.55, s * 74 * deg, s * 84 * deg, 0.02, 2, 2), M.glass);
    // 낙하산 강하문 (꼬리 옆) + 앞 승강문
    add(patch(5.8, 7.3, s * 92 * deg, s * 128 * deg, 0.015, 2, 3), M.dark);
    add(patch(-11, -9.9, s * 96 * deg, s * 134 * deg, 0.015, 2, 3), M.dark);
    // 착륙장치 덮개 (동체 아래 양옆 볼록한 부분)
    const sp = add(new THREE.SphereGeometry(1, 24, 14), M.body, s * 2.15, -1.7, 0.2);
    sp.scale.set(0.75, 0.9, 5.4);
    // 바퀴 (덮개 아래로 살짝)
    for (const z of [-1.4, 1.6]) {
      const wh = add(new THREE.CylinderGeometry(0.62, 0.62, 0.45, 18).rotateZ(Math.PI / 2), M.black, s * 2.25, -2.35, z);
      wh.castShadow = true;
    }
  }
  // 화물 램프 이음선
  add(patch(9.2, 9.45, 120 * deg, 240 * deg, 0.015, 1, 10), M.dark);
  add(patch(9.2, 17.5, 118 * deg, 121 * deg, 0.015, 8, 1), M.dark);
  add(patch(9.2, 17.5, 239 * deg, 242 * deg, 0.015, 8, 1), M.dark);
  // 앞바퀴
  add(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16).rotateZ(Math.PI / 2), M.black, 0, -2.75, -13.2);
  // 레이돔 끝 (기수 끝 어두운 부분)
  add(patch(-18, -17.2, 0, Math.PI * 2, 0.005, 3, 24), M.dark);

  // 고익 날개 + 날개 위 페어링
  const wingY = 2.45;
  const wSec = [];
  const chordAt = ax => ax <= 6 ? 4.8 : 4.8 - (ax - 6) / 14 * 2.2;
  const leAt = ax => -3.6 + Math.max(0, ax - 6) * 0.06;
  const yAt = ax => wingY + Math.max(0, ax - 3) * 0.014;
  for (const x of [-20, -17, -14, -11, -8, -6, -3, 0, 3, 6, 8, 11, 14, 17, 20]) {
    const ax = Math.abs(x), ch = chordAt(ax);
    wSec.push({ le: new V3(x, yAt(ax), leAt(ax)), chord: ch, thick: ch * 0.15, cd: new V3(0, 0, 1), up: new V3(0, 1, 0) });
  }
  add(smoothNormals(loft(wSec)), M.body);
  const fair = add(new THREE.SphereGeometry(1, 24, 12), M.body, 0, 2.45, -1.0);
  fair.scale.set(1.35, 0.55, 4.8);
  // 날개 끝 항법등 · 동체 위 회전등 · 꼬리등
  add(new THREE.SphereGeometry(0.13, 10, 8), M.red, -20.05, yAt(20), leAt(20) + 0.9);
  add(new THREE.SphereGeometry(0.13, 10, 8), M.green, 20.05, yAt(20), leAt(20) + 0.9);
  const beacon = add(new THREE.SphereGeometry(0.16, 10, 8), M.beacon, 0, R * 1.04 + 0.12, 4);
  const beacon2 = add(new THREE.SphereGeometry(0.14, 10, 8), M.beacon, 0, -R * 1.04 - 0.05, -6);
  add(new THREE.SphereGeometry(0.12, 10, 8), M.white, 0, 9.65, 20.4);
  // 안테나
  add(new THREE.BoxGeometry(0.06, 0.7, 0.35), M.dark, 0, R * 1.04 + 0.3, -8);
  add(new THREE.BoxGeometry(0.06, 0.5, 0.3), M.dark, 0.5, R * 1.04 + 0.2, 1.5);

  // 엔진 4개 (나셀 + 스피너 + 4엽 프로펠러)
  const nacProfile = [];
  const L = 7.2;
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    let r;
    if (u < 0.12) r = 0.5 + 0.28 * Math.sin(u / 0.12 * Math.PI / 2);
    else if (u < 0.62) r = 0.78 + 0.04 * Math.sin((u - 0.12) / 0.5 * Math.PI);
    else r = 0.78 - 0.5 * Math.pow((u - 0.62) / 0.38, 1.6);
    nacProfile.push(new THREE.Vector2(Math.max(0.05, r), -L / 2 + u * L));
  }
  const nacGeo = new THREE.LatheGeometry(nacProfile, 24).rotateX(Math.PI / 2);
  const spinGeo = new THREE.LatheGeometry([new THREE.Vector2(0.5, 0), new THREE.Vector2(0.48, -0.25), new THREE.Vector2(0.36, -0.6), new THREE.Vector2(0.16, -0.9), new THREE.Vector2(0.01, -1.02)], 20).rotateX(Math.PI / 2);
  // 프로펠러 날: 뿌리가 넓고 끝이 좁은 판
  const bladeGeo = new THREE.BoxGeometry(0.36, 2.0, 0.06, 1, 6, 1);
  { const p = bladeGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 1; p.setX(i, p.getX(i) * (1 - 0.4 * y / 2) * (y < 0.15 ? 0.6 : 1)); p.setY(i, y + 0.3); } bladeGeo.computeVertexNormals(); }
  const tipGeo = new THREE.BoxGeometry(0.22, 0.22, 0.065).translate(0, 2.2, 0);
  const discGeo = new THREE.CircleGeometry(2.35, 40);
  for (const x of [-12.6, -6.6, 6.6, 12.6]) {
    const ax = Math.abs(x), le = leAt(ax), y = yAt(ax) - 0.45, cz = le + 1.6;
    add(nacGeo, M.body, x, y, cz);
    // 흡입구 · 배기구
    add(new THREE.BoxGeometry(0.55, 0.32, 0.9), M.black, x, y - 0.68, cz - 2.6);
    const ex = add(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 10).rotateX(Math.PI / 2), M.soot, x + (x > 0 ? 0.62 : -0.62), y + 0.25, cz + 0.9);
    ex.rotation.y = x > 0 ? -0.2 : 0.2;
    const front = cz - L / 2;
    const hub = new THREE.Group(); hub.position.set(x, y, front - 0.15); g.add(hub);
    add(spinGeo, M.spin, 0, 0, 0, hub);
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2; hub.add(arm);
      const b = add(bladeGeo, M.prop, 0, 0, -0.25, arm); b.rotation.y = 0.42;
      const t = add(tipGeo, M.tip, 0, 0, -0.25, arm); t.rotation.y = 0.42;
    }
    const d = add(discGeo, M.disc, 0, 0, -0.28, hub); d.castShadow = false;
    props.push(hub);
  }

  // 수평 꼬리날개
  const hSec = [];
  for (const x of [-8, -5, -2, 0, 2, 5, 8]) {
    const ax = Math.abs(x), ch = 4.2 - ax / 8 * 1.9;
    hSec.push({ le: new V3(x, 1.95 + ax * 0.01, 14.4 + ax * 0.16), chord: ch, thick: ch * 0.12, cd: new V3(0, 0, 1), up: new V3(0, 1, 0) });
  }
  add(smoothNormals(loft(hSec)), M.body);
  // 수직 꼬리날개 (뒤로 젖힌 형태)
  const vSec = [];
  for (const y of [1.6, 2.6, 4, 5.5, 7, 8.4, 9.6]) {
    const t = (y - 1.6) / 8;
    const ch = 6.6 - t * 3.4, le = 12.9 + t * 4.7;
    vSec.push({ le: new V3(0, y, le), chord: ch, thick: ch * 0.11, cd: new V3(0, 0, 1), up: new V3(-1, 0, 0) });
  }
  add(smoothNormals(loft(vSec, true)), M.body);
  // 꼬리날개 앞 등지느러미
  const dorsal = add(new THREE.SphereGeometry(1, 16, 10), M.body, 0, 2.25, 11.8);
  dorsal.scale.set(0.22, 0.75, 3.4);

  // 깜빡이는 회전등
  let bt = 0;
  g.userData.update = (dt) => {
    bt += dt;
    const on = (bt % 1.1) < 0.12;
    beacon.visible = beacon2.visible = on;
  };
  g.userData.props = props;
  return g;
};
})();
