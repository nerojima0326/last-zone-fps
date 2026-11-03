// player.js — 플레이어 조작: 이동, 사격, 정조준, 재장전, 투척, 치료, 소생, 강하, 관전
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;
const BASE_FOV = 80;
const _f = new V3(), _r = new V3(), _d = new V3(), _m = new V3(), _e = new V3(), _u = new V3(), _c = new V3(), _q = new V3();
const SLOT_ORDER = ['rifle', 'shotgun', 'pistol', 'throw'];

const P = G.Player = {
  a: null, sens: 1,
  init(actor) {
    this.a = actor;
    this.ads = 0; this.nextFire = 0; this.lastShot = -9; this.recoilAcc = 0;
    this.reload = null; this.sw = null; this.raise = 1; this.pumpT = -1; this.punchT = -1; this.cycleT = -1;
    this.scopeView = 0; this.breath = 1; this.breathLock = false; this.swayT = 0; this._rl = {};
    this.throwSt = null; this.throwKind = 'frag';
    this.heal = null; this.revive = null;
    this.bloom = 0; this.fireMode = 'auto';
    this.camY = 0; this.landDip = 0; this.stepPhase = 0; this.stepDist = 0; this.camKick = 0;
    this.flashAmt = 0; this.flashHold = 0;
    this.orbitYaw = 0; this.orbitPitch = -0.3; this.specIdx = 0;
    this.dropT = 0; this.indoor = 0; this.indoorT = 0;
    this.prompt = ''; this.lootTarget = null; this.reviveTarget = null;
    this.camMode = 'plane';
    this.time = 0;
  },
  look(scale) {
    const I = G.Input, a = this.a;
    const k = 0.0022 * this.sens * scale;
    a.yaw -= I.mdx * k;
    a.pitch = U.clamp(a.pitch - I.mdy * k, -1.45, 1.45);
  },
  update(dt) {
    const a = this.a;
    this.time += dt;
    if (!a.alive) { this.updateSpectate(dt); this.updateFlash(dt); return; }
    if (a.state === 'plane') this.updatePlane(dt);
    else if (a.state === 'freefall' || a.state === 'chute') this.updateDrop(dt);
    else this.updateGround(dt);
    this.updateFlash(dt);
    G.Audio.setListener(G.camera.position, this.camMode === 'fp' ? a.yaw : this.orbitYaw);
  },

  /* ---------------- 비행기 ---------------- */
  updatePlane(dt) {
    const I = G.Input, cam = G.camera, pl = G.Game.plane;
    this.camMode = 'plane';
    this.orbitYaw -= I.mdx * 0.003 * this.sens; this.orbitPitch = U.clamp(this.orbitPitch - I.mdy * 0.003 * this.sens, -1.2, 0.5);
    const dist = 34;
    _c.set(Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch), -Math.sin(this.orbitPitch), Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch)).multiplyScalar(dist);
    cam.position.copy(pl.pos).add(_c);
    cam.lookAt(pl.pos);
    cam.fov = U.damp(cam.fov, 70, 5, dt); cam.updateProjectionMatrix();
    G.VM.set(null);
    if (I.hit('KeyF') && G.Game.planeCanJump()) G.Game.jump(this.a);
    G.Audio.setLoop('plane', 0.5);
    G.Audio.setLoop('wind', 0.05);
  },

  /* ---------------- 강하 ---------------- */
  updateDrop(dt) {
    const I = G.Input, a = this.a, cam = G.camera, W = G.World;
    this.camMode = 'drop';
    this.dropT += dt;
    this.orbitYaw -= I.mdx * 0.0028 * this.sens;
    this.orbitPitch = U.clamp(this.orbitPitch - I.mdy * 0.0028 * this.sens, -1.3, 0.6);
    a.yaw = this.orbitYaw; a.pitch = 0;
    const fwd = (I.down('KeyW') ? 1 : 0) - (I.down('KeyS') ? 1 : 0), str = (I.down('KeyD') ? 1 : 0) - (I.down('KeyA') ? 1 : 0);
    _f.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw)); _r.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
    const gh = W.ground(a.pos.x, a.pos.z, a.pos.y, 0.3, 0.5);
    const agl = a.pos.y - Math.max(gh, W.waterAt(a.pos.x, a.pos.z));
    let hs, vs;
    if (a.state === 'freefall') {
      hs = fwd > 0 ? 34 : fwd < 0 ? 5 : 15; vs = fwd > 0 ? -62 : fwd < 0 ? -40 : -48;
      if ((I.hit('KeyF') && agl < 260 && this.dropT > 1) || agl < 110) G.Game.openChute(a);
      G.Audio.setLoop('wind', U.clamp(-a.vel.y / 60, 0.2, 0.9));
    } else {
      hs = fwd > 0 ? 13 : fwd < 0 ? 3 : 8; vs = fwd > 0 ? -8.5 : -5.2;
      G.Audio.setLoop('wind', 0.15);
    }
    _d.copy(_f).multiplyScalar(hs).addScaledVector(_r, str * (a.state === 'freefall' ? 9 : 5));
    const k = a.state === 'freefall' ? 1.6 : 2.5;
    a.vel.x = U.damp(a.vel.x, _d.x, k, dt); a.vel.z = U.damp(a.vel.z, _d.z, k, dt);
    a.vel.y = U.damp(a.vel.y, vs, a.state === 'freefall' ? 1.2 : 3, dt);
    a.pos.addScaledVector(a.vel, dt);
    const lim = W.HALF - 5; a.pos.x = U.clamp(a.pos.x, -lim, lim); a.pos.z = U.clamp(a.pos.z, -lim, lim);
    G.Audio.setLoop('plane', G.Game.plane && G.Game.plane.mesh.visible ? 0.4 * 120 / (120 + G.Game.plane.pos.distanceTo(a.pos)) : 0);
    const g2 = W.ground(a.pos.x, a.pos.z, a.pos.y + 0.5, 0.3, 0.6);
    if (a.pos.y <= g2 + 0.02 || (a.pos.y < W.waterAt(a.pos.x, a.pos.z) - 1.2)) { G.Game.land(a); this.onLand(); return; }
    // 3인칭 카메라
    const dist = a.state === 'freefall' ? 7 : 11;
    _c.set(Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch), -Math.sin(this.orbitPitch) + 0.15, Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch)).multiplyScalar(dist);
    _e.copy(a.pos); _e.y += a.state === 'chute' ? 2.5 : 1;
    cam.position.copy(_e).add(_c);
    cam.lookAt(_e);
    cam.fov = U.damp(cam.fov, a.state === 'freefall' ? 85 : 75, 4, dt); cam.updateProjectionMatrix();
    G.VM.set(null);
    this.altitude = agl;
  },
  onLand() {
    const a = this.a;
    a.pitch = 0; this.camY = a.pos.y + a.eyeH();
    a.cur = a.bestGun();
    this.raise = 0; this.sw = { t: 0.2, to: a.cur };
    G.Audio.setLoop('wind', 0); G.Audio.setLoop('plane', 0);
    G.Audio.click('land');
    this.landDip = 1;
  },

  /* ---------------- 지상 ---------------- */
  updateGround(dt) {
    const I = G.Input, a = this.a, cam = G.camera, W = G.World, now = this.time;
    this.camMode = 'fp';
    const inst = a.weapons[a.cur], def = inst ? G.WEAPONS[inst.id] : G.WEAPONS[a.cur];
    const isGun = !!inst && def && def.pellets;
    // 시점
    this.look(cam.fov / BASE_FOV);
    if (now - this.lastShot > 0.14 && this.recoilAcc > 0) {
      const r = Math.min(this.recoilAcc, dt * 0.45);
      a.pitch -= r * 0.75; this.recoilAcc -= r;
    }
    // 이동
    const fwd = (I.down('KeyW') ? 1 : 0) - (I.down('KeyS') ? 1 : 0), str = (I.down('KeyD') ? 1 : 0) - (I.down('KeyA') ? 1 : 0);
    if (I.hit('KeyC') && !a.knocked) { if (a.crouch) { if (G.Physics.canStand(a)) a.crouch = false; } else a.crouch = true; }
    const sprint = I.down('ShiftLeft') && fwd > 0 && this.ads < 0.3 && !a.crouch && !a.knocked && !this.heal && !(I.lmb && isGun && !this.reload);
    this.sprinting = sprint;
    let speed = a.knocked ? 1.1 : sprint ? 6.8 : a.crouch ? 2.3 : 4.6;
    if (this.ads > 0.5) speed *= 0.62;
    if (this.heal) speed = Math.min(speed, 1.6);
    if (this.revive) speed = 0;
    if (a.swimming) speed = sprint ? 3.6 : 2.6;
    else if (a.inWater) speed *= 0.75;
    _f.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw)); _r.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
    _d.set(0, 0, 0).addScaledVector(_f, fwd).addScaledVector(_r, str);
    if (_d.lengthSq() > 0) _d.normalize().multiplyScalar(speed);
    const acc = a.onGround ? 48 : 7;
    a.vel.x = approach(a.vel.x, _d.x, acc * dt); a.vel.z = approach(a.vel.z, _d.z, acc * dt);
    if (I.hit('Space') && a.onGround && !a.knocked && !a.swimming) {
      if (a.crouch) { if (G.Physics.canStand(a)) a.crouch = false; }
      else { a.vel.y = 7.2; this.cancelHeal(); }
    }
    G.Physics.move(a, dt);
    if (a.landV < -6) {
      this.landDip = U.clamp(-a.landV / 16, 0.3, 1);
      G.Audio.click('land');
      if (a.landV < -15) G.Game.damage(a, (-a.landV - 15) * 7, null, 'fall', false, a.pos, null);
    }
    // 발소리
    if (a.onGround && a.hspeed > 1.2) {
      this.stepDist += a.hspeed * dt;
      const stride = sprint ? 2.5 : a.crouch ? 1.4 : 1.9;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        const surf = a.inWater ? 'water' : a.groundMat === 'terrain' ? 'grass' : a.groundMat;
        G.Audio.footstep(null, surf, a.crouch ? 0.18 : sprint ? 0.5 : 0.32);
      }
    }
    this.stepPhase += a.onGround ? a.hspeed * dt * 1.75 : 0;
    // 실내 판정 (뷰모델 조명용)
    this.indoorT -= dt;
    if (this.indoorT <= 0) { this.indoorT = 0.25; this.indoorTarget = W.covered(a.pos.x, a.pos.y + 2, a.pos.z) ? 1 : 0; }
    this.indoor = U.damp(this.indoor, this.indoorTarget || 0, 4, dt);

    if (!a.knocked) this.weaponsLogic(dt, now);
    else { this.ads = 0; this.scopeView = 0; this.reload = null; this.throwSt = null; this.heal = null; this.cycleT = -1; }
    this.interact(dt);
    this.healLogic(dt);
    this.updateCamera(dt);
  },
  weaponsLogic(dt, now) {
    const I = G.Input, a = this.a;
    // 슬롯
    if (I.hit('Digit1')) this.switchTo('rifle');
    if (I.hit('Digit2')) this.switchTo('shotgun');
    if (I.hit('Digit3')) this.switchTo('pistol');
    if (I.hit('Digit4')) { if (a.cur === 'throw') this.cycleThrow(); else this.switchTo('throw'); }
    if (I.wheel !== 0 && !this.throwSt) {
      const avail = SLOT_ORDER.filter(s => s === 'throw' ? a.throwCount() > 0 : !!a.weapons[s]);
      if (avail.length) {
        let i = avail.indexOf(this.sw ? this.sw.to : a.cur);
        i = (i + (I.wheel > 0 ? 1 : -1) + avail.length) % avail.length;
        this.switchTo(avail[i]);
      }
    }
    if (I.hit('KeyG') && !this.throwSt && a.throwCount() > 0) {
      if (this.throwSt) { /* 이미 투척 중 */ }
      else { if (a.throwables[this.throwKind] <= 0) this.cycleThrow(); this.startThrow(false, a.cur !== 'throw'); }
    }
    if (I.hit('KeyB')) { const d = a.wdef(a.cur); if (d && d.auto) { this.fireMode = this.fireMode === 'auto' ? 'single' : 'auto'; G.Audio.click('switch'); } }
    if (I.hit('KeyV')) this.cycleScope();
    if (I.hit('KeyR')) this.startReload();
    if (I.hit('KeyH')) this.startHeal();

    // 교체
    if (this.sw) {
      this.sw.t += dt;
      const t = this.sw.t;
      if (t >= 0.2 && a.cur !== this.sw.to) { a.cur = this.sw.to; if (a.cur === 'throw') G.VM.setThrowKind(this.throwKind); }
      this.raise = t < 0.2 ? Math.min(this.raise, 1 - t / 0.2) : U.clamp((t - 0.2) / 0.26, 0, 1);
      if (t >= 0.46) { this.sw = null; this.raise = 1; }
    }
    const inst = a.weapons[a.cur], def = inst ? G.WEAPONS[inst.id] : G.WEAPONS[a.cur];
    const isGun = !!inst && !!def && !!def.pellets;
    // 정조준 (볼트를 당기는 동안은 조준이 풀린다)
    const wantAds = I.rmb && isGun && !this.sw && !this.reload && !this.sprinting && a.cur !== 'throw' && this.cycleT < 0;
    const zoom = isGun ? this.zoomOf(inst, def) : 1;
    this.ads = approach(this.ads, wantAds ? 1 : 0, dt / ((isGun ? def.adsTime : 0.17) + (zoom > 1 ? 0.06 : 0)));
    this.scopeView = zoom > 1 ? U.smoothstep(0.8, 1, this.ads) : 0;
    // 숨 참기 (배율 조준 중 Shift): 흔들림이 줄어든다
    const hold = zoom > 1 && this.ads > 0.8 && I.down('ShiftLeft') && !this.breathLock && this.breath > 0;
    this.holding = hold;
    if (hold) { this.breath = Math.max(0, this.breath - dt / 5); if (this.breath <= 0) this.breathLock = true; }
    else { this.breath = Math.min(1, this.breath + dt / 4); if (this.breath > 0.6) this.breathLock = false; }
    this.bloom = Math.max(0, this.bloom - dt * 0.07);
    this.camKick = U.damp(this.camKick, 0, 12, dt);
    // 재장전
    if (this.reload) this.reloadLogic(dt);
    // 펌프
    if (this.pumpT >= 0) {
      const prev = this.pumpT;
      this.pumpT += dt;
      if (prev < 0.12 && this.pumpT >= 0.12) G.Audio.click('pump');
      if (prev < 0.3 && this.pumpT >= 0.3) this.ejectShell(true);
      if (this.pumpT > 0.6) this.pumpT = -1;
    }
    // 볼트 조작 (볼트액션)
    if (this.cycleT >= 0) {
      const cyc = (isGun && def.cycle) || 0.9, c0 = this.cycleT / cyc;
      this.cycleT += dt;
      const c1 = this.cycleT / cyc;
      if (c0 < 0.26 && c1 >= 0.26) G.Audio.click('bolt');
      if (c0 < 0.4 && c1 >= 0.4) this.ejectShell(false);
      if (c1 >= 1) this.cycleT = -1;
    }
    // 사격
    if (isGun && !this.sw && !this.throwSt) {
      const trigger = (def.auto && this.fireMode === 'auto') ? I.lmb : I.lmbHit;
      if (trigger) {
        const R = this.reload;
        if (R && R.kind === 'shell' && inst.mag > 0 && R.phase !== 'end') this.reload = null;
        else if (R && R.kind === 'break' && inst.mag > 0 && R.phase === 'load') { R.phase = 'end'; R.t = 0; }
        if (!this.reload && now >= this.nextFire && this.cycleT < 0) {
          if (inst.mag > 0) this.fire(def, inst, now);
          else if (I.lmbHit) { G.Audio.click('dry'); this.nextFire = now + 0.25; if (a.ammo[def.ammo] > 0) this.startReload(); }
        }
      }
    }
    // 맨손
    if (a.cur === 'fists' && !this.sw) {
      if (I.lmbHit && now >= this.nextFire) { this.punchT = 0; this.nextFire = now + 0.55; G.Audio.click('punch'); this.punchHit = false; }
    }
    if (this.punchT >= 0) {
      this.punchT += dt;
      if (this.punchT > 0.12 && !this.punchHit) { this.punchHit = true; this.doPunch(); }
      if (this.punchT > 0.4) this.punchT = -1;
    }
    // 투척
    if (a.cur === 'throw' && !this.sw && !this.throwSt) {
      if (a.throwables[this.throwKind] <= 0) { if (!this.cycleThrow()) this.switchTo(a.bestGun()); }
      else if (I.lmbHit) this.startThrow(false, false);
      else if (I.rmbHit) this.startThrow(true, false);
    }
    if (this.throwSt) this.throwLogic(dt);
  },
  switchTo(slot) {
    const a = this.a;
    if (this.throwSt) return;
    if (slot === 'throw') { if (a.throwCount() <= 0) return; if (a.throwables[this.throwKind] <= 0) this.cycleThrow(); }
    else if (slot !== 'fists' && !a.weapons[slot]) return;
    if ((this.sw ? this.sw.to : a.cur) === slot) return;
    this.reload = null; this.cycleT = -1;
    this.sw = { t: this.sw && this.sw.t < 0.2 ? this.sw.t : 0, to: slot };
    G.Audio.click('switch');
  },
  cycleThrow() {
    const a = this.a, order = G.THROW_ORDER;
    let i = order.indexOf(this.throwKind);
    for (let k = 1; k <= order.length; k++) {
      const n = order[(i + k) % order.length];
      if (a.throwables[n] > 0) { this.throwKind = n; G.VM.setThrowKind(n); if (k < order.length) G.Audio.click('switch'); return true; }
    }
    return false;
  },
  currentSpread(def) {
    const a = this.a;
    let s = U.lerp(def.spread, def.ads, this.ads) + this.bloom;
    s += U.clamp(a.hspeed / 4.6, 0, 1.5) * def.move * (1 - this.ads * 0.5);
    if (!a.onGround) s += 0.06;
    if (a.crouch) s *= 0.8;
    return s;
  },
  fire(def, inst, now) {
    const a = this.a, cam = G.camera;
    inst.mag--;
    this.nextFire = now + Math.max(60 / def.rpm, def.action === 'bolt' ? def.cycle : 0);
    this.lastShot = now;
    cam.getWorldDirection(_f);
    _r.set(1, 0, 0).applyQuaternion(cam.quaternion); _u.set(0, 1, 0).applyQuaternion(cam.quaternion);
    G.VM.muzzleWorld(cam, _m);
    const spread = this.currentSpread(def);
    for (let k = 0; k < def.pellets; k++) {
      const rr = spread * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
      _d.copy(_f).addScaledVector(_r, Math.cos(th) * rr).addScaledVector(_u, Math.sin(th) * rr).normalize();
      G.Ballistics.fire(a, cam.position, _d, def, _m, def.pellets === 1 || k < 3);
    }
    const rv = def.recoilV * (this.ads > 0.5 ? 0.7 : 1) * (a.crouch ? 0.82 : 1) * U.rand(0.85, 1.15);
    a.pitch = Math.min(1.45, a.pitch + rv); this.recoilAcc += rv;
    a.yaw += def.recoilH * U.rand(-1, 1.25);
    this.camKick += def.kick * 0.012;
    this.bloom = Math.min(def.bloomMax, this.bloom + def.bloom);
    G.VM.fireKick(def.kick);
    G.FX.light(_m, 0xffaa55, 22, 0.06, 12);
    G.Audio.shot(def.sound, a.pos, true);
    G.Game.onShot(a, def);
    if (def.action === 'pump') this.pumpT = 0;
    else if (def.action === 'bolt') { if (inst.mag > 0) this.cycleT = 0; }
    else if (def.action !== 'break' && def.reloadType !== 'revolver') this.ejectShell(def.cls === 'shotgun');
    if (inst.mag === 0 && a.ammo[def.ammo] > 0) setTimeout(() => { if (this.a === a && a.weapons[a.cur] === inst && inst.mag === 0) this.startReload(); }, 220);
  },
  ejectShell(red) {
    const cam = G.camera;
    _r.set(1, 0, 0).applyQuaternion(cam.quaternion); _u.set(0, 1, 0).applyQuaternion(cam.quaternion); cam.getWorldDirection(_f);
    _q.copy(cam.position).addScaledVector(_r, 0.12).addScaledVector(_u, -0.08).addScaledVector(_f, 0.35);
    _e.copy(_r).multiplyScalar(U.rand(2, 3)).addScaledVector(_u, U.rand(1.2, 2)).addScaledVector(_f, U.rand(-0.3, 0.3)).add(this.a.vel);
    G.FX.shell(_q, _e, red);
  },
  startReload() {
    const a = this.a, inst = a.weapons[a.cur], def = inst && G.WEAPONS[inst.id];
    if (!inst || !def || !def.pellets || this.reload || this.sw || this.throwSt) return;
    if (inst.mag >= def.mag || a.ammo[def.ammo] <= 0) return;
    const empty = inst.mag === 0;
    if (def.reloadType === 'shell' || def.reloadType === 'break') this.reload = { kind: def.reloadType, phase: 'start', t: 0, shellT: 0, empty };
    else this.reload = { kind: def.reloadType, t: 0, dur: def.reload, s: 0, empty };
    this.cycleT = -1;
    this.cancelHeal();
  },
  // 산탄 장전 단계별 시간
  phaseDur(R, def) {
    const k = 1 / (G.RELOAD_SPEED || 1);
    if (R.phase === 'start') return (R.kind === 'break' ? 0.5 : 0.35) * k;
    if (R.phase === 'end') return (R.kind === 'break' ? 0.4 : (def.action === 'pump' && R.empty ? 0.62 : 0.3)) * k;
    return def.reload;
  },
  reloadLogic(dt) {
    const a = this.a, inst = a.weapons[a.cur], def = inst && G.WEAPONS[inst.id], R = this.reload;
    if (!inst || !def) { this.reload = null; return; }
    R.t += dt;
    if (R.kind === 'mag' || R.kind === 'revolver') {
      const p = R.t / R.dur;
      if (R.s === 0 && p > 0.15) { R.s = 1; G.Audio.click(R.kind === 'revolver' ? 'bolt' : 'magout'); }
      if (R.s === 1 && p > 0.62) { R.s = 2; G.Audio.click('magin'); }
      if (R.s === 2 && p > (R.kind === 'revolver' ? 0.76 : 0.85)) { R.s = 3; if (R.empty || R.kind === 'revolver') G.Audio.click('bolt'); }
      if (p >= 1) {
        const n = Math.min(def.mag - inst.mag, a.ammo[def.ammo]);
        inst.mag += n; a.ammo[def.ammo] -= n;
        this.reload = null;
      }
    } else {
      const pd = this.phaseDur(R, def);
      if (R.phase === 'start') {
        if (R.kind === 'break' && !R.ej && R.t > 0.28 / (G.RELOAD_SPEED || 1)) { R.ej = true; G.Audio.click('bolt'); for (let i = inst.mag; i < def.mag; i++) this.ejectShell(true); }
        if (R.t > pd) { R.phase = 'load'; R.t = 0; R.shellT = 0; }
      } else if (R.phase === 'load') {
        R.shellT += dt;
        if (!R.snd && R.shellT >= def.reload * 0.55) { R.snd = true; G.Audio.click('shell'); }
        if (R.shellT >= def.reload) {
          R.shellT = 0; R.snd = false;
          inst.mag++; a.ammo[def.ammo]--;
          if (inst.mag >= def.mag || a.ammo[def.ammo] <= 0) { R.phase = 'end'; R.t = 0; }
        }
      } else if (R.phase === 'end') {
        if (def.action === 'pump' && R.empty && !R.pumped && R.t > 0.12 / (G.RELOAD_SPEED || 1)) { R.pumped = true; this.pumpT = 0.05; }
        if (R.kind === 'break' && !R.closed && R.t > 0.22 / (G.RELOAD_SPEED || 1)) { R.closed = true; G.Audio.click('magin'); }
        if (R.t > pd) this.reload = null;
      }
    }
  },
  // 현재 총의 조준경 배율
  zoomOf(inst, def) {
    const sc = inst.scope || def.baseSight;
    return sc ? G.SCOPES[sc].zoom : 1;
  },
  // V: 가방의 조준경으로 바꿔 끼우기 (없음 → 가진 조준경 순서대로)
  cycleScope() {
    const a = this.a, inst = a.weapons[a.cur];
    if (!inst || this.reload) return;
    const def = G.WEAPONS[inst.id];
    const opts = [null].concat(G.SCOPE_ORDER.filter(t => def.scopes.includes(t) && t !== def.baseSight && (a.scopes[t] > 0 || inst.scope === t)));
    if (opts.length <= 1) { G.UI.toast(def.scopes.length ? '장착할 수 있는 조준경이 없습니다' : '이 총에는 조준경을 달 수 없습니다'); return; }
    const i = opts.indexOf(inst.scope || null);
    const next = opts[(i + 1) % opts.length];
    if (inst.scope) a.scopes[inst.scope]++;
    if (next) a.scopes[next]--;
    inst.scope = next;
    G.Audio.click('switch');
    G.UI.toast(next ? G.SCOPES[next].name + ' 장착' : (def.baseSight ? G.SCOPES[def.baseSight].name + ' (기본)' : '가늠쇠 사용'));
  },
  doPunch() {
    const a = this.a;
    a.lookDir(_f);
    a.eye(_e);
    for (const t of G.Game.actors) {
      if (!t.alive || t.team === a.team || t.state !== 'ground') continue;
      t.chest(_c);
      _d.copy(_c).sub(_e);
      const d = _d.length();
      if (d > 2.0) continue;
      _d.divideScalar(d);
      if (_d.dot(_f) < 0.7) continue;
      G.Game.damage(t, G.WEAPONS.fists.dmg, a, 'fists', false, _c, _f);
      G.FX.blood(_c, _f.x, _f.y, _f.z, 4);
      G.Audio.impact(_c, 'flesh');
      break;
    }
  },
  startThrow(under, quick) {
    const a = this.a;
    if (a.throwables[this.throwKind] <= 0 && !this.cycleThrow()) return;
    this.reload = null;
    this.throwSt = { t: 0, kind: this.throwKind, under, quick, prev: quick ? (this.sw ? this.sw.to : a.cur) : null, released: false };
    this.sw = null; this.raise = 1;
    a.cur = 'throw';
    G.VM.set('throw'); G.VM.setThrowKind(this.throwKind);
    G.Audio.click('pin');
  },
  throwLogic(dt) {
    const a = this.a, T = this.throwSt, cam = G.camera;
    T.t += dt;
    if (!T.released && T.t >= 0.33) {
      T.released = true;
      if (a.throwables[T.kind] > 0) {
        a.throwables[T.kind]--;
        cam.getWorldDirection(_f);
        _r.set(1, 0, 0).applyQuaternion(cam.quaternion);
        _q.copy(cam.position).addScaledVector(_f, 0.45).addScaledVector(_r, 0.15);
        _q.y -= 0.05;
        if (T.under) _d.copy(_f).multiplyScalar(9).add(_e.set(0, 2.2, 0));
        else _d.copy(_f).multiplyScalar(21).add(_e.set(0, 2.6, 0));
        _d.addScaledVector(a.vel, 0.6);
        G.Throwables.throw(a, T.kind, _q, _d);
        if (a.model) a.model.throwT = 0.5;
      }
    }
    if (T.t >= 0.68) {
      this.throwSt = null;
      if (T.quick && T.prev && T.prev !== 'throw') { a.cur = T.prev; this.raise = 0; this.sw = { t: 0.2, to: T.prev }; }
      else if (a.throwables[T.kind] <= 0) { if (!this.cycleThrow()) { a.cur = a.bestGun(); this.raise = 0; this.sw = { t: 0.2, to: a.cur }; } else G.VM.setThrowKind(this.throwKind); }
      else G.VM.setThrowKind(this.throwKind);
    }
  },
  startHeal() {
    const a = this.a;
    if (this.heal) { this.cancelHeal(); return; }
    if (a.knocked) return;
    if (a.hp >= 100) { G.UI.toast('체력이 가득 찼습니다'); return; }
    let kind = null;
    if (a.meds.medkit > 0 && (a.hp < 60 || a.meds.bandage === 0 || a.hp >= 75)) kind = 'medkit';
    else if (a.meds.bandage > 0 && a.hp < 75) kind = 'bandage';
    if (!kind) { G.UI.toast(a.meds.bandage > 0 ? '붕대로는 체력 75까지만 회복됩니다' : '치료 아이템이 없습니다'); return; }
    this.heal = { kind, t: 0, dur: kind === 'medkit' ? 6 : 3.5, snd: 0 };
    this.reload = null; this.ads = 0;
  },
  cancelHeal() { this.heal = null; },
  healLogic(dt) {
    const a = this.a, H = this.heal;
    if (!H) return;
    if (a.knocked || G.Input.lmbHit || this.sw || this.throwSt) { this.heal = null; return; }
    H.t += dt; H.snd -= dt;
    if (H.snd <= 0) { H.snd = 1.1; G.Audio.click('heal'); }
    if (H.t >= H.dur) {
      if (H.kind === 'medkit' && a.meds.medkit > 0) { a.meds.medkit--; a.hp = 100; }
      else if (H.kind === 'bandage' && a.meds.bandage > 0) { a.meds.bandage--; a.hp = Math.min(75, a.hp + 20); }
      G.Audio.click('healdone');
      this.heal = null;
    }
  },
  interact(dt) {
    const I = G.Input, a = this.a, Game = G.Game;
    this.prompt = ''; this.lootTarget = null; this.reviveTarget = null;
    a.eye(_e);
    // 소생
    if (!a.knocked) {
      let best = null, bd = 2.3;
      for (const m of Game.teams[a.team].members) {
        if (m === a || !m.alive || !m.knocked) continue;
        const d = Math.hypot(m.pos.x - a.pos.x, m.pos.z - a.pos.z);
        if (d < bd && Math.abs(m.pos.y - a.pos.y) < 1.5) { bd = d; best = m; }
      }
      if (best) {
        this.reviveTarget = best;
        if (I.down('KeyF')) {
          if (!this.revive || this.revive.target !== best) this.revive = { target: best, t: 0 };
          this.revive.t += dt;
          if (this.revive.t >= 5) { Game.revive(best, a); this.revive = null; }
        } else this.revive = null;
        if (!this.revive) this.prompt = '<kbd>F</kbd> 길게 눌러 <b>' + esc(best.name) + '</b> 소생';
        return;
      }
    }
    this.revive = null;
    if (a.knocked) return;
    a.lookDir(_f);
    const it = Game.lootNear(_e, _f);
    if (it) {
      this.lootTarget = it;
      this.prompt = '<kbd>F</kbd> ' + Game.lootLabel(it);
      if (I.hit('KeyF')) {
        const hadGun = a.hasGun(), before = a.weapons[a.cur];
        const res = Game.pickup(a, it);
        if (a.weapons[a.cur] !== before && a.cur !== 'throw') { this.reload = null; this.cycleT = -1; this.raise = 0; this.sw = { t: 0.2, to: a.cur }; }
        if (res) {
          G.UI.pickup(res);
          G.Audio.click('pickup');
          if (!hadGun && a.hasGun()) this.switchTo(a.bestGun());
          else if (a.cur === 'fists' && a.hasGun()) this.switchTo(a.bestGun());
        } else G.UI.toast('더 이상 가질 수 없습니다');
      }
    }
  },
  updateCamera(dt) {
    const a = this.a, cam = G.camera;
    const target = a.pos.y + a.eyeH();
    if (Math.abs(this.camY - target) > 1.6) this.camY = target;
    else this.camY = U.damp(this.camY, target, a.onGround ? 16 : 40, dt);
    this.landDip = U.damp(this.landDip, 0, 6, dt);
    const bob = a.onGround ? Math.sin(this.stepPhase * 2) * 0.022 * U.clamp(a.hspeed / 5, 0, 1.3) * (1 - this.ads * 0.8) : 0;
    const sh = G.FX.shakeAmt;
    cam.position.set(a.pos.x + (Math.random() - 0.5) * sh * 0.06, this.camY + bob - this.landDip * 0.12 + (Math.random() - 0.5) * sh * 0.06, a.pos.z + (Math.random() - 0.5) * sh * 0.06);
    cam.rotation.set(a.pitch + this.camKick + (Math.random() - 0.5) * sh * 0.02, a.yaw + (Math.random() - 0.5) * sh * 0.02, (Math.random() - 0.5) * sh * 0.015, 'YXZ');
    const inst = a.weapons[a.cur], def = inst ? G.WEAPONS[inst.id] : G.WEAPONS[a.cur];
    const scope = inst ? (inst.scope || def.baseSight || null) : null;
    const zoom = scope ? G.SCOPES[scope].zoom : 1;
    let adsFov = def && def.adsFov ? def.adsFov : BASE_FOV;
    if (zoom > 1) adsFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) / zoom));
    const fov = U.lerp(BASE_FOV, adsFov, this.ads) + (this.sprinting ? 4 : 0);
    cam.fov = zoom > 1 && this.ads > 0.95 ? fov : U.damp(cam.fov, fov, 18, dt);
    cam.updateProjectionMatrix();
    // 배율 조준경 흔들림 (Shift 로 숨 참기)
    if (zoom >= 2 && this.ads > 0.5) {
      this.swayT += dt;
      const amp = (zoom >= 8 ? 0.0032 : zoom >= 4 ? 0.0022 : 0.0012) * (this.holding ? 0.12 : this.breathLock ? 1.7 : 1) * (a.crouch ? 0.6 : 1) * (1 + U.clamp(a.hspeed / 4, 0, 1.5)) * this.ads;
      const t = this.swayT;
      cam.rotation.x += (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3 + 1) * 0.25) * amp;
      cam.rotation.y += (Math.cos(t * 0.7) * 0.6 + Math.sin(t * 1.9) * 0.3) * amp;
    }
    G.vmCamera.fov = U.lerp(54, 46, this.ads); G.vmCamera.updateProjectionMatrix();
    // 뷰모델
    const showVM = !a.knocked && a.cur !== null;
    G.VM.set(showVM ? (inst ? inst.id : a.cur) : null);
    const R = this.reload;
    let rl = null;
    if (R && def) {
      rl = this._rl; rl.type = R.kind; rl.empty = R.empty;
      if (R.kind === 'mag' || R.kind === 'revolver') { rl.p = R.t / R.dur; rl.phase = null; rl.shellP = -1; }
      else { rl.phase = R.phase; rl.pp = R.phase === 'load' ? 0 : U.clamp(R.t / this.phaseDur(R, def), 0, 1); rl.shellP = R.phase === 'load' ? R.shellT / def.reload : -1; }
    }
    G.VM.update(dt, {
      ads: this.ads, sprint: this.sprinting && a.hspeed > 3, crouch: a.crouch,
      moving: a.onGround ? U.clamp(a.hspeed / 4.6, 0, 1.5) : 0, phase: this.stepPhase,
      lookDX: G.Input.mdx, lookDY: G.Input.mdy, landDip: this.landDip, raise: this.raise,
      reload: rl, pumpP: this.pumpT >= 0.08 ? (this.pumpT - 0.08) / 0.45 : -1,
      cycleP: this.cycleT >= 0 && def && def.cycle ? this.cycleT / def.cycle : -1,
      throwP: this.throwSt ? this.throwSt.t / 0.68 : -1, punchP: this.punchT >= 0 ? this.punchT / 0.4 : -1,
      empty: inst && inst.mag === 0 && !R, scope, hideVM: this.scopeView > 0.6
    });
    // 뷰모델 조명 (월드 태양 방향을 카메라 공간으로)
    _q.copy(G.World.sunDir).applyQuaternion(_qi.copy(cam.quaternion).invert());
    G.VM.dir.position.copy(_q);
    G.VM.dir.intensity = U.lerp(G.World.sun.intensity * 0.85, 0.35, this.indoor);
    G.VM.dir.color.copy(G.World.sun.color);
    G.VM.hemi.intensity = U.lerp(G.World.hemi.intensity, G.World.hemi.intensity * 0.55, this.indoor);
  },

  /* ---------------- 관전 ---------------- */
  updateSpectate(dt) {
    const Game = G.Game, cam = G.camera, I = G.Input;
    this.camMode = 'spectate';
    G.VM.set(null);
    const mates = Game.teams[this.a.team].members.filter(m => m.alive && m !== this.a);
    let t = mates.length ? mates[this.specIdx % mates.length] : null;
    if (I.lmbHit && mates.length) { this.specIdx++; t = mates[this.specIdx % mates.length]; }
    this.specTarget = t;
    if (!t) {
      // 시체 위에서 바라보기
      _e.copy(this.a.pos); _e.y += 1;
      this.orbitYaw += dt * 0.15;
      cam.position.set(_e.x + Math.sin(this.orbitYaw) * 8, _e.y + 5, _e.z + Math.cos(this.orbitYaw) * 8);
      cam.lookAt(_e);
      return;
    }
    if (t.state === 'ground') {
      t.eye(_e);
      _f.set(-Math.sin(t.yaw), 0, -Math.cos(t.yaw));
      _c.copy(_e).addScaledVector(_f, -3.2); _c.y += 0.7;
      _r.set(Math.cos(t.yaw), 0, -Math.sin(t.yaw)); _c.addScaledVector(_r, 0.6);
      // 벽 뚫림 방지
      _d.copy(_c).sub(_e); const L = _d.length(); _d.divideScalar(L);
      if (G.World.raycast(_e, _d, L)) _c.copy(_e).addScaledVector(_d, Math.max(0.3, G.World.hit.t - 0.3));
      cam.position.lerp(_c, 1 - Math.exp(-10 * dt));
      _q.copy(_e).addScaledVector(_f, 10); _q.y += Math.sin(t.pitch) * 10;
      cam.lookAt(_q);
    } else {
      _e.copy(t.state === 'plane' && Game.plane ? Game.plane.pos : t.pos);
      cam.position.lerp(_c.set(_e.x + 10, _e.y + 6, _e.z + 10), 1 - Math.exp(-4 * dt));
      cam.lookAt(_e);
    }
    cam.fov = U.damp(cam.fov, 75, 4, dt); cam.updateProjectionMatrix();
    G.Audio.setListener(cam.position, t.yaw);
  },
  onDeath() {
    this.reload = null; this.heal = null; this.revive = null; this.throwSt = null; this.ads = 0; this.scopeView = 0; this.cycleT = -1;
    G.VM.set(null);
    this.specIdx = 0;
  },
  flashed(amt) {
    if (amt <= 0.05) return;
    this.flashAmt = Math.max(this.flashAmt, amt);
    this.flashHold = Math.max(this.flashHold, amt * 2.4);
    G.Audio.ring(amt);
  },
  updateFlash(dt) {
    if (this.flashHold > 0) this.flashHold -= dt;
    else this.flashAmt = Math.max(0, this.flashAmt - dt * 0.55);
  }
};
const _qi = new THREE.Quaternion();
function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
G.esc = esc;

})();
