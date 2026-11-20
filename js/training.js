// training.js — 훈련장: 혼자 사격 연습. 모든 총이 테이블에 놓여 있고, 고정·움직이는 표적과 강철판이 있다.
// 표적을 맞추면 명중 표시와 피해 숫자가 뜬다 (머리는 노란색). 탄약은 무한, 플레이어는 다치지 않는다.
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;

const HP = 100;
const _o = new V3(), _d = new V3(), _m = new THREE.Matrix4(), _p = new V3(), _s = new V3();

// 사람 모양 표적 (가로 0.6m · 세로 1.8m, 바닥 y=0). 맞는 부분 판정과 그림이 같은 치수를 쓴다
const SHAPE = {
  head: { x: 0, y: 1.62, r: 0.12 },
  neck: { x0: -0.06, x1: 0.06, y0: 1.44, y1: 1.52 },
  torso: { x0: -0.27, x1: 0.27, y0: 0.86, y1: 1.47, r: 0.08 },
  legs: { x0: -0.19, x1: 0.19, y0: 0.06, y1: 0.87 }
};
function partAt(x, y) {
  const S = SHAPE;
  if ((x - S.head.x) ** 2 + (y - S.head.y) ** 2 <= S.head.r * S.head.r) return 'head';
  const inR = (R) => x >= R.x0 && x <= R.x1 && y >= R.y0 && y <= R.y1;
  if (inR(S.torso)) {
    // 어깨 모서리 둥글게
    const r = S.torso.r, cx = U.clamp(x, S.torso.x0 + r, S.torso.x1 - r), cy = Math.min(y, S.torso.y1 - r);
    if (y > S.torso.y1 - r && (x - cx) ** 2 + (y - cy) ** 2 > r * r) return null;
    return 'body';
  }
  if (inR(S.neck) || inR(S.legs)) return 'body';
  return null;
}
const silTexs = {};
// civ: 민간인 표적 (파란 옷, '쏘지 마시오') — 킬하우스에서 맞히면 벌점
function silhouetteTexture(civ) {
  if (silTexs[civ ? 'c' : 'e']) return silTexs[civ ? 'c' : 'e'];
  let silTex;
  const W = 256, H = 768, sx = W / 0.6, sy = H / 1.8, X = x => (x + 0.3) * sx, Y = y => H - y * sy;
  silTex = G.Tex.canvas(W, H, (c) => {
    c.clearRect(0, 0, W, H);
    const S = SHAPE;
    const path = () => {
      c.beginPath();
      c.arc(X(S.head.x), Y(S.head.y), S.head.r * sx, 0, Math.PI * 2);
      c.rect(X(S.neck.x0), Y(S.neck.y1), (S.neck.x1 - S.neck.x0) * sx, (S.neck.y1 - S.neck.y0) * sy);
      const T = S.torso, r = T.r * sx;
      if (c.roundRect) c.roundRect(X(T.x0), Y(T.y1), (T.x1 - T.x0) * sx, (T.y1 - T.y0) * sy, [r, r, 0, 0]);
      else c.rect(X(T.x0), Y(T.y1), (T.x1 - T.x0) * sx, (T.y1 - T.y0) * sy);
      c.rect(X(S.legs.x0), Y(S.legs.y1), (S.legs.x1 - S.legs.x0) * sx, (S.legs.y1 - S.legs.y0) * sy);
    };
    // 골판지 색 + 얼룩
    path(); c.fillStyle = civ ? '#8fb3d6' : '#c6a46e'; c.fill();
    c.save(); path(); c.clip();
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '90,70,40' : '255,240,210'},0.06)`; c.fillRect(Math.random() * W, Math.random() * H, 4 + Math.random() * 30, 2 + Math.random() * 8); }
    // 점수 구역 선 (머리 · 가슴 A존 · C존)
    c.strokeStyle = 'rgba(70,50,25,0.75)'; c.lineWidth = 3;
    c.strokeRect(X(-0.07), Y(1.69), 0.14 * sx, 0.13 * sy);
    c.strokeRect(X(-0.11), Y(1.36), 0.22 * sx, 0.3 * sy);
    c.strokeRect(X(-0.2), Y(1.42), 0.4 * sx, 0.5 * sy);
    c.restore();
    path(); c.strokeStyle = civ ? '#2d4a66' : '#5b4426'; c.lineWidth = 4; c.stroke();
    if (civ) {
      c.fillStyle = '#ffffff'; c.font = 'bold 44px Noto Sans KR, sans-serif'; c.textAlign = 'center';
      c.fillText('민간인', W / 2, Y(1.15)); c.font = 'bold 30px Noto Sans KR, sans-serif'; c.fillText('쏘지 마시오', W / 2, Y(0.95));
    }
  });
  silTexs[civ ? 'c' : 'e'] = silTex;
  return silTex;
}
// 숫자 판 (거리 표지)
function signTexture(text, wide, sub) {
  const w0 = wide ? 512 : 256;
  return G.Tex.canvas(w0, 128, (c, w, h) => {
    c.fillStyle = wide ? '#2f3a2c' : '#f2efe6'; c.fillRect(0, 0, w, h);
    c.strokeStyle = wide ? '#e9e2c8' : '#2a2a2a'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = wide ? '#f4eed6' : '#1b1b1b'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = wide ? 'bold 50px Noto Sans KR, sans-serif' : 'bold 74px Rajdhani, sans-serif';
    c.fillText(text, w / 2, sub ? h / 2 - 14 : h / 2 + 4);
    if (sub) { c.font = '600 26px Noto Sans KR, sans-serif'; c.fillText(sub, w / 2, h / 2 + 34); }
  }, { clamp: true });
}
// 헬기장 'H'
function heliTexture() {
  return G.Tex.canvas(256, 256, (c, w) => {
    c.clearRect(0, 0, w, w);
    c.strokeStyle = '#f1ece0'; c.lineWidth = 12; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 12, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#f1ece0'; c.fillRect(w * 0.3, w * 0.25, w * 0.1, w * 0.5); c.fillRect(w * 0.6, w * 0.25, w * 0.1, w * 0.5); c.fillRect(w * 0.3, w * 0.45, w * 0.4, w * 0.1);
  }, { clamp: true });
}
// 기지 깃발
function flagTexture() {
  return G.Tex.canvas(256, 160, (c, w, h) => {
    c.fillStyle = '#4c5a37'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c9b26a'; c.fillRect(0, h * 0.42, w, h * 0.16);
    c.beginPath(); c.arc(w * 0.3, h / 2, h * 0.28, 0, Math.PI * 2); c.fillStyle = '#2b3320'; c.fill();
    c.fillStyle = '#e8dca6'; c.font = 'bold 50px Barlow Condensed, Rajdhani, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('LZ', w * 0.3, h / 2 + 3);
  }, { clamp: true });
}
const KH_BEST = 'lastzone_killhouse_best';

const T = G.Training = {
  active: false, targets: [], objs: [], items: [], nums: [], respawns: [],
  stats: { shots: 0, hits: 0, heads: 0, last: 0, downs: 0, dmg: 0 },

  start() {
    const W = G.World, R = W.range;
    if (!R) return;
    this.active = true;
    this.targets = []; this.objs = []; this.items = []; this.nums = []; this.respawns = [];
    this.stats = { shots: 0, hits: 0, heads: 0, last: 0, downs: 0, dmg: 0 };
    const M = this.mats || (this.mats = {
      sil: new THREE.MeshStandardMaterial({ map: silhouetteTexture(false), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 }),
      civ: new THREE.MeshStandardMaterial({ map: silhouetteTexture(true), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.55, metalness: 0.35 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2c2e31, roughness: 0.6, metalness: 0.5 })
    });
    const FL = R.line, x0 = R.x, gy = (x, z) => W.heightAt(x, z);
    // ---- 사람 표적 ----
    const addSil = (x, d, opt) => {
      const z = opt && opt.z !== undefined ? opt.z : FL - d, y = opt && opt.y !== undefined ? opt.y : gy(x, z);
      const root = new THREE.Group(); root.position.set(x, y, z);
      if (opt && opt.yaw !== undefined) root.rotation.y = opt.yaw;
      // 받침 (나무 기둥 두 개 + 발)
      const stand = new THREE.Group(); root.add(stand);
      for (const sx of [-0.2, 0.2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), M.wood); m.position.set(sx, 0.25, -0.02); stand.add(m); }
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.4), M.wood); foot.position.set(0, 0.03, 0); stand.add(foot);
      // 쓰러지는 축 (발목) 위에 표적판
      const pivot = new THREE.Group(); pivot.position.set(0, 0.06, 0); root.add(pivot);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.8).translate(0, 0.9, 0), opt && opt.civ ? M.civ : M.sil);
      plate.castShadow = true; pivot.add(plate);
      for (const o of [stand, plate]) o.traverse(m => { if (m.isMesh) m.castShadow = true; });
      G.scene.add(root); this.objs.push(root);
      const t = { kind: 'sil', root, pivot, hp: HP, down: 0, fall: 0, d, x, z, ...opt };
      this.targets.push(t);
      return t;
    };
    // 고정 표적: 7·10·25·50·75·100m
    addSil(x0 - 3, 7); addSil(x0 + 3, 7);
    addSil(x0 - 12, 10); addSil(x0 - 6, 25); addSil(x0 + 1, 50); addSil(x0 + 8, 75); addSil(x0 + 13, 100);
    // 움직이는 표적 (레일 위 수레): 20m 걷기 · 40m 뛰기 · 60m 멈췄다 가기
    for (const rl of W.range.rails) {
      const t = addSil(x0, rl.d, { move: { a: x0 - 15, b: x0 + 15, sp: rl.d === 40 ? 4.2 : rl.d === 20 ? 1.8 : 2.4, ph: Math.random() * 6.28, stop: rl.d === 60 } });
      const cart = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), M.dark); cart.position.set(0, 0.12, 0); t.root.add(cart);
      t.pivot.position.y = 0.21;
    }
    // ---- 강철판 (120m 근처, 맞으면 흔들리며 땡) ----
    for (const [dx, d, r] of [[-10, 110, 0.3], [-4, 115, 0.22], [4, 112, 0.3], [10, 118, 0.18]]) {
      const x = x0 + dx, z = FL - d, y = gy(x, z);
      const root = new THREE.Group(); root.position.set(x, y, z);
      const frame = new THREE.Group(); root.add(frame);
      for (const sx of [-0.5, 0.5]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.06), M.dark); m.position.set(sx, 0.85, 0); frame.add(m); }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.06, 0.06), M.dark); bar.position.set(0, 1.7, 0); frame.add(bar);
      const pivot = new THREE.Group(); pivot.position.set(0, 1.66, 0); root.add(pivot);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.025, 28).rotateX(Math.PI / 2).translate(0, -0.35 - r, 0), M.steel); pivot.add(disc);
      for (const sx of [-0.06, 0.06]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.35, 0.01), M.dark); ch.position.set(sx, -0.175, 0); pivot.add(ch); }
      root.traverse(m => { if (m.isMesh) m.castShadow = true; });
      G.scene.add(root); this.objs.push(root);
      this.targets.push({ kind: 'gong', root, pivot, r, cy: -0.35 - r, swing: 0, swingV: 0, hp: Infinity, d });
    }
    // ---- 거리 표지 ----
    for (const d of [10, 25, 50, 75, 100]) {
      const z = FL - d, x = x0 - 36, y = gy(x, z);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: signTexture(d + 'm'), side: THREE.DoubleSide }));
      m.position.set(x + 0.08, y + 2.1, z); m.rotation.y = 0.35;
      G.scene.add(m); this.objs.push(m);
    }
    // ---- 테이블 위 총·조준경·투척무기 ----
    const tb = W.range.tables;
    const row = (table, kinds) => kinds.forEach((k, i) => {
      const x = table.x0 + 0.55 + i * ((table.x1 - table.x0 - 1.1) / Math.max(1, kinds.length - 1));
      this.placeItem(k, x, table.y, table.z, 0);
    });
    const by = c => G.GUN_IDS.filter(id => G.WEAPONS[id].cls === c);
    row(tb[0], by('rifle')); row(tb[1], by('shotgun')); row(tb[2], by('pistol'));
    row(tb[3], Object.keys(G.SCOPES).map(s => 'scope_' + s).concat(['frag', 'smoke', 'molotov', 'flash']));
    const at=W.range.attachmentTable,items=Object.keys(G.Attachments.catalog());
    const cols=Math.ceil(items.length/2);
    items.forEach((kind,i)=>{const x=at.x0+.4+(i%cols)*(at.x1-at.x0-.8)/Math.max(1,cols-1),z=at.z0+.5+Math.floor(i/cols)*.9;this.placeItem(kind,x,at.y,z,0)});
    // ---- 운전 연습 코스: 사격대 뒤 진입로에 지프 두 대 ----
    const C = W.course;
    if (C && G.Vehicles) {
      G.Vehicles.reset();
      for (const dz of [-2.6, 2.6]) G.Vehicles.spawnAt(C.spurX + 14, C.z1 + dz, -Math.PI / 2, dz < 0 ? 'izh' : 'e2200');   // 나란히 두 대
      // 출발선 (진입로가 코스에 닿는 곳)과 모서리 고깔
      const paint = new THREE.MeshBasicMaterial({ color: 0xf2efe6 }), cone = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.6 });
      const line = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 8), paint);
      line.rotation.x = -Math.PI / 2; line.position.set(C.x0 + 14, gy(C.x0 + 14, C.z1) + 0.06, C.z1);
      G.scene.add(line); this.objs.push(line);
      const coneGeo = new THREE.ConeGeometry(0.22, 0.6, 12).translate(0, 0.3, 0);
      // 모서리 안쪽 (도로 밖)에 고깔 세 개씩
      for (const [x, z, sx, sz] of [[C.x0 + 10, C.z0 + 10, 1, -1], [C.x1 - 10, C.z0 + 10, 1, 1], [C.x1 - 10, C.z1 - 10, 1, -1], [C.x0 + 10, C.z1 - 10, 1, 1]]) {
        for (const o of [-1.4, 0, 1.4]) {
          const cx = x + o * sx, cz = z + o * sz;
          const m = new THREE.Mesh(coneGeo, cone); m.position.set(cx, gy(cx, cz), cz); m.castShadow = true;
          G.scene.add(m); this.objs.push(m);
        }
      }
    }
    // ---- v58 사격대 지붕 아래 조명 (레이트레이싱을 켜면 지붕 그늘이 너무 어두워 스폰 자리가 잘 안 보인다) ----
    this.lampSpots = [];
    const lampMat = this.lampMat || (this.lampMat = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, emissive: 0xfff3dc, emissiveIntensity: 2.2, roughness: 0.4 }));
    const houseMat = M.dark, tubeGeo = new THREE.BoxGeometry(1.3, 0.05, 0.12), houseGeo = new THREE.BoxGeometry(1.42, 0.06, 0.22);
    for (const lx of [-12, -4, 4, 12]) for (const lz of [2.6, 7.4]) {
      const x = R.x + lx, z = R.line + lz, y = R.y + 3.4;
      const g = new THREE.Group(); g.position.set(x, y, z);
      const house = new THREE.Mesh(houseGeo, houseMat); house.position.y = -0.03; g.add(house);
      const tube = new THREE.Mesh(tubeGeo, lampMat); tube.position.y = -0.085; g.add(tube);
      G.scene.add(g); this.objs.push(g);
      this.lampSpots.push(new THREE.Vector3(x, y - 0.2, z));
    }
    this.syncLamps();
    // ---- v66 훈련 기지: 킬하우스 · 투척 훈련장 · 표지 · 깃발 ----
    const BS = W.base;
    if (BS) {
      const K = BS.kill, ky = gy(-775, 752) + 0.06;
      // 킬하우스 표적: 방마다 들어오는 문 쪽을 본다 (e = 적, c = 민간인)
      const rooms = [
        { door: [-766, 740], t: [[-772.5, 746, 'e'], [-762, 750.6, 'e'], [-769, 751, 'c']] },
        { door: [-767, 752], t: [[-762.2, 762.8, 'e'], [-772.6, 761.5, 'e'], [-764.5, 757.4, 'c']] },
        { door: [-775, 759.5], t: [[-788.2, 762.6, 'e'], [-783, 754.2, 'e'], [-787.6, 756.2, 'c']] },
        { door: [-782, 752], t: [[-788.2, 742, 'e'], [-777.6, 742.6, 'e']] }
      ];
      this.kh = { active: false, t: 0, enemies: 0, civ: 0, civHit: 0, best: null, resetAt: 0, inside: false, targets: [] };
      try { const v = +localStorage.getItem(KH_BEST); if (v > 0) this.kh.best = v; } catch (e) { }
      for (const R of rooms) for (const [x, z, k] of R.t) {
        const t = addSil(x, 0, { z, y: ky, yaw: Math.atan2(R.door[0] - x, R.door[1] - z), civ: k === 'c', kh: true });
        t.fall = 1; t.down = 0; this.kh.targets.push(t);
        if (k === 'c') this.kh.civ++; else this.kh.enemies++;
      }
      // 투척 훈련장 표적: 벙커 안 · 참호 안 · 원형 과녁 가운데 (던지는 쪽 -z 를 본다)
      const Gt = BS.grenade, gy0 = gy(-726, 760);
      addSil(-740, 0, { z: 758.6, y: gy0, yaw: Math.PI, zone: 'grenade' });
      addSil(-724, 0, { z: 766.5, y: gy0, yaw: Math.PI, zone: 'grenade' });
      addSil(Gt.rings.x, 0, { z: Gt.rings.z, y: gy0, yaw: Math.PI, zone: 'grenade' });
      // 원형 과녁 (바닥 고리 셋)
      const ringMat = [0xf4f0e2, 0xe8c53a, 0xd9483a].map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      Gt.rings.r.forEach((r, i) => {
        const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.18, r, 48), ringMat[i]);
        m.rotation.x = -Math.PI / 2; m.position.set(Gt.rings.x, gy0 + 0.04 + i * 0.002, Gt.rings.z);
        G.scene.add(m); this.objs.push(m);
      });
      // 표지판 (기둥 + 판)
      const sign = (x, z, yaw, text, sub, w = 2.4) => {
        const yy = gy(x, z), g = new THREE.Group(); g.position.set(x, yy, z); g.rotation.y = yaw;
        for (const sx of [-w / 2 + 0.15, w / 2 - 0.15]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 0.08), M.dark); p.position.set(sx, 1.0, -0.03); g.add(p); }
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: signTexture(text, true, sub), side: THREE.DoubleSide }));
        m.position.y = 1.9; g.add(m);
        G.scene.add(g); this.objs.push(g);
      };
      sign(-750, 723, Math.PI, '킬하우스 · 투척', '사격대 뒤 남쪽 ↓');
      sign(-766, 735.5, Math.PI, '킬하우스', '들어가면 시간 측정 시작');
      sign(-726, 733.5, Math.PI, '투척 훈련장', '창문 15m · 참호 25m · 과녁 36m');
      sign(-700, 722.5, Math.PI, '운전 코스', '지프 두 대 · 동쪽 →');
      for (const [d, x, z] of [['15m', -740, 754.8], ['25m', -733.5, 766.5], ['36m', Gt.rings.x - 5.2, Gt.rings.z]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: signTexture(d), side: THREE.DoubleSide }));
        m.position.set(x, gy0 + (d === '15m' ? 2.95 : 1.2), z); m.rotation.y = Math.PI;
        G.scene.add(m); this.objs.push(m);
      }
      // 헬기장 H · 깃발
      const hm = new THREE.Mesh(new THREE.PlaneGeometry(BS.heli.r * 1.7, BS.heli.r * 1.7), new THREE.MeshBasicMaterial({ map: heliTexture(), transparent: true, depthWrite: false }));
      hm.rotation.x = -Math.PI / 2; hm.position.set(BS.heli.x, gy(BS.heli.x, BS.heli.z) + 0.1, BS.heli.z);
      G.scene.add(hm); this.objs.push(hm);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 8, 1).translate(0.9, 0, 0), new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.9 }));
      fl.position.set(BS.flag.x + 0.06, BS.flag.y - 0.7, BS.flag.z); this.flag = fl;
      G.scene.add(fl); this.objs.push(fl);
    } else this.kh = null;
    // ---- 화면 ----
    this.ui();
    this.refill();
  },
  // 테이블 물건 하나 (총구가 표적 쪽을 향하게)
  placeItem(kind, x, y, z, rotY) {
    const Game = G.Game;
    const it = Game.addLoot(kind, 1, _p.set(x, y, z), { train: { x, y, z, rotY } });
    it.scope = null;
    it.mesh.rotation.set(0, rotY, 0);
    it.mesh.updateMatrix(); it.mesh.updateMatrixWorld(true);
    this.items.push(it);
    return it;
  },
  // 집어 간 물건은 그 자리에 다시 놓는다
  respawn(it) {
    const i = this.items.indexOf(it);
    if (i < 0) return;
    this.items.splice(i, 1);
    this.respawns.push({ kind: it.kind, slot: it.train, at: G.Game.time + 0.4 });
  },
  // 조명은 레이트레이싱을 켰을 때만 실제 광원으로 넣는다 (평소 렌더러에서는 광원이 늘면 모든 재질이 무거워진다 — 평소엔 지붕 아래도 충분히 밝다)
  lamps: [],
  syncLamps() {
    const want = this.active && !!(G.RT && G.RT.wanted && G.RT.state === 'on') ? (this.lampSpots || []) : [];
    if (want.length === this.lamps.length) return;
    for (const l of this.lamps) G.scene.remove(l);
    this.lamps = want.map(p => {
      const l = new THREE.PointLight(0xfff1d8, 14, 14, 2);
      l.position.copy(p); l.castShadow = false; l.userData.rtRadius = 0.35;
      G.scene.add(l); return l;
    });
  },
  stop() {
    if (!this.active && !this.objs.length) return;
    this.active = false;
    this.syncLamps();
    const geometries = new Set(), materials = new Set();
    const shared = new Set(Object.values(this.mats));
    for (const o of this.objs) {
      G.scene.remove(o);
      o.traverse(m => {
        if (m.geometry) geometries.add(m.geometry);
        if (m.material && !shared.has(m.material)) materials.add(m.material);
      });
    }
    for (const geo of geometries) geo.dispose();
    for (const mat of materials) { if (mat.map) mat.map.dispose(); mat.dispose(); }
    this.respawns = [];
    this.objs = []; this.targets = []; this.items = [];
    for (const n of this.nums) n.el.remove();
    this.nums = [];
    if (this.statsEl) this.statsEl.classList.add('hidden');
    if (this.khEl) this.khEl.classList.add('hidden');
    this.kh = null; this.flag = null;
  },
  ui() {
    if (!this.layer) {
      this.layer = document.createElement('div'); this.layer.id = 'dmgNums';
      document.getElementById('hud').appendChild(this.layer);
      this.statsEl = document.createElement('div'); this.statsEl.id = 'trainStats';
      document.getElementById('hud').appendChild(this.statsEl);
      this.khEl = document.createElement('div'); this.khEl.id = 'khTimer'; this.khEl.className = 'hidden';
      document.getElementById('hud').appendChild(this.khEl);
    }
    this.statsEl.classList.remove('hidden');
    this.drawStats();
  },
  drawStats() {
    const s = this.stats, acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0;
    this.statsEl.innerHTML = `<b>훈련장</b><span>명중 <i>${s.hits}</i> / ${s.shots} (${acc}%)</span><span>헤드샷 <i>${s.heads}</i></span><span>최근 피해 <i>${Math.round(s.last)}</i></span><span>쓰러뜨림 <i>${s.downs}</i></span>`;
  },
  refill() {
    const a = G.Game.player;
    if (!a) return;
    for (const t in a.ammo) a.ammo[t] = 999;
    for (const k of G.THROW_ORDER) if ((a.throwables[k] || 0) < 3) a.throwables[k] = 3;
  },
  onShot() { this.stats.shots++; this.dirty = true; return { hit: false, head: false }; },

  /* ---------------- 판정 ---------------- */
  // 총알 (o, d 단위벡터) 이 maxT 안에서 표적에 맞으면 {t, target, head}
  hitTest(o, d, maxT) {
    let best = null;
    for (const t of this.targets) {
      if (t.kind === 'sil' && (t.down > 0 || (t.kh && t.fall > 0.5))) continue;
      const dx = t.root.position.x - o.x, dz = t.root.position.z - o.z;
      if (dx * dx + dz * dz > (maxT + 3) * (maxT + 3)) continue;
      // 표적판 좌표계로 옮겨 평면(z=0)과 만나는 점
      _m.copy(t.pivot.matrixWorld).invert();
      _o.copy(o).applyMatrix4(_m);
      _d.copy(d).transformDirection(_m);
      if (Math.abs(_d.z) < 1e-5) continue;
      const tt = -_o.z / _d.z;
      if (tt < 0 || tt > maxT || (best && tt >= best.t)) continue;
      const lx = _o.x + _d.x * tt, ly = _o.y + _d.y * tt;
      let part = null;
      if (t.kind === 'sil') part = partAt(lx, ly);
      else if ((lx * lx + (ly - t.cy) ** 2) <= t.r * t.r) part = 'body';
      if (!part) continue;
      best = { t: tt, target: t, head: part === 'head' };
    }
    return best;
  },
  // 맞음 (같은 프레임의 산탄은 합쳐서 숫자 하나로)
  onHit(h, dmg, point, dir, shot) {
    const t = h.target;
    t.fd = (t.fd || 0) + dmg; t.fh = t.fh || h.head; t.fp = (t.fp || new V3()).copy(point);
    if (shot && !shot.hit) { shot.hit = true; this.stats.hits++; }
    if (h.head && shot && !shot.head) { shot.head = true; this.stats.heads++; }
    G.FX.impact(point, _s.copy(dir).negate(), t.kind === 'gong' ? 'metal' : 'wood');
    G.Audio.impact(point, t.kind === 'gong' ? 'metal' : 'wood');
    if (t.kind === 'gong') t.swingV += U.clamp(dmg / 40, 0.3, 2.2) * 3.2;
    this.dirty = true;
  },
  flush() {
    for (const t of this.targets) {
      if (!t.fd) continue;
      const dmg = t.fd, head = t.fh;
      t.fd = 0; t.fh = false;
      let kill = false;
      if (t.kind === 'sil') {
        t.hp -= dmg;
        if (t.civ && this.kh && this.kh.active && !t.hitCiv) { t.hitCiv = true; this.kh.civHit++; G.UI.toast('민간인 명중 · +5초'); }
        if (t.hp <= 0) { kill = true; t.down = 2.2; t.fall = 0; this.stats.downs++; }
      }
      this.stats.last = dmg; this.stats.dmg += dmg;
      G.UI.hitmarker(head, kill);
      G.Audio.hit(head, kill);
      this.addNum(t.fp, dmg, head, kill);
    }
  },
  addNum(pos, dmg, head, kill) {
    const el = document.createElement('div');
    el.className = 'dn' + (head ? ' head' : '') + (kill ? ' kill' : '');
    el.textContent = Math.round(dmg);
    this.layer.appendChild(el);
    this.nums.push({ el, pos: pos.clone(), t: 0, dx: (Math.random() - 0.5) * 30 });
    if (this.nums.length > 24) this.nums.shift().el.remove();
  },

  /* ---------------- 매 프레임 ---------------- */
  update(dt) {
    if (!this.active) return;
    this.flush();
    this.refill();
    const time = G.Game.time;
    while (this.respawns.length && this.respawns[0].at <= time) {
      const { kind, slot } = this.respawns.shift();
      this.placeItem(kind, slot.x, slot.y, slot.z, slot.rotY);
    }
    for (const t of this.targets) {
      if (t.kind === 'sil') {
        if (t.move) {
          const M = t.move, mid = (M.a + M.b) / 2, half = (M.b - M.a) / 2;
          let u;
          if (M.stop) { const c = (time * M.sp / half / 2 + M.ph) % 2; u = c < 1 ? Math.min(1, c * 1.4) : Math.max(0, 1 - (c - 1) * 1.4); u = u * 2 - 1; }   // 끝에서 잠깐 멈춤
          else u = Math.sin(time * M.sp / half + M.ph);
          t.root.position.x = mid + u * half;
        }
        if (t.kh) {
          // 킬하우스 표적: 진행 중에만 서 있고, 쓰러지면 끝날 때까지 누워 있다
          const up = this.kh && this.kh.active && t.hp > 0;
          t.fall = up ? Math.max(0, t.fall - dt * 4) : Math.min(1, t.fall + dt * 5);
          t.pivot.rotation.x = -Math.PI / 2 * (1 - (1 - t.fall) * (1 - t.fall));
          t.root.updateMatrixWorld(true);
          continue;
        }
        // 쓰러짐 → 2초 뒤 다시 일어섬
        if (t.down > 0) {
          t.down -= dt; t.fall = Math.min(1, t.fall + dt * 5);
          if (t.down <= 0) { t.hp = HP; }
        } else t.fall = Math.max(0, t.fall - dt * 3);
        t.pivot.rotation.x = -Math.PI / 2 * (1 - (1 - t.fall) * (1 - t.fall));
      } else {
        // 강철판 흔들림 (감쇠 진동)
        t.swingV += (-28 * t.swing - 1.6 * t.swingV) * dt;
        t.swing += t.swingV * dt;
        t.pivot.rotation.x = -t.swing * 0.35;
      }
      t.root.updateMatrixWorld(true);
    }
    // 피해 숫자: 맞은 곳에서 위로 떠오르며 사라짐
    const cam = G.camera, W = innerWidth, H = innerHeight;
    if (this.nums.length) cam.updateMatrixWorld();
    for (let i = 0; i < this.nums.length; i++) {
      const n = this.nums[i];
      n.t += dt;
      if (n.t > 1.1) { n.el.remove(); this.nums.splice(i--, 1); continue; }
      _p.copy(n.pos).applyMatrix4(cam.matrixWorldInverse);
      if (_p.z > -0.2) { n.el.style.display = 'none'; continue; }   // 카메라 뒤
      _p.copy(n.pos).project(cam);
      n.el.style.display = 'block';
      const k = Math.max(0, n.t) / 1.1;   // 글자 알림(addMsg)은 t 가 음수에서 시작해 잠깐 머문다
      n.el.style.transform = `translate(${(_p.x + 1) / 2 * W + n.dx * k}px, ${(1 - _p.y) / 2 * H - 18 - 60 * k}px) translate(-50%, -50%) scale(${n.t >= 0 && n.t < 0.08 ? 1.5 - n.t * 6 : 1})`;
      n.el.style.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
    this.killhouse(dt);
    if (this.flag) { const k = Math.sin(time * 2.1) * 0.12 + Math.sin(time * 5.3) * 0.04; this.flag.rotation.y = k; }
    if (this.dirty) { this.dirty = false; this.drawStats(); }
  },
  // v66 킬하우스: 북쪽 입구로 들어가면 시작 → 출구로 나오면 기록 (남은 적·민간인 명중마다 +5초)
  killhouse(dt) {
    const K = this.kh, a = G.Game.player, B = G.World.base;
    if (!K || !a || !B) return;
    const R = B.kill, p = a.pos, inside = p.x > R.x0 && p.x < R.x1 && p.z > R.z0 - 0.2 && p.z < R.z1;
    if (inside && !K.inside && !K.active && p.x > R.xm) {
      K.active = true; K.t = 0; K.civHit = 0;
      for (const t of K.targets) { t.hp = HP; t.down = 0; t.hitCiv = false; }
      G.Audio.click('pin');
      G.UI.center('킬하우스', '적을 모두 쓰러뜨리고 출구로 · 민간인은 쏘지 마세요', '', 2.5);
    }
    if (K.active) {
      K.t += dt;
      const left = K.targets.filter(t => !t.civ && t.hp > 0).length;
      if (!inside) {
        const atExit = p.x < R.xm && p.z <= R.z0 + 0.5;
        K.active = false;
        if (atExit) {
          const total = K.t + (left + K.civHit) * 5;
          const best = K.best && K.best < total ? K.best : total, isBest = best === total;
          K.best = best; try { localStorage.setItem(KH_BEST, best.toFixed(2)); } catch (e) { }
          G.UI.center(isBest ? '최고 기록!' : '킬하우스 완료', `<b>${total.toFixed(2)}초</b> · 걸린 시간 ${K.t.toFixed(2)}초` + (left ? ` · 남은 적 ${left} (+${left * 5}초)` : '') + (K.civHit ? ` · 민간인 ${K.civHit} (+${K.civHit * 5}초)` : '') + ` · 최고 ${best.toFixed(2)}초`, '', 5);
        } else G.UI.toast('킬하우스 중단 — 입구로 다시 들어가면 처음부터');
      }
      this.khEl.classList.remove('hidden');
      this.khEl.innerHTML = K.active ? `<b>킬하우스</b><i>${K.t.toFixed(1)}</i><span>적 ${K.enemies - left} / ${K.enemies}</span>` + (K.civHit ? `<span class="bad">민간인 ${K.civHit}</span>` : '') : '';
      if (!K.active) this.khEl.classList.add('hidden');
    }
    K.inside = inside;
  },
  // v66 투척물이 터진 자리: 창문 벙커 · 참호 · 원형 과녁 판정, 수류탄은 가까운 표적을 쓰러뜨린다
  onBlast(o) {
    if (!this.active || !G.World.base) return;
    const Gt = G.World.base.grenade, p = o.pos, Bk = Gt.bunker, Tr = Gt.trench, Rg = Gt.rings;
    let msg = null;
    if (p.x > Bk.x0 && p.x < Bk.x1 && p.z > Bk.z0 && p.z < Bk.z1 && p.y < Bk.y1) msg = '창문 명중!';
    else if (p.x > Tr.x0 && p.x < Tr.x1 && p.z > Tr.z0 - 0.2 && p.z < Tr.z1 + 0.2 && p.y < Bk.y0 + 0.9) msg = '참호 명중!';
    else {
      const d = Math.hypot(p.x - Rg.x, p.z - Rg.z);
      if (d < Rg.r[2]) msg = (d < Rg.r[0] ? '정중앙! ' : d < Rg.r[1] ? '명중 ' : '근접 ') + d.toFixed(1) + 'm';
    }
    if (msg) this.addMsg(p, msg);
    if (o.kind === 'frag') for (const t of this.targets) {
      if (t.kind !== 'sil' || t.down > 0 || (t.kh && t.fall > 0.5)) continue;
      const d = t.root.position.distanceTo(p);
      if (d < 7) { t.fd = (t.fd || 0) + Math.round(150 * (1 - d / 7) + 20); t.fp = (t.fp || new V3()).copy(t.root.position).add(_p.set(0, 1.2, 0)); }
    }
  },
  addMsg(pos, text) {
    const el = document.createElement('div');
    el.className = 'dn msg'; el.textContent = text;
    this.layer.appendChild(el);
    this.nums.push({ el, pos: pos.clone().add(_s.set(0, 1.5, 0)), t: -0.8, dx: 0 });
    if (this.nums.length > 24) this.nums.shift().el.remove();
  }
};
})();
