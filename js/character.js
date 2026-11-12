// character.js — 절차적 인간형 캐릭터 모델 + 애니메이션 + 낙하산
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;

const OUTFITS = [
  { top: 0x4a5236, pants: 0x3e4430, gear: 0x2f3324 },  // 올리브
  { top: 0x8a7a5a, pants: 0x6e6248, gear: 0x5a4e38 },  // 사막
  { top: 0x5a6068, pants: 0x3c4046, gear: 0x26292d },  // 어반
  { top: 0x23262a, pants: 0x1c1e21, gear: 0x111214 },  // 블랙
  { top: 0x2e3a52, pants: 0x262e3e, gear: 0x1c2230 },  // 네이비
  { top: 0x5b4636, pants: 0x403226, gear: 0x2e241c },  // 브라운
  { top: 0x6a6f4a, pants: 0x50553a, gear: 0x3a3e2a },  // 카키
  { top: 0x7a7e84, pants: 0x55585c, gear: 0x3a3c40 }   // 그레이
];
const SKINS = [0xe8c4a0, 0xd8a77f, 0xb9855c, 0x8d5b3c, 0xf0d0b0];

G.CharMat = null;
function mat() {
  if (!G.CharMat) G.CharMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 });
  return G.CharMat;
}
// 색을 입힌 (비인덱스) 지오메트리
function cg(g, hex) {
  if (g.index) g = g.toNonIndexed();
  if (g.attributes.uv) g.deleteAttribute('uv');
  const n = g.attributes.position.count, a = new Float32Array(n * 3), c = new THREE.Color(hex);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function bx(w, h, d, x, y, z, hex) { return cg(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex); }
function merge(list) { return THREE.mergeGeometries(list, false); }
G.cg = cg; G.bx = bx; G.mergeGeo = merge;

class CharacterModel {
  constructor(o) {
    o = o || {};
    const fit = o.outfit || U.pick(OUTFITS), skin = o.skin || U.pick(SKINS);
    // 관절은 Bone, 몸 전체는 SkinnedMesh 1개 (부위별 강체 스키닝) → 캐릭터당 드로우콜 1개
    const parts = []; // { geo, bone }
    const root = this.root = new THREE.Group();
    root.rotation.order = 'YXZ';
    const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); parent.add(b); return b; };
    const mesh = (geo, b) => { parts.push({ geo, bone: b }); };

    const hip = this.hip = bone(root, 0, 0.95, 0);
    mesh(merge([bx(0.36, 0.2, 0.22, 0, 0, 0, fit.pants), bx(0.37, 0.05, 0.23, 0, 0.08, 0, 0x1a1a1a), bx(0.08, 0.06, 0.06, 0, 0.08, -0.12, 0x777777)]), hip);
    const leg = (x) => {
      const g = bone(hip, x, -0.04, 0);
      mesh(merge([bx(0.15, 0.44, 0.16, 0, -0.22, 0, fit.pants), bx(0.16, 0.12, 0.09, x > 0 ? 0.03 : -0.03, -0.25, -0.02, fit.gear)]), g);
      const k = bone(g, 0, -0.44, 0);
      mesh(merge([bx(0.13, 0.42, 0.14, 0, -0.2, 0, fit.pants), bx(0.15, 0.1, 0.26, 0, -0.44, -0.045, 0x2a241e), bx(0.15, 0.14, 0.15, 0, -0.35, 0, 0x3a3128)]), k);
      return [g, k];
    };
    [this.legL, this.kneeL] = leg(-0.1);
    [this.legR, this.kneeR] = leg(0.1);

    const spine = this.spine = bone(hip, 0, 0.06, 0);
    const torso = [bx(0.4, 0.5, 0.22, 0, 0.25, 0, fit.top)];
    if (o.vest !== false) {
      torso.push(bx(0.44, 0.36, 0.28, 0, 0.29, 0, fit.gear));
      torso.push(bx(0.1, 0.12, 0.05, -0.12, 0.2, -0.16, fit.gear), bx(0.1, 0.12, 0.05, 0, 0.2, -0.16, fit.gear), bx(0.1, 0.12, 0.05, 0.12, 0.2, -0.16, fit.gear));
    }
    torso.push(bx(0.3, 0.36, 0.16, 0, 0.3, 0.2, fit.gear), bx(0.26, 0.08, 0.14, 0, 0.5, 0.2, 0x222222));
    mesh(merge(torso), spine);
    const chest = this.chest = bone(spine, 0, 0.42, 0);
    const head = this.head = bone(chest, 0, 0.12, 0);
    const hg = [cg(new THREE.SphereGeometry(0.115, 12, 10).scale(1, 1.15, 1.05).translate(0, 0.12, 0), skin),
      bx(0.07, 0.07, 0.07, 0, 0.0, 0, skin),
      bx(0.17, 0.035, 0.03, 0, 0.14, -0.105, 0x111111)];
    hg.push(cg(new THREE.SphereGeometry(0.122, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42).translate(0, 0.15, 0.01), U.pick([0x2a2a2a, 0x4a3a2a, fit.top, 0x6a2a2a])));
    mesh(merge(hg), head);
    const arm = (x, band) => {
      const s = bone(chest, x, 0.03, 0);
      const ua = [bx(0.11, 0.3, 0.11, 0, -0.14, 0, fit.top)];
      if (band) ua.push(bx(0.125, 0.06, 0.125, 0, -0.1, 0, band));
      mesh(merge(ua), s);
      const e = bone(s, 0, -0.29, 0);
      mesh(merge([bx(0.1, 0.27, 0.1, 0, -0.13, 0, fit.top), bx(0.09, 0.1, 0.1, 0, -0.3, 0, 0x2a2a26)]), e);
      return [s, e];
    };
    [this.armL, this.elbowL] = arm(-0.25, o.band);
    [this.armR, this.elbowR] = arm(0.25, null);
    this.gunMount = bone(chest, 0.05, -0.1, -0.3);
    this.guns = {};
    this.curGun = null;
    // 바인드 포즈(모든 회전 0)에서 부위 지오메트리를 모델 공간으로 옮기고 뼈 인덱스를 부여
    const bones = [hip, this.legL, this.kneeL, this.legR, this.kneeR, spine, chest, head, this.armL, this.elbowL, this.armR, this.elbowR, this.gunMount];
    root.updateMatrixWorld(true);
    const skinned = parts.map(p => {
      const g = p.geo.clone().applyMatrix4(p.bone.matrixWorld);
      const n = g.attributes.position.count, bi = bones.indexOf(p.bone);
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      return g;
    });
    const body = this.body = new THREE.SkinnedMesh(merge(skinned), mat());
    body.castShadow = true; body.receiveShadow = true;
    body.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.2);
    root.add(body);
    body.add(hip);
    body.updateMatrixWorld(true);
    body.bind(new THREE.Skeleton(bones));
    this.meshes = [body];
    this.helmetMesh = new THREE.Mesh(merge([cg(new THREE.SphereGeometry(0.15, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 0.14, 0.005), 0x3d4a2a),
      bx(0.31, 0.022, 0.035, 0, 0.115, 0.0, 0x2e3820), bx(0.06, 0.03, 0.02, 0, 0.2, -0.13, 0x222222)]), mat());
    this.helmetMesh.castShadow = true;
    this.helmetMesh.visible = !!o.helmet;
    head.add(this.helmetMesh);
    this.meshes.push(this.helmetMesh);
    // 원거리용 LOD: 기본 자세를 정적 메시 하나로 병합 (스키닝/관절 갱신 불필요)
    this.armL.rotation.set(1.35, 0, 0.55); this.elbowL.rotation.x = 0.35;
    this.armR.rotation.set(1.1, 0, -0.2); this.elbowR.rotation.x = 0.9;
    root.updateMatrixWorld(true);
    const lodParts = parts.map(p => p.geo.clone().applyMatrix4(p.bone.matrixWorld));
    if (G.Guns) lodParts.push(G.Guns.tpGeo('rifle').clone().applyMatrix4(this.gunMount.matrixWorld));
    this.lodMesh = new THREE.Mesh(merge(lodParts), mat());
    this.lodMesh.visible = false;
    root.add(this.lodMesh);
    for (const p of parts) p.geo.dispose();
    this.lod = false;
    // 낙하산
    this.chute = null;
    this.phase = Math.random() * 6;
    this.deathT = 0; this.fallDir = Math.random() < 0.5 ? 1 : -1;
    this.kick = 0; this.flinch = 0; this.throwT = 0;
    // 실사 군인 모델 (Rocketbox): 절차적 뼈대는 자세 계산용으로만 남기고 몸은 군인 메시로 그린다
    this.soldier = null;
    if (G.Soldiers && G.Soldiers.ready && o.soldier !== false) {
      const sd = this.soldier = G.Soldiers.create(o.random);
      root.add(sd.root);
      body.geometry.setDrawRange(0, 0); body.castShadow = false; // 총 거치대가 body 아래라 숨기지 않고 그리기만 생략
      this.meshes = sd.meshes ? sd.meshes.slice() : [sd.body];
      if (sd.patch) {
        this.helmetMesh.position.y = 0.06;
        this.helmetMesh.scale.setScalar(0.9);
        this.meshes.push(this.helmetMesh);
      }
      else {
        head.remove(this.helmetMesh); this.helmetMesh.geometry.dispose();
        if (sd.helmet) { this.helmetMesh = sd.helmet; this.meshes.push(sd.helmet); }
        else this.helmetMesh = new THREE.Object3D();
      }
      this.helmetMesh.visible = !!o.helmet;
    }
  }
  setGun(type) {
    if (this.curGun === type) return;
    for (const k in this.guns) this.guns[k].visible = false;
    this.curGun = type;
    if (!type || type === 'fists' || type === 'throw') return;
    if (!this.guns[type]) {
      const m = G.Guns.tpModel(type);
      m.castShadow = true;
      this.gunMount.add(m); this.guns[type] = m;
    }
    this.guns[type].visible = true;
  }
  showChute(on) {
    if (on && !this.chute) this.chute = makeChute(), this.root.add(this.chute);
    if (this.chute) this.chute.visible = on;
  }
  setShadows(on) { for (const m of this.meshes) m.castShadow = on; for (const k in this.guns) this.guns[k].castShadow = on; }
  setHelmet(on) { if (this.helmetMesh.visible !== on) this.helmetMesh.visible = on; }
  setLOD(on, crouch) {
    if (this.soldier) {
      if (this.soldier.patch) {
        this.soldier.root.visible = !on; this.body.visible = !on; this.lodMesh.visible = on;
        this.lodMesh.scale.y = crouch ? 0.72 : 1;
      }
      this.lod = on; return;
    }
    if (this.lod !== on) { this.lod = on; this.body.visible = !on; this.lodMesh.visible = on; }
    if (on) this.lodMesh.scale.y = crouch ? 0.72 : 1;
  }
  update(dt, a) {
    const r = this.root;
    let hipY = 0.95, spineRX = 0, chestRX = U.clamp(a.pitch, -1.1, 1.1) * 0.85, headRX = U.clamp(a.pitch, -1, 1) * 0.15;
    let lT = 0, lK = 0, rT = 0, rK = 0;
    this.ikGun = null;
    let aL = [1.35, 0, 0.55], eL = 0.35, aR = [1.1, 0, -0.2], eR = 0.9;
    const gun = a.cur;
    if (gun === 'pistol') { aL = [1.42, 0, 0.42]; eL = 0.25; aR = [1.45, 0, -0.18]; eR = 0.12; }
    else if (gun === 'fists' || gun === 'throw' || !gun) { aL = [0.9, 0, 0.15]; eL = 1.5; aR = [0.9, 0, -0.15]; eR = 1.5; }
    this.kick = U.damp(this.kick, 0, 14, dt);
    this.flinch = U.damp(this.flinch, 0, 8, dt);
    r.rotation.x = 0; r.rotation.z = 0;
    let yOff = 0;
    if (a.dead) {
      this.deathT += dt;
      const d = U.clamp(this.deathT / 0.75, 0, 1), e = d * d * (3 - 2 * d);
      r.rotation.x = this.fallDir * e * Math.PI / 2 * 0.97;
      yOff = e * 0.14;
      lK = -0.3 * e; rK = -0.5 * e; aL = [0.5 + e, 0, 0.4]; aR = [0.3 + e * 0.8, 0, -0.4]; eL = 0.3; eR = 0.5;
      chestRX = 0; headRX = 0.2 * e;
      this.setGun(null);
    } else if (a.knocked) {
      r.rotation.x = -1.4; yOff = 0.2;
      this.phase += a.speed * dt * 3;
      const s = Math.sin(this.phase) * Math.min(1, a.speed);
      lT = -0.2 + s * 0.4; rT = -0.2 - s * 0.4; lK = -0.6; rK = -0.6;
      aL = [2.4 + s * 0.4, 0, 0.3]; aR = [2.4 - s * 0.4, 0, -0.3]; eL = 0.5; eR = 0.5;
      chestRX = 0.5; headRX = 0.6;
      this.setGun(null);
    } else if (a.state === 'freefall') {
      r.rotation.x = -1.25; yOff = 1;
      aL = [0.4, 0, -1.3]; aR = [0.4, 0, 1.3]; eL = 0.6; eR = 0.6;
      lT = 0.25; rT = 0.15; lK = -0.6; rK = -0.5; chestRX = 0.4; headRX = 0.6;
      this.setGun(null);
    } else if (a.state === 'chute') {
      aL = [2.7, 0, 0.3]; aR = [2.7, 0, -0.3]; eL = 0.3; eR = 0.3;
      this.phase += dt * 2;
      lT = 0.15 + Math.sin(this.phase) * 0.1; rT = 0.1 - Math.sin(this.phase) * 0.1; lK = -0.25; rK = -0.3;
      chestRX = 0; headRX = 0;
      this.setGun(null);
    } else {
      const sp = a.speed;
      const amp = U.clamp(sp / 4.2, 0, 1.25);
      this.phase += sp * dt * 1.9;
      const ph = this.phase;
      lT = Math.sin(ph) * 0.6 * amp; rT = -lT;
      lK = -Math.max(0, Math.sin(ph - 1.2)) * 1.0 * amp; rK = -Math.max(0, Math.sin(ph + Math.PI - 1.2)) * 1.0 * amp;
      hipY += Math.abs(Math.cos(ph)) * 0.035 * amp;
      spineRX = -0.08 * amp;
      if (a.crouch) {
        hipY = 0.62 + Math.abs(Math.cos(ph)) * 0.02 * amp;
        lT = 1.1 + lT * 0.5; rT = 1.1 + rT * 0.5; lK = -1.75 + lK * 0.3; rK = -1.75 + rK * 0.3;
        spineRX = -0.3;
      }
      if (!a.onGround) { lT = 0.5; rT = -0.1; lK = -0.9; rK = -0.4; }
      this.setGun(a.gun || gun);
      this.ikGun = (gun === 'rifle' || gun === 'shotgun' || gun === 'pistol') && this.throwT <= 0 ? gun : null;
      if (this.throwT > 0) { this.throwT -= dt; const k = this.throwT / 0.5; aR = [2.6 * k + 0.6, 0, -0.2]; eR = 0.8 * k; }
    }
    r.position.y += yOff;
    this.hip.position.y = hipY;
    this.spine.rotation.x = spineRX - this.flinch * 0.3;
    this.chest.rotation.x = chestRX + this.kick * 0.25 - spineRX;
    this.head.rotation.x = headRX;
    this.legL.rotation.x = lT; this.legR.rotation.x = rT;
    this.kneeL.rotation.x = lK; this.kneeR.rotation.x = rK;
    this.armL.rotation.set(aL[0], aL[1], aL[2]); this.elbowL.rotation.x = eL;
    this.armR.rotation.set(aR[0] + this.kick * 0.3, aR[1], aR[2]); this.elbowR.rotation.x = eR;
    if (this.chute && this.chute.visible) {
      this.chute.rotation.z = Math.sin(this.phase * 0.7) * 0.05;
    }
    if (this.soldier) G.Soldiers.drive(this.soldier, this);
  }
  dispose() {
    if (!this.soldier) for (const m of this.meshes) m.geometry.dispose();
    else {
      this.body.geometry.dispose();
      if (this.soldier.patch) {
        this.helmetMesh.geometry.dispose();
        for (const skeleton of new Set(this.soldier.meshes.map(m => m.skeleton))) skeleton.dispose();
      }
    }
    this.lodMesh.geometry.dispose();
    if (this.body.skeleton) this.body.skeleton.dispose();
    if (this.root.parent) this.root.parent.remove(this.root);
  }
}

function makeChute() {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(3.6, 16, 6, 0, Math.PI * 2, 0, 1.05).toNonIndexed();
  geo.scale(1, 0.42, 0.78);
  const n = geo.attributes.position.count, col = new Float32Array(n * 3);
  const c1 = new THREE.Color(0xe8732a), c2 = new THREE.Color(0xf2efe6);
  const p = geo.attributes.position;
  for (let i = 0; i < n; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const seg = Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI * 2) * 8);
    const c = seg % 2 ? c1 : c2;
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.translate(0, 6.2, 0);
  const canopy = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
  canopy.castShadow = true;
  g.add(canopy);
  const lp = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    lp.push(Math.cos(a) * 3.6 * Math.sin(1.05), 6.2 + 3.6 * 0.42 * Math.cos(1.05), Math.sin(a) * 3.6 * 0.78 * Math.sin(1.05), 0, 1.55, 0);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2a2a })));
  return g;
}

G.CharacterModel = CharacterModel;
G.OUTFITS = OUTFITS;
})();
