// weapons.js — 무기 정의(15종), 조준경, 탄도, 1인칭 뷰모델(팔 IK + 재장전 애니메이션)
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;

/* ------------------------------------------------------------------ */
/* 무기 정의                                                            */
/* ------------------------------------------------------------------ */
// cls: 슬롯(소총 1 · 산탄총 2 · 권총 3), action: auto/semi/pump/bolt/break, reloadType: mag/shell/break/revolver
// model: 실사 모델 키 (gunmodels.js) — 없으면 gunlib.js 절차적 모델
const ALL_SCOPES = ['reddot', 'holo', 'x2', 'x4', 'x8'];
const BASE = { pellets: 1, head: 2.0, auto: false, action: 'semi', reloadType: 'mag', bloom: 0.006, bloomMax: 0.03, tracerLen: 7, tier: 1, scopes: [], falloff: [100, 0.85], adsTime: 0.17 };
const W = o => Object.assign({}, BASE, o);
G.WEAPONS = {
  // ---- 소총 ----
  ar7: W({ key: 'ar7', name: 'AR-7 돌격소총', short: 'AR-7', cls: 'rifle', model: 'rifle', ammo: '556', dmg: 24, head: 2.2, rpm: 680, auto: true, action: 'auto', mag: 30, reload: 2.25,
    spread: 0.024, ads: 0.0022, move: 0.035, bloom: 0.005, bloomMax: 0.03, recoilV: 0.0155, recoilH: 0.0065, vel: 880, adsFov: 46, kick: 0.55, range: 650, falloff: [110, 0.85], tracerLen: 9, sound: 'rifle', tier: 2, baseSight: 'reddot', scopes: ALL_SCOPES }),
  ka47: W({ key: 'ka47', name: 'KA-47 돌격소총', short: 'KA-47', cls: 'rifle', ammo: '762', dmg: 30, head: 2.2, rpm: 600, auto: true, action: 'auto', mag: 30, reload: 2.5,
    spread: 0.028, ads: 0.003, move: 0.04, bloom: 0.007, bloomMax: 0.04, recoilV: 0.021, recoilH: 0.0095, vel: 715, adsFov: 48, kick: 0.75, range: 600, falloff: [100, 0.82], tracerLen: 9, sound: 'ak', tier: 2, scopes: ALL_SCOPES }),
  sc17: W({ key: 'sc17', name: 'SC-17 전투소총', short: 'SC-17', cls: 'rifle', ammo: '762', dmg: 34, head: 2.2, rpm: 540, auto: true, action: 'auto', mag: 20, reload: 2.4,
    spread: 0.026, ads: 0.0024, move: 0.04, bloom: 0.008, bloomMax: 0.04, recoilV: 0.024, recoilH: 0.008, vel: 790, adsFov: 46, kick: 0.85, range: 680, falloff: [130, 0.85], tracerLen: 9, sound: 'ak', tier: 3, scopes: ALL_SCOPES }),
  mk14: W({ key: 'mk14', name: 'MK-14 지정사수소총', short: 'MK-14', cls: 'rifle', ammo: '762', dmg: 47, head: 2.3, rpm: 320, mag: 20, reload: 2.7,
    spread: 0.022, ads: 0.0012, move: 0.045, bloom: 0.012, bloomMax: 0.03, recoilV: 0.032, recoilH: 0.008, vel: 860, adsFov: 44, kick: 1.05, range: 900, falloff: [220, 0.85], tracerLen: 10, sound: 'dmr', tier: 3, scopes: ALL_SCOPES, adsTime: 0.2 }),
  kr98: W({ key: 'kr98', name: 'KR-98 저격소총', short: 'KR-98', cls: 'rifle', ammo: '762', dmg: 85, head: 2.5, rpm: 55, action: 'bolt', cycle: 0.95, mag: 5, reload: 3.1,
    spread: 0.06, ads: 0.0004, move: 0.06, bloom: 0, bloomMax: 0, recoilV: 0.05, recoilH: 0.01, vel: 920, adsFov: 42, kick: 1.6, range: 1100, falloff: [350, 0.9], tracerLen: 12, sound: 'sniper', tier: 4, scopes: ALL_SCOPES, adsTime: 0.24 }),
  // ---- 산탄총 ----
  s12: W({ key: 's12', name: 'S-12 펌프 샷건', short: 'S-12', cls: 'shotgun', model: 'shotgun', ammo: '12g', dmg: 15, head: 1.5, rpm: 72, action: 'pump', mag: 6, reloadType: 'shell', reload: 0.55,
    spread: 0.068, ads: 0.05, move: 0.02, bloom: 0, bloomMax: 0, recoilV: 0.065, recoilH: 0.018, vel: 420, adsFov: 62, kick: 1.7, pellets: 9, range: 130, falloff: [6, 30], tracerLen: 4, sound: 'shotgun', tier: 2, scopes: ['reddot', 'holo', 'x2'] }),
  m1014: W({ key: 'm1014', name: 'M-1014 반자동 샷건', short: 'M-1014', cls: 'shotgun', ammo: '12g', dmg: 13, head: 1.5, rpm: 220, mag: 7, reloadType: 'shell', reload: 0.5,
    spread: 0.074, ads: 0.055, move: 0.02, bloom: 0.01, bloomMax: 0.02, recoilV: 0.055, recoilH: 0.016, vel: 420, adsFov: 62, kick: 1.4, pellets: 9, range: 120, falloff: [6, 28], tracerLen: 4, sound: 'shotgun', tier: 3, scopes: ['reddot', 'holo', 'x2'] }),
  db2: W({ key: 'db2', name: 'DB-2 더블배럴', short: 'DB-2', cls: 'shotgun', ammo: '12g', dmg: 17, head: 1.5, rpm: 400, action: 'break', mag: 2, reloadType: 'break', reload: 0.5,
    spread: 0.062, ads: 0.048, move: 0.02, bloom: 0, bloomMax: 0, recoilV: 0.075, recoilH: 0.02, vel: 430, adsFov: 62, kick: 1.9, pellets: 9, range: 130, falloff: [7, 30], tracerLen: 4, sound: 'shotgun2', tier: 2, scopes: ['reddot', 'holo'] }),
  sa12: W({ key: 'sa12', name: 'SA-12 탄창식 샷건', short: 'SA-12', cls: 'shotgun', ammo: '12g', dmg: 13, head: 1.5, rpm: 230, mag: 8, reload: 2.6,
    spread: 0.07, ads: 0.052, move: 0.022, bloom: 0.012, bloomMax: 0.025, recoilV: 0.058, recoilH: 0.017, vel: 420, adsFov: 60, kick: 1.45, pellets: 9, range: 125, falloff: [6, 28], tracerLen: 4, sound: 'shotgun', tier: 3, scopes: ['reddot', 'holo', 'x2'] }),
  aa12: W({ key: 'aa12', name: 'AA-12 자동 샷건', short: 'AA-12', cls: 'shotgun', ammo: '12g', dmg: 11, head: 1.4, rpm: 300, auto: true, action: 'auto', mag: 12, reload: 3.0,
    spread: 0.08, ads: 0.06, move: 0.025, bloom: 0.012, bloomMax: 0.03, recoilV: 0.045, recoilH: 0.015, vel: 400, adsFov: 60, kick: 1.2, pellets: 8, range: 110, falloff: [5, 26], tracerLen: 4, sound: 'shotgun', tier: 4, scopes: ['reddot', 'holo', 'x2'] }),
  // ---- 권총 ----
  p92: W({ key: 'p92', name: 'P-92 권총', short: 'P-92', cls: 'pistol', model: 'pistol', ammo: '9mm', dmg: 26, head: 2.0, rpm: 420, mag: 15, reload: 1.45,
    spread: 0.015, ads: 0.0045, move: 0.022, bloom: 0.012, bloomMax: 0.035, recoilV: 0.03, recoilH: 0.009, vel: 380, adsFov: 64, kick: 0.9, range: 320, falloff: [35, 0.7], tracerLen: 5, sound: 'pistol', tier: 1, scopes: ['reddot'] }),
  g18: W({ key: 'g18', name: 'G-18 자동권총', short: 'G-18', cls: 'pistol', ammo: '9mm', dmg: 18, head: 1.9, rpm: 1100, auto: true, action: 'auto', mag: 20, reload: 1.6,
    spread: 0.022, ads: 0.008, move: 0.022, bloom: 0.006, bloomMax: 0.04, recoilV: 0.016, recoilH: 0.011, vel: 370, adsFov: 64, kick: 0.5, range: 250, falloff: [25, 0.65], tracerLen: 5, sound: 'pistol', tier: 2, scopes: ['reddot'] }),
  m1911: W({ key: 'm1911', name: 'M-1911 권총', short: 'M-1911', cls: 'pistol', ammo: '45', dmg: 32, head: 2.0, rpm: 380, mag: 8, reload: 1.5,
    spread: 0.016, ads: 0.0045, move: 0.022, bloom: 0.014, bloomMax: 0.035, recoilV: 0.036, recoilH: 0.01, vel: 270, adsFov: 64, kick: 1.0, range: 280, falloff: [30, 0.7], tracerLen: 5, sound: 'pistol45', tier: 1, scopes: ['reddot'] }),
  de7: W({ key: 'de7', name: 'DE-7 대형권총', short: 'DE-7', cls: 'pistol', ammo: '45', dmg: 48, head: 2.1, rpm: 240, mag: 7, reload: 1.8,
    spread: 0.02, ads: 0.005, move: 0.025, bloom: 0.02, bloomMax: 0.04, recoilV: 0.06, recoilH: 0.014, vel: 450, adsFov: 62, kick: 1.5, range: 350, falloff: [45, 0.75], tracerLen: 6, sound: 'magnum', tier: 3, scopes: ['reddot'] }),
  r45: W({ key: 'r45', name: 'R-45 리볼버', short: 'R-45', cls: 'pistol', ammo: '45', dmg: 55, head: 2.1, rpm: 170, mag: 6, reloadType: 'revolver', reload: 2.6,
    spread: 0.017, ads: 0.0045, move: 0.024, bloom: 0.02, bloomMax: 0.04, recoilV: 0.065, recoilH: 0.015, vel: 440, adsFov: 62, kick: 1.6, range: 350, falloff: [45, 0.75], tracerLen: 6, sound: 'magnum', tier: 3, scopes: [] }),
  fists: { key: 'fists', name: '맨손', short: '맨손', dmg: 22, rpm: 110 }
};
G.GUN_IDS = Object.keys(G.WEAPONS).filter(k => G.WEAPONS[k].cls);
G.GUN_CLASSES = { rifle: [], shotgun: [], pistol: [] };
for (const k of G.GUN_IDS) G.GUN_CLASSES[G.WEAPONS[k].cls].push(k);
G.DEFAULT_GUN = { rifle: 'ar7', shotgun: 's12', pistol: 'p92' };
G.CLASS_NAMES = { rifle: '소총', shotgun: '산탄총', pistol: '권총' };
G.AMMO_NAMES = { '556': '5.56mm', '762': '7.62mm', '9mm': '9mm', '45': '.45 ACP', '12g': '12게이지' };
G.AMMO_MAX = { '556': 240, '762': 180, '9mm': 150, '45': 120, '12g': 60 };
G.SCOPES = {
  reddot: { name: '레드닷', zoom: 1, rank: 1 },
  holo: { name: '홀로그램', zoom: 1, rank: 2 },
  x2: { name: '2배율 스코프', zoom: 2, rank: 3 },
  x4: { name: '4배율 스코프', zoom: 4, rank: 4 },
  x8: { name: '8배율 스코프', zoom: 8, rank: 5 }
};
G.SCOPE_ORDER = ['reddot', 'holo', 'x2', 'x4', 'x8'];
G.THROW_NAMES = { frag: '수류탄', smoke: '연막탄', molotov: '화염병', flash: '섬광탄' };
G.THROW_ORDER = ['frag', 'smoke', 'molotov', 'flash'];
G.dmgAt = function (def, dist) {
  if (def.pellets > 1) return def.dmg * (1 - U.clamp((dist - def.falloff[0]) / def.falloff[1], 0, 1) * 0.8);
  return dist > def.falloff[0] ? def.dmg * def.falloff[1] : def.dmg;
};

/* ------------------------------------------------------------------ */
/* 재질 / 공용 메시 도우미                                              */
/* ------------------------------------------------------------------ */
const MM = {};
function mats() {
  if (MM.gun) return MM;
  const std = (c, m, r, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: m, roughness: r, envMapIntensity: 0.55 }, o || {}));
  MM.gun = MM.metal = std(0x26282c, 0.55, 0.42);
  MM.dark = std(0x141518, 0.45, 0.55, { envMapIntensity: 0.5 });
  MM.darkDS = std(0x141518, 0.45, 0.55, { envMapIntensity: 0.5, side: THREE.DoubleSide });
  MM.poly = std(0x1d1e21, 0.1, 0.62);
  MM.tan = std(0x8a785a, 0.08, 0.72);
  MM.wood = std(0x6e3f1f, 0.05, 0.5);
  MM.woodL = std(0x8e5a2c, 0.05, 0.45);
  MM.bake = std(0x7a3414, 0.08, 0.45);
  MM.steel = std(0x8d9298, 0.85, 0.32, { envMapIntensity: 0.8 });
  MM.chrome = std(0xc0c5cb, 0.95, 0.18, { envMapIntensity: 1.0 });
  // 실사 군인(ACU 위장복)을 쓸 때는 1인칭 소매·장갑 색도 맞춘다
  const acu = G.Soldiers && G.Soldiers.ready;
  MM.glove = new THREE.MeshStandardMaterial({ color: acu ? 0x5e5a4c : 0x2c2b27, roughness: 0.92 });
  MM.sleeve = new THREE.MeshStandardMaterial({ color: acu ? 0xffffff : 0x4a5236, roughness: 0.95, map: acu ? acuCamo() : null });
  MM.brass = std(0xc9a040, 1, 0.3);
  MM.shell = std(0xa82222, 0.2, 0.5);
  MM.lens = new THREE.MeshStandardMaterial({ color: 0x6fa0c8, metalness: 0.4, roughness: 0.35, transparent: true, opacity: 0.16, depthWrite: false });
  MM.lensDark = new THREE.MeshStandardMaterial({ color: 0x1a3550, metalness: 0.9, roughness: 0.3, transparent: true, opacity: 0.85, envMapIntensity: 1.2 });
  MM.dot = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.25, 0.15) });
  MM.fiber = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 0.8) });
  MM.olive = std(0x4f5a2e, 0.3, 0.55);
  MM.gray = std(0x8d9296, 0.4, 0.45);
  MM.bottle = new THREE.MeshStandardMaterial({ color: 0x5a3a12, metalness: 0.1, roughness: 0.3, transparent: true, opacity: 0.75 });
  MM.cloth = new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.95 });
  MM.fire = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.2, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  return MM;
}
// ACU 디지털 위장 무늬 (실사 군인 군복과 맞춤)
function acuCamo() {
  const t = G.Tex.canvas(128, 128, (c, w, h) => {
    c.fillStyle = '#8b8d7f'; c.fillRect(0, 0, w, h);
    const cols = ['#6f735f', '#a9a48f', '#5d6152', '#9a9c8e', '#7b7f6c'], rnd = G.U.mulberry32(77);
    for (let i = 0; i < 700; i++) {
      c.fillStyle = cols[Math.floor(rnd() * cols.length)];
      const x = Math.floor(rnd() * 64) * 2, y = Math.floor(rnd() * 64) * 2, bw = (1 + Math.floor(rnd() * 4)) * 2, bh = (1 + Math.floor(rnd() * 3)) * 2;
      c.fillRect(x, y, bw, bh); c.fillRect(x - w, y, bw, bh); c.fillRect(x, y - h, bw, bh);
    }
  });
  t.magFilter = THREE.NearestFilter; t.repeat.set(1.5, 2.5);
  return t;
}
function mb(parent, w, h, d, x, y, z, m, rx, ry, rz) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  if (rx || ry || rz) mesh.rotation.set(rx || 0, ry || 0, rz || 0);
  parent.add(mesh); return mesh;
}
function mc(parent, r, len, x, y, z, m, seg, axis, open) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 14, 1, !!open), m);
  if (!axis || axis === 'z') mesh.rotation.x = Math.PI / 2; else if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh); return mesh;
}
function limb(parent, a, b, r, m) {
  const d = new V3().subVectors(b, a), len = d.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, len, 10), m);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  parent.add(mesh); return mesh;
}
function armVM(parent, hand, elbow, shoulder, gloveSize) {
  const M = mats();
  const g = mb(parent, gloveSize[0], gloveSize[1], gloveSize[2], hand.x, hand.y, hand.z, M.glove);
  limb(parent, hand, elbow, 0.034, M.sleeve);
  limb(parent, elbow, shoulder, 0.045, M.sleeve);
  return g;
}
const starTex = () => G._star || (G._star = G.Tex.canvas(128, 128, (c, w) => {
  c.translate(w / 2, w / 2);
  for (let i = 0; i < 7; i++) {
    c.rotate(Math.PI * 2 / 7);
    const g = c.createLinearGradient(0, 0, w / 2, 0);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,140,40,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, -5); c.lineTo(w / 2 * (0.6 + Math.random() * 0.4), 0); c.lineTo(0, 5); c.fill();
  }
  const g = c.createRadialGradient(0, 0, 0, 0, 0, w * 0.3);
  g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(1, 'rgba(255,160,60,0)');
  c.fillStyle = g; c.fillRect(-w / 2, -w / 2, w, w);
}, { clamp: true }));
// 같은 재질의 정적 메시를 하나로 병합 (애니메이션 되는 하위 그룹은 그룹 단위로 유지)
function mergeStatic(group) {
  const byMat = new Map(), remove = [];
  for (const c of group.children.slice()) {
    if (c.isMesh && !c.userData.keep) {
      c.updateMatrix();
      const g = c.geometry.clone();
      g.applyMatrix4(c.matrix);
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const gg = g.index ? g.toNonIndexed() : g;
      if (!byMat.has(c.material)) byMat.set(c.material, []);
      byMat.get(c.material).push(gg);
      remove.push(c);
    } else if (c.isGroup || (c.isObject3D && !c.isMesh)) mergeStatic(c);
  }
  if (!remove.length) return;
  for (const r of remove) { group.remove(r); r.geometry.dispose(); }
  for (const [m, list] of byMat) {
    const geo = list.length === 1 ? list[0] : THREE.mergeGeometries(list, false);
    group.add(new THREE.Mesh(geo, m));
  }
}
function flashMesh(parent, pos, scale) {
  const g = new THREE.Group(); g.position.copy(pos);
  const m = new THREE.MeshBasicMaterial({ map: starTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(3, 2.4, 1.6), side: THREE.DoubleSide });
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale), m); g.add(p1);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(scale * 0.5, scale * 1.6), m); p2.rotation.y = Math.PI / 2; p2.position.z = -scale * 0.5; g.add(p2);
  const p3 = new THREE.Mesh(new THREE.PlaneGeometry(scale * 0.5, scale * 1.6), m); p3.rotation.set(Math.PI / 2, 0, Math.PI / 2); p3.position.z = -scale * 0.5; g.add(p3);
  g.visible = false;
  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* 1인칭 팔 (2관절 IK) — 손 목표점을 주면 팔꿈치를 계산해 팔을 다시 그린다 */
/* ------------------------------------------------------------------ */
const _Y = new V3(0, 1, 0), _NZ = new V3(0, 0, -1), _qI = new THREE.Quaternion();
const limbGeo = {};
function unitLimb(r) {
  if (!limbGeo[r]) limbGeo[r] = new THREE.CylinderGeometry(r * 0.9, r, 1, 10).translate(0, 0.5, 0);
  return limbGeo[r];
}
function armRig(parent, shoulder, hand, elbow, glove, slack) {
  const M = mats();
  const a = shoulder.distanceTo(elbow) * slack, b = elbow.distanceTo(hand) * slack;
  const mid = shoulder.clone().add(hand).multiplyScalar(0.5);
  const pole = elbow.clone().sub(mid).normalize();
  const hm = new THREE.Mesh(new THREE.BoxGeometry(glove[0], glove[1], glove[2]), M.glove);
  const fm = new THREE.Mesh(unitLimb(0.034), M.sleeve), um = new THREE.Mesh(unitLimb(0.045), M.sleeve);
  for (const m of [hm, fm, um]) { m.userData.keep = true; m.frustumCulled = false; parent.add(m); }
  const rig = { hm, fm, um, S: shoulder.clone(), a, b, pole, rest: hand.clone(), tgt: hand.clone(), cur: hand.clone(), roll: 0 };
  solveArm(rig);
  return rig;
}
const _D = new V3(), _E = new V3(), _H = new V3(), _P2 = new V3(), _q = new THREE.Quaternion();
function setLimb(m, p0, p1) {
  _D.subVectors(p1, p0); const len = _D.length();
  m.position.copy(p0); m.scale.set(1, Math.max(0.001, len), 1);
  m.quaternion.setFromUnitVectors(_Y, _D.divideScalar(len || 1));
}
function solveArm(r) {
  const S = r.S, a = r.a, b = r.b;
  _D.subVectors(r.cur, S);
  let L = _D.length(); if (L < 1e-5) return;
  _D.divideScalar(L);
  L = U.clamp(L, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const cosA = (a * a + L * L - b * b) / (2 * a * L), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _P2.copy(r.pole).addScaledVector(_D, -r.pole.dot(_D)).normalize();
  _E.copy(S).addScaledVector(_D, a * cosA).addScaledVector(_P2, a * sinA);
  _H.copy(S).addScaledVector(_D, L);
  setLimb(r.fm, _H, _E);
  setLimb(r.um, _E, S);
  r.hm.position.copy(_H);
  _D.subVectors(_H, _E).normalize();
  _q.setFromUnitVectors(_NZ, _D);
  r.hm.quaternion.copy(_qI).slerp(_q, 0.55);
  if (r.roll) r.hm.rotateZ(r.roll);
}

/* ------------------------------------------------------------------ */
/* 총 모델 데이터                                                       */
/* ------------------------------------------------------------------ */
// 슬롯별 1인칭 기준: 방아쇠 위치(at), 허리 사격 위치(hip), 오른손·왼손 휴식 자세
const CLS = {
  rifle: { at: new V3(0, -0.03, 0.02), hip: new V3(0.165, -0.185, -0.47), scale: 1.54, adsDist: 0.32, flash: 0.22,
    gripR: new V3(0.012, -0.085, 0.09), elbowR: new V3(0.11, -0.22, 0.33), shoulderR: new V3(0.24, -0.4, 0.6), gloveR: [0.065, 0.085, 0.1],
    elbowOffL: new V3(-0.158, -0.19, 0.26), shoulderOffL: new V3(-0.308, -0.36, 0.64), gloveL: [0.07, 0.06, 0.11] },
  shotgun: { at: new V3(0, -0.045, 0.02), hip: new V3(0.17, -0.19, -0.45), scale: 1.2, adsDist: 0.26, flash: 0.32,
    gripR: new V3(0.012, -0.07, 0.1), elbowR: new V3(0.11, -0.21, 0.34), shoulderR: new V3(0.24, -0.4, 0.6), gloveR: [0.065, 0.085, 0.1],
    elbowOffL: new V3(-0.154, -0.178, 0.24), shoulderOffL: new V3(-0.314, -0.348, 0.6), gloveL: [0.07, 0.06, 0.12] },
  pistol: { at: new V3(0, -0.005, -0.03), hip: new V3(0.1, -0.125, -0.38), scale: 1.05, adsDist: 0.3, flash: 0.16,
    gripR: new V3(0.004, -0.045, 0.03), elbowR: new V3(0.09, -0.19, 0.3), shoulderR: new V3(0.22, -0.38, 0.58), gloveR: [0.06, 0.09, 0.09],
    handL: new V3(-0.024, -0.06, 0.02), elbowL: new V3(-0.15, -0.2, 0.28), shoulderL: new V3(-0.3, -0.38, 0.58), gloveL: [0.055, 0.08, 0.09] }
};
// 조준경별 1인칭 눈 거리
const SCOPE_ADS = { reddot: 0.34, holo: 0.32, x2: 0.24, x4: 0.2, x8: 0.17 };

function gunData(id) {
  const def = G.WEAPONS[id];
  if (def.model && G.GunModels && G.GunModels.has(def.model)) return G.GunModels.data(def.model);
  return G.GunLib.data(id);
}

const Guns = G.Guns = {
  mats, CLS, gunData,
  buildVM(id) {
    if (id === 'fists' || id === 'throw') return this.buildHands(id);
    const M = mats();
    const def = G.WEAPONS[id], cls = def.cls, C = CLS[cls], D = gunData(id);
    const s = D.vmScale || C.scale, at = C.at;
    const P = v => v.clone().sub(D.trigger).multiplyScalar(s).add(at);   // 총 공간(m) → 뷰모델 공간
    const root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const o = { root, gun, parts: {}, rest: {}, id, def, cls, s, scopes: {}, real: !!D.real };
    const matOf = k => D.real ? D.mats[k] : (M[k] || M.metal);
    // 부품: body 는 총에 고정, 나머지는 회전/이동 중심(pivot)을 원점으로 하는 그룹
    for (const part in D.parts) {
      let grp = null, pv = null;
      if (part !== 'body') {
        pv = D.pivots[part] || new V3();
        grp = new THREE.Group(); grp.position.copy(P(pv)); gun.add(grp);
        o.parts[part] = grp; o.rest[part] = grp.position.clone();
      }
      for (const mk in D.parts[part]) {
        const g = D.parts[part][mk].clone();
        if (grp) g.translate(-pv.x, -pv.y, -pv.z).scale(s, s, s);
        else g.translate(-D.trigger.x, -D.trigger.y, -D.trigger.z).scale(s, s, s).translate(at.x, at.y, at.z);
        (grp || gun).add(new THREE.Mesh(g, matOf(mk)));
      }
    }
    // 리볼버: 탄(mag)은 실린더를 따라 움직인다
    if (o.parts.cyl && o.parts.mag) { o.parts.cyl.add(o.parts.mag); o.parts.mag.position.sub(o.parts.cyl.position); o.rest.mag = o.parts.mag.position.clone(); }
    // 기준점
    o.muzzle = P(D.muzzle);
    o.flash = flashMesh(gun, o.muzzle.clone().add(new V3(0, 0, -0.02)), C.flash);
    o.hip = C.hip.clone();
    o.magDir = (D.magDir || new V3(0, -1, 0)).clone();
    o.port = D.port ? P(D.port) : null;
    o.charge = D.charge ? P(D.charge) : null;
    o.slideTop = D.slideTop ? P(D.slideTop) : null;
    // 가늠쇠(기본) 조준선: 가늠자 뒤로 조준선 가까이 솟은 부분(덮개·리시버)이 눈앞을 가리지 않게 눈 거리를 늘린다
    if (D.sight) {
      const sp = P(new V3(0, D.sight.y, D.sight.z));
      let back = 0;
      for (const mk in D.parts.body || {}) {
        const pa = D.parts.body[mk].attributes.position;
        for (let i = 0; i < pa.count; i++) { const y = pa.getY(i), z = pa.getZ(i); if (y > D.sight.y - 0.022 && z > D.sight.z && z - D.sight.z > back) back = z - D.sight.z; }
      }
      const dist = Math.max(C.adsDist, back * s + 0.1);
      o.iron = { sight: sp, ads: new V3(0, 0, -dist).sub(sp) };
    } else {
      const sp = new V3(0, o.muzzle.y + 0.05, at.z - 0.1);
      o.iron = { sight: sp, ads: new V3(0, 0, -C.adsDist).sub(sp) };
    }
    // 조준경 (레일에 장착, 권총은 슬라이드에)
    const scopeTypes = def.scopes.slice();
    if (def.baseSight && !scopeTypes.includes(def.baseSight)) scopeTypes.push(def.baseSight);
    if (D.rail) {
      const base = P(new V3(0, D.rail.y, D.rail.z));
      const host = D.rail.on === 'slide' && o.parts.slide ? o.parts.slide : gun;
      for (const t of scopeTypes) {
        const SD = G.GunLib.scope(t);
        const grp = new THREE.Group();
        grp.position.copy(base); if (host !== gun) grp.position.sub(host.position);
        for (const part in SD.parts) for (const mk in SD.parts[part]) {
          const g = SD.parts[part][mk].clone().scale(s, s, s);
          grp.add(new THREE.Mesh(g, M[mk] || M.dark));
        }
        grp.visible = false; host.add(grp);
        const sp = base.clone().add(new V3(0, SD.eye * s, SD.rear * s));
        o.scopes[t] = { group: grp, sight: sp, ads: new V3(0, 0, -SCOPE_ADS[t]).sub(sp) };
      }
    }
    // 장전용 산탄 (왼손에 들고 장전구에 밀어 넣는다)
    if (def.reloadType === 'shell' || def.reloadType === 'break') {
      const sh = o.shell = new THREE.Group(); root.add(sh); sh.visible = false;
      mc(sh, 0.0115 * s / 1.1, 0.05 * s / 1.1, 0, 0, 0, M.shell, 10); mc(sh, 0.012 * s / 1.1, 0.014 * s / 1.1, 0, 0, 0.026 * s / 1.1, M.brass, 10);
    }
    // 팔
    if (cls === 'pistol') {
      o.armR = armRig(root, C.shoulderR, C.gripR, C.elbowR, C.gloveR, 1.08);
      const fl = D.fore ? P(D.fore) : C.handL.clone();
      o.armL = armRig(root, C.shoulderL.clone().add(fl).sub(C.handL), fl, C.elbowL.clone().add(fl).sub(C.handL), C.gloveL, 1.08);
      o.fore = fl;
    } else {
      o.armR = armRig(root, C.shoulderR, C.gripR, C.elbowR, C.gloveR, 1.08);
      const fl = P(D.fore);
      o.armL = armRig(root, fl.clone().add(C.shoulderOffL), fl, fl.clone().add(C.elbowOffL), C.gloveL, 1.1);
      o.fore = fl;
    }
    o.grip = C.gripR.clone();
    this.makeKeys(o);
    mergeStatic(root);
    root.traverse(m => { if (m.isMesh) m.frustumCulled = false; });
    return o;
  },
  // 맨손 / 투척 (기존 정적 팔)
  buildHands(type) {
    const root = new THREE.Group();
    const gun = new THREE.Group(); root.add(gun);
    const o = { root, gun, parts: {}, type, scopes: {} };
    if (type === 'fists') {
      const l = o.parts.left = new THREE.Group(); l.position.set(-0.13, -0.15, -0.33); root.add(l);
      const r = o.parts.right = new THREE.Group(); r.position.set(0.13, -0.15, -0.31); root.add(r);
      armVM(l, new V3(0, 0, 0), new V3(-0.04, -0.12, 0.25), new V3(-0.15, -0.3, 0.55), [0.075, 0.08, 0.09]);
      armVM(r, new V3(0, 0, 0), new V3(0.04, -0.12, 0.25), new V3(0.15, -0.3, 0.55), [0.075, 0.08, 0.09]);
      o.hip = new V3(0, 0, 0); o.muzzle = new V3(0, 0, -0.3);
    } else {
      const hand = o.parts.hand = new THREE.Group(); hand.position.set(0.18, -0.2, -0.46); root.add(hand);
      armVM(hand, new V3(0, -0.03, 0.02), new V3(0.05, -0.16, 0.28), new V3(0.16, -0.34, 0.58), [0.07, 0.08, 0.09]);
      o.items = {};
      for (const k of G.THROW_ORDER) { const m = Guns.throwModel(k, true); m.visible = false; hand.add(m); o.items[k] = m; }
      o.hip = new V3(0, 0, 0); o.muzzle = new V3(0.15, -0.1, -0.35);
    }
    o.iron = { sight: new V3(), ads: new V3(0, 0, -0.3) };
    mergeStatic(root);
    root.traverse(m => { if (m.isMesh) m.frustumCulled = false; });
    return o;
  },
  // 재장전 손 경로 (뷰모델 공간, 기준점에서 미리 계산)
  makeKeys(o) {
    const K = o.keys = {};
    const v = (base, x, y, z) => base.clone().add(new V3(x, y, z));
    const F = o.fore;
    if (o.parts.mag && o.def.reloadType === 'mag') {
      const mr = o.rest.mag, md = o.magDir;
      if (o.cls === 'pistol') {
        const Hm = mr.clone().addScaledVector(md, 0.045).add(new V3(-0.004, 0, 0.004));
        const Hin = Hm.clone().addScaledVector(md, 0.1);
        const Hdn = v(F, -0.1, -0.4, 0.15), Hdn2 = v(F, -0.15, -0.35, 0.05);
        // 빈 탄창이면 엄지로 슬라이드 멈치를 눌러 슬라이드를 닫는다 (손잡이 왼쪽 위)
        const Hs = v(o.grip, -0.045, 0.045, -0.035);
        K.magOff = mr.clone().sub(Hm);
        const common = [[0, F], [0.1, v(F, -0.04, -0.1, 0.05)], [0.3, Hdn], [0.42, Hdn2], [0.53, Hin], [0.62, Hm], [0.66, v(Hm, 0, 0.012, 0)], [0.7, Hm]];
        K.empty = common.concat([[0.78, Hs], [0.82, v(Hs, 0.008, -0.004, 0)], [0.86, Hs], [1, F]]);
        K.tac = common.concat([[0.85, F], [1, F]]);
        K.slideHand = Hs;
      } else {
        const Hm = mr.clone().addScaledVector(md, 0.1 * o.s / 1.54).add(new V3(-0.032, 0, 0));
        const Hout = Hm.clone().addScaledVector(md, 0.16), Hin = Hm.clone().addScaledVector(md, 0.13);
        const Hdn = v(Hm, -0.12, -0.5, 0.18), Hdn2 = v(Hm, -0.18, -0.45, 0.1);
        // 장전 손잡이가 앞쪽(옆면)에 있으면 당기고, 뒤쪽(눈 가까이)이면 노리쇠 멈치를 누른다
        const pull = o.charge && o.charge.z < o.grip.z - 0.12;
        const Hb = pull ? v(o.charge, o.charge.x > 0.005 ? 0.012 : -0.03, o.charge.x > 0.005 ? 0.03 : 0.012, 0) : v(mr, -0.045, 0.045, 0.025);
        K.magOff = mr.clone().sub(Hm); K.bolt = Hb; K.pull = pull;
        const common = [[0, F], [0.12, Hm], [0.16, Hm], [0.3, Hout], [0.42, Hdn], [0.47, Hdn2], [0.56, Hin], [0.63, Hm], [0.66, v(Hm, 0, 0.012, 0)], [0.7, Hm]];
        K.empty = common.concat(pull ? [[0.79, Hb], [0.86, v(Hb, 0, 0, 0.075)], [0.9, v(Hb, 0, 0, 0.075)], [1, F]]
          : [[0.8, v(Hb, -0.012, 0, 0)], [0.85, Hb], [0.88, v(Hb, -0.012, 0, 0)], [1, F]]);
        K.tac = common.concat([[0.85, F], [1, F]]);
      }
    }
    if (o.port) {
      const p = o.port;
      K.portIn = v(p, -0.01, -0.018, -0.03); K.portEntry = v(p, -0.014, -0.045, 0.03);
      K.below = v(p, -0.04, -0.12, 0.05); K.down = v(p, -0.08, -0.3, 0.12);
    }
    if (o.parts.pump) K.pumpOff = F.clone().sub(o.rest.pump);
    if (o.parts.barrel) K.barrelOff = F.clone().sub(o.rest.barrel);
  },
  throwModel(k, vm) {
    const M = mats();
    const g = new THREE.Group();
    if (k === 'frag') {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 10), M.olive); b.scale.set(1, 1.15, 1); g.add(b);
      mb(g, 0.014, 0.05, 0.012, 0.03, 0.02, 0, M.gray, 0, 0, -0.2);
      mc(g, 0.012, 0.02, 0, 0.042, 0, M.gray, 8, 'y');
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0025, 6, 14), M.gray); ring.position.set(-0.016, 0.05, 0); ring.rotation.y = Math.PI / 2; g.add(ring);
    } else if (k === 'smoke') {
      mc(g, 0.029, 0.11, 0, 0, 0, M.gray, 14, 'y');
      mc(g, 0.0295, 0.025, 0, 0.02, 0, new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 }), 14, 'y');
      mc(g, 0.018, 0.02, 0, 0.064, 0, M.dark, 10, 'y');
      mb(g, 0.012, 0.06, 0.01, 0.03, 0.03, 0, M.dark);
    } else if (k === 'molotov') {
      mc(g, 0.034, 0.11, 0, 0, 0, M.bottle, 14, 'y');
      mc(g, 0.013, 0.06, 0, 0.08, 0, M.bottle, 10, 'y');
      mb(g, 0.03, 0.05, 0.03, 0, 0.12, 0, M.cloth, 0, 0, 0.3);
      if (vm) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), M.fire); f.position.set(0.005, 0.15, 0); f.scale.set(1, 1.6, 1); f.userData.keep = true; g.add(f); g.userData.flame = f; }
    } else if (k === 'flash') {
      mc(g, 0.026, 0.1, 0, 0, 0, M.dark, 12, 'y');
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; mb(g, 0.008, 0.02, 0.008, Math.cos(a) * 0.026, 0.015, Math.sin(a) * 0.026, M.gray); }
      mc(g, 0.016, 0.02, 0, 0.06, 0, M.gray, 8, 'y');
      mb(g, 0.012, 0.055, 0.01, 0.027, 0.025, 0, M.gray);
    }
    return g;
  },
  // 3인칭 / 아이템용 병합 지오메트리 (vertex color)
  _tp: {},
  tpGeo(type) {
    if (this._tp[type]) return this._tp[type];
    const bx = G.bx, cg = G.cg;
    let parts;
    if (type === 'rifle') parts = [bx(0.06, 0.09, 0.42, 0, 0, -0.08, 0x2b2d31), bx(0.07, 0.07, 0.26, 0, 0.005, -0.4, 0x8a785a), bx(0.025, 0.025, 0.24, 0, 0.01, -0.64, 0x1a1a1a),
      bx(0.045, 0.17, 0.08, 0, -0.11, -0.1, 0x18191b), bx(0.05, 0.1, 0.2, 0, -0.01, 0.22, 0x8a785a), bx(0.04, 0.11, 0.05, 0, -0.09, 0.06, 0x1d1e21), bx(0.035, 0.05, 0.07, 0, 0.07, -0.08, 0x1a1a1a)];
    else if (type === 'ammo_556') parts = [bx(0.24, 0.13, 0.16, 0, 0.065, 0, 0x3d5a2a), bx(0.245, 0.03, 0.165, 0, 0.11, 0, 0x2a3a1c), bx(0.1, 0.03, 0.005, 0, 0.07, 0.083, 0xd8c060)];
    else if (type === 'ammo_762') parts = [bx(0.26, 0.13, 0.17, 0, 0.065, 0, 0x5a4a2a), bx(0.265, 0.03, 0.175, 0, 0.11, 0, 0x3a2e1a), bx(0.1, 0.03, 0.005, 0, 0.07, 0.088, 0xe0a040)];
    else if (type === 'ammo_9mm') parts = [bx(0.2, 0.11, 0.14, 0, 0.055, 0, 0x6a5a2a), bx(0.205, 0.03, 0.145, 0, 0.095, 0, 0x4a3e1c), bx(0.08, 0.03, 0.005, 0, 0.06, 0.073, 0xe0e0e0)];
    else if (type === 'ammo_45') parts = [bx(0.19, 0.11, 0.14, 0, 0.055, 0, 0x2a3a5a), bx(0.195, 0.03, 0.145, 0, 0.095, 0, 0x1c263a), bx(0.08, 0.03, 0.005, 0, 0.06, 0.073, 0xe0e0e0)];
    else if (type === 'ammo_12g') parts = [bx(0.22, 0.12, 0.15, 0, 0.06, 0, 0x8a2a22), bx(0.225, 0.03, 0.155, 0, 0.105, 0, 0x5a1a14), bx(0.1, 0.03, 0.005, 0, 0.065, 0.078, 0xe0e0e0)];
    else if (type === 'bandage') parts = [cg(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12).rotateZ(Math.PI / 2).translate(0, 0.06, 0), 0xeae6dc), bx(0.11, 0.02, 0.05, 0, 0.12, 0, 0xd02020)];
    else if (type === 'medkit') parts = [bx(0.36, 0.2, 0.14, 0, 0.1, 0, 0xe8e8e8), bx(0.14, 0.04, 0.145, 0, 0.1, 0, 0xc81e1e), bx(0.04, 0.14, 0.145, 0, 0.1, 0, 0xc81e1e), bx(0.12, 0.03, 0.03, 0, 0.215, 0, 0x333333)];
    else if (type === 'vest') parts = [bx(0.45, 0.1, 0.5, 0, 0.05, 0, 0x3a4228), bx(0.12, 0.05, 0.1, -0.12, 0.12, 0.12, 0x2e3420), bx(0.12, 0.05, 0.1, 0.12, 0.12, 0.12, 0x2e3420), bx(0.12, 0.05, 0.1, 0, 0.12, 0.12, 0x2e3420)];
    else if (type === 'helmet') parts = [cg(new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 0.02, 0), 0x3d4a2a), bx(0.3, 0.02, 0.32, 0, 0.03, 0, 0x2e3820)];
    else if (type === 'frag') parts = [cg(new THREE.SphereGeometry(0.034, 12, 8).scale(1, 1.15, 1), 0x4f5a2e), bx(0.014, 0.05, 0.012, 0.03, 0.02, 0, 0x8d9296), cg(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 8).translate(0, 0.042, 0), 0x8d9296)];
    else if (type === 'smoke') parts = [cg(new THREE.CylinderGeometry(0.029, 0.029, 0.11, 12), 0x8d9296), cg(new THREE.CylinderGeometry(0.0295, 0.0295, 0.025, 12).translate(0, 0.02, 0), 0xd8d8d8), cg(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8).translate(0, 0.064, 0), 0x141518)];
    else if (type === 'molotov') parts = [cg(new THREE.CylinderGeometry(0.034, 0.034, 0.11, 12), 0x5a3a12), cg(new THREE.CylinderGeometry(0.013, 0.013, 0.06, 8).translate(0, 0.08, 0), 0x5a3a12), bx(0.03, 0.05, 0.03, 0, 0.12, 0, 0xd8ccb0)];
    else if (type === 'flash') parts = [cg(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 12), 0x141518), cg(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 8).translate(0, 0.06, 0), 0x8d9296), bx(0.012, 0.055, 0.01, 0.027, 0.025, 0, 0x8d9296)];
    else if (type === 'crate') parts = [bx(0.9, 0.45, 0.55, 0, 0.225, 0, 0x3e4a2c), bx(0.92, 0.06, 0.57, 0, 0.45, 0, 0x2e3820), bx(0.08, 0.46, 0.57, -0.3, 0.23, 0, 0x2e3820), bx(0.08, 0.46, 0.57, 0.3, 0.23, 0, 0x2e3820), bx(0.2, 0.08, 0.02, 0, 0.3, 0.28, 0xd0a020)];
    else parts = [bx(0.2, 0.1, 0.2, 0, 0.05, 0, 0x777777)];
    const geo = G.mergeGeo(parts);
    this._tp[type] = geo;
    return geo;
  },
  // 3인칭 손에 든 총 (id 별)
  tpModel(type) {
    const def = G.WEAPONS[type];
    if (def && def.cls) {
      if (def.model && G.GunModels && G.GunModels.has(def.model)) return G.GunModels.tpMesh(def.model);
      const m = new THREE.Mesh(G.GunLib.tpGeo(type, G.GunModels.TPREF[def.cls]), G.GunLib.tpMat());
      m.castShadow = true;
      return m;
    }
    return new THREE.Mesh(this.tpGeo(type), G.CharMat || new THREE.MeshStandardMaterial({ vertexColors: true }));
  },
  itemModel(kind) {
    const g = new THREE.Group();
    const def = G.WEAPONS[kind];
    if (def && def.cls) {
      const m = this.tpModel(kind); m.rotation.set(0, 0, Math.PI / 2); m.position.y = 0.04; m.scale.setScalar(def.cls === 'pistol' ? 1.6 : 1.15); g.add(m);
    } else if (kind.startsWith('scope_')) {
      const m = new THREE.Mesh(G.GunLib.scopeItemGeo(kind.slice(6)), G.GunLib.tpMat()); m.scale.setScalar(2.4); m.position.y = 0.02; g.add(m);
    } else if (G.THROW_NAMES[kind]) {
      const m = this.tpModel(kind); m.scale.setScalar(2.2); m.position.y = 0.12; g.add(m);
    } else {
      g.add(this.tpModel(kind));
    }
    return g;
  }
};

/* ------------------------------------------------------------------ */
/* 탄도 (투사체)                                                        */
/* ------------------------------------------------------------------ */
const _d = new V3(), _p = new V3(), _q2 = new V3(), _h = new V3(), _tail = new V3(), _fwd = new V3();
const Ballistics = G.Ballistics = {
  list: [],
  reset() { for (const p of this.list) G.FX.freeTracer(p.tracer); this.list.length = 0; },
  fire(owner, origin, dir, def, muzzle, tracer) {
    const p = { owner, team: owner.team, def, pos: origin.clone(), vel: dir.clone().multiplyScalar(def.vel * U.rand(0.97, 1.03)), dist: 0, tracer: null, voff: new V3(), whiz: false, start: origin.clone() };
    if (muzzle) p.voff.copy(muzzle).sub(origin);
    if (tracer) p.tracer = G.FX.getTracer();
    this.list.push(p);
  },
  // 액터 히트 테스트: {t, head}
  hitActor(a, o, d, maxT) {
    let best = Infinity, head = false;
    const px = a.pos.x, py = a.pos.y, pz = a.pos.z;
    if (a.knocked) {
      _fwd.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
      let t = sphereT(o, d, px + _fwd.x * 0.3, py + 0.25, pz + _fwd.z * 0.3, 0.38);
      if (t < best) { best = t; head = false; }
      t = sphereT(o, d, px + _fwd.x * 0.85, py + 0.28, pz + _fwd.z * 0.85, 0.15);
      if (t < best) { best = t; head = true; }
      t = sphereT(o, d, px - _fwd.x * 0.4, py + 0.2, pz - _fwd.z * 0.4, 0.3);
      if (t < best) { best = t; head = false; }
    } else {
      const top = a.crouch ? 1.02 : 1.45, hy = a.crouch ? 1.2 : 1.64;
      let t = cylT(o, d, px, pz, 0.27, py, py + top);
      if (t < best) { best = t; head = false; }
      t = sphereT(o, d, px, py + hy, pz, 0.15);
      if (t < best) { best = t; head = true; }
    }
    return best <= maxT ? { t: best, head } : null;
  },
  update(dt) {
    const Wd = G.World, Game = G.Game, player = Game.player;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      p.vel.y -= 9.8 * dt;
      const sp = p.vel.length();
      let L = sp * dt;
      _d.copy(p.vel).divideScalar(sp);
      let best = L, kind = null, target = null, head = false;
      if (Wd.raycast(p.pos, _d, L)) { best = Wd.hit.t; kind = 'world'; }
      // 수면 (바다·호수·강)
      const ny = p.pos.y + _d.y * best;
      const wl = Wd.waterAt(p.pos.x + _d.x * best * 0.5, p.pos.z + _d.z * best * 0.5);
      if (p.pos.y > wl && ny <= wl && _d.y < 0) {
        const tw = (p.pos.y - wl) / -_d.y;
        if (tw < best) { best = tw; kind = 'water'; }
      }
      // 캐릭터
      const mx = p.pos.x + _d.x * L * 0.5, mz = p.pos.z + _d.z * L * 0.5, rr = L * 0.5 + 2.5;
      for (const a of Game.actors) {
        if (!a.alive || a.state !== 'ground' || a.team === p.team) continue;
        const dx = a.pos.x - mx, dz = a.pos.z - mz;
        if (dx * dx + dz * dz > rr * rr) continue;
        const h = this.hitActor(a, p.pos, _d, best);
        if (h) { best = h.t; kind = 'actor'; target = a; head = h.head; }
      }
      // 근접 비행음
      if (player && player.alive && !p.whiz && p.team !== player.team) {
        _h.set(player.pos.x, player.pos.y + 1.6, player.pos.z).sub(p.pos);
        const t = U.clamp(_h.dot(_d), 0, best);
        _q2.copy(p.pos).addScaledVector(_d, t);
        const dd = _q2.distanceTo(_h.add(p.pos));
        if (dd < 2.8 && kind !== 'actor') { p.whiz = true; G.Audio.whiz(_q2); G.FX.shake(0.08); }
      }
      _p.copy(p.pos).addScaledVector(_d, best);
      p.dist += best;
      let dead = false;
      if (kind === 'actor') {
        const dist = p.start.distanceTo(_p);
        const def = p.def;
        const dmg = G.dmgAt(def, dist) * (head ? def.head : 1);
        Game.damage(target, dmg, p.owner, def.key, head, _p, _d);
        G.FX.blood(_p, _d.x, _d.y, _d.z, head ? 10 : 6);
        G.Audio.impact(_p, 'flesh');
        dead = true;
      } else if (kind === 'world') {
        G.FX.impact(_p, Wd.hit.normal, Wd.hit.mat);
        G.Audio.impact(_p, Wd.hit.mat);
        dead = true;
      } else if (kind === 'water') {
        G.FX.splash(_p);
        dead = true;
      } else {
        p.pos.copy(_p);
        if (p.dist > p.def.range || p.pos.y < -20) dead = true;
      }
      // 예광탄
      if (p.tracer) {
        const fade = Math.max(0, 1 - p.dist / 30);
        _h.copy(dead ? _p : p.pos).addScaledVector(p.voff, fade);
        const len = Math.min(p.def.tracerLen, p.dist);
        _tail.copy(_h).addScaledVector(_d, -len);
        if (len > 0.3) {
          p.tracer.position.copy(_h); p.tracer.lookAt(_tail);
          const w = 0.016 + Math.min(0.03, p.tracer.position.distanceTo(G.camera.position) * 0.0004);
          p.tracer.scale.set(w, w, len);
          p.tracer.visible = true;
        } else p.tracer.visible = false;
        if (dead) { const tr = p.tracer; setTimeout(() => G.FX.freeTracer(tr), 16); p.tracer = null; }
      }
      if (dead) { if (p.tracer) G.FX.freeTracer(p.tracer); this.list[i] = this.list[this.list.length - 1]; this.list.pop(); i--; }
    }
  }
};
function sphereT(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r;
  if (c > 0 && b > 0) return Infinity;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t < 0 ? 0 : t;
}
function cylT(o, d, cx, cz, r, y0, y1) {
  const fx = o.x - cx, fz = o.z - cz;
  const A = d.x * d.x + d.z * d.z;
  if (A < 1e-8) return Infinity;
  const B = 2 * (fx * d.x + fz * d.z), Cq = fx * fx + fz * fz - r * r;
  const disc = B * B - 4 * A * Cq;
  if (disc < 0) return Infinity;
  let t = (-B - Math.sqrt(disc)) / (2 * A);
  if (t < 0) { if (Cq <= 0) t = 0; else return Infinity; }
  const y = o.y + d.y * t;
  if (y >= y0 && y <= y1) return t;
  if (Math.abs(d.y) > 1e-6) {
    const yc = y > y1 ? y1 : y0;
    const tc = (yc - o.y) / d.y;
    if (tc >= 0) { const hx = fx + d.x * tc, hz = fz + d.z * tc; if (hx * hx + hz * hz <= r * r) return tc; }
  }
  return Infinity;
}
G.sphereT = sphereT;

/* ------------------------------------------------------------------ */
/* 1인칭 뷰모델                                                         */
/* ------------------------------------------------------------------ */
const sm = t => t * t * (3 - 2 * t);
function seg(p, a, b) { return p <= a ? 0 : p >= b ? 1 : sm((p - a) / (b - a)); }
function track(keys, p, out) {
  if (p <= keys[0][0]) return out.copy(keys[0][1]);
  for (let i = 0; i < keys.length - 1; i++) {
    const k1 = keys[i + 1];
    if (p < k1[0]) { const k0 = keys[i]; return out.copy(k0[1]).lerp(k1[1], sm((p - k0[0]) / (k1[0] - k0[0]))); }
  }
  return out.copy(keys[keys.length - 1][1]);
}
const _a = new V3(), _b = new V3(), _c = new V3(), _o = new V3(), _eu = new THREE.Euler(), _m4 = new THREE.Matrix4();
const POSE = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };

const VM = G.VM = {
  models: {}, cur: null, t: 0,
  pos: new V3(), rot: new THREE.Euler(),
  sway: { x: 0, y: 0 }, kick: 0, kickV: 0, kickRoll: 0, sprint: 0, adsT: 0, crouch: 0, flashT: 0, slideT: 0,
  init(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); scene.add(this.root);
    for (const k of G.GUN_IDS.concat(['fists', 'throw'])) {
      const m = Guns.buildVM(k);
      m.root.visible = false;
      this.root.add(m.root);
      this.models[k] = m;
    }
    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0x5d5140, 1.1); scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xffffff, 2.4); this.dir.position.set(1, 2, 1); scene.add(this.dir);
    this.flashLight = new THREE.PointLight(0xffa850, 0, 3, 2); this.flashLight.position.set(0.1, -0.05, -0.6); scene.add(this.flashLight);
  },
  set(type) {
    if (this.cur === type) return;
    for (const k in this.models) this.models[k].root.visible = false;
    this.cur = type;
    const m = type && this.models[type];
    if (m) { m.root.visible = true; m.snap = true; }
  },
  setThrowKind(kind) {
    const m = this.models.throw;
    for (const k in m.items) m.items[k].visible = k === kind;
  },
  fireKick(amount) {
    this.kickV += amount * 3.2;
    this.kickRoll = (Math.random() - 0.5) * amount * 0.05;
    this.flashT = 0.045;
    this.slideT = 1;
    const m = this.models[this.cur];
    if (m && m.flash) { m.flash.visible = true; m.flash.rotation.z = Math.random() * 6.28; const s = 0.8 + Math.random() * 0.5; m.flash.scale.set(s, s, s); }
    this.flashLight.intensity = 6;
    if (m && m.muzzle) this.flashLight.position.copy(m.muzzle).add(m.root.position);
  },
  // 메인 카메라 기준 총구 월드 위치
  muzzleWorld(cam, out) {
    const m = this.models[this.cur];
    if (!m) return out.copy(cam.position);
    out.copy(m.muzzle);
    m.gun.localToWorld(out);
    const k = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(G.vmCamera.fov / 2));
    out.x *= k; out.y *= k;
    return out.applyMatrix4(cam.matrixWorld);
  },
  // 현재 조준경(없으면 가늠쇠)의 조준 위치
  sightOf(m, scope) {
    return (scope && m.scopes[scope]) || m.iron;
  },
  update(dt, s) {
    this.t += dt;
    const m = this.models[this.cur];
    if (!m) return;
    this.root.visible = !s.hideVM;
    this.adsT = s.ads;
    this.sprint = U.damp(this.sprint, s.sprint ? 1 : 0, 10, dt);
    this.crouch = U.damp(this.crouch, s.crouch ? 1 : 0, 8, dt);
    // 반동 스프링
    const acc = -260 * this.kick - 24 * this.kickV;
    this.kickV += acc * dt; this.kick += this.kickV * dt;
    this.kickRoll = U.damp(this.kickRoll, 0, 10, dt);
    // 스웨이
    this.sway.x = U.damp(this.sway.x, U.clamp(-s.lookDX * 0.0005, -0.05, 0.05), 9, dt);
    this.sway.y = U.damp(this.sway.y, U.clamp(-s.lookDY * 0.0005, -0.05, 0.05), 9, dt);
    const a = this.adsT, ia = 1 - a * 0.9;
    const sight = this.sightOf(m, s.scope);
    const p = this.pos.copy(m.hip).lerp(sight.ads, a);
    const r = this.rot; r.set(0, a < 1 ? (1 - a) * 0.035 : 0, 0);
    // 걷기 흔들림
    const mv = s.moving * ia * (1 + this.sprint * 0.9);
    p.x += Math.sin(s.phase) * 0.011 * mv;
    p.y -= Math.abs(Math.cos(s.phase)) * 0.013 * mv;
    r.z += Math.sin(s.phase) * 0.012 * mv;
    // 호흡
    p.y += Math.sin(this.t * 1.6) * 0.0022 * ia;
    p.x += Math.sin(this.t * 0.8) * 0.0012 * ia;
    // 스웨이
    r.y += this.sway.x * ia; r.x += this.sway.y * ia;
    p.x += this.sway.x * 0.25 * ia; p.y += this.sway.y * 0.25 * ia;
    // 달리기 자세
    const sp = this.sprint;
    if (m.cls === 'pistol') { r.x -= 0.5 * sp; p.y -= 0.06 * sp; p.z += 0.03 * sp; }
    else { r.y += 0.75 * sp; r.x -= 0.22 * sp; r.z += 0.25 * sp; p.x -= 0.02 * sp; p.y -= 0.05 * sp; p.z += 0.03 * sp; }
    // 앉기
    p.y -= this.crouch * 0.012 * ia; r.z -= this.crouch * 0.04 * ia;
    // 착지
    p.y -= s.landDip * 0.06;
    // 반동
    p.z += this.kick * 0.065; r.x += this.kick * (a > 0.5 ? 0.04 : 0.11); r.z += this.kickRoll;
    // 무기 교체
    const raise = s.raise;
    p.y -= (1 - raise) * 0.28; r.x -= (1 - raise) * 0.9;
    // 총 애니메이션 (재장전·펌프·볼트·슬라이드) → 자세 오프셋 + 손 목표점
    if (m.def) {
      POSE.x = POSE.y = POSE.z = POSE.rx = POSE.ry = POSE.rz = 0;
      this.animGun(m, s, dt);
      p.x += POSE.x; p.y += POSE.y; p.z += POSE.z; r.x += POSE.rx; r.y += POSE.ry; r.z += POSE.rz;
      // 팔 IK (손은 부드럽게 따라간다)
      const k = m.snap ? 1 : 1 - Math.exp(-dt * 30);
      for (const arm of [m.armL, m.armR]) { arm.cur.lerp(arm.tgt, k); solveArm(arm); }
      m.snap = false;
      // 손에 든 물건(탄창·산탄)은 실제 손 위치를 따라간다
      if (m.holdMag) m.parts.mag.position.copy(m.armL.cur).add(m.keys.magOff);
      if (m.shell && m.shell.visible) m.shell.position.copy(m.armL.cur).add(_c.set(0.014, 0.022, -0.012));
    }
    // 투척
    if (this.cur === 'throw') {
      const hand = m.parts.hand, q = s.throwP;
      hand.position.set(0.18, -0.2, -0.46); hand.rotation.set(0, 0, 0);
      if (q >= 0) {
        if (q < 0.45) { const k = q / 0.45; hand.position.add(_a.set(0.04 * k, 0.1 * k, 0.12 * k)); hand.rotation.x = 0.9 * k; }
        else if (q < 0.65) { const k = (q - 0.45) / 0.2; hand.position.add(_a.set(0.04 - 0.08 * k, 0.1 - 0.08 * k, 0.12 - 0.35 * k)); hand.rotation.x = 0.9 - 1.8 * k; }
        else { const k = (q - 0.65) / 0.35; hand.position.add(_a.set(-0.04, 0.02 - 0.25 * k, -0.23 + 0.1 * k)); hand.rotation.x = -0.9; }
        for (const k in m.items) if (m.items[k].visible && q > 0.55) m.items[k].visible = false;
      }
      const it = m.items.molotov;
      if (it && it.userData.flame) { const f = it.userData.flame; f.scale.set(1 + Math.random() * 0.3, 1.5 + Math.random() * 0.6, 1); }
    }
    if (this.cur === 'fists') {
      const q = s.punchP;
      const rp = m.parts.right, lp = m.parts.left;
      rp.position.set(0.13, -0.15, -0.31); lp.position.set(-0.13, -0.15, -0.33);
      if (q >= 0) { const k = Math.sin(U.clamp(q, 0, 1) * Math.PI); rp.position.add(_a.set(-0.08 * k, 0.05 * k, -0.22 * k)); }
    }
    m.root.position.copy(p);
    m.root.rotation.copy(r);
    // 총구 섬광
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0 && m.flash) m.flash.visible = false; }
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 120);
  },

  // ---------------- 총 애니메이션 ----------------
  animGun(m, s, dt) {
    const P = m.parts, R = m.rest, K = m.keys, def = m.def;
    // 기본: 부품 원위치, 손은 손잡이·총열 덮개
    for (const k in P) { P[k].position.copy(R[k]); P[k].rotation.set(0, 0, 0); P[k].visible = true; }
    if (m.shell) m.shell.visible = false;
    m.holdMag = false;
    m.armR.tgt.copy(m.grip); m.armR.roll = 0; m.armL.roll = 0;
    m.armL.tgt.copy(m.fore);
    // 조준경 표시
    const sc = s.scope;
    for (const t in m.scopes) m.scopes[t].group.visible = t === sc;
    if (P.rearsight) P.rearsight.visible = !sc;
    // 펌프 (사격 후 / 장전 끝)
    if (P.pump) {
      const pz = s.pumpP >= 0 ? Math.sin(U.clamp(s.pumpP, 0, 1) * Math.PI) * 0.072 * m.s / 1.1 : 0;
      P.pump.position.z = R.pump.z + pz;
      m.armL.tgt.copy(P.pump.position).add(K.pumpOff);
    }
    // 권총 슬라이드 (사격 반동 / 탄 소진 시 후퇴 고정)
    if (P.slide) {
      this.slideT = Math.max(0, this.slideT - dt * 18);
      const lockBack = 0.035 * m.s / 1.05;
      P.slide.position.z = R.slide.z + Math.sin(this.slideT * Math.PI) * 0.03 * (s.empty ? 0 : 1) + (s.empty ? lockBack : 0);
    }
    const rl = s.reload;
    if (rl) {
      if (rl.type === 'mag') { if (m.cls === 'pistol') this.animPistolMag(m, rl); else this.animRifleMag(m, rl); }
      else if (rl.type === 'revolver') this.animRevolver(m, rl);
      else if (rl.type === 'shell') this.animShell(m, rl);
      else if (rl.type === 'break') this.animBreak(m, rl);
    } else if (P.barrel) {
      m.armL.tgt.copy(P.barrel.position).add(K.barrelOff);
    }
    if (s.cycleP >= 0 && P.bolt) this.animBolt(m, s.cycleP);
  },
  // 소총·탄창식 산탄총: 탄창 빼기 → 새 탄창 → 삽입 → (빈 탄창이면) 장전 손잡이
  animRifleMag(m, rl) {
    const p = rl.p, K = m.keys, P = m.parts, R = m.rest;
    if (!K.empty) return;
    const keys = rl.empty ? K.empty : K.tac;
    track(keys, p, m.armL.tgt);
    const mag = P.mag;
    if (mag) {
      if (p >= 0.16 && p < 0.42) m.holdMag = true;
      else if (p >= 0.42 && p < 0.47) mag.visible = false;
      else if (p >= 0.47 && p < 0.63) m.holdMag = true;
      if (p >= 0.16 && p < 0.63) mag.rotation.x = -0.15 * Math.sin((p - 0.16) / 0.47 * Math.PI);
    }
    if (rl.empty && K.pull && P.charge && p > 0.79 && p < 0.9) P.charge.position.z = R.charge.z + U.clamp(m.armL.tgt.z - K.bolt.z, 0, 0.075);
    if (rl.empty && !K.pull && P.charge && p > 0.85 && p < 0.9) P.charge.position.z = R.charge.z + 0.02 * (1 - seg(p, 0.85, 0.9));
    // 탄창 구멍이 화면에 들어오게 총을 들어 올리고 안쪽으로 기울인다
    const e = seg(p, 0, 0.12) * (1 - seg(p, rl.empty ? 0.88 : 0.78, rl.empty ? 1 : 0.95));
    const bump = seg(p, 0.6, 0.63) * (1 - seg(p, 0.63, 0.68));
    POSE.rz -= 0.38 * e; POSE.ry += 0.2 * e; POSE.rx += 0.12 * e - 0.05 * bump;
    POSE.x -= 0.07 * e; POSE.y += 0.075 * e; POSE.z += 0.03 * e;
    if (rl.empty && p > 0.84 && p < 0.92) POSE.rx += 0.03 * Math.sin((p - 0.84) / 0.08 * Math.PI);
  },
  // 권총: 탄창이 손잡이에서 떨어짐 → 왼손이 새 탄창 → 삽입 → (빈 탄창이면) 슬라이드 당기기
  animPistolMag(m, rl) {
    const p = rl.p, K = m.keys, P = m.parts, R = m.rest;
    if (!K.empty) return;
    track(rl.empty ? K.empty : K.tac, p, m.armL.tgt);
    const mag = P.mag;
    if (mag) {
      if (p >= 0.13 && p < 0.3) { const u = (p - 0.13) / 0.17; mag.position.copy(R.mag).addScaledVector(m.magDir, 0.02 + 0.42 * u * u); mag.rotation.x = 0.4 * u; }
      else if (p >= 0.3 && p < 0.42) mag.visible = false;
      else if (p >= 0.42 && p < 0.62) m.holdMag = true;
    }
    if (P.slide) {
      const lock = 0.035 * m.s / 1.05;
      P.slide.position.z = R.slide.z + (rl.empty ? lock * (1 - seg(p, 0.815, 0.835)) : 0);
    }
    const e = seg(p, 0, 0.1) * (1 - seg(p, rl.empty ? 0.88 : 0.8, 1));
    const bump = seg(p, 0.6, 0.63) * (1 - seg(p, 0.63, 0.68)), snap = seg(p, 0.815, 0.83) * (1 - seg(p, 0.83, 0.88));
    POSE.rz -= 0.32 * e; POSE.ry += 0.3 * e; POSE.rx += 0.05 * e - 0.06 * bump + 0.04 * snap;
    POSE.x -= 0.07 * e; POSE.y += 0.05 * e; POSE.z -= 0.07 * e;
  },
  // 리볼버: 실린더 열기 → 탄피 배출 → 스피드로더 → 닫기
  animRevolver(m, rl) {
    const p = rl.p, P = m.parts, R = m.rest, F = m.fore;
    const cyl = P.cyl, rounds = P.mag;
    if (!cyl) return;
    const ang = 1.25 * seg(p, 0.08, 0.2) * (1 - seg(p, 0.72, 0.8));
    cyl.rotation.z = ang;
    // 탄 (실린더 기준 로컬)
    if (rounds) {
      if (p >= 0.24 && p < 0.36) { const u = (p - 0.24) / 0.12; rounds.position.copy(R.mag); rounds.position.z += 0.07 * u; rounds.position.y -= 0.12 * u * u; }
      else if (p >= 0.36 && p < 0.5) rounds.visible = false;
      else if (p >= 0.5 && p < 0.6) { rounds.position.copy(R.mag); rounds.position.z += 0.05 * (1 - seg(p, 0.56, 0.6) * 0); }
      else if (p >= 0.6 && p < 0.66) { rounds.position.copy(R.mag); rounds.position.z += 0.05 * (1 - seg(p, 0.6, 0.66)); }
    }
    // 실린더(열린 상태)의 뷰모델 공간 위치
    const cylW = (lx, ly, lz, out) => out.set(lx, ly, lz).applyAxisAngle(_c.set(0, 0, 1), ang).add(cyl.position);
    const rm = R.mag || _o.set(0, 0.02, 0.02);
    cylW(rm.x - 0.035, rm.y - 0.012, rm.z, _a);              // 실린더 왼쪽을 받치는 손
    const keysA = [[0, F], [0.08, _b.copy(_a)]];
    let hand;
    if (p < 0.24) hand = track(keysA.concat([[0.2, _a.clone()], [0.24, _a.clone().add(_o.set(0, 0, -0.03))]]), p, m.armL.tgt);
    else if (p < 0.34) hand = m.armL.tgt.copy(_a).add(_o.set(0, 0, -0.03));
    else if (p < 0.5) hand = track([[0.34, _a.clone().add(_o.set(0, 0, -0.03))], [0.42, F.clone().add(_o.set(-0.1, -0.38, 0.12))], [0.5, F.clone().add(_o.set(-0.14, -0.32, 0.1))]], p, m.armL.tgt);
    else if (p < 0.66) {
      // 탄을 쥔 손 (스피드로더)
      const z = p < 0.6 ? 0.05 : 0.05 * (1 - seg(p, 0.6, 0.66));
      cylW(rm.x - 0.006, rm.y - 0.028, rm.z + z + 0.03, _b);
      if (p < 0.56) { const u = seg(p, 0.5, 0.56); m.armL.tgt.copy(F).add(_o.set(-0.14, -0.32, 0.1)).lerp(_b, u); } else m.armL.tgt.copy(_b);
    } else hand = track([[0.66, _a.clone().add(_o.set(0, -0.01, 0.03))], [0.72, _a.clone()], [0.8, _a.clone()], [1, F]], p, m.armL.tgt);
    const e = seg(p, 0, 0.1) * (1 - seg(p, 0.85, 1));
    const up = seg(p, 0.18, 0.26) * (1 - seg(p, 0.36, 0.44)), dn = seg(p, 0.4, 0.5) * (1 - seg(p, 0.7, 0.8));
    POSE.rz += 0.35 * e; POSE.rx += 0.45 * up - 0.2 * dn + 0.05 * e; POSE.ry += 0.22 * e;
    POSE.x -= 0.07 * e; POSE.y += 0.04 * e; POSE.z -= 0.06 * e;
  },
  // 튜브 탄창 산탄총: 한 발씩 장전구에 밀어 넣기 → (빈 상태였으면) 펌프
  animShell(m, rl) {
    const K = m.keys, F = m.armL.tgt.clone();
    if (!K.below) return;
    let e = 1;
    if (rl.phase === 'start') { e = seg(rl.pp, 0, 1); m.armL.tgt.copy(F).lerp(K.below, seg(rl.pp, 0.1, 1)); }
    else if (rl.phase === 'load') {
      const c = rl.shellP;
      if (c < 0.35) { m.armL.tgt.copy(K.down).lerp(K.portEntry, sm(c / 0.35)); this.shellInHand(m, true, 0); }
      else if (c < 0.55) { m.armL.tgt.copy(K.portEntry).lerp(K.portIn, sm((c - 0.35) / 0.2)); this.shellInHand(m, true, 0); }
      else m.armL.tgt.copy(K.portIn).lerp(K.down, sm((c - 0.55) / 0.45));
    } else { // end
      m.armL.tgt.copy(K.below).lerp(F, seg(rl.pp, 0, 0.35));
      e = 1 - seg(rl.pp, 0.3, 1);
    }
    POSE.rz -= 0.55 * e; POSE.rx += 0.12 * e; POSE.ry += 0.08 * e;
    POSE.x -= 0.05 * e; POSE.y += 0.075 * e; POSE.z += 0.02 * e;
  },
  // 중절식: 총열 꺾기 → 약실에 두 발 → 닫기
  animBreak(m, rl) {
    const K = m.keys, P = m.parts, bar = P.barrel;
    if (!bar || !m.port) return;
    let open, e = 1;
    if (rl.phase === 'start') { open = seg(rl.pp, 0, 0.5); e = seg(rl.pp, 0, 0.6); }
    else if (rl.phase === 'load') open = 1;
    else { open = 1 - seg(rl.pp, 0.15, 0.6); e = 1 - seg(rl.pp, 0.4, 1); }
    const ang = -0.62 * open;
    bar.rotation.x = ang;
    const rot = (v, out) => out.copy(v).sub(bar.position).applyAxisAngle(_c.set(1, 0, 0), ang).add(bar.position);
    const foreOn = rot(m.fore, _a);                                     // 포엔드를 잡은 손 (총열과 함께)
    const ch = rot(m.port, _b);                                         // 약실 입구
    const axis = _o.set(0, 0, 1).applyAxisAngle(_c.set(1, 0, 0), ang);  // 약실에서 뒤쪽 방향
    const below = ch.clone().add(new V3(-0.05, -0.14, 0.08)), down = ch.clone().add(new V3(-0.09, -0.32, 0.14));
    if (rl.phase === 'start') { if (rl.pp < 0.6) m.armL.tgt.copy(foreOn); else m.armL.tgt.copy(foreOn).lerp(below, seg(rl.pp, 0.6, 1)); }
    else if (rl.phase === 'load') {
      const c = rl.shellP;
      const entry = ch.clone().addScaledVector(axis, 0.05).add(new V3(-0.012, -0.02, 0)), into = ch.clone().addScaledVector(axis, 0.012).add(new V3(-0.012, -0.02, 0));
      if (c < 0.4) { m.armL.tgt.copy(down).lerp(entry, sm(c / 0.4)); this.shellInHand(m, true, 0, axis); }
      else if (c < 0.6) { m.armL.tgt.copy(entry).lerp(into, sm((c - 0.4) / 0.2)); this.shellInHand(m, true, 0, axis); }
      else m.armL.tgt.copy(into).lerp(down, sm((c - 0.6) / 0.4));
    } else m.armL.tgt.copy(below).lerp(foreOn, seg(rl.pp, 0, 0.4));
    POSE.rz -= 0.25 * e; POSE.rx += 0.22 * e; POSE.ry += 0.1 * e; POSE.x -= 0.05 * e; POSE.y += 0.08 * e; POSE.z += 0.02 * e;
  },
  shellInHand(m, on, roll, axis) {
    if (!m.shell) return;
    m.shell.visible = on;
    m.shell.position.copy(m.armL.tgt).add(_c.set(0.014, 0.022, -0.012));
    if (axis) { m.shell.quaternion.setFromUnitVectors(_c.set(0, 0, 1), axis); } else m.shell.rotation.set(0.15, 0, 0);
  },
  // 볼트액션: 오른손이 볼트를 들어 올려 당겼다 밀고 내린다
  animBolt(m, c) {
    const P = m.parts, R = m.rest, K = m.keys;
    const bolt = P.bolt;
    const lift = 1.15 * seg(c, 0.12, 0.24) * (1 - seg(c, 0.58, 0.68));
    const back = 0.09 * m.s * seg(c, 0.24, 0.38) * (1 - seg(c, 0.44, 0.56));
    bolt.rotation.z = lift; bolt.position.z = R.bolt.z + back;
    // 손잡이 끝 (볼트 그룹 로컬 → 뷰모델)
    if (!K.knob) K.knob = m.charge ? m.charge.clone().sub(R.bolt) : new V3(0.06, -0.02, 0);
    _a.copy(K.knob).applyAxisAngle(_c.set(0, 0, 1), lift).add(bolt.position).add(_o.set(0.018, -0.004, 0.012));
    if (c < 0.12) m.armR.tgt.copy(m.grip).lerp(_a, sm(c / 0.12));
    else if (c < 0.68) m.armR.tgt.copy(_a);
    else m.armR.tgt.copy(_a).lerp(m.grip, seg(c, 0.68, 0.88));
    const e = seg(c, 0, 0.12) * (1 - seg(c, 0.72, 1));
    POSE.rz += 0.14 * e; POSE.rx -= 0.03 * e; POSE.y -= 0.012 * e; POSE.z += 0.015 * e;
  }
};

})();
