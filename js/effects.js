// effects.js — 파티클, 예광탄, 탄흔, 섬광 조명, 탄피
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;

class Particles {
  constructor(scene, max, blending, tex) {
    this.max = max; this.list = [];
    const geo = this.geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.aPos = mk(3); this.aSize = mk(1); this.aRot = mk(1); this.aCol = mk(4);
    geo.setAttribute('iPos', this.aPos); geo.setAttribute('iSize', this.aSize); geo.setAttribute('iRot', this.aRot); geo.setAttribute('iCol', this.aCol);
    geo.instanceCount = 0;
    const additive = blending === THREE.AdditiveBlending;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, fogColor: { value: new THREE.Color(0xb7cde0) }, fogD: { value: 0.0014 }, additive: { value: additive ? 1 : 0 } },
      vertexShader: `
        attribute vec3 iPos; attribute float iSize; attribute float iRot; attribute vec4 iCol;
        varying vec2 vUv; varying vec4 vCol; varying float vDepth; varying float vSize;
        void main() {
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          float c = cos(iRot), s = sin(iRot);
          mv.xy += vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSize;
          gl_Position = projectionMatrix * mv;
          vUv = uv; vCol = iCol; vDepth = -mv.z; vSize = iSize;
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform vec3 fogColor; uniform float fogD; uniform float additive;
        varying vec2 vUv; varying vec4 vCol; varying float vDepth; varying float vSize;
        void main() {
          vec4 t = texture2D(map, vUv);
          float a = t.a * vCol.a * smoothstep(0.05, 0.25 + vSize * 0.35, vDepth);
          float f = 1.0 - exp(-fogD * fogD * vDepth * vDepth);
          vec3 col = vCol.rgb * t.rgb;
          if (additive > 0.5) a *= (1.0 - f); else col = mix(col, fogColor, f);
          if (a < 0.003) discard;
          gl_FragColor = vec4(col, a);
        }`,
      transparent: true, depthWrite: false, blending
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 3 : 2;
    scene.add(this.mesh);
  }
  spawn(o) {
    if (this.list.length >= this.max) return null;
    const p = {
      x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, age: 0, life: o.life || 1,
      s0: o.s0 || 0.2, s1: o.s1 === undefined ? (o.s0 || 0.2) : o.s1, r: o.r === undefined ? 1 : o.r, g: o.g === undefined ? 1 : o.g, b: o.b === undefined ? 1 : o.b,
      a: o.a === undefined ? 1 : o.a, rot: o.rot === undefined ? Math.random() * 6.28 : o.rot, vr: o.vr || 0, grav: o.grav || 0, drag: o.drag || 0,
      fin: o.fin || 0.001, fo: o.fo === undefined ? 1 : o.fo, floor: o.floor
    };
    this.list.push(p);
    return p;
  }
  update(dt) {
    const L = this.list, P = this.aPos.array, S = this.aSize.array, R = this.aRot.array, Cc = this.aCol.array;
    let n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) { L[i] = L[L.length - 1]; L.pop(); i--; continue; }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr - p.grav * dt; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
      if (p.floor !== undefined && p.y < p.floor) { p.y = p.floor; p.vy *= -0.25; p.vx *= 0.5; p.vz *= 0.5; }
      const t = p.age / p.life;
      P[n * 3] = p.x; P[n * 3 + 1] = p.y; P[n * 3 + 2] = p.z;
      S[n] = p.s0 + (p.s1 - p.s0) * (1 - (1 - t) * (1 - t));
      R[n] = p.rot;
      Cc[n * 4] = p.r; Cc[n * 4 + 1] = p.g; Cc[n * 4 + 2] = p.b;
      Cc[n * 4 + 3] = p.a * Math.min(1, t / p.fin) * Math.pow(1 - t, p.fo);
      n++;
    }
    this.geo.instanceCount = n;
    if (n === 0 && this.lastN === 0) return;
    this.lastN = n;
    // 실제 사용 중인 범위만 GPU로 업로드
    for (const a of [this.aPos, this.aSize, this.aRot, this.aCol]) {
      if (a.clearUpdateRanges) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n) * a.itemSize); }
      a.needsUpdate = true;
    }
  }
  clear() { this.list.length = 0; this.geo.instanceCount = 0; }
}

const FX = G.FX = {
  shakeAmt: 0,
  init(scene) {
    this.scene = scene;
    const soft = G.Tex.softDot(64, 0.0);
    const smokeTex = G.Tex.canvas(128, 128, (c, w) => {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * 6.28, d = Math.random() * w * 0.18;
        const x = w / 2 + Math.cos(a) * d, y = w / 2 + Math.sin(a) * d, r = w * (0.18 + Math.random() * 0.2);
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.32)'); g.addColorStop(0.6, 'rgba(235,235,235,0.14)'); g.addColorStop(1, 'rgba(220,220,220,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, w);
      }
    }, { clamp: true });
    this.add = new Particles(scene, 3000, THREE.AdditiveBlending, soft);
    this.norm = new Particles(scene, 3000, THREE.NormalBlending, smokeTex);
    // 예광탄 — 핸들(Object3D)로 위치를 계산하고 인스턴스 메시 하나로 그린다
    const tg = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.72, 0.38).multiplyScalar(7), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.tracerIM = instanced(scene, tg, this.tracerMat, 80, 4);
    this.tracers = [];
    for (let i = 0; i < 80; i++) { const h = new THREE.Object3D(); h.visible = false; h.userData.busy = false; this.tracers.push(h); }
    // 탄흔
    const holeTex = G.Tex.canvas(64, 64, (c, w) => {
      const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(10,8,6,1)'); g.addColorStop(0.22, 'rgba(25,20,16,0.95)'); g.addColorStop(0.4, 'rgba(70,60,50,0.55)'); g.addColorStop(1, 'rgba(90,80,70,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, w);
    }, { clamp: true });
    const dg = new THREE.PlaneGeometry(0.14, 0.14);
    const dm = new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.decalIM = instanced(scene, dg, dm, 200, 1); this.decalIdx = 0;
    const scorchTex = G.Tex.canvas(128, 128, (c, w) => {
      const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(8,6,4,0.9)'); g.addColorStop(0.5, 'rgba(20,16,12,0.6)'); g.addColorStop(1, 'rgba(30,25,20,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, w);
    }, { clamp: true });
    const sm = new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    this.scorchIM = instanced(scene, new THREE.PlaneGeometry(4, 4), sm, 12, 1); this.scorchIdx = 0;
    // 조명 풀 (개수 고정 → 셰이더 재컴파일 없음, 모든 픽셀이 루프를 돌기 때문에 2개로 제한)
    this.lights = [];
    for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffaa55, 0, 30, 2); l.userData = { t: 0, dur: 1, i0: 0 }; scene.add(l); this.lights.push(l); }
    // 탄피
    const sg = new THREE.CylinderGeometry(0.0055, 0.0055, 0.032, 6).rotateZ(Math.PI / 2);
    const smat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.3 });
    this.shellIM = instanced(scene, sg, smat, 30, 0);
    this.shellIM.castShadow = false;
    this.shells = [];
    const brass = new THREE.Color(0xc9a040);
    for (let i = 0; i < 30; i++) {
      const h = new THREE.Object3D(); h.visible = false; h.userData = { vel: new THREE.Vector3(), life: 0, bounced: false, spin: new THREE.Vector3() };
      this.shells.push(h); this.shellIM.setColorAt(i, brass);
    }
    this.shellColors = { brass, red: new THREE.Color(0xa02020) };
    this.shellIdx = 0;
  },
  setFog(color, d) {
    for (const s of [this.add, this.norm]) { s.mat.uniforms.fogColor.value.copy(color); s.mat.uniforms.fogD.value = d; }
  },
  reset() {
    this.add.clear(); this.norm.clear();
    for (const t of this.tracers) { t.visible = false; t.userData.busy = false; }
    for (const im of [this.decalIM, this.scorchIM]) { for (let i = 0; i < im.count; i++) im.setMatrixAt(i, ZERO); im.instanceMatrix.needsUpdate = true; }
    for (const l of this.lights) { l.intensity = 0; l.userData.t = 0; }
    for (const s of this.shells) s.visible = false;
    this.shakeAmt = 0;
  },
  shake(a) { this.shakeAmt = Math.min(1.5, Math.max(this.shakeAmt, a)); },

  getTracer() { for (const t of this.tracers) if (!t.userData.busy) { t.userData.busy = true; t.visible = false; return t; } return null; },
  freeTracer(t) { if (t) { t.visible = false; t.userData.busy = false; } },

  light(pos, color, intensity, dur, dist) {
    let best = this.lights[0];
    for (const l of this.lights) if (l.userData.t <= 0 || l.userData.t / l.userData.dur < best.userData.t / best.userData.dur) best = l;
    best.position.copy(pos); best.color.setHex(color); best.distance = dist || 30;
    best.userData.t = dur; best.userData.dur = dur; best.userData.i0 = intensity; best.intensity = intensity;
    return best;
  },

  decal(point, normal) {
    const im = this.decalIM, o = _o;
    o.position.copy(point).addScaledVector(normal, 0.012);
    _v.copy(point).add(normal);
    o.scale.setScalar(0.8 + Math.random() * 0.5);
    o.lookAt(_v); o.rotateZ(Math.random() * 6.28); o.updateMatrix();
    im.setMatrixAt(this.decalIdx++ % im.count, o.matrix);
    im.instanceMatrix.needsUpdate = true;
  },
  scorch(point, normal) {
    const im = this.scorchIM, o = _o;
    o.position.copy(point).addScaledVector(normal, 0.05);
    _v.copy(point).add(normal);
    o.scale.setScalar(1);
    o.lookAt(_v); o.rotateZ(Math.random() * 6.28); o.updateMatrix();
    im.setMatrixAt(this.scorchIdx++ % im.count, o.matrix);
    im.instanceMatrix.needsUpdate = true;
  },

  spark(p, n, nx, ny, nz, speed) {
    for (let i = 0; i < n; i++) {
      const s = (speed || 6) * (0.4 + Math.random());
      this.add.spawn({ x: p.x, y: p.y, z: p.z, vx: (nx + (Math.random() - 0.5) * 1.6) * s, vy: (ny + Math.random() * 0.8) * s, vz: (nz + (Math.random() - 0.5) * 1.6) * s,
        life: 0.12 + Math.random() * 0.3, s0: 0.05, s1: 0.02, r: 6, g: 3.6, b: 1.4, grav: 14, drag: 1.5 });
    }
  },
  dust(p, n, nx, ny, nz, r, g, b, scale) {
    scale = scale || 1;
    for (let i = 0; i < n; i++) {
      this.norm.spawn({ x: p.x, y: p.y, z: p.z, vx: (nx * 1.5 + (Math.random() - 0.5)) * scale, vy: (ny * 1.5 + Math.random() * 0.6) * scale, vz: (nz * 1.5 + (Math.random() - 0.5)) * scale,
        life: 0.6 + Math.random() * 0.8, s0: 0.15 * scale, s1: (0.9 + Math.random() * 0.6) * scale, r, g, b, a: 0.55, grav: -0.3, drag: 3, vr: (Math.random() - 0.5) * 2, fin: 0.05 });
    }
  },
  debris(p, n, nx, ny, nz, r, g, b) {
    for (let i = 0; i < n; i++) {
      this.norm.spawn({ x: p.x, y: p.y, z: p.z, vx: (nx + (Math.random() - 0.5) * 1.4) * 4, vy: (ny + Math.random()) * 4, vz: (nz + (Math.random() - 0.5) * 1.4) * 4,
        life: 0.5 + Math.random() * 0.5, s0: 0.05, s1: 0.04, r, g, b, a: 1, grav: 12, drag: 0.5, fo: 0.3, floor: p.y - 2 });
    }
  },
  impact(p, nrm, mat) {
    const nx = nrm.x, ny = nrm.y, nz = nrm.z;
    if (mat === 'terrain') { this.dust(p, 4, nx, ny, nz, 0.46, 0.4, 0.3); this.debris(p, 4, nx, ny, nz, 0.25, 0.2, 0.15); }
    else if (mat === 'metal') { this.spark(p, 9, nx, ny, nz, 7); this.dust(p, 1, nx, ny, nz, 0.6, 0.6, 0.6, 0.6); this.decal(p, nrm); }
    else if (mat === 'wood') { this.dust(p, 3, nx, ny, nz, 0.6, 0.5, 0.35, 0.8); this.debris(p, 5, nx, ny, nz, 0.45, 0.32, 0.2); this.decal(p, nrm); }
    else if (mat === 'soft') { this.dust(p, 4, nx, ny, nz, 0.65, 0.58, 0.42); }
    else { this.dust(p, 3, nx, ny, nz, 0.7, 0.68, 0.64, 0.8); this.spark(p, 2, nx, ny, nz, 4); this.debris(p, 3, nx, ny, nz, 0.5, 0.5, 0.48); this.decal(p, nrm); }
  },
  splash(p) {
    for (let i = 0; i < 8; i++) this.norm.spawn({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 1.5, life: 0.5 + Math.random() * 0.4, s0: 0.1, s1: 0.4, r: 0.85, g: 0.92, b: 1, a: 0.7, grav: 9, drag: 1 });
  },
  blood(p, dx, dy, dz, n) {
    for (let i = 0; i < n; i++) {
      this.norm.spawn({ x: p.x, y: p.y, z: p.z, vx: dx * 2.5 + (Math.random() - 0.5) * 2, vy: dy * 2.5 + Math.random() * 1.5, vz: dz * 2.5 + (Math.random() - 0.5) * 2,
        life: 0.3 + Math.random() * 0.3, s0: 0.06, s1: 0.2, r: 0.42, g: 0.02, b: 0.02, a: 0.9, grav: 9, drag: 1.5 });
    }
    this.norm.spawn({ x: p.x, y: p.y, z: p.z, vx: dx, vy: 0.3, vz: dz, life: 0.45, s0: 0.2, s1: 0.8, r: 0.5, g: 0.04, b: 0.04, a: 0.45, drag: 3 });
  },
  muzzle(p, dx, dy, dz, big) {
    const s = big ? 0.7 : 0.45;
    this.add.spawn({ x: p.x, y: p.y, z: p.z, life: 0.05, s0: s, s1: s * 1.2, r: 9, g: 5.5, b: 2.2, a: 1 });
    this.add.spawn({ x: p.x + dx * 0.25, y: p.y + dy * 0.25, z: p.z + dz * 0.25, life: 0.05, s0: s * 0.6, s1: s * 0.8, r: 9, g: 5, b: 2, a: 0.8 });
    this.norm.spawn({ x: p.x + dx * 0.3, y: p.y + dy * 0.3, z: p.z + dz * 0.3, vx: dx * 1.5, vy: dy * 1.5 + 0.3, vz: dz * 1.5, life: 0.5, s0: 0.15, s1: 0.6, r: 0.7, g: 0.7, b: 0.7, a: 0.2, drag: 3 });
  },
  explosion(p) {
    this.light(p, 0xff9040, 900, 0.35, 45);
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * 6.28, e = Math.random() * 1.4, s = 4 + Math.random() * 9;
      this.add.spawn({ x: p.x, y: p.y + 0.4, z: p.z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + 1, vz: Math.sin(a) * Math.cos(e) * s,
        life: 0.35 + Math.random() * 0.45, s0: 1.4, s1: 3.8 + Math.random() * 2, r: 7, g: 3.2 + Math.random(), b: 0.9, a: 0.9, drag: 4.5, fo: 1.5 });
    }
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.28, s = 8 + Math.random() * 16;
      this.add.spawn({ x: p.x, y: p.y + 0.3, z: p.z, vx: Math.cos(a) * s, vy: 3 + Math.random() * 12, vz: Math.sin(a) * s, life: 0.4 + Math.random() * 0.8, s0: 0.12, s1: 0.05, r: 7, g: 4, b: 1.5, grav: 16, drag: 0.8 });
    }
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * 6.28, s = 1 + Math.random() * 5;
      this.norm.spawn({ x: p.x + (Math.random() - 0.5), y: p.y + 0.5 + Math.random(), z: p.z + (Math.random() - 0.5), vx: Math.cos(a) * s, vy: 1.5 + Math.random() * 3, vz: Math.sin(a) * s,
        life: 2.5 + Math.random() * 2.5, s0: 2, s1: 7 + Math.random() * 4, r: 0.22, g: 0.2, b: 0.19, a: 0.75, drag: 1.6, grav: -0.4, vr: (Math.random() - 0.5), fin: 0.08 });
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * 6.28, s = 5 + Math.random() * 5;
      this.norm.spawn({ x: p.x, y: p.y + 0.2, z: p.z, vx: Math.cos(a) * s, vy: 0.4, vz: Math.sin(a) * s, life: 1.5 + Math.random(), s0: 1, s1: 4, r: 0.5, g: 0.44, b: 0.34, a: 0.5, drag: 2.2, fin: 0.05 });
    }
    this.debris(p, 16, 0, 1, 0, 0.18, 0.15, 0.12);
    _n.set(0, 1, 0);
    if (G.World) { G.World.normalAt(p.x, p.z, _n); const gh = G.World.heightAt(p.x, p.z); if (Math.abs(gh - p.y) < 1.2) { _v2.set(p.x, gh, p.z); this.scorch(_v2, _n); } }
  },
  flashbang(p) {
    this.light(p, 0xffffff, 3000, 0.25, 60);
    this.add.spawn({ x: p.x, y: p.y + 0.2, z: p.z, life: 0.25, s0: 3, s1: 9, r: 12, g: 12, b: 12, a: 1, fo: 2 });
    for (let i = 0; i < 20; i++) this.add.spawn({ x: p.x, y: p.y + 0.2, z: p.z, vx: (Math.random() - 0.5) * 16, vy: Math.random() * 8, vz: (Math.random() - 0.5) * 16, life: 0.3, s0: 0.1, s1: 0.03, r: 8, g: 8, b: 8, grav: 10 });
    this.norm.spawn({ x: p.x, y: p.y + 0.5, z: p.z, vy: 0.5, life: 3, s0: 1, s1: 3.5, r: 0.8, g: 0.8, b: 0.8, a: 0.35, drag: 1 });
  },
  shell(pos, vel, red) {
    const i = this.shellIdx++ % this.shells.length, m = this.shells[i];
    this.shellIM.setColorAt(i, red ? this.shellColors.red : this.shellColors.brass);
    this.shellIM.instanceColor.needsUpdate = true;
    m.position.copy(pos); m.userData.vel.copy(vel); m.userData.life = 2.5; m.userData.bounced = false;
    m.userData.spin.set(Math.random() * 20, Math.random() * 20, Math.random() * 20);
    m.scale.setScalar(red ? 2.4 : 1);
    m.visible = true;
  },

  update(dt) {
    this.add.update(dt); this.norm.update(dt);
    for (const l of this.lights) {
      const u = l.userData;
      if (u.t > 0) { u.t -= dt; l.intensity = u.t > 0 ? u.i0 * (u.t / u.dur) * (u.flicker ? 0.7 + Math.random() * 0.6 : 1) : 0; }
    }
    // 예광탄 인스턴스 갱신
    const tim = this.tracerIM;
    for (let i = 0; i < this.tracers.length; i++) {
      const h = this.tracers[i];
      if (h.visible) { h.updateMatrix(); tim.setMatrixAt(i, h.matrix); } else tim.setMatrixAt(i, ZERO);
    }
    tim.instanceMatrix.needsUpdate = true;
    const sim = this.shellIM;
    for (let i = 0; i < this.shells.length; i++) {
      const m = this.shells[i];
      if (!m.visible) { sim.setMatrixAt(i, ZERO); continue; }
      const u = m.userData;
      u.life -= dt;
      if (u.life <= 0) { m.visible = false; sim.setMatrixAt(i, ZERO); continue; }
      u.vel.y -= 9.8 * dt;
      m.position.addScaledVector(u.vel, dt);
      m.rotation.x += u.spin.x * dt; m.rotation.y += u.spin.y * dt; m.rotation.z += u.spin.z * dt;
      const g = G.World.ground(m.position.x, m.position.z, m.position.y + 0.2, 0.02, 0.3);
      if (m.position.y < g + 0.006) {
        m.position.y = g + 0.006;
        if (u.vel.y < -0.5) { u.vel.y *= -0.35; u.vel.x *= 0.5; u.vel.z *= 0.5; if (!u.bounced) { u.bounced = true; G.Audio.shellDrop(m.position); } }
        else { u.vel.set(0, 0, 0); u.spin.multiplyScalar(0.9); }
      }
      m.updateMatrix(); sim.setMatrixAt(i, m.matrix);
    }
    sim.instanceMatrix.needsUpdate = true;
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.8);
  }
};
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _n = new THREE.Vector3(), _o = new THREE.Object3D();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function instanced(scene, geo, mat, n, order) {
  const im = new THREE.InstancedMesh(geo, mat, n);
  for (let i = 0; i < n; i++) im.setMatrixAt(i, ZERO);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  im.renderOrder = order || 0;
  scene.add(im);
  return im;
}

})();
