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

const _fwd = new THREE.Vector3();
const Veg = G.Veg = {
  variants: [], lastFx: 0, lastFz: 0, lastCos: -2, range: RANGE.high, last: new THREE.Vector3(1e9, 0, 0), lastT: -1e9, time: { value: 0 }, cam: { value: new THREE.Vector3() }, uR: { value: 130 }, uRB: { value: 65 },
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

  // v67 잎 투명도 밉 보정: 멀어질수록(밉 단계가 오를수록) 알파를 키워 alphaTest 에 잎이 숭숭 뚫리지 않게.
  //  낮은 렌더 해상도에서 나뭇잎이 점점이 깜빡이며 보이던 주된 원인 (Ben Golus 'alpha to coverage' 글의 밉 보정)
  leafAA: { value: 0 },
  alphaMip(sh) {
    sh.uniforms.lzLeafAA = this.leafAA;
    sh.fragmentShader = 'uniform float lzLeafAA;\n' + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', `#ifdef USE_MAP
      { vec2 tsz = vec2(textureSize(map, 0)); vec2 ddx = dFdx(vMapUv * tsz), ddy = dFdy(vMapUv * tsz);
        float mipL = 0.5 * log2(max(dot(ddx, ddx), dot(ddy, ddy)));
        diffuseColor.a *= 1.0 + max(0.0, mipL) * 0.25; }
      #endif
      #ifdef USE_ALPHATEST
        if(lzLeafAA>0.5){
          float width=max(fwidth(diffuseColor.a),0.015);
          diffuseColor.a=smoothstep(alphaTest-width,alphaTest+width,diffuseColor.a);
          if(diffuseColor.a<0.001)discard;
        }else{if(diffuseColor.a<alphaTest)discard;}
      #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor.a = diffuseColor.a;');
  },
  // 잎 흔들림 (인스턴스 위치마다 위상이 다르게)
  addWind(mat, amp) {
    const time = this.time;
    mat.onBeforeCompile = (sh) => {
      this.alphaMip(sh);
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
    mat.customProgramCacheKey = () => 'ezwind2' + amp;
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
      this.alphaMip(sh);
      sh.uniforms.uCam = cam; sh.uniforms.uNearR = uR;
      sh.vertexShader = 'uniform vec3 uCam;\nuniform float uNearR;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 iw = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        if (distance(iw.xz, uCam.xz) < uNearR - 6.0) transformed = vec3(0.0);
        #endif`);
    };
    mat.customProgramCacheKey = () => 'imp3' + (uR === this.uR ? 't' : 'b');
    G.LODFade?.foliage(mat, uR, false);
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
        const radius = kind === 'bush' ? this.uRB : this.uR;
        G.LODFade?.foliage(v.bark, radius, true); G.LODFade?.foliage(v.leaf, radius, true);
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

  // v68 나무 재질을 싼 램버트로 (높음 제외): 측정상 나무가 많은 화면에서 장면 시간이 35~45% 줄었다.
  //  표준(PBR) 재질의 밝기 대부분을 차지하는 환경맵 간접광은 시간대가 바뀔 때 한 번 재서(calibrate) 상수로 더해 준다
  ambEnv: { value: new THREE.Color(0, 0, 0) }, lamOK: false, q: 'high',
  lambertOf(std) {
    const m = new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap || null, aoMap: std.aoMap || null, color: std.color, alphaTest: std.alphaTest, side: std.side });
    if (std.normalMap && std.normalScale) m.normalScale.copy(std.normalScale);
    const amb = this.ambEnv, key = std.customProgramCacheKey.bind(std);
    m.onBeforeCompile = (sh, r) => {
      std.onBeforeCompile(sh, r);
      sh.uniforms.uAmbEnv = amb;
      sh.fragmentShader = 'uniform vec3 uAmbEnv;\n' + sh.fragmentShader.replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n  irradiance += uAmbEnv;');
    };
    m.customProgramCacheKey = () => key() + '|lamb';
    return m;
  },
  // 흰 면(위·옆)을 환경맵만으로 비춰 간접광 세기를 잰다 → 램버트 재질에 더할 값
  calibrate(renderer, env) {
    let rt = null, mat = null, geo = [];
    const prev = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
    try {
      rt = new THREE.WebGLRenderTarget(2, 1, { type: THREE.FloatType, depthBuffer: false });
      const sc = new THREE.Scene(); sc.environment = env;
      mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
      const cam = new THREE.OrthographicCamera(-1, 1, 0.5, -0.5, 0.1, 10); cam.position.set(0, 0, 5);
      [[0, 1, 0], [0.7071, 0, 0.7071]].forEach((n, i) => {
        const g = new THREE.PlaneGeometry(1, 1); geo.push(g);
        const na = g.attributes.normal; for (let k = 0; k < na.count; k++) na.setXYZ(k, n[0], n[1], n[2]);
        const me = new THREE.Mesh(g, mat); me.position.x = i ? 0.5 : -0.5; sc.add(me);
      });
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
      renderer.render(sc, cam);
      const px = new Float32Array(8);
      renderer.readRenderTargetPixels(rt, 0, 0, 2, 1, px);
      const c = [0, 1, 2].map(k => (px[k] + px[4 + k]) * 0.5 * Math.PI);
      if (c.some(v => !isFinite(v) || v < 0) || c[0] + c[1] + c[2] <= 1e-5) throw new Error('bad probe ' + px.join(','));
      this.ambEnv.value.setRGB(c[0], c[1], c[2]);
      this.lamOK = true;
    } catch (e) { console.info('[veg] 간접광 측정 실패 — 표준 재질 유지', e.message); this.lamOK = false; }
    finally {
      renderer.setRenderTarget(prev); renderer.setClearColor(prevC, prevA);
      if (rt) rt.dispose(); if (mat) mat.dispose(); for (const g of geo) g.dispose();
    }
    if (this.variants.length) this.applyMats();
  },
  applyMats() {
    const lam = this.lamOK && this.q !== 'high' && !G.noLam;   // G.noLam: 비교 측정용
    for (const v of this.variants) {
      if (!v.near) continue;
      if (lam && !v.lam) v.lam = { b: this.lambertOf(v.bark), l: this.lambertOf(v.leaf), f: this.lambertOf(v.imp.mat) };
      v.near.material = lam ? v.lam.b : v.bark; v.nearLeaf.material = lam ? v.lam.l : v.leaf; v.far.material = lam ? v.lam.f : v.imp.mat;
    }
  },

  setQuality(q) {
    this.q = q;
    this.leafAA.value = (G.msaaSamples || 0) > 0 && !G.RT?.active() ? 1 : 0;
    this.applyMats();
    for (const v of this.variants) for (const mat of [v.leaf, v.imp.mat, v.lam?.l, v.lam?.f]) if (mat && mat.alphaToCoverage !== (this.leafAA.value > 0)) {
      mat.alphaToCoverage = this.leafAA.value > 0; mat.needsUpdate = true;
    }
    this.range = RANGE[q] || RANGE.high;
    // 낮음·최저: 나무 그림자 생략 (그림자 패스에서 나무를 다시 그리는 비용이 크다)
    this.treeShadow = q === 'medium' || q === 'high';
    for (const v of this.variants) if (v.near) v.near.castShadow = v.nearLeaf.castShadow = v.kind !== 'bush' && this.treeShadow;
    if (!Number.isFinite(this.targetR)) { this.uR.value = this.range.tree; this.uRB.value = this.range.bush; }
    this.targetR = this.range.tree; this.targetRB = this.range.bush;
    this.lastT = -1e9;
  },

  update(dt, camPos, cam) {
    if (!this.variants.length) return;
    this.time.value += dt;
    if (Number.isFinite(this.targetR)) {
      this.uR.value = U.damp(this.uR.value, this.targetR, 3, dt);
      this.uRB.value = U.damp(this.uRB.value, this.targetRB, 3, dt);
    }
    this.cam.value.copy(camPos);
    this.lastT += dt;
    // v68 시야 밖(뒤쪽) 나무는 상세 모델에서 뺀다 — 둘레를 다 그리던 것을 앞쪽 부채꼴 + 발밑 + 그림자가 시야로 드리우는 것만
    let fx = 0, fz = 0, cosL = -2;
    if (cam && !G.noCull) {   // G.noCull: 비교 측정용 (예전처럼 둘레 전부)
      cam.getWorldDirection(_fwd);
      const hl = Math.hypot(_fwd.x, _fwd.z);
      if (hl > 0.35) {   // 거의 바로 아래·위를 볼 때는 자르지 않는다
        fx = _fwd.x / hl; fz = _fwd.z / hl;
        const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect);
        cosL = Math.cos(Math.min(Math.PI, half + 0.45));
      }
    }
    const turned = cosL > -2 ? (this.lastCos < -1.5 || fx * this.lastFx + fz * this.lastFz < 0.985 || cosL < this.lastCos - 0.01) : this.lastCos > -1.5;   // 돌거나 시야가 넓어지면 (조준 해제) 다시
    const dx = camPos.x - this.last.x, dz = camPos.z - this.last.z;
    if (dx * dx + dz * dz < 9 && this.lastT < 1 && !turned) return;
    this.last.copy(camPos); this.lastT = 0; this.lastFx = fx; this.lastFz = fz; this.lastCos = cosL;
    // 해 반대쪽으로 떨어지는 그림자 (나무 높이 ~14 m 기준, 30 m 까지)
    const W = G.World, sd = W && W.sunDir, sh = this.treeShadow && sd && sd.y > 0.05 ? Math.min(30, 14 * Math.hypot(sd.x, sd.z) / sd.y) : 0;
    const sx = sd ? -sd.x / Math.max(1e-3, Math.hypot(sd.x, sd.z)) * sh : 0, sz = sd ? -sd.z / Math.max(1e-3, Math.hypot(sd.x, sd.z)) * sh : 0;
    const inView = (ex, ez, pad) => {
      if (cosL < -1.5) return true;
      const d2 = ex * ex + ez * ez;
      if (d2 < 196) return true;   // 14 m 안은 늘 (돌아서는 순간·발밑)
      const d = Math.sqrt(d2);
      if (fx * ex + fz * ez > cosL * d - pad) return true;   // 7 m 여유 (나무 폭)
      if (!sh) return false;
      const gx = ex + sx, gz = ez + sz, g = Math.hypot(gx, gz);
      return fx * gx + fz * gz > cosL * g - pad;
    };
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
    this.targetR = rt; this.targetRB = rb;
    for (const v of this.variants) {
      if (!v.near) continue;
      const R = (v.kind === 'bush' ? Math.max(rb, this.uRB.value) : Math.max(rt, this.uR.value)) + 8, R2 = R * R;
      const arr = v.near.instanceMatrix.array, M = v.mats;
      let c = 0;
      for (let i = 0, n = v.items.length; i < n; i++) {
        const ex = M[i * 16 + 12] - camPos.x, ez = M[i * 16 + 14] - camPos.z;
        if (ex * ex + ez * ez < R2 && inView(ex, ez, Math.max(7, v.w * .5 + 2))) { arr.set(M.subarray(i * 16, i * 16 + 16), c * 16); c++; }
      }
      v.near.count = v.nearLeaf.count = c;
      const im = v.near.instanceMatrix;
      if (im.addUpdateRange) { im.clearUpdateRanges(); im.addUpdateRange(0, Math.max(16, c * 16)); }   // 쓴 만큼만 GPU 로
      im.needsUpdate = true;
    }
  }
};

})();
