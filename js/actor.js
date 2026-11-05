// actor.js — 플레이어/봇 공통 상태, 인벤토리, 캐릭터 물리
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;

class Actor {
  constructor(o) {
    this.id = o.id; this.name = o.name; this.team = o.team; this.idx = o.idx || 0; this.isPlayer = !!o.isPlayer;
    this.pos = new V3(); this.vel = new V3(); this.yaw = 0; this.pitch = 0; this.hspeed = 0;
    this.hp = 100; this.alive = true; this.knocked = false; this.bleed = 100; this.vest = false; this.helmet = false;
    this.weapons = { rifle: null, shotgun: null, pistol: null };
    this.ammo = { '556': 0, '762': 0, '9mm': 0, '45': 0, '12g': 0 };
    this.scopes = { reddot: 0, holo: 0, x2: 0, x4: 0, x8: 0 };   // 가방 속 예비 조준경
    this.throwables = { frag: 0, smoke: 0, molotov: 0, flash: 0 };
    this.meds = { bandage: 0, medkit: 0 };
    this.cur = 'fists';
    this.kills = 0; this.dmgDealt = 0;
    this.state = 'plane'; this.onGround = false; this.crouch = false; this.swimming = false; this.inWater = false;
    this.landV = 0; this.groundMat = 'terrain';
    this.model = null; this.brain = null;
    this.blindT = 0; this.knockedBy = null; this.lastHurtT = -99; this.lastAttacker = null;
    this.deathTime = 0;
  }
  eyeH() { return this.knocked ? 0.45 : this.crouch ? 1.15 : 1.62; }
  eye(out) { return out.set(this.pos.x, this.pos.y + this.eyeH(), this.pos.z); }
  chest(out) { return out.set(this.pos.x, this.pos.y + (this.knocked ? 0.3 : this.crouch ? 0.85 : 1.2), this.pos.z); }
  head(out) { return out.set(this.pos.x, this.pos.y + (this.knocked ? 0.3 : this.crouch ? 1.2 : 1.64), this.pos.z); }
  lookDir(out) { const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }
  hasGun() { return !!(this.weapons.rifle || this.weapons.shotgun || this.weapons.pistol); }
  wdef(k) { const w = this.weapons[k]; return w ? G.WEAPONS[w.id] : null; }
  gunId(k) { const w = this.weapons[k]; return w ? w.id : k; }
  gunAmmo(k) { const w = this.weapons[k]; return w ? w.mag + this.ammo[G.WEAPONS[w.id].ammo] : 0; }
  bestGun() {
    for (const k of ['rifle', 'shotgun', 'pistol']) if (this.weapons[k] && this.gunAmmo(k) > 0) return k;
    for (const k of ['rifle', 'shotgun', 'pistol']) if (this.weapons[k]) return k;
    return 'fists';
  }
  throwCount() { let n = 0; for (const k in this.throwables) n += this.throwables[k]; return n; }
  give(id, extraAmmo, scope) {
    const def = G.WEAPONS[id];
    this.weapons[def.cls] = { id, mag: def.mag, scope: scope || null };
    if (extraAmmo) this.ammo[def.ammo] = Math.min(G.AMMO_MAX[def.ammo], this.ammo[def.ammo] + extraAmmo);
  }
  // 조준경이 없는 총에 가방의 가장 좋은 호환 조준경을 끼운다
  autoScope(cls) {
    const w = this.weapons[cls]; if (!w || w.scope || w.iron) return false;
    const def = G.WEAPONS[w.id];
    for (let i = G.SCOPE_ORDER.length - 1; i >= 0; i--) {
      const t = G.SCOPE_ORDER[i];
      if (this.scopes[t] > 0 && def.scopes.includes(t) && t !== def.baseSight && (!def.baseSight || G.SCOPES[t].rank > G.SCOPES[def.baseSight].rank)) { this.scopes[t]--; w.scope = t; return true; }
    }
    return false;
  }
  scopeCount(t) { let n = this.scopes[t]; for (const k in this.weapons) if (this.weapons[k] && this.weapons[k].scope === t) n++; return n; }
  // 아이템 줍기 — 무언가 획득했다면 라벨 문자열 반환
  pickup(it, fromCrate) {
    const k = it.kind;
    if (k === 'crate') {
      const got = [];
      for (const s of it.items.slice()) {
        if (s.taken) continue;
        const r = this.pickup(s, true); if (r) got.push(r);
        if (this._drop) { it.items.push(Object.assign({ taken: false, amount: 1 }, this._drop)); this._drop = null; }
      }
      it.items = it.items.filter(s => !s.taken);
      if (!it.items.length) it.taken = true;
      return got.length ? got.join(', ') : null;
    }
    let res = null;
    const W = G.WEAPONS[k];
    if (W && W.cls) {
      const cur = this.weapons[W.cls];
      const mag = it.mag !== undefined ? it.mag : W.mag;
      if (!cur) {
        this.weapons[W.cls] = { id: k, mag, scope: it.scope || null, iron: !!it.iron, attachments: { ...it.attachments } };
        if (!it.scope) this.autoScope(W.cls);
        res = W.name;
      } else if (cur.id === k || (fromCrate && W.tier <= G.WEAPONS[cur.id].tier)) {
        // 같은 총(또는 상자 속 더 나쁜 총): 탄약과 조준경만 챙긴다
        const add = W.ammo === G.WEAPONS[cur.id].ammo ? Math.min(mag || 0, G.AMMO_MAX[W.ammo] - this.ammo[W.ammo]) : 0;
        const takeScope = it.scope && this.scopeCount(it.scope) < 2;
        if (add <= 0 && !takeScope) return null;
        const got = [];
        if (add > 0) { this.ammo[W.ammo] += add; got.push(G.AMMO_NAMES[W.ammo] + ' +' + add); }
        if (takeScope) { this.scopes[it.scope]++; got.push(G.SCOPES[it.scope].name); it.scope = null; this.autoScope(W.cls); }
        res = got.join(', ');
      } else {
        // 다른 총: 들고 있던 총을 내려놓고 바꾼다
        this._drop = { kind: cur.id, mag: cur.mag, scope: cur.scope, iron: !!cur.iron, attachments: { ...cur.attachments } };
        this.weapons[W.cls] = { id: k, mag, scope: it.scope || null, iron: !!it.iron, attachments: { ...it.attachments } };
        if (!it.scope) this.autoScope(W.cls);
        res = W.name;
      }
    } else if (k.startsWith('scope_')) {
      const t = k.slice(6);
      if (this.scopeCount(t) >= 2) return null;
      this.scopes[t]++;
      // 들고 있는 총부터, 조준경이 없는 호환 총에 바로 장착
      const order = [this.cur].concat(['rifle', 'shotgun', 'pistol']);
      for (const c of order) { const w = this.weapons[c]; if (w && !w.scope && G.WEAPONS[w.id].scopes.includes(t) && this.autoScope(c)) break; }
      res = G.SCOPES[t].name;
    } else if (k.startsWith('ammo_')) {
      const t = k.slice(5), add = Math.min(it.amount, G.AMMO_MAX[t] - this.ammo[t]);
      if (add <= 0) return null;
      this.ammo[t] += add; it.amount -= add;
      res = G.AMMO_NAMES[t] + ' 탄약 +' + add;
      if (it.amount > 0) return res;
    } else if (G.THROW_NAMES[k]) {
      if (this.throwables[k] >= 3) return null;
      const add = Math.min(it.amount || 1, 3 - this.throwables[k]);
      this.throwables[k] += add; it.amount = (it.amount || 1) - add;
      res = G.THROW_NAMES[k] + (add > 1 ? ' x' + add : '');
      if (it.amount > 0) return res;
    } else if (k === 'bandage') {
      const add = Math.min(it.amount || 1, 10 - this.meds.bandage);
      if (add <= 0) return null;
      this.meds.bandage += add; it.amount = (it.amount || 1) - add; res = '붕대 +' + add;
      if (it.amount > 0) return res;
    } else if (k === 'medkit') {
      if (this.meds.medkit >= 3) return null;
      this.meds.medkit++; res = '구급상자';
    } else if (k === 'vest') {
      if (this.vest) return null; this.vest = true; res = '방탄조끼';
    } else if (k === 'helmet') {
      if (this.helmet) return null; this.helmet = true; res = '헬멧';
    } else return null;
    it.taken = true;
    return res;
  }
  // 사망 시 상자에 담을 아이템
  dropAll() {
    const items = [];
    for (const k of ['rifle', 'shotgun', 'pistol']) if (this.weapons[k]) items.push({ kind: this.weapons[k].id, mag: this.weapons[k].mag, scope: this.weapons[k].scope, iron: !!this.weapons[k].iron, attachments: { ...this.weapons[k].attachments }, amount: 1 });
    for (const t in this.scopes) for (let i = 0; i < this.scopes[t]; i++) items.push({ kind: 'scope_' + t, amount: 1 });
    for (const t in this.ammo) if (this.ammo[t] > 0) items.push({ kind: 'ammo_' + t, amount: this.ammo[t] });
    for (const k in this.throwables) if (this.throwables[k] > 0) items.push({ kind: k, amount: this.throwables[k] });
    if (this.meds.bandage > 0) items.push({ kind: 'bandage', amount: this.meds.bandage });
    for (let i = 0; i < this.meds.medkit; i++) items.push({ kind: 'medkit', amount: 1 });
    if (this.vest) items.push({ kind: 'vest', amount: 1 });
    if (this.helmet) items.push({ kind: 'helmet', amount: 1 });
    return items;
  }
}
G.Actor = Actor;

/* ------------------------------------------------------------------ */
/* 캐릭터 물리                                                          */
/* ------------------------------------------------------------------ */
G.Physics = {
  STEP: 0.5, R: 0.33, GRAV: 22,
  move(a, dt) {
    const W = G.World, r = this.R, STEP = this.STEP;
    const height = a.knocked ? 0.6 : a.crouch ? 1.25 : 1.8;
    a.vel.y -= this.GRAV * dt;
    if (a.vel.y < -55) a.vel.y = -55;
    let x = a.pos.x + a.vel.x * dt, z = a.pos.z + a.vel.z * dt;
    const feet = a.pos.y;
    for (let it = 0; it < 2; it++) {
      W.queryBoxes(x - r - 0.1, z - r - 0.1, x + r + 0.1, z + r + 0.1, b => {
        if (b.maxY <= feet + STEP || b.minY >= feet + height) return;
        const cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x;
        const cz = z < b.minZ ? b.minZ : z > b.maxZ ? b.maxZ : z;
        let dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), push = r - d;
          dx /= d; dz /= d;
          x += dx * push; z += dz * push;
          const vn = a.vel.x * dx + a.vel.z * dz;
          if (vn < 0) { a.vel.x -= vn * dx; a.vel.z -= vn * dz; }
        } else {
          const pl = x - b.minX, pr = b.maxX - x, pb = z - b.minZ, pf = b.maxZ - z;
          const m = Math.min(pl, pr, pb, pf);
          if (m === pl) x = b.minX - r; else if (m === pr) x = b.maxX + r; else if (m === pb) z = b.minZ - r; else z = b.maxZ + r;
        }
      });
    }
    const lim = W.HALF - 3;
    x = U.clamp(x, -lim, lim); z = U.clamp(z, -lim, lim);
    // 가파른 절벽은 오를 수 없다 (지형 경사 약 52° 이상)
    const mvx = x - a.pos.x, mvz = z - a.pos.z, md = Math.hypot(mvx, mvz);
    if (md > 1e-4) {
      const g0 = W.heightAt(a.pos.x, a.pos.z), g1 = W.heightAt(x, z);
      if ((g1 - g0) / md > 1.3 && g1 > a.pos.y - 0.05) {
        x = a.pos.x; z = a.pos.z;
        const nx = mvx / md, nz = mvz / md, vn = a.vel.x * nx + a.vel.z * nz;
        if (vn > 0) { a.vel.x -= vn * nx; a.vel.z -= vn * nz; }
      }
    }
    let y = a.pos.y + a.vel.y * dt;
    // 천장
    if (a.vel.y > 0) {
      const rr = r * 0.7;
      W.queryBoxes(x - rr, z - rr, x + rr, z + rr, b => {
        if (b.minY >= feet + height - 0.05 && y + height > b.minY) { y = b.minY - height; a.vel.y = 0; }
      });
    }
    const g = W.ground(x, z, feet, r * 0.75, STEP);
    a.groundMat = W._gmat;
    a.landV = 0;
    const was = a.onGround;
    if (y <= g) { if (!was) a.landV = a.vel.y; y = g; a.vel.y = 0; a.onGround = true; }
    else if (was && a.vel.y <= 0 && y - g < 0.55) { y = g; a.vel.y = 0; a.onGround = true; }
    else a.onGround = false;
    a.swimming = false;
    const wl = W.waterAt(x, z);
    if (y < wl - 1.25 && W.heightAt(x, z) < wl - 1.25) {
      y = wl - 1.25; if (a.vel.y < 0) a.vel.y = 0; a.onGround = true; a.swimming = true; a.landV = 0;
    }
    a.inWater = y < wl - 0.15;
    a.pos.set(x, y, z);
    a.hspeed = Math.hypot(a.vel.x, a.vel.z);
  },
  canStand(a) {
    let ok = true;
    const r = this.R * 0.8, x = a.pos.x, z = a.pos.z;
    G.World.queryBoxes(x - r, z - r, x + r, z + r, b => { if (b.minY > a.pos.y + 1.0 && b.minY < a.pos.y + 1.82) ok = false; });
    return ok;
  }
};

})();
