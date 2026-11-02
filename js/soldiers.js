// soldiers.js — 실사 군인 캐릭터 (Microsoft Rocketbox, MIT)
// FBX 스킨 메시를 불러와 텍스처 4장을 아틀라스 1장으로 합치고(드로우콜 절약),
// 기존 절차적 캐릭터의 관절 각도(조준·달리기·앉기·기절·낙하산 등)를 Biped 뼈대에 그대로 옮겨 움직인다.
// assets/char/ 가 없으면 G.Soldiers.ready 가 false 가 되어 기존 절차적 캐릭터가 쓰인다.
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;

const AVATARS = ['Military_Male_01', 'Military_Male_03', 'Military_Female_01'];
// 아틀라스 칸 (UV 공간: u0, v0, 너비, 높이) — tools/convert-models.py 와 같은 배치
const CELLS = { body: [0, 0.5, 0.5, 0.5], head: [0.5, 0.5, 0.5, 0.5], equipment: [0, 0.25, 0.5, 0.25], helmet: [0.5, 0, 0.5, 0.5] };
const PARTS = ['equipment', 'helmet', 'head', 'body'];
// 절차적 관절 → Biped 뼈 (C: 차렷 자세 방향 보정이 필요한 팔다리)
const MAP = {
  Bip01_Spine: 'spine', Bip01_Spine1: 'spine1', Bip01_Spine2: 'chest', Bip01_Neck: 'neck', Bip01_Head: 'head',
  Bip01_L_UpperArm: 'armL', Bip01_L_Forearm: 'elbowL', Bip01_R_UpperArm: 'armR', Bip01_R_Forearm: 'elbowR',
  Bip01_L_Thigh: 'legL', Bip01_L_Calf: 'kneeL', Bip01_R_Thigh: 'legR', Bip01_R_Calf: 'kneeR'
};
const DIRCHILD = { Bip01_L_UpperArm: 'Bip01_L_Forearm', Bip01_L_Forearm: 'Bip01_L_Hand', Bip01_R_UpperArm: 'Bip01_R_Forearm', Bip01_R_Forearm: 'Bip01_R_Hand',
  Bip01_L_Thigh: 'Bip01_L_Calf', Bip01_L_Calf: 'Bip01_L_Foot', Bip01_R_Thigh: 'Bip01_R_Calf', Bip01_R_Calf: 'Bip01_R_Foot' };
const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _D = new THREE.Vector3(), _E = new THREE.Vector3(), _P = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3();
// 총을 쥔 손목 목표점 (절차적 총 거치대 gunMount 기준, m) — 오른손: 손잡이, 왼손: 총열 덮개
const GRIP = {
  rifle: { r: [0.02, -0.075, 0.11], l: [-0.035, -0.07, -0.24] },
  shotgun: { r: [0.02, -0.07, 0.12], l: [-0.035, -0.065, -0.27] },
  pistol: { r: [0.02, -0.06, 0.06], l: [-0.045, -0.075, 0.05] }
};
const MOUNT = new THREE.Vector3(0.05, -0.1, -0.3);

function partOf(name) { name = (name || '').toLowerCase(); return PARTS.find(p => name.includes(p)) || null; }

// 그룹별로 흩어진 FBX 지오메트리 → (몸 전체, 헬멧) 두 지오메트리, UV는 아틀라스 칸으로
function splitGeometry(mesh) {
  const g = mesh.geometry, mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : g.attributes.position.count, materialIndex: 0 }];
  const src = g.index ? g.toNonIndexed() : g;
  const names = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'];
  const out = { main: { n: 0, ranges: [] }, helmet: { n: 0, ranges: [] } };
  for (const gr of groups) {
    const part = partOf(mats[gr.materialIndex] && mats[gr.materialIndex].name);
    if (!part) continue; // 권총집·칼 등 아틀라스에 없는 부위는 뺀다
    const dst = part === 'helmet' ? out.helmet : out.main;
    dst.ranges.push({ start: gr.start, count: gr.count, part }); dst.n += gr.count;
  }
  let wrapped = 0;
  const build = (o) => {
    if (!o.n) return null;
    const geo = new THREE.BufferGeometry();
    for (const nm of names) {
      const a = src.attributes[nm]; if (!a) continue;
      const arr = new a.array.constructor(o.n * a.itemSize);
      let k = 0;
      for (const r of o.ranges) {
        arr.set(a.array.subarray(r.start * a.itemSize, (r.start + r.count) * a.itemSize), k * a.itemSize);
        if (nm === 'uv') {
          const c = CELLS[r.part];
          for (let i = k; i < k + r.count; i++) {
            let u = arr[i * 2], v = arr[i * 2 + 1];
            if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) { wrapped++; u -= Math.floor(u); v -= Math.floor(v); }
            arr[i * 2] = c[0] + U.clamp(u, 0.002, 0.998) * c[2]; arr[i * 2 + 1] = c[1] + U.clamp(v, 0.002, 0.998) * c[3];
          }
        }
        k += r.count;
      }
      geo.setAttribute(nm, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
    }
    return geo;
  };
  const res = { main: build(out.main), helmet: build(out.helmet), wrapped };
  return res;
}

const Soldiers = G.Soldiers = {
  ready: false, templates: [],

  async load(renderer, progress) {
    if (location.protocol === 'file:' || !THREE.FBXLoader) return;
    const mgr = new THREE.LoadingManager();
    mgr.setURLModifier(u => /\.(tga|png|jpg|jpeg|psd|dds)$/i.test(u) && !/atlas_(diff|nor)\.jpg$/.test(u) ? BLANK : u);
    const tl = new THREE.TextureLoader();
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const tex = (u, srgb) => new Promise(res => tl.load(u, t => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso; res(t); }, undefined, () => res(null)));
    const jobs = AVATARS.map(async (name) => {
      const base = 'assets/char/' + name + '/';
      try {
        const [fbx, map, nor] = await Promise.all([new THREE.FBXLoader(mgr).loadAsync(base + name + '.fbx'), tex(base + 'atlas_diff.jpg', true), tex(base + 'atlas_nor.jpg', false)]);
        if (!map) return;
        this.templates.push(this.makeTemplate(name, fbx, map, nor));
      } catch (e) { console.info('[soldiers] ' + name + ' 없음'); }
    });
    await Promise.all(jobs);
    this.templates.sort((a, b) => a.name.localeCompare(b.name));
    this.ready = this.templates.length > 0;
    for (const t of this.templates) { renderer.initTexture(t.mat.map); if (t.mat.normalMap) renderer.initTexture(t.mat.normalMap); }
    console.info('[soldiers] 군인 모델 ' + this.templates.length + '/' + AVATARS.length + (this.templates.length ? ' (' + this.templates.map(t => t.name + ':' + t.tris).join(', ') + ')' : ''));
  },

  makeTemplate(name, fbx, map, nor) {
    let skinned = null;
    fbx.traverse(o => { if (o.isSkinnedMesh && !skinned) skinned = o; });
    if (!skinned) throw new Error('no skinned mesh');
    const mat = new THREE.MeshStandardMaterial({ name: 'soldier_' + name, map, normalMap: nor, roughness: 0.82, metalness: 0 });
    const sp = splitGeometry(skinned);
    const parent = skinned.parent, skel = skinned.skeleton, bindMatrix = skinned.bindMatrix.clone();
    const mk = (geo, nm) => {
      if (!geo) return null;
      geo.computeBoundingBox();
      const m = new THREE.SkinnedMesh(geo, mat);
      m.name = nm; m.position.copy(skinned.position); m.quaternion.copy(skinned.quaternion); m.scale.copy(skinned.scale);
      parent.add(m); m.bind(skel, bindMatrix);
      m.castShadow = true; m.receiveShadow = true;
      return m;
    };
    const body = mk(sp.main, 'soldier_body'), helmet = mk(sp.helmet, 'soldier_helmet');
    parent.remove(skinned); skinned.geometry.dispose();
    // 게임 좌표: 1m 단위, -Z 가 앞쪽
    const root = new THREE.Group(); root.name = 'soldier';
    fbx.scale.setScalar(0.01); fbx.rotation.set(0, Math.PI, 0);
    root.add(fbx);
    root.updateMatrixWorld(true);
    // 바인드 자세 정보 (root 공간)
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const info = {}, byName = {};
    fbx.traverse(o => { if (o.isBone) byName[o.name] = o; });
    const rootQ = (o) => { const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return { p, q }; };
    const fbxQ = rootQ(fbx).q;
    // 매핑된 뼈와 그 조상만 갱신 목록에 (부모 먼저)
    const need = new Set();
    for (const n in MAP) { let b = byName[n]; while (b && b.isBone) { need.add(b.name); b = b.parent; } }
    const order = [];
    fbx.traverse(o => { if (o.isBone && need.has(o.name)) order.push(o.name); });
    const entries = order.map(n => {
      const b = byName[n], w = rootQ(b);
      const e = { name: n, key: MAP[n] || null, W: w.q, Lbind: b.quaternion.clone(), lp: b.position.clone().multiplyScalar(fbx.scale.x), parent: b.parent && b.parent.isBone ? order.indexOf(b.parent.name) : -1, C: new THREE.Quaternion() };
      if (DIRCHILD[n] && byName[DIRCHILD[n]]) {
        const d = rootQ(byName[DIRCHILD[n]]).p.sub(w.p).normalize();
        e.C.setFromUnitVectors(d, new THREE.Vector3(0, -1, 0));
        // 팔 IK 용: 뼈 길이와 (뼈 로컬 공간) 자식 방향
        const cl = byName[DIRCHILD[n]].position.clone().multiplyScalar(fbx.scale.x);
        e.len = cl.length(); e.dl = cl.normalize();
      }
      return e;
    });
    const idx = (n) => order.indexOf(n);
    const ik = { L: [idx('Bip01_L_UpperArm'), idx('Bip01_L_Forearm')], R: [idx('Bip01_R_UpperArm'), idx('Bip01_R_Forearm')] };
    const hips = byName.Bip01;
    let tris = 0;
    for (const m of [body, helmet]) if (m) tris += m.geometry.attributes.position.count / 3;
    if (sp.wrapped) console.info('[soldiers] ' + name + ': 범위 밖 UV ' + sp.wrapped + '개 보정');
    return { name, root, mat, entries, ik, fbxQ, unit: fbx.scale.x, hipName: hips ? hips.name : null, hipBindY: hips ? hips.position.y : 0, tris: Math.round(tris), hasHelmet: !!helmet };
  },

  // 캐릭터 하나 만들기: { root, body, helmet, bones[], drive(model) }
  create(rnd) {
    const T = this.templates[Math.floor((rnd ? rnd() : Math.random()) * this.templates.length)];
    const root = THREE.SkeletonUtils.clone(T.root);
    const byName = {};
    let body = null, helmet = null;
    root.traverse(o => {
      if (o.isBone) byName[o.name] = o;
      if (o.isSkinnedMesh) {
        if (o.name === 'soldier_body') body = o; else if (o.name === 'soldier_helmet') helmet = o;
        o.frustumCulled = true;
        o.geometry.boundingBox || o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox, c = bb.getCenter(new THREE.Vector3());
        o.boundingSphere = new THREE.Sphere(c, bb.getSize(new THREE.Vector3()).length() * 0.75);
      }
    });
    const bones = T.entries.map(e => byName[e.name]);
    const hip = T.hipName ? byName[T.hipName] : null;
    return { T, root, body, helmet, bones, hip, O: T.entries.map(() => new THREE.Quaternion()), X: T.entries.map(() => new THREE.Vector3()) };
  },

  // 절차적 관절 각도 → 군인 뼈 회전
  drive(s, m) {
    const T = s.T, P = this._P || (this._P = {}), Q = (k) => P[k] || (P[k] = new THREE.Quaternion());
    const qe = (rot, out) => out.setFromEuler(_e.set(rot.x, rot.y, rot.z, rot.order));
    qe(m.spine.rotation, Q('spine'));
    Q('chest').copy(P.spine).multiply(qe(m.chest.rotation, _q));
    Q('spine1').copy(P.spine).slerp(P.chest, 0.5);
    Q('head').copy(P.chest).multiply(qe(m.head.rotation, _q));
    Q('neck').copy(P.chest).slerp(P.head, 0.5);
    Q('armL').copy(P.chest).multiply(qe(m.armL.rotation, _q)); Q('elbowL').copy(P.armL).multiply(qe(m.elbowL.rotation, _q));
    Q('armR').copy(P.chest).multiply(qe(m.armR.rotation, _q)); Q('elbowR').copy(P.armR).multiply(qe(m.elbowR.rotation, _q));
    qe(m.legL.rotation, Q('legL')); Q('kneeL').copy(P.legL).multiply(qe(m.kneeL.rotation, _q));
    qe(m.legR.rotation, Q('legR')); Q('kneeR').copy(P.legR).multiply(qe(m.kneeR.rotation, _q));
    const E = T.entries, O = s.O, X = s.X;
    if (s.hip) s.hip.position.y = T.hipBindY * (m.hip.position.y / 0.95);
    // 1) 뼈마다 root 공간 방향(O)과 위치(X)
    for (let i = 0; i < E.length; i++) {
      const e = E[i], parentO = e.parent >= 0 ? O[e.parent] : T.fbxQ, o = O[i];
      if (e.key) o.copy(P[e.key]).multiply(e.C).multiply(e.W);
      else o.copy(parentO).multiply(e.Lbind);
      const lp = i === 0 && s.hip ? _v.copy(s.hip.position).multiplyScalar(T.unit) : e.lp; // 골반 높이(앉기)는 실제 위치로
      if (e.parent >= 0) X[i].copy(lp).applyQuaternion(parentO).add(X[e.parent]);
      else X[i].copy(lp).applyQuaternion(T.fbxQ);
    }
    // 2) 총을 든 자세면 두 손을 총 손잡이·총열 덮개로 (2관절 IK)
    const gp = m.ikGun && GRIP[m.ikGun];
    if (gp) {
      // 절차적 총 거치대 위치 = hip + spine + P_spine*(0,.42,0) + P_chest*MOUNT
      _P.set(0, m.hip.position.y + 0.06, 0).add(_v.set(0, 0.42, 0).applyQuaternion(P.spine)).add(_w.copy(MOUNT).applyQuaternion(P.chest));
      this.ikArm(s, T.ik.R, _T.fromArray(gp.r).applyQuaternion(P.chest).add(_P), _w.set(0.7, -1, 0.35).applyQuaternion(P.chest));
      _P.set(0, m.hip.position.y + 0.06, 0).add(_v.set(0, 0.42, 0).applyQuaternion(P.spine)).add(_w.copy(MOUNT).applyQuaternion(P.chest));
      this.ikArm(s, T.ik.L, _T.fromArray(gp.l).applyQuaternion(P.chest).add(_P), _w.set(-0.8, -1, 0.1).applyQuaternion(P.chest));
    }
    // 3) 로컬 회전으로
    for (let i = 0; i < E.length; i++) {
      const parentO = E[i].parent >= 0 ? O[E[i].parent] : T.fbxQ;
      s.bones[i].quaternion.copy(_q.copy(parentO).invert().multiply(O[i]));
    }
  },

  // 위팔·아래팔을 돌려 손목이 target 에 닿게 (pole: 팔꿈치가 향할 방향)
  ikArm(s, pair, target, pole) {
    const [iu, if_] = pair; if (iu < 0 || if_ < 0) return;
    const E = s.T.entries, eu = E[iu], ef = E[if_], O = s.O;
    const a = eu.len, b = ef.len;
    _S.copy(s.X[iu]);
    _D.subVectors(target, _S);
    let L = _D.length(); if (L < 1e-4) return;
    _D.divideScalar(L);
    L = Math.min(Math.max(L, Math.abs(a - b) + 1e-3), a + b - 1e-3);
    const cosA = (a * a + L * L - b * b) / (2 * a * L), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    pole.addScaledVector(_D, -pole.dot(_D)).normalize();
    _E.copy(_S).addScaledVector(_D, a * cosA).addScaledVector(pole, a * sinA);
    // 위팔
    _u.copy(eu.dl).applyQuaternion(O[iu]);
    _f.subVectors(_E, _S).normalize();
    _q2.setFromUnitVectors(_u, _f); O[iu].premultiply(_q2);
    // 아래팔 (위팔 회전을 따라간 뒤 손목 방향으로)
    O[if_].premultiply(_q2);
    _u.copy(ef.dl).applyQuaternion(O[if_]);
    _f.copy(_S).addScaledVector(_D, L).sub(_E).normalize();
    _q2.setFromUnitVectors(_u, _f); O[if_].premultiply(_q2);
  }
};

})();
