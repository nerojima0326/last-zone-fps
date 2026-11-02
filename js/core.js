// core.js — 공용 유틸리티, 노이즈, 텍스처 생성, 입력, 오디오
(function () {
'use strict';
const G = window.G = window.G || {};
const THREE = window.THREE;

/* ------------------------------------------------------------------ */
/* 유틸리티                                                             */
/* ------------------------------------------------------------------ */
const U = G.U = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  damp(a, b, lambda, dt) { return a + (b - a) * (1 - Math.exp(-lambda * dt)); },
  rand(a = 0, b = 1) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  chance(p) { return Math.random() < p; },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  },
  angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  },
  smoothstep(e0, e1, x) { const t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); },
  mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  },
  fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  // 점(px,pz)과 선분(ax,az)-(bx,bz) 사이 2D 거리
  segDist2D(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t - px, cz = az + dz * t - pz;
    return Math.sqrt(cx * cx + cz * cz);
  },
  now() { return performance.now() / 1000; }
};

/* ------------------------------------------------------------------ */
/* Simplex 노이즈                                                       */
/* ------------------------------------------------------------------ */
G.Noise = {
  make(seed) {
    const rnd = U.mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
    const g3 = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    function noise2(xin, yin) {
      let n0 = 0, n1 = 0, n2 = 0;
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      let i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { const gi = pm12[ii + perm[jj]] * 3; t0 *= t0; n0 = t0 * t0 * (g3[gi] * x0 + g3[gi + 1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { const gi = pm12[ii + i1 + perm[jj + j1]] * 3; t1 *= t1; n1 = t1 * t1 * (g3[gi] * x1 + g3[gi + 1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { const gi = pm12[ii + 1 + perm[jj + 1]] * 3; t2 *= t2; n2 = t2 * t2 * (g3[gi] * x2 + g3[gi + 1] * y2); }
      return 70 * (n0 + n1 + n2);
    }
    function fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
      let a = 1, f = 1, s = 0, n = 0;
      for (let o = 0; o < oct; o++) { s += a * noise2(x * f, y * f); n += a; a *= gain; f *= lac; }
      return s / n;
    }
    return { noise2, fbm };
  }
};

/* ------------------------------------------------------------------ */
/* 절차적 텍스처                                                        */
/* ------------------------------------------------------------------ */
G.Tex = {
  canvas(w, h, draw, opts = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    if (opts.raw) return c;
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.flipY = opts.flipY !== undefined ? opts.flipY : true;
    return t;
  },
  // 타일링 가능한 value 노이즈 (0..1)
  tileNoise(size, period, octaves, seed) {
    const rnd = U.mulberry32(seed);
    const out = new Float32Array(size * size);
    let amp = 1, total = 0, per = period;
    for (let o = 0; o < octaves; o++) {
      const lat = new Float32Array(per * per);
      for (let i = 0; i < lat.length; i++) lat[i] = rnd();
      for (let y = 0; y < size; y++) {
        const fy = y / size * per, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
        const y0 = iy % per, y1 = (iy + 1) % per;
        for (let x = 0; x < size; x++) {
          const fx = x / size * per, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
          const x0 = ix % per, x1 = (ix + 1) % per;
          const a = lat[y0 * per + x0], b = lat[y0 * per + x1], c = lat[y1 * per + x0], d = lat[y1 * per + x1];
          out[y * size + x] += ((a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy) * amp;
        }
      }
      total += amp; amp *= 0.5; per *= 2;
    }
    for (let i = 0; i < out.length; i++) out[i] /= total;
    return out;
  },
  // 높이 배열 → 노멀맵 DataTexture (알파에 그레이스케일 디테일 저장)
  normalMap(h, size, strength, alpha) {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
        const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
        let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len; ny /= len; nz /= len;
        const i = (y * size + x) * 4;
        data[i] = (nx * 0.5 + 0.5) * 255; data[i + 1] = (ny * 0.5 + 0.5) * 255; data[i + 2] = (nz * 0.5 + 0.5) * 255;
        data[i + 3] = alpha ? U.clamp(alpha[y * size + x] * 255, 0, 255) : 255;
      }
    }
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  },
  // 부드러운 원형 스프라이트
  softDot(size = 64, hard = 0) {
    return G.Tex.canvas(size, size, (ctx, w) => {
      const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(U.clamp(hard, 0, 0.9), 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
    }, { clamp: true });
  }
};

/* ------------------------------------------------------------------ */
/* 입력                                                                 */
/* ------------------------------------------------------------------ */
G.Input = {
  keys: {}, hits: {}, mdx: 0, mdy: 0, lmb: false, rmb: false, lmbHit: false, rmbHit: false, wheel: 0,
  locked: false, el: null,
  init(el) {
    this.el = el;
    addEventListener('keydown', e => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (['Tab', 'Space', 'KeyF', 'KeyH', 'KeyM', 'KeyG', 'KeyB', 'KeyC', 'KeyR'].includes(e.code)) e.preventDefault();
      if (!this.keys[e.code]) this.hits[e.code] = true;
      this.keys[e.code] = true;
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.mdx += U.clamp(e.movementX, -250, 250);
      this.mdy += U.clamp(e.movementY, -250, 250);
    });
    addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 0) { this.lmb = true; this.lmbHit = true; }
      if (e.button === 2) { this.rmb = true; this.rmbHit = true; }
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) this.lmb = false;
      if (e.button === 2) this.rmb = false;
    });
    addEventListener('wheel', e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (!this.locked) { this.lmb = this.rmb = false; this.keys = {}; }
      if (G.onLockChange) G.onLockChange(this.locked);
    });
    addEventListener('blur', () => { this.keys = {}; this.lmb = this.rmb = false; });
  },
  lock() {
    try {
      const r = this.el.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* 무시 */ }
  },
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); },
  down(c) { return !!this.keys[c]; },
  hit(c) { return !!this.hits[c]; },
  endFrame() { this.hits = {}; this.mdx = this.mdy = 0; this.lmbHit = this.rmbHit = false; this.wheel = 0; }
};

/* ------------------------------------------------------------------ */
/* 오디오 (WebAudio 합성)                                               */
/* ------------------------------------------------------------------ */
const SHOT = {
  rifle:   { vol: 0.85, crack: 0.05, body: 0.16, lp: 9000, f0: 150, thump: 0.9, td: 0.12, tail: 0.65 },
  pistol:  { vol: 0.65, crack: 0.04, body: 0.10, lp: 10000, f0: 210, thump: 0.6, td: 0.08, tail: 0.45 },
  shotgun: { vol: 1.0, crack: 0.07, body: 0.28, lp: 6500, f0: 95, thump: 1.25, td: 0.22, tail: 0.95 },
  shotgun2: { vol: 1.1, crack: 0.08, body: 0.32, lp: 6000, f0: 85, thump: 1.35, td: 0.25, tail: 1.05 },
  ak:      { vol: 0.92, crack: 0.055, body: 0.19, lp: 8000, f0: 125, thump: 1.0, td: 0.14, tail: 0.75 },
  dmr:     { vol: 1.0, crack: 0.06, body: 0.22, lp: 8500, f0: 115, thump: 1.1, td: 0.16, tail: 0.9 },
  sniper:  { vol: 1.15, crack: 0.07, body: 0.26, lp: 9000, f0: 100, thump: 1.3, td: 0.2, tail: 1.2 },
  pistol45: { vol: 0.72, crack: 0.045, body: 0.13, lp: 8500, f0: 170, thump: 0.75, td: 0.1, tail: 0.5 },
  magnum:  { vol: 0.9, crack: 0.06, body: 0.2, lp: 8000, f0: 130, thump: 1.05, td: 0.15, tail: 0.8 }
};
const A = G.Audio = {
  ctx: null, listener: { x: 0, y: 0, z: 0, yaw: 0 }, loops: {}, _recent: [],
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 12; this.comp.ratio.value = 6;
    this.comp.attack.value = 0.003; this.comp.release.value = 0.25;
    this.comp.connect(c.destination);
    this.muffle = c.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 22000;
    this.muffle.connect(this.comp);
    this.master = c.createGain(); this.master.gain.value = 0.75; this.master.connect(this.muffle);
    this.verb = c.createConvolver(); this.verb.buffer = this._impulse(2.6, 3.2);
    this.verbOut = c.createGain(); this.verbOut.gain.value = 0.55;
    this.verb.connect(this.verbOut); this.verbOut.connect(this.master);
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brownBuf = c.createBuffer(1, len, c.sampleRate);
    const b = this.brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
  },
  _impulse(dur, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 400 ? i / 400 : 1);
    }
    return buf;
  },
  setListener(p, yaw) { const L = this.listener; L.x = p.x; L.y = p.y; L.z = p.z; L.yaw = yaw; },
  _budget() {
    const t = this.ctx.currentTime;
    while (this._recent.length && this._recent[0] < t - 0.1) this._recent.shift();
    if (this._recent.length > 22) return false;
    this._recent.push(t);
    return true;
  },
  spatial(pos, ref = 15) {
    if (!pos) return { g: 1, pan: 0, lp: 20000, rev: 0.1, d: 0 };
    const L = this.listener;
    const dx = pos.x - L.x, dy = pos.y - L.y, dz = pos.z - L.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const g = ref / (ref + d);
    let pan = 0;
    if (d > 0.5) { pan = (dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw)) / d * 0.8; }
    return { g, pan, lp: Math.max(450, 20000 * Math.exp(-d / 110)), rev: Math.min(1, 0.1 + d / 150), d };
  },
  out(sp, vol) {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = vol * sp.g;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = sp.lp;
    g.connect(f);
    let last = f;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = U.clamp(sp.pan, -1, 1); f.connect(p); last = p; }
    last.connect(this.master);
    const s = c.createGain(); s.gain.value = sp.rev; last.connect(s); s.connect(this.verb);
    return g;
  },
  noise(dest, t, o) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = o.brown ? this.brownBuf : this.noiseBuf;
    s.playbackRate.value = o.rate || 1;
    let node = s;
    if (o.hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; node.connect(f); node = f; }
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; if (o.lp1) f.frequency.exponentialRampToValueAtTime(o.lp1, t + o.dur); node.connect(f); node = f; }
    if (o.bp) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.bp; f.Q.value = o.q || 1; if (o.bp1) f.frequency.exponentialRampToValueAtTime(o.bp1, t + o.dur); node.connect(f); node = f; }
    const g = c.createGain();
    const at = o.attack || 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.a), t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + o.dur);
    node.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5);
    s.stop(t + at + o.dur + 0.05);
  },
  tone(dest, t, o) {
    const c = this.ctx;
    const osc = c.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    const g = c.createGain();
    const at = o.attack || 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.a), t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + o.dur);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + at + o.dur + 0.05);
  },
  ok() { return !!this.ctx && this.ctx.state === 'running'; },

  shot(kind, pos, own) {
    if (!this.ok()) return;
    const cfg = SHOT[kind]; if (!cfg) return;
    const sp = this.spatial(own ? null : pos, 28);
    if (sp.g < 0.02 || (!own && !this._budget())) return;
    const t = this.ctx.currentTime, o = this.out(sp, cfg.vol * (own ? 0.9 : 1));
    this.noise(o, t, { dur: cfg.crack, a: 1.0, hp: 500, lp: cfg.lp });
    this.noise(o, t, { dur: cfg.body, a: 0.7, lp: 1600, lp1: 300 });
    this.tone(o, t, { type: 'sine', f0: cfg.f0, f1: 38, a: cfg.thump, dur: cfg.td });
    this.noise(o, t + 0.015, { dur: cfg.tail, a: 0.22, lp: 800, lp1: 200, attack: 0.03 });
    if (own) this.noise(o, t + 0.035, { dur: 0.03, a: 0.12, hp: 3500 });
    if (!own && sp.d > 90) this.noise(o, t, { dur: 0.02, a: 0.4, hp: 2500 });
  },
  explosion(pos) {
    if (!this.ok()) return;
    const sp = this.spatial(pos, 70);
    const t = this.ctx.currentTime, o = this.out(sp, 1.3);
    this.noise(o, t, { dur: 0.08, a: 1.0, hp: 200, lp: 6000 });
    this.noise(o, t, { dur: 1.8, a: 1.0, lp: 1400, lp1: 120, brown: true });
    this.tone(o, t, { type: 'sine', f0: 75, f1: 22, a: 1.3, dur: 0.9 });
    this.noise(o, t + 0.05, { dur: 0.6, a: 0.25, hp: 1800, lp: 7000 });
  },
  flashBang(pos) {
    if (!this.ok()) return;
    const sp = this.spatial(pos, 60);
    const t = this.ctx.currentTime, o = this.out(sp, 1.4);
    this.noise(o, t, { dur: 0.12, a: 1.0, hp: 600 });
    this.noise(o, t, { dur: 0.7, a: 0.6, lp: 3000, lp1: 200 });
    this.tone(o, t, { type: 'sine', f0: 120, f1: 40, a: 0.8, dur: 0.3 });
  },
  ring(amount) {
    if (!this.ok() || amount <= 0.05) return;
    const t = this.ctx.currentTime;
    const o = this.out({ g: 1, pan: 0, lp: 20000, rev: 0 }, 0.18 * amount);
    this.tone(o, t, { type: 'sine', f0: 3600, a: 1, dur: 2.5 + amount * 3, attack: 0.05 });
    this.tone(o, t, { type: 'sine', f0: 3650, a: 0.5, dur: 2 + amount * 3, attack: 0.05 });
    const f = this.muffle.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(350, t);
    f.exponentialRampToValueAtTime(22000, t + 1.5 + amount * 4);
  },
  click(type) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out({ g: 1, pan: 0.1, lp: 20000, rev: 0.05 }, 0.5);
    if (type === 'dry') { this.tone(o, t, { type: 'square', f0: 1800, a: 0.12, dur: 0.02 }); this.noise(o, t, { dur: 0.02, a: 0.2, hp: 4000 }); }
    else if (type === 'magout') { this.noise(o, t, { dur: 0.05, a: 0.4, bp: 1200, q: 3 }); this.tone(o, t, { type: 'triangle', f0: 600, f1: 300, a: 0.15, dur: 0.06 }); }
    else if (type === 'magin') { this.noise(o, t, { dur: 0.04, a: 0.6, bp: 2200, q: 2 }); this.tone(o, t + 0.02, { type: 'square', f0: 900, f1: 500, a: 0.12, dur: 0.04 }); }
    else if (type === 'bolt') { this.noise(o, t, { dur: 0.05, a: 0.5, bp: 3000, q: 2 }); this.noise(o, t + 0.09, { dur: 0.06, a: 0.6, bp: 1800, q: 2 }); }
    else if (type === 'shell') { this.noise(o, t, { dur: 0.05, a: 0.35, bp: 1500, q: 2 }); this.tone(o, t + 0.03, { type: 'triangle', f0: 420, a: 0.15, dur: 0.05 }); }
    else if (type === 'pump') { this.noise(o, t, { dur: 0.08, a: 0.6, bp: 1100, q: 1.5 }); this.noise(o, t + 0.13, { dur: 0.07, a: 0.7, bp: 1600, q: 1.5 }); }
    else if (type === 'pin') { this.tone(o, t, { type: 'triangle', f0: 3200, a: 0.12, dur: 0.04 }); this.noise(o, t + 0.05, { dur: 0.05, a: 0.25, hp: 3000 }); }
    else if (type === 'switch') { this.noise(o, t, { dur: 0.07, a: 0.25, bp: 900, q: 1 }); this.noise(o, t + 0.1, { dur: 0.04, a: 0.3, bp: 2500, q: 2 }); }
    else if (type === 'pickup') { this.noise(o, t, { dur: 0.08, a: 0.3, bp: 1400, q: 1 }); this.tone(o, t + 0.02, { type: 'sine', f0: 700, f1: 900, a: 0.08, dur: 0.07 }); }
    else if (type === 'ui') { this.tone(o, t, { type: 'sine', f0: 900, f1: 1200, a: 0.12, dur: 0.06 }); }
    else if (type === 'heal') { this.noise(o, t, { dur: 0.25, a: 0.2, bp: 2500, q: 0.8 }); }
    else if (type === 'healdone') { this.tone(o, t, { type: 'sine', f0: 660, a: 0.15, dur: 0.12 }); this.tone(o, t + 0.1, { type: 'sine', f0: 990, a: 0.15, dur: 0.2 }); }
    else if (type === 'throw') { this.noise(o, t, { dur: 0.25, a: 0.35, bp: 500, bp1: 1800, q: 1.2 }); }
    else if (type === 'chute') { this.noise(o, t, { dur: 0.5, a: 0.8, lp: 900, brown: true }); this.noise(o, t + 0.05, { dur: 0.3, a: 0.3, bp: 700, q: 1 }); }
    else if (type === 'land') { this.noise(o, t, { dur: 0.15, a: 0.6, lp: 500, brown: true }); }
    else if (type === 'punch') { this.noise(o, t, { dur: 0.12, a: 0.4, bp: 400, bp1: 1200, q: 1 }); }
  },
  hit(head, kill) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out({ g: 1, pan: 0, lp: 20000, rev: 0.02 }, 0.4);
    if (head) { this.tone(o, t, { type: 'sine', f0: 2400, a: 0.35, dur: 0.18 }); this.tone(o, t, { type: 'sine', f0: 3600, a: 0.15, dur: 0.12 }); }
    else this.tone(o, t, { type: 'triangle', f0: 1500, a: 0.25, dur: 0.05 });
    if (kill) { this.tone(o, t + 0.06, { type: 'sine', f0: 880, a: 0.3, dur: 0.15 }); this.tone(o, t + 0.14, { type: 'sine', f0: 1320, a: 0.3, dur: 0.25 }); }
  },
  hurt() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out({ g: 1, pan: 0, lp: 20000, rev: 0.05 }, 0.6);
    this.noise(o, t, { dur: 0.15, a: 0.6, lp: 500, brown: true });
    this.tone(o, t, { type: 'sine', f0: 120, f1: 60, a: 0.4, dur: 0.12 });
  },
  impact(pos, mat) {
    if (!this.ok()) return;
    const sp = this.spatial(pos, 6);
    if (sp.g < 0.08 || !this._budget()) return;
    const t = this.ctx.currentTime, o = this.out(sp, 0.35);
    if (mat === 'metal') { this.tone(o, t, { type: 'triangle', f0: U.rand(1200, 2200), f1: 800, a: 0.3, dur: 0.12 }); this.noise(o, t, { dur: 0.04, a: 0.3, hp: 3000 }); }
    else if (mat === 'flesh') { this.noise(o, t, { dur: 0.07, a: 0.5, lp: 700 }); }
    else { this.noise(o, t, { dur: 0.06, a: 0.4, bp: mat === 'wood' ? 900 : 1600, q: 1.2 }); }
  },
  whiz(pos) {
    if (!this.ok()) return;
    const sp = this.spatial(pos, 4);
    const t = this.ctx.currentTime, o = this.out(sp, 0.45);
    this.noise(o, t, { dur: 0.09, a: 0.6, bp: 4200, bp1: 1800, q: 2.5 });
  },
  footstep(pos, surface, vol) {
    if (!this.ok()) return;
    const sp = this.spatial(pos, 4);
    if (sp.g < 0.06) return;
    const t = this.ctx.currentTime, o = this.out(sp, vol);
    if (surface === 'wood') { this.noise(o, t, { dur: 0.06, a: 0.5, bp: 500, q: 1.5 }); this.tone(o, t, { type: 'sine', f0: 140, f1: 90, a: 0.2, dur: 0.05 }); }
    else if (surface === 'metal') { this.noise(o, t, { dur: 0.05, a: 0.45, bp: 1800, q: 2 }); this.tone(o, t, { type: 'triangle', f0: 600, a: 0.08, dur: 0.06 }); }
    else if (surface === 'hard') { this.noise(o, t, { dur: 0.05, a: 0.45, bp: 1500, q: 1 }); }
    else if (surface === 'water') { this.noise(o, t, { dur: 0.16, a: 0.4, bp: 900, bp1: 400, q: 0.8 }); }
    else { this.noise(o, t, { dur: 0.08, a: 0.45, lp: 1100, hp: 150 }); }
  },
  bounce(pos) {
    if (!this.ok()) return;
    const sp = this.spatial(pos, 6);
    if (sp.g < 0.05) return;
    const t = this.ctx.currentTime, o = this.out(sp, 0.4);
    this.tone(o, t, { type: 'triangle', f0: U.rand(700, 1100), f1: 400, a: 0.25, dur: 0.07 });
    this.noise(o, t, { dur: 0.04, a: 0.25, bp: 1500, q: 2 });
  },
  glass(pos) {
    if (!this.ok()) return;
    const sp = this.spatial(pos, 12);
    const t = this.ctx.currentTime, o = this.out(sp, 0.7);
    this.noise(o, t, { dur: 0.35, a: 0.6, hp: 2500 });
    for (let i = 0; i < 4; i++) this.tone(o, t + i * 0.03, { type: 'sine', f0: U.rand(3000, 6000), a: 0.08, dur: 0.15 });
    this.noise(o, t, { dur: 0.6, a: 0.5, lp: 900, brown: true });
  },
  smokePop(pos) {
    if (!this.ok()) return;
    const sp = this.spatial(pos, 12);
    const t = this.ctx.currentTime, o = this.out(sp, 0.6);
    this.noise(o, t, { dur: 0.05, a: 0.4, hp: 1500 });
    this.noise(o, t + 0.03, { dur: 2.5, a: 0.35, bp: 2500, q: 0.4, attack: 0.15 });
  },
  shellDrop(pos) {
    if (!this.ok()) return;
    const sp = this.spatial(pos, 3);
    if (sp.g < 0.1) return;
    const t = this.ctx.currentTime, o = this.out(sp, 0.15);
    this.tone(o, t, { type: 'sine', f0: U.rand(3500, 5000), a: 0.2, dur: 0.06 });
    this.tone(o, t + 0.07, { type: 'sine', f0: U.rand(3500, 5000), a: 0.1, dur: 0.05 });
  },
  // 루프 사운드 (바람, 비행기, 불, 자기장)
  setLoop(name, vol, pos, ref) {
    if (!this.ctx) return;
    let L = this.loops[name];
    if (!L) {
      if (vol <= 0.001) return;
      L = this.loops[name] = this._makeLoop(name);
    }
    let v = vol, pan = 0;
    if (pos) { const sp = this.spatial(pos, ref || 15); v *= sp.g; pan = sp.pan; }
    const t = this.ctx.currentTime;
    L.gain.gain.setTargetAtTime(v, t, 0.12);
    if (L.pan) L.pan.pan.setTargetAtTime(U.clamp(pan, -1, 1), t, 0.1);
  },
  stopLoops() {
    for (const k in this.loops) this.loops[k].gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  },
  _makeLoop(name) {
    const c = this.ctx;
    const gain = c.createGain(); gain.gain.value = 0;
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { gain.connect(pan); pan.connect(this.master); } else gain.connect(this.master);
    const L = { gain, pan };
    const src = c.createBufferSource(); src.loop = true;
    if (name === 'wind') {
      src.buffer = this.brownBuf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
      src.connect(f); f.connect(gain);
    } else if (name === 'plane') {
      src.buffer = this.brownBuf;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      src.connect(f); f.connect(gain);
      for (const fr of [58, 61.5, 117]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr;
        const og = c.createGain(); og.gain.value = 0.12;
        const of = c.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 380;
        o.connect(of); of.connect(og); og.connect(gain); o.start();
      }
    } else if (name === 'fire') {
      src.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.5;
      const lfo = c.createOscillator(); lfo.frequency.value = 9; const lg = c.createGain(); lg.gain.value = 0.4;
      const mod = c.createGain(); mod.gain.value = 0.6;
      lfo.connect(lg); lg.connect(mod.gain); lfo.start();
      src.connect(f); f.connect(mod); mod.connect(gain);
      const rumble = c.createBufferSource(); rumble.buffer = this.brownBuf; rumble.loop = true;
      const rg = c.createGain(); rg.gain.value = 0.8; rumble.connect(rg); rg.connect(gain); rumble.start();
    } else if (name === 'zone') {
      src.buffer = this.brownBuf;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
      src.connect(f); f.connect(gain);
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 64;
      const og = c.createGain(); og.gain.value = 0.25; o.connect(og); og.connect(gain); o.start();
    }
    src.start();
    return L;
  }
};

})();
