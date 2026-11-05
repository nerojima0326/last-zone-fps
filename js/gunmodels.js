// gunmodels.js — 총기 3D 모델
//  · AR-7: M4A1 (3DModelsCC0, CC0, FBX)   · P-92: Service Pistol (Poly Haven, CC0, glTF)
//  · 나머지 13종: assets/models/guns/<id>.glb — tools/guns 로 만든 게임용 GLB
//      실사 CC0 (3DModelsCC0 팩): KA-47(AK-47) · KR-98(Sniper) · S-12(펌프 산탄총)
//      직접 설계: SC-17 · MK-14 · M-1014 · DB-2 · SA-12 · AA-12 · G-18 · M-1911 · DE-7 · R-45
//    GLB 는 이미 '총 공간'(원점 = 방아쇠, 총구 -Z, 위 +Y, m)이고 메시 userData.part = 부품,
//    재질 이름 = 재질 키, 루트 userData.lz = 손·조준선·레일 기준점을 담고 있다.
// 모두 gunlib.js 의 절차적 총과 같은 형식(부품별 지오메트리 + 기준점)으로 내보낸다 → weapons.js 가 1인칭/3인칭/전리품에 쓴다.
// 파일이 없으면(file:// 등) 절차적 총이 그대로 쓰인다.
(function () {
'use strict';
const THREE = window.THREE, G = window.G;
const V3 = THREE.Vector3;
const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// 1인칭에서 방아쇠→총구 길이를 맞출 기준 (실사 모델 크기 보정)
const VMLEN = { rifle: 0.86, pistol: 0.145 };
// 게임용 GLB (tools/guns/run.cjs build 로 생성)
const GLB_IDS = ['ka47', 'sc17', 'mk14', 'kr98', 's12', 'm1014', 'db2', 'sa12', 'aa12', 'g18', 'm1911', 'de7', 'r45'];
// 3인칭(손에 든 총·전리품) 방아쇠 위치
const TPREF = { rifle: new V3(0, -0.035, 0.02), shotgun: new V3(0, -0.03, 0.0), pistol: new V3(0, -0.01, -0.01) };

function bboxOf(objs) { const b = new THREE.Box3(); for (const o of objs) b.expandByObject(o); return b; }
function centerOf(o) { return new THREE.Box3().setFromObject(o).getCenter(new V3()); }

const GM = G.GunModels = {
  guns: {},   // type → { parts: {body, mag, slide, charge, pump, rear}, mat, trigger, muzzle, ... }
  TPREF,
  has(type) { return !!this.guns[type]; },

  async load(renderer) {
    if (location.protocol === 'file:') return;
    const mgr = new THREE.LoadingManager();
    mgr.setURLModifier(u => /\.(tga|png|psd|dds)$/i.test(u) ? BLANK : u);
    const tl = new THREE.TextureLoader();
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const tex = (u, srgb) => new Promise(res => tl.load(u, t => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso; res(t); }, undefined, () => res(null)));
    const tasks = [];
    if (THREE.FBXLoader) tasks.push((async () => {
      const [fbx, map, nor, arm] = await Promise.all([new THREE.FBXLoader(mgr).loadAsync('assets/models/rifle/M4A1.fbx'), tex('assets/models/rifle/m4a1_diff.jpg', true), tex('assets/models/rifle/m4a1_nor.jpg'), tex('assets/models/rifle/m4a1_arm.jpg')]);
      if (!map) return;
      const mat = new THREE.MeshStandardMaterial({ name: 'm4a1', map, normalMap: nor, roughnessMap: arm, metalnessMap: arm, roughness: 1, metalness: 1, envMapIntensity: 0.8 });
      this.setup('rifle', fbx, mat, n => /magazine/i.test(n) ? 'mag' : /charging/i.test(n) ? 'charge' : 'body', 'Trigger', 'Barrel');
    })().catch(e => console.info('[guns] 소총 모델 없음', e.message)));
    if (THREE.GLTFLoader) tasks.push((async () => {
      const g = await new THREE.GLTFLoader().loadAsync('assets/models/pistol/service_pistol_1k.gltf');
      let mat = null;
      g.scene.traverse(o => { if (o.isMesh && !mat) mat = o.material; });
      mat.envMapIntensity = 0.8;
      // 나무 손잡이 버전(_a) + 장전된 탄창 (탄창은 총 옆에 따로 놓여 있어 손잡이 안으로 옮긴다)
      const keep = [];
      g.scene.traverse(o => { if (o.isMesh && (/_a$/.test(o.name) || /magazine_loaded/.test(o.name))) keep.push(o); });
      const grp = new THREE.Group();
      g.scene.updateMatrixWorld(true);
      const intoGrip = new THREE.Matrix4().makeTranslation(0.085, -0.002, 0);
      for (const o of keep) {
        const c = o.clone(); c.matrix.copy(o.matrixWorld);
        if (/magazine/.test(o.name)) c.matrix.premultiply(intoGrip);
        c.matrix.decompose(c.position, c.quaternion, c.scale); grp.add(c);
      }
      this.setup('pistol', grp, mat, n => /slide/.test(n) ? 'slide' : /magazine/.test(n) ? 'mag' : 'body', 'trigger', 'slide', 1);
    })().catch(e => console.info('[guns] 권총 모델 없음', e.message)));
    // 게임용 GLB 13종
    if (THREE.GLTFLoader) {
      const gl = new THREE.GLTFLoader();
      if (THREE.MeshoptDecoder) gl.setMeshoptDecoder(THREE.MeshoptDecoder);
      const v = (window.LZ_BUILD || '');
      for (const id of GLB_IDS) tasks.push(gl.loadAsync('assets/models/guns/' + id + '.glb' + (v ? '?v=' + v : '')).then(g => this.fromGLB(id, g)).catch(e => console.info('[guns] ' + id + ' 모델 없음', e.message)));
    }
    await Promise.all(tasks);
    for (const k in this.guns) {
      const D = this.guns[k], list = D.mats ? Object.values(D.mats) : [D.mat];
      for (const m of list) for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) renderer.initTexture(t);
    }
    console.info('[guns] 실사 총기: ' + (Object.keys(this.guns).join(', ') || '없음'));
  },

  // 모델 정규화: 크기(m), 총구 방향(-Z), 원점(방아쇠)
  setup(type, root, mat, partOf, triggerName, barrelName, unit, hint) {
    root.updateMatrixWorld(true);
    const meshes = [];
    root.traverse(o => { if (o.isMesh) meshes.push(o); });
    const box = bboxOf(meshes), size = box.getSize(new V3()), ctr = box.getCenter(new V3());
    if (!unit) unit = size.length() > 20 ? 0.01 : 1; // FBX 는 cm
    // 긴 축 (x 또는 z)
    const alongX = size.x > size.z;
    const find = (re) => re ? meshes.find(m => new RegExp(re, 'i').test(m.name)) : null;
    const ax = (v) => alongX ? v.x : v.z;
    // 총구 쪽 판단
    //  1) 방아쇠와 공이(해머)가 있으면: 방아쇠가 공이보다 항상 총구 쪽
    //  2) 총열(또는 슬라이드) 중심이 탄창/손잡이보다 어느 쪽인지
    //  3) 없으면 양 끝 단면이 가는 쪽
    let sign;
    const trg = find(triggerName), ham = find('hammer');
    const bar = find(barrelName), mag = meshes.find(m => /magazine/i.test(m.name)) || meshes.find(m => /pistol_a$|frame|grip/i.test(m.name));
    if (trg && ham) sign = Math.sign(ax(centerOf(trg)) - ax(centerOf(ham))) || 1;
    else if (bar && mag) { const bc = centerOf(bar), mc = centerOf(mag); const ref = barrelName === 'slide' ? ax(bc) - ax(mc) : ax(bc) - ax(ctr); sign = Math.sign(ref) || 1; }
    else {
      const ends = [[], []], lo = alongX ? box.min.x : box.min.z, L = alongX ? size.x : size.z, p = new V3();
      for (const m of meshes) {
        const a = m.geometry.attributes.position;
        for (let i = 0; i < a.count; i += 3) {
          p.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld);
          const t = (ax(p) - lo) / L;
          if (t < 0.15) ends[0].push(p.y); else if (t > 0.85) ends[1].push(p.y);
        }
      }
      const spread = arr => arr.length ? Math.max(...arr) - Math.min(...arr) : 1e9;
      sign = spread(ends[1]) < spread(ends[0]) ? 1 : -1;
    }
    // 회전: 총구 → -Z  (alongX 이고 총구가 +X 면 -90°: +X → -Z)
    const rotY = alongX ? (sign > 0 ? Math.PI / 2 : -Math.PI / 2) : (sign > 0 ? Math.PI : 0);
    const M = new THREE.Matrix4().makeRotationY(rotY).multiply(new THREE.Matrix4().makeScale(unit, unit, unit));
    const parts = {};
    // 소총 뒤가늠자(접이식): 조준경을 달면 시야를 가리므로 따로 분리 (1인칭에서 숨김)
    let rearSight = null;
    const sights = meshes.filter(m => /^sight/i.test(m.name));
    if (sights.length > 1) {
      const z = m => { const c = centerOf(m); return new V3(c.x, c.y, c.z).applyMatrix4(new THREE.Matrix4().makeRotationY(rotY)).z; };
      rearSight = sights.reduce((a, b) => z(a) > z(b) ? a : b);
    }
    for (const m of meshes) {
      const key = m === rearSight ? 'rearsight' : partOf(m.name);
      const g = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(M, m.matrixWorld));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      (parts[key] || (parts[key] = [])).push(g.index ? g.toNonIndexed() : g);
    }
    const merged = {};
    for (const k in parts) { merged[k] = parts[k].length === 1 ? parts[k][0] : THREE.mergeGeometries(parts[k], false); merged[k].clearGroups(); merged[k].computeBoundingBox(); }
    // 기준점
    const all = THREE.mergeGeometries(Object.values(merged), false); all.computeBoundingBox();
    const B = all.boundingBox;
    let trig;
    const tm = find(triggerName);
    if (tm) { const g = tm.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(M, tm.matrixWorld)); g.computeBoundingBox(); trig = g.boundingBox.getCenter(new V3()); }
    else if (hint) trig = new V3((B.min.x + B.max.x) / 2, B.max.y - hint.fromTop, B.max.z - hint.fromRear);
    else trig = new V3((B.min.x + B.max.x) / 2, B.min.y + (B.max.y - B.min.y) * 0.45, B.max.z - (B.max.z - B.min.z) * 0.3);
    // 총구: 앞쪽 끝, 높이는 앞쪽 5% 구간의 중심
    const pa = all.attributes.position, zf = B.min.z + (B.max.z - B.min.z) * 0.05;
    let ys = 0, yn = 0;
    for (let i = 0; i < pa.count; i++) if (pa.getZ(i) < zf) { ys += pa.getY(i); yn++; }
    const muzzle = new V3(0, yn ? ys / yn : (B.min.y + B.max.y) / 2, B.min.z);
    // 위쪽 레일(소총) / 뒤쪽 윗면(조준선) 높이 / 아래쪽 장전구(산탄총)
    let rail = -1e9, rear = -1e9, portY = 1e9;
    for (let i = 0; i < pa.count; i++) {
      const z = pa.getZ(i), y = pa.getY(i), x = pa.getX(i);
      if (z < trig.z && z > trig.z - (trig.z - B.min.z) * 0.35) rail = Math.max(rail, y);
      if (z > trig.z - 0.02 && z < trig.z + 0.08) rear = Math.max(rear, y);
      if (Math.abs(x) < 0.02 && z < trig.z - 0.05 && z > trig.z - 0.16 && y > trig.y - 0.03) portY = Math.min(portY, y);
    }
    all.dispose();
    const D = this.guns[type] = { parts: merged, mat, trigger: trig, muzzle, railTop: rail, rearTop: rear, len: B.max.z - B.min.z, real: true, type };
    D.vmScale = VMLEN[type] / (trig.z - muzzle.z);
    // 형식 통일: 기준점 (총 공간, m)
    const bb = k => merged[k] && merged[k].boundingBox;
    D.pivots = {};
    if (type === 'rifle') {
      const mb = bb('mag');
      if (mb) D.pivots.mag = new V3(0, mb.max.y, (mb.min.z + mb.max.z) / 2);
      const cb = bb('charge');
      if (cb) { D.pivots.charge = cb.getCenter(new V3()); D.charge = new V3(0, cb.max.y + 0.005, cb.max.z); }
      D.sight = null;                                            // 기본 조준경(레드닷) 일체형
      D.rail = { y: rail, z: trig.z - 0.052, on: 'body' };
      D.fore = trig.clone().add(new V3(-0.008, 0.019, -0.286));
    } else if (type === 'pistol') {
      const mb = bb('mag'), sb = bb('slide');
      if (mb) D.pivots.mag = new V3(0, mb.min.y, mb.max.z - (mb.max.z - mb.min.z) * 0.5);
      D.pivots.slide = new V3(0, 0, 0);
      D.magDir = new V3(0, -0.98, 0.19).normalize();
      D.sight = { y: rear + 0.004, z: trig.z + 0.035 };
      D.rail = { y: sb ? sb.max.y - 0.001 : rear, z: trig.z + 0.0, on: 'slide' };
      D.slideTop = new V3(0, sb ? sb.max.y - 0.004 : rear, (sb ? sb.max.z : trig.z + 0.05) - 0.02);
      D.fore = trig.clone().add(new V3(-0.023, -0.052, 0.048));
    }
    if (!D.magDir) D.magDir = new V3(0, -1, 0);
  },

  // 게임용 GLB → 부품·재질별 지오메트리 (양자화된 속성을 float 로 풀고, 노드 변환을 적용)
  fromGLB(id, gltf) {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    let meta = null;
    root.traverse(o => { if (o.userData && o.userData.lz) meta = o.userData.lz; });
    if (!meta) throw new Error('메타데이터 없음');
    const parts = {}, mats = {};
    root.traverse(o => {
      if (!o.isMesh) return;
      const part = o.userData.part || 'body', mk = o.material.name || 'm';
      const g = unpack(o.geometry).applyMatrix4(o.matrixWorld);
      const P = parts[part] || (parts[part] = {});
      P[mk] = P[mk] ? THREE.mergeGeometries([P[mk], g], false) : g;
      if (!mats[mk]) { const m = o.material; m.envMapIntensity = 0.8; m.side = THREE.FrontSide; mats[mk] = m; }
    });
    for (const k in parts) for (const mk in parts[k]) parts[k][mk].computeBoundingBox();
    const v = a => a ? new V3(a[0], a[1], a[2]) : null;
    const piv = {};
    for (const k in meta.pivots || {}) piv[k] = v(meta.pivots[k]);
    const extra = {};
    for (const k in meta.extra || {}) extra[k] = meta.extra[k];
    this.guns[id] = {
      glb: true, type: id, cls: meta.cls, mats,
      data: {
        id, real: true, parts, mats, pivots: piv, trigger: new V3(0, 0, 0), muzzle: v(meta.muzzle),
        sight: meta.sight ? { y: meta.sight[0], z: meta.sight[1] } : null,
        rail: meta.rail ? { y: meta.rail[0], z: meta.rail[1], on: meta.rail[2] || 'body' } : null,
        fore: v(meta.fore), port: v(meta.port), charge: v(meta.charge), slideTop: v(meta.slideTop),
        magDir: v(meta.magDir || [0, -1, 0]).normalize(), ironDist: meta.ironDist || 0, extra
      }
    };
  },

  // gunlib 와 같은 형식의 데이터 (부품 → { 재질키: geo })
  data(type) {
    const D = this.guns[type];
    if (!D) return null;
    if (D.glb) return D.data;
    if (D._data) return D._data;
    const parts = {};
    for (const k in D.parts) parts[k] = { real: D.parts[k] };
    return (D._data = {
      id: type, real: true, parts, mats: { real: D.mat }, pivots: D.pivots, trigger: D.trigger, muzzle: D.muzzle,
      sight: D.sight, rail: D.rail, fore: D.fore, port: D.port || null, charge: D.charge || null, slideTop: D.slideTop || null,
      magDir: D.magDir, vmScale: D.vmScale, extra: {}
    });
  },

  // 3인칭·전리품용: 실제 크기, 방아쇠를 TPREF 로
  //  full = 전리품(가까이서 보는 것): 재질 그대로 / 아니면 재질이 여럿인 모델은 정점 색 하나로 구워 그리기 호출 1번
  tpMesh(type, full) {
    const D = this.guns[type];
    if (!D.glb) {
      if (!D._tp) {
        const list = Object.values(D.parts);
        D._tp = THREE.mergeGeometries(list, false);
        D._tp.translate(TPREF[type].x - D.trigger.x, TPREF[type].y - D.trigger.y, TPREF[type].z - D.trigger.z);
        D._tp.computeBoundingSphere();
      }
      const m = new THREE.Mesh(D._tp, D.mat);
      m.castShadow = true;
      return m;
    }
    const ref = TPREF[D.cls], keys = Object.keys(D.mats);
    const bake = !full && keys.length > 2;
    const key = bake ? '_tpBake' : '_tpFull';
    if (!D[key]) {
      const byMat = {};
      for (const p in D.data.parts) for (const mk in D.data.parts[p]) (byMat[mk] || (byMat[mk] = [])).push(D.data.parts[p][mk]);
      const order = Object.keys(byMat), geos = [];
      for (const mk of order) {
        let g = byMat[mk].length === 1 ? byMat[mk][0].clone() : THREE.mergeGeometries(byMat[mk], false);
        if (g.index) g = g.toNonIndexed();
        if (bake) {
          const c = bakeColor(D.mats[mk]), n = g.attributes.position.count, col = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
          g.deleteAttribute('uv');
          g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        }
        geos.push(g);
      }
      const geo = THREE.mergeGeometries(geos, !bake);
      geo.translate(ref.x, ref.y, ref.z);
      geo.computeBoundingSphere();
      D[key] = { geo, mats: bake ? G.GunLib.tpMat() : (order.length === 1 ? D.mats[order[0]] : order.map(k => D.mats[k])) };
    }
    const m = new THREE.Mesh(D[key].geo, D[key].mats);
    m.castShadow = true;
    return m;
  }
};

// 양자화(정수) 속성 → float, uv 없으면 0 으로 채움 (병합할 때 속성이 같아야 한다)
function unpack(src) {
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const a = src.attributes[k];
    const n = src.attributes.position.count, s = k === 'uv' ? 2 : 3, arr = new Float32Array(n * s);
    if (a) for (let i = 0; i < n; i++) { arr[i * s] = a.getX(i); arr[i * s + 1] = a.getY(i); if (s === 3) arr[i * s + 2] = a.getZ(i); }
    g.setAttribute(k, new THREE.BufferAttribute(arr, s));
  }
  if (src.index) g.setIndex(new THREE.BufferAttribute(new Uint32Array(src.index.array), 1));
  if (!src.attributes.normal) g.computeVertexNormals();
  return g;
}
// 3인칭용 정점 색: 재질 색 (나뭇결 등 텍스처 재질은 대표 색)
const _bc = new THREE.Color();
function bakeColor(m) {
  if (/wood/i.test(m.name)) return _bc.setHex(0x5e3a1e);
  if (m.name === 'cased') return _bc.setHex(0x6f6a72);
  return _bc.copy(m.color);
}

})();
