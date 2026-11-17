// vehicles.js — 탈 수 있는 차량: F 탑승/하차, WASD 운전, Space 핸드브레이크(꺾으며 드리프트)
//  v48: Kenney Car Kit 모델 4종(SUV·픽업·세단·밴), 드리프트, 총·폭발로 부서지고 불타다 폭발
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;
const _f = new V3(), _r = new V3(), _c = new V3(), _e = new V3(), _d = new V3();
const _support = new V3();
const HALF_L = 1.9, HALF_W = 0.95, MAX = 21, REV = 6;
const HP = 320;                 // 차량 내구도 (소총 약 12발, 수류탄 두 개)
const KINDS = ['suv', 'truck', 'sedan', 'van'];
const S = 1.6;                  // Kenney 모델 → 미터
const PAINT = {
  suv: [0x4b5a35, 0x5a5242, 0x3d4a52],
  truck: [0x7d6a48, 0x55603f, 0x6e2a22],
  sedan: [0x7a1f1f, 0x2b3e5c, 0xa7a9ab, 0x26282b],
  van: [0xcfcfc6, 0x4a5d6e, 0x5d6b3e]
};
// 모델이 없을 때(예전 지프 상자) · 직접 만든 차량 객체의 기본 치수
const JEEP = { hl: HALF_L, hw: HALF_W, top: 1.7, r: 0.42, wheelPts: [[-0.95, -1.25], [0.95, -1.25], [-0.95, 1.25], [0.95, 1.25]] };
const dimOf = v => v.dim || (v.dim = JEEP);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _X = new V3(1, 0, 0), _Y = new V3(0, 1, 0), _vel = new V3(), _o = new V3(), _m4 = new THREE.Matrix4();

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
  list: [], geo: null, mat: null, models: {},
  // Kenney Car Kit 모델 (없으면 예전 지프 상자 모델)
  async load() {
    if (location.protocol === 'file:' || !THREE.GLTFLoader) return;
    const gl = new THREE.GLTFLoader();
    if (THREE.MeshoptDecoder) gl.setMeshoptDecoder(THREE.MeshoptDecoder);
    const v = window.LZ_BUILD || '';
    await Promise.all(KINDS.map(k => gl.loadAsync('assets/models/vehicles/' + k + '.glb' + (v ? '?v=' + v : '')).then(g => {
      const root = g.scene;
      root.updateMatrixWorld(true);
      const wheels = [];
      root.traverse(o => { if (/^wheel_(front|back)(Left|Right)$/.test(o.name)) wheels.push(o.name); });
      // 바퀴 바닥 = 땅, 앞뒤 바퀴 가운데 = 원점 (앞은 -Z)
      const box = new THREE.Box3().setFromObject(root), wz = [], wx = [];
      let r = 0;
      for (const n of wheels) {
        const w = root.getObjectByName(n), wb = new THREE.Box3().setFromObject(w), c = wb.getCenter(new V3());
        wz.push(c.z); wx.push(Math.abs(c.x)); r = Math.max(r, (wb.max.y - wb.min.y) / 2);
      }
      const cz = (Math.min(...wz) + Math.max(...wz)) / 2;
      // 차체 상자 (거울 같은 튀어나온 것까지 포함하지 않게 차체 노드로)
      const body = root.getObjectByName('body'), bb = new THREE.Box3().setFromObject(body || root);
      this.models[k] = {
        root, wheels, r: r * S, y0: -box.min.y * S, cz: -cz * S,
        hl: (bb.max.z - bb.min.z) / 2 * S, hw: Math.min(bb.max.x - bb.min.x, 2 * Math.max(...wx) + r) / 2 * S, top: (box.max.y - box.min.y) * S,
        wheelPts: wheels.map(n => { const w = root.getObjectByName(n), c = new THREE.Box3().setFromObject(w).getCenter(new V3()); return [c.x * S, (c.z - cz) * S]; })
      };
      root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material.envMapIntensity = 0.7; } });
    }).catch(e => console.info('[vehicle] ' + k + ' 모델 없음', e.message))));
  },
  burnt: null,
  // 차량 한 대의 메시: 모델이 있으면 복제(차체 색만 바꿔), 없으면 상자 지프
  makeMesh(v) {
    const kind = KINDS.find(k => this.models[k] && k === v.kind) || KINDS.find(k => this.models[k]);
    if (!kind) {
      if (!this.geo) { this.geo = build(); this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }); }
      const m = new THREE.Mesh(this.geo, this.mat); m.castShadow = true; m.rotation.order = 'YXZ';
      v.dim = JEEP;
      return m;
    }
    const M = this.models[kind], g = new THREE.Group(), inner = M.root.clone(true);
    v.kind = kind;
    inner.scale.setScalar(S); inner.position.set(0, M.y0, M.cz);
    const color = new THREE.Color(U.pick(PAINT[kind]));
    const paint = new Map();
    inner.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map(m => {
        if (!/^paint/i.test(m.name)) return m;
        if (!paint.has(m)) { const c = m.clone(); c.color.copy(color); c.roughness = 0.45; c.metalness = 0.35; paint.set(m, c); }
        return paint.get(m);
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    g.add(inner); g.rotation.order = 'YXZ';
    v.wheels = M.wheels.map(n => { const w = inner.getObjectByName(n); return { o: w, base: w.quaternion.clone(), front: /front/.test(n) }; });
    v.spin = 0;
    v.dim = { hl: M.hl, hw: M.hw, top: M.top, r: M.r, wheelPts: M.wheelPts };
    return g;
  },
  newVehicle(x, y, z, yaw, extra) {
    if (!this.geo) { this.geo = build(); this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }); }
    const v = Object.assign({ kind: U.pick(KINDS), pos: new V3(x, y, z), yaw, speed: 0, lat: 0, steer: 0, pitch: 0, roll: 0, driver: null, box: null, hitT: new Map(), noiseT: 0, hp: HP, dead: false, burnT: 0, smokeT: 0, lastHit: null, skid: [null, null] }, extra || {});
    v.mesh = this.makeMesh(v);
    G.scene.add(v.mesh);
    this.list.push(v); this.place(v, 1); this.block(v);
    return v;
  },
  reset() {
    for (const v of this.list) { G.scene.remove(v.mesh); this.unblock(v); }
    this.list = [];
    if (this.skids) { this.skids.count = 0; this.skidN = 0; }
    if (G.Audio.ctx) G.Audio.setLoop('skid', 0);
    if (G.Audio.ctx) { G.Audio.setLoop('engine', 0); G.Audio.setLoop('engineBot', 0); }
  },
  spawn(n) {
    const W = G.World;
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
      this.newVehicle(x, y, z, Math.atan2(-dx, -dz) + (Math.random() < 0.5 ? Math.PI : 0));
    }
  },
  // 정해진 자리에 한 대 (훈련장 운전 코스)
  spawnAt(x, z, yaw, kind) {
    return this.newVehicle(x, G.World.heightAt(x, z), z, yaw, { home: { x, z, yaw }, kind: kind || 'suv' });
  },
  // 세워 둔 차는 충돌 상자를 둔다 (걸어서 통과·총알 관통 방지). 회전을 감안해 조금 줄인 축 정렬 상자
  block(v) {
    const c = Math.abs(Math.cos(v.yaw)), s = Math.abs(Math.sin(v.yaw)), D = dimOf(v);
    const hx = D.hw * c + D.hl * s - 0.25 * Math.min(c, s) * 2, hz = D.hw * s + D.hl * c - 0.25 * Math.min(c, s) * 2;
    v.box = G.World.addCollider(v.pos.x - hx, v.pos.y, v.pos.z - hz, v.pos.x + hx, v.pos.y + Math.min(1.9, D.top), v.pos.z + hz, 'metal', true);
    v.box.vehicle = v;
  },
  unblock(v) { G.World.removeCollider(v.box); v.box = null; },
  place(v, k) {
    const W = G.World;
    _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    const ground = (x, z) => Math.max(W.heightAt(x, z), W.waterAt(x, z) - 0.9);
    const h = (ox, oz) => ground(v.pos.x + _f.x * oz + _r.x * ox, v.pos.z + _f.z * oz + _r.z * ox);
    const D = dimOf(v), L = D.hl * 0.75, Wd = D.hw;
    const hf = h(0, L), hb = h(0, -L), hl = h(-Wd, 0), hr = h(Wd, 0);
    const pitch = Math.atan2(hf - hb, 2 * L), roll = Math.atan2((hr - hl) * Math.cos(pitch), 2 * Wd);
    v.pitch = U.lerp(v.pitch, pitch, k); v.roll = U.lerp(v.roll, roll, k);
    v.mesh.rotation.set(v.pitch + (v.tilt ? v.tilt.x : 0), v.yaw, v.roll + (v.tilt ? v.tilt.z : 0));
    // Support the tilted wheel treads instead of sinking the uphill wheels into the terrain.
    let supportY = -Infinity;
    for (const [x, z] of D.wheelPts) {
      _support.set(x, 0, z).applyQuaternion(v.mesh.quaternion);
      supportY = Math.max(supportY, ground(v.pos.x + _support.x, v.pos.z + _support.z) - _support.y);
    }
    v.pos.y = Math.max(supportY, U.lerp(v.pos.y, supportY, k));
    v.mesh.position.copy(v.pos);
    if (v.hop) v.mesh.position.y += v.hop.y;
    v.mesh.updateMatrixWorld(true);
  },
  near(a) {
    let best = null, bd = 3.4;
    for (const v of this.list) {
      if (v.driver || v.dead) continue;
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
    this.step(v, a, dt, thr, st, false, I.down('Space'));
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
    const hpP = Math.round(v.hp / HP * 100);
    P.prompt = '<kbd>' + G.Settings.label('KeyF') + '</kbd> 내리기 · <kbd>' + G.Settings.label('Space') + '</kbd> 드리프트 · <b>' + Math.round(Math.hypot(v.speed, v.lat) * 3.6) + '</b> km/h · 차량 ' + (v.burnT > 0 ? '<b style="color:#ff5a3c">불붙음!</b>' : '<b' + (hpP < 30 ? ' style="color:#ff8a3c"' : '') + '>' + hpP + '%</b>') + (v.drift ? ' · <b style="color:#ffd23f">DRIFT</b>' : ''); P.lootTarget = null; P.reviveTarget = null;
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
  // 차량 물리 한 단계 (플레이어·봇 공용). thr: -1..1, st: 왼쪽 +, brake: 브레이크, hand: 핸드브레이크
  //  속도는 차 앞방향(speed)과 옆방향(lat) 두 성분. 차가 도는 만큼 속도 방향은 늦게 따라온다 →
  //  뒷바퀴가 미끄러지면(핸드브레이크) 옆으로 흐르며 드리프트, 평소엔 접지력이 옆 속도를 금방 없앤다.
  step(v, a, dt, thr, st, brake, hand) {
    const W = G.World;
    const wet = W.waterAt(v.pos.x, v.pos.z) - W.heightAt(v.pos.x, v.pos.z);
    const top = wet > 0.5 ? 4 : MAX;
    if (v.dead) { thr = 0; st = 0; brake = true; hand = false; }
    // 많이 부서지면 힘이 빠진다
    const weak = v.hp < HP * 0.3 ? 0.65 : 1;
    if (hand) {
      // 꺾으면서 당기면 뒷바퀴만 미끄러진다: 거의 감속하지 않고, 가속 페달을 밟고 있으면 속도를 유지
      if (Math.abs(st) > 0.2 && Math.abs(v.speed) > 6) {
        v.speed = approach(v.speed, 0, 1.8 * dt);
        if (thr > 0 && v.speed > 0) v.speed = Math.min(top, v.speed + 6 * weak * (1 - v.speed / (top + 4)) * dt);
      } else v.speed = approach(v.speed, 0, 16 * dt);
    }
    else if (brake) v.speed = approach(v.speed, 0, 26 * dt);
    else if (thr > 0) v.speed = v.speed < 0 ? approach(v.speed, 0, 22 * dt) : Math.min(top, v.speed + 9.5 * weak * (1 - v.speed / (top + 4)) * dt);
    else if (thr < 0) v.speed = v.speed > 0.5 ? approach(v.speed, 0, 20 * dt) : Math.max(-REV, v.speed - 6 * dt);
    else v.speed = approach(v.speed, 0, (2.2 + Math.abs(v.speed) * 0.12) * dt);
    if (v.speed > top) v.speed = approach(v.speed, top, 14 * dt);
    v.steer = U.damp(v.steer, st, 7, dt);
    const lock = 0.55 / (1 + Math.abs(v.speed) * 0.06);
    // 지금 속도 (세계 좌표)
    _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    _vel.copy(_f).multiplyScalar(v.speed).addScaledVector(_r, v.lat || 0);
    // 핸드브레이크로 뒷바퀴를 잠그면 차 머리가 더 잘 돈다
    const slide = hand && Math.abs(v.speed) > 6;
    let yawRate = v.steer * lock * v.speed / 2.6;
    if (slide) yawRate *= 1.25;
    else if (Math.abs(v.lat) > 1.5) yawRate += v.steer * 0.35 * Math.sign(v.speed);   // 미끄러지는 동안 카운터 스티어
    v.yaw += yawRate * dt;
    // 새 방향으로 속도 나누기
    _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    v.speed = _vel.dot(_f); v.lat = _vel.dot(_r);
    // 옆 접지력: 평소 강하게, 핸드브레이크면 약하게. 잃은 옆 속도 일부는 앞으로 (드리프트를 빠져나올 때 가속)
    const grip = slide ? 2.2 : wet > 0.3 ? 2.5 : 7.5;
    const lat0 = v.lat;
    v.lat *= Math.exp(-grip * dt);
    if (!slide && v.speed > 0) v.speed = Math.min(top, v.speed + Math.abs(lat0 - v.lat) * 0.25);
    if (Math.abs(v.lat) < 0.02) v.lat = 0;
    v.drift = Math.abs(v.lat) > 2.2 && Math.abs(v.speed) > 4;
    let nx = v.pos.x + (_f.x * v.speed + _r.x * v.lat) * dt, nz = v.pos.z + (_f.z * v.speed + _r.z * v.lat) * dt;
    // 가파른 비탈은 오르지 못한다
    const lead = Math.sign(v.speed) * 2.2, slope = (W.heightAt(nx + _f.x * lead, nz + _f.z * lead) - W.heightAt(nx, nz)) / 2.2;
    if (slope > 0.95) { v.speed *= -0.15; v.lat = 0; nx = v.pos.x; nz = v.pos.z; }
    // 장애물: 앞·가운데·뒤 세 원으로 밀어낸다
    let bumped = false;
    const D = dimOf(v), offL = Math.max(0.6, D.hl - D.hw);
    for (const off of [offL, 0, -offL]) {
      const cx0 = nx + _f.x * off, cz0 = nz + _f.z * off, r = D.hw + 0.05;
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
      const hitV = Math.hypot(v.speed, v.lat);
      if (!v.bump && hitV > 9) { if (a.isPlayer) G.FX.shake(0.3); G.Audio.impact(v.pos, 'metal'); G.Game.damage(a, Math.min(30, (hitV - 9) * 2.2), null, 'fall', false, a.pos, null); this.damage(v, (hitV - 9) * 6, null, 'crash'); }
      v.speed *= Math.pow(0.02, dt); v.lat *= Math.pow(0.02, dt);
    }
    v.bump = bumped;
    const lim = W.HALF - 6;
    v.pos.x = U.clamp(nx, -lim, lim); v.pos.z = U.clamp(nz, -lim, lim);
    this.place(v, 1 - Math.exp(-10 * dt));
    this.wheelAnim(v, dt);
    this.tires(v, dt);
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
    a.pos.copy(v.pos); a.vel.set(_f.x * v.speed + _r.x * v.lat, 0, _f.z * v.speed + _r.z * v.lat); a.hspeed = Math.abs(v.speed); a.onGround = true; a.yaw = v.yaw; a.pitch = 0;
  },
  /* ---------------- 바퀴 · 타이어 자국 ---------------- */
  wheelAnim(v, dt) {
    if (!v.wheels) return;
    v.spin = (v.spin + v.speed / Math.max(0.2, v.dim.r) * dt) % (Math.PI * 2);
    for (const w of v.wheels) {
      // 부모 공간에서 꺾고(앞바퀴) 굴린다: 원래 자세(base) 위에
      _q.setFromAxisAngle(_Y, w.front ? v.steer * 0.42 : 0);
      _q2.setFromAxisAngle(_X, -v.spin);
      w.o.quaternion.copy(_q).multiply(_q2).multiply(w.base);
    }
  },
  // 드리프트: 뒷바퀴 자국 · 타이어 연기 · 끼익 소리
  tires(v, dt) {
    const near = v.pos.distanceTo(G.camera.position) < 160;
    if (!v.skid) v.skid = [null, null];
    if (!v.drift || !near || v.dead) { v.skid[0] = v.skid[1] = null; if (v.driver && v.driver.isPlayer && G.Audio.ctx) G.Audio.setLoop('skid', 0); return; }
    const W = G.World, rear = dimOf(v).wheelPts.filter(p => p[1] > 0);
    rear.slice(0, 2).forEach(([x, z], i) => {
      _o.set(x, 0, z).applyAxisAngle(_Y, v.yaw).add(v.pos);
      _o.y = W.heightAt(_o.x, _o.z) + 0.03;
      const last = v.skid[i];
      if (last && last.distanceToSquared(_o) > 0.09) { this.skidMark(last, _o); last.copy(_o); }
      else if (!last) v.skid[i] = _o.clone();
      if (Math.random() < dt * 22) G.FX.dust(_o, 1, -v.lat * 0.04, 0.35, 0, 0.62, 0.62, 0.6, 1.1);
    });
    if (v.driver && v.driver.isPlayer && G.Audio.ctx) G.Audio.setLoop('skid', U.clamp(Math.abs(v.lat) / 7, 0.15, 0.55));
  },
  skidMark(a, b) {
    if (!this.skids) {
      const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0x0d0d0d, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this.skids = new THREE.InstancedMesh(geo, mat, 700); this.skids.count = 0; this.skidN = 0;
      this.skids.frustumCulled = false; this.skids.renderOrder = 1; G.scene.add(this.skids);
    }
    const i = this.skidN++ % 700, len = a.distanceTo(b);
    _o.copy(a).add(b).multiplyScalar(0.5);
    _q.setFromAxisAngle(_Y, Math.atan2(b.x - a.x, b.z - a.z));
    _m4.compose(_o, _q, _e.set(0.24, 1, len + 0.05));
    this.skids.setMatrixAt(i, _m4);
    this.skids.count = Math.min(700, Math.max(this.skids.count, i + 1));
    this.skids.instanceMatrix.needsUpdate = true;
  },
  /* ---------------- 부서짐 · 폭발 ---------------- */
  // 총알 등이 차체에 맞았는지 (차 방향으로 돌린 상자). 맞으면 { v, t }
  rayHit(o, d, maxT) {
    let best = null;
    for (const v of this.list) {
      const D = dimOf(v), R = D.hl + 1;
      const dx = v.pos.x - o.x, dz = v.pos.z - o.z;
      // 광선과 차 중심의 거리로 먼저 거른다
      const tc = dx * d.x + dz * d.z, h = dx * dx + dz * dz - tc * tc / (d.x * d.x + d.z * d.z + 1e-9);
      if (h > R * R || tc < -R || tc > maxT + R) continue;
      const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
      // 세계 → 차 (Y 축으로 -yaw)
      const lx = c * (o.x - v.pos.x) - s * (o.z - v.pos.z), lz = s * (o.x - v.pos.x) + c * (o.z - v.pos.z), ly = o.y - v.pos.y - (v.hop ? v.hop.y : 0);
      const ldx = c * d.x - s * d.z, ldz = s * d.x + c * d.z, ldy = d.y;
      let t0 = 0, t1 = maxT;
      for (const [p, q, lo, hi] of [[lx, ldx, -D.hw, D.hw], [ly, ldy, 0.3, D.top * 0.92], [lz, ldz, -D.hl, D.hl]]) {
        if (Math.abs(q) < 1e-9) { if (p < lo || p > hi) { t0 = Infinity; break; } continue; }
        let a = (lo - p) / q, b = (hi - p) / q;
        if (a > b) { const t = a; a = b; b = t; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < maxT && (!best || t0 < best.t)) best = { v, t: t0 };
    }
    return best;
  },
  // 피해: 반쯤 부서지면 연기, 다 부서지면 잠시 불타다 폭발
  damage(v, amt, by, kind) {
    if (!v || v.dead || amt <= 0) return;
    if (by) v.lastHit = by;
    v.hp -= amt;
    if (v.hp <= 0 && !v.burnT) {
      v.hp = 0;
      v.burnT = kind === 'blast' ? 0.45 + Math.random() * 0.5 : 2.4;   // 옆 차가 터지면 곧바로 연쇄 폭발
      G.Audio.impact(v.pos, 'metal');
    } else if (v.burnT && kind === 'blast') v.burnT = Math.min(v.burnT, 0.5);
  },
  // 폭발 반경 안의 차에 피해 (수류탄 · 다른 차의 폭발)
  blast(p, r, dmg, by, skip) {
    for (const v of this.list) {
      if (v === skip || v.dead) continue;
      const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z) - v.dim.hw * 0.6;
      if (d < r && Math.abs(v.pos.y - p.y) < 4) this.damage(v, dmg * Math.pow(1 - Math.max(0, d) / r, 1.1), by, 'blast');
    }
  },
  center(v, out) { return out.set(0, v.dim.top * 0.45, 0).applyAxisAngle(_Y, v.yaw).add(v.pos); },
  engine(v, out) { return out.set(0, v.dim.top * 0.62, -v.dim.hl * 0.62).applyAxisAngle(_Y, v.yaw).add(v.pos); },
  explode(v) {
    const Game = G.Game, W = G.World, by = v.lastHit && v.lastHit.alive !== undefined ? v.lastHit : null;
    v.dead = true; v.burnT = 0;
    // 타고 있던 사람은 내린 뒤 폭발에 맞는다
    const d0 = v.driver;
    if (d0) { const P = G.Player; if (P.vehicle === v) this.exit(P, true); else if (d0.brain && d0.brain.vehicle === v) this.botExit(d0.brain); else v.driver = null; }
    v.speed = 0; v.lat = 0;
    if (G.Audio.ctx && d0 && d0.isPlayer) { G.Audio.setLoop('skid', 0); G.Audio.setLoop('engine', 0); }
    const p = this.center(v, new V3());
    G.FX.explosion(p);
    _c.copy(p).add(_e.set((Math.random() - 0.5) * 1.6, 0.6, (Math.random() - 0.5) * 2.4)); G.FX.explosion(_c);
    G.FX.light(p, 0xff8030, 1600, 0.6, 70);
    G.FX.debris(p, 26, 0, 1.2, 0, 0.09, 0.08, 0.07);
    G.Audio.explosion(p); G.Audio.impact(p, 'metal');
    const camD = G.camera.position.distanceTo(p);
    G.FX.shake(U.clamp(1.8 - camD / 30, 0, 1.4));
    // 사람 피해 (벽 뒤는 안전)
    for (const a of Game.actors) {
      if (!a.alive || a.state !== 'ground') continue;
      a.chest(_c);
      const d = _c.distanceTo(p);
      if (d > 9) continue;
      _d.copy(_c).sub(p).normalize();
      if (a !== d0 && W.rayBoxes(p.x, p.y, p.z, _d.x, _d.y, _d.z, Math.max(0, d - 0.3), null) < Infinity) {
        // 차 자신의 충돌 상자는 이미 없다; 다른 벽이면 막힘
        continue;
      }
      const dmg = a === d0 ? 260 : 210 * Math.pow(1 - d / 9, 1.2);
      if (dmg > 1) { Game.damage(a, dmg, by, 'carbomb', false, _c, _d); a.vel.x += _d.x * 6; a.vel.z += _d.z * 6; a.vel.y = Math.max(a.vel.y, 3.5); }
    }
    Game.onNoise(p, 170, by);
    this.blast(p, 8, 300, by, v);
    // 들썩 튀어 오르고 기울어진 채 내려앉는다
    v.hop = { y: 0, vy: 5.5 + Math.random() * 1.5 };
    v.tilt = { x: (Math.random() - 0.5) * 0.3, z: (Math.random() - 0.5) * 0.45, tx: (Math.random() - 0.5) * 0.12, tz: (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.1) };
    // 불탄 껍데기
    if (!this.burnt) this.burnt = { body: new THREE.MeshStandardMaterial({ color: 0x1d1b19, roughness: 0.95, metalness: 0.25 }), glass: new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.6, metalness: 0.1 }) };
    v.mesh.traverse(o => {
      if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => /window|glass/i.test(m.name) ? this.burnt.glass : this.burnt.body) : (/window|glass/i.test(o.material.name) ? this.burnt.glass : this.burnt.body);
    });
    if (v.wheels) for (const w of v.wheels) w.o.visible = Math.random() < 0.6;
    v.wreckT = 0;
    if (!v.box) this.block(v);
  },
  // 연기 · 불길 (부서진 정도에 따라)
  burnFx(v, dt) {
    if (v.pos.distanceTo(G.camera.position) > 220) return;
    const e = this.engine(v, _c);
    const hpK = v.hp / HP;
    if (v.dead) {
      v.wreckT += dt;
      if (v.wreckT < 14) {         // 남은 불
        if (Math.random() < dt * 26) this.flame(this.center(v, _e).add(_o.set((Math.random() - 0.5) * v.dim.hw, 0.2, (Math.random() - 0.5) * v.dim.hl)), 0.8);
        if (Math.random() < dt * 9) G.FX.dust(_e.copy(this.center(v, _e)).add(_o.set(0, 0.8, 0)), 1, 0, 1.6, 0, 0.09, 0.085, 0.08, 2.4);
      } else if (v.wreckT < 45 && Math.random() < dt * 4) G.FX.dust(_e.copy(this.center(v, _e)).add(_o.set(0, 0.6, 0)), 1, 0, 1.2, 0, 0.2, 0.19, 0.18, 2);
      return;
    }
    if (v.burnT > 0) {             // 터지기 직전: 보닛에서 불길
      if (Math.random() < dt * 60) this.flame(_e.copy(e).add(_o.set((Math.random() - 0.5) * 0.8, 0.1, (Math.random() - 0.5) * 0.7)), 1.1);
      if (Math.random() < dt * 14) G.FX.dust(_e.copy(e).add(_o.set(0, 0.5, 0)), 1, 0, 1.8, 0, 0.08, 0.07, 0.07, 2.2);
    } else if (hpK < 0.55 && Math.random() < dt * (hpK < 0.3 ? 16 : 7)) {
      const g = hpK < 0.3 ? 0.12 : 0.45;
      G.FX.dust(_e.copy(e).add(_o.set(0, 0.25, 0)), 1, 0, 1.3, 0, g, g, g * 0.97, hpK < 0.3 ? 1.8 : 1.3);
    }
  },
  flame(p, k) {
    G.FX.add.spawn({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 0.6, vy: 1.6 + Math.random() * 1.6, vz: (Math.random() - 0.5) * 0.6,
      life: 0.4 + Math.random() * 0.4, s0: 0.85 * k, s1: 0.15, r: 6, g: 2.4 + Math.random() * 0.8, b: 0.6, a: 0.85, drag: 1.2, grav: -1.5 });
  },
  /* ---------------- 봇 운전 ---------------- */
  // 봇이 탈 만한 빈 차 (다른 봇이 찜하지 않은 것)
  freeNear(a, r) {
    let best = null, bd = r;
    for (const v of this.list) {
      if (v.driver || v.dead || v.hp < HP * 0.3 || (v.claim && v.claim !== a && v.claim.alive)) continue;
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
    for (const v of this.list) {
      if (v.hp < HP * 0.55 || v.dead) this.burnFx(v, dt);
      if (v.burnT > 0) {
        v.burnT -= dt;
        if (v.burnT <= 0) this.explode(v);
      }
      if (v.hop) {
        v.hop.vy -= 18 * dt; v.hop.y += v.hop.vy * dt;
        v.tilt.x = U.damp(v.tilt.x, v.tilt.tx, 3, dt); v.tilt.z = U.damp(v.tilt.z, v.tilt.tz, 3, dt);
        if (v.hop.y <= 0 && v.hop.vy < 0) { v.hop.y = 0; if (v.hop.vy < -3) { v.hop.vy *= -0.25; G.Audio.impact(v.pos, 'metal'); } else { v.hop = null; } }
        this.place(v, 1);
      }
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
      if (v.speed === 0 && !v.lat) continue;
      v.speed = approach(v.speed, 0, 9 * dt); v.lat = approach(v.lat || 0, 0, 12 * dt);
      _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
      const nx = v.pos.x + (_f.x * v.speed + _r.x * v.lat) * dt, nz = v.pos.z + (_f.z * v.speed + _r.z * v.lat) * dt;
      let hit = false;
      G.World.queryBoxes(nx - 1.2, nz - 1.2, nx + 1.2, nz + 1.2, b => { if (b.maxY > v.pos.y + 0.55 && b.minY < v.pos.y + 1.7) hit = true; });
      if (hit) { v.speed = 0; v.lat = 0; } else { v.pos.x = nx; v.pos.z = nz; }
      this.place(v, 1 - Math.exp(-10 * dt));
      this.wheelAnim(v, dt);
      if (v.speed === 0 && !v.lat && !v.box) this.block(v);
    }
  },
  draw(ctx, toS, scale) {
    for (const v of this.list) {
      const [x, y] = toS(v.pos.x, v.pos.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-v.yaw);
      ctx.fillStyle = v.dead ? '#3a3633' : v.driver ? '#ffd23f' : '#e8e8e8'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.fillRect(-2.6 * scale, -4.4 * scale, 5.2 * scale, 8.8 * scale); ctx.strokeRect(-2.6 * scale, -4.4 * scale, 5.2 * scale, 8.8 * scale);
      ctx.restore();
    }
  }
};
function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }

})();
