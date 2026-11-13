// vehicles.js — 탈 수 있는 차량 (지프): F 탑승/하차, WASD 운전, Space 브레이크
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;
const _f = new V3(), _r = new V3(), _c = new V3(), _e = new V3(), _d = new V3();
const _support = new V3();
const HALF_L = 1.9, HALF_W = 0.95, MAX = 21, REV = 6;

function build() {
  const col = (g, c) => { g = g.toNonIndexed(); const k = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const bx = (w, h, d, x, y, z, c) => col(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
  const body = 0x4d5a3a, dark = 0x23261f, glass = 0x10151a;
  const parts = [
    bx(1.85, 0.5, 3.8, 0, 0.75, 0, body), bx(1.7, 0.28, 1.25, 0, 1.12, -1.2, body),               // 차체, 보닛
    bx(1.78, 0.72, 1.9, 0, 1.36, 0.45, body), bx(1.6, 0.5, 0.05, 0, 1.4, -0.52, glass),           // 캐빈, 앞유리
    bx(0.05, 0.42, 1.5, -0.9, 1.42, 0.45, glass), bx(0.05, 0.42, 1.5, 0.9, 1.42, 0.45, glass), bx(1.5, 0.42, 0.05, 0, 1.42, 1.41, glass),
    bx(1.95, 0.16, 0.2, 0, 0.6, -1.95, dark), bx(1.95, 0.16, 0.2, 0, 0.6, 1.95, dark),             // 범퍼
    bx(0.3, 0.18, 0.06, -0.62, 0.95, -1.91, 0xfff6d0), bx(0.3, 0.18, 0.06, 0.62, 0.95, -1.91, 0xfff6d0),
    bx(0.3, 0.14, 0.06, -0.62, 0.9, 1.91, 0xb01c14), bx(0.3, 0.14, 0.06, 0.62, 0.9, 1.91, 0xb01c14),
    bx(0.5, 0.5, 0.2, 0, 1.2, 2.0, dark)                                                           // 예비 타이어
  ];
  for (const [x, z] of [[-0.95, -1.25], [0.95, -1.25], [-0.95, 1.25], [0.95, 1.25]])
    parts.push(col(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14).rotateZ(Math.PI / 2).translate(x, 0.42, z), 0x17181a));
  return THREE.mergeGeometries(parts);
}

const Vh = G.Vehicles = {
  list: [], geo: null, mat: null,
  reset() {
    for (const v of this.list) { G.scene.remove(v.mesh); this.unblock(v); }
    this.list = [];
    if (G.Audio.ctx) { G.Audio.setLoop('engine', 0); G.Audio.setLoop('engineBot', 0); }
  },
  spawn(n) {
    const W = G.World;
    if (!this.geo) { this.geo = build(); this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }); }
    let tries = 0;
    while (this.list.length < n && tries++ < n * 30) {
      // 도로 옆에 세워 둔다
      const rd = U.pick(W.roads), t = Math.random(), dx = rd.bx - rd.ax, dz = rd.bz - rd.az, L = Math.hypot(dx, dz) || 1;
      const side = (Math.random() < 0.5 ? -1 : 1) * (rd.w * 0.5 + 2.2);
      const x = rd.ax + dx * t - dz / L * side, z = rd.az + dz * t + dx / L * side;
      if (Math.abs(x) > W.HALF - 30 || Math.abs(z) > W.HALF - 30) continue;
      const y = W.heightAt(x, z);
      if (y - W.waterAt(x, z) < 0.6) continue;
      if (Math.abs(W.heightAt(x + 2, z) - y) > 0.7 || Math.abs(W.heightAt(x, z + 2) - y) > 0.7) continue;
      let blocked = false;
      W.queryBoxes(x - 2.6, z - 2.6, x + 2.6, z + 2.6, b => { if (b.maxY > y + 0.3 && b.minY < y + 2) blocked = true; });
      if (blocked || this.list.some(v => Math.hypot(v.pos.x - x, v.pos.z - z) < 40)) continue;
      const mesh = new THREE.Mesh(this.geo, this.mat);
      mesh.castShadow = true; mesh.rotation.order = 'YXZ';
      G.scene.add(mesh);
      const v = { mesh, pos: new V3(x, y, z), yaw: Math.atan2(-dx, -dz) + (Math.random() < 0.5 ? Math.PI : 0), speed: 0, steer: 0, pitch: 0, roll: 0, driver: null, box: null, hitT: new Map(), noiseT: 0 };
      this.list.push(v); this.place(v, 1); this.block(v);
    }
  },
  // 정해진 자리에 한 대 (훈련장 운전 코스)
  spawnAt(x, z, yaw) {
    const W = G.World;
    if (!this.geo) { this.geo = build(); this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }); }
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.castShadow = true; mesh.rotation.order = 'YXZ';
    G.scene.add(mesh);
    const v = { mesh, pos: new V3(x, W.heightAt(x, z), z), yaw, speed: 0, steer: 0, pitch: 0, roll: 0, driver: null, box: null, hitT: new Map(), noiseT: 0, home: { x, z, yaw } };
    this.list.push(v); this.place(v, 1); this.block(v);
    return v;
  },
  // 세워 둔 차는 충돌 상자를 둔다 (걸어서 통과·총알 관통 방지). 회전을 감안해 조금 줄인 축 정렬 상자
  block(v) {
    const c = Math.abs(Math.cos(v.yaw)), s = Math.abs(Math.sin(v.yaw));
    const hx = HALF_W * c + HALF_L * s - 0.25 * Math.min(c, s) * 2, hz = HALF_W * s + HALF_L * c - 0.25 * Math.min(c, s) * 2;
    v.box = G.World.addCollider(v.pos.x - hx, v.pos.y, v.pos.z - hz, v.pos.x + hx, v.pos.y + 1.7, v.pos.z + hz, 'metal', true);
  },
  unblock(v) { G.World.removeCollider(v.box); v.box = null; },
  place(v, k) {
    const W = G.World;
    _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    const ground = (x, z) => Math.max(W.heightAt(x, z), W.waterAt(x, z) - 0.9);
    const h = (ox, oz) => ground(v.pos.x + _f.x * oz + _r.x * ox, v.pos.z + _f.z * oz + _r.z * ox);
    const hf = h(0, 1.4), hb = h(0, -1.4), hl = h(-0.9, 0), hr = h(0.9, 0);
    const pitch = Math.atan2(hf - hb, 2.8), roll = Math.atan2((hr - hl) * Math.cos(pitch), 1.8);
    v.pitch = U.lerp(v.pitch, pitch, k); v.roll = U.lerp(v.roll, roll, k);
    v.mesh.rotation.set(v.pitch, v.yaw, v.roll);
    // Support the tilted wheel treads instead of sinking the uphill wheels into the terrain.
    let supportY = -Infinity;
    for (const x of [-0.95, 0.95]) for (const z of [-1.25, 1.25]) {
      _support.set(x, 0, z).applyQuaternion(v.mesh.quaternion);
      supportY = Math.max(supportY, ground(v.pos.x + _support.x, v.pos.z + _support.z) - _support.y);
    }
    v.pos.y = Math.max(supportY, U.lerp(v.pos.y, supportY, k));
    v.mesh.position.copy(v.pos);
    v.mesh.updateMatrixWorld(true);
  },
  near(a) {
    let best = null, bd = 3.4;
    for (const v of this.list) {
      if (v.driver) continue;
      const d = Math.hypot(v.pos.x - a.pos.x, v.pos.z - a.pos.z);
      if (d < bd && Math.abs(v.pos.y - a.pos.y) < 2.5) { bd = d; best = v; }
    }
    return best;
  },
  enter(P, v) {
    const a = P.a;
    this.unblock(v);
    v.driver = a; v.claim = null; P.vehicle = v;
    P.reload = null; P.autoReload = null; P.heal = null; P.ads = 0; P.scopeView = 0; P.lean = 0; a.leanX = 0; P.throwSt = null; P.cycleT = -1;
    a.crouch = false; a.prone = false;
    P.orbitYaw = v.yaw; P.orbitPitch = -0.22;
    G.VM.set(null);
    G.Audio.click('close', 'ka47');
  },
  exit(P, forced) {
    const v = P.vehicle, a = P.a, W = G.World;
    if (!v) return;
    _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    // 왼쪽 → 오른쪽 → 뒤 순서로 빈 곳을 찾는다
    let done = false;
    for (const [ox, oz] of [[-1.9, 0], [1.9, 0], [0, 3], [0, -3]]) {
      const x = v.pos.x + _r.x * ox + Math.sin(v.yaw) * oz, z = v.pos.z + _r.z * ox + Math.cos(v.yaw) * oz;
      let free = true;
      W.queryBoxes(x - 0.4, z - 0.4, x + 0.4, z + 0.4, b => { if (b.maxY > v.pos.y + 0.5 && b.minY < v.pos.y + 1.8) free = false; });
      if (!free) continue;
      a.pos.set(x, Math.max(W.heightAt(x, z), v.pos.y - 0.5), z); done = true; break;
    }
    if (!done && !forced) return;
    if (!done) a.pos.set(v.pos.x, v.pos.y + 1.8, v.pos.z);
    a.vel.set(-Math.sin(v.yaw) * v.speed * 0.5, 0, -Math.cos(v.yaw) * v.speed * 0.5);
    a.yaw = P.orbitYaw; a.pitch = 0;
    v.driver = null; P.vehicle = null;
    if (Math.abs(v.speed) < 1.5) { v.speed = 0; this.block(v); }
    P.camY = a.pos.y + a.eyeH();
    P.raise = 0; P.sw = { t: 0.2, to: a.cur };
    G.Audio.setLoop('engine', 0);
  },
  // 플레이어 운전 (Player.updateGround 에서 호출)
  drive(P, dt) {
    const I = G.Input, a = P.a, v = P.vehicle, W = G.World, cam = G.camera;
    P.camMode = 'vehicle';
    P.orbitYaw -= I.mdx * 0.0026 * P.sens;
    P.orbitPitch = U.clamp(P.orbitPitch - P.lookY() * 0.0026 * P.sens, -1.1, 0.25);
    const thr = (I.down('KeyW') ? 1 : 0) - (I.down('KeyS') ? 1 : 0), st = (I.down('KeyA') ? 1 : 0) - (I.down('KeyD') ? 1 : 0);
    this.step(v, a, dt, thr, st, I.down('Space'));
    if (!v.driver) return;
    P.sprinting = false; P.ads = 0; P.scopeView = 0;
    // 소리: 엔진 + 주변 봇이 듣는다
    G.Audio.setLoop('engine', 0.32 + Math.abs(v.speed) / MAX * 0.25);
    G.Audio.setLoopRate('engine', 0.7 + Math.abs(v.speed) / MAX * 1.1);
    v.noiseT -= dt;
    if (v.noiseT <= 0) { v.noiseT = 1; G.Game.onNoise(v.pos, 45 + Math.abs(v.speed) * 2.5, a); }
    // 흙먼지
    if (Math.abs(v.speed) > 7 && Math.random() < dt * 14) G.FX.dust(_c.copy(v.pos).addScaledVector(_f, -1.7 * Math.sign(v.speed)), 1, 0, 0.3, 0, 0.5, 0.45, 0.36, 1.4);
    // 내리기
    P.prompt = '<kbd>' + G.Settings.label('KeyF') + '</kbd> 내리기 · <b>' + Math.round(Math.abs(v.speed) * 3.6) + '</b> km/h'; P.lootTarget = null; P.reviveTarget = null;
    if (I.hit('KeyF')) { this.exit(P); return; }
    // 3인칭 카메라
    const dist = 7.5;
    _c.set(Math.sin(P.orbitYaw) * Math.cos(P.orbitPitch), -Math.sin(P.orbitPitch), Math.cos(P.orbitYaw) * Math.cos(P.orbitPitch));
    _e.copy(v.pos); _e.y += 1.9;
    _d.copy(_e).addScaledVector(_c, dist);
    // Lift the camera boom over hills before checking buildings. A terrain hit used
    // to shorten the boom into the jeep's cabin on steep slopes.
    for (let i = 1; i <= 8; i++) {
      const t = i / 8, x = U.lerp(_e.x, _d.x, t), z = U.lerp(_e.z, _d.z, t);
      _d.y = Math.max(_d.y, _e.y + (W.heightAt(x, z) + 0.5 - _e.y) / t);
    }
    _c.copy(_d).sub(_e);
    let L = _c.length(); _c.normalize();
    const wall = W.rayBoxes(_e.x, _e.y, _e.z, _c.x, _c.y, _c.z, L, null);
    if (wall < Infinity) L = Math.max(0.3, wall - 0.3);
    cam.position.copy(_e).addScaledVector(_c, L);
    const gy = W.heightAt(cam.position.x, cam.position.z) + 0.4; if (cam.position.y < gy) cam.position.y = gy;
    cam.lookAt(_e);
    cam.fov = U.damp(cam.fov, 74 + Math.abs(v.speed) * 0.35, 5, dt); cam.updateProjectionMatrix();
    G.VM.set(null);
    G.lodZoom = 1;
  },
  // 차량 물리 한 단계 (플레이어·봇 공용). thr: -1..1, st: 왼쪽 +, brake: 브레이크
  step(v, a, dt, thr, st, brake) {
    const W = G.World;
    const wet = W.waterAt(v.pos.x, v.pos.z) - W.heightAt(v.pos.x, v.pos.z);
    const top = wet > 0.5 ? 4 : MAX;
    if (brake) v.speed = approach(v.speed, 0, 26 * dt);
    else if (thr > 0) v.speed = v.speed < 0 ? approach(v.speed, 0, 22 * dt) : Math.min(top, v.speed + 9.5 * (1 - v.speed / (top + 4)) * dt);
    else if (thr < 0) v.speed = v.speed > 0.5 ? approach(v.speed, 0, 20 * dt) : Math.max(-REV, v.speed - 6 * dt);
    else v.speed = approach(v.speed, 0, (2.2 + Math.abs(v.speed) * 0.12) * dt);
    if (v.speed > top) v.speed = approach(v.speed, top, 14 * dt);
    v.steer = U.damp(v.steer, st, 7, dt);
    const lock = 0.55 / (1 + Math.abs(v.speed) * 0.06);
    v.yaw += v.steer * lock * v.speed / 2.6 * dt;
    _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw));
    let nx = v.pos.x + _f.x * v.speed * dt, nz = v.pos.z + _f.z * v.speed * dt;
    // 가파른 비탈은 오르지 못한다
    const lead = Math.sign(v.speed) * 2.2, slope = (W.heightAt(nx + _f.x * lead, nz + _f.z * lead) - W.heightAt(nx, nz)) / 2.2;
    if (slope > 0.95) { v.speed *= -0.15; nx = v.pos.x; nz = v.pos.z; }
    // 장애물: 앞·가운데·뒤 세 원으로 밀어낸다
    let bumped = false;
    for (const off of [1.25, 0, -1.25]) {
      const cx0 = nx + _f.x * off, cz0 = nz + _f.z * off, r = 1.0;
      let cx = cx0, cz = cz0;
      W.queryBoxes(cx - r, cz - r, cx + r, cz + r, b => {
        if (b.maxY <= v.pos.y + 0.55 || b.minY >= v.pos.y + 1.7) return;
        const px = cx < b.minX ? b.minX : cx > b.maxX ? b.maxX : cx, pz = cz < b.minZ ? b.minZ : cz > b.maxZ ? b.maxZ : cz;
        let dx = cx - px, dz = cz - pz; const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); cx += dx / d * (r - d); cz += dz / d * (r - d); }
        else { cx = cx0 - _f.x * Math.sign(v.speed || 1) * 0.3; cz = cz0 - _f.z * Math.sign(v.speed || 1) * 0.3; }
        bumped = true;
      });
      nx += cx - cx0; nz += cz - cz0;
    }
    if (bumped) {
      // 세게 들이받은 순간에만 한 번 다친다
      if (!v.bump && Math.abs(v.speed) > 9) { if (a.isPlayer) G.FX.shake(0.3); G.Audio.impact(v.pos, 'metal'); G.Game.damage(a, Math.min(30, (Math.abs(v.speed) - 9) * 2.2), null, 'fall', false, a.pos, null); }
      v.speed *= Math.pow(0.02, dt);
    }
    v.bump = bumped;
    const lim = W.HALF - 6;
    v.pos.x = U.clamp(nx, -lim, lim); v.pos.z = U.clamp(nz, -lim, lim);
    this.place(v, 1 - Math.exp(-10 * dt));
    if (v.driver !== a) return;
    // 들이받기
    if (Math.abs(v.speed) > 5) {
      const now = G.Game.time, s = Math.sign(v.speed);
      for (const t of G.Game.actors) {
        if (!t.alive || t === a || t.team === a.team || t.state !== 'ground') continue;
        const dx = t.pos.x - (v.pos.x + _f.x * 1.3 * s), dz = t.pos.z - (v.pos.z + _f.z * 1.3 * s);
        if (dx * dx + dz * dz > 1.6 * 1.6 || Math.abs(t.pos.y - v.pos.y) > 1.8) continue;
        if ((v.hitT.get(t) || -9) > now - 0.7) continue;
        v.hitT.set(t, now);
        t.chest(_c);
        G.Game.damage(t, Math.abs(v.speed) * 7, a, 'vehicle', false, _c, _f);
        G.FX.blood(_c, _f.x * s, 0.3, _f.z * s, 8); G.Audio.impact(_c, 'flesh');
        t.vel.x += _f.x * v.speed * 0.6; t.vel.z += _f.z * v.speed * 0.6; t.vel.y = 3.5;
        v.speed *= 0.82;
      }
    }
    // 운전자 상태
    a.pos.copy(v.pos); a.vel.set(_f.x * v.speed, 0, _f.z * v.speed); a.hspeed = Math.abs(v.speed); a.onGround = true; a.yaw = v.yaw; a.pitch = 0;
  },
  /* ---------------- 봇 운전 ---------------- */
  // 봇이 탈 만한 빈 차 (다른 봇이 찜하지 않은 것)
  freeNear(a, r) {
    let best = null, bd = r;
    for (const v of this.list) {
      if (v.driver || (v.claim && v.claim !== a && v.claim.alive)) continue;
      if (G.World.waterAt(v.pos.x, v.pos.z) - G.World.heightAt(v.pos.x, v.pos.z) > 0.3) continue;
      const d = Math.hypot(v.pos.x - a.pos.x, v.pos.z - a.pos.z);
      if (d < bd && Math.abs(v.pos.y - a.pos.y) < 3) { bd = d; best = v; }
    }
    return best;
  },
  botEnter(bot, v) {
    const a = bot.a;
    if (v.driver) return false;
    this.unblock(v);
    v.driver = a; v.claim = null; bot.vehicle = v; a.inVehicle = v;
    a.crouch = false; a.prone = false; a.leanX = 0;
    bot.vStop = false; bot.vStuck = 0; bot.vRev = 0; bot.vLast = v.pos.clone(); bot.vT = 0;
    if (G.Audio.ok() && G.WeaponAudio) G.WeaponAudio.eventAt(G.Audio, 'close', 'ka47', v.pos);
    return true;
  },
  botExit(bot) {
    const v = bot.vehicle, a = bot.a, W = G.World;
    if (!v) return;
    _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    let done = false;
    for (const [ox, oz] of [[-1.9, 0], [1.9, 0], [0, 3], [0, -3]]) {
      const x = v.pos.x + _r.x * ox + Math.sin(v.yaw) * oz, z = v.pos.z + _r.z * ox + Math.cos(v.yaw) * oz;
      let free = true;
      W.queryBoxes(x - 0.4, z - 0.4, x + 0.4, z + 0.4, b => { if (b.maxY > v.pos.y + 0.5 && b.minY < v.pos.y + 1.8) free = false; });
      if (!free) continue;
      a.pos.set(x, Math.max(W.heightAt(x, z), v.pos.y - 0.5), z); done = true; break;
    }
    if (!done) a.pos.set(v.pos.x, v.pos.y + 1.8, v.pos.z);
    a.vel.set(-Math.sin(v.yaw) * v.speed * 0.4, 0, -Math.cos(v.yaw) * v.speed * 0.4);
    a.yaw = v.yaw; a.pitch = 0;
    v.driver = null; bot.vehicle = null; a.inVehicle = null;
    if (Math.abs(v.speed) < 1.5) { v.speed = 0; this.block(v); }
  },
  // 봇 운전: 목표 쪽으로 핸들을 꺾고, 막히면 후진해서 돌아 나온다. 다 오면 true(내릴 때)
  botDrive(bot, dt, goal) {
    const a = bot.a, v = bot.vehicle, W = G.World;
    const dx = goal.x - v.pos.x, dz = goal.z - v.pos.z, dist = Math.hypot(dx, dz);
    if (dist < 18) { this.step(v, a, dt, 0, 0, true); return Math.abs(v.speed) < 1; }
    const want = Math.atan2(-dx, -dz);
    let diff = U.angleDiff(v.yaw, want);
    // 앞이 막혔으면 피해 가는 쪽으로
    _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw));
    const look = 5 + Math.abs(v.speed) * 0.5;
    // 차 폭만큼 세 줄로 앞을 본다
    const ahead = (yaw) => {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
      for (const o of [0, -0.95, 0.95]) if (W.rayBoxes(v.pos.x + rx * o, v.pos.y + 1, v.pos.z + rz * o, fx, 0, fz, look, null) < Infinity) return true;
      const hx = v.pos.x + fx * look, hz = v.pos.z + fz * look;
      return W.heightAt(hx, hz) - v.pos.y > 2.2 || W.waterAt(hx, hz) - W.heightAt(hx, hz) > 0.6;
    };
    const blocked = ahead(v.yaw);
    if (blocked) {
      for (const t of [0.5, 0.9, 1.4]) {
        if (!ahead(v.yaw + t)) { diff = t; break; }
        if (!ahead(v.yaw - t)) { diff = -t; break; }
      }
    }
    let thr = Math.abs(diff) > 1.6 ? 0.5 : 1, st = U.clamp(diff * 2.2, -1, 1);
    // 끼임: 2초 동안 거의 못 움직였으면 1.3초 후진
    bot.vT += dt;
    if (bot.vRev > 0) { bot.vRev -= dt; thr = -1; st = -bot.vRevSt; }
    else if (bot.vT > 2) {
      if (v.pos.distanceTo(bot.vLast) < 2.5) { bot.vStuck++; bot.vRev = 1.3; bot.vRevSt = st || 1; }
      else bot.vStuck = Math.max(0, bot.vStuck - 1);
      bot.vT = 0; bot.vLast.copy(v.pos);
    }
    // 봇은 너무 빨리 몰지 않고, 앞이 막히거나 크게 꺾을 때는 속도를 줄인다 (들이받아 다치지 않게)
    const slow = (Math.abs(diff) > 0.8 && v.speed > 9) || (blocked && v.speed > 7);
    if (thr > 0 && v.speed > 15) thr = 0;
    this.step(v, a, dt, slow ? 0 : thr, st, slow);
    return false;
  },
  update(dt) {
    // 봇이 운전하는 차 중 가장 가까운 차의 엔진 소리
    if (G.Audio.ctx) {
      let near = null, nd = 120;
      for (const v of this.list) if (v.driver && !v.driver.isPlayer) { const d = v.pos.distanceTo(G.camera.position); if (d < nd) { nd = d; near = v; } }
      if (near) { G.Audio.setLoop('engineBot', 0.5 + Math.abs(near.speed) / MAX * 0.3, near.pos, 14); G.Audio.setLoopRate('engineBot', 0.7 + Math.abs(near.speed) / MAX * 1.1); }
      else G.Audio.setLoop('engineBot', 0);
    }
    // 운전자가 없는 채로 굴러가는 차는 서서히 멈춘 뒤 다시 충돌 상자를 둔다
    for (const v of this.list) {
      if (v.driver) {
        const d = v.driver;
        if (!d.alive || d.knocked) { const P = G.Player; if (P.vehicle === v) this.exit(P, true); else if (d.brain && d.brain.vehicle === v) this.botExit(d.brain); else v.driver = null; }
        else if (!d.isPlayer) {
          v.noiseT -= dt;
          if (v.noiseT <= 0) { v.noiseT = 1; G.Game.onNoise(v.pos, 45 + Math.abs(v.speed) * 2.5, d); }
          if (Math.abs(v.speed) > 7 && Math.random() < dt * 14 && v.pos.distanceTo(G.camera.position) < 120) { _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); G.FX.dust(_c.copy(v.pos).addScaledVector(_f, -1.7 * Math.sign(v.speed)), 1, 0, 0.3, 0, 0.5, 0.45, 0.36, 1.4); }
        }
        continue;
      }
      if (v.speed === 0) continue;
      v.speed = approach(v.speed, 0, 9 * dt);
      _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw));
      const nx = v.pos.x + _f.x * v.speed * dt, nz = v.pos.z + _f.z * v.speed * dt;
      let hit = false;
      G.World.queryBoxes(nx - 1.2, nz - 1.2, nx + 1.2, nz + 1.2, b => { if (b.maxY > v.pos.y + 0.55 && b.minY < v.pos.y + 1.7) hit = true; });
      if (hit) v.speed = 0; else { v.pos.x = nx; v.pos.z = nz; }
      this.place(v, 1 - Math.exp(-10 * dt));
      if (v.speed === 0) this.block(v);
    }
  },
  draw(ctx, toS, scale) {
    for (const v of this.list) {
      const [x, y] = toS(v.pos.x, v.pos.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-v.yaw);
      ctx.fillStyle = v.driver ? '#ffd23f' : '#e8e8e8'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.fillRect(-2.6 * scale, -4.4 * scale, 5.2 * scale, 8.8 * scale); ctx.strokeRect(-2.6 * scale, -4.4 * scale, 5.2 * scale, 8.8 * scale);
      ctx.restore();
    }
  }
};
function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }

})();
