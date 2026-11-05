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
// 장전 속도 배율 (1.25 = 표의 장전 시간보다 25% 빠르게). 산탄 장전의 시작·끝 동작에도 쓴다
const RELOAD_SPEED = G.RELOAD_SPEED = 1.25;
// 반동 배율 (총구가 튀는 양 / 좌우 흔들림 / 화면·총 흔들림)
const RECOIL_V = 1.45, RECOIL_H = 1.35, KICK_K = 1.35;
const W = o => {
  const d = Object.assign({}, BASE, o);
  d.reload = +(d.reload / RELOAD_SPEED).toFixed(3);
  d.recoilV *= RECOIL_V; d.recoilH *= RECOIL_H; d.kick *= KICK_K;
  return d;
};
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
  s12: W({ key: 's12', name: 'S-12 펌프 샷건', short: 'S-12', cls: 'shotgun', ammo: '12g', dmg: 15, head: 1.5, rpm: 72, action: 'pump', mag: 6, reloadType: 'shell', reload: 0.55,
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
// 정적인 팔 (맨손·투척): 같은 팔 모델을 한 번 풀어서 고정
function armVM(parent, hand, elbow, shoulder, gloveSize, side, pose) {
  const rig = armRig(parent, shoulder, hand, elbow, gloveSize, 1, side);
  rig.palmRef = pose && pose.palm ? pose.palm : null;
  rig.curl = rig.curlT = pose && pose.curl !== undefined ? pose.curl : 1;
  rig.thumb = rig.thumbT = pose && pose.thumb !== undefined ? pose.thumb : 0.8;
  rig.trig = rig.trigT = rig.curl;
  rig.inset = 0;
  solveArm(rig, 1);
  return rig;
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
    } else if (!c.userData.keep && (c.isGroup || (c.isObject3D && !c.isMesh))) mergeStatic(c);
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
// 소매(어깨~손목)와 장갑 낀 손(손바닥·손가락 마디)을 뼈대 하나로 묶은 스키닝 메시.
// 뼈: 어깨 → 팔꿈치 → 손목(손) → 손가락 3마디 ×4 + 엄지 3마디. 팔꿈치는 두 뼈에 나눠 실려 부드럽게 굽는다
const WRIST = 0.052, HAND_S = 0.93;
const GRIP_CONTACT = new V3(0,0.067,0.029); // 손가락 뿌리와 엄지 두덩 사이의 손잡이 접촉
const PALM_CONTACT = new V3(0, 0.046, 0.018); // IK 목표는 손바닥 표면의 접촉점
let ARM_M = null;
function armMats() {
  if (ARM_M) return ARM_M;
  const M = mats();
  // 천: 짜임 + 큰 주름 높이 → 노멀맵
  const S = 128, h = new Float32Array(S * S), n1 = G.Tex.tileNoise(S, 4, 3, 911), n2 = G.Tex.tileNoise(S, 16, 2, 912);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, weave = ((x >> 1) + (y >> 1)) % 2 ? 0.12 : 0;
    h[i] = n1[i] * 1.6 + n2[i] * 0.5 + weave;
  }
  const fabricN = G.Tex.normalMap(h, S, 2.4);
  fabricN.repeat.set(2, 3);
  const lh = G.Tex.tileNoise(S, 24, 3, 913);
  const leatherN = G.Tex.normalMap(lh, S, 3.5);
  leatherN.repeat.set(2, 2);
  const acu = G.Soldiers && G.Soldiers.ready;
  ARM_M = {
    sleeve: new THREE.MeshStandardMaterial({ color: M.sleeve.color, map: M.sleeve.map, roughness: 0.93, normalMap: fabricN, normalScale: new THREE.Vector2(0.9, 0.9) }),
    glove: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.01, normalMap: leatherN, normalScale: new THREE.Vector2(0.28, 0.28) }),
    gc: acu ? [0.12, 0.105, 0.075] : [0.03, 0.03, 0.028]     // 장갑 색 (선형)
  };
  if (ARM_M.sleeve.map) { ARM_M.sleeve.map = ARM_M.sleeve.map.clone(); ARM_M.sleeve.map.repeat.set(2, 3); ARM_M.sleeve.map.needsUpdate = true; }
  return ARM_M;
}
// 모서리가 둥근 상자
function roundBox(w, h, d, r, seg) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, v = new V3(), c = new V3();
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(U.clamp(v.x, -ix, ix), U.clamp(v.y, -iy, iy), U.clamp(v.z, -iz, iz));
    v.sub(c); if (v.lengthSq() > 1e-12) v.normalize().multiplyScalar(r); v.add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
// 한 뼈에 딸린 조각: 지오메트리에 색·뼈 번호를 넣는다
function piece(geo, mat4, bone, col, w2) {
  const g = (geo.index ? geo.toNonIndexed() : geo.clone());
  g.applyMatrix4(mat4);
  const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), cc = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    si[i * 4] = bone; sw[i * 4] = 1;
    if (w2) { const [b2, f] = w2(g.attributes.position.getY(i)); si[i * 4 + 1] = b2; sw[i * 4] = 1 - f; sw[i * 4 + 1] = f; }
    cc[i * 3] = col[0]; cc[i * 3 + 1] = col[1]; cc[i * 3 + 2] = col[2];
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
const FINGERS = [   // [x, 마디 길이, 반지름, 손바닥 위의 시작 높이]
  [0.027, [0.035, 0.025, 0.020], 0.0095, 0.083],
  [0.009, [0.039, 0.027, 0.021], 0.0100, 0.089],
  [-0.010, [0.037, 0.025, 0.020], 0.0096, 0.085],
  [-0.027, [0.029, 0.020, 0.017], 0.0083, 0.074]
];
// 각 마디를 겹친 캡슐로 만들지 않고 연속 표면으로 잇는다. 관절 양쪽은 두 뼈에 부드럽게 걸친다.
function fingerSkin(chain, lens, radius, bones, col) {
  const ends = [0, lens[0], lens[0] + lens[1], lens.reduce((a, b) => a + b, 0)];
  const rings = [-0.006, 0];
  for (let i = 0; i < 3; i++) {
    const lo = ends[i], hi = ends[i + 1];
    rings.push(lo + 0.005, (lo + hi) / 2, hi - 0.005, hi);
  }
  rings.push(ends[3] + radius * 0.38);
  const pos = [], uv = [], skin = [], weights = [], colors = [], indices = [], sides = 12;
  const p = new V3(), bind = chain[0].matrixWorld;
  rings.forEach((y, row) => {
    const taper = 1 - U.clamp(y / ends[3], 0, 1) * 0.23;
    const tip = row === rings.length - 1 ? 0.12 : row === rings.length - 2 ? 0.75 : 1;
    let a = y < ends[1] ? 0 : y < ends[2] ? 1 : 2, b = a, f = 0;
    for (let j = 1; j < 3; j++) if (Math.abs(y - ends[j]) <= 0.0051) {
      a = j - 1; b = j; f = U.smoothstep(ends[j] - 0.005, ends[j] + 0.005, y);
    }
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2, r = radius * taper * tip;
      p.set(Math.cos(angle) * r, y, Math.sin(angle) * r * 0.88).applyMatrix4(bind);
      pos.push(p.x, p.y, p.z); uv.push(j / sides, y * 12);
      skin.push(bones.indexOf(chain[a]), bones.indexOf(chain[b]), 0, 0); weights.push(1 - f, f, 0, 0);
      const shade = Math.sin(angle) < -0.4 ? 0.82 : 1;
      colors.push(col[0] * shade, col[1] * shade, col[2] * shade);
      if (row && j < sides) { const x = (row - 1) * (sides + 1) + j, z = x + sides + 1; indices.push(x, z, x + 1, x + 1, z, z + 1); }
    }
  });
  p.set(0,ends[3]+radius*0.45,0).applyMatrix4(bind);const cap=pos.length/3;
  pos.push(p.x,p.y,p.z);uv.push(0.5,1);skin.push(bones.indexOf(chain[2]),0,0,0);weights.push(1,0,0,0);colors.push(...col);
  const last=(rings.length-1)*(sides+1);for(let j=0;j<sides;j++)indices.push(last+j,cap,last+j+1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skin, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals(); return g.toNonIndexed();
}
function palmSkin() {
  // 손목에서 손바닥·손등·손가락 뿌리로 넓어지는 타원 단면. 둥근 상자 같은 외곽을 없앤다.
  const sections = [[-0.014,0.026,0.017],[0,0.028,0.017],[0.022,0.035,0.019],
    [0.045,0.039,0.019],[0.068,0.039,0.016],[0.083,0.035,0.014],[0.094,0.027,0.009]];
  const pos = [], uv = [], ix = [], N = 20;
  sections.forEach(([y,w,d],i) => { for(let j=0;j<=N;j++) {
    const t=j/N*Math.PI*2; pos.push(Math.cos(t)*w,y,Math.sin(t)*d);uv.push(j/N,y*8);
    if(i&&j<N){const a=(i-1)*(N+1)+j,b=a+N+1;ix.push(a,b,a+1,a+1,b,b+1);}
  }});
  const bottom=pos.length/3;pos.push(0,sections[0][0],0);uv.push(0.5,0);
  const top=pos.length/3;pos.push(0,sections[sections.length-1][0],0);uv.push(0.5,1);
  const last=(sections.length-1)*(N+1);
  for(let j=0;j<N;j++){ix.push(j,j+1,bottom,last+j,top,last+j+1);}
  const g = new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
function armRig(parent, shoulder, hand, elbow, glove, slack, sideArg) {
  const AM = armMats();
  const side = sideArg || (hand.x - shoulder.x < 0 ? 1 : -1);   // 1 오른팔, -1 왼팔 (어깨가 손보다 바깥쪽)
  const a = shoulder.distanceTo(elbow) * slack, b = elbow.distanceTo(hand) * slack, bw = Math.max(0.05, b - WRIST * HAND_S);
  const mid = shoulder.clone().add(hand).multiplyScalar(0.5);
  const pole = elbow.clone().sub(mid).normalize();
  const grp = new THREE.Group(); grp.userData.keep = true;
  // 뼈 (편 자세로 묶는다: +y 가 손끝 방향, 손바닥 +z, 엄지 쪽 +x·side)
  const bS = new THREE.Bone(), bE = new THREE.Bone(), bT = new THREE.Bone(), bD = new THREE.Bone(), bW = new THREE.Bone();
  bE.position.set(0, a, 0); bT.position.set(0,a+bw*0.55,0);bD.position.set(0,a+bw,0);bW.position.set(0, a + bw, 0);
  grp.add(bS,bE,bT,bD,bW);
  const bones = [bS, bE, bT, bD, bW], fing = [];
  const mk = (parentB, pos, q) => { const bn = new THREE.Bone(); bn.position.copy(pos); if (q) bn.quaternion.copy(q); parentB.add(bn); bones.push(bn); return bn; };
  for (const [fx, lens, radius, baseY] of FINGERS) {
    const b0 = mk(bW, new V3(fx * side, baseY, 0.002)), b1 = mk(b0, new V3(0, lens[0], 0)), b2 = mk(b1, new V3(0, lens[1], 0));
    fing.push([b0, b1, b2]);
  }
  // 엄지: 손바닥 옆에서 비스듬히 앞·안쪽으로
  const tq = new THREE.Quaternion().setFromRotationMatrix(basis(new V3(0.68 * side, 0.54, 0.32).normalize(), new V3(-0.38 * side, 0.05, 0.9)));
  const t0 = mk(bW, new V3(0.027 * side, 0.026, 0.006), tq), t1 = mk(t0, new V3(0, 0.029, 0)), t2 = mk(t1, new V3(0, 0.025, 0));
  grp.updateMatrixWorld(true);
  const idx = bn => bones.indexOf(bn);
  const W = bn => bn.matrixWorld;
  // ----- 소매 (어깨 위 ~ 손목 커프) -----
  const sleeve = [], gloveP = [];
  {
    const RS = 18, ys = [], pos = [], uv = [], ind = [], si = [], sw = [];
    const y0 = -0.06, y1 = a + bw - 0.012;
    for (let y = y0; y <= y1 + 1e-6; y += 0.012) ys.push(Math.min(y, y1));
    const rad = (y) => {
      // 팔꿈치에서 손목으로 가늘어지는 소매. 커프는 손바닥보다 넓어지지 않는다.
      if (y < a) { const t = U.clamp(y / a, 0, 1); return 0.055 - 0.004 * t + 0.004 * Math.sin(t * Math.PI) - 0.006 * U.smoothstep(0.72, 1, t); }
      const t = U.clamp((y - a) / bw, 0, 1);
      return 0.045 + 0.006 * Math.sin(Math.min(1, t * 2.1) * Math.PI) - 0.014 * t + 0.001 * U.smoothstep(0.84, 0.97, t);
    };
    const nz = G.Tex.tileNoise(64, 8, 2, 77 + (side > 0 ? 1 : 2));
    ys.forEach((y, i) => {
      for (let j = 0; j <= RS; j++) {
        const th = j / RS * Math.PI * 2;
        // 주름: 팔꿈치 안쪽·커프 근처에 몰린다
        const nearE = Math.exp(-Math.pow((y - a) / 0.05, 2)), nearC = Math.exp(-Math.pow((y - (a + bw - 0.05)) / 0.04, 2));
        const wr = nz[(Math.floor(y * 220) & 63) * 64 + (j * 3 & 63)] - 0.5;
        const r = rad(y) * (1 + wr * (0.05 + 0.16 * nearE + 0.1 * nearC));
        pos.push(Math.cos(th) * r, y, Math.sin(th) * r * 0.93);
        uv.push(j / RS, y * 2.2);
        // 팔꿈치는 위·아래 뼈에 나눠 싣는다
        if(y<a+0.04){
          const f=U.smoothstep(a-0.045,a+0.04,y);si.push(0,1,0,0);sw.push(1-f,f,0,0);
        }else{
          const t=(y-a)/bw,distal=t>0.55;
          const f=distal?U.smoothstep(0.55,0.96,t):U.smoothstep(0.14,0.55,t);
          si.push(distal?2:1,distal?3:2,0,0);sw.push(1-f,f,0,0);
        }
      }
      if (i) for (let j = 0; j < RS; j++) { const p0 = (i - 1) * (RS + 1) + j, p1 = p0 + RS + 1; ind.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setIndex(ind); g.computeVertexNormals();
    sleeve.push(g);
  }
  // ----- 장갑 -----
  const gc = AM.gc, dark = [gc[0] * 0.55, gc[1] * 0.55, gc[2] * 0.55], pad = [gc[0] * 0.4, gc[1] * 0.4, gc[2] * 0.42];
  const M4 = new THREE.Matrix4(), T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const wM = W(bW), dM = W(bD);
  // 손목 커프 (팔뚝·손목 뼈 사이에 걸침)
  gloveP.push(piece(new THREE.CylinderGeometry(0.032, 0.037, 0.037, 18, 3), dM.clone().multiply(T(0, -0.006, 0)).multiply(new THREE.Matrix4().makeScale(1, 1, 0.86)), idx(bD), dark));
  // 커프 안의 짧은 연결부는 아래팔 끝에서 손목으로 점진적으로 굽힌다.
  gloveP.push(piece(new THREE.CylinderGeometry(0.028,0.033,0.05,18,8),dM.clone().multiply(T(0,-0.003,0)),idx(bD),dark,
    y=>[idx(bW),U.smoothstep(a+bw-0.025,a+bw+0.022,y)]));
  gloveP.push(piece(new THREE.SphereGeometry(1,12,8).scale(0.026,0.023,0.016),wM.clone().multiply(T(0,-0.004,0)),idx(bW),dark));
  // 손바닥 + 손등
  gloveP.push(piece(palmSkin(), wM.clone(), idx(bW), gc));
  gloveP.push(piece(roundBox(0.045, 0.029, 0.006, 0.003, 2), wM.clone().multiply(T(0, 0.031, -0.019)), idx(bW), dark));
  gloveP.push(piece(new THREE.SphereGeometry(1,12,8).scale(0.018,0.028,0.014), wM.clone().multiply(T(0.024 * side, 0.032, 0.006)), idx(bW), gc));
  // 손가락 마디
  FINGERS.forEach(([fx, lens, r, y], k) => {
    gloveP.push(fingerSkin(fing[k], lens, r, bones, gc));
    gloveP.push(piece(roundBox(r*1.5,0.014,0.004,0.002,2),wM.clone().multiply(T(fx*side,y-0.006,-0.015)),idx(bW),pad));
  });
  gloveP.push(fingerSkin([t0,t1,t2],[0.029,0.025,0.021],0.0105,bones,gc));
  const gg = THREE.mergeGeometries(gloveP, false);
  const sk = new THREE.Skeleton(bones);
  const sm = new THREE.SkinnedMesh(sleeve[0], AM.sleeve), gm = new THREE.SkinnedMesh(gg, AM.glove);
  for (const m of [sm, gm]) { m.frustumCulled = false; m.userData.keep = true; grp.add(m); m.bind(sk, new THREE.Matrix4()); }
  parent.add(grp);
  const rig = { grp, side, bS, bE, bT, bD, bW, fing, thumbB: [t0, t1, t2], S: shoulder.clone(), baseS: shoulder.clone(), shoulderShift: new V3(), shoulderVelocity:new V3(), a, b, bw, pole, rest: hand.clone(), tgt: hand.clone(), cur: hand.clone(), roll: 0,
    bendDir:new V3(),bendAxis:new V3(0,1,0),bendReady:false,swivelVelocity:0,framesReady:false,upperQ:new THREE.Quaternion(),foreQ:new THREE.Quaternion(),foreTwist:0,foreTwistVelocity:0,
    curl: 0.9, curlT: 0.9, thumb: 0.7, thumbT: 0.7, trig: 0.9, trigT: 0.9, palmRef: null, fingerRef: null, palmTarget: new V3(), fingerTarget: new V3(), thumbRest: tq.clone(), handQ: new THREE.Quaternion(), handReady: false, anchorLocal: PALM_CONTACT.clone(), contact: hand.clone(), pinch: hand.clone(), contactError: 0, wristAngle: 0,
    aim: side > 0 ? new V3(0,0.15,-1).normalize() : new V3(1,0,-0.08).normalize(), homeK: 0 };
  rig.pole.set(side * 0.8, -0.55, 0.15).normalize();
  solveArm(rig, 1);
  return rig;
}
// 축 두 개(Y, Z 참고)로 회전 행렬
const _bx = new V3(), _by = new V3(), _bz = new V3();
function basis(y, zRef, out) {
  _by.copy(y).normalize();
  _bz.copy(zRef).addScaledVector(_by, -zRef.dot(_by));
  if (_bz.lengthSq() < 1e-8) _bz.set(0, 0, 1).addScaledVector(_by, -_by.z);
  _bz.normalize();
  _bx.crossVectors(_by, _bz);
  return (out || new THREE.Matrix4()).makeBasis(_bx, _by, _bz);
}
const _D = new V3(), _E = new V3(), _P2 = new V3(), _F = new V3(), _Z = new V3(), _Wr = new V3(), _m4b = new THREE.Matrix4();
const _handDir = new V3(), _contact = new V3(), _handQ = new THREE.Quaternion(), _bendQ = new THREE.Quaternion();
const _previousHandQ = new THREE.Quaternion();
const HAND_Y = new V3(0,1,0), HAND_Z = new V3(0,0,1), HAND_X = new V3(1,0,0);
const _pinchRef=new V3(),_thumbTip=new V3(),_handleRef=new V3(),_fingerTip=new V3(),_indexRef=new V3();
const MAX_WRIST = 82 * Math.PI / 180;
const _poleTarget=new V3(),_poleCross=new V3(),_frameY=new V3(),_frameZ=new V3(),_frameTarget=new V3(),_transportQ=new THREE.Quaternion();
function dampShoulder(r,target,dt) {
  const w=36,e=Math.exp(-w*dt);
  for(const axis of ['x','y','z']){
    const x=r.shoulderShift[axis]-target[axis],v=r.shoulderVelocity[axis],c=v+w*x;
    r.shoulderShift[axis]=target[axis]+(x+c*dt)*e;
    r.shoulderVelocity[axis]=(v-w*c*dt)*e;
  }
  if(r.shoulderShift.length()>0.09){r.shoulderShift.setLength(0.09);r.shoulderVelocity.multiplyScalar(0.5);}
}
// Receiver/stock envelopes are built once from the loaded body triangles, in VM space.
// Y/Z cells preserve the receiver/stock outline instead of filling one large box.
function armEnvelopes(gun) {
  const cells=new Map(),step=0.025;
  const clip=(poly,axis,value,sign)=>{
    const out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;
      if(da>=0)out.push(a);
      if((da>=0)!==(db>=0))out.push(a.clone().lerp(b,da/(da-db)));
    }return out;
  };
  for(const mesh of gun.children){
    if(!mesh.isMesh)continue;
    const g=mesh.geometry,p=g.attributes.position,ix=g.index,n=ix?ix.count:p.count;
    for(let i=0;i<n;i+=3){
      const tri=[0,1,2].map(j=>new V3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j));
      const z0=Math.floor(Math.min(...tri.map(v=>v.z))/step),z1=Math.floor(Math.max(...tri.map(v=>v.z))/step);
      for(let z=z0;z<=z1;z++){
        const slab=clip(clip(tri,'z',z*step,1),'z',(z+1)*step,-1);if(!slab.length)continue;
        const y0=Math.floor(Math.min(...slab.map(v=>v.y))/step),y1=Math.floor(Math.max(...slab.map(v=>v.y))/step);
        for(let y=y0;y<=y1;y++){
          const poly=clip(clip(slab,'y',y*step,1),'y',(y+1)*step,-1);if(!poly.length)continue;
          const key=z+','+y;let box=cells.get(key);if(!box){box=new THREE.Box3();cells.set(key,box);}
          for(const v of poly)box.expandByPoint(v);
        }
      }
    }
  }
  if(!cells.size)return [];
  const boxes=Array.from(cells.values());
  const zs=Array.from(cells.keys(),k=>+k.split(',')[0]),ys=Array.from(cells.keys(),k=>+k.split(',')[1]);
  const zMin=Math.min(...zs),zMax=Math.max(...zs),yMin=Math.min(...ys),yMax=Math.max(...ys),rows=yMax-yMin+1;
  const grid=new Array((zMax-zMin+1)*rows);
  for(const [key,box]of cells){const [z,y]=key.split(',').map(Number);grid[(z-zMin)*rows+y-yMin]=box;}
  Object.assign(boxes,{step,grid,zMin,zMax,yMin,yMax,rows});return boxes;
}
// Fit each asset's resting contact to its own surface; shared class anchors can
// otherwise bury the cuff even before reloading. Fingers still wrap the grip.
function fitWristContact(point,normal,fingers,anchor,side,boxes) {
  const q=new THREE.Quaternion().setFromRotationMatrix(basis(new V3(...fingers),new V3(...normal)));
  const offset=anchor.clone().multiplyScalar(HAND_S).applyQuaternion(q),wrist=new V3(),candidate=new V3(),best=point.clone();let score=Infinity;
  for(let x=0;x<=6;x++)for(let y=0;y<=6;y++){
    candidate.copy(point).add(new V3(side*x*0.005,-y*0.005,0));wrist.copy(candidate).sub(offset);
    let overlap=0;for(const b of boxes)overlap=Math.max(overlap,0.037-b.distanceToPoint(wrist));
    const cost=overlap*10+Math.hypot(x,y)*0.005;
    if(cost<score){score=cost;best.copy(candidate);}
  }return best;
}
const _clearPoint=new V3(),_clearE=new V3(),_clearBend=new V3();
// Positive means cloth overlaps a solid envelope. The wrist/cuff is included.
function armOverlap(r,elbow,wrist,samples=12,elbowOnly=false) {
  let depth=0;
  if(!r.obstacles?.length)return depth;
  for(const [from,to,upper]of [[r.S,elbow,true],[elbow,wrist,false]])for(let j=0;j<=samples;j++){
    const t=j/samples;if(elbowOnly&&!upper&&t>0.95)continue;const radius=upper?0.059-0.013*t:0.053-0.018*t;
    _clearPoint.lerpVectors(from,to,t);
    const {step,grid,zMin,zMax,yMin,yMax,rows}=r.obstacles;
    const z0=Math.floor((_clearPoint.z-radius)/step),z1=Math.floor((_clearPoint.z+radius)/step),y0=Math.floor((_clearPoint.y-radius)/step),y1=Math.floor((_clearPoint.y+radius)/step);
    for(let z=Math.max(zMin,z0);z<=Math.min(zMax,z1);z++)for(let y=Math.max(yMin,y0);y<=Math.min(yMax,y1);y++){
      const b=grid[(z-zMin)*rows+y-yMin];if(!b)continue;
      const dx=Math.max(b.min.x-_clearPoint.x,0,_clearPoint.x-b.max.x),dy=Math.max(b.min.y-_clearPoint.y,0,_clearPoint.y-b.max.y),dz=Math.max(b.min.z-_clearPoint.z,0,_clearPoint.z-b.max.z);
      depth=Math.max(depth,radius-Math.hypot(dx,dy,dz));
    }
  }
  return depth;
}
// Keep the elbow on the same outside corridor throughout approach, pull and regrip.
// Search only around the previous bend; do not flip the IK plane to the other side.
function clearElbow(r,axis,wrist,along,height,bend,dt,advance) {
  if(!r.obstacles)return;
  if(!advance)return;
  _clearE.copy(r.S).addScaledVector(axis,along).addScaledVector(bend,height);
  if(armOverlap(r,_clearE,wrist,12,true)<0.002)return;
  let best=Infinity,bestAngle=0;
  for(let i=-12;i<=12;i++){
    const angle=i*Math.PI/24;
    _clearBend.copy(bend).applyAxisAngle(axis,angle);
    _clearE.copy(r.S).addScaledVector(axis,along).addScaledVector(_clearBend,height);
    const overlap=armOverlap(r,_clearE,wrist,12,true);
    const cost=overlap*150+Math.abs(angle)*0.015;
    if(cost<best){best=cost;bestAngle=angle;}
  }
  // Choreography provides clearance in advance; this is a small residual correction.
  if(advance)bestAngle=U.clamp(bestAngle,-dt*4,dt*4);else bestAngle=0;
  bend.applyAxisAngle(axis,bestAngle).normalize();
  r.bendDir.copy(bend);r.bendAxis.copy(axis);
}
function elbowBend(r,axis,dt,advance,out) {
  _poleTarget.copy(r.pole).addScaledVector(axis,-r.pole.dot(axis));
  const strength=_poleTarget.length();
  if(!r.bendReady){
    out.copy(_poleTarget);if(out.lengthSq()<1e-6)out.set(r.side,0,0).addScaledVector(axis,-r.side*axis.x);
    out.normalize();r.swivelVelocity=0;r.bendReady=true;
  }else{
    _transportQ.setFromUnitVectors(r.bendAxis,axis);out.copy(r.bendDir).applyQuaternion(_transportQ).normalize();
    if(advance){
      let angle=0;
      if(strength>0.12){
        _poleTarget.divideScalar(strength);
        angle=Math.atan2(axis.dot(_poleCross.crossVectors(out,_poleTarget)),U.clamp(out.dot(_poleTarget),-1,1));
      }
      const w=18,e=Math.exp(-w*dt),v=r.swivelVelocity,c=v-w*angle;
      let turn=angle+(-angle+c*dt)*e;
      r.swivelVelocity=U.clamp((v-w*c*dt)*e,-3.5,3.5);turn=U.clamp(turn,-3.5*dt,3.5*dt);
      out.applyAxisAngle(axis,turn).normalize();
    }
  }
  r.bendDir.copy(out);r.bendAxis.copy(axis);
}
// 길이 축은 정확히 뼈를 따라가고, 축 주변의 비틀림만 연속된 프레임으로 전달한다.
function armFrame(axis,reference,q,ready,dt,rate) {
  if(!ready){q.setFromRotationMatrix(basis(axis,reference,_m4b));return;}
  _frameY.copy(HAND_Y).applyQuaternion(q);_frameZ.copy(HAND_Z).applyQuaternion(q);
  _transportQ.setFromUnitVectors(_frameY,axis);_frameZ.applyQuaternion(_transportQ).normalize();
  _frameTarget.copy(reference).addScaledVector(axis,-reference.dot(axis));
  if(_frameTarget.lengthSq()>0.015){
    _frameTarget.normalize();
    const angle=Math.atan2(axis.dot(_poleCross.crossVectors(_frameZ,_frameTarget)),U.clamp(_frameZ.dot(_frameTarget),-1,1));
    _frameZ.applyAxisAngle(axis,U.clamp(angle*(1-Math.exp(-dt*12)),-rate*dt,rate*dt));
  }
  q.setFromRotationMatrix(basis(axis,_frameZ,_m4b));
}
function forearmTwist(r,axis,handNormal,dt) {
  _frameZ.copy(HAND_Z).applyQuaternion(r.foreQ);
  _frameTarget.copy(handNormal).addScaledVector(axis,-handNormal.dot(axis));
  let target=r.foreTwist;
  if(_frameTarget.lengthSq()>0.025){
    _frameTarget.normalize();target=Math.atan2(axis.dot(_poleCross.crossVectors(_frameZ,_frameTarget)),_frameZ.dot(_frameTarget));
    target+=Math.PI*2*Math.round((r.foreTwist-target)/(Math.PI*2));target=U.clamp(target,-1.4,1.4);
  }
  if(!r.framesReady){r.foreTwist=target;r.foreTwistVelocity=0;return;}
  const w=24,e=Math.exp(-w*dt),x=r.foreTwist-target,v=r.foreTwistVelocity,c=v+w*x;
  const next=target+(x+c*dt)*e,change=U.clamp(next-r.foreTwist,-4*dt,4*dt);
  r.foreTwist=U.clamp(r.foreTwist+change,-1.4,1.4);r.foreTwistVelocity=U.clamp((v-w*c*dt)*e,-4,4);
}
function handShape(r) {
  for(let i=0;i<4;i++) {
    const c=U.clamp(i===0?r.trig:r.curl*(1+i*0.025),0,1),ch=r.fing[i];
    ch[0].rotation.set(c*1.05,0,(1.5-i)*0.045*r.side*(1-c*0.8));
    ch[1].rotation.x=c*1.24;ch[2].rotation.x=c*0.72;
  }
  const t=U.clamp(r.thumb,0,1),T=r.thumbB;
  T[0].quaternion.copy(r.thumbRest).multiply(_bendQ.setFromAxisAngle(HAND_X,t*0.52));
  T[1].rotation.x=t*0.68;T[2].rotation.x=t*0.48;
  // 손목 좌표계에서 실제 엄지·검지 끝 사이를 구한다. 산탄과 슬라이드 집기는 이 점으로 맞춘다.
  _pinchRef.set(0,FINGERS[0][1][2],0);_thumbTip.set(0,0.021,0);
  for(let i=2;i>=0;i--){
    _pinchRef.applyQuaternion(r.fing[0][i].quaternion).add(r.fing[0][i].position);
    _thumbTip.applyQuaternion(T[i].quaternion).add(T[i].position);
  }
  _pinchRef.add(_thumbTip).multiplyScalar(0.5);
  // A charging handle is hooked by the curled fingers, not buried in the palm.
  _handleRef.set(0,0,0);
  for(const k of [0,1,2]){
    _fingerTip.set(0,FINGERS[k][1][2],0);
    for(let i=2;i>=0;i--)_fingerTip.applyQuaternion(r.fing[k][i].quaternion).add(r.fing[k][i].position);
    if(k===0)_indexRef.copy(_fingerTip);
    _handleRef.addScaledVector(_fingerTip,1/3);
  }
}
function solveArm(r, dt) {
  const hadHand=r.handReady;_previousHandQ.copy(r.handQ);
  const k = 1 - Math.exp(-(dt || 0.016) * 18);
  r.curl += (r.curlT - r.curl) * k; r.thumb += (r.thumbT - r.thumb) * k; r.trig += (r.trigT - r.trig) * k;
  handShape(r);
  const pinch=(r.contactMode||'').startsWith('shell')||r.contactMode==='pinch';
  let anchor=PALM_CONTACT;
  if(pinch)anchor=_pinchRef;
  else switch(r.contactMode){
    case 'handle':case 'slide':case 'bolt':case 'loader':case 'cylinder':anchor=_handleRef;break;
    case 'button':anchor=_indexRef;break;
    case 'buttonThumb':anchor=_thumbTip;break;
    case 'grip':anchor=GRIP_CONTACT;break;
  }
  if(!r.handReady)r.anchorLocal.copy(anchor);
  else r.anchorLocal.lerp(anchor,1-Math.exp(-dt*26));
  _Z.copy(r.palmRef || (r.side > 0 ? _contact.set(-1,0.06,0) : _contact.set(0,1,0))).normalize();
  _handDir.copy(r.fingerRef || r.aim).normalize();
  _handQ.setFromRotationMatrix(basis(_handDir, _Z, _m4b));
  if(r.roll) _handQ.multiply(_bendQ.setFromAxisAngle(HAND_Y, U.clamp(r.roll,-0.4,0.4)));
  if(!r.handReady) { r.handQ.copy(_handQ);r.handReady=true; }
  else r.handQ.rotateTowards(_handQ,Math.min(r.handQ.angleTo(_handQ)*(1-Math.exp(-dt*24)),dt*9));
  const a=r.a,b=r.bw;
  _contact.copy(r.anchorLocal).multiplyScalar(HAND_S).applyQuaternion(_handQ);
  _D.copy(r.reachRef || r.tgt).sub(_contact).sub(r.baseS);
  const reach=_D.length(),extra=U.clamp(reach-(a+b-0.008),0,0.09);
  if(reach>1e-6)_D.multiplyScalar(extra/reach);
  dampShoulder(r,_D,dt);r.S.copy(r.baseS).add(r.shoulderShift);
  // 먼저 손바닥 표면에서 손목 위치를 역산한다. 팔뚝 방향으로 임의로 빼던 오프셋을 없앤다.
  for(let pass=0;pass<2;pass++) {
    _contact.copy(r.anchorLocal).multiplyScalar(HAND_S).applyQuaternion(r.handQ);
    _Wr.copy(r.cur).sub(_contact);
    _D.subVectors(_Wr,r.S);let L=_D.length();if(L<1e-6)return;_D.divideScalar(L);
    L=U.clamp(L,Math.abs(a-b)+0.002,a+b-0.002);
    _Wr.copy(r.S).addScaledVector(_D,L);
    elbowBend(r,_D,dt,pass===0,_P2);
    const cosA=U.clamp((a*a+L*L-b*b)/(2*a*L),-1,1);
    const along=a*cosA,height=a*Math.sqrt(Math.max(0,1-cosA*cosA));
    clearElbow(r,_D,_Wr,along,height,_P2,dt,pass===0);
    _E.copy(r.S).addScaledVector(_D,along).addScaledVector(_P2,height);
    _F.subVectors(_Wr,_E).normalize();
    // 손목이 팔뚝 뒤로 접히지 않게 제한한다. 보정된 방향으로 접촉점을 한 번 더 계산한다.
    _handDir.copy(HAND_Y).applyQuaternion(r.handQ);
    const angle=Math.acos(U.clamp(_F.dot(_handDir),-1,1));
    if(pass===0 && angle>MAX_WRIST) {
      _bendQ.setFromUnitVectors(_F,_handDir);_handQ.identity().slerp(_bendQ,MAX_WRIST/angle);
      _handDir.copy(_F).applyQuaternion(_handQ);
      _Z.copy(HAND_Z).applyQuaternion(r.handQ);
      r.handQ.setFromRotationMatrix(basis(_handDir,_Z,_m4b));
      if(hadHand){_handQ.copy(r.handQ);r.handQ.copy(_previousHandQ).rotateTowards(_handQ,dt*10);}
    }
  }
  _Z.copy(HAND_Z).applyQuaternion(r.handQ);
  _D.subVectors(_E,r.S).normalize();armFrame(_D,_P2,r.upperQ,r.framesReady,dt,3.5);
  armFrame(_F,_P2,r.foreQ,r.framesReady,dt,3.5);forearmTwist(r,_F,_Z,dt);
  r.bS.position.copy(r.S);r.bS.quaternion.copy(r.upperQ);
  r.bE.position.copy(_E);r.bE.quaternion.copy(r.foreQ);
  r.bT.position.copy(_E).addScaledVector(_F,b*0.55);r.bT.quaternion.copy(r.foreQ).multiply(_bendQ.setFromAxisAngle(HAND_Y,r.foreTwist*0.45));
  r.bD.position.copy(_Wr);r.bD.quaternion.copy(r.foreQ).multiply(_bendQ.setFromAxisAngle(HAND_Y,r.foreTwist*0.85));
  r.framesReady=true;
  r.bW.position.copy(_Wr);r.bW.quaternion.copy(r.handQ);r.bW.scale.setScalar(HAND_S);
  _contact.copy(r.anchorLocal).multiplyScalar(HAND_S).applyQuaternion(r.handQ).add(_Wr);
  r.contact.copy(_contact);r.contactError=_contact.distanceTo(r.cur);
  r.wristAngle=Math.acos(U.clamp(_F.dot(_handDir.copy(HAND_Y).applyQuaternion(r.handQ)),-1,1));
  r.pinch.copy(_pinchRef).multiplyScalar(HAND_S).applyQuaternion(r.handQ).add(_Wr);
}
function handPose(arm, name, normal, fingers, curl, thumb, index) {
  arm.contactMode=name;arm.palmRef=arm.palmTarget.set(...normal);arm.fingerRef=arm.fingerTarget.set(...fingers);
  if(curl!==undefined)arm.curlT=curl;if(thumb!==undefined)arm.thumbT=thumb;if(index!==undefined)arm.trigT=index;
}
/* ------------------------------------------------------------------ */
/* 총 모델 데이터                                                       */
/* ------------------------------------------------------------------ */
// 슬롯별 1인칭 기준: 방아쇠 위치(at), 허리 사격 위치(hip), 오른손·왼손 휴식 자세
const CLS = {
  rifle: { at: new V3(0, -0.03, 0.02), hip: new V3(0.165, -0.185, -0.47), scale: 1.54, adsDist: 0.32, flash: 0.22,
    gripR: new V3(0.019, -0.13, 0.09), elbowR: new V3(0.11, -0.22, 0.33), shoulderR: new V3(0.24, -0.4, 0.6), gloveR: [0.065, 0.085, 0.1],
    elbowOffL: new V3(-0.158, -0.19, 0.26), shoulderOffL: new V3(-0.308, -0.36, 0.64), gloveL: [0.07, 0.06, 0.11] },
  shotgun: { at: new V3(0, -0.045, 0.02), hip: new V3(0.17, -0.19, -0.45), scale: 1.2, adsDist: 0.26, flash: 0.32,
    gripR: new V3(0.019, -0.12, 0.1), elbowR: new V3(0.11, -0.21, 0.34), shoulderR: new V3(0.24, -0.4, 0.6), gloveR: [0.065, 0.085, 0.1],
    elbowOffL: new V3(-0.154, -0.178, 0.24), shoulderOffL: new V3(-0.314, -0.348, 0.6), gloveL: [0.07, 0.06, 0.12] },
  pistol: { at: new V3(0, -0.005, -0.03), hip: new V3(0.1, -0.125, -0.38), scale: 1.05, adsDist: 0.3, flash: 0.16,
    gripR: new V3(0.012, -0.085, 0.03), elbowR: new V3(0.09, -0.19, 0.3), shoulderR: new V3(0.22, -0.38, 0.58), gloveR: [0.06, 0.09, 0.09],
    handL: new V3(-0.024, -0.06, 0.02), elbowL: new V3(-0.15, -0.2, 0.28), shoulderL: new V3(-0.3, -0.38, 0.58), gloveL: [0.055, 0.08, 0.09] }
};
// 조준경별 1인칭 눈 거리
const SCOPE_ADS = { reddot: 0.34, holo: 0.32, x2: 0.24, x4: 0.2, x8: 0.17 };

// ---------------- 총마다 다른 재장전 (콜 오브 듀티 등 AAA FPS 참고) ----------------
//  s: 동작 — ar(M4: 곧게 끼우고 노리쇠 멈치 치기) · ak(새 탄창으로 헌 탄창을 쳐내고 앞턱 걸어 젖혀 넣기, 아래로 손 넣어 장전 손잡이)
//      scar(헌 탄창 던지고 가슴 탄입대, 앞쪽 왼손 장전 손잡이 낚아채기) · m14(젖혀 빼고 젖혀 넣기, 위로 넘어가 op-rod 당기기)
//      bolt(탄창 교체 후 오른손으로 볼트) · saiga(움켜쥐고 젖혀 빼서 던지기, 위로 넘어가 장전 손잡이) · drum(무거운 드럼: 젖혀 빼고 들어 올려 끼운 뒤 손바닥 두 번)
//      release(엄지로 슬라이드 멈치) · overhand(손바닥을 위에 덮어 슬라이드 당기기) · slingshot(슬라이드 뒤를 집어 당기기) · heavy(옆으로 눕혀 교체, 무거운 슬라이드)
//      pump(빈 총이면 배출구에 한 발 넣고 펌프로 닫은 뒤 튜브 장전) · semi(빈 총이면 노리쇠를 젖혀 고정→배출구에 한 발→멈치 버튼, 총을 뒤집어 빠른 장전)
//      pair(두 발을 한 번에, 손목 튕겨 닫기) · revolver(총구 들어 탄피 털기, 스피드로더, 손목 튕겨 닫기)
//  자세: roll(+ 반시계: 총 윗면이 왼쪽으로) · yaw · pitch(+ 총구 위) · px/py/pz, ch* = 장전 손잡이·슬라이드를 당길 때, heavy = 무게로 처짐, hx = 탄창 잡는 손 x
//  eject/release: 총 공간 기준점 (배출구, 노리쇠 멈치 버튼)
const RSTYLE = {
  ar7: { s: 'ar', roll: -0.42, yaw: 0.22, pitch: 0.1, px: -0.075, py: 0.07, pz: 0.03, chRoll: -0.28, chYaw: 0.16, chPitch: 0.13 },
  ka47: { s: 'ak', roll: -0.3, yaw: 0.16, pitch: 0.17, px: -0.06, py: 0.06, pz: 0.02, chRoll: 0.42, chYaw: -0.1, chPitch: 0.06, chX: 0.02 },
  sc17: { s: 'scar', roll: -0.36, yaw: 0.27, pitch: 0.08, px: -0.08, py: 0.075, pz: 0.04, chRoll: -0.62, chYaw: 0.14, chPitch: 0.1, chZ: 0.05 },
  mk14: { s: 'm14', roll: -0.46, yaw: 0.2, pitch: 0.13, px: -0.07, py: 0.07, pz: 0.03, chRoll: 0.28, chYaw: -0.1, chPitch: 0.04 },
  kr98: { s: 'bolt', roll: -0.34, yaw: 0.18, pitch: 0.09, px: -0.07, py: 0.065, pz: 0.03 },
  sa12: { s: 'saiga', roll: -0.5, yaw: 0.25, pitch: 0.07, px: -0.07, py: 0.05, pz: 0.03, heavy: 0.03, chRoll: 0.26, chYaw: -0.1, chPitch: -0.04 },
  aa12: { s: 'drum', roll: -0.55, yaw: 0.3, pitch: 0.18, px: -0.08, py: 0.05, pz: 0.03, heavy: 0.045, hx: -0.052, chRoll: -0.32, chYaw: 0.1, chPitch: 0.08 },
  p92: { s: 'release', roll: -0.32, yaw: 0.3, pitch: 0.05, px: -0.07, py: 0.05, pz: -0.07 },
  g18: { s: 'overhand', roll: -0.42, yaw: 0.32, pitch: 0.06, px: -0.07, py: 0.05, pz: -0.06, chRoll: 0.3, chYaw: -0.1, chPitch: 0.12, chZ: -0.03, chY: 0.02 },
  m1911: { s: 'slingshot', roll: -0.28, yaw: 0.26, pitch: 0.1, px: -0.06, py: 0.05, pz: -0.06, chRoll: -0.15, chYaw: 0.08, chPitch: 0.2, chZ: -0.01, chY: 0.0 },
  de7: { s: 'heavy', roll: -0.62, yaw: 0.34, pitch: 0.08, px: -0.04, py: 0.04, pz: -0.09, heavy: 0.02, chRoll: 0.25, chYaw: -0.1, chPitch: 0.12, chZ: -0.03 },
  s12: { s: 'pump', eject: [0.016, 0.072, -0.13], portDuration: 1.35, portClose: 0.82 },
  m1014: { s: 'semi', eject: [0.024, 0.044, -0.065], release: [0.0, -0.016, -0.036], portOpen: 0.22, portSeat: 0.54, portClose: 0.7 },
  db2: { s: 'pair' },
  r45: { s: 'revolver' }
};
const rstyle = id => RSTYLE[id] || RSTYLE.ar7;
// 무게·손목·복귀 리듬. 동작의 접촉점은 makeKeys, 몸의 선행/후행 움직임은 여기서 분리한다.
const RFEEL = {
  ar7:   { name: '짧은 확인 · 볼트 멈치', mass: 1, reach: -0.014, lift: 0.012, cant: -0.035, wrist: -0.12, finish: 0.032 },
  ka47:  { name: '탄창으로 쳐내기 · 아래로 당기기', mass: 1.14, reach: 0.016, lift: -0.012, cant: 0.08, wrist: 0.25, finish: -0.045 },
  sc17:  { name: '가슴 탄입대 · 왼쪽 손잡이', mass: 1.12, reach: -0.023, lift: 0.028, cant: -0.07, wrist: -0.2, finish: 0.045 },
  mk14:  { name: '앞턱 걸기 · 묵직한 복귀', mass: 1.3, reach: 0.018, lift: 0.006, cant: 0.045, wrist: 0.16, finish: -0.035 },
  kr98:  { name: '왼손 지지 · 오른손 볼트', mass: 1.22, reach: -0.01, lift: 0.018, cant: -0.025, wrist: -0.1, finish: 0.025 },
  s12:   { name: '배출구 한 발 · 펌프 닫기', mass: 1.18, reach: -0.012, lift: 0.014, cant: 0.055, wrist: 0.18, finish: -0.04 },
  m1014: { name: '노리쇠 고정 · 뒤집어 장전', mass: 1.1, reach: 0.016, lift: 0.02, cant: -0.075, wrist: -0.22, finish: 0.05 },
  db2:   { name: '꺾기 · 두 발 · 손목 닫기', mass: 1.16, reach: -0.024, lift: -0.014, cant: 0.06, wrist: 0.2, finish: -0.065 },
  sa12:  { name: '탄창 젖혀 빼기 · 위로 당기기', mass: 1.28, reach: -0.018, lift: -0.018, cant: -0.08, wrist: 0.28, finish: 0.04 },
  aa12:  { name: '드럼 들어 올리기 · 두 번 두드리기', mass: 1.65, reach: 0.024, lift: -0.034, cant: -0.1, wrist: -0.18, finish: -0.055 },
  p92:   { name: '탄창 보관 · 엄지 멈치', mass: 0.8, reach: -0.015, lift: 0.012, cant: 0.035, wrist: -0.12, finish: 0.025 },
  g18:   { name: '빠른 교환 · 오버핸드', mass: 0.72, reach: 0.012, lift: 0.022, cant: -0.055, wrist: 0.25, finish: -0.035 },
  m1911: { name: '낮은 탄입대 · 뒤끝 집기', mass: 0.94, reach: -0.022, lift: -0.008, cant: 0.065, wrist: -0.22, finish: 0.04 },
  de7:   { name: '큰 탄창 밀기 · 무거운 슬라이드', mass: 1.35, reach: 0.02, lift: -0.022, cant: -0.085, wrist: 0.16, finish: -0.05 },
  r45:   { name: '탄피 털기 · 스피드로더 · 닫기', mass: 1.02, reach: -0.016, lift: 0.016, cant: 0.085, wrist: 0.3, finish: 0.055 }
};
const AXX = new V3(1, 0, 0);
// 탄창을 앞턱 L(탄창 축 기준) 을 축으로 a 만큼 젖히고 dy 만큼 내린 자세의 위치 (rest = 제자리)
function magAt(rest, L, a, dy, out) { return out.copy(L).applyAxisAngle(AXX, a).negate().add(L).add(rest).add(_mv.set(0, -dy, 0)); }
// 그 자세에서 탄창을 쥔 손 위치 (g = 탄창 축 기준 손)
function gripOf(pos, g, a, out) { return out.copy(g).applyAxisAngle(AXX, a).add(pos); }
const _mv = new V3();

// 총 모델 데이터: 실사/게임용 GLB 모델(gunmodels.js)이 있으면 그것, 없으면 절차적 총(gunlib.js)
function modelKey(id) { const def = G.WEAPONS[id]; return def.model || id; }
function gunData(id) {
  const k = modelKey(id);
  if (G.GunModels && G.GunModels.has(k)) return G.GunModels.data(k);
  return G.GunLib.data(id);
}

const Guns = G.Guns = {
  mats, CLS, gunData, rstyle,
  reloadFeel(id) { return RFEEL[id] || RFEEL.ar7; },
  // 소리도 손·부품과 같은 정규화 시각을 사용한다. 한 프레임에 여러 사건을 지나도 모두 재생한다.
  reloadEvents(id, empty, phase, port) {
    const def = G.WEAPONS[id], m = G.VM.models[id], st = rstyle(id);
    let list;
    if (def.reloadType === 'mag') {
      const S = m && m.keys && (empty ? m.keys.E : m.keys.Tac);
      const t = S ? S.snd : { out: 0.15, in: 0.62, bolt: 0.85 };
      list = [[t.out, 'magout'], [t.in, 'magin']];
      if (S && S.T.taps) for (const tap of S.T.taps) list.push([tap, 'magin']);
      if (empty) list.push([t.bolt, 'close']);
      if (empty && S && S.T.chA !== undefined) list.push([S.T.chA, 'open']);
      if (empty && S && S.T.slideA !== undefined) list.push([S.T.slideA, 'open']);
      if (empty && S && S.T.boltA !== undefined) {
        list = list.filter(e => e[1] !== 'close');
        const T = S.T, span = T.boltB - T.boltA;
        list.push([T.boltA + span * 0.24, 'open'], [T.boltA + span * 0.58, 'close']);
      }
    } else if (def.reloadType === 'revolver') {
      list = [[0.16, 'open'], [0.28, 'shell'], [0.6, 'magin'], [0.765, 'close']];
    } else if (phase === 'start') {
      list = def.reloadType === 'break' ? [[0.4, 'open'], [0.52, 'shell']]
        : port ? [[st.portOpen || 0.14, 'open'], [st.portSeat || 0.47, 'shell'], [st.portClose || (st.s === 'semi' ? 0.63 : 0.68), 'close']] : [];
    } else if (phase === 'load') list = [[def.reloadType === 'break' ? 0.58 : st.s === 'semi' ? 0.48 : 0.55, 'shell']];
    else list = def.reloadType === 'break' ? [[0.3, 'close']] : [];
    return list.filter(e => Number.isFinite(e[0]) && e[0] >= 0 && e[0] <= 1).sort((a, b) => a[0] - b[0]);
  },
  armOverlap,
  buildVM(id) {
    if (id === 'fists' || id === 'throw') return this.buildHands(id);
    const M = mats();
    const def = G.WEAPONS[id], cls = def.cls, C = CLS[cls], D = gunData(id);
    const s = D.vmScale || C.scale, at = C.at;
    const P = v => v.clone().sub(D.trigger).multiplyScalar(s).add(at);   // 총 공간(m) → 뷰모델 공간
    const root = new THREE.Group(), gun = new THREE.Group(); root.add(gun);
    const o = { root, gun, parts: {}, rest: {}, id, def, cls, s, scopes: {}, real: !!D.real, toVM: P };
    o.supportN=cls==='pistol'||id==='sa12'?[1,0.1,0]:[0,1,0.05];
    o.supportF=cls==='pistol'?[0,0.25,-1]:id==='sa12'?[0,0.85,-0.5]:[1,0,-0.08];
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
        if (part === 'mag') { g.computeBoundingBox(); (o.magBox || (o.magBox = new THREE.Box3())).union(g.boundingBox); }
      }
    }
    o.armObstacles=armEnvelopes(gun);
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
      const dist = D.ironDist || Math.max(C.adsDist, back * s + 0.1);
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
      // 중절식: 두 발을 한 번에 쥔다
      if (def.reloadType === 'break') { const s2 = o.shell2 = sh.clone(); root.add(s2); s2.visible = false; }
    }
    // 팔
    const grip=fitWristContact(C.gripR,[-1,0.06,0],[0,0.88,-0.48],GRIP_CONTACT,1,o.armObstacles);
    if (cls === 'pistol') {
      o.armR = armRig(root, C.shoulderR, grip, C.elbowR, C.gloveR, 1.08);
      const fl=fitWristContact(D.fore?P(D.fore):C.handL,[1,0.1,0],[0,0.25,-1],PALM_CONTACT,-1,o.armObstacles);
      o.armL = armRig(root, C.shoulderL.clone().add(fl).sub(C.handL), fl, C.elbowL.clone().add(fl).sub(C.handL), C.gloveL, 1.08);
      o.fore = fl;
    } else {
      o.armR = armRig(root, C.shoulderR, grip, C.elbowR, C.gloveR, 1.08);
      const rawFore=P(D.fore);
      if(id==='sa12'){
        const cross=o.armObstacles.filter(b=>b.min.z<rawFore.z+0.015&&b.max.z>rawFore.z-0.015);
        if(cross.length)rawFore.x=Math.min(...cross.map(b=>b.min.x))-0.002;
      }
      const fl=fitWristContact(rawFore,o.supportN,o.supportF,PALM_CONTACT,-1,o.armObstacles);
      o.armL = armRig(root, fl.clone().add(C.shoulderOffL), fl, fl.clone().add(C.elbowOffL), C.gloveL, 1.1);
      o.fore = fl;
    }
    o.grip = grip;
    for(const arm of [o.armL,o.armR])arm.obstacles=o.armObstacles;
    this.makeKeys(o);
    mergeStatic(root);
    // 새 탄창 (헌 탄창이 빠지는 동안 손에 든 것) — 리볼버 제외
    if (o.parts.mag && !o.parts.cyl) { const m2 = o.mag2 = o.parts.mag.clone(); m2.visible = false; gun.add(m2); }
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
      armVM(l, new V3(0, 0, 0), new V3(-0.04, -0.12, 0.25), new V3(-0.15, -0.3, 0.55), null, -1, { curl: 1, thumb: 0.9, palm: new V3(0.5, -0.2, 0.2) });
      armVM(r, new V3(0, 0, 0), new V3(0.04, -0.12, 0.25), new V3(0.15, -0.3, 0.55), null, 1, { curl: 1, thumb: 0.9, palm: new V3(-0.5, -0.2, 0.2) });
      o.hip = new V3(0, 0, 0); o.muzzle = new V3(0, 0, -0.3);
    } else {
      const hand = o.parts.hand = new THREE.Group(); hand.position.set(0.18, -0.2, -0.46); root.add(hand);
      armVM(hand, new V3(0, -0.03, 0.02), new V3(0.05, -0.16, 0.28), new V3(0.16, -0.34, 0.58), null, 1, { curl: 0.62, thumb: 0.55, palm: new V3(-0.7, 0.4, 0) });
      o.items = {};
      for (const k of G.THROW_ORDER) { const m = Guns.throwModel(k, true); m.visible = false; hand.add(m); o.items[k] = m; }
      o.hip = new V3(0, 0, 0); o.muzzle = new V3(0.15, -0.1, -0.35);
    }
    o.iron = { sight: new V3(), ads: new V3(0, 0, -0.3) };
    mergeStatic(root);
    root.traverse(m => { if (m.isMesh) m.frustumCulled = false; });
    return o;
  },
  // 재장전 손 경로 (뷰모델 공간, 기준점에서 미리 계산) — 총마다 다른 동작 (RSTYLE)
  //  K.E / K.Tac = { k: 왼손 키 [시각, 위치], T: 사건 시각 } (빈 탄창 / 남은 탄창)
  makeKeys(o) {
    const K = o.keys = {};
    const v = (base, x, y, z) => base.clone().add(new V3(x, y, z));
    const F = o.fore, st = K.st = rstyle(o.id);
    if (o.parts.mag && o.def.reloadType === 'mag') {
      if (o.cls === 'pistol') this.pistolKeys(o, K, v); else this.rifleKeys(o, K, v);
      for (const S of [K.E, K.Tac]) {
        const T = S.T;
        S.snd = {
          out: T.drop !== undefined ? T.drop : T.knock !== undefined ? T.knock : T.grab + 0.05,
          in: T.seat,
          bolt: S === K.E ? (T.chRel || T.slap || T.slideRel || T.slide || (T.boltA !== undefined ? T.boltA + 0.12 : 0.85)) : 9
        };
      }
    }
    if (o.port) {
      const p = o.port;
      K.portIn = v(p, -0.01, -0.018, -0.03); K.portEntry = v(p, -0.014, -0.045, 0.03);
      K.below = v(p, -0.04, -0.12, 0.05); K.down = v(p, -0.08, -0.3, 0.12);
      if (st.eject) {
        // 배출구에 한 발 (빈 총): 배출구 위에서 떨어뜨려 넣는다
        const ep = K.eject = o.toVM(new V3(...st.eject));
        K.ejectAbove = v(ep, 0.035, 0.05, 0.01); K.ejectIn = v(ep, 0.012, 0.012, 0.0);
        K.belt = v(p, -0.1, -0.34, 0.14);
        if(st.release){
          K.release=o.toVM(new V3(...st.release));
          const nearby=o.armObstacles.filter(b=>b.min.z<K.release.z+0.025&&b.max.z>K.release.z-0.025);
          K.release.x=Math.max(K.release.x,...nearby.map(b=>b.max.x))+0.004;
        }
      }
    }
    if (o.parts.pump) K.pumpOff = F.clone().sub(o.rest.pump);
    if (o.parts.barrel) K.barrelOff = F.clone().sub(o.rest.barrel);
    if (o.parts.charge && o.charge) K.chGrabSemi = v(o.charge, 0.004, 0.022, 0.002);
    if(o.parts.bolt){
      const knob=o.charge?o.charge.clone().sub(o.rest.bolt):new V3(0.06,-0.02,0);
      K.boltReach=knob.applyAxisAngle(new V3(0,0,1),1.15).add(o.rest.bolt).add(new V3(0.004,0.002,0));
    }
  },
  rifleKeys(o, K, v) {
    const st = K.st, S = st.s, F = o.fore, mr = o.rest.mag, md = o.magDir, k = o.s / 1.54;
    const Hm = mr.clone().addScaledVector(md, 0.1 * k).add(new V3(st.hx || -0.032, 0, 0));       // 탄창을 쥔 손
    const g = K.grab = Hm.clone().sub(mr);
    const box = o.magBox || new THREE.Box3(new V3(-0.01, -0.1, -0.03), new V3(0.01, 0, 0.03));
    Hm.x=mr.x+box.min.x-0.0015;K.grab.copy(Hm).sub(mr);
    const L = K.lug = new V3(0, box.max.y, box.min.z + 0.004);                                     // 앞턱
    const gp = (a, dy) => gripOf(magAt(mr, L, a, dy, new V3()), g, a, new V3());
    const belt = v(Hm, -0.13, -0.52, 0.2), belt2 = v(Hm, -0.19, -0.46, 0.1);                      // 허리 탄입대
    const chest = v(Hm, -0.1, -0.3, 0.24), chest2 = v(Hm, -0.14, -0.22, 0.13);                    // 가슴 탄입대
    const Hout = Hm.clone().addScaledVector(md, 0.17).add(new V3(-0.02, 0, 0.02));
    // 곧게 끼우기: 앞으로 살짝 기울여 걸고 밀어 넣은 뒤 당겨 확인 (seat = t + 0.15)
    const Hap = Hm.clone().addScaledVector(md, 0.12).add(new V3(-0.012, 0, 0.035)), Hap2 = Hm.clone().addScaledVector(md, 0.05).add(new V3(-0.004, 0, 0.012));
    const straight = t => [[t, v(Hap, -0.02, -0.07, 0.04)], [t + 0.07, Hap], [t + 0.12, Hap2], [t + 0.15, Hm], [t + 0.17, v(Hm, 0, 0.014, 0)], [t + 0.19, Hm], [t + 0.21, v(Hm, 0, -0.008, 0)], [t + 0.23, Hm]];
    // 앞턱 걸고 젖혀 넣기: h 에 걸고 sAt 에 끼워짐 (그 사이 손은 탄창을 따라간다)
    const rockIn = (t0, h, sAt, a) => { const H = gp(a, 0.014); return (t0 !== null ? [[t0, v(H, -0.03, -0.09, 0.03)]] : []).concat([[h - 0.035, v(H, -0.008, -0.025, 0.006)], [h, H], [sAt, Hm], [sAt + 0.02, v(Hm, 0, 0.012, 0)], [sAt + 0.04, Hm], [sAt + 0.06, v(Hm, 0, -0.008, 0)], [sAt + 0.08, Hm]]); };
    // 장전 손잡이: 오른쪽(아래로 / 위로 넘어) · 왼쪽 / 노리쇠 멈치 치기
    const ch = o.charge;
    const pull = (t, mode) => {
      let ap, Hc, off;
      if (mode === 'under') { Hc = v(ch, 0.008, -0.008, 0.004); ap = v(ch, 0.065, -0.16, 0.035); off = v(Hc, 0.06, -0.1, 0.09); }
      else if (mode === 'over') { Hc = v(ch, 0.002, 0.015, 0.0); ap = v(ch, -0.1, 0.16, 0.02); off = v(Hc, -0.025, 0.11, 0.09); }
      else { Hc = v(ch, -0.012, 0.004, 0.0); ap = v(ch, -0.11, -0.015, 0.015); off = v(Hc, -0.11, 0.02, 0.1); }
      K.chGrab = Hc;K.chMode=mode;
      const outside=v(ch,-0.15,mode==='over'?0.17:mode==='under'?-0.18:-0.04,0.055);
      const escape=mode==='under'?v(ch,-0.14,-0.19,0.09):v(ch,-0.17,mode==='over'?0.16:0.035,0.07);
      return { k: [[t-0.015,outside],[t, ap], [t + 0.04, Hc], [t + 0.1, v(Hc, 0, 0, 0.075)], [t + 0.12, off],[t+0.15,escape]], T: { chA: t + 0.04, chB: t + 0.1, chRel: t + 0.103 } };
    };
    const slap = t => {
      const Hb = v(mr, -0.045, 0.045, 0.025);
      return { k: [[t, v(Hb, -0.03, -0.06, 0.03)], [t + 0.04, v(Hb, -0.014, -0.012, 0.004)], [t + 0.055, Hb], [t + 0.08, v(Hb, -0.03, -0.045, 0.01)]], T: { slap: t + 0.055 } };
    };
    const home = (t, t2) => [[t, v(F, -0.02, -0.02, 0.04)], [t2, F]];
    const join = (...parts) => { const k2 = [], T = {}; for (const q of parts) { if (Array.isArray(q)) k2.push(...q); else { k2.push(...q.k); Object.assign(T, q.T); } } return { k: k2, T }; };
    const fwdPull = ch && ch.z < o.grip.z - 0.12, side = ch ? (ch.x > 0.005 ? 1 : ch.x < -0.005 ? -1 : 0) : 0;
    let E, Tac;
    if (S === 'ak') {
      // 새 탄창 앞모서리로 멈치를 쳐서 헌 탄창을 떨어뜨리고, 앞턱을 걸어 젖혀 넣는다 (빈 총이면 아래로 손을 넣어 장전 손잡이)
      const Kn0 = mr.clone().add(new V3(-0.03, box.min.y * 0.55, box.max.z + 0.07)), Kn1 = v(Kn0, 0, 0.012, -0.04);
      const base = [[0, F], [0.07, v(F, -0.03, -0.08, 0.06)], [0.16, belt], [0.22, belt2], [0.3, Kn0], [0.345, Kn1], [0.36, v(Kn1, -0.004, -0.012, -0.004)]].concat(rockIn(null, 0.42, 0.53, 0.5));
      const T0 = { newMag: 0.16, knock: 0.345, hook: 0.42, seat: 0.53, rockIn: 0.5 };
      Tac = join(base, home(0.7, 0.82), { k: [], T: Object.assign({ endT: 0.84 }, T0) });
      E = join(base, pull(0.62, side < 0 ? 'left' : 'under'), [[0.79, v(F, -0.11, -0.06, 0.06)], [0.9, F]], { k: [], T: Object.assign({ endE: 0.92 }, T0) });
    } else if (S === 'saiga') {
      // 탄창을 움켜쥐고 앞으로 젖혀 빼서 던지고, 새 탄창을 젖혀 넣는다 (빈 총이면 위로 넘어가 장전 손잡이)
      const Ho = gp(0.55, 0.02);
      const base = [[0, F], [0.06, v(Hm, -0.02, -0.04, 0.03)], [0.1, Hm], [0.19, Ho], [0.25, v(Ho, -0.03, -0.08, 0.02)], [0.35, belt], [0.41, belt2]].concat(rockIn(0.45, 0.5, 0.62, 0.55));
      const T0 = { grab: 0.1, out: 0.19, release: 0.25, toss: true, rockOut: 0.55, newMag: 0.35, hook: 0.5, seat: 0.62, rockIn: 0.55 };
      Tac = join(base, home(0.76, 0.86), { k: [], T: Object.assign({ endT: 0.88 }, T0) });
      E = join(base, pull(0.72, side < 0 ? 'left' : 'over'), [[0.9, v(F, -0.11, -0.04, 0.06)], [0.97, F]], { k: [], T: Object.assign({ endE: 0.98 }, T0) });
    } else if (S === 'scar') {
      // 빈 총: 탄창은 저절로 떨어지고 가슴 탄입대에서 새 탄창 → 앞쪽 왼손 장전 손잡이를 낚아챈다
      E = join([[0, F], [0.07, v(Hm, -0.02, -0.04, 0.03)], [0.1, v(Hm, -0.03, -0.06, 0.04)], [0.2, chest], [0.26, chest2]], straight(0.32),
        ch ? pull(0.56, side > 0 ? 'over' : 'left') : slap(0.56), [[0.78, v(F, -0.11, -0.04, 0.06)], [0.88, F]],
        { k: [], T: { drop: 0.1, newMag: 0.2, seat: 0.47, endE: 0.9 } });
      // 남은 탄창: 뽑아서 그대로 던지고 (스피드 리로드) 새 탄창
      Tac = join([[0, F], [0.07, v(Hm, -0.01, -0.03, 0.02)], [0.1, Hm], [0.12, Hm], [0.2, Hout], [0.24, v(Hout, -0.02, -0.06, 0.03)], [0.32, chest], [0.37, chest2]], straight(0.42), home(0.72, 0.84),
        { k: [], T: { grab: 0.1, out: 0.2, release: 0.24, toss: true, newMag: 0.32, seat: 0.57, endT: 0.86 } });
    } else if (S === 'm14') {
      // 젖혀 빼고 젖혀 넣기 · 빈 총이면 위로 넘어가 오른쪽 op-rod 손잡이를 당겼다 놓는다
      const Ho = gp(0.5, 0.025);
      Tac = join([[0, F], [0.06, v(Hm, -0.02, -0.04, 0.03)], [0.1, Hm], [0.19, Ho], [0.25, v(Ho, -0.03, -0.1, 0.03)], [0.34, belt], [0.4, belt2]], rockIn(0.43, 0.48, 0.6, 0.5), home(0.74, 0.86),
        { k: [], T: { grab: 0.1, out: 0.19, release: 0.34, rockOut: 0.5, newMag: 0.36, hook: 0.48, seat: 0.6, rockIn: 0.5, endT: 0.88 } });
      E = join([[0, F], [0.05, v(Hm, -0.02, -0.04, 0.03)], [0.08, Hm], [0.16, Ho], [0.21, v(Ho, -0.03, -0.1, 0.03)], [0.3, belt], [0.36, belt2]], rockIn(0.39, 0.44, 0.56, 0.5),
        ch ? pull(0.66, side < 0 ? 'left' : 'under') : slap(0.66), [[0.84, v(F, -0.11, -0.05, 0.06)], [0.94, F]],
        { k: [], T: { grab: 0.08, out: 0.16, release: 0.21, toss: true, rockOut: 0.5, newMag: 0.3, hook: 0.44, seat: 0.56, rockIn: 0.5, endE: 0.95 } });
    } else if (S === 'drum') {
      // 무거운 드럼: 움켜쥐고 젖혀 빼서 떨어뜨림 → 아래에서 들어 올려 걸고 젖혀 끼운 뒤 손바닥으로 두 번 → (빈 총) 왼쪽 위 장전 손잡이
      const Ho = gp(0.35, 0.03);
      const base = [[0, F], [0.08, v(Hm, -0.03, -0.05, 0.02)], [0.12, Hm], [0.22, Ho], [0.3, v(Ho, -0.04, -0.12, 0.03)], [0.42, belt], [0.5, belt2]].concat(rockIn(0.53, 0.58, 0.7, 0.35).slice(0, 4),
        [[0.715, v(Hm, 0, -0.035, 0)], [0.73, v(Hm, 0, 0.006, 0)], [0.745, v(Hm, 0, -0.03, 0)], [0.76, v(Hm, 0, 0.005, 0)], [0.78, Hm]]);
      const T0 = { grab: 0.12, out: 0.22, release: 0.3, toss: true, rockOut: 0.35, newMag: 0.42, hook: 0.58, seat: 0.7, rockIn: 0.35, taps: [0.73, 0.76] };
      Tac = join(base, home(0.86, 0.94), { k: [], T: Object.assign({ endT: 0.95 }, T0) });
      E = join(base, ch ? pull(0.8, side > 0 ? 'over' : 'left') : slap(0.8), [[0.97, F]], { k: [], T: Object.assign({ endE: 0.98 }, T0) });
    } else if (S === 'bolt') {
      // 탄창 교체 → (빈 총) 왼손은 총열 덮개로, 오른손이 볼트를 올려 당겼다 민다
      E = join([[0, F], [0.07, v(Hm, -0.02, -0.04, 0.03)], [0.1, v(Hm, -0.015, -0.03, 0.02)], [0.24, belt], [0.3, belt2]], straight(0.35), [[0.64, v(F, -0.01, -0.02, 0.03)], [0.7, F]],
        { k: [], T: { drop: 0.1, newMag: 0.24, seat: 0.5, boltA: 0.62, boltB: 0.92, endE: 0.95 } });
      Tac = join([[0, F], [0.07, v(Hm, -0.01, -0.03, 0.02)], [0.1, Hm], [0.13, Hm], [0.24, Hout], [0.33, belt], [0.39, belt2]], straight(0.44), home(0.74, 0.84),
        { k: [], T: { grab: 0.1, out: 0.24, release: 0.33, newMag: 0.35, seat: 0.59, endT: 0.86 } });
    } else {
      // ar (M4 계열): 빈 탄창은 떨어지고 → 탄입대 → 곧게 끼우고 당겨 확인 → 노리쇠 멈치 치기 (장전 손잡이가 앞이면 당기기)
      E = join([[0, F], [0.08, v(Hm, -0.02, -0.04, 0.03)], [0.11, v(Hm, -0.015, -0.03, 0.02)], [0.27, belt], [0.34, belt2]], straight(0.4),
        fwdPull ? pull(0.69, side > 0 ? 'over' : 'left') : slap(0.69), [[0.88, v(F, -0.02, fwdPull ? 0.03 : -0.02, fwdPull ? 0.08 : 0.04)], [1, F]],
        { k: [], T: { drop: 0.11, newMag: 0.27, seat: 0.55, endE: 0.9 } });
      Tac = join([[0, F], [0.07, v(Hm, -0.01, -0.03, 0.02)], [0.1, Hm], [0.13, Hm], [0.24, Hout], [0.34, belt], [0.41, belt2]], straight(0.45), [[0.86, v(F, -0.02, -0.02, 0.04)], [1, F]],
        { k: [], T: { grab: 0.1, out: 0.24, release: 0.34, newMag: 0.37, seat: 0.6, endT: 0.84 } });
    }
    for (const q of [E, Tac]) { q.k.sort((x, y) => x[0] - y[0]); for (let i = 1; i < q.k.length; i++) if (q.k[i][0] <= q.k[i - 1][0]) q.k[i][0] = q.k[i - 1][0] + 0.002; }
    K.E = E; K.Tac = Tac;
  },
  pistolKeys(o, K, v) {
    const st = K.st, S = st.s, F = o.fore, mr = o.rest.mag, md = o.magDir, k = o.s / 1.05;
    const Hm = mr.clone().addScaledVector(md, 0.045).add(new V3(-0.004, 0, 0.004));
    if(o.magBox)Hm.x=mr.x+o.magBox.min.x-0.0015;
    K.grab = Hm.clone().sub(mr); K.lug = new V3();
    const Hin = Hm.clone().addScaledVector(md, 0.1), Hap = Hm.clone().addScaledVector(md, 0.05);
    const heavy = S === 'heavy';
    // 권총도 같은 경로를 배속하지 않는다. 탄입대 위치, 삽입 전 멈춤, 타격·당김이 각각 다르다.
    const rhythm = {
      release:   { belt: [-0.09, -0.36, 0.12], take: 0.27, present: 0.47, seat: 0.59, rack: 0.74, home: 0.92 },
      overhand:  { belt: [-0.14, -0.32, 0.06], take: 0.2, present: 0.37, seat: 0.5, rack: 0.63, home: 0.9 },
      slingshot: { belt: [-0.07, -0.46, 0.18], take: 0.29, present: 0.46, seat: 0.57, rack: 0.7, home: 0.95 },
      heavy:     { belt: [-0.16, -0.4, 0.2], take: 0.24, present: 0.4, seat: 0.55, rack: 0.68, home: 0.97 }
    }[S];
    const belt = v(F, ...rhythm.belt), belt2 = v(belt, -0.035, 0.055, -0.07);
    const insertion = (present, seat) => [[present, Hin], [seat - 0.045, Hap], [seat, Hm],
      [seat + 0.02, v(Hm, 0, heavy ? 0.022 : 0.014, 0)], [seat + 0.055, Hm]];
    const base = [[0, F], [0.07, v(F, -0.03, -0.06, 0.04)], [rhythm.take, belt], [rhythm.take + 0.065, belt2]]
      .concat(insertion(rhythm.present, rhythm.seat));
    const T0 = { drop: S === 'overhand' ? 0.08 : 0.1, newMag: rhythm.take, seat: rhythm.seat };
    const St = o.slideTop || v(o.grip, 0, 0.1, -0.04);
    let tail, Te;
    if (S === 'overhand' || heavy) {
      // 손바닥을 슬라이드 위에 덮어 움켜쥐고 뒤로 당겼다 놓는다
      const t = rhythm.rack, pull = heavy ? 0.13 : 0.085, Hg = K.slideGrab = v(St, -0.002, 0.024, 0.012);
      tail = [[t, v(St, -0.035, 0.075, 0.035)], [t + 0.035, Hg], [t + pull, v(Hg, 0, 0.004, 0.045 * k)],
        [t + pull + 0.012, v(Hg, -0.012, 0.035, 0.06)], [rhythm.home - 0.035, v(F, -0.02, 0.03, 0.03)], [1, F]];
      Te = { slideA: t + 0.035, slideB: t + pull, slideRel: t + pull + 0.004, endE: rhythm.home };
    } else if (S === 'slingshot') {
      // 슬라이드 뒤끝을 엄지·검지로 집어 얼굴 쪽으로 당겼다 놓는다
      const Hp = K.slideGrab = v(St, -0.004, -0.004, 0.05);
      tail = [[0.7, v(St, -0.03, 0.03, 0.095)], [0.74, Hp], [0.8, v(Hp, 0, -0.006, 0.045 * k)], [0.81, v(Hp, -0.025, 0.012, 0.075)], [0.88, v(F, -0.03, 0.0, 0.05)], [1, F]];
      Te = { slideA: 0.74, slideB: 0.8, slideRel: 0.803, endE: 0.92 };
    } else {
      // release: 엄지로 슬라이드 멈치를 눌러 닫는다 (왼손 엄지가 거든다)
      const Hs = v(o.grip, -0.045, 0.045, -0.035);
      tail = [[0.74, v(Hs, -0.02, -0.01, 0.01)], [0.79, Hs], [0.81, v(Hs, 0.008, -0.004, 0)], [0.84, v(Hs, -0.01, -0.012, 0.01)], [1, F]];
      Te = { slide: 0.8, endE: 0.88 };
    }
    K.E = { k: base.concat(tail), T: Object.assign({}, T0, Te) };
    // 잔탄이 있으면 왼손이 헌 탄창을 쥐어 보관한다. 슬라이드는 건드리지 않는다.
    const Hout = Hm.clone().addScaledVector(md, heavy ? 0.16 : 0.12);
    const grab = S === 'slingshot' ? 0.12 : 0.1, out = heavy ? 0.25 : 0.21;
    const release = heavy ? 0.38 : S === 'overhand' ? 0.28 : 0.34;
    const seat = heavy ? 0.69 : S === 'overhand' ? 0.57 : S === 'slingshot' ? 0.66 : 0.64;
    K.Tac = { k: [[0, F], [grab - 0.035, v(Hm, -0.025, -0.025, 0.015)], [grab, Hm], [grab + 0.025, Hm],
      [out, Hout], [release, belt], [release + 0.045, belt2]].concat(insertion(seat - 0.14, seat), [[seat + 0.14, F], [1, F]]),
      T: { grab, out, release, newMag: release + 0.02, seat, endT: seat + 0.16 } };
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
  tpModel(type, full) {
    const def = G.WEAPONS[type];
    if (def && def.cls) {
      const k = modelKey(type);
      if (G.GunModels && G.GunModels.has(k)) return G.GunModels.tpMesh(k, full);
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
      // 전리품은 가까이서 보므로 재질 그대로 (낮은 품질에서는 정점 색 하나)
      const full = G.Game.training || (G.quality !== 'low' && G.quality !== 'potato');
      const m = this.tpModel(kind, full); m.rotation.set(0, 0, Math.PI / 2); m.position.y = 0.04; m.scale.setScalar(def.cls === 'pistol' ? 1.6 : 1.15); g.add(m);
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
    if (G.Training && G.Training.active) p.shot = G.Training.shotId;
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
      // 훈련장 표적
      let th = null;
      if (Game.training && G.Training.active) { th = G.Training.hitTest(p.pos, _d, best); if (th) { best = th.t; kind = 'target'; } }
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
      } else if (kind === 'target') {
        const dist = p.start.distanceTo(_p), def = p.def;
        const dmg = G.dmgAt(def, dist) * (th.head ? def.head : 1);
        G.Training.onHit(th, dmg, _p, _d, p.shot);
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
// 손 경로: 키 사이를 속도가 이어지는 곡선(비균일 캣멀-롬)으로 잇는다.
// 같은 점이 연달아 있으면 그 사이는 멈춤, 처음·끝은 부드럽게 출발·정지
const _t0 = new V3(), _t1 = new V3();
function track(keys, p, out) {
  const n = keys.length;
  if (p <= keys[0][0]) return out.copy(keys[0][1]);
  if (p >= keys[n - 1][0]) return out.copy(keys[n - 1][1]);
  let i = 0;
  while (i < n - 2 && p >= keys[i + 1][0]) i++;
  const k1 = keys[i], k2 = keys[i + 1];
  const P1 = k1[1], P2 = k2[1], d = k2[0] - k1[0];
  if (P1.distanceToSquared(P2) < 1e-10) return out.copy(P1);
  const t = (p - k1[0]) / d;
  const tan = (a, b, c, ta, tc, o) => {
    // a·c 가 b 와 같으면(멈춤 지점) 접선 0
    if (!a || !c || a[1].distanceToSquared(b) < 1e-10 || c[1].distanceToSquared(b) < 1e-10) return o.set(0, 0, 0);
    return o.copy(c[1]).sub(a[1]).multiplyScalar(0.85 * d / (tc - ta));
  };
  const k0 = i > 0 ? keys[i - 1] : null, k3 = i + 2 < n ? keys[i + 2] : null;
  tan(k0, P1, k2, k0 ? k0[0] : 0, k2[0], _t0);
  tan(k1, P2, k3, k1[0], k3 ? k3[0] : 1, _t1);
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  return out.set(
    h00 * P1.x + h10 * _t0.x + h01 * P2.x + h11 * _t1.x,
    h00 * P1.y + h10 * _t0.y + h01 * P2.y + h11 * _t1.y,
    h00 * P1.z + h10 * _t0.z + h01 * P2.z + h11 * _t1.z);
}
// 부드러운 시작·끝 (smootherstep)
const ss = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10);
function env(p, a, b, c, d) { return ss((p - a) / (b - a)) * (1 - ss((p - c) / (d - c))); }
const _a = new V3(), _b = new V3(), _c = new V3(), _o = new V3(), _eu = new THREE.Euler(), _m4 = new THREE.Matrix4();
const POSE = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };

const VM = G.VM = {
  models: {}, cur: null, t: 0,
  pos: new V3(), rot: new THREE.Euler(),
  sway: { x: 0, y: 0 }, kick: 0, kickV: 0, kickRoll: 0, sprint: 0, adsT: 0, crouch: 0, flashT: 0, slideT: 0,
  // 재장전 중 '툭' 하는 충격(탄창 끼우기, 노리쇠 닫힘 등)을 받는 스프링: [위치, 속도]
  spr: { rx: [0, 0], ry: [0, 0], rz: [0, 0], y: [0, 0], z: [0, 0] }, camRX: 0, camRY: 0, camRZ: 0, camE: 0, prevP: -1, rlKey: '',
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
    this.kickV += amount * 3.6;
    this.kickRoll = (Math.random() - 0.5) * amount * 0.09;
    // 총과 시야가 같이 튄다 (위로, 뒤로, 좌우 비틀림)
    const ia = 1 - this.adsT * 0.45;
    this.bump(amount * 0.55 * ia, amount * 0.05, amount * 0.12, (Math.random() - 0.5) * amount * 0.9 * ia, (Math.random() - 0.5) * amount * 0.35 * ia);
    this.flashT = 0.045;
    this.slideT = 1;
    const m = this.models[this.cur];
    if (m && m.flash) { m.flash.visible = true; m.flash.rotation.z = Math.random() * 6.28; const s = 0.8 + Math.random() * 0.5; m.flash.scale.set(s, s, s); }
    this.flashLight.intensity = 6;
    if (m && m.muzzle) this.flashLight.position.copy(m.muzzle).add(m.root.position);
  },
  // 재장전 충격 (속도로 더한다)
  bump(rx, y, z, rz, ry) {
    const S = this.spr;
    S.rx[1] += rx || 0; S.y[1] += y || 0; S.z[1] += z || 0; S.rz[1] += rz || 0; S.ry[1] += ry || 0;
  },
  stepSprings(dt) {
    const S = this.spr, n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    const mass = this.reloadMass || 1;
    for (const k in S) {
      const c = S[k];
      for (let i = 0; i < n; i++) { c[1] += (-260 / mass * c[0] - 17 / Math.sqrt(mass) * c[1]) * h; c[0] += c[1] * h; }
    }
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
    if (!m || !m.def) { this.camRX = U.damp(this.camRX, 0, 8, dt); this.camRY = U.damp(this.camRY, 0, 8, dt); this.camRZ = U.damp(this.camRZ, 0, 8, dt); }
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
      this.stepSprings(dt);
      const S = this.spr;
      POSE.rx += S.rx[0]; POSE.ry += S.ry[0]; POSE.rz += S.rz[0]; POSE.y += S.y[0]; POSE.z += S.z[0];
      p.x += POSE.x; p.y += POSE.y; p.z += POSE.z; r.x += POSE.rx; r.y += POSE.ry; r.z += POSE.rz;
      // 시야: 총을 내려다보듯 살짝 숙이고 기울인다 + 충격의 일부
      this.camE = U.damp(this.camE, s.reload ? 1 : 0, 6, dt);
      this.camRX = -0.022 * this.camE * (1 - a) + S.rx[0] * 0.22;
      this.camRY = -0.012 * this.camE * (1 - a) + S.ry[0] * 0.15;
      this.camRZ = 0.018 * this.camE * (1 - a) + S.rz[0] * 0.25;
      // 팔 IK (손은 부드럽게 따라간다)
      const k = m.snap ? 1 : 1 - Math.exp(-dt * 30);
      for (const arm of [m.armL, m.armR]) {
        if(m.snap){arm.handReady=false;arm.bendReady=false;arm.framesReady=false;arm.swivelVelocity=0;arm.foreTwist=0;arm.foreTwistVelocity=0;arm.shoulderShift.set(0,0,0);arm.shoulderVelocity.set(0,0,0);arm.curl=arm.curlT;arm.thumb=arm.thumbT;arm.trig=arm.trigT;}
        const follow=k+(1-k)*(arm.contactLock || 0);
        arm.cur.lerp(arm.tgt, follow); solveArm(arm, dt);
      }
      m.snap = false;
      this.syncContactParts(m,s);
      // 손에 든 물건(탄창·산탄)은 실제 손 위치를 따라간다
      if (m.holdObj) { const h = m.holdObj; h.position.copy(m.armL.contact).sub(_c.copy(m.keys.grab).applyAxisAngle(AXX, h.rotation.x)); }
      if (m.shell && m.shell.visible) { m.shell.position.copy(m.armL.pinch); if (m.shellOff1) m.shell.position.add(m.shellOff1); }
      if (m.shell2 && m.shell2.visible) m.shell2.position.copy(m.shell.position).add(m.shellOff2);
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

  // Moving parts use this frame's solved contact, not the previous frame's hand.
  syncContactParts(m,s) {
    const r=s.reload;if(!r||!r.empty)return;
    if(r.type==='shell'&&r.phase==='start'&&m.keys.st.s==='semi'&&r.pp>=0.16&&r.pp<0.26&&m.parts.charge){
      m.parts.charge.position.z=m.rest.charge.z+U.clamp(m.armL.contact.z-m.keys.chGrabSemi.z,0,0.06);
    }
    if(r.type!=='mag'||!m.keys.E)return;
    const T=m.keys.E.T,p=r.p,contact=m.armL.contact;
    if(m.parts.charge&&T.chA!==undefined&&p>=T.chA&&p<T.chRel)
      m.parts.charge.position.z=m.rest.charge.z+U.clamp(contact.z-m.keys.chGrab.z,0,0.075);
    if(m.parts.slide&&T.slideA!==undefined&&p>=T.slideA&&p<T.slideRel){
      const lock=0.035*m.s/1.05;
      m.parts.slide.position.z=m.rest.slide.z+Math.max(lock,U.clamp(contact.z-m.keys.slideGrab.z,0,lock*1.35));
    }
  },
  // ---------------- 총 애니메이션 ----------------
  animGun(m, s, dt) {
    const P = m.parts, R = m.rest, K = m.keys, def = m.def;
    // 기본: 부품 원위치, 손은 손잡이·총열 덮개
    for (const k in P) { P[k].position.copy(R[k]); P[k].rotation.set(0, 0, 0); P[k].visible = true; }
    if (m.shell) m.shell.visible = false;
    if (m.shell2) m.shell2.visible = false;
    if (m.mag2) { m.mag2.visible = false; m.mag2.rotation.set(0, 0, 0); }
    m.holdObj = null;
    m.armR.tgt.copy(m.grip); m.armR.roll = 0; m.armL.roll = 0;
    m.armR.reachRef=null;m.armL.reachRef=null;
    m.armL.pole.set(-0.8,-0.55,0.15).normalize();m.armR.pole.set(0.8,-0.55,0.15).normalize();
    m.armR.contactLock=1;m.armL.contactLock=1;
    // 손 모양 기본값: 오른손은 손잡이를 감싸고 검지는 쏠 때·조준할 때만 방아쇠에
    m.armR.curlT = 0.9; m.armR.thumbT = 0.65; m.armR.trigT = this.kick > 0.004 ? 0.7 : 0.12;
    m.armL.curlT = 0.76; m.armL.thumbT = 0.45; m.armL.trigT = 0.7;
    handPose(m.armR,'grip',[-1,0.06,0],[0,0.88,-0.48]);
    handPose(m.armL,'support',m.supportN,m.supportF);
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
    this.reloadMass = rl ? Guns.reloadFeel(m.id).mass : 1;
    if (rl) {
      const cur = rl.type === 'mag' || rl.type === 'revolver' ? rl.p : rl.phase === 'load' ? rl.shellP : rl.pp;
      const key = rl.type + (rl.phase || '') + (rl.empty ? 'e' : '');
      this.pv = key === this.rlKey && cur >= this.prevP ? this.prevP : -1;
      this.prevP = cur; this.rlKey = key;
    } else { this.rlKey = ''; this.prevP = -1; }
    if (rl) {
      if (rl.type === 'mag') { if (m.cls === 'pistol') this.animPistolMag(m, rl); else this.animRifleMag(m, rl); }
      else if (rl.type === 'revolver') this.animRevolver(m, rl);
      else if (rl.type === 'shell') this.animShell(m, rl);
      else if (rl.type === 'break') this.animBreak(m, rl);
      this.handContacts(m, rl);
      this.reloadAccent(m, rl);
    } else if (P.barrel) {
      m.armL.tgt.copy(P.barrel.position).add(K.barrelOff);
    }
    if (s.cycleP >= 0 && P.bolt) this.animBolt(m, s.cycleP);
  },
  // 지나간 순간 (이번 프레임에 a 를 넘었나)
  passed(a, p) { return this.pv < a && p >= a; },
  handContacts(m, rl) {
    const L=m.armL,K=m.keys,st=K.st;
    if(rl.type==='mag') {
      const p=rl.p,S=rl.empty?K.E:K.Tac;if(!S)return;const T=S.T;
      const old=T.grab!==undefined&&p>=T.grab-0.025&&p<T.release;
      const fresh=p>=T.newMag-0.025&&p<T.seat+0.055;
      if(old||fresh){
        const object=old?m.parts.mag:m.mag2,a=object?object.rotation.x:0;
        handPose(L,'magazine',[1,0,0],[0,Math.sin(a),-Math.cos(a)],0.66,0.65,0.58);
        const touch=old?T.grab:T.hook!==undefined?T.hook:T.seat;
        L.contactLock=ss((p-touch+0.04)/0.04);
      }else if(p>0.04&&p<T.seat){handPose(L,'reach',[0.8,0,-0.2],[0,-0.75,-0.65],0.24,0.28,0.2);L.contactLock=0;}
      if(rl.empty&&T.chA!==undefined){
        const w=env(p,T.chA-0.12,T.chA-0.04,Math.min(0.97,T.chRel+0.12),1.001);
        L.pole.lerp(_o.set(-0.95,K.chMode==='over'?0.05:-0.9,-0.55).normalize(),w).normalize();
      }
      if(rl.empty&&T.chA!==undefined&&p>T.chA-0.095&&p<T.chRel+0.02){
        const over=K.chMode==='over';
        handPose(L,'handle',over?[0,-1,0]:[m.charge&&m.charge.x>0?-1:1,0,0],over?[1,-0.35,-0.1]:K.chMode==='under'?[0,0.9,-0.35]:[0,0.45,-1],0.78,0.6,0.72);
        L.reachRef=K.chGrab;
        L.contactLock=ss((p-T.chA+0.035)/0.035);
      }
      if(rl.empty&&T.slap&&p>T.slap-0.075&&p<T.slap+0.04)handPose(L,'press',[1,0,0],[0,1,-0.1],0.12,0.18,0.12);
      if(rl.empty&&T.slideA!==undefined&&p>T.slideA-0.075&&p<T.slideRel+0.035){
        const pinch=st.s==='slingshot';
        handPose(L,pinch?'pinch':'slide',pinch?[1,0,0]:[0,-1,0],pinch?[0,0.85,-0.5]:[1,0,-0.1],pinch?0.55:0.8,0.72,pinch?0.38:0.75);
        L.reachRef=K.slideGrab;L.pole.set(-1,-0.25,-0.4).normalize();
        L.contactLock=ss((p-T.slideA+0.035)/0.035);
      }
      if(rl.empty&&T.boltA!==undefined&&p>T.boltA-0.04&&p<T.boltB)m.armR.reachRef=K.boltReach;
      if(rl.empty&&T.slide&&p>T.slide-0.07&&p<T.slide+0.055)handPose(L,'buttonThumb',[1,0,0],[0,0.85,-0.5],0.65,0.18,0.55);
      if(T.taps&&p>T.seat&&p<T.taps[T.taps.length-1]+0.035)handPose(L,'press',[0,1,0],[0.2,0,1],0.12,0.18,0.12);
    }else if(rl.type==='revolver'){
      if(rl.p>0.12&&rl.p<0.83)handPose(L,rl.p<0.36?'cylinder':'loader',[1,0,0],[0,0.2,-1],0.57,0.66,0.45);
    }else{
      const c=rl.shellP,port=rl.phase==='start'&&rl.port&&rl.pp>(st.s==='semi'?0.38:0.24)&&rl.pp<(st.s==='pump'?0.5:0.57);
      const pair=rl.type==='break',normal=pair?[1,0,0]:[0,1,0],fingers=pair?[0,-0.1,-1]:[0.3,0,1];
      if(rl.phase==='load')handPose(L,c<0.65?'shell':'shellReach',normal,fingers,c<0.65?0.46:0.25,c<0.65?0.75:0.4,c<0.65?0.3:0.2);
      else if(port)handPose(L,'shell',[0,-1,0],[1,-0.2,0.1],0.46,0.75,0.3);
      else if(rl.phase==='start'&&rl.port&&st.s==='pump'&&rl.pp>0.14&&rl.pp<0.24)handPose(L,'shellReach',normal,fingers,0.25,0.4,0.2);
      else if(rl.phase==='start'&&(!rl.port||rl.pp>(st.s==='pump'?0.82:0.72)))handPose(L,'shellReach',normal,fingers,0.25,0.4,0.2);
      else if(rl.phase==='start'&&rl.port&&st.s==='semi'&&rl.pp>0.07&&rl.pp<0.26){handPose(L,'handle',[0,-1,0],[-1,0,0],0.78,0.6,0.72);L.pole.set(-1,-0.9,-0.4).normalize();}
      else if(rl.phase==='start'&&rl.port&&st.s==='semi'&&rl.pp<0.38)handPose(L,'shellReach',normal,fingers,0.25,0.4,0.2);
      if(rl.phase==='start'&&rl.port&&st.s==='semi'&&rl.pp>0.59&&rl.pp<0.77){handPose(L,'button',[-1,0,0],[0,0.95,-0.3],0.3,0.45,0.1);L.pole.set(-1,-1,-0.6).normalize();}
      if(rl.phase==='start'&&rl.port&&st.s==='pump'&&rl.pp>0.5&&rl.pp<0.65)handPose(L,'shellReach',[0,-1,0],[1,-0.2,0.1],0.25,0.4,0.2);
      if(rl.phase==='start'&&rl.port&&st.s==='semi'&&rl.pp>0.54&&rl.pp<0.59)handPose(L,'shellReach',[0,-1,0],[1,-0.2,0.1],0.25,0.4,0.2);
      if(rl.phase==='start'&&rl.port&&rl.pp>(st.s==='semi'?0.32:0.2)&&rl.pp<(st.s==='semi'?0.59:0.65)){
        handPose(L,port?'shell':'shellReach',[-1,0,0],[0,1,-0.2],port?0.46:0.25,port?0.75:0.4,port?0.3:0.2);
        L.pole.set(-0.2,-1,-0.6).normalize();
      }
      if(rl.phase==='load')L.contactLock=ss((c-0.22)/0.18)*(1-ss((c-0.62)/0.15));
      if(rl.phase==='start'&&rl.port){
        const p=rl.pp;
        if(st.s==='pump'){
          if(p>0.14&&p<0.4)L.contactLock=ss((p-0.32)/0.08);
          else if(p>0.5&&p<0.72)L.contactLock=ss((p-0.65)/0.07);
          else if(p>0.82)L.contactLock=0;
        }else{
          if(p<0.25)L.contactLock=ss((p-0.11)/0.05);
          else if(p<0.54)L.contactLock=ss((p-0.42)/0.1);
          else if(p>0.74)L.contactLock=0;
        }
      }
    }
  },
  // 총의 접촉점은 그대로 두고 어깨·손목이 먼저 움직였다가 늦게 따라오는 작은 무게감을 더한다.
  reloadAccent(m, rl) {
    const f = Guns.reloadFeel(m.id);
    const mag = rl.type === 'mag' || rl.type === 'revolver';
    const p = mag ? rl.p : rl.phase === 'load' ? rl.shellP : rl.pp;
    const lead = mag || rl.phase === 'start' ? env(p, 0, 0.055, 0.11, 0.2) : 0;
    const reach = mag ? env(p, 0.12, 0.28, 0.44, 0.6)
      : rl.phase === 'load' ? env(p, 0, 0.22, 0.55, 0.8) : 0;
    const end = mag ? (rl.empty ? m.keys.E && m.keys.E.T.endE : m.keys.Tac && m.keys.Tac.T.endT) || 0.84 : 0.5;
    const settle = Math.min(end, 0.86);
    const home = mag || rl.phase === 'end' ? env(p, settle - 0.06, settle + 0.025, 0.96, 1) : 0;
    POSE.x += f.reach * reach;
    POSE.y += f.lift * reach - 0.01 * f.mass * lead;
    POSE.z += 0.016 * f.mass * lead - 0.012 * home;
    POSE.rx += 0.035 * lead + f.finish * home;
    POSE.rz += f.cant * reach - f.cant * 0.45 * home;
    // 물건을 쥐는 동안에는 손목을 비틀지 않고, 빈손으로 이동할 때만 방향을 바꾼다.
    const T = mag && (rl.empty ? m.keys.E : m.keys.Tac);
    const free = !T || p < (T.T.newMag || 0.2) || p > T.T.seat + 0.08;
    if (free) m.armL.roll += f.wrist * reach;
    if(m.armR.contactMode!=='bolt')m.armR.trigT = 0.12;
  },
  // 헌 탄창: 저절로 떨어짐(drop) · 새 탄창에 맞아 앞으로 젖혀지며 떨어짐(knock) · 손에 쥐고 뽑기/젖혀 빼기(grab) → 탄입대에 넣기 또는 던지기(toss)
  oldMag(m, S, p) {
    const T = S.T, K = m.keys, mag = m.parts.mag, R = m.rest;
    if (!mag || p >= T.seat) return;
    if (T.drop !== undefined) {
      if (p < T.drop) return;
      const u = (p - T.drop) / 0.2;
      if (u >= 1) { mag.visible = false; return; }
      if (m.cls === 'pistol') { mag.position.copy(R.mag).addScaledVector(m.magDir, 0.02 + 0.42 * u * u).add(_a.set(0, -0.15 * u * u, 0)); mag.rotation.set(0.5 * u, 0, 0.25 * u); }
      else { mag.position.copy(R.mag).addScaledVector(m.magDir, 0.015 + 0.35 * u * u).add(_a.set(0, -0.5 * u * u, 0.05 * u)); mag.rotation.set(0.9 * u * u, 0, 0.5 * u); }
    } else if (T.knock !== undefined) {
      if (p < T.knock) return;
      const u = (p - T.knock) / 0.24;
      if (u >= 1) { mag.visible = false; return; }
      const a = 1.1 * ss(Math.min(1, u * 1.8));
      magAt(R.mag, K.lug, a, 0.01 * u + 0.5 * u * u, mag.position).add(_a.set(0, 0, -0.04 * u));
      mag.rotation.set(a, 0, 0.35 * u * u);
    } else if (T.grab !== undefined) {
      if (p < T.grab) return;
      if (p < T.release) {
        if (T.rockOut && p < T.out) {
          // 앞턱을 축으로 젖혀 뺀다 — 손이 탄창을 따라간다
          const u = seg(p, T.grab, T.out), a = T.rockOut * u;
          magAt(R.mag, K.lug, a, 0.025 * u, mag.position); mag.rotation.set(a, 0, 0);
          gripOf(mag.position, K.grab, a, m.armL.tgt);
        } else {
          mag.rotation.set(T.rockOut || 0.18 * env(p, T.grab, T.grab + 0.08, T.release - 0.06, T.release), 0, 0);
          m.holdObj = mag;
        }
      } else if (T.toss) {
        // 놓는 순간의 자세에서 떨어진다
        const u = (p - T.release) / 0.22;
        if (u >= 1) { mag.visible = false; return; }
        const a0 = T.rockOut || 0;
        track(S.k, T.release, _b);
        _b.sub(_c.copy(K.grab).applyAxisAngle(AXX, a0));
        mag.position.copy(_b).add(_a.set(-0.03 * u, -0.55 * u * u, 0.04 * u));
        mag.rotation.set(a0 + 0.9 * u, 0, 0.6 * u);
      } else mag.visible = false;
    }
  },
  // 새 탄창: 탄입대에서 손에 → 곧게 밀어 넣거나, 앞턱을 걸고 젖혀 넣는다 (그때는 손이 탄창을 따라간다)
  newMag(m, S, p) {
    const T = S.T, K = m.keys, m2 = m.mag2;
    if (!m2 || p < T.newMag || p >= T.seat) return;
    m2.visible = true;
    if (T.hook !== undefined && p >= T.hook) {
      const u = seg(p, T.hook, T.seat), a = T.rockIn * (1 - u);
      magAt(m.rest.mag, K.lug, a, 0.014 * (1 - u), m2.position); m2.rotation.set(a, 0, 0);
      gripOf(m2.position, K.grab, a, m.armL.tgt);
      return;
    }
    let a;
    if (T.hook !== undefined) a = T.rockIn * seg(p, T.newMag + 0.04, T.hook - 0.03);
    else if (m.cls === 'pistol') a = -0.18 * (1 - ss((p - (T.seat - 0.1)) / 0.08));
    else a = -0.3 * (1 - ss((p - (T.seat - 0.14)) / 0.12)) * ss((p - (T.seat - 0.2)) / 0.05);
    m2.rotation.set(a, 0, 0);
    m.holdObj = m2;
  },
  // 소총·탄창식 산탄총 — 총마다 다른 순서 (makeKeys 의 RSTYLE)
  animRifleMag(m, rl) {
    const p = rl.p, K = m.keys, E = rl.empty, S = E ? K.E : K.Tac;
    if (!S) return;
    const T = S.T, P = m.parts, R = m.rest, st = K.st, seat = T.seat;
    track(S.k, p, m.armL.tgt);
    this.oldMag(m, S, p);
    this.newMag(m, S, p);
    // 왼손 모양: 탄창을 쥘 땐 반쯤, 손바닥으로 칠 땐 펴고, 장전 손잡이는 움켜쥔다
    {
      const Lh = m.armL;
      let c = 0.82;
      if ((T.grab !== undefined && p > T.grab - 0.05 && p < T.release) || (p > T.newMag - 0.05 && p < seat + 0.05)) c = 0.58;
      if (T.taps && p > seat + 0.005 && p < T.taps[1] + 0.03) c = 0.12;
      if (E && T.slap && p > T.slap - 0.08 && p < T.slap + 0.04) c = 0.08;
      if (E && T.chA !== undefined && p > T.chA - 0.03 && p < T.chRel + 0.004) c = 0.9;
      Lh.curlT = c; Lh.trigT = c; Lh.thumbT = c < 0.3 ? 0.1 : 0.55;
    }
    // 장전 손잡이: 당긴 만큼 따라오고 놓으면 튀어 돌아간다
    if (E && T.chA !== undefined && P.charge && K.chGrab) {
      if (p > T.chA && p < T.chRel) P.charge.position.z = R.charge.z + U.clamp(m.armL.cur.z - K.chGrab.z, 0, 0.075);
      else if (p >= T.chRel && p < T.chRel + 0.03) P.charge.position.z = R.charge.z + 0.075 * (1 - ss((p - T.chRel) / 0.03));
    }
    // 볼트액션: 탄창을 끼운 뒤 오른손이 볼트를 올려 당겼다 민다
    if (E && T.boltA !== undefined && P.bolt && p > T.boltA && p < T.boltB) this.animBolt(m, (p - T.boltA) / (T.boltB - T.boltA));
    // 충격
    if (E && T.drop !== undefined && this.passed(T.drop + 0.01, p)) this.bump(0.12, 0.12, 0, 0.35);
    if (T.knock !== undefined && this.passed(T.knock, p)) this.bump(0.35, 0.1, 0.06, 0.3);
    if (T.grab !== undefined && this.passed(T.grab + 0.03, p)) this.bump(-0.25, -0.1, 0, 0.3);
    if (T.rockOut && this.passed(T.out, p)) this.bump(0.25, 0.06, 0, -0.25);
    if (T.toss && this.passed(T.release, p)) this.bump(0.12, 0.06, 0, 0.2);
    if (this.passed(seat, p)) { if (T.rockIn) this.bump(0.95 + (st.heavy || 0) * 8, 0.32, -0.1, -0.4); else this.bump(0.75, 0.28, -0.08, -0.25); }
    if (this.passed(seat + 0.05, p)) this.bump(-0.35, -0.12, 0, 0);
    if (T.taps) for (const t of T.taps) if (this.passed(t, p)) this.bump(0.6, 0.24, 0, -0.12);
    if (E && T.slap && this.passed(T.slap, p)) this.bump(0.6, 0.12, 0.35, -0.35, 0.15);
    if (E && T.chRel && this.passed(T.chRel, p)) this.bump(0.75, 0.15, 0.45, 0.3);
    const end = E ? T.endE : T.endT;
    if (this.passed(end, p)) this.bump(-0.2, -0.1, 0, 0);
    // 자세: 총마다 기울이는 방향·정도가 다르다 (탄창 구멍을 왼손 쪽으로, 장전 손잡이 쪽 면을 위로)
    const e = env(p, 0, 0.13, end - 0.06, Math.min(1.001, end + 0.12));
    const t0 = T.drop !== undefined ? T.drop : T.knock !== undefined ? T.knock : T.grab;
    const t1 = T.release !== undefined ? T.release : t0 + 0.12;
    const outW = env(p, t0 - 0.05, t0 + 0.02, t1 - 0.03, t1 + 0.08);
    const look = env(p, seat - 0.2, seat - 0.08, seat, seat + 0.1);
    const chg = !E ? 0 : T.chA !== undefined ? env(p, T.chA - 0.1, T.chA - 0.02, T.chRel + 0.02, T.chRel + 0.12)
      : T.slap ? env(p, T.slap - 0.08, T.slap - 0.02, T.slap + 0.05, T.slap + 0.15) : 0;
    const hv = st.heavy ? env(p, t1, T.newMag + 0.04, seat - 0.02, seat + 0.06) : 0;
    const ic = 1 - chg;
    POSE.rz += (st.roll * e - 0.08 * outW) * ic + (st.chRoll || 0) * chg;
    POSE.ry += st.yaw * e * ic + 0.05 * look + (st.chYaw || 0) * chg;
    POSE.rx += st.pitch * e * ic + 0.06 * look + (st.chPitch || 0) * chg;
    POSE.x += (st.px || 0) * e + (st.chX || 0) * chg;
    POSE.y += (st.py || 0) * e - 0.01 * outW - (st.heavy || 0) * hv;
    POSE.z += (st.pz || 0) * e + (st.chZ || 0) * chg;
  },
  // 권총: 헌 탄창은 떨어지고 → 새 탄창 → 손바닥으로 툭 → (빈 총) 멈치 누르기 / 손바닥 덮어 당기기 / 뒤끝 집어 당기기
  animPistolMag(m, rl) {
    const p = rl.p, K = m.keys, E = rl.empty, S = E ? K.E : K.Tac;
    if (!S) return;
    const T = S.T, P = m.parts, R = m.rest, st = K.st, heavy = st.s === 'heavy';
    track(S.k, p, m.armL.tgt);
    this.oldMag(m, S, p);
    this.newMag(m, S, p);
    if (P.slide) {
      const lock = 0.035 * m.s / 1.05;
      let z = 0;
      if (E) {
        if (T.slideA !== undefined) {
          if (p < T.slideA) z = lock;
          else if (p < T.slideRel) z = Math.max(lock, U.clamp(m.armL.cur.z - K.slideGrab.z, 0, lock * 1.35));
          else z = lock * 1.3 * (1 - ss((p - T.slideRel) / 0.02));
        } else z = lock * (1 - ss((p - T.slide) / 0.015));
      }
      P.slide.position.z = R.slide.z + z;
    }
    {
      const L = m.armL, racking = E && T.slideA !== undefined && p > T.slideA - 0.03 && p < T.slideRel + 0.004;
      let c = p > 0.04 && p < T.seat + 0.05 ? 0.58 : 0.8;
      if (racking) c = st.s === 'slingshot' ? 0.7 : 0.92;
      L.curlT = c; L.trigT = c; L.thumbT = racking && st.s === 'slingshot' ? 0.85 : 0.5;
    }
    if (E && T.slide && p > T.slide - 0.06 && p < T.slide + 0.04) m.armR.thumbT = 0.2;   // 엄지로 멈치를 누른다
    if (this.passed(T.drop, p)) this.bump(0.1, 0.1, 0, 0.2);
    if (this.passed(T.seat, p)) this.bump(heavy ? 0.85 : 0.6, 0.25, -0.05, -0.2);
    if (E && T.slideA !== undefined && this.passed(T.slideA + 0.02, p)) this.bump(-0.2, 0, 0.1, 0.12);
    if (E && this.passed((T.slideRel || T.slide) + 0.01, p)) this.bump(heavy ? 1.25 : 0.8, 0.14, heavy ? 0.6 : 0.45, 0.15);
    const end = E ? T.endE : T.endT;
    if (this.passed(end, p)) this.bump(-0.15, -0.08, 0, 0);
    const e = env(p, 0, 0.1, end - 0.04, Math.min(1.001, end + 0.14));
    const look = env(p, T.seat - 0.18, T.seat - 0.06, T.seat, T.seat + 0.1);
    const chg = E && T.slideA !== undefined ? env(p, T.slideA - 0.1, T.slideA - 0.02, T.slideRel + 0.02, T.slideRel + 0.12) : 0;
    const hv = st.heavy ? env(p, T.drop !== undefined ? T.drop : T.grab, T.newMag, T.seat, T.seat + 0.06) : 0;
    const ic = 1 - chg;
    POSE.rz += st.roll * e * ic + (st.chRoll || 0) * chg;
    POSE.ry += st.yaw * e * ic + 0.05 * look + (st.chYaw || 0) * chg;
    POSE.rx += st.pitch * e * ic + 0.05 * look + (st.chPitch || 0) * chg;
    POSE.x += st.px * e; POSE.y += st.py * e - (st.heavy || 0) * hv + (st.chY || 0) * chg; POSE.z += st.pz * e + (st.chZ || 0) * chg;
  },
  // 리볼버: 실린더를 열고 → 총구를 들어 탄피를 털고 → 총구를 숙여 스피드로더 → 손목을 튕겨 닫는다
  animRevolver(m, rl) {
    const p = rl.p, P = m.parts, R = m.rest, F = m.fore;
    const cyl = P.cyl, rounds = P.mag;
    if (!cyl) return;
    const ang = 1.25 * seg(p, 0.06, 0.16) * (1 - seg(p, 0.735, 0.765));
    cyl.rotation.z = ang;
    // 탄 (실린더 기준 로컬)
    if (rounds) {
      if (p >= 0.24 && p < 0.36) { const u = (p - 0.24) / 0.12; rounds.position.copy(R.mag); rounds.position.z += 0.07 * u; rounds.position.y -= 0.12 * u * u; }
      else if (p >= 0.36 && p < 0.5) rounds.visible = false;
      else if (p >= 0.5 && p < 0.6) { rounds.position.copy(R.mag); rounds.position.z += 0.05; }
      else if (p >= 0.6 && p < 0.66) { rounds.position.copy(R.mag); rounds.position.z += 0.05 * (1 - seg(p, 0.6, 0.66)); }
    }
    // 실린더(열린 상태)의 뷰모델 공간 위치
    const cylW = (lx, ly, lz, out) => out.set(lx, ly, lz).applyAxisAngle(_c.set(0, 0, 1), ang).add(cyl.position);
    const rm = R.mag || _o.set(0, 0.02, 0.02);
    cylW(rm.x - 0.035, rm.y - 0.012, rm.z, _a);              // 실린더 왼쪽을 받치는 손
    if (p < 0.24) track([[0, F], [0.06, _a.clone()], [0.2, _a.clone()], [0.24, _a.clone().add(_o.set(0, 0, -0.03))]], p, m.armL.tgt);
    else if (p < 0.34) m.armL.tgt.copy(_a).add(_o.set(0, 0, -0.03));      // 엄지로 이젝터 막대
    else if (p < 0.5) track([[0.34, _a.clone().add(_o.set(0, 0, -0.03))], [0.42, F.clone().add(_o.set(-0.1, -0.38, 0.12))], [0.5, F.clone().add(_o.set(-0.14, -0.32, 0.1))]], p, m.armL.tgt);
    else if (p < 0.66) {
      // 탄을 쥔 손 (스피드로더) → 밀어 넣고 비틀어 놓기
      const z = p < 0.6 ? 0.05 : 0.05 * (1 - seg(p, 0.6, 0.66));
      cylW(rm.x - 0.006, rm.y - 0.028, rm.z + z + 0.03, _b);
      if (p < 0.56) { const u = seg(p, 0.5, 0.56); m.armL.tgt.copy(F).add(_o.set(-0.14, -0.32, 0.1)).lerp(_b, u); } else m.armL.tgt.copy(_b);
      if (p > 0.62) m.armL.roll = 0.6 * seg(p, 0.62, 0.66);
    } else {
      const seated=cylW(rm.x-0.006,rm.y-0.028,rm.z+0.03,_b).clone();
      track([[0.66,seated],[0.71,F.clone().add(_o.set(-0.05,-0.05,0.04))],[0.86,F],[1,F]],p,m.armL.tgt);
    }
    if (this.passed(0.16, p)) this.bump(0.1, 0, 0, 0.45);
    if (this.passed(0.28, p)) this.bump(0.6, 0.12, 0, 0);             // 탄피 털기
    if (this.passed(0.6, p)) this.bump(-0.3, 0, -0.15, 0);
    if (this.passed(0.765, p)) this.bump(0.35, 0.1, 0, -0.95);       // 손목 튕겨 닫기
    const e = env(p, 0, 0.1, 0.85, 1);
    const up = env(p, 0.17, 0.25, 0.36, 0.44), dn = env(p, 0.4, 0.5, 0.66, 0.74), flick = env(p, 0.7, 0.735, 0.77, 0.86);
    POSE.rz += 0.35 * e - 0.6 * flick; POSE.rx += 0.8 * up - 0.25 * dn + 0.05 * e; POSE.ry += 0.22 * e - 0.1 * up;
    POSE.x -= 0.07 * e; POSE.y += 0.04 * e + 0.05 * up; POSE.z -= 0.06 * e - 0.04 * up;
  },
  // 튜브 탄창 산탄총
  //  S-12(펌프): 빈 총이면 펌프를 젖히고 배출구에 한 발 → 펌프를 밀어 닫고, 장전구가 왼손 쪽으로 오게 눕혀 한 발씩
  //  M-1014(반자동): 빈 총이면 노리쇠 손잡이를 젖혀 고정 → 배출구에 한 발 → 멈치 버튼, 총을 거의 뒤집어 장전구를 위로 하고 빠르게
  animShell(m, rl) {
    const K = m.keys, F = m.armL.tgt.clone(), semi = K.st.s === 'semi';
    if (!K.below) return;
    const LR = semi ? -0.95 : -0.55;
    let e = 1, bob = 0, port = 0;
    if (rl.phase === 'start') {
      if (rl.port && K.eject) { port = this.portLoad(m, rl.pp, semi, F); e = ss((rl.pp - 0.7) / 0.3); }
      else { e = ss(rl.pp); m.armL.tgt.copy(F).lerp(K.down, ss((rl.pp - 0.1) / 0.9)); }
    } else if (rl.phase === 'load') {
      // 탄입대에서 한 발 → 엄지로 장전구에 밀어 넣고 → 다시 아래로 (매번 조금씩 다르게)
      const c = rl.shellP, j = this.shellJit || (this.shellJit = new V3());
      j.set(Math.sin(this.t*1.3)*0.002,Math.sin(this.t*1.7)*0.002,Math.cos(this.t*1.1)*0.001);
      const dn = _b.copy(K.down).add(j);
      const a1 = semi ? 0.3 : 0.35, a2 = semi ? 0.48 : 0.55;
      if (c < a1) { m.armL.tgt.copy(dn).lerp(K.portEntry, ss(c / a1)); this.shellInHand(m, true, 0); }
      else if (c < a2) { m.armL.tgt.copy(K.portEntry).lerp(K.portIn, ss((c - a1) / (a2 - a1))); this.shellInHand(m, true, 0); }
      else m.armL.tgt.copy(K.portIn).lerp(dn, ss((c - a2) / (1 - a2)));
      if (this.passed(a2 - 0.03, c)) this.bump(-0.3, 0.05, -0.12, semi ? -0.2 : 0.18);
      m.armL.curlT = c < a2 ? 0.55 : 0.7; m.armL.thumbT = c < a2 ? 0.65 : 0.3; m.armL.trigT = m.armL.curlT;
      bob = Math.sin(c * Math.PI * 2) * (semi ? 0.006 : 0.004);
    } else { // end
      m.armL.tgt.copy(K.down).lerp(F, ss(rl.pp));
      e = 1 - ss((rl.pp - 0.3) / 0.7);
      if (this.passed(0.3, rl.pp)) this.bump(-0.15, -0.06, 0, 0.2);
    }
    POSE.rz += LR * e + (semi ? 0.55 : 0.5) * port; POSE.rx += (semi ? 0.16 : 0.12) * e + 0.1 * port; POSE.ry += 0.08 * e - 0.08 * port;
    POSE.x -= (semi ? 0.03 : 0.05) * e - 0.02 * port; POSE.y += (semi ? 0.09 : 0.075) * e + bob + 0.02 * port; POSE.z += 0.02 * e;
  },
  // 빈 총 배출구 장전 (시작 단계). 돌려주는 값 = 배출구를 위로 돌리는 정도
  portLoad(m, pp, semi, F) {
    const K = m.keys, P = m.parts, R = m.rest;
    let keys;
    if (!semi && P.pump) {
      // 펌프를 젖혀 열고 → 배출구에 한 발 → 펌프를 밀어 닫는다 (펌프를 잡은 동안 손은 펌프를 따라간다)
      const tr = 0.072 * m.s / 1.1, back = seg(pp, 0.02, 0.14) * (1 - seg(pp, 0.72, 0.82));
      P.pump.position.z = R.pump.z + tr * back;
      const onPump = _a.copy(P.pump.position).add(K.pumpOff), backHand = R.pump.clone().add(K.pumpOff).add(_o.set(0, 0, tr));
      if (pp < 0.14 || (pp >= 0.72 && pp < 0.82)) m.armL.tgt.copy(onPump);
      else if (pp < 0.72) track([[0.14, backHand], [0.24, K.belt], [0.3, K.belt.clone().add(_o.set(0.01, 0.05, -0.02))], [0.4, K.ejectAbove], [0.47, K.ejectIn], [0.5, K.ejectAbove], [0.54,K.ejectAbove.clone().add(new V3(0.06,-0.16,0.05))], [0.6,backHand.clone().add(new V3(-0.15,-0.16,0.04))], [0.66,backHand.clone().add(new V3(-0.12,-0.04,0.02))], [0.72, backHand]], pp, m.armL.tgt);
      else track([[0.82, F], [1, K.down]], pp, m.armL.tgt);
      if (this.passed(0.14, pp)) this.bump(-0.25, -0.05, 0.12, 0.1);
      if (this.passed(0.82, pp)) this.bump(0.6, 0.12, -0.25, -0.15);
      m.armL.curlT = pp > 0.2 && pp < 0.5 ? 0.6 : 0.85;
    } else {
      // 노리쇠 손잡이를 젖혀 고정 → 배출구에 한 발 → 멈치 버튼을 눌러 노리쇠를 닫는다
      const g = K.chGrabSemi || K.ejectAbove, tr = 0.06, rel = K.release || K.portIn;
      if (P.charge) P.charge.position.z = R.charge.z + tr * seg(pp, 0.16, 0.22) * (1 - seg(pp, 0.69, 0.71));
      track([[0,F],[0.08,g.clone().add(_o.set(-0.12,-0.14,0.025))],[0.12,g.clone().add(_o.set(0.06,-0.13,0.025))],[0.16,g],[0.22,g.clone().add(_o.set(0,0,tr))],[0.26,g.clone().add(_o.set(0.06,-0.12,tr))],
        [0.34,K.belt],[0.38,K.belt.clone().add(_o.set(-0.02,0.04,-0.02))],[0.48,K.ejectAbove],[0.54,K.ejectIn],[0.57,K.ejectAbove],
        [0.6,rel.clone().add(_o.set(0.12,-0.07,0.03))],[0.65,rel.clone().add(_o.set(0.07,-0.06,0.02))],[0.68,rel.clone().add(_o.set(0.006,-0.01,0))],[0.7,rel.clone().add(_o.set(0.002,-0.004,0))],[0.76,rel.clone().add(_o.set(0.1,-0.1,0.03))],[1,K.down]],pp,m.armL.tgt);
      if (this.passed(0.22, pp)) this.bump(-0.3, -0.05, 0.15, 0.15);
      if (this.passed(0.7, pp)) this.bump(0.7, 0.14, -0.3, -0.2);
      m.armL.curlT = (pp>0.14&&pp<0.25)?0.9:(pp>0.65&&pp<0.72)?0.35:pp>0.3&&pp<0.57?0.6:0.85;
    }
    if (pp > (semi?0.34:0.26) && pp < (semi?0.54:0.47)) this.shellInHand(m, true, 0);
    return semi?env(pp,0.16,0.34,0.57,0.74):env(pp,0.08,0.26,0.52,0.66);
  },
  // 중절식: 총열 꺾기 → 총구를 들어 탄피 털기 → 두 발을 한꺼번에 → 손목을 튕겨 닫는다
  animBreak(m, rl) {
    const K = m.keys, P = m.parts, bar = P.barrel;
    if (!bar || !m.port) return;
    let open, e = 1, flick = 0;
    if (rl.phase === 'start') {
      open = seg(rl.pp, 0, 0.4); e = ss(rl.pp / 0.6); flick = env(rl.pp, 0.42, 0.52, 0.62, 0.82);
      if (this.passed(0.4, rl.pp)) this.bump(-0.7, -0.12, 0, 0.1);
      if (this.passed(0.52, rl.pp)) this.bump(0.5, 0.1, 0, 0);
    } else if (rl.phase === 'load') { open = 1; if (this.passed(0.58, rl.shellP)) this.bump(-0.2, 0.04, -0.1, 0); }
    else {
      open = 1 - seg(rl.pp, 0.16, 0.3); e = 1 - ss((rl.pp - 0.4) / 0.6); flick = env(rl.pp, 0.06, 0.2, 0.3, 0.52);
      if (this.passed(0.3, rl.pp)) this.bump(1.0, 0.24, 0.2, -0.2);
    }
    const ang = -0.62 * open;
    bar.rotation.x = ang;
    const rot = (v, out) => out.copy(v).sub(bar.position).applyAxisAngle(_c.set(1, 0, 0), ang).add(bar.position);
    const foreOn = rot(m.fore, _a);                                     // 포엔드를 잡은 손 (총열과 함께)
    const ch = rot(m.port, _b);                                         // 약실 입구
    const axis = _o.set(0, 0, 1).applyAxisAngle(_c.set(1, 0, 0), ang);  // 약실에서 뒤쪽 방향
    const below = ch.clone().add(new V3(-0.05, -0.14, 0.08)), down = ch.clone().add(new V3(-0.09, -0.32, 0.14));
    m.shellOff1 = null;
    if (rl.phase === 'start') { if (rl.pp < 0.6) m.armL.tgt.copy(foreOn); else m.armL.tgt.copy(foreOn).lerp(down, seg(rl.pp, 0.6, 1)); }
    else if (rl.phase === 'load') {
      const c = rl.shellP, two = rl.per === 2;
      const entry = ch.clone().addScaledVector(axis, 0.05).add(new V3(-0.012, -0.02, 0)), into = ch.clone().addScaledVector(axis, 0.012).add(new V3(-0.012, -0.02, 0));
      if (c < 0.4) { m.armL.tgt.copy(down).lerp(entry, sm(c / 0.4)); this.shellInHand(m, true, 0, axis, two); }
      else if (c < 0.6) { m.armL.tgt.copy(entry).lerp(into, sm((c - 0.4) / 0.2)); this.shellInHand(m, true, 0, axis, two); }
      else m.armL.tgt.copy(into).lerp(down, sm((c - 0.6) / 0.4));
    } else m.armL.tgt.copy(down).lerp(foreOn, seg(rl.pp, 0, 0.85));
    POSE.rz -= 0.25 * e; POSE.rx += 0.22 * e + 0.32 * flick; POSE.ry += 0.1 * e; POSE.x -= 0.05 * e; POSE.y += 0.08 * e + 0.03 * flick; POSE.z += 0.02 * e;
  },
  shellInHand(m, on, roll, axis, two) {
    if (!m.shell) return;
    m.shell.visible = on;
    // 두 발: 양쪽 약실 간격만큼 벌려 쥔다
    const half = two ? 0.0136 * m.s : 0;
    m.shellOff1 = two ? (m._so1 || (m._so1 = new V3())).set(-half, 0, 0) : null;
    m.shellOff2 = (m._so2 || (m._so2 = new V3())).set(half * 2, 0, 0);
    m.shell.position.copy(m.armL.tgt).add(_c.set(0.014, 0.022, -0.012));
    if (m.shellOff1) m.shell.position.add(m.shellOff1);
    if (axis) { m.shell.quaternion.setFromUnitVectors(_c.set(0, 0, 1), axis); } else m.shell.rotation.set(0.15, 0, 0);
    if (m.shell2) { m.shell2.visible = on && two; m.shell2.quaternion.copy(m.shell.quaternion); m.shell2.position.copy(m.shell.position).add(m.shellOff2); }
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
    _a.copy(K.knob).applyAxisAngle(_c.set(0, 0, 1), lift).add(bolt.position).add(_o.set(0.004,0.002,0));
    handPose(m.armR,'bolt',[-0.9,-0.4,0],[0,0.5,-1],0.8,0.65,0.75);
    m.armR.pole.set(1,-0.55,-0.25).normalize();
    const knob=_a.clone(),outside=knob.clone().add(new V3(0.075,-0.025,0.035));
    if(c<0.12)track([[0,m.grip],[0.055,outside],[0.12,knob]],c,m.armR.tgt);
    else if(c<0.68)m.armR.tgt.copy(knob);
    else track([[0.68,knob],[0.77,outside],[0.9,m.grip]],c,m.armR.tgt);
    const e = seg(c, 0, 0.12) * (1 - seg(c, 0.72, 1));
    POSE.rz += 0.14 * e; POSE.rx -= 0.03 * e; POSE.y -= 0.012 * e; POSE.z += 0.015 * e;
  }
};

})();
