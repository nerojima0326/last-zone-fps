// game.js — 매치 진행: 팀 구성, 수송기, 자기장, 전리품, 피해/처치, 승리 판정
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;

const TEAM_COLORS = ['#ffd23f', '#4fc3f7', '#7ee081', '#ff7eb6'];
const BOT_NAMES = ['검은늑대', 'SilentFox', '김병장', 'NightOwl', '불곰', 'Raven', '하늘매', 'Ghost', '번개', 'Viper', '민트초코', 'Blaze', '고양이장군', 'Frost',
  '돌격대장', 'Hunter', '산적', 'Shadow', '쿨가이', 'Wolfpack', '백호', 'Phantom', '치킨러버', 'Reaper', '돌멩이', 'Falcon', '해적왕', 'Titan', '감자', 'Nova',
  '붉은용', 'Echo', '초코송이', 'Sniper', '파란눈', 'Storm', '곰돌이', 'Bandit', '밤하늘', 'Cobra', '은하수', 'Rogue', '태풍', 'Jaguar', '마라탕', 'Atlas',
  '무적', 'Spectre', '호랑이', 'Onyx', '라면왕', 'Hawk', '독수리', 'Rex', '참치', 'Zero', '솜사탕', 'Bolt', '흑표범', 'Ace', '도깨비', 'Kilo', '용가리', 'Dusk'];
// 자기장 단계 (반지름은 맵 크기에 맞춰 MAPK 배)
const ZONE_PHASES = [
  { r: 330, wait: 100, shrink: 70, dps: 1 },
  { r: 190, wait: 70, shrink: 55, dps: 2 },
  { r: 105, wait: 55, shrink: 45, dps: 4 },
  { r: 55, wait: 45, shrink: 35, dps: 7 },
  { r: 25, wait: 30, shrink: 25, dps: 10 },
  { r: 0, wait: 20, shrink: 40, dps: 15 }
];
// 전리품: 총은 종류별 가중치 (좋은 총일수록 드묾)
const LOOT_TABLE = [
  ['ar7', 3.2], ['ka47', 3.2], ['sc17', 2], ['mk14', 1.4], ['kr98', 1],
  ['s12', 2.8], ['m1014', 1.8], ['db2', 2.8], ['sa12', 1.6], ['aa12', 0.7],
  ['p92', 2.8], ['g18', 1.8], ['m1911', 2.8], ['de7', 1.4], ['r45', 1.4],
  ['ammo_556', 8], ['ammo_762', 8], ['ammo_9mm', 6], ['ammo_45', 5], ['ammo_12g', 7],
  ['scope_reddot', 3.5], ['scope_holo', 2.8], ['scope_x2', 2.6], ['scope_x4', 1.8], ['scope_x8', 0.9],
  ['frag', 7], ['smoke', 5], ['molotov', 5], ['flash', 5],
  ['bandage', 9], ['medkit', 4], ['vest', 4], ['helmet', 5]];
const LOOT_AMOUNT = { ammo_556: 30, ammo_762: 30, ammo_9mm: 30, ammo_45: 24, ammo_12g: 10, bandage: 2 };
const LOOT_NAMES = { frag: '수류탄', smoke: '연막탄', molotov: '화염병', flash: '섬광탄', bandage: '붕대', medkit: '구급상자', vest: '방탄조끼', helmet: '헬멧' };
for (const k of G.GUN_IDS) LOOT_NAMES[k] = G.WEAPONS[k].name;
for (const t in G.AMMO_NAMES) LOOT_NAMES['ammo_' + t] = G.AMMO_NAMES[t] + ' 탄약';
for (const t in G.SCOPES) LOOT_NAMES['scope_' + t] = G.SCOPES[t].name;
const WEAPON_LABEL = { fists: '주먹', frag: '수류탄', molotov: '화염병', zone: '자기장', fall: '낙하', bleed: '출혈' };
for (const k of G.GUN_IDS) WEAPON_LABEL[k] = G.WEAPONS[k].short;
// 봇이 처음 받는 총: 같은 종류 안에서 낮은 등급일수록 자주
function pickGun(cls) {
  const ids = G.GUN_CLASSES[cls];
  let total = 0; for (const k of ids) total += 1 / G.WEAPONS[k].tier;
  let r = Math.random() * total;
  for (const k of ids) { r -= 1 / G.WEAPONS[k].tier; if (r <= 0) return k; }
  return ids[0];
}
const _v = new V3(), _w = new V3();

const Game = G.Game = {
  state: 'menu', actors: [], teams: [], player: null, loot: [], time: 0, diff: 'normal', teamSize: 1,
  plane: null, zone: null, TEAM_COLORS, LOOT_NAMES, WEAPON_LABEL,

  start(o) {
    this.cleanup();
    this.opts = o;
    this.diff = o.diff; this.teamSize = o.size; this.time = 0; this.ended = false;
    const names = U.shuffle(BOT_NAMES.slice());
    let ni = 0;
    const nTeams = Math.ceil(o.players / o.size);
    let id = 0;
    for (let t = 0; t < nTeams; t++) {
      const team = { id: t, members: [], eliminated: false, rank: 0, kills: 0 };
      this.teams.push(team);
      for (let m = 0; m < o.size; m++) {
        if (t * o.size + m >= o.players) break;
        const isPlayer = t === 0 && m === 0;
        const nm = isPlayer ? (o.name || 'Player') : names[ni++ % names.length] + (ni > names.length ? ni : '');
        const a = new G.Actor({ id: id++, name: nm, team: t, idx: m, isPlayer });
        a.model = new G.CharacterModel({ band: t === 0 && o.size > 1 ? new THREE.Color(TEAM_COLORS[m]).getHex() : null, helmet: false });
        a.model.root.visible = false;
        G.scene.add(a.model.root);
        if (!isPlayer) a.brain = new G.Bot(a);
        this.giveLoadout(a, o.loadout, isPlayer);
        team.members.push(a);
        this.actors.push(a);
      }
    }
    this.player = this.actors[0];
    G.Player.init(this.player);
    this.setupPlane();
    this.setupZone();
    this.spawnLoot();
    this.state = 'playing';
    G.UI.startMatch();
    G.UI.center('수송기 탑승 완료', '원하는 지역 위에서 <b>F</b> 키로 뛰어내리세요', '', 5);
  },
  cleanup() {
    for (const a of this.actors) if (a.model) a.model.dispose();
    this.actors = []; this.teams = [];
    for (const it of this.loot) if (it.mesh) G.scene.remove(it.mesh);
    this.loot = []; this.lootCells = new Map(); this.lootVis = [];
    if (this.plane) { G.scene.remove(this.plane.mesh); this.plane = null; }
    if (this.zone && this.zone.mesh) { G.scene.remove(this.zone.mesh); }
    this.zone = null;
    G.Ballistics.reset(); G.Throwables.reset(); G.FX.reset();
    if (G.Audio.ctx) G.Audio.stopLoops();
    this.state = 'menu';
  },
  giveLoadout(a, lo, isPlayer) {
    const AM = { '556': 90, '762': 60, '12g': 18, '9mm': 45, '45': 32 };
    const am = id => AM[G.WEAPONS[id].ammo];
    const D = G.DEFAULT_GUN;
    if (isPlayer) {
      if (lo === 'all') { a.give(D.rifle, am(D.rifle)); a.give(D.shotgun, am(D.shotgun)); a.give(D.pistol, am(D.pistol)); }
      else if (lo !== 'none') a.give(D[lo], am(D[lo]));
      a.throwables.frag = 1; a.throwables.smoke = 1; a.throwables.molotov = 1; a.throwables.flash = 1;
      a.meds.bandage = 2;
    } else {
      if (lo !== 'none') {
        const r = Math.random(), c = r < 0.45 ? 'rifle' : r < 0.72 ? 'shotgun' : 'pistol';
        const k = pickGun(c);
        a.give(k, Math.round(am(k) * U.rand(0.4, 0.8)));
        if (lo === 'all' && Math.random() < 0.6) { const c2 = U.pick(['rifle', 'shotgun', 'pistol'].filter(x => x !== c)); const k2 = pickGun(c2); a.give(k2, Math.round(am(k2) * 0.5)); }
      }
      if (Math.random() < 0.5) a.throwables.frag = 1;
      if (Math.random() < 0.3) a.throwables.smoke = 1;
      if (Math.random() < 0.2) a.throwables.molotov = 1;
      a.meds.bandage = U.randInt(0, 2);
    }
    a.cur = a.bestGun();
  },

  /* ------------ 수송기 ------------ */
  buildPlaneMesh() {
    const g = G.buildPlane();
    this.props = g.userData.props;
    return g;
  },
  setupPlane() {
    const ang = Math.random() * Math.PI * 2;
    const dir = new V3(Math.cos(ang), 0, Math.sin(ang));
    const perp = new V3(-dir.z, 0, dir.x);
    const K = G.World.HALF / 500;
    const off = U.rand(-170, 170) * K;
    const start = dir.clone().multiplyScalar(-760 * K).addScaledVector(perp, off);
    const mesh = this.buildPlaneMesh();
    mesh.lookAt(dir.clone().multiplyScalar(-1));
    G.scene.add(mesh);
    const alt = 380;
    this.plane = { start, dir, perp, speed: 82 * Math.sqrt(K), t: 0, len: 1520 * K, pos: start.clone().setY(alt), alt, mesh, done: false, K };
    // 봇 팀별 강하 지점
    const W = G.World;
    for (const team of this.teams) {
      if (team.id === this.player.team) {
        for (const m of team.members) if (m.brain) m.brain.jumpAt = 1e9;
        continue;
      }
      let target = null;
      for (let i = 0; i < 30 && !target; i++) {
        let x, z;
        if (Math.random() < 0.7) { const t = U.pick(W.towns); const a = Math.random() * 6.28, r = Math.random() * t.r; x = t.x + Math.cos(a) * r; z = t.z + Math.sin(a) * r; }
        else { x = U.rand(-380, 380) * K; z = U.rand(-380, 380) * K; }
        if (W.heightAt(x, z) - W.waterAt(x, z) < 2) continue;
        const rel = _v.set(x, 0, z).sub(start);
        const along = rel.dot(dir), side = Math.abs(rel.dot(perp));
        if (side > 330 * K || along < 300 * K || along > 1250 * K) continue;
        target = { x, z, along };
      }
      if (!target) target = { x: 0, z: 0, along: 760 * K };
      const jt = U.clamp((target.along - 60) / this.plane.speed + U.rand(-1.5, 1.5), 3.8, (1250 * K - 60) / this.plane.speed);
      for (const m of team.members) {
        m.brain.jumpAt = jt + U.rand(0, 0.8);
        m.brain.dropTarget.set(target.x + U.rand(-14, 14), 0, target.z + U.rand(-14, 14));
      }
    }
  },
  planeCanJump() {
    const p = this.plane;
    return p && !p.done && Math.abs(p.pos.x) < 470 * p.K && Math.abs(p.pos.z) < 470 * p.K;
  },
  updatePlane(dt) {
    const p = this.plane;
    if (!p) return;
    p.t += dt;
    p.pos.copy(p.start).addScaledVector(p.dir, p.speed * p.t).setY(p.alt);
    p.mesh.position.copy(p.pos);
    for (const pr of this.props) pr.rotation.z += dt * 40;
    if (p.mesh.userData.update) p.mesh.userData.update(dt);
    const traveled = p.speed * p.t;
    if (!p.done) {
      const canJump = this.planeCanJump();
      for (const a of this.actors) {
        if (a.state !== 'plane' || !a.alive) continue;
        if (a.brain && canJump && p.t >= a.brain.jumpAt) this.jump(a);
      }
      if (traveled > 1180 * p.K && !canJump) {
        p.done = true;
        for (const a of this.actors) if (a.state === 'plane') this.jump(a, true);
        if (this.player.state !== 'plane') { /* 자동 낙하 */ }
      }
    }
    if (traveled > p.len + 200) p.mesh.visible = false;
  },
  jump(a, forced) {
    if (a.state !== 'plane') return;
    const p = this.plane;
    a.state = 'freefall';
    a.pos.copy(p.pos).add(_v.set(U.rand(-2, 2), -4, U.rand(-2, 2)));
    a.vel.copy(p.dir).multiplyScalar(p.speed * 0.35); a.vel.y = -5;
    a.yaw = Math.atan2(-p.dir.x, -p.dir.z);
    a.model.root.visible = true;
    if (a.isPlayer) {
      G.Player.orbitYaw = a.yaw; G.Player.orbitPitch = -0.25; G.Player.dropT = 0;
      if (forced) G.UI.center('자동 강하', '수송기가 맵을 벗어났습니다', '', 3);
      // 아군 봇은 플레이어를 따라 강하
      for (const m of this.teams[a.team].members) if (m.brain && m.state === 'plane') m.brain.jumpAt = p.t + 0.4 + m.idx * 0.35;
    }
  },
  openChute(a) {
    if (a.state !== 'freefall') return;
    a.state = 'chute';
    a.model.showChute(true);
    if (a.isPlayer) G.Audio.click('chute');
  },
  land(a) {
    a.state = 'ground';
    a.model.showChute(false);
    a.vel.set(0, 0, 0);
    const W = G.World;
    a.pos.y = Math.max(W.ground(a.pos.x, a.pos.z, a.pos.y + 0.5, 0.3, 0.6), a.pos.y);
    a.onGround = true;
  },

  /* ------------ 자기장 ------------ */
  setupZone() {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 160, 1, true);
    const mat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.25, 0.6, 1.6) } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying vec3 vW;
        void main(){
          float h = vUv.y;
          float band = smoothstep(0.0, 0.015, h) * (1.0 - smoothstep(0.35, 1.0, h));
          float st = 0.5 + 0.5 * sin(vUv.x * 1200.0 + vW.y * 0.25 - uTime * 2.0);
          float wave = 0.5 + 0.5 * sin(vW.y * 0.08 - uTime * 1.2 + vUv.x * 40.0);
          float a = (0.16 + 0.1 * st + 0.08 * wave) * band + (1.0 - smoothstep(0.0, 0.03, h)) * 0.25;
          gl_FragColor = vec4(uColor * (0.8 + 0.4 * st), a);
        }`
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 5;
    G.scene.add(mesh);
    this.mapK = G.World.HALF / 500;
    this.zone = { state: 'pre', phase: -1, timer: 40, cur: { x: 0, z: 0, r: 720 * this.mapK }, next: null, from: null, mesh, dps: 0.5, tick: 0 };
    this.updateZoneMesh();
  },
  pickZone(cur, r) {
    const W = G.World;
    for (let i = 0; i < 60; i++) {
      const ang = Math.random() * 6.28, d = Math.sqrt(Math.random()) * Math.max(0, cur.r - r) * 0.92;
      const x = cur.x + Math.cos(ang) * d, z = cur.z + Math.sin(ang) * d;
      if (Math.hypot(x, z) + r * 0.3 > 360 * this.mapK) continue;
      if (W.heightAt(x, z) - W.waterAt(x, z) < 2) continue;
      return { x, z, r };
    }
    return { x: cur.x, z: cur.z, r };
  },
  updateZone(dt) {
    const Z = this.zone;
    Z.timer -= dt;
    if (Z.state === 'pre') {
      if (Z.timer <= 0) this.beginPhase(0);
    } else if (Z.state === 'wait') {
      if (Z.timer <= 0) {
        Z.state = 'shrink'; Z.timer = ZONE_PHASES[Z.phase].shrink; Z.from = Object.assign({}, Z.cur);
        G.UI.center('자기장이 줄어들고 있습니다!', '안전 구역으로 이동하세요', 'zone', 4);
      }
    } else if (Z.state === 'shrink') {
      const P = ZONE_PHASES[Z.phase];
      const k = U.clamp(1 - Z.timer / P.shrink, 0, 1);
      Z.cur.x = U.lerp(Z.from.x, Z.next.x, k); Z.cur.z = U.lerp(Z.from.z, Z.next.z, k); Z.cur.r = U.lerp(Z.from.r, Z.next.r, k);
      if (Z.timer <= 0) {
        Z.cur = Object.assign({}, Z.next);
        if (Z.phase + 1 < ZONE_PHASES.length) this.beginPhase(Z.phase + 1);
        else { Z.state = 'done'; Z.next = null; }
      }
    }
    Z.dps = Z.phase < 0 ? 0.5 : ZONE_PHASES[Z.phase].dps;
    Z.mesh.material.uniforms.uTime.value = this.time;
    this.updateZoneMesh();
    Z.tick -= dt;
    if (Z.tick <= 0) {
      Z.tick = 0.5;
      for (const a of this.actors) {
        if (!a.alive || a.state === 'plane') continue;
        if (Math.hypot(a.pos.x - Z.cur.x, a.pos.z - Z.cur.z) > Z.cur.r) this.damage(a, Z.dps * 0.5, null, 'zone', false, a.pos, null);
      }
    }
  },
  beginPhase(i) {
    const Z = this.zone;
    Z.phase = i; Z.state = 'wait'; Z.timer = ZONE_PHASES[i].wait;
    Z.next = this.pickZone(Z.cur, ZONE_PHASES[i].r * this.mapK);
    G.UI.center('안전 구역이 표시되었습니다', U.fmtTime(Z.timer) + ' 후 자기장이 줄어듭니다', 'zone', 4);
  },
  updateZoneMesh() {
    const Z = this.zone;
    Z.mesh.visible = Z.state !== 'pre';
    Z.mesh.position.set(Z.cur.x, 150, Z.cur.z);
    Z.mesh.scale.set(Math.max(0.5, Z.cur.r), 700, Math.max(0.5, Z.cur.r));
  },
  inZone(p) { const Z = this.zone; return Math.hypot(p.x - Z.cur.x, p.z - Z.cur.z) <= Z.cur.r; },

  /* ------------ 전리품 ------------ */
  rollKind() {
    let total = 0; for (const e of LOOT_TABLE) total += e[1];
    let r = Math.random() * total;
    for (const e of LOOT_TABLE) { r -= e[1]; if (r <= 0) return e[0]; }
    return 'bandage';
  },
  spawnLoot() {
    // 전리품은 건물 안에만 놓인다. 자리마다 반드시 1개, 40% 확률로 1개 더
    const W = G.World;
    const put = (s, k, spread) => this.addLoot(k, LOOT_AMOUNT[k] || 1, _v.set(s.x + U.rand(-spread, spread), s.y, s.z + U.rand(-spread, spread)));
    for (const s of W.lootSpots) {
      const n = Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const k = this.rollKind();
        put(s, k, 0.35);
        const def = G.WEAPONS[k];
        if (def && def.cls && Math.random() < 0.85) put(s, 'ammo_' + def.ammo, 0.6);
      }
    }
  },
  addLoot(kind, amount, pos, extra) {
    const mesh = G.Guns.itemModel(kind);
    mesh.position.copy(pos); mesh.position.y += 0.02;
    mesh.rotation.y = Math.random() * 6.28;
    mesh.visible = false;
    // 움직이지 않으므로 행렬을 한 번만 계산
    mesh.updateMatrixWorld(true);
    mesh.traverse(o => { o.matrixAutoUpdate = false; o.castShadow = false; });
    G.scene.add(mesh);
    const it = { kind, amount, pos: pos.clone(), mesh, taken: false, claim: null };
    const def = G.WEAPONS[kind];
    if (def && def.cls) {
      it.mag = def.mag;
      // 가끔 조준경이 달린 채로 (저격소총·지정사수소총은 더 자주, 높은 배율로)
      const sc = def.scopes.filter(t => t !== def.baseSight);
      const ch = def.key === 'kr98' ? 0.55 : def.key === 'mk14' ? 0.4 : def.cls === 'rifle' ? 0.14 : 0.08;
      if (sc.length && Math.random() < ch) it.scope = def.key === 'kr98' || def.key === 'mk14' ? U.pick(sc.filter(t => G.SCOPES[t].zoom >= 2)) : U.pick(sc);
    }
    if (extra) Object.assign(it, extra);
    this.loot.push(it);
    // 20m 격자에 등록 (주변 전리품만 빠르게 찾기)
    const ck = this.lootKey(Math.floor(pos.x / 20), Math.floor(pos.z / 20));
    let cell = (this.lootCells || (this.lootCells = new Map())).get(ck);
    if (!cell) this.lootCells.set(ck, cell = []);
    cell.push(it);
    return it;
  },
  lootLabel(it) {
    if (it.kind === 'crate') return '<b>' + G.esc(it.owner || '보급') + '</b>의 상자 열기 <small>(' + it.items.length + '개)</small>';
    let s = '<b>' + (LOOT_NAMES[it.kind] || it.kind) + '</b>';
    if (it.scope) s += ' <small>+ ' + G.SCOPES[it.scope].name + '</small>';
    if (it.kind.startsWith('ammo_') || it.kind === 'bandage' || ((G.THROW_NAMES[it.kind]) && it.amount > 1)) s += ' x' + it.amount;
    return s + ' 줍기';
  },
  lootKey(ix, iz) { return (ix + 500) * 1000 + (iz + 500); },
  // (x, z) 주변 r 안의 격자 칸에 든 전리품마다 fn (가져간 것은 칸에서 정리)
  lootAround(x, z, r, fn) {
    if (!this.lootCells) return;
    const x0 = Math.floor((x - r) / 20), x1 = Math.floor((x + r) / 20), z0 = Math.floor((z - r) / 20), z1 = Math.floor((z + r) / 20);
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
      const cell = this.lootCells.get(this.lootKey(ix, iz));
      if (!cell) continue;
      for (let i = 0; i < cell.length; i++) {
        const it = cell[i];
        if (it.taken) { cell[i] = cell[cell.length - 1]; cell.pop(); i--; continue; }
        fn(it);
      }
    }
  },
  lootNear(eye, fwd) {
    let best = null, bs = -1;
    this.lootAround(eye.x, eye.z, 3, (it) => {
      const dx = it.pos.x - eye.x, dy = it.pos.y + 0.15 - eye.y, dz = it.pos.z - eye.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > 2.7) return;
      const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d;
      if (dot < 0.55 && d > 1.4) return;
      const s = dot - d * 0.12;
      if (s > bs) { bs = s; best = it; }
    });
    return best;
  },
  pickup(a, it) {
    if (it.taken) return null;
    const res = a.pickup(it);
    if (it.taken) { G.scene.remove(it.mesh); }
    // 총을 바꿔 들었으면 원래 총을 그 자리에 내려놓는다
    if (a._drop) {
      const d = a._drop; a._drop = null;
      const W = G.World, x = it.pos.x + U.rand(-0.4, 0.4), z = it.pos.z + U.rand(-0.4, 0.4);
      const y = W.ground(x, z, it.pos.y + 0.5, 0.2, 0.6);
      this.addLoot(d.kind, 1, _w.set(x, y, z), { mag: d.mag, scope: d.scope || null }).mesh.visible = true;
    }
    return res;
  },
  updateLoot(dt) {
    const c = G.camera.position;
    // 가까운 전리품의 반짝임 (파티클 1회 드로우로 처리)
    if (this.glowList) {
      const pulse = 0.28 + Math.sin(this.time * 3) * 0.06;
      for (const it of this.glowList) {
        if (it.taken) continue;
        G.FX.add.spawn({ x: it.pos.x, y: it.pos.y + 0.18, z: it.pos.z, life: dt * 1.5, s0: 0.85, r: 1.6, g: 1.3, b: 0.7, a: pulse, fo: 0, rot: 0 });
      }
    }
    this.lootT = (this.lootT || 0) - dt;
    if (this.lootT > 0) return;
    this.lootT = 0.25;
    const glow = this.glowList || (this.glowList = []);
    glow.length = 0;
    // 전리품은 모두 건물 안이라 가까이에서만 보이면 된다 (배율 조준 중에는 더 멀리)
    const R = G.lodZoom > 1 ? 70 : 40;
    const prev = this.lootVis, next = [];
    for (const it of prev) it._v = false;
    if (c.y - G.World.heightAt(c.x, c.z) < 60) {
      this.lootAround(c.x, c.z, R, (it) => {
        const dx = it.pos.x - c.x, dz = it.pos.z - c.z, d2 = dx * dx + dz * dz;
        if (d2 >= R * R) return;
        it._v = true; next.push(it);
        if (!it.mesh.visible) it.mesh.visible = true;
        if (d2 < 28 * 28 && glow.length < 40) glow.push(it);
      });
    }
    for (const it of prev) if (!it._v && it.mesh.visible) it.mesh.visible = false;
    this.lootVis = next;
    // 가져간 전리품은 목록에서 가끔 정리
    if ((this.lootClean = (this.lootClean || 0) + 1) % 40 === 0) this.loot = this.loot.filter(it => !it.taken);
  },

  /* ------------ 피해 / 처치 ------------ */
  damage(t, amount, attacker, weapon, head, point, dir) {
    if (!t.alive || this.state !== 'playing') return;
    if (t.state !== 'ground' && weapon !== 'zone') return;
    if (attacker && attacker !== t && attacker.team === t.team) return;
    let dmg = amount;
    if (weapon !== 'zone' && weapon !== 'fall' && weapon !== 'bleed') {
      if (head && t.helmet) dmg *= 0.6;
      if (!head && t.vest && weapon !== 'molotov') dmg *= 0.7;
    }
    t.lastHurtT = this.time;
    if (attacker && attacker !== t) t.lastAttacker = attacker;
    let result = 'hit';
    if (t.knocked) {
      t.bleed -= dmg * 0.9;
      if (t.bleed <= 0) { this.kill(t, attacker, weapon, head); result = 'kill'; }
    } else {
      const before = t.hp;
      t.hp -= dmg;
      if (attacker && attacker !== t) attacker.dmgDealt += Math.min(dmg, before);
      if (t.hp <= 0) {
        t.hp = 0;
        const mates = this.teams[t.team].members.filter(m => m !== t && m.alive && !m.knocked);
        if (this.teamSize > 1 && mates.length > 0) { this.knock(t, attacker, weapon, head); result = 'knock'; }
        else { this.kill(t, attacker, weapon, head); result = 'kill'; }
      }
    }
    if (attacker === this.player && t !== this.player) { G.UI.hitmarker(head, result !== 'hit'); G.Audio.hit(head, result !== 'hit'); }
    if (t === this.player) {
      if (weapon !== 'zone') { G.UI.hurt(dmg, attacker ? attacker.pos : null); G.Audio.hurt(); G.FX.shake(Math.min(0.4, dmg / 60)); }
      else G.UI.hurt(dmg * 0.3, null);
      if (weapon !== 'zone') G.Player.cancelHeal();
    }
    if (t.model && weapon !== 'zone') t.model.flinch = 1;
    if (t.brain && attacker) t.brain.onHurt(attacker);
  },
  knock(t, attacker, weapon, head) {
    t.knocked = true; t.bleed = 100; t.knockedBy = attacker || null; t.crouch = false;
    t.vel.set(0, t.vel.y, 0);
    if (t.brain) { t.brain.healing = null; t.brain.reviving = null; }
    G.UI.killfeed(attacker, t, weapon, head, true);
    if (attacker === this.player) G.UI.killMsg('적을 기절시켰습니다', t.name, true);
    if (t === this.player) { G.UI.center('기절했습니다!', '팀원이 소생시켜 줄 때까지 버티세요', '', 3); G.Player.onKnock && G.Player.onKnock(); }
    this.checkTeam(t.team);
  },
  kill(t, attacker, weapon, head) {
    if (!t.alive) return;
    if ((!attacker || attacker === t) && t.knockedBy && t.knockedBy.alive !== undefined) attacker = t.knockedBy;
    t.alive = false; t.knocked = false; t.hp = 0; t.deathTime = this.time;
    t.vel.set(0, 0, 0);
    if (attacker && attacker !== t && attacker.team !== t.team) { attacker.kills++; this.teams[attacker.team].kills++; }
    G.UI.killfeed(attacker, t, weapon, head, false);
    // 상자 드롭
    const items = t.dropAll();
    if (items.length) {
      const W = G.World;
      const y = W.ground(t.pos.x, t.pos.z, t.pos.y + 0.5, 0.2, 0.6);
      this.addLoot('crate', 1, _w.set(t.pos.x + 0.6, y, t.pos.z), { items, owner: t.name });
    }
    if (attacker === this.player && t !== this.player) G.UI.killMsg('적을 처치했습니다', t.name + (head ? ' · 헤드샷' : ''), false, this.player.kills);
    if (t === this.player) { G.Player.onDeath(); G.UI.center('사망했습니다', attacker && attacker !== t ? G.esc(attacker.name) + '에게 처치됨' : '', '', 3); }
    this.checkTeam(t.team);
  },
  revive(t, by) {
    if (!t.alive || !t.knocked) return;
    t.knocked = false; t.hp = 25; t.bleed = 100; t.knockedBy = null;
    G.UI.feedMsg(G.esc(by.name) + ' 님이 ' + G.esc(t.name) + ' 님을 소생시켰습니다');
    if (t === this.player) G.UI.center('소생되었습니다', '', '', 2);
  },
  checkTeam(teamId) {
    const team = this.teams[teamId];
    if (team.eliminated) return;
    const standing = team.members.filter(m => m.alive && !m.knocked);
    if (standing.length === 0) {
      team.eliminated = true;
      for (const m of team.members) if (m.alive) this.kill(m, m.knockedBy, 'bleed', false);
      team.rank = this.teams.filter(t => !t.eliminated).length + 1;
      if (teamId === this.player.team && !this.ended) { this.ended = true; setTimeout(() => this.finish(false), 3000); }
    }
    const alive = this.teams.filter(t => !t.eliminated);
    if (alive.length <= 1 && !this.ended) {
      this.ended = true;
      if (alive.length === 1) alive[0].rank = 1;
      const win = alive.length === 1 && alive[0].id === this.player.team;
      if (win) G.UI.center('최후의 생존자!', '모든 적을 물리쳤습니다', 'win', 4);
      setTimeout(() => this.finish(win), win ? 2500 : 3000);
    }
  },
  finish(win) {
    if (this.state !== 'playing') return;
    this.state = 'ended';
    const team = this.teams[this.player.team];
    const rank = win ? 1 : (team.rank || this.teams.filter(t => !t.eliminated).length + 1);
    G.UI.showResults({ win, rank, teams: this.teams.length, kills: this.player.kills, dmg: Math.round(this.player.dmgDealt), time: this.player.alive ? this.time : this.player.deathTime, teamKills: team.kills });
    G.Input.unlock();
    G.Audio.stopLoops();
  },
  onShot(shooter, def) {
    const range = def.key === 'kr98' || def.key === 'mk14' ? 200 : def.cls === 'rifle' ? 130 : def.cls === 'shotgun' ? 100 : 75;
    this.onNoise(shooter.pos, range, shooter);
  },
  onNoise(pos, range, owner) {
    for (const a of this.actors) {
      if (!a.brain || !a.alive || a.state !== 'ground' || (owner && a.team === owner.team)) continue;
      const dx = a.pos.x - pos.x, dz = a.pos.z - pos.z;
      if (dx * dx + dz * dz < range * range) a.brain.hear(pos);
    }
  },
  aliveCount() { let n = 0; for (const a of this.actors) if (a.alive) n++; return n; },
  teamsAlive() { let n = 0; for (const t of this.teams) if (!t.eliminated) n++; return n; },

  update(dt) {
    if (this.state !== 'playing' && this.state !== 'ended') return;
    this.time += dt;
    this.updatePlane(dt);
    if (this.state === 'playing') G.Player.update(dt);
    for (const a of this.actors) if (a.brain) a.brain.update(dt);
    // 출혈
    for (const a of this.actors) {
      if (a.alive && a.knocked) { a.bleed -= dt * 2.6; if (a.bleed <= 0) this.kill(a, a.knockedBy, 'bleed', false); }
    }
    // 겹침 해소
    const A = this.actors;
    for (let i = 0; i < A.length; i++) {
      const a = A[i]; if (!a.alive || a.state !== 'ground') continue;
      for (let j = i + 1; j < A.length; j++) {
        const b = A[j]; if (!b.alive || b.state !== 'ground') continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < 0.5 && d2 > 1e-6 && Math.abs(a.pos.y - b.pos.y) < 1.5) {
          const d = Math.sqrt(d2), push = (0.707 - d) * 0.5;
          a.pos.x -= dx / d * push; a.pos.z -= dz / d * push; b.pos.x += dx / d * push; b.pos.z += dz / d * push;
        }
      }
    }
    this.syncModels(dt);
    G.Ballistics.update(dt);
    G.Throwables.update(dt);
    if (this.zone) this.updateZone(dt);
    this.updateLoot(dt);
  },
  syncModels(dt) {
    const cam = G.camera.position, P = G.Player;
    for (const a of this.actors) {
      const m = a.model;
      if (a.state === 'plane') { m.root.visible = false; continue; }
      const dx = a.pos.x - cam.x, dz = a.pos.z - cam.z, d2 = dx * dx + dz * dz;
      const far = P.scopeView > 0.5 ? 620 : 380;   // 배율 조준 중에는 더 멀리까지 보인다
      let vis = d2 < (a.alive ? far * far : 160 * 160);
      if (a.isPlayer && a.alive && P.camMode === 'fp') vis = false;
      if (m.root.visible !== vis) m.root.visible = vis;
      if (a.isPlayer && a.alive && P.camMode === 'fp') { m.root.position.copy(a.pos); }
      if (!vis) continue;
      m.root.position.copy(a.pos);
      m.root.rotation.y = a.yaw;
      m.update(dt, { speed: a.hspeed, pitch: a.pitch, crouch: a.crouch, knocked: a.knocked, dead: !a.alive, state: a.state, cur: a.cur, gun: a.gunId(a.cur), onGround: a.onGround });
      m.showChute(a.state === 'chute' && a.alive);
      m.setHelmet(a.helmet);
      // 45m 밖은 병합된 LOD 메시 1개로, 그림자는 40m 안쪽만
      m.setLOD(d2 > 45 * 45, a.crouch && a.alive && !a.knocked);
      const sh = d2 < 40 * 40;
      if (m._sh !== sh) { m._sh = sh; m.setShadows(sh); }
    }
  }
};

})();
