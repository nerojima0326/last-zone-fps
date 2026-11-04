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
let silTex = null;
function silhouetteTexture() {
  if (silTex) return silTex;
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
    path(); c.fillStyle = '#c6a46e'; c.fill();
    c.save(); path(); c.clip();
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '90,70,40' : '255,240,210'},0.06)`; c.fillRect(Math.random() * W, Math.random() * H, 4 + Math.random() * 30, 2 + Math.random() * 8); }
    // 점수 구역 선 (머리 · 가슴 A존 · C존)
    c.strokeStyle = 'rgba(70,50,25,0.75)'; c.lineWidth = 3;
    c.strokeRect(X(-0.07), Y(1.69), 0.14 * sx, 0.13 * sy);
    c.strokeRect(X(-0.11), Y(1.36), 0.22 * sx, 0.3 * sy);
    c.strokeRect(X(-0.2), Y(1.42), 0.4 * sx, 0.5 * sy);
    c.restore();
    path(); c.strokeStyle = '#5b4426'; c.lineWidth = 4; c.stroke();
  });
  return silTex;
}
// 숫자 판 (거리 표지)
function signTexture(text) {
  return G.Tex.canvas(256, 128, (c, w, h) => {
    c.fillStyle = '#f2efe6'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2a2a2a'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#1b1b1b'; c.font = 'bold 74px Rajdhani, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, w / 2, h / 2 + 4);
  }, { clamp: true });
}

const T = G.Training = {
  active: false, targets: [], objs: [], items: [], nums: [], shotId: 0,
  stats: { shots: 0, hits: 0, heads: 0, last: 0, downs: 0, dmg: 0 },

  start() {
    const W = G.World, R = W.range;
    if (!R) return;
    this.active = true;
    this.targets = []; this.objs = []; this.items = []; this.nums = []; this.hitShots = new Set();
    this.stats = { shots: 0, hits: 0, heads: 0, last: 0, downs: 0, dmg: 0 };
    const M = this.mats || (this.mats = {
      sil: new THREE.MeshStandardMaterial({ map: silhouetteTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.55, metalness: 0.35 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2c2e31, roughness: 0.6, metalness: 0.5 })
    });
    const FL = R.line, x0 = R.x, gy = (x, z) => W.heightAt(x, z);
    // ---- 사람 표적 ----
    const addSil = (x, d, opt) => {
      const z = FL - d, y = gy(x, z);
      const root = new THREE.Group(); root.position.set(x, y, z);
      // 받침 (나무 기둥 두 개 + 발)
      const stand = new THREE.Group(); root.add(stand);
      for (const sx of [-0.2, 0.2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), M.wood); m.position.set(sx, 0.25, -0.02); stand.add(m); }
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.4), M.wood); foot.position.set(0, 0.03, 0); stand.add(foot);
      // 쓰러지는 축 (발목) 위에 표적판
      const pivot = new THREE.Group(); pivot.position.set(0, 0.06, 0); root.add(pivot);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.8).translate(0, 0.9, 0), M.sil);
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
    // ---- 화면 ----
    this.ui();
    this.refill();
  },
  // 테이블 물건 하나 (총구가 표적 쪽을 향하게)
  placeItem(kind, x, y, z, rotY) {
    const Game = G.Game;
    const it = Game.addLoot(kind, G.THROW_NAMES[kind] ? 1 : 1, _p.set(x, y, z), { train: { x, y, z, rotY } });
    it.scope = null;
    it.mesh.rotation.set(0, rotY, 0);
    it.mesh.updateMatrix(); it.mesh.updateMatrixWorld(true);
    this.items.push(it);
    return it;
  },
  // 집어 간 물건은 그 자리에 다시 놓는다
  respawn(it) {
    const s = it.train;
    setTimeout(() => { if (this.active) this.placeItem(it.kind, s.x, s.y, s.z, s.rotY); }, 400);
  },
  stop() {
    if (!this.active && !this.objs.length) return;
    this.active = false;
    for (const o of this.objs) G.scene.remove(o);
    this.objs = []; this.targets = []; this.items = [];
    for (const n of this.nums) n.el.remove();
    this.nums = [];
    if (this.statsEl) this.statsEl.classList.add('hidden');
  },
  ui() {
    if (!this.layer) {
      this.layer = document.createElement('div'); this.layer.id = 'dmgNums';
      document.getElementById('hud').appendChild(this.layer);
      this.statsEl = document.createElement('div'); this.statsEl.id = 'trainStats';
      document.getElementById('hud').appendChild(this.statsEl);
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
  onShot() { this.shotId++; this.stats.shots++; this.dirty = true; },

  /* ---------------- 판정 ---------------- */
  // 총알 (o, d 단위벡터) 이 maxT 안에서 표적에 맞으면 {t, target, head}
  hitTest(o, d, maxT) {
    let best = null;
    for (const t of this.targets) {
      if (t.kind === 'sil' && t.down > 0) continue;
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
    if (shot && !this.hitShots.has(shot)) { this.hitShots.add(shot); this.stats.hits++; }
    if (h.head) this.stats.heads++;
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
    for (const t of this.targets) {
      if (t.kind === 'sil') {
        if (t.move) {
          const M = t.move, mid = (M.a + M.b) / 2, half = (M.b - M.a) / 2;
          let u;
          if (M.stop) { const c = (time * M.sp / half / 2 + M.ph) % 2; u = c < 1 ? Math.min(1, c * 1.4) : Math.max(0, 1 - (c - 1) * 1.4); u = u * 2 - 1; }   // 끝에서 잠깐 멈춤
          else u = Math.sin(time * M.sp / half + M.ph);
          t.root.position.x = mid + u * half;
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
      const k = n.t / 1.1;
      n.el.style.transform = `translate(${(_p.x + 1) / 2 * W + n.dx * k}px, ${(1 - _p.y) / 2 * H - 18 - 60 * k}px) translate(-50%, -50%) scale(${n.t < 0.08 ? 1.5 - n.t * 6 : 1})`;
      n.el.style.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
    if (this.dirty) { this.dirty = false; this.drawStats(); }
  }
};
})();
