// extras.js — 피해 숫자, 전적·업적, 보급 상자 투하, 날씨(비·손전등)
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;
const _v = new V3(), _p = new V3(), _d = new V3();
const $ = id => document.getElementById(id);

/* ------------------------------------------------------------------ */
/* 피해 숫자 (실전): 맞힌 곳에서 떠오른다. 산탄처럼 한꺼번에 맞으면 합쳐서 보여 준다 */
/* ------------------------------------------------------------------ */
const Nums = G.Nums = {
  list: [],
  layer() { if (!this.el) { this.el = document.createElement('div'); this.el.id = 'hitNums'; $('hud').appendChild(this.el); } return this.el; },
  reset() { for (const n of this.list) n.el.remove(); this.list = []; },
  add(target, pos, dmg, head, kill, armored) {
    const last = this.list[this.list.length - 1];
    let n = last && last.target === target && last.t < 0.12 ? last : null;
    if (!n) {
      const el = document.createElement('div');
      this.layer().appendChild(el);
      n = { el, target, pos: pos.clone(), t: 0, dmg: 0, dx: (Math.random() - 0.5) * 30 };
      this.list.push(n);
      if (this.list.length > 16) this.list.shift().el.remove();
    }
    n.dmg += dmg; n.head = n.head || head; n.kill = n.kill || kill;
    n.el.className = 'dn' + (n.head ? ' head' : '') + (n.kill ? ' kill' : '') + (armored && !n.kill ? ' armor' : '');
    n.el.textContent = Math.max(1, Math.round(n.dmg));
  },
  update(dt) {
    if (!this.list.length) return;
    const cam = G.camera, W = innerWidth, H = innerHeight;
    cam.updateMatrixWorld();
    for (let i = 0; i < this.list.length; i++) {
      const n = this.list[i];
      n.t += dt;
      if (n.t > 1) { n.el.remove(); this.list.splice(i--, 1); continue; }
      _p.copy(n.pos).applyMatrix4(cam.matrixWorldInverse);
      if (_p.z > -0.2) { n.el.style.display = 'none'; continue; }
      _p.copy(n.pos).project(cam);
      const k = n.t;
      n.el.style.display = 'block';
      n.el.style.transform = `translate(${(_p.x + 1) / 2 * W + n.dx * k}px, ${(1 - _p.y) / 2 * H - 16 - 50 * k}px) translate(-50%, -50%) scale(${n.t < 0.08 ? 1.5 - n.t * 6 : 1})`;
      n.el.style.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
  }
};

/* ------------------------------------------------------------------ */
/* 전적·업적 (브라우저 저장)                                             */
/* ------------------------------------------------------------------ */
const ACH = [
  ['first_win', '첫 승리', '최후의 생존자가 되기'],
  ['kills5', '사냥꾼', '한 판에 5명 처치'],
  ['kills10', '학살자', '한 판에 10명 처치'],
  ['sniper', '장거리 저격', '200m 이상 거리에서 처치'],
  ['headhunter', '헤드헌터', '헤드샷 처치 누적 25회'],
  ['marksman', '명사수', '한 판 명중률 50% 이상 (20발 이상)'],
  ['survivor', '생존 전문가', '3위 안에 5번 들기'],
  ['veteran', '베테랑', '10판 플레이'],
  ['roadkill', '뺑소니', '차량으로 적 처치'],
  ['airdrop', '보급 수령', '보급 상자 열기']
];
const Stats = G.Stats = {
  KEY: 'lastzone_stats', ACH,
  data: { matches: 0, wins: 0, top3: 0, kills: 0, heads: 0, dmg: 0, shots: 0, hits: 0, bestKills: 0, longest: 0, bestRank: 0, time: 0, ach: {} },
  m: null, fresh: [],
  load() {
    try { const s = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (s) Object.assign(this.data, s, { ach: Object.assign({}, s.ach) }); } catch (e) { /* 저장소 사용 불가 */ }
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* 무시 */ } },
  begin() { this.m = { shots: 0, hits: 0, heads: 0, longest: 0 }; this.fresh = []; },
  unlock(id) {
    if (this.data.ach[id]) return;
    const a = ACH.find(x => x[0] === id); if (!a) return;
    this.data.ach[id] = Date.now(); this.fresh.push(a[1]); this.save();
    if (G.Game.state === 'playing') G.UI.feedMsg('<b style="color:#ffcf3a">업적 달성</b> ' + a[1]);
  },
  // 명중은 한 발(산탄은 한 번의 격발)에 한 번만 센다
  onShot() { if (this.m && !G.Game.training) { this.m.shots++; this.open = true; } },
  onHit() { if (this.m && !G.Game.training && this.open) { this.m.hits++; this.open = false; } },
  onKill(dist, head, weapon) {
    if (!this.m || G.Game.training) return;
    if (head) { this.m.heads++; this.data.heads++; if (this.data.heads >= 25) this.unlock('headhunter'); }
    if (weapon !== 'vehicle' && G.WEAPONS[weapon] && G.WEAPONS[weapon].cls) {
      this.m.longest = Math.max(this.m.longest, dist);
      if (dist >= 200) this.unlock('sniper');
    }
    if (weapon === 'vehicle') this.unlock('roadkill');
    const k = G.Game.player.kills;
    if (k >= 5) this.unlock('kills5');
    if (k >= 10) this.unlock('kills10');
  },
  // 매치 종료: 누적 기록에 더하고 결과 화면용 값을 돌려준다
  end(r) {
    const d = this.data, m = this.m || { shots: 0, hits: 0, heads: 0, longest: 0 };
    d.matches++; d.kills += r.kills; d.dmg += r.dmg; d.shots += m.shots; d.hits += m.hits; d.time += r.time;
    if (r.win) { d.wins++; this.unlock('first_win'); }
    if (r.rank <= 3) { d.top3++; if (d.top3 >= 5) this.unlock('survivor'); }
    if (d.matches >= 10) this.unlock('veteran');
    const acc = m.shots ? m.hits / m.shots : 0;
    if (m.shots >= 20 && acc >= 0.5) this.unlock('marksman');
    const best = r.kills > d.bestKills && d.matches > 1;
    d.bestKills = Math.max(d.bestKills, r.kills); d.longest = Math.max(d.longest, m.longest);
    if (!d.bestRank || r.rank < d.bestRank) d.bestRank = r.rank;
    this.save();
    const out = { acc, heads: m.heads, longest: m.longest, best, fresh: this.fresh.slice() };
    this.m = null;
    return out;
  },
  html() {
    const d = this.data, pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
    const cell = (k, v) => '<div><span>' + k + '</span><b>' + v + '</b></div>';
    let h = '<div class="st-grid">' + cell('플레이', d.matches + '판') + cell('승리', d.wins + '회 · ' + pct(d.wins, d.matches)) + cell('3위 이내', d.top3 + '회') +
      cell('처치', d.kills + ' · 판당 ' + (d.matches ? (d.kills / d.matches).toFixed(1) : '-')) + cell('한 판 최다 처치', d.bestKills) + cell('명중률', pct(d.hits, d.shots)) +
      cell('헤드샷 처치', d.heads) + cell('최장 처치 거리', Math.round(d.longest) + 'm') + cell('총 피해량', Math.round(d.dmg)) + '</div><div class="st-ach">';
    for (const a of ACH) h += '<div class="' + (d.ach[a[0]] ? 'on' : '') + '"><b>' + a[1] + '</b><small>' + a[2] + '</small></div>';
    return h + '</div>';
  },
  initUI() {
    this.load();
    const btn = $('statsBtn'), panel = $('statsPanel');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => { $('statsBody').innerHTML = this.html(); panel.classList.remove('hidden'); G.Audio.init(); G.Audio.click('ui'); });
    $('statsClose').addEventListener('click', () => panel.classList.add('hidden'));
    $('statsReset').addEventListener('click', () => {
      if (!confirm('전적과 업적을 모두 지울까요?')) return;
      this.data = { matches: 0, wins: 0, top3: 0, kills: 0, heads: 0, dmg: 0, shots: 0, hits: 0, bestKills: 0, longest: 0, bestRank: 0, time: 0, ach: {} };
      this.save(); $('statsBody').innerHTML = this.html();
    });
  }
};

/* ------------------------------------------------------------------ */
/* 보급 상자 투하: 수송기가 안전 구역 위를 지나며 낙하산 상자를 떨어뜨린다      */
/* ------------------------------------------------------------------ */
const DROP_GUNS = [['aa12', null], ['kr98', 'x8'], ['mk14', 'x4'], ['sc17', 'x4']];
const Airdrop = G.Airdrop = {
  drops: [], plane: null, next: 0, count: 0,
  reset() {
    for (const d of this.drops) { if (d.mesh) G.scene.remove(d.mesh); if (d.box) { d.box.minY = d.box.maxY = -1e6; d.box.minX = d.box.maxX = d.box.minZ = d.box.maxZ = 1e7; } }
    this.drops = [];
    if (this.plane) { G.scene.remove(this.plane.mesh); this.plane = null; if (G.Audio.ctx) G.Audio.setLoop('airdrop', 0); }
    this.next = 150; this.count = 0;
  },
  crateMesh() {
    if (!this.geo) {
      const box = (w, h, d, x, y, z, c) => { const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed(); const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
      const parts = [box(1.5, 0.95, 1.1, 0, 0.475, 0, 0x7a1f1a), box(1.54, 0.1, 1.14, 0, 0.95, 0, 0x4a120f), box(1.54, 0.08, 1.14, 0, 0.04, 0, 0x4a120f)];
      for (const x of [-0.5, 0, 0.5]) parts.push(box(0.1, 0.97, 1.13, x, 0.475, 0, 0xd8d2c0));
      this.geo = THREE.mergeGeometries(parts);
      // 낙하산: 반구 + 줄
      const dome = new THREE.SphereGeometry(2.6, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.55, 1).translate(0, 4.6, 0);
      this.chuteGeo = dome;
      this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
      this.chuteMat = new THREE.MeshStandardMaterial({ color: 0xc8482e, roughness: 0.9, side: THREE.DoubleSide });
      this.lineMat = new THREE.LineBasicMaterial({ color: 0x222222 });
      const lp = [];
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; lp.push(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.45, Math.cos(a) * 2.55, 4.62, Math.sin(a) * 2.55); }
      this.lineGeo = new THREE.BufferGeometry(); this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lp), 3));
    }
    const g = new THREE.Group();
    const crate = new THREE.Mesh(this.geo, this.mat); crate.castShadow = true; g.add(crate);
    const chute = new THREE.Group();
    chute.add(new THREE.Mesh(this.chuteGeo, this.chuteMat), new THREE.LineSegments(this.lineGeo, this.lineMat));
    g.add(chute); g.userData.chute = chute;
    return g;
  },
  // 투하 지점: 다음 안전 구역(없으면 현재 구역) 안의 땅
  pickSpot() {
    const Game = G.Game, Z = Game.zone, W = G.World;
    const c = Z && (Z.next || Z.cur);
    for (let i = 0; i < 40; i++) {
      const r = c ? Math.min(c.r * 0.7, 260) : 200, a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r;
      const x = (c ? c.x : 0) + Math.cos(a) * d, z = (c ? c.z : 0) + Math.sin(a) * d;
      if (W.heightAt(x, z) - W.waterAt(x, z) < 1.5) continue;
      if (W.covered(x, W.heightAt(x, z) + 30, z)) continue;
      _v.set(x, W.heightAt(x, z) + 60, z);
      if (W.raycast(_v, _d.set(0, -1, 0), 59.5, true)) continue;   // 건물 지붕 위는 피한다
      return { x, z };
    }
    return null;
  },
  call() {
    const s = this.pickSpot(); if (!s) return false;
    const W = G.World, ang = Math.random() * 6.28, dir = new V3(Math.cos(ang), 0, Math.sin(ang)), span = W.HALF * 1.5;
    const mesh = G.buildPlane();
    mesh.lookAt(dir.clone().multiplyScalar(-1));
    G.scene.add(mesh);
    const alt = Math.max(230, W.heightAt(s.x, s.z) + 190);
    this.plane = { mesh, dir, t: 0, speed: 75, start: new V3(s.x, alt, s.z).addScaledVector(dir, -span), len: span * 2, drop: span, target: s, dropped: false, pos: new V3() };
    this.count++;
    G.UI.center('보급 상자 투하', '수송기가 안전 구역으로 접근 중입니다 · <b>M</b> 지도에 표시', 'zone', 4);
    return true;
  },
  contents() {
    const [gun, scope] = U.pick(DROP_GUNS), def = G.WEAPONS[gun];
    const items = [{ kind: gun, mag: def.mag, scope, amount: 1 }, { kind: 'ammo_' + def.ammo, amount: def.cls === 'shotgun' ? 30 : 90 },
      { kind: 'vest', level: 3, amount: 1 }, { kind: 'helmet', level: 3, amount: 1 }, { kind: 'bag', level: 3, amount: 1 },
      { kind: 'medkit', amount: 1 }, { kind: 'medkit', amount: 1 }, { kind: 'frag', amount: 2 }];
    for (const it of items) it.taken = false;
    return items;
  },
  update(dt) {
    const Game = G.Game, W = G.World;
    if (Game.training || Game.state !== 'playing' && !Game.spectating) return;
    // 일정: 2분 30초부터 약 2분 40초마다, 최대 4번
    if (!this.plane && this.count < 4 && Game.time >= this.next && Game.zone && Game.zone.state !== 'done') { if (this.call()) this.next = Game.time + 160; else this.next = Game.time + 10; }
    const P = this.plane;
    if (P) {
      P.t += dt;
      const s = P.speed * P.t;
      P.pos.copy(P.start).addScaledVector(P.dir, s);
      P.mesh.position.copy(P.pos);
      for (const pr of (P.mesh.userData.props || [])) pr.rotation.z += dt * 40;
      if (P.mesh.userData.update) P.mesh.userData.update(dt);
      G.Audio.setLoop('airdrop', 0.55, P.pos, 150);
      if (!P.dropped && s >= P.drop) {
        P.dropped = true;
        const mesh = this.crateMesh();
        mesh.position.set(P.target.x, P.pos.y - 6, P.target.z);
        G.scene.add(mesh);
        this.drops.push({ mesh, x: P.target.x, z: P.target.z, y: P.pos.y - 6, vy: -22, landed: false, smoke: 0, life: 0, item: null, box: null });
      }
      if (s > P.len) { G.scene.remove(P.mesh); this.plane = null; G.Audio.setLoop('airdrop', 0); }
    }
    const cam = G.camera.position;
    for (const d of this.drops) {
      d.smoke -= dt;
      if (!d.landed) {
        // 낙하산이 펴지며 감속
        d.vy = U.damp(d.vy, -7.5, 1.6, dt);
        d.y += d.vy * dt;
        const g = W.ground(d.x, d.z, d.y + 0.5, 0.6, 0.6);
        d.mesh.position.y = d.y; d.mesh.rotation.z = Math.sin(Game.time * 1.3) * 0.06;
        if (d.y <= g) {
          d.landed = true; d.y = g;
          d.mesh.position.y = g; d.mesh.rotation.z = 0;
          d.mesh.userData.chute.visible = false;
          d.mesh.updateMatrixWorld(true);
          // 실제 전리품 (상자 열기)
          d.item = Game.addLoot('crate', 1, _v.set(d.x, g + 0.3, d.z), { items: this.contents(), owner: '보급', airdrop: true });
          d.box = W.addCollider(d.x - 0.75, g, d.z - 0.55, d.x + 0.75, g + 1.0, d.z + 0.55, 'wood');
          G.Audio.click('land');
          if (Math.hypot(cam.x - d.x, cam.z - d.z) < 400) G.UI.feedMsg('보급 상자가 착지했습니다');
        }
      } else d.life += dt;
      // 빨간 연막 (착지 후 90초)
      if (d.smoke <= 0 && d.life < 90 && Math.hypot(cam.x - d.x, cam.z - d.z) < 600) {
        d.smoke = 0.12;
        G.FX.norm.spawn({ x: d.x + (Math.random() - 0.5) * 0.4, y: d.y + 1.1, z: d.z + (Math.random() - 0.5) * 0.4, vx: 0.5 + (Math.random() - 0.5) * 0.5, vy: 2.2 + Math.random(), vz: (Math.random() - 0.5) * 0.5,
          life: 7 + Math.random() * 3, s0: 0.5, s1: 5 + Math.random() * 2, r: 0.85, g: 0.12, b: 0.1, a: 0.5, drag: 0.25, grav: -0.15, vr: (Math.random() - 0.5) * 0.6, fin: 0.06 });
      }
    }
  },
  // 지도 표시
  draw(ctx, toS, scale) {
    const mark = (x, z, col) => {
      const [sx, sy] = toS(x, z);
      ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(sx - 5 * scale, sy - 4 * scale, 10 * scale, 8 * scale); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy - 6 * scale, 5 * scale, Math.PI, 0); ctx.stroke();
    };
    if (this.plane && !this.plane.dropped) mark(this.plane.target.x, this.plane.target.z, 'rgba(255,90,70,0.55)');
    for (const d of this.drops) if (!d.item || !d.item.taken) mark(d.x, d.z, '#ff5a46');
  }
};

/* ------------------------------------------------------------------ */
/* 날씨: 빗줄기(카메라 주변 선분), 빗소리, 손전등(L)                         */
/* ------------------------------------------------------------------ */
const Weather = G.Weather = {
  rain: null, rainAmt: 0, light: null, lightOn: false,
  init(scene) {
    const N = 1400, pos = new Float32Array(N * 6), end = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = Math.random() * 44, y = Math.random() * 30, z = Math.random() * 44;
      pos.set([x, y, z, x, y, z], i * 6); end[i * 2] = 0; end[i * 2 + 1] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uCam: { value: new V3() }, uAmt: { value: 0 }, uCol: { value: new THREE.Color(0.75, 0.8, 0.88) } },
      vertexShader: `uniform float uTime; uniform vec3 uCam; attribute float aEnd; varying float vA;
        void main(){
          vec3 box = vec3(44.0, 30.0, 44.0);
          vec3 p = position; p.y -= uTime * 26.0; p.x += uTime * 3.0;
          p = mod(p - uCam, box) - box * 0.5 + uCam;
          p += vec3(0.1, 0.85, 0.0) * aEnd;
          vA = 1.0 - aEnd * 0.7;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uAmt; uniform vec3 uCol; varying float vA;
        void main(){
          gl_FragColor = vec4(uCol, 0.32 * uAmt * vA);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    this.rain = new THREE.LineSegments(geo, this.mat);
    this.rain.frustumCulled = false; this.rain.renderOrder = 4; this.rain.visible = false;
    scene.add(this.rain);
    // 손전등: 항상 장면에 두고 세기만 바꾼다 (조명 개수가 바뀌면 셰이더를 다시 컴파일하므로)
    this.light = new THREE.SpotLight(0xfff2d8, 0, 60, 0.42, 0.55, 1.4);
    scene.add(this.light); scene.add(this.light.target);
  },
  update(dt) {
    const W = G.World, Game = G.Game, P = G.Player, cam = G.camera;
    const raining = W.weather === 'rain' && Game.state !== 'menu';
    const indoor = P && P.camMode === 'fp' ? P.indoor : 0;
    this.rainAmt = U.damp(this.rainAmt, raining ? 1 - indoor * 0.75 : 0, 3, dt);
    this.rain.visible = this.rainAmt > 0.02;
    if (this.rain.visible) { const u = this.mat.uniforms; u.uTime.value += dt; u.uCam.value.copy(cam.position); u.uAmt.value = this.rainAmt; }
    if (G.Audio.ctx) G.Audio.setLoop('rain', raining && !G.paused ? 0.22 * (1 - indoor * 0.55) : 0);
    // 손전등
    const a = Game.player, can = Game.state === 'playing' && a && a.alive && a.state === 'ground' && P.camMode === 'fp';
    if (can && G.Input.hit('KeyL')) { this.lightOn = !this.lightOn; G.Audio.click('switch'); }
    const on = can && this.lightOn && !a.knocked;
    this.light.intensity = U.damp(this.light.intensity, on ? 260 : 0, 18, dt);
    if (this.light.intensity > 0.5) {
      cam.getWorldDirection(_d);
      this.light.position.copy(cam.position).addScaledVector(_d, 0.2); this.light.position.y -= 0.12;
      this.light.target.position.copy(cam.position).addScaledVector(_d, 12);
      this.light.target.updateMatrixWorld();
    }
  }
};

G.Extras = {
  init(scene) { Weather.init(scene); Stats.initUI(); },
  reset() { Nums.reset(); Airdrop.reset(); Weather.lightOn = false; if (G.Vehicles) G.Vehicles.reset(); },
  update(dt) { Airdrop.update(dt); if (G.Vehicles) G.Vehicles.update(dt); Nums.update(dt); }
};

})();
