// bots.js — 봇 AI: 인지, 전투, 이동, 파밍, 자기장, 소생, 팀 협동
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;

const DIFF = {
  easy:   { react: 0.9, err: 1.7, track: 1.5, vis: 95,  rate: 0.65, burst: [2, 4], pause: [0.45, 0.9], nade: 0.12, turn: 3.5, head: 0.05 },
  normal: { react: 0.5, err: 1.1, track: 2.3, vis: 125, rate: 0.85, burst: [3, 6], pause: [0.3, 0.65], nade: 0.28, turn: 5,   head: 0.15 },
  hard:   { react: 0.28, err: 0.7, track: 3.3, vis: 150, rate: 1.0, burst: [4, 8], pause: [0.2, 0.45], nade: 0.45, turn: 7,  head: 0.3 }
};
const _e = new V3(), _c = new V3(), _d = new V3(), _w = new V3(), _a = new V3(), _f = new V3(), _r = new V3(), _m = new V3(), _p = new V3(), _l = new V3();

class Bot {
  constructor(a) {
    this.a = a;
    this.d = DIFF[G.Game.diff] || DIFF.normal;
    this.target = null; this.visible = false; this.lostT = 99; this.lastSeen = new V3(); this.hasLast = false;
    this.aimOff = new V3(); this.reactT = 0;
    this.goal = null; this.goalType = ''; this.goalT = 0; this.lootItem = null;
    this.thinkT = Math.random() * 0.4; this.percT = Math.random() * 0.2;
    this.burstLeft = 0; this.burstPause = 0; this.nextFire = 0; this.reloadT = 0;
    this.strafe = 1; this.strafeT = 0;
    this.progT = 0; this.lastProg = new V3(); this.stuck = 0; this.detourT = 0; this.detourYaw = 0; this.avoidSide = Math.random() < 0.5 ? 1 : -1;
    this.nadeCD = U.rand(8, 20); this.healing = null; this.reviving = null; this.reviveT = 0;
    this.alertPos = new V3(); this.alertT = 0;
    this.dropTarget = new V3(); this.jumpAt = 0; this.chuteAt = U.rand(95, 140);
    this.wanderT = 0; this.time = 0; this.followOff = new V3(U.rand(-6, 6), 0, U.rand(-6, 6));
    this.run = false;
  }
  get now() { return G.Game.time; }

  update(dt) {
    const a = this.a;
    this.time += dt;
    if (!a.alive) return;
    if (a.state === 'plane') return;
    if (a.state === 'freefall' || a.state === 'chute') { this.updateDrop(dt); return; }
    a.blindT = Math.max(0, a.blindT - dt);
    this.alertT -= dt; this.nadeCD -= dt;
    if (a.knocked) { this.updateKnocked(dt); return; }
    this.percT -= dt;
    if (this.percT <= 0) { this.percT = 0.16 + Math.random() * 0.08; this.perceive(); }
    if (!this.visible) this.lostT += dt;
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.finishReload(); }
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.3 + Math.random() * 0.2; this.think(); }

    _w.set(0, 0, 0);
    let speed = 0, faceYaw = null;
    const combat = this.target && this.target.alive && (this.visible || this.lostT < 1.2);
    if (this.healing) {
      this.healing.t += dt;
      a.crouch = true;
      if (this.healing.t >= this.healing.dur) {
        if (this.healing.kind === 'medkit' && a.meds.medkit > 0) { a.meds.medkit--; a.hp = 100; }
        else if (a.meds.bandage > 0) { a.meds.bandage--; a.hp = Math.min(75, a.hp + 20); }
        this.healing = null; a.crouch = false;
      } else if (combat && this.visible) { this.healing = null; a.crouch = false; }
    }
    if (this.reviving) {
      const m = this.reviving;
      if (!m.alive || !m.knocked || Math.hypot(m.pos.x - a.pos.x, m.pos.z - a.pos.z) > 2.2 || (this.visible && this.target && a.pos.distanceTo(this.target.pos) < 40)) { this.reviving = null; }
      else {
        this.reviveT += dt; a.crouch = true;
        faceYaw = Math.atan2(-(m.pos.x - a.pos.x), -(m.pos.z - a.pos.z));
        if (this.reviveT >= 5) { G.Game.revive(m, a); this.reviving = null; a.crouch = false; }
      }
    }
    if (combat && !this.reviving) {
      speed = this.combat(dt, _w);
      faceYaw = null;
    } else if (!this.healing && !this.reviving) {
      if (this.goal) {
        speed = this.navigate(dt, _w);
        faceYaw = speed > 0.1 ? Math.atan2(-_w.x, -_w.z) : null;
      }
      if (this.alertT > 0 && !this.goal) faceYaw = Math.atan2(-(this.alertPos.x - a.pos.x), -(this.alertPos.z - a.pos.z));
      if (a.crouch && speed > 3) a.crouch = false;
      // 조준 정면 복귀
      a.pitch = U.damp(a.pitch, 0, 3, dt);
      if (a.cur === 'fists' || !a.weapons[a.cur]) a.cur = a.bestGun();
    }
    if (faceYaw !== null) a.yaw += U.clamp(U.angleDiff(a.yaw, faceYaw), -this.d.turn * dt, this.d.turn * dt);
    if (a.blindT > 0) { a.yaw += Math.sin(this.time * 3) * dt * 2; _w.multiplyScalar(0.4); }
    const acc = a.onGround ? 30 : 6;
    a.vel.x = approach(a.vel.x, _w.x, acc * dt); a.vel.z = approach(a.vel.z, _w.z, acc * dt);
    G.Physics.move(a, dt);
    if (a.landV < -15) G.Game.damage(a, (-a.landV - 15) * 7, null, 'fall', false, a.pos, null);
    // 발소리
    if (a.onGround && a.hspeed > 2.5) {
      this.step = (this.step || 0) + a.hspeed * dt;
      if (this.step > 2.1) { this.step = 0; G.Audio.footstep(a.pos, a.inWater ? 'water' : a.groundMat === 'terrain' ? 'grass' : a.groundMat, a.crouch ? 0.15 : 0.4); }
    }
  }

  /* ------------ 인지 ------------ */
  perceive() {
    const a = this.a, W = G.World, d = this.d;
    if (a.blindT > 0) { this.visible = false; return; }
    a.eye(_e);
    a.lookDir(_f); _f.y = 0; _f.normalize();
    let best = null, bestS = Infinity;
    const vis = W && G.Game.zone && G.Game.zone.cur.r < 60 ? d.vis * 0.8 : d.vis;
    for (const t of G.Game.actors) {
      if (!t.alive || t.team === a.team || t.state !== 'ground') continue;
      const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > vis) continue;
      const facing = (dx * _f.x + dz * _f.z) / (dist || 1);
      const aware = t === this.target || dist < 12 || (this.alertT > 0 && dist < 70) || (G.Game.time - a.lastHurtT < 3);
      if (facing < 0.42 && !aware) continue;
      if (t.crouch && dist > 70 && t !== this.target && Math.random() < 0.5) continue;
      t.chest(_c);
      let seen = W.los(_e, _c);
      if (!seen && !t.knocked) { t.head(_c); seen = W.los(_e, _c); }
      if (!seen) continue;
      let s = dist + (t.knocked ? 30 : 0) - (t === this.target ? 12 : 0) - (t.isPlayer ? 3 : 0);
      if (s < bestS) { bestS = s; best = t; }
    }
    this.visible = !!best;
    if (best) {
      const dist = a.pos.distanceTo(best.pos);
      if (best !== this.target) {
        this.target = best;
        this.reactT = d.react * U.rand(0.8, 1.3) * (1 + dist / 160) * (this.lostT < 3 ? 0.5 : 1);
        const e = d.err * (1 + dist / 35);
        this.aimOff.set(U.rand(-1, 1), U.rand(-0.6, 1), U.rand(-1, 1)).normalize().multiplyScalar(e);
        this.burstLeft = 0;
      }
      this.lastSeen.copy(best.pos); this.hasLast = true; this.lostT = 0;
      this.healing = null;
    }
  }
  hear(pos, loud) {
    if (this.visible) return;
    const a = this.a;
    const d = a.pos.distanceTo(pos);
    this.alertPos.copy(pos).add(_p.set(U.rand(-1, 1), 0, U.rand(-1, 1)).multiplyScalar(d * 0.08));
    this.alertT = 5;
    if (!this.hasLast || this.lostT > 6) {
      if (d < 70 && !(this.a.team === G.Game.player.team && this.goalType === 'follow')) { this.lastSeen.copy(this.alertPos); this.hasLast = true; this.lostT = 2; }
    }
  }
  onHurt(attacker) {
    if (!attacker || attacker === this.a) return;
    this.healing = null;
    if (!this.visible) {
      this.alertPos.copy(attacker.pos); this.alertT = 6;
      this.lastSeen.copy(attacker.pos); this.hasLast = true; this.lostT = Math.min(this.lostT, 1.5);
      this.percT = 0;
    }
  }

  /* ------------ 의사결정 ------------ */
  think() {
    const a = this.a, Game = G.Game, Z = Game.zone, W = G.World;
    if (this.healing || this.reviving) return;
    const combat = this.target && this.target.alive && this.visible;
    if (this.target && !this.target.alive) { this.target = null; this.hasLast = false; }
    // 무기 재장전 (비전투)
    const inst = a.weapons[a.cur];
    const idef = inst && G.WEAPONS[inst.id];
    if (!combat && inst && this.reloadT <= 0 && inst.mag < idef.mag * 0.5 && a.ammo[idef.ammo] > 0) this.startReload();
    // 자기장
    const zc = Z.next || Z.cur;
    const dz = Math.hypot(a.pos.x - zc.x, a.pos.z - zc.z);
    const outCur = Math.hypot(a.pos.x - Z.cur.x, a.pos.z - Z.cur.z) > Z.cur.r - 4;
    const urgent = outCur || (Z.state === 'shrink' && dz > zc.r * 0.85) || (Z.state === 'wait' && Z.timer < 45 && dz > zc.r * 0.85);
    if (urgent && !combat) {
      if (this.goalType !== 'zone' || !this.goal || Math.hypot(this.goal.x - zc.x, this.goal.z - zc.z) > zc.r) {
        const ang = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * zc.r * 0.55;
        this.setGoal(_p.set(zc.x + Math.cos(ang) * rr, 0, zc.z + Math.sin(ang) * rr), 'zone');
      }
      this.run = true;
      return;
    }
    if (combat) { this.goal = null; return; }
    // 치료
    if (a.hp < 60 && (a.meds.medkit > 0 || (a.meds.bandage > 0 && a.hp < 75)) && this.lostT > 2.5) {
      const kind = a.meds.medkit > 0 && (a.hp < 45 || a.meds.bandage === 0) ? 'medkit' : 'bandage';
      this.healing = { kind, t: 0, dur: kind === 'medkit' ? 6 : 3.5 };
      if (this.hasLast && this.lostT < 10 && a.throwables.smoke > 0 && Math.random() < 0.5) this.throwAt('smoke', _p.copy(a.pos).add(_c.set(0, 0, 0)));
      return;
    }
    // 동료 소생
    const team = Game.teams[a.team];
    let km = null, kd = 70;
    for (const m of team.members) { if (m !== a && m.alive && m.knocked) { const d = a.pos.distanceTo(m.pos); if (d < kd) { kd = d; km = m; } } }
    if (km && this.lostT > 1.5) {
      if (kd < 1.9) { this.reviving = km; this.reviveT = 0; this.goal = null; return; }
      this.setGoal(km.pos, 'revive'); this.run = true;
      if (this.hasLast && this.lostT < 8 && a.throwables.smoke > 0 && kd < 25 && Math.random() < 0.3) this.throwAt('smoke', km.pos);
      return;
    }
    // 마지막 목격 위치 → 투척/수색
    if (this.hasLast && this.lostT < 9) {
      const dl = a.pos.distanceTo(this.lastSeen);
      if (this.nadeCD <= 0 && dl > 9 && dl < 38 && this.lostT > 0.8 && Math.random() < this.d.nade) {
        const k = a.throwables.frag > 0 ? 'frag' : a.throwables.molotov > 0 ? 'molotov' : a.throwables.flash > 0 && dl < 22 ? 'flash' : null;
        if (k) { this.throwAt(k, this.lastSeen); this.nadeCD = U.rand(10, 22); }
      }
      if (this.lostT > 2 && !(a.team === Game.player.team && this.leaderDist() > 30)) { this.setGoal(this.lastSeen, 'hunt'); this.run = false; return; }
      if (this.lostT <= 2) { this.goal = null; return; }
    }
    // 팀 리더 따라가기
    const leader = this.leader();
    if (leader && leader !== a) {
      const ld = a.pos.distanceTo(leader.pos);
      const isPT = a.team === Game.player.team;
      if (ld > (isPT ? 16 : 26)) { this.setGoal(_p.copy(leader.pos).add(this.followOff), 'follow'); this.run = ld > 30; return; }
    }
    // 파밍
    if (this.goalType === 'loot' && this.lootItem && !this.lootItem.taken && this.goal) return;
    const it = this.findLoot();
    if (it) { this.lootItem = it; it.claim = a; this.setGoal(it.pos, 'loot'); this.run = a.pos.distanceTo(it.pos) > 15; return; }
    // 배회
    this.wanderT -= 0.4;
    if (!this.goal || this.wanderT <= 0) {
      this.wanderT = U.rand(10, 25);
      const c = Z.next || Z.cur;
      let pt = null;
      for (let i = 0; i < 8; i++) {
        const s = U.pick(W.lootSpots);
        if (!s) break;
        if (Math.hypot(s.x - c.x, s.z - c.z) < c.r * 0.8 && Math.hypot(s.x - a.pos.x, s.z - a.pos.z) < 140) { pt = s; break; }
      }
      if (!pt) { const ang = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * c.r * 0.7; pt = { x: c.x + Math.cos(ang) * rr, z: c.z + Math.sin(ang) * rr }; }
      this.setGoal(_p.set(pt.x, 0, pt.z), 'wander'); this.run = false;
    }
  }
  leader() {
    const Game = G.Game, a = this.a, team = Game.teams[a.team];
    const p = Game.player;
    if (a.team === p.team && p.alive && !p.knocked && p.state === 'ground') return p;
    for (const m of team.members) if (m.alive && !m.knocked && m.state === 'ground') return m;
    return null;
  }
  leaderDist() { const l = this.leader(); return l ? l.pos.distanceTo(this.a.pos) : 0; }
  setGoal(p, type) {
    if (!this.goal) this.goal = new V3();
    this.goal.set(p.x, 0, p.z);
    if (this.goalType !== type) { this.stuck = 0; }
    this.goalType = type; this.goalT = 0;
    if (type !== 'loot' && this.lootItem) { if (this.lootItem.claim === this.a) this.lootItem.claim = null; this.lootItem = null; }
  }
  needs(it) {
    const a = this.a, k = it.kind;
    if (k === 'crate') return true;
    const W = G.WEAPONS[k];
    if (W && W.cls) { const cur = a.weapons[W.cls]; if (!cur) return true; if (cur.id === k) return a.ammo[W.ammo] < 30; return W.tier > G.WEAPONS[cur.id].tier; }
    if (k.startsWith('ammo_')) { const t = k.slice(5); return a.ammo[t] < 60 && ['rifle', 'shotgun', 'pistol'].some(w => a.weapons[w] && a.wdef(w).ammo === t); }
    if (k.startsWith('scope_')) return false;
    if (G.THROW_NAMES[k]) return a.throwables[k] < 2;
    if (k === 'bandage') return a.meds.bandage < 4;
    if (k === 'medkit') return a.meds.medkit < 1;
    if (k === 'vest') return !a.vest;
    if (k === 'helmet') return !a.helmet;
    return false;
  }
  findLoot() {
    const a = this.a;
    let best = null, bd = a.hasGun() ? 40 : 90;
    G.Game.lootAround(a.pos.x, a.pos.z, bd, (it) => {
      if (it.claim && it.claim !== a && it.claim.alive) return;
      if (Math.abs(it.pos.y - a.pos.y) > 1.6) return;
      const d = Math.abs(it.pos.x - a.pos.x) + Math.abs(it.pos.z - a.pos.z);
      if (d >= bd || it.failed === a) return;
      if (!this.needs(it)) return;
      bd = d; best = it;
    });
    return best;
  }

  /* ------------ 이동 ------------ */
  navigate(dt, out) {
    const a = this.a, W = G.World;
    const g = this.goal;
    const dx = g.x - a.pos.x, dz = g.z - a.pos.z, dist = Math.hypot(dx, dz);
    this.goalT += dt;
    if (dist < (this.goalType === 'loot' ? 1.3 : this.goalType === 'revive' ? 1.1 : 2.5)) {
      if (this.goalType === 'loot' && this.lootItem) {
        if (!this.lootItem.taken) G.Game.pickup(a, this.lootItem);
        if (this.lootItem.claim === a) this.lootItem.claim = null;
        this.lootItem = null; this.thinkT = 0.05;
      }
      this.goal = null; return 0;
    }
    if (this.goalT > 60) { this.goal = null; return 0; }
    let yaw = Math.atan2(-dx, -dz);
    if (this.detourT > 0) { this.detourT -= dt; yaw = this.detourYaw; }
    else {
      // 장애물 회피
      if (this.blocked(yaw, 2.4)) {
        const tries = [0.5, 1.0, 1.5, 2.1];
        let found = false;
        for (const t of tries) {
          for (const s of [this.avoidSide, -this.avoidSide]) {
            if (!this.blocked(yaw + t * s, 2.4)) { yaw += t * s; found = true; this.avoidSide = s; break; }
          }
          if (found) break;
        }
        if (!found) yaw += Math.PI * 0.6 * this.avoidSide;
      }
    }
    // 불 / 깊은 물 회피
    _p.set(a.pos.x - Math.sin(yaw) * 3, a.pos.y, a.pos.z - Math.cos(yaw) * 3);
    if (G.Throwables.fireAt(_p, 1)) yaw += 1.6;
    // 바다만 피한다 (강·호수는 헤엄쳐 건넌다)
    if (W.waterAt(_p.x, _p.z) < 0.1 && W.heightAt(_p.x, _p.z) < W.WATER - 1.5 && W.heightAt(a.pos.x, a.pos.z) > W.WATER - 1.5 && this.goalType !== 'zone') yaw += 1.4 * this.avoidSide;
    // 끼임 감지
    this.progT += dt;
    if (this.progT > 1.2) {
      const moved = Math.hypot(a.pos.x - this.lastProg.x, a.pos.z - this.lastProg.z);
      if (moved < 0.6) {
        this.stuck++;
        if (a.onGround) a.vel.y = 7;
        this.detourT = 0.8 + Math.random() * 0.6;
        this.detourYaw = yaw + (Math.random() < 0.5 ? 1 : -1) * U.rand(1.2, 2.4);
        if (this.stuck > 4) {
          if (this.lootItem) { this.lootItem.failed = a; if (this.lootItem.claim === a) this.lootItem.claim = null; this.lootItem = null; }
          this.goal = null; this.stuck = 0; return 0;
        }
      } else this.stuck = Math.max(0, this.stuck - 1);
      this.progT = 0; this.lastProg.copy(a.pos);
    }
    const sp = a.swimming ? 2.6 : this.run ? 6.2 : 4.3;
    out.set(-Math.sin(yaw) * sp, 0, -Math.cos(yaw) * sp);
    return sp;
  }
  blocked(yaw, len) {
    const a = this.a, W = G.World;
    const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
    if (W.rayBoxes(a.pos.x, a.pos.y + 0.65, a.pos.z, dx, 0, dz, len, null) < Infinity) return true;
    if (W.rayBoxes(a.pos.x, a.pos.y + 1.4, a.pos.z, dx, 0, dz, len * 0.8, null) < Infinity) return true;
    const h = W.heightAt(a.pos.x + dx * len, a.pos.z + dz * len);
    if (h - a.pos.y > 1.4) return true;
    return false;
  }

  /* ------------ 전투 ------------ */
  chooseWeapon(dist) {
    const a = this.a, w = a.weapons;
    const ok = k => w[k] && (w[k].mag > 0 || a.ammo[G.WEAPONS[w[k].id].ammo] > 0);
    if (dist < 14 && ok('shotgun')) return 'shotgun';
    if (ok('rifle')) return 'rifle';
    if (dist < 45 && ok('pistol')) return 'pistol';
    if (ok('shotgun')) return 'shotgun';
    if (ok('pistol')) return 'pistol';
    return 'fists';
  }
  combat(dt, out) {
    const a = this.a, t = this.target, d = this.d, now = this.now;
    t.chest(_c);
    if (this.aimHead === undefined || Math.random() < dt * 0.5) this.aimHead = Math.random() < d.head;
    if (this.aimHead && !t.knocked) t.head(_c);
    const dist = a.pos.distanceTo(t.pos);
    // 무기 선택
    const want = this.chooseWeapon(dist);
    if (want !== a.cur && this.reloadT <= 0) { a.cur = want; this.nextFire = Math.max(this.nextFire, now + 0.45); }
    // 조준 오차 갱신
    this.aimOff.multiplyScalar(Math.exp(-d.track * dt));
    const tv = t.hspeed || 0;
    this.aimOff.x += (Math.random() - 0.5) * dt * (0.6 + tv * 0.35) * d.err;
    this.aimOff.y += (Math.random() - 0.5) * dt * 0.4 * d.err;
    this.aimOff.z += (Math.random() - 0.5) * dt * (0.6 + tv * 0.35) * d.err;
    const aimP = this.visible ? _a.copy(_c).add(this.aimOff) : _a.copy(this.lastSeen).add(_l.set(0, 1.2, 0)).add(this.aimOff);
    a.eye(_e);
    _d.copy(aimP).sub(_e);
    const hd = Math.hypot(_d.x, _d.z);
    const wantYaw = Math.atan2(-_d.x, -_d.z), wantPitch = Math.atan2(_d.y, hd);
    const dy = U.angleDiff(a.yaw, wantYaw);
    a.yaw += U.clamp(dy, -d.turn * dt, d.turn * dt);
    a.pitch += U.clamp(wantPitch - a.pitch, -d.turn * dt, d.turn * dt);
    if (this.reactT > 0) this.reactT -= dt;
    // 사격
    const inst = a.weapons[a.cur], def = inst ? G.WEAPONS[inst.id] : G.WEAPONS[a.cur];
    const aligned = Math.abs(U.angleDiff(a.yaw, wantYaw)) < 0.06 + 0.5 / Math.max(dist, 1) && Math.abs(wantPitch - a.pitch) < 0.1;
    if (a.cur === 'fists') {
      if (dist < 1.9 && now >= this.nextFire && this.visible && this.reactT <= 0) {
        this.nextFire = now + 0.7;
        G.Game.damage(t, G.WEAPONS.fists.dmg * 0.8, a, 'fists', false, _c, _d.normalize());
        G.Audio.click('punch');
        if (a.model) a.model.kick = 1;
      }
    } else if (inst && this.visible && this.reactT <= 0 && aligned && now >= this.nextFire && this.reloadT <= 0 && a.blindT <= 0 && dist < def.range * 0.8) {
      if (inst.mag <= 0) this.startReload();
      else if (this.burstPause > 0) this.burstPause -= dt;
      else this.fire(def, inst, aimP, dist);
    } else if (inst && inst.mag <= 0 && this.reloadT <= 0) this.startReload();
    if (this.burstPause > 0 && !(inst && this.visible)) this.burstPause -= dt;
    if (a.blindT > 0 && inst && inst.mag > 0 && now >= this.nextFire && Math.random() < 0.2) { this.fire(def, inst, _a.copy(this.lastSeen).add(_l.set(U.rand(-4, 4), 1, U.rand(-4, 4))), dist); }
    // 이동
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = U.rand(0.5, 1.6);
      const r = Math.random();
      this.strafe = r < 0.4 ? 1 : r < 0.8 ? -1 : 0;
      if (dist > 35 && Math.random() < 0.35 && a.cur !== 'shotgun') { a.crouch = true; this.strafe = 0; }
      else if (Math.random() < 0.5) a.crouch = false;
      if (G.Game.diff === 'hard' && Math.random() < 0.12 && a.onGround && dist < 30) a.vel.y = 7;
    }
    _f.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw)); _r.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
    let fwd = 0;
    const range = a.cur === 'shotgun' ? [3, 10] : a.cur === 'fists' ? [0, 1.4] : a.cur === 'pistol' ? [8, 30] : [15, 70];
    if (dist > range[1]) fwd = 1; else if (dist < range[0]) fwd = -0.6;
    if (!this.visible) fwd = 0.6;
    const spd = a.crouch ? 2.2 : 4.0;
    out.copy(_r).multiplyScalar(this.strafe).addScaledVector(_f, fwd);
    if (out.lengthSq() > 0) out.normalize().multiplyScalar(spd);
    if (this.strafe !== 0 && this.blocked(a.yaw - this.strafe * Math.PI / 2, 1.5)) { this.strafe = -this.strafe; }
    if (fwd !== 0 && this.blocked(a.yaw + (fwd > 0 ? 0 : Math.PI), 1.5)) out.addScaledVector(_f, -fwd * spd * 0.9);
    if (this.reloadT > 0 || (inst && inst.mag === 0)) { out.addScaledVector(_f, -2); }
    if (G.Throwables.fireAt(a.pos, 0.5)) out.addScaledVector(_f, -5);
    return out.length();
  }
  fire(def, inst, aimP, dist) {
    const a = this.a, now = this.now, d = this.d;
    inst.mag--;
    let interval = 60 / def.rpm;
    if (def.cls === 'pistol' && !def.auto) interval = Math.max(interval, 0.28);
    if (def.action === 'bolt') interval = Math.max(interval, def.cycle + 0.25);
    this.nextFire = now + interval / d.rate;
    if (def.auto) {
      if (this.burstLeft <= 0) this.burstLeft = U.randInt(d.burst[0], d.burst[1]) + (dist < 20 ? 3 : 0);
      this.burstLeft--;
      if (this.burstLeft <= 0) this.burstPause = U.rand(d.pause[0], d.pause[1]) * (1 + dist / 80);
    }
    a.eye(_e);
    _d.copy(aimP).sub(_e).normalize();
    _f.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw)); _r.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
    _m.copy(_e).addScaledVector(_d, 0.75).addScaledVector(_r, 0.12); _m.y -= 0.2;
    const up = _l.set(0, 1, 0);
    const spread = def.spread * (a.hspeed > 1 ? 1.1 : 0.7) * (a.crouch ? 0.8 : 1);
    for (let k = 0; k < def.pellets; k++) {
      const rr = spread * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
      _p.copy(_d).addScaledVector(_r, Math.cos(th) * rr).addScaledVector(up, Math.sin(th) * rr).normalize();
      G.Ballistics.fire(a, _e, _p, def, _m, k < 2 && Math.random() < 0.55);
    }
    // 반동으로 조준 흔들림
    this.aimOff.y += def.recoilV * Math.max(dist, 5) * 0.55;
    this.aimOff.x += (Math.random() - 0.5) * def.recoilH * dist;
    G.FX.muzzle(_m, _d.x, _d.y, _d.z, def.cls === 'shotgun');
    if (G.camera.position.distanceTo(_m) < 80) G.FX.light(_m, 0xffaa55, 14, 0.05, 10);
    G.Audio.shot(def.sound, a.pos, false);
    G.Game.onShot(a, def);
    if (a.model) a.model.kick = 1;
  }
  startReload() {
    const a = this.a, inst = a.weapons[a.cur], def = inst && G.WEAPONS[inst.id];
    if (!inst || this.reloadT > 0 || a.ammo[def.ammo] <= 0 || inst.mag >= def.mag) return;
    this.reloadT = def.reloadType === 'shell' || def.reloadType === 'break' ? Math.min(3.4, 0.8 + (def.mag - inst.mag) * def.reload) : def.reload * 1.1;
    this.reloadW = a.cur;
  }
  finishReload() {
    const a = this.a, k = this.reloadW, inst = a.weapons[k];
    if (!inst) return;
    const def = G.WEAPONS[inst.id];
    const n = Math.min(def.mag - inst.mag, a.ammo[def.ammo]);
    inst.mag += n; a.ammo[def.ammo] -= n;
  }
  throwAt(kind, target) {
    const a = this.a;
    if (a.throwables[kind] <= 0) return;
    a.throwables[kind]--;
    a.eye(_e);
    const v = G.Throwables.aim(_e, target, 22, _w.clone());
    _p.copy(_e).add(_l.set(-Math.sin(a.yaw) * 0.4, 0, -Math.cos(a.yaw) * 0.4));
    G.Throwables.throw(a, kind, _p, v);
    if (a.model) a.model.throwT = 0.5;
  }

  /* ------------ 강하 / 기절 ------------ */
  updateDrop(dt) {
    const a = this.a, W = G.World, Game = G.Game;
    const p = Game.player;
    if (a.team === p.team && p.alive && (p.state === 'freefall' || p.state === 'chute' || p.state === 'ground')) {
      this.dropTarget.set(p.pos.x + this.followOff.x * 1.5, 0, p.pos.z + this.followOff.z * 1.5);
      if (p.state !== 'freefall' && a.state === 'freefall' && a.pos.y - W.heightAt(a.pos.x, a.pos.z) < 220) Game.openChute(a);
    }
    const dx = this.dropTarget.x - a.pos.x, dz = this.dropTarget.z - a.pos.z, hd = Math.hypot(dx, dz);
    const gh = W.ground(a.pos.x, a.pos.z, a.pos.y, 0.3, 0.5);
    const agl = a.pos.y - Math.max(gh, W.waterAt(a.pos.x, a.pos.z));
    let hs, vs;
    if (a.state === 'freefall') {
      const tFall = agl / 48;
      hs = hd > tFall * 15 ? 34 : U.clamp(hd / Math.max(tFall, 0.5), 0, 15);
      vs = hs > 30 ? -60 : -48;
      if (agl < this.chuteAt) Game.openChute(a);
    } else { hs = U.clamp(hd * 0.5, 0, hd > 30 ? 13 : 8); vs = hs > 12 ? -8.5 : -5.2; }
    a.yaw = hd > 1 ? Math.atan2(-dx, -dz) : a.yaw;
    const k = a.state === 'freefall' ? 1.6 : 2.5;
    a.vel.x = U.damp(a.vel.x, hd > 0.5 ? dx / hd * hs : 0, k, dt); a.vel.z = U.damp(a.vel.z, hd > 0.5 ? dz / hd * hs : 0, k, dt);
    a.vel.y = U.damp(a.vel.y, vs, a.state === 'freefall' ? 1.2 : 3, dt);
    a.pos.addScaledVector(a.vel, dt);
    const lim = W.HALF - 5; a.pos.x = U.clamp(a.pos.x, -lim, lim); a.pos.z = U.clamp(a.pos.z, -lim, lim);
    const g2 = W.ground(a.pos.x, a.pos.z, a.pos.y + 0.5, 0.3, 0.6);
    if (a.pos.y <= g2 + 0.02 || a.pos.y < W.waterAt(a.pos.x, a.pos.z) - 1.2) { Game.land(a); a.cur = a.bestGun(); this.thinkT = 0; }
  }
  updateKnocked(dt) {
    const a = this.a, team = G.Game.teams[a.team];
    let best = null, bd = 1e9;
    for (const m of team.members) if (m !== a && m.alive && !m.knocked) { const d = a.pos.distanceTo(m.pos); if (d < bd) { bd = d; best = m; } }
    _w.set(0, 0, 0);
    if (best && bd > 2) {
      const dx = best.pos.x - a.pos.x, dz = best.pos.z - a.pos.z;
      const yaw = Math.atan2(-dx, -dz);
      a.yaw += U.clamp(U.angleDiff(a.yaw, yaw), -2 * dt, 2 * dt);
      _w.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw)).multiplyScalar(1.0);
    }
    a.vel.x = approach(a.vel.x, _w.x, 10 * dt); a.vel.z = approach(a.vel.z, _w.z, 10 * dt);
    G.Physics.move(a, dt);
  }
};
function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }

G.Bot = Bot;
G.BOT_DIFF = DIFF;
})();
