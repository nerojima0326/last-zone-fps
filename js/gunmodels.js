// gunmodels.js — 실사 총기 모델 (무료 에셋)
//  소총: M4A1 (3DModelsCC0 / OpenGameArt, CC0)   권총: Service Pistol (Poly Haven, CC0)
//  산탄총: Semi-Auto Shotgun (crookedmouth / OpenGameArt, CC0)
// 모델을 '총 공간'(m 단위, 총구 -Z, 위 +Y)으로 정규화한 뒤 gunlib.js 의 절차적 총과 같은 형식
// (부품별 지오메트리 + 손·조준선·레일 기준점)으로 내보낸다 → weapons.js 가 1인칭/3인칭/전리품에 쓴다.
// 파일이 없으면 절차적 총이 그대로 쓰인다.
(function () {
'use strict';
const THREE = window.THREE, G = window.G;
const V3 = THREE.Vector3;
const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// 1인칭에서 방아쇠→총구 길이를 맞출 기준 (실사 모델 크기 보정)
const VMLEN = { rifle: 0.86, shotgun: 0.74, pistol: 0.145 };
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
    if (THREE.OBJLoader) tasks.push((async () => {
      const obj = await new THREE.OBJLoader().loadAsync('assets/models/shotgun/shotgun.obj');
      const mat = new THREE.MeshStandardMaterial({ name: 'shotgun', color: 0x2c2d30, metalness: 0.62, roughness: 0.42, envMapIntensity: 0.8 });
      // 방아쇠: 뒤끝에서 0.126m, 윗면에서 0.095m / 앞손잡이(포엔드) 중심: 방아쇠에서 0.455m 앞 (측면 실측)
      this.setup('shotgun', obj, mat, () => 'body', null, null, 0.001, { fromRear: 0.126, fromTop: 0.095, fore: 0.455, foreY: 0.038 });
    })().catch(e => console.info('[guns] 산탄총 모델 없음', e.message)));
    await Promise.all(tasks);
    for (const k in this.guns) { const m = this.guns[k].mat; for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) renderer.initTexture(t); }
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
    } else if (type === 'shotgun') {
      const fore = new V3(0, trig.y + hint.foreY, trig.z - hint.fore);
      // 포엔드(앞손잡이) 부분을 따로 떼어 펌프로 움직인다
      this.splitPump(D, fore, muzzle.y);
      D.pivots.pump = fore.clone();
      D.fore = fore.clone().add(new V3(-0.005, -0.012, 0));
      D.port = new V3(0, portY < 1e8 ? portY : trig.y + 0.01, trig.z - 0.1);
      D.sight = { y: rear + 0.006, z: trig.z - 0.12 };
      D.rail = { y: rear - 0.003, z: trig.z - 0.06, on: 'body' };
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

  // 산탄총 포엔드 삼각형을 'pump' 부품으로 분리
  splitPump(D, fore, barrelY) {
    const g = D.parts.body, p = g.attributes.position, n = p.count / 3;
    const keepA = [], pumpA = [];
    const attrs = Object.keys(g.attributes);
    for (let t = 0; t < n; t++) {
      let cz = 0, cy = 0, cx = 0;
      for (let k = 0; k < 3; k++) { cz += p.getZ(t * 3 + k); cy += p.getY(t * 3 + k); cx += p.getX(t * 3 + k); }
      cz /= 3; cy /= 3; cx /= 3;
      const inPump = cz > fore.z - 0.11 && cz < fore.z + 0.1 && cy < barrelY - 0.012 && cy > fore.y - 0.05;
      (inPump ? pumpA : keepA).push(t);
    }
    if (pumpA.length < 20 || pumpA.length > n * 0.5) return;
    const build = (tris) => {
      const ng = new THREE.BufferGeometry();
      for (const a of attrs) {
        const src = g.attributes[a], sz = src.itemSize, arr = new Float32Array(tris.length * 3 * sz);
        tris.forEach((t, i) => { for (let k = 0; k < 3 * sz; k++) arr[i * 3 * sz + k] = src.array[t * 3 * sz + k]; });
        ng.setAttribute(a, new THREE.BufferAttribute(arr, sz));
      }
      ng.computeBoundingBox();
      return ng;
    };
    D.parts.body = build(keepA); D.parts.pump = build(pumpA);
    g.dispose();
  },

  // gunlib 와 같은 형식의 데이터 (부품 → { real: geo })
  data(type) {
    const D = this.guns[type];
    if (!D) return null;
    if (D._data) return D._data;
    const parts = {};
    for (const k in D.parts) parts[k] = { real: D.parts[k] };
    return (D._data = {
      id: type, real: true, parts, mats: { real: D.mat }, pivots: D.pivots, trigger: D.trigger, muzzle: D.muzzle,
      sight: D.sight, rail: D.rail, fore: D.fore, port: D.port || null, charge: D.charge || null, slideTop: D.slideTop || null,
      magDir: D.magDir, vmScale: D.vmScale, extra: {}
    });
  },

  // 3인칭·전리품용: 실제 크기, 하나로 병합된 Mesh
  tpMesh(type) {
    const D = this.guns[type];
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
};

})();
