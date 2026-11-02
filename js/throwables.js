// throwables.js — 수류탄 / 연막탄 / 화염병 / 섬광탄
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;
const GRAV = 18;
const FUSE = { frag: 3.5, smoke: 1.6, flash: 1.8, molotov: 6 };
const _d = new V3(), _v = new V3(), _c = new V3(), _e = new V3(), _f = new V3();

const T = G.Throwables = {
  list: [], smokes: [], fires: [],
  reset() {
    for (const o of this.list) G.scene.remove(o.mesh);
    this.list.length = 0; this.smokes.length = 0; this.fires.length = 0;
    if (G.Audio.ctx) G.Audio.setLoop('fire', 0);
  },
  throw(owner, kind, pos, vel) {
    const mesh = G.Guns.throwModel(kind, false);
    mesh.scale.setScalar(1.3);
    mesh.traverse(m => { if (m.isMesh) m.castShadow = true; });
    G.scene.add(mesh);
    mesh.position.copy(pos);
    this.list.push({ owner, team: owner.team, kind, pos: pos.clone(), vel: vel.clone(), mesh, t: 0, fuse: FUSE[kind], rest: false, spin: new V3(U.rand(-12, 12), U.rand(-6, 6), U.rand(-12, 12)), lastBounce: 0 });
    G.Audio.click('throw');
  },
  // 목표 지점까지의 투척 속도 계산
  aim(from, to, maxSpeed, out) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const t = U.clamp(dist / 13, 0.55, 2.4);
    out.set(dx / t, dy / t + 0.5 * GRAV * t, dz / t);
    const s = out.length();
    if (s > maxSpeed) out.multiplyScalar(maxSpeed / s);
    return out;
  },
  update(dt) {
    const W = G.World;
    for (let i = 0; i < this.list.length; i++) {
      const o = this.list[i];
      o.t += dt;
      if (!o.rest) {
        o.vel.y -= GRAV * dt;
        const sp = o.vel.length(), L = sp * dt;
        _d.copy(o.vel).divideScalar(sp || 1);
        if (L > 0 && W.raycast(o.pos, _d, L + 0.06)) {
          const n = W.hit.normal;
          if (o.kind === 'molotov') { o.pos.copy(W.hit.point).addScaledVector(n, 0.1); this.detonate(o); this.list.splice(i--, 1); continue; }
          o.pos.copy(W.hit.point).addScaledVector(n, 0.06);
          const vn = o.vel.dot(n);
          o.vel.addScaledVector(n, -1.45 * vn).multiplyScalar(0.55);
          if (sp > 2.5 && o.t - o.lastBounce > 0.08) { G.Audio.bounce(o.pos); o.lastBounce = o.t; }
          o.spin.multiplyScalar(0.6);
          if (n.y > 0.65 && o.vel.length() < 1.3) { o.rest = true; o.vel.set(0, 0, 0); }
        } else {
          o.pos.addScaledVector(o.vel, dt);
        }
        const wl = W.waterAt(o.pos.x, o.pos.z);
        if (o.pos.y < wl - 0.3 && W.heightAt(o.pos.x, o.pos.z) < wl - 0.3) { o.vel.multiplyScalar(0.8); o.vel.y = Math.max(o.vel.y, -1.5); }
        o.mesh.rotation.x += o.spin.x * dt; o.mesh.rotation.y += o.spin.y * dt; o.mesh.rotation.z += o.spin.z * dt;
      }
      o.mesh.position.copy(o.pos);
      if (o.kind === 'molotov') G.FX.add.spawn({ x: o.pos.x, y: o.pos.y + 0.12, z: o.pos.z, vy: 0.8, life: 0.25, s0: 0.12, s1: 0.04, r: 6, g: 2.6, b: 0.7, a: 0.8 });
      if (o.kind === 'smoke' && o.t > o.fuse) { /* 연막 분사 중 */ }
      if (o.t >= o.fuse && !o.done) {
        this.detonate(o);
        if (o.kind !== 'smoke') { G.scene.remove(o.mesh); this.list.splice(i--, 1); continue; }
      }
      if (o.kind === 'smoke' && o.done && o.t > o.fuse + 20) { G.scene.remove(o.mesh); this.list.splice(i--, 1); continue; }
    }
    // 연막
    for (let i = 0; i < this.smokes.length; i++) {
      const s = this.smokes[i];
      s.t += dt;
      const t = s.t;
      s.r = t < 4 ? 7.5 * (1 - Math.pow(1 - t / 4, 2)) : t < 17 ? 7.5 : 7.5 * Math.max(0, 1 - (t - 17) / 5);
      if (t < 15) {
        s.acc += dt * (t < 3 ? 60 : 26);
        while (s.acc > 1) {
          s.acc -= 1;
          const a = Math.random() * 6.28, rr = Math.random() * Math.max(1, s.r * 0.75);
          G.FX.norm.spawn({ x: s.pos.x + Math.cos(a) * rr, y: s.pos.y + 0.5 + Math.random() * 2.5, z: s.pos.z + Math.sin(a) * rr,
            vx: Math.cos(a) * 0.6, vy: 0.15 + Math.random() * 0.25, vz: Math.sin(a) * 0.6, life: 6 + Math.random() * 3.5,
            s0: 2.8, s1: 7 + Math.random() * 3, r: 0.86, g: 0.87, b: 0.88, a: 0.85, fin: 0.12, fo: 1.1, drag: 0.5, vr: (Math.random() - 0.5) * 0.3 });
        }
      }
      if (t < 15 && Math.random() < dt * 30) G.FX.norm.spawn({ x: s.src.pos.x, y: s.src.pos.y + 0.1, z: s.src.pos.z, vx: U.rand(-0.5, 0.5), vy: 2.5, vz: U.rand(-0.5, 0.5), life: 1.5, s0: 0.3, s1: 2.5, r: 0.85, g: 0.86, b: 0.86, a: 0.5, drag: 1.2 });
      if (t > 23) { this.smokes.splice(i--, 1); }
    }
    // 화염
    let fireVol = 0;
    for (let i = 0; i < this.fires.length; i++) {
      const f = this.fires[i];
      f.t -= dt; f.tick -= dt; f.lt -= dt;
      const k = U.clamp(f.t / 2, 0, 1);
      for (const p of f.patches) {
        if (Math.random() < dt * 22 * k) G.FX.add.spawn({ x: p.x + U.rand(-0.5, 0.5), y: p.y + 0.1, z: p.z + U.rand(-0.5, 0.5), vx: U.rand(-0.3, 0.3), vy: 1.5 + Math.random() * 2, vz: U.rand(-0.3, 0.3),
          life: 0.5 + Math.random() * 0.5, s0: 0.9, s1: 0.2, r: 5, g: 1.8 + Math.random(), b: 0.4, a: 0.8, drag: 0.8 });
        if (Math.random() < dt * 3 * k) G.FX.norm.spawn({ x: p.x, y: p.y + 1.2, z: p.z, vy: 1.6, vx: U.rand(-0.3, 0.3), vz: U.rand(-0.3, 0.3), life: 3, s0: 0.8, s1: 3.5, r: 0.12, g: 0.11, b: 0.1, a: 0.45, drag: 0.4, fin: 0.1 });
      }
      if (f.lt <= 0) { f.lt = 0.2; const l = G.FX.light(_v.copy(f.pos).setY(f.pos.y + 1.2), 0xff7a2a, 60 * k, 0.3, 18); l.userData.flicker = true; }
      if (f.tick <= 0) {
        f.tick = 0.25;
        for (const a of G.Game.actors) {
          if (!a.alive || a.state !== 'ground') continue;
          const dx = a.pos.x - f.pos.x, dz = a.pos.z - f.pos.z;
          if (dx * dx + dz * dz < f.r * f.r && Math.abs(a.pos.y - f.pos.y) < 2) {
            if (a.team === f.team && a !== f.owner) continue;
            G.Game.damage(a, 3.5, f.owner, 'molotov', false, a.pos, null);
          }
        }
      }
      if (G.camera) { const d = G.camera.position.distanceTo(f.pos); fireVol = Math.max(fireVol, k * 0.9 * 10 / (10 + d)); }
      if (f.t <= 0) { this.fires.splice(i--, 1); }
    }
    if (G.Audio.ctx) G.Audio.setLoop('fire', fireVol);
  },
  detonate(o) {
    o.done = true;
    const W = G.World, Game = G.Game, p = o.pos;
    if (o.kind === 'frag') {
      G.FX.explosion(p);
      G.Audio.explosion(p);
      const camD = G.camera.position.distanceTo(p);
      G.FX.shake(U.clamp(1.4 - camD / 22, 0, 1.2));
      _e.copy(p); _e.y += 0.35;
      for (const a of Game.actors) {
        if (!a.alive || a.state !== 'ground') continue;
        a.chest(_c);
        const d = _c.distanceTo(_e);
        if (d > 9) continue;
        _d.copy(_c).sub(_e).normalize();
        if (W.rayBoxes(_e.x, _e.y, _e.z, _d.x, _d.y, _d.z, d - 0.3, null) < Infinity) { a.chest(_c); _c.y = a.pos.y + 0.3; const d2 = _c.distanceTo(_e); _d.copy(_c).sub(_e).normalize(); if (W.rayBoxes(_e.x, _e.y, _e.z, _d.x, _d.y, _d.z, d2 - 0.3, null) < Infinity) continue; }
        if (a.team === o.team && a !== o.owner) continue;
        const dmg = 165 * Math.pow(1 - d / 9, 1.3);
        if (dmg > 1) Game.damage(a, dmg, o.owner, 'frag', false, _c, _d);
      }
      Game.onNoise(p, 140, o.owner);
    } else if (o.kind === 'smoke') {
      G.Audio.smokePop(p);
      this.smokes.push({ pos: p.clone(), t: 0, r: 0, acc: 0, src: o });
    } else if (o.kind === 'molotov') {
      G.Audio.glass(p);
      const gy = W.ground(p.x, p.z, p.y + 0.5, 0.2, 1.2);
      const base = new V3(p.x, gy, p.z);
      const patches = [base.clone()];
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + Math.random() * 0.5, r = 1.6 + Math.random() * 1.4;
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        const y = W.ground(x, z, gy + 0.6, 0.1, 0.9);
        if (Math.abs(y - gy) < 1.2) patches.push(new V3(x, y, z));
      }
      this.fires.push({ pos: base, r: 3.4, t: 9, tick: 0, lt: 0, patches, owner: o.owner, team: o.team });
      for (let i = 0; i < 20; i++) G.FX.add.spawn({ x: p.x, y: p.y + 0.3, z: p.z, vx: U.rand(-4, 4), vy: U.rand(1, 5), vz: U.rand(-4, 4), life: 0.6, s0: 0.8, s1: 0.2, r: 6, g: 2.5, b: 0.5, grav: 6, drag: 1 });
      Game.onNoise(p, 50, o.owner);
    } else if (o.kind === 'flash') {
      G.FX.flashbang(p);
      G.Audio.flashBang(p);
      _e.copy(p); _e.y += 0.3;
      for (const a of Game.actors) {
        if (!a.alive || a.state !== 'ground') continue;
        a.eye(_c);
        const d = _c.distanceTo(_e);
        if (d > 34) continue;
        if (!W.los(_e, _c)) continue;
        a.lookDir(_f);
        _d.copy(_e).sub(_c).normalize();
        const facing = _f.dot(_d);
        let amt = Math.pow(facing * 0.5 + 0.5, 2) * 1.5 * (1 - d / 34);
        if (d < 5) amt = Math.max(amt, 0.65);
        amt = U.clamp(amt, 0, 1);
        if (a.isPlayer) G.Player.flashed(amt);
        else a.blindT = Math.max(a.blindT, amt * 5.5);
      }
      if (G.Player.a && G.Player.a.alive) { const d = G.camera.position.distanceTo(p); if (d < 34 && !(G.Player.a.isPlayer && G.Player.flashAmt > 0)) G.Audio.ring(U.clamp(1 - d / 34, 0, 1) * 0.5); }
      Game.onNoise(p, 80, o.owner);
    }
  },
  smokeBlocks(a, b) {
    for (const s of this.smokes) {
      if (s.r < 1.5) continue;
      for (let k = 0; k < 2; k++) {
        _c.set(s.pos.x, s.pos.y + 1.2 + k * 2.2, s.pos.z);
        if (segDist(a, b, _c) < s.r * 0.85) return true;
      }
    }
    return false;
  },
  inSmoke(p) {
    for (const s of this.smokes) { if (s.r > 2 && Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < s.r * 0.8 && p.y - s.pos.y < 4.5) return true; }
    return false;
  },
  fireAt(p, margin) {
    for (const f of this.fires) { const dx = p.x - f.pos.x, dz = p.z - f.pos.z; if (dx * dx + dz * dz < (f.r + margin) * (f.r + margin) && Math.abs(p.y - f.pos.y) < 2.5) return f; }
    return null;
  }
};
function segDist(a, b, c) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 0 ? ((c.x - a.x) * abx + (c.y - a.y) * aby + (c.z - a.z) * abz) / l2 : 0;
  t = U.clamp(t, 0, 1);
  const x = a.x + abx * t - c.x, y = a.y + aby * t - c.y, z = a.z + abz * t - c.z;
  return Math.sqrt(x * x + y * y + z * z);
}

})();
