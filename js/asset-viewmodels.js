// asset-viewmodels.js — 총기별 실사 1인칭 팩: 팔·총·꺼내기·사격·장전 애니메이션 (v51)
//  원본: Sketchfab CC-BY-4.0 FPS 애니메이션 팩 (assets/models/viewmodels/CREDITS.md)
//  assets/models/viewmodels/<팩>.glb — tools/viewmodels/build.cjs 로 만든 게임용 GLB
//  · 팩이 아직 안 받아졌거나 실패하면 그 총은 기존 절차적 1인칭 모델·장전 동작을 그대로 쓴다.
//  · 장전 진행도(s.reload.p, 산탄은 단계별 진행도)를 클립 시간에 그대로 대응시킨다 → 소리·탄 수와 손동작이 맞는다.
(function () {
'use strict';
const G = window.G, T = window.THREE, V = T.Vector3, Q = T.Quaternion, D = Math.PI / 180;
const clamp = T.MathUtils.clamp;
const _v = new V(), _q = new Q(), _e = new T.Euler(), _m = new T.Matrix4(), ID = new Q();

// 팩 설정 — 시간은 원본 클립의 초 단위
//  eye: 카메라 뼈 이름(또는 모델 좌표), off: 눈 위치 보정, pitch/yaw: 카메라를 숙이고 돌리는 각(도)
//  gun: 총 몸통 뼈, len: 실제 총 길이(m, 크기 맞춤), win: 클립에서 쓸 구간, ev: 장전 소리 시각
//  spare: 장전 중에만 보이는 예비 탄창 뼈 (평소엔 0 크기로 접는다)
const PACKS = {
  ak74: {
    file: 'ak74', eye: 'Head_Cam', off: [0.08, 0.05, 0.15], pitch: 12, gun: 'PBody', len: 0.94, spare: ['Pmag2'],
    clips: { idle: 'Rig|AK_Idle', fire: 'Rig|AK_Shot', reload: 'Rig|AK_Reload', reloadEmpty: 'Rig|AK_Reload_full', draw: 'Rig|AK_Draw' },
    // AK 식: 새 탄창으로 헌 탄창을 쳐내고 → 끼우고 → (빈 총) 장전손잡이 당기기
    ev: { reload: [[1.2, 'magout'], [1.9, 'magin']], reloadEmpty: [[1.2, 'magout'], [1.9, 'magin'], [2.47, 'open'], [2.62, 'close']] }
  },
  saiga: {
    file: 'saiga', eye: 'Head_Cam', off: [0.02, 0.0, 0.04], pitch: 4, gun: 'Saiga', len: 1.0,
    clips: { idle: 'Armature|Saiga_Idle', fire: 'Armature|Saiga_Fire', reload: 'Armature|Saiga_Reload_Fast', reloadEmpty: 'Armature|Saiga_Reload_Full' },
    win: { reload: [0, 1.88] },
    ev: { reload: [[0.7, 'magout'], [1.13, 'magin']], reloadEmpty: [[0.63, 'magout'], [1.07, 'magin'], [1.83, 'open'], [1.97, 'close']] }
  },
  acr: {
    file: 'acr', eye: 'Head_Cam', off: [0.01, 0.0, 0.02], pitch: 3, gun: 'ACRRifle', len: 0.9, adsLift: 0.03, adsDist: 0.33,   // 가늠자 없는 레일: 레일 위로 내려다본다
    clips: { idle: 'Armature|Arms_FPS_Anim_Idle', fire: 'Armature|Arms_FPS_Anim_Shoot', reload: 'Armature|Arms_FPS_Anim_Reload_Fast', draw: 'Armature|Arms_FPS_Anim_Draw' },
    win: { reload: [0, 1.55] },
    ev: { reload: [[0.47, 'magout'], [0.77, 'magin']], reloadEmpty: [[0.47, 'magout'], [0.77, 'magin'], [1.2, 'close']] }
  },
  remington: {
    file: 'remington', eye: 'Head_Cam', off: [0.06, 0.04, -0.08], pitch: 8, gun: 'Body', len: 1.0, adsLift: 0.02, adsDist: 0.36,
    clips: { idle: 'Armature|SG_FPS_Idle', fire: 'Armature|SG_FPS_Shot', reload: 'Armature|SG_FPS_Reload' },
    // 한 발씩: 시작(총 기울이기) → 한 발 주기(0.63~1.97 s, 1.37 s 에 밀어 넣음) 반복 → 마지막 한 발 → 펌프로 마무리
    shell: { start: [0, 0.63], cycle: [0.63, 1.97], last: [4.67, 6.0], end: [6.0, 6.82], startDur: 0.5, endDur: 0.62, cycleDur: 0.85, endEv: [[0.06, 'open'], [0.3, 'close']] }
  },
  xdm: {
    file: 'xdm', eye: 'Head_Cam', off: [0.0, -0.03, 0.12], pitch: 12, yaw: -3, gun: 'PBody', len: 0.19, pistol: true,
    clips: { idle: 'Armature|FPS_Pistol_Idle', fire: 'Armature|FPS_Pistol_Fire', reload: 'Armature|FPS_Pistol_Reload_easy', reloadEmpty: 'Armature|FPS_Pistol_Reload_full' },
    ev: { reload: [[0.37, 'magout'], [0.9, 'magin']], reloadEmpty: [[0.37, 'magout'], [0.9, 'magin'], [1.36, 'close']] }
  },
  p9mm: {
    file: 'p9mm', eye: [0.0, 1.44, 0.08], pitch: 10, yaw: -2, gun: 'Weapon', len: 0.19, pistol: true, spare: ['Magazine_2', 'Bullet_2'],
    clips: { idle: 'Idle', fire: 'Fire', reload: 'Reload', reloadEmpty: 'Reload_Empty', draw: 'Equip' },
    win: { reload: [0, 2.6], reloadEmpty: [0, 3.6] },
    ev: { reload: [[0.43, 'magout'], [1.43, 'magin']], reloadEmpty: [[0.43, 'magout'], [1.43, 'magin'], [2.9, 'close']] }
  }
};
// 게임 총 → 팩. 없는 총(KR-98 볼트액션, DB-2 더블배럴, R-45 리볼버)은 맞는 무료 팩이 없어 기존 절차적 장전을 쓴다.
const GUNS = { ka47: 'ak74', sc17: 'acr', mk14: 'acr', sa12: 'saiga', aa12: 'saiga', s12: 'remington', m1014: 'remington', p92: 'p9mm', m1911: 'xdm', de7: 'xdm' };
// 반자동 산탄총은 펌프 동작 앞(반동)까지만 쓰고 대기 자세로 돌아간다
const FIRE_SPAN = { m1014: 0.36 };
const ADS_DIST = { reddot: 0.32, holo: 0.3, x2: 0.25, x4: 0.22, x8: 0.2 };

const AV = G.AssetVM = {
  packs: {}, GUNS, PACKS,
  pack(id) { const P = this.packs[GUNS[id]]; return P && P.ready ? P : null; },
  owns(id) { return !!this.pack(id); },
  init() {
    if (location.protocol === 'file:' || !T.GLTFLoader || !G.VM) return;
    const vm = G.VM, update = vm.update, fire = vm.fireKick, muzzle = vm.muzzleWorld, set = vm.set;
    vm.update = function (dt, s) { update.call(this, dt, s); AV.update(dt, s, this); };
    vm.set = function (id) { set.call(this, id); for (const k in AV.packs) { const P = AV.packs[k]; if (P.pivot && GUNS[id] !== k) { P.pivot.visible = false; P.active = false; } } };
    vm.fireKick = function (a, sup) { fire.call(this, a, sup); const P = AV.pack(this.cur); if (P) { P.shotT = 0; P.drawT = 99; } };
    vm.muzzleWorld = function (cam, out) {
      const P = AV.pack(this.cur);
      if (!P || !P.active) return muzzle.call(this, cam, out);
      P.pivot.updateMatrixWorld(true); out.copy(P.muzzleLocal); P.gunBone.localToWorld(out);
      const k = Math.tan(cam.fov * D / 2) / Math.tan(G.vmCamera.fov * D / 2); out.x *= k; out.y *= k;
      return out.applyMatrix4(cam.matrixWorld);
    };
    const dur = G.Guns.reloadDuration, ev = G.Guns.reloadEvents;
    G.Guns.reloadDuration = function (id, empty) { const P = AV.pack(id); return P ? AV.reloadDuration(P, id, empty) : dur.call(this, id, empty); };
    G.Guns.reloadEvents = function (id, empty, phase, port) { const P = AV.pack(id); return P ? AV.reloadEvents(P, id, empty, phase, port) : ev.call(this, id, empty, phase, port); };
    // 산탄 장전의 시작·끝 단계 시간 (팩 동작 길이에 맞춤)
    const pd = G.Player.phaseDur;
    G.Player.phaseDur = function (R, def) {
      const P = AV.pack(def.key), S = P && P.def.shell;
      if (S && R.phase !== 'load') return (R.phase === 'start' ? S.startDur * (R.port ? 1.5 : 1) : S.endDur) * G.Guns.reloadFactor(R.empty) / (G.RELOAD_SPEED || 1);
      return pd.call(this, R, def);
    };
    this.loadAll();
  },
  // 들고 있는 총의 팩부터 하나씩 받는다 (시작을 막지 않는다)
  async loadAll() {
    const gl = new T.GLTFLoader();
    if (T.MeshoptDecoder) gl.setMeshoptDecoder(T.MeshoptDecoder);
    const v = window.LZ_BUILD || '';
    const order = () => {
      const a = G.Game?.player, want = [];
      if (a?.weapons) for (const k of ['rifle', 'shotgun', 'pistol']) { const w = a.weapons[k]; if (w && GUNS[w.id]) want.push(GUNS[w.id]); }
      return [...new Set([...want, 'ak74', 'p9mm', 'remington', 'saiga', 'acr', 'xdm'])].filter(k => !this.packs[k]);
    };
    for (let next = order()[0]; next; next = order()[0]) {
      const P = this.packs[next] = { key: next, ready: false };
      try {
        const g = await gl.loadAsync('assets/models/viewmodels/' + PACKS[next].file + '.glb' + (v ? '?v=' + v : ''));
        this.install(P, g);
      } catch (e) { P.failed = true; console.warn('[AssetVM] ' + next + ' 팩 실패', e); }
    }
  },
  install(P, g) {
    const C = PACKS[P.key], model = g.scene, clips = {};
    for (const c of g.animations) clips[c.name] = c;
    for (const n of Object.values(C.clips)) if (!clips[n]) throw Error(n + ' 클립이 없습니다');
    // 뼈 이름 = 원본 이름 + _번호 (GLTFLoader 가 '.' 을 지운다)
    const find = name => { const re = new RegExp('^' + name.replace(/\./g, '') + '(_\\d+)?$'); let r = null; model.traverse(o => { if (re.test(o.name) && (!r || (o.isBone && !r.isBone))) r = o; }); return r; };
    const gunBone = find(C.gun);
    if (!gunBone) throw Error(C.gun + ' 뼈가 없습니다');
    model.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false;
      // Specular-Glossiness 에서 바뀐 재질은 금속도가 1 로 남아 환경맵 없는 1인칭 장면에서 새까맣다
      const m = o.material;
      if (m.metalness > 0.6 && !m.metalnessMap) m.metalness = 0.55;
      if (m.metalnessMap) m.metalness = Math.min(m.metalness, 0.8);
      m.envMapIntensity = 0.6;
    });
    const pivot = new T.Group(), frame = new T.Group();
    pivot.name = 'AssetVM_' + P.key; frame.add(model); pivot.add(frame); pivot.visible = false;
    const mixer = new T.AnimationMixer(model), acts = {};
    for (const [k, n] of Object.entries(C.clips)) {
      const a = mixer.clipAction(clips[n]); a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true;
      acts[k] = { action: a, dur: clips[n].duration };
    }
    Object.assign(P, { def: C, model, pivot, frame, mixer, acts, gunBone, shotT: 99, drawT: 99, active: false, gunId: null, mountKey: null, flashes: {} });
    P.spare = (C.spare || []).map(find).filter(Boolean);
    this.pose(P, [['idle', 0, 1]]);
    model.updateMatrixWorld(true);
    // 눈 위치 (모델 좌표)
    const eye = Array.isArray(C.eye) ? new V(...C.eye) : find(C.eye).getWorldPosition(new V());
    if (C.off) eye.add(_v.set(...C.off));
    // 총 메시(총 몸통 뼈 아래에 주로 묶인 메시)의 정점 → 크기·총구·가늠자 위치
    const under = b => { for (let o = b; o; o = o.parent) if (o === gunBone) return true; return false; };
    const pts = [], arms = [];
    model.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const w = o.geometry.attributes.skinWeight, ix = o.geometry.attributes.skinIndex, tot = new Map();
      for (let i = 0; i < w.count; i++) for (let k = 0; k < 4; k++) { const x = w.getComponent(i, k); if (x > 0) { const b = ix.getComponent(i, k); tot.set(b, (tot.get(b) || 0) + x); } }
      const main = [...tot].sort((a, b) => b[1] - a[1])[0];
      if (!main || !under(o.skeleton.bones[main[0]])) { if (main && !P.spare.includes(o.skeleton.bones[main[0]])) arms.push(o); return; }
      const step = Math.max(1, Math.floor(w.count / 6000)), spare = new Set(P.spare.map(b => o.skeleton.bones.indexOf(b)).filter(i => i >= 0));
      for (let i = 0; i < w.count; i += step) {
        // 예비 탄창(평소 화면 밖에 둔다)은 빼고 잰다
        let sw = 0; for (let k = 0; k < 4; k++) if (spare.has(ix.getComponent(i, k))) sw += w.getComponent(i, k);
        if (sw > 0.5) continue;
        const p = new V(); o.getVertexPosition(i, p); p.applyMatrix4(o.matrixWorld); pts.push(p);
      }
    });
    if (pts.length < 50) throw Error('총 메시를 찾지 못했습니다');

    let zmin = Infinity, zmax = -Infinity;
    for (const p of pts) { zmin = Math.min(zmin, p.z); zmax = Math.max(zmax, p.z); }
    const k = C.len / (zmax - zmin);
    // 모델 → 카메라(피벗) 공간: q⁻¹·k·(p − 눈)
    const qCam = new Q().setFromEuler(new T.Euler((C.pitch || 0) * D, Math.PI + (C.yaw || 0) * D, 0));
    frame.quaternion.copy(qCam).invert();
    model.scale.setScalar(k); model.position.copy(eye).multiplyScalar(-k);
    pivot.updateMatrixWorld(true);
    const toPivot = p => p.clone().sub(eye).multiplyScalar(k).applyQuaternion(frame.quaternion);
    const pv = pts.map(toPivot);
    // v54 팔 메시: 잘린 소매 끝(어깨 쪽)이 조준 때 화면에 들어오지 않게 한다.
    //  휴식 자세(지향 화면)에서 화면 밖(아래·옆·눈 뒤)이면서 눈에서 가까운(어깨·위팔 쪽) 정점은 그리지 않는다.
    P.armCut = { value: 0.5 };
    const near = C.armNear ?? 0.32, tv = Math.tan(27 * D);
    for (const o of arms) {
      const pos = o.geometry.attributes.position, rz = new Float32Array(pos.count), w = new V();
      for (let i = 0; i < pos.count; i++) {
        o.getVertexPosition(i, w); w.applyMatrix4(o.matrixWorld);   // 피벗은 아직 장면 밖(원점) → 월드 = 피벗 공간
        const dz = -w.z, onScreen = dz > 0.02 && Math.abs(w.y) < dz * tv * 1.3 && Math.abs(w.x) < dz * tv * 2.6;
        rz[i] = !onScreen && w.length() < near ? 1 : 0;
      }
      o.geometry.setAttribute('restZ', new T.BufferAttribute(rz, 1));
      const m = o.material = o.material.clone();
      m.onBeforeCompile = sh => {
        sh.uniforms.uArmCut = P.armCut;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float restZ;\nvarying float vRestZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRestZ = restZ;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRestZ;\nuniform float uArmCut;').replace('void main() {', 'void main() {\n  if (vRestZ > uArmCut) discard;');
      };
      m.customProgramCacheKey = () => 'vmArmCut';
    }
    this.measure(P, pv, C.pistol);
    P.gunRest = new T.Matrix4().copy(pivot.matrixWorld).invert().multiply(gunBone.matrixWorld);
    P.gunRestInv = P.gunRest.clone().invert();
    P.muzzleLocal = P.sight.muzzle.clone().applyMatrix4(P.gunRestInv);
    P.mount = null;
    G.VM.root.add(pivot);
    P.ready = true;
    console.info('[AssetVM] ' + P.key + ' 준비 (크기 ×' + k.toFixed(3) + ')');
  },
  // 휴식 자세의 총 정점(피벗 공간, 앞 = −Z)으로 총구·가늠쇠·가늠자·손잡이 자리를 잰다
  measure(P, pv, pistol) {
    // v54 총의 몸 좌표를 정점 분포로 잡는다 (애니메이션 자세가 옆으로 기울어 있어도 가늠자·가늠쇠를 제대로 찾게)
    const n = pv.length, c = pv.reduce((sum, p) => sum.add(p), new V()).multiplyScalar(1 / n);
    const C = [0, 0, 0, 0, 0, 0];   // xx xy xz yy yz zz
    for (const p of pv) { const x = p.x - c.x, y = p.y - c.y, z = p.z - c.z; C[0] += x * x; C[1] += x * y; C[2] += x * z; C[3] += y * y; C[4] += y * z; C[5] += z * z; }
    // 1) 길이 방향 = 첫 주성분 (앞 = −Z 쪽)
    const len = new V(0, 0, -1);
    for (let i = 0; i < 40; i++) len.set(C[0] * len.x + C[1] * len.y + C[2] * len.z, C[1] * len.x + C[3] * len.y + C[4] * len.z, C[2] * len.x + C[4] * len.y + C[5] * len.z).normalize();
    if (len.z > 0) len.negate();
    // 2) 위 방향 = 길이에 수직인 평면에서 가장 넓게 퍼진 방향. 탄창·손잡이(더 멀리 뻗은 쪽)가 아래
    const e1 = new V(0, 1, 0).addScaledVector(len, -len.y).normalize(), e2 = new V().crossVectors(len, e1);
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of pv) { _v.subVectors(p, c); const x = _v.dot(e1), y = _v.dot(e2); sxx += x * x; sxy += x * y; syy += y * y; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const u = e1.clone().multiplyScalar(Math.cos(th)).addScaledVector(e2, Math.sin(th));
    let hiP = 0, hiN = 0;
    for (const p of pv) { const h = _v.subVectors(p, c).dot(u); hiP = Math.max(hiP, h); hiN = Math.max(hiN, -h); }
    if (hiP > hiN) u.negate();
    // 몸 좌표: along(앞 +), h(위 +)
    let amin = Infinity, amax = -Infinity;
    const A = pv.map(p => { const d = _v.subVectors(p, c), al = d.dot(len); amin = Math.min(amin, al); amax = Math.max(amax, al); return [al, d.dot(u)]; });
    const L = amax - amin, f = i => (amax - A[i][0]) / L;
    const top = (a, b) => { let best = -1; for (let i = 0; i < n; i++) { const t = f(i); if (t >= a && t <= b && (best < 0 || A[i][1] > A[best][1])) best = i; } return pv[best].clone(); };
    // 총구: 가장 앞 정점들 중 위쪽 절반의 가운데
    const fi = []; for (let i = 0; i < n; i++) if (A[i][0] > amax - 0.006) fi.push(i);
    fi.sort((x, y) => A[y][1] - A[x][1]);
    const fr = fi.slice(0, Math.max(1, Math.ceil(fi.length / 2)));
    const muzzle = fr.reduce((sum, i) => sum.add(pv[i]), new V()).multiplyScalar(1 / fr.length);
    const F = top(0, pistol ? 0.16 : 0.22), R = top(pistol ? 0.78 : 0.45, pistol ? 1 : 0.8);
    // 가늠선(가늠자→가늠쇠)을 앞, 그에 수직인 몸 위쪽을 위로
    const axis = F.clone().sub(R).normalize();
    const up = u.clone().addScaledVector(axis, -u.dot(axis)).normalize();
    const back = axis.clone().negate(), right = new V().crossVectors(up, back);
    const q = new Q().setFromRotationMatrix(new T.Matrix4().makeBasis(right, up, back).transpose());
    // 지향 자세에서도 옆으로 기운 만큼을 총 가운데를 축으로 바로 세운다 (팔도 함께 돈다)
    const g1 = new V(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
    const roll = Math.atan2(_v.crossVectors(up, g1).dot(axis), up.dot(g1));
    // 지향 자세: 기울기는 모두 바로 세우고, 총 방향도 조금(hipAlign) 앞쪽으로 돌린다 (총 가운데 기준)
    const qH = new Q().setFromAxisAngle(axis, roll).slerp(q, P.def.hipAlign ?? 0.3), posH = c.clone().sub(c.clone().applyQuaternion(qH));
    // 가늠선 높이: 총을 시선과 나란히 돌렸을 때 가늠쇠보다 뒤쪽(덮개·레일·개머리)이 더 높으면 그 위로 본다
    let hTop = -Infinity;
    for (let i = 0; i < n; i++) if (f(i) > 0.25) hTop = Math.max(hTop, _v.copy(pv[i]).applyQuaternion(q).y);
    // 손잡이(앞손 아래)·레이저 자리
    let gh = Infinity, ga = 0, gn = 0, gs = -Infinity;
    for (let i = 0; i < n; i++) { const t = f(i); if (t > 0.25 && t < 0.42) { gh = Math.min(gh, A[i][1]); ga += A[i][0]; gn++; gs = Math.max(gs, _v.subVectors(pv[i], c).dot(right)); } }
    const grip = c.clone().addScaledVector(len, gn ? ga / gn : 0).addScaledVector(u, gn ? gh : 0);
    grip.addScaledVector(right, _v.subVectors(muzzle, grip).dot(right));
    const side = grip.clone().addScaledVector(right, (gn ? gs : 0.03) + 0.012).addScaledVector(up, 0.035);
    P.sight = { muzzle, F, R, axis, q, qInv: q.clone().invert(), grip, side, L, hTop, qH, posH, roll };
  },
  // 여러 클립을 가중치로 섞어 한 자세를 만든다 (모든 클립이 시간 t 를 따로 가진다)
  pose(P, list) {
    for (const k in P.acts) P.acts[k].action.enabled = false;
    for (const [k, t, w] of list) {
      const A = P.acts[k].action;
      A.enabled = true; A.play(); A.paused = true; A.time = clamp(t, 0, P.acts[k].dur - 1e-4); A.setEffectiveWeight(w);
    }
    P.mixer.update(0);
  },
  win(P, name) { const w = P.def.win && P.def.win[name]; return w || [0, P.acts[name].dur]; },
  reloadClip(P, empty) { return empty && P.acts.reloadEmpty ? 'reloadEmpty' : 'reload'; },
  reloadDuration(P, id, empty) {
    const S = P.def.shell, f = G.Guns.reloadFactor(empty), base = G.WEAPONS[id].reload * f;
    if (S) return S.cycleDur * f / (G.RELOAD_SPEED || 1);
    // 게임 장전 시간을 기준으로 하되, 동작이 너무 빨리 감기지 않게 최대 1.3 배까지 늘린다
    const w = this.win(P, this.reloadClip(P, empty));
    return base * clamp((w[1] - w[0]) / base, 0.85, 1.3);
  },
  reloadEvents(P, id, empty, phase, port) {
    const S = P.def.shell;
    if (S) {
      const list = phase === 'start' ? (port ? [[0.3, 'open'], [0.6, 'port'], [0.85, 'close']] : []) : phase === 'load' ? [[0.55, 'shell']] : S.endEv;
      return list.map(e => e.slice());
    }
    const name = this.reloadClip(P, empty), w = this.win(P, name), ev = P.def.ev[empty ? 'reloadEmpty' : 'reload'];
    return ev.map(([t, s]) => [(t - w[0]) / (w[1] - w[0]), s]).filter(e => e[0] >= 0 && e[0] <= 1);
  },
  // 산탄총: 이번 한 발이 마지막인가 (탄창이 차거나 예비탄이 떨어진다)
  lastShell(id, R) {
    const a = G.Game?.player, inst = a?.weapons?.[a.cur], def = G.WEAPONS[id];
    if (!inst || inst.id !== id) return false;
    const per = R.per || 1;
    return def.mag - inst.mag <= per || (a.ammo[def.ammo] || 0) <= per;
  },
  update(dt, s, vm) {
    const id = vm.cur, P = this.pack(id);
    for (const k in this.packs) { const O = this.packs[k]; if (O !== P && O.pivot && O.pivot.visible) { O.pivot.visible = false; O.active = false; } }
    if (!P) return;
    const C = P.def, orig = vm.models[id];
    if (!orig) return;
    if (!P.active || P.gunId !== id) { P.drawT = 0; P.shotT = 99; P.gunId = id; P.mountKey = null; }
    P.pivot.visible = !s.hideVM; orig.root.visible = false;
    P.shotT += dt; P.drawT += dt;
    const R = s.reload, list = [];
    const fireLen = FIRE_SPAN[id] || P.acts.fire.dur, drawLen = P.acts.draw ? P.acts.draw.dur : 0;
    let reload = false, draw = false;
    if (R && C.shell && R.type !== 'mag') {
      const S = C.shell; let t;
      if (R.phase === 'start') t = S.start[0] + R.pp * (S.start[1] - S.start[0]);
      else if (R.phase === 'load') { const w = this.lastShell(id, R) ? S.last : S.cycle; t = w[0] + clamp(R.shellP, 0, 1) * (w[1] - w[0]); }
      else t = S.end[0] + R.pp * (S.end[1] - S.end[0]);
      list.push(['reload', t, 1]); reload = true;
    } else if (R && R.type === 'mag') {
      const name = this.reloadClip(P, R.empty), w = this.win(P, name);
      list.push([name, w[0] + clamp(R.p, 0, 1) * (w[1] - w[0]), 1]); reload = true;
    } else if (P.shotT < fireLen + 0.15) {
      // 사격 → 끝나면 0.15 초 동안 대기 자세로 섞어 돌아간다
      const b = clamp((P.shotT - fireLen) / 0.15, 0, 1);
      list.push(['fire', Math.min(P.shotT, fireLen), 1 - b]);
      if (b > 0) list.push(['idle', 0, b]);
    } else if (drawLen && P.drawT < drawLen && (s.ads || 0) < 0.05) {
      list.push(['draw', P.drawT, 1]); draw = true;
    } else {
      P.idleT = ((P.idleT || 0) + dt) % P.acts.idle.dur;
      list.push(['idle', P.idleT, 1]);
    }
    if (s.ads > 0.05 || reload) P.drawT = 99;
    this.pose(P, list);
    for (const b of P.spare) b.scale.setScalar(reload ? 1 : 1e-4);
    this.syncMount(P, id, s.scope);
    // ADS: 총의 가늠선을 시선과 나란히 돌리고, 가늠쇠(또는 조준경 중심)를 화면 가운데로
    const aim = reload ? 0 : clamp(s.ads || 0, 0, 1), weight = 1 - aim * 0.85, M = P.mount;
    const sprint = (vm.sprint || 0) * (!reload && !draw ? 1 : 0);
    _e.set((vm.sway?.y || 0) * weight - sprint * 0.2, (vm.sway?.x || 0) * weight + sprint * 0.5, (vm.kickRoll || 0) + sprint * 0.16);
    this.place(P, aim, _e);
    P.pivot.position.x += (vm.sway?.x || 0) * 0.2 * weight + Math.sin((vm.t || 0) * 0.8) * 0.001 * weight;
    P.pivot.position.y += Math.sin(s.phase || 0) * 0.006 * (s.moving || 0) * weight - (s.landDip || 0) * 0.05;
    if (!draw) P.pivot.position.y -= (1 - (s.raise ?? 1)) * 0.22;
    P.pivot.position.z += vm.kick * 0.02;
    P.pivot.updateMatrixWorld(true);
    // 총구 불꽃
    const fl = P.flashes[id];
    if (fl) {
      fl.visible = vm.flashT > 0 && orig.flash.visible;
      if (fl.visible) {
        fl.position.copy(P.muzzleLocal); P.gunBone.localToWorld(fl.position); P.pivot.worldToLocal(fl.position);
        fl.rotation.z = orig.flash.rotation.z; fl.scale.copy(orig.flash.scale);
        if (vm.flashLight) vm.flashLight.position.copy(fl.position).applyMatrix4(P.pivot.matrixWorld);
      }
    }
    P.active = true;
  },
  // 지향(캔트만 바로 세움) ↔ 조준(가늠선 정렬) 사이를 섞는다. eul: 흔들림·전력질주 회전
  place(P, aim, eul) {
    const S = P.sight, M = P.mount;
    // 잘린 소매 끝 숨기기는 조준할 때만 (장전 동작에서는 팔 전체가 보여야 한다)
    if (P.armCut) P.armCut.value = aim > 0.25 ? 0.5 : 2;
    _q.copy(S.qH).slerp(M.q, aim);
    if (eul) P.pivot.quaternion.setFromEuler(eul).multiply(_q); else P.pivot.quaternion.copy(_q);
    P.pivot.position.copy(S.posH).lerp(M.t, aim);
  },
  // 휴식 자세 기준 피벗 공간 변환을 총 몸통 뼈에 붙인다
  onBone(P, obj, pos, quat) {
    _m.compose(pos, quat, _v.set(1, 1, 1)).premultiply(P.gunRestInv);
    _m.decompose(obj.position, obj.quaternion, obj.scale);
    P.mountGroup.add(obj);
  },
  syncMount(P, id, scope) {
    const a = G.Game?.player, inst = Object.values(a?.weapons || {}).find(w => w && w.id === id);
    const parts = inst?.attachments || {}, key = id + JSON.stringify([scope, parts]);
    if (key === P.mountKey) return;
    P.mountKey = key;
    if (P.mountGroup) { P.mountGroup.removeFromParent(); for (const x of P.mountDispose || []) x.dispose(); }
    P.mountGroup = new T.Group(); P.mountDispose = [];
    P.gunBone.add(P.mountGroup);
    // 뼈 공간 그룹은 단위 변환 없이 쓰고, 자식마다 휴식 자세 기준 변환을 넣는다
    if (!P.flashes[id] && G.VM.models[id]?.flash) { const fl = G.VM.models[id].flash.clone(); fl.visible = false; P.pivot.add(fl); P.flashes[id] = fl; }
    for (const k in P.flashes) if (k !== id) P.flashes[k].visible = false;
    const S = P.sight, A = G.Attachments, pistol = P.def.pistol, cls = G.WEAPONS[id].cls;
    const t = new V(), q = S.q.clone();
    const Fq = S.F.clone().applyQuaternion(q), Rq = S.R.clone().applyQuaternion(q);
    t.set(-Fq.x, -Math.max(Fq.y, S.hTop) - 0.004 - (P.def.adsLift || 0), -(P.def.adsDist || (pistol ? 0.3 : 0.27)) - Rq.z);
    // 팔·총을 앞으로 너무 많이 밀면 원래 화면 밖이던 팔(소매 끝)이 들어온다 → 앞으로는 최대 7 cm 만
    t.z = Math.max(t.z, -0.07);
    const fwd = new V(0, 0, -1).applyQuaternion(S.qInv);
    const metal = () => { const m = new T.MeshStandardMaterial({ color: 0x252b2d, metalness: 0.7, roughness: 0.45 }); P.mountDispose.push(m); return m; };
    if (scope && A) {
      const optic = A.make(scope === 'reddot' && pistol ? 'micro' : scope, 1);
      if (optic) {
        let eye = scope === 'reddot' ? 0.032 : scope === 'holo' ? 0.044 : scope === 'x2' ? 0.05 : 0.0264;
        if (scope === 'x4' || scope === 'x8') { optic.rotation.y = Math.PI; optic.scale.multiplyScalar(scope === 'x8' ? 1.35 : 1.05); eye *= scope === 'x8' ? 1.35 : 1.05; }
        optic.updateMatrixWorld(true);
        const box = new T.Box3().setFromObject(optic); optic.position.y -= box.min.y;
        if (['reddot', 'holo', 'x2'].includes(scope)) {
          const glass = new T.Box3(); optic.updateMatrixWorld(true);
          optic.traverse(x => { if (x.isMesh && /glass/i.test(x.material?.name || '')) glass.union(new T.Box3().setFromObject(x)); });
          if (!glass.isEmpty()) eye = glass.getCenter(new V()).y;
        }
        const holder = new T.Group(); holder.add(optic);
        if (scope === 'reddot' || scope === 'holo') {
          optic.traverse(x => { if (x.isMesh && /glass|blue/i.test(x.material?.name || '')) { x.material = x.material.clone(); P.mountDispose.push(x.material); x.material.transparent = true; x.material.opacity = 0.15; x.material.depthWrite = false; } });
          const dot = new T.Mesh(new T.CircleGeometry(0.0009, 16), new T.MeshBasicMaterial({ color: 0xff2415, depthTest: false }));
          dot.position.set(0, eye, 0.03); dot.renderOrder = 10; holder.add(dot); P.mountDispose.push(dot.geometry, dot.material);
        }
        // 가늠자 바로 앞, 조금 낮춰 레일·덮개 위에 얹는다
        const base = S.R.clone().add(_v.set(0, pistol ? -0.003 : -0.006, 0)).addScaledVector(fwd, pistol ? 0.012 : 0.03);
        this.onBone(P, holder, base, S.qInv);
        const O = base.clone().add(new V(0, eye, 0).applyQuaternion(S.qInv)).applyQuaternion(q);
        t.set(-O.x, -O.y, -(ADS_DIST[scope] || 0.3) - O.z);
      }
    }
    if (A && cls !== 'shotgun') {
      const at = S.muzzle.clone().addScaledVector(fwd, 0.01);
      if (parts.muzzle === 'suppressor') { const o = A.make('suppressor', 1); if (o) this.onBone(P, o, at, S.qInv); }
      else if (parts.muzzle) {
        const g = new T.CylinderGeometry(0.012, 0.014, 0.038, 12).rotateX(Math.PI / 2); P.mountDispose.push(g);
        this.onBone(P, new T.Mesh(g, metal()), at.clone().addScaledVector(fwd, 0.015), S.qInv);
      }
    } else if (parts.muzzle === 'choke') {
      const g = new T.CylinderGeometry(0.013, 0.014, 0.03, 12).rotateX(Math.PI / 2); P.mountDispose.push(g);
      this.onBone(P, new T.Mesh(g, metal()), S.muzzle.clone().addScaledVector(fwd, 0.012), S.qInv);
    }
    if (A && parts.under && cls === 'rifle') {
      const o = A.make('grip', 1);
      if (o) {
        if (parts.under === 'angled') o.rotation.x = -0.5;
        if (parts.under === 'light' || parts.under === 'half') o.scale.y *= parts.under === 'light' ? 0.7 : 0.85;
        const h = new T.Group(); h.add(o); this.onBone(P, h, S.grip, S.qInv);
      }
    }
    if (A && parts.side === 'laser') { const o = A.make('laser', 1); if (o) { const h = new T.Group(); h.add(o); this.onBone(P, h, pistol ? S.grip.clone().add(_v.set(0, 0.02, 0)) : S.side, S.qInv); } }
    P.mount = { t, q };
  }
};
})();
