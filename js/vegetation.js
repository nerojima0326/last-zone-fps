// vegetation.js — 실사 나무·덤불 (EZ-Tree, MIT)
// 가까운 나무는 실제 가지·잎 메시, 먼 나무는 시작할 때 미리 찍어 둔 '임포스터'(교차 사진판)로 그린다.
// vendor/ez-tree.es.js 가 없으면 G.Veg.available() 이 false 가 되어 기존 저폴리 나무가 쓰인다.
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;

// 종류별 변형: preset 은 EZ-Tree 기본 프리셋, h 는 게임 안 높이(m), budget 은 삼각형 상한
const VARIANTS = {
  pine: [
    { preset: 'Pine Medium', seed: 1101, h: 13, budget: 6000 },
    { preset: 'Pine Large', seed: 2202, h: 17, budget: 7000 },
    { preset: 'Pine Small', seed: 3303, h: 9, budget: 4500 }
  ],
  oak: [
    { preset: 'Oak Medium', seed: 41, h: 10, budget: 6500 },
    { preset: 'Ash Medium', seed: 52, h: 11, budget: 6500 },
    { preset: 'Aspen Medium', seed: 63, h: 12, budget: 6000 }
  ],
  bush: [
    { preset: 'Bush 1', seed: 71, h: 1.5, budget: 1400 },
    { preset: 'Bush 2', seed: 82, h: 1.7, budget: 1400 },
    { preset: 'Bush 3', seed: 93, h: 1.3, budget: 1400 }
  ]
};
// 품질별 실제 메시로 그리는 반경 (그 밖은 임포스터)
// budget: 실제 메시로 그릴 최대 그루 수 (숲 한가운데서는 반경을 줄여 성능 유지)
// minT/minB: 숲 한가운데서 예산을 넘을 때 줄일 수 있는 최소 반경
const RANGE = { potato: { tree: 40, bush: 16, tb: 45, bb: 40, minT: 18, minB: 8 }, low: { tree: 58, bush: 24, tb: 90, bb: 90, minT: 26, minB: 10 }, medium: { tree: 95, bush: 45, tb: 280, bb: 320, minT: 45, minB: 25 }, high: { tree: 125, bush: 62, tb: 400, bb: 500, minT: 45, minB: 25 } };

const _v = new THREE.Vector3(), _box = new THREE.Box3();

function triCount(g) { return (g.index ? g.index.count : g.attributes.position.count) / 3; }

// 삼각형 수가 상한을 넘으면 가지 수·잎 수·단면 수를 줄여 다시 만든다
function generate(EZ, def) {
  const t = new EZ.Tree();
  t.loadPreset(def.preset);
  t.options.seed = def.seed;
  t.generate();
  for (let k = 0; k < 6; k++) {
    const n = triCount(t.branchesMesh.geometry) + triCount(t.leavesMesh.geometry);
    if (n <= def.budget) break;
    const o = t.options, f = Math.max(0.45, Math.sqrt(def.budget / n));
    o.leaves.count = Math.max(4, Math.round(o.leaves.count * f));
    o.leaves.size *= 1 + (1 - f) * 0.5;               // 잎 수를 줄인 만큼 잎을 키워 부피 유지
    for (const lv in o.branch.children) if (+lv > 0) o.branch.children[lv] = Math.max(2, Math.round(o.branch.children[lv] * f));
    if (o.type === 'evergreen') o.branch.children[0] = Math.max(16, Math.round(o.branch.children[0] * f));
    for (const lv in o.branch.sections) o.branch.sections[lv] = Math.max(3, Math.round(o.branch.sections[lv] * 0.85));
    for (const lv in o.branch.segments) o.branch.segments[lv] = Math.max(3, Math.round(o.branch.segments[lv] * 0.85));
    t.generate();
  }
  return t;
}

function waitTextures(texs, ms) {
  const t0 = performance.now();
  return new Promise(res => {
    const ok = () => texs.every(t => !t || (t.image && (t.image.naturalWidth || t.image.width)));
    const loop = () => { if (ok() || performance.now() - t0 > ms) res(); else setTimeout(loop, 30); };
    loop();
  });
}

const Veg = G.Veg = {
  variants: [], range: RANGE.high, last: new THREE.Vector3(1e9, 0, 0), lastT: -1e9, time: { value: 0 }, cam: { value: new THREE.Vector3() }, uR: { value: 130 }, uRB: { value: 65 },
  available() { return !!(window.EZTree && window.EZTree.Tree); },

  // 한 변형의 지오메트리·재질·임포스터를 만든다
  async makeVariant(kind, def, renderer) {
    const EZ = window.EZTree;
    const t = generate(EZ, def);
    const gB = t.branchesMesh.geometry, gL = t.leavesMesh.geometry;
    const pB = t.branchesMesh.material, pL = t.leavesMesh.material;
    await waitTextures([pB.map, pB.normalMap, pB.aoMap, pL.map], 4000);
    // 높이 맞추기
    _box.setFromBufferAttribute(gB.attributes.position);
    _box.union(new THREE.Box3().setFromBufferAttribute(gL.attributes.position));
    const s = def.h / Math.max(0.01, _box.max.y - _box.min.y);
    gB.scale(s, s, s); gL.scale(s, s, s);
    gB.computeBoundingSphere(); gL.computeBoundingSphere();
    _box.setFromBufferAttribute(gL.attributes.position);
    const crown = _box.getCenter(new THREE.Vector3()), crownR = Math.max(0.3, _box.getSize(_v).length() * 0.5);
    // 잎 노멀을 수관 중심에서 바깥쪽으로 → 잎 덩어리가 부드럽게 음영진다
    const p = gL.attributes.position, nrm = gL.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      _v.set(p.getX(i) - crown.x, (p.getY(i) - crown.y) * 0.8, p.getZ(i) - crown.z).normalize();
      _v.y += 0.35; _v.normalize();
      nrm.setXYZ(i, _v.x, _v.y, _v.z);
    }
    nrm.needsUpdate = true;
    const bark = new THREE.MeshStandardMaterial({ map: pB.map, normalMap: pB.normalMap, aoMap: pB.aoMap, roughnessMap: pB.roughnessMap, color: pB.color.clone(), roughness: 1, metalness: 0 });
    const leaf = new THREE.MeshStandardMaterial({ map: pL.map, color: pL.color.clone().multiplyScalar(0.95), alphaTest: Math.max(0.35, pL.alphaTest || 0.5), side: THREE.DoubleSide, roughness: 0.85, metalness: 0 });
    this.addWind(leaf, kind === 'bush' ? 0.03 : 0.07);
    // 임포스터 (먼 거리용 사진판)
    _box.setFromBufferAttribute(gB.attributes.position);
    _box.union(new THREE.Box3().setFromBufferAttribute(gL.attributes.position));
    const w = Math.max(_box.max.x - _box.min.x, _box.max.z - _box.min.z) * 1.02, h = _box.max.y * 1.02;
    const imp = this.makeImpostor(renderer, gB, gL, bark, leaf, w, h, kind === 'bush' ? 128 : 256);
    t.branchesMesh.geometry = new THREE.BufferGeometry(); t.leavesMesh.geometry = new THREE.BufferGeometry();
    return { kind, def, gB, gL, bark, leaf, imp, w, h, crownR, tris: triCount(gB) + triCount(gL), items: [], mats: null };
  },

  // 잎 흔들림 (인스턴스 위치마다 위상이 다르게)
  addWind(mat, amp) {
    const time = this.time;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float wph = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
        #else
        float wph = 0.0;
        #endif
        float wk = uv.y * ${amp.toFixed(3)} * (0.4 + position.y * 0.08);
        transformed.x += sin(uTime * 1.7 + wph + position.y * 0.6) * wk;
        transformed.z += cos(uTime * 1.3 + wph * 1.3 + position.x) * wk * 0.7;`);
    };
    mat.customProgramCacheKey = () => 'ezwind' + amp;
  },

  makeImpostor(renderer, gB, gL, bark, leaf, w, h, res) {
    const W = res, H = Math.max(32, Math.min(1024, Math.round(res * h / w / 32) * 32 || 32));
    const rt = new THREE.WebGLRenderTarget(W, H, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene();
    const mB = new THREE.MeshBasicMaterial({ map: bark.map, color: bark.color });
    const mL = new THREE.MeshBasicMaterial({ map: leaf.map, color: leaf.color, alphaTest: 0.5, side: THREE.DoubleSide });
    sc.add(new THREE.Mesh(gB, mB), new THREE.Mesh(gL, mL));
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h, 0, 0.1, 200);
    cam.position.set(0, 0, 100); cam.lookAt(0, 0, 0);
    const prevRT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(sc, cam);
    renderer.setRenderTarget(prevRT); renderer.setClearColor(prevC, prevA);
    mB.dispose(); mL.dispose();
    // 교차된 사진판 2장
    const q1 = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
    const q2 = q1.clone().rotateY(Math.PI / 2);
    const geo = THREE.mergeGeometries([q1, q2], false);
    const n = geo.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    const mat = new THREE.MeshStandardMaterial({ map: rt.texture, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, color: new THREE.Color(0.82, 0.82, 0.82) });
    mat.userData.rt = rt;
    return { geo, mat };
  },

  // 임포스터 셰이더: 실제 메시로 그려지는 반경 안의 인스턴스는 숨긴다
  hideNear(mat, uR) {
    const cam = this.cam;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCam = cam; sh.uniforms.uNearR = uR;
      sh.vertexShader = 'uniform vec3 uCam;\nuniform float uNearR;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 iw = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        if (distance(iw.xz, uCam.xz) < uNearR) transformed = vec3(0.0);
        #endif`);
    };
    mat.customProgramCacheKey = () => 'imp' + (uR === this.uR ? 't' : 'b');
  },

  // world.genVegetation 에서 호출: lists = { pine, oak, bush }, 각 항목 [x, y, z]
  async build(world, lists, r) {
    const renderer = world.renderer;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let total = 0;
    for (const kind of ['pine', 'oak', 'bush']) {
      const vs = [];
      for (const def of VARIANTS[kind]) vs.push(await this.makeVariant(kind, def, renderer));
      for (const it of lists[kind]) vs[Math.floor(r() * vs.length)].items.push(it);
      for (const v of vs) {
        const n = v.items.length;
        v.mats = new Float32Array(n * 16);
        v.items.forEach((it, i) => {
          const s = kind === 'bush' ? 0.7 + r() * 0.6 : 0.8 + r() * 0.45;
          q.setFromAxisAngle(up, r() * 6.28); sc.set(s, s * (0.92 + r() * 0.16), s); ps.set(it[0], it[1] - 0.15, it[2]);
          m4.compose(ps, q, sc); m4.toArray(v.mats, i * 16);
          if (kind !== 'bush') {
            const tr = (kind === 'pine' ? 0.32 : 0.36) * s;
            world.addCollider(it[0] - tr, it[1] - 0.5, it[2] - tr, it[0] + tr, it[1] + v.h * 0.55 * s, it[2] + tr, 'wood');
          }
        });
        if (!n) { this.variants.push(v); continue; }
        // 가까운 거리: 실제 메시 (인스턴스 목록은 카메라 이동에 따라 갱신)
        const nb = v.near = new THREE.InstancedMesh(v.gB, v.bark, n);
        const nl = v.nearLeaf = new THREE.InstancedMesh(v.gL, v.leaf, n);
        nl.instanceMatrix = nb.instanceMatrix;
        nb.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (const m of [nb, nl]) { m.count = 0; m.frustumCulled = false; m.castShadow = kind !== 'bush'; m.receiveShadow = true; world.scene.add(m); }
        // 먼 거리: 임포스터 (전체 인스턴스, 반경 안은 셰이더에서 숨김)
        this.hideNear(v.imp.mat, kind === 'bush' ? this.uRB : this.uR);
        const im = v.far = new THREE.InstancedMesh(v.imp.geo, v.imp.mat, n);
        im.instanceMatrix.array.set(v.mats); im.instanceMatrix.needsUpdate = true;
        im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true;
        world.scene.add(im);
        total += n;
        this.variants.push(v);
      }
    }
    console.info('[veg] EZ-Tree 변형 ' + this.variants.length + '개, 인스턴스 ' + total + '개, 삼각형/그루 ' + this.variants.map(v => v.def.preset + ':' + v.tris).join(', '));
  },

  setQuality(q) {
    this.range = RANGE[q] || RANGE.high;
    // 낮음·최저: 나무 그림자 생략 (그림자 패스에서 나무를 다시 그리는 비용이 크다)
    this.treeShadow = q === 'medium' || q === 'high';
    for (const v of this.variants) if (v.near) v.near.castShadow = v.nearLeaf.castShadow = v.kind !== 'bush' && this.treeShadow;
    this.uR.value = this.range.tree; this.uRB.value = this.range.bush;
    this.lastT = -1e9;
  },

  update(dt, camPos) {
    if (!this.variants.length) return;
    this.time.value += dt;
    this.cam.value.copy(camPos);
    this.lastT += dt;
    const dx = camPos.x - this.last.x, dz = camPos.z - this.last.z;
    if (dx * dx + dz * dz < 9 && this.lastT < 1) return;
    this.last.copy(camPos); this.lastT = 0;
    // 반경 안 그루 수가 예산을 넘으면 반경을 줄인다 (그 밖은 임포스터가 그린다)
    const count = (bush, R) => {
      const R2 = R * R; let c = 0;
      for (const v of this.variants) {
        if (!v.near || (v.kind === 'bush') !== bush) continue;
        const M = v.mats;
        for (let i = 0, n = v.items.length; i < n; i++) { const ex = M[i * 16 + 12] - camPos.x, ez = M[i * 16 + 14] - camPos.z; if (ex * ex + ez * ez < R2) c++; }
      }
      return c;
    };
    let rt = this.range.tree, rb = this.range.bush;
    const ct = count(false, rt + 8); if (ct > this.range.tb) rt = Math.max(this.range.minT || 45, rt * Math.sqrt(this.range.tb / ct));
    const cb = count(true, rb + 8); if (cb > this.range.bb) rb = Math.max(this.range.minB || 25, rb * Math.sqrt(this.range.bb / cb));
    this.uR.value = rt; this.uRB.value = rb;
    for (const v of this.variants) {
      if (!v.near) continue;
      const R = (v.kind === 'bush' ? rb : rt) + 8, R2 = R * R;
      const arr = v.near.instanceMatrix.array, M = v.mats;
      let c = 0;
      for (let i = 0, n = v.items.length; i < n; i++) {
        const ex = M[i * 16 + 12] - camPos.x, ez = M[i * 16 + 14] - camPos.z;
        if (ex * ex + ez * ez < R2) { arr.set(M.subarray(i * 16, i * 16 + 16), c * 16); c++; }
      }
      v.near.count = v.nearLeaf.count = c;
      v.near.instanceMatrix.needsUpdate = true;
    }
  }
};

})();
