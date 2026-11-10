// vehicles.js — 탈 수 있는 차량 (지프): F 탑승/하차, WASD 운전, Space 브레이크
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;
const _f = new V3(), _r = new V3(), _c = new V3(), _e = new V3(), _d = new V3();
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
    if (G.Audio.ctx) G.Audio.setLoop('engine', 0);
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
  // 세워 둔 차는 충돌 상자를 둔다 (걸어서 통과·총알 관통 방지). 회전을 감안해 조금 줄인 축 정렬 상자
  block(v) {
    const c = Math.abs(Math.cos(v.yaw)), s = Math.abs(Math.sin(v.yaw));
    const hx = HALF_W * c + HALF_L * s - 0.25 * Math.min(c, s) * 2, hz = HALF_W * s + HALF_L * c - 0.25 * Math.min(c, s) * 2;
    v.box = G.World.addCollider(v.pos.x - hx, v.pos.y, v.pos.z - hz, v.pos.x + hx, v.pos.y + 1.7, v.pos.z + hz, 'metal') || G.World.boxes[G.World.boxes.length - 1];
  },
  unblock(v) { if (v.box) { v.box.minY = v.box.maxY = -1e6; v.box.minX = v.box.maxX = v.box.minZ = v.box.maxZ = 1e7; v.box = null; } },
  place(v, k) {
    const W = G.World;
    _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    const h = (ox, oz) => Math.max(W.heightAt(v.pos.x + _f.x * oz + _r.x * ox, v.pos.z + _f.z * oz + _r.z * ox), W.waterAt(v.pos.x, v.pos.z) - 0.9);
    const hf = h(0, 1.4), hb = h(0, -1.4), hl = h(-0.9, 0), hr = h(0.9, 0);
    v.pos.y = U.lerp(v.pos.y, (hf + hb + hl + hr) / 4, k);
    v.pitch = U.lerp(v.pitch, Math.atan2(hf - hb, 2.8), k); v.roll = U.lerp(v.roll, Math.atan2(hl - hr, 1.8), k);
    v.mesh.position.copy(v.pos);
    v.mesh.rotation.set(v.pitch, v.yaw, v.roll);
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
    v.driver = a; P.vehicle = v;
    P.reload = null; P.heal = null; P.ads = 0; P.scopeView = 0; P.lean = 0; P.throwSt = null; P.cycleT = -1;
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
      if (!free && !forced) continue;
      a.pos.set(x, Math.max(W.heightAt(x, z), v.pos.y - 0.5), z); done = true; break;
    }
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
    P.orbitPitch = U.clamp(P.orbitPitch - I.mdy * 0.0026 * P.sens, -1.1, 0.25);
    const thr = (I.down('KeyW') ? 1 : 0) - (I.down('KeyS') ? 1 : 0), st = (I.down('KeyA') ? 1 : 0) - (I.down('KeyD') ? 1 : 0);
    const wet = W.waterAt(v.pos.x, v.pos.z) - W.heightAt(v.pos.x, v.pos.z);
    const top = wet > 0.5 ? 4 : MAX;
    if (I.down('Space')) v.speed = approach(v.speed, 0, 26 * dt);
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
      if (!v.bump && Math.abs(v.speed) > 9) { G.FX.shake(0.3); G.Audio.impact(v.pos, 'metal'); G.Game.damage(a, Math.min(30, (Math.abs(v.speed) - 9) * 2.2), null, 'fall', false, a.pos, null); }
      v.speed *= Math.pow(0.02, dt);
    }
    v.bump = bumped;
    const lim = W.HALF - 6;
    v.pos.x = U.clamp(nx, -lim, lim); v.pos.z = U.clamp(nz, -lim, lim);
    this.place(v, 1 - Math.exp(-10 * dt));
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
    P.sprinting = false; P.ads = 0; P.scopeView = 0;
    // 소리: 엔진 + 주변 봇이 듣는다
    G.Audio.setLoop('engine', 0.32 + Math.abs(v.speed) / MAX * 0.25);
    G.Audio.setLoopRate('engine', 0.7 + Math.abs(v.speed) / MAX * 1.1);
    v.noiseT -= dt;
    if (v.noiseT <= 0) { v.noiseT = 1; G.Game.onNoise(v.pos, 45 + Math.abs(v.speed) * 2.5, a); }
    // 흙먼지
    if (Math.abs(v.speed) > 7 && Math.random() < dt * 14) G.FX.dust(_c.copy(v.pos).addScaledVector(_f, -1.7 * Math.sign(v.speed)), 1, 0, 0.3, 0, 0.5, 0.45, 0.36, 1.4);
    // 내리기
    P.prompt = '<kbd>F</kbd> 내리기 · <b>' + Math.round(Math.abs(v.speed) * 3.6) + '</b> km/h'; P.lootTarget = null; P.reviveTarget = null;
    if (I.hit('KeyF')) { this.exit(P); return; }
    // 3인칭 카메라
    const dist = 7.5;
    _c.set(Math.sin(P.orbitYaw) * Math.cos(P.orbitPitch), -Math.sin(P.orbitPitch), Math.cos(P.orbitYaw) * Math.cos(P.orbitPitch));
    _e.copy(v.pos); _e.y += 1.9;
    let L = dist;
    if (W.raycast(_e, _c, dist)) L = Math.max(1.2, W.hit.t - 0.3);
    cam.position.copy(_e).addScaledVector(_c, L);
    const gy = W.heightAt(cam.position.x, cam.position.z) + 0.4; if (cam.position.y < gy) cam.position.y = gy;
    cam.lookAt(_e);
    cam.fov = U.damp(cam.fov, 74 + Math.abs(v.speed) * 0.35, 5, dt); cam.updateProjectionMatrix();
    G.VM.set(null);
    G.lodZoom = 1;
  },
  update(dt) {
    // 운전자가 없는 채로 굴러가는 차는 서서히 멈춘 뒤 다시 충돌 상자를 둔다
    for (const v of this.list) {
      if (v.driver) { if (!v.driver.alive || v.driver.knocked) { const P = G.Player; if (P.vehicle === v) this.exit(P, true); else v.driver = null; } continue; }
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
