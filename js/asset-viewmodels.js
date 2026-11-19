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
    file: 'ak74', cutBones: /^UpArm_[LR]/, magBone: 'Pmag', eye: 'Head_Cam', off: [0.08, 0.05, 0.15], pitch: 12, gun: 'PBody', len: 0.94, spare: ['Pmag2'],
    clips: { idle: 'Rig|AK_Idle', fire: 'Rig|AK_Shot', reload: 'Rig|AK_Reload', reloadEmpty: 'Rig|AK_Reload_full', draw: 'Rig|AK_Draw' },
    // AK 식: 새 탄창으로 헌 탄창을 쳐내고 → 끼우고 → (빈 총) 장전손잡이 당기기
    ev: { reload: [[1.2, 'magout'], [1.9, 'magin']], reloadEmpty: [[1.2, 'magout'], [1.9, 'magin'], [2.47, 'open'], [2.62, 'close']] }
  },
  saiga: {
    file: 'saiga', cutBones: /^UpArm_[LR]/, magBone: 'Pmag', eye: 'Head_Cam', off: [0.02, 0.0, 0.04], pitch: 4, gun: 'Saiga', len: 1.0,
    clips: { idle: 'Armature|Saiga_Idle', fire: 'Armature|Saiga_Fire', reload: 'Armature|Saiga_Reload_Fast', reloadEmpty: 'Armature|Saiga_Reload_Full' },
    win: { reload: [0, 1.88] },
    ev: { reload: [[0.7, 'magout'], [1.13, 'magin']], reloadEmpty: [[0.63, 'magout'], [1.07, 'magin'], [1.83, 'open'], [1.97, 'close']] }
  },
  acr: {
    file: 'acr', cutBones: /^UpArm_[LR]/, cutReloadOnly: true, magBone: 'Pmag', eye: 'Head_Cam', off: [0.01, 0.0, 0.02], pitch: 3, gun: 'ACRRifle', len: 0.9, adsLift: 0.03, adsDist: 0.33,   // 가늠자 없는 레일: 레일 위로 내려다본다
    clips: { idle: 'Armature|Arms_FPS_Anim_Idle', fire: 'Armature|Arms_FPS_Anim_Shoot', reload: 'Armature|Arms_FPS_Anim_Reload_Fast', draw: 'Armature|Arms_FPS_Anim_Draw' },
    win: { reload: [0, 1.55] },
    ev: { reload: [[0.47, 'magout'], [0.77, 'magin']], reloadEmpty: [[0.47, 'magout'], [0.77, 'magin'], [1.2, 'close']] }
  },
  remington: {
    file: 'remington', cutBones: /^UpArm_[LR]/, cutReloadOnly: true, eye: 'Head_Cam', off: [0.06, 0.04, -0.08], pitch: 8, gun: 'Body', len: 1.0, adsLift: 0.02, adsDist: 0.5, adsFwd: 0.16, reloadLift: { at: [0.01, -0.01, -0.11], pitch: 0, roll: 6 },
    clips: { idle: 'Armature|SG_FPS_Idle', fire: 'Armature|SG_FPS_Shot', reload: 'Armature|SG_FPS_Reload' },
    // 한 발씩: 시작(총 기울이기) → 한 발 주기(0.63~1.97 s, 1.37 s 에 밀어 넣음) 반복 → 마지막 한 발 → 펌프로 마무리
    shell: { start: [0, 0.63], cycle: [0.63, 1.97], last: [4.67, 6.0], end: [6.0, 6.82], startDur: 0.5, endDur: 0.62, cycleDur: 0.85, endEv: [[0.06, 'open'], [0.3, 'close']] }
  },
  xdm: {
    file: 'xdm', fore0: ['Forearm_R', 'BoneTwist_01R'], foreTarget: 0.13, thin: ['BoneTwist_03L', 'BoneTwist_03R'], cutBones: /^UpArm_[LR]/, magBone: 'Pmag', slideBone: 'Rif', eye: 'Head_Cam', off: [0.0, -0.03, 0.12], pitch: 12, yaw: -3, gun: 'PBody', len: 0.19, pistol: true, hip: { at: [0.11, -0.08, -0.37], yaw: 13, pitch: 4 },   // 바꿔 낀 권총을 2 cm 내린 만큼 올림
    clips: { idle: 'Armature|FPS_Pistol_Idle', fire: 'Armature|FPS_Pistol_Fire', reload: 'Armature|FPS_Pistol_Reload_easy', reloadEmpty: 'Armature|FPS_Pistol_Reload_full' },
    ev: { reload: [[0.37, 'magout'], [0.9, 'magin']], reloadEmpty: [[0.37, 'magout'], [0.9, 'magin'], [1.36, 'close']] }
  },
  p9mm: {
    file: 'p9mm', magBone: 'Magazine', slideBone: 'Slidder', eye: [0.0, 1.44, 0.08], pitch: 10, yaw: -2, gun: 'Weapon', len: 0.19, pistol: true, hip: { at: [0.11, -0.1, -0.37], yaw: 13, pitch: 4 }, spare: ['Magazine_2', 'Bullet_2'],
    clips: { idle: 'Idle', fire: 'Fire', reload: 'Reload', reloadEmpty: 'Reload_Empty', draw: 'Equip' },
    win: { reload: [0, 2.6], reloadEmpty: [0, 3.6] },
    ev: { reload: [[0.43, 'magout'], [1.43, 'magin']], reloadEmpty: [[0.43, 'magout'], [1.43, 'magin'], [2.9, 'close']] }
  },
  // v56 DJMaesen 팩: 클립 하나(allanims)에 모든 동작이 이어져 있어 cut 구간으로 나눈다. 총은 뼈가 아닌 노드(스킨 없는 메시)
  sniper: {
    file: 'sniper', magBone: 'clip', eye: [8, 12, -42], pitch: 4, gun: 'sniper', len: 1.12, scopeDrop: 0.03,   // 배율 조준경 마운트를 레일까지 내림
    cutBones: /^[LR]_arm_\d+$/, adsDist: 0.42, adsLift: 0.006, src: 'allanims', fireFit: true,
    cut: { idle: [0, 0.05], fire: [0.02, 1.5], reload: [1.5, 3.75] },
    clips: {},
    ev: { reload: [[1.75, 'magout'], [2.55, 'magin'], [3.2, 'open'], [3.45, 'close']] }
  },
  revolver: {
    file: 'revolver', eye: [6, 9, -40], pitch: 6, gun: 'revolver', len: 0.36, adsDist: 0.44, pistol: true, ik: [{ bones: ['R_arm', 'R_elbow', 'R_wrist'], drop: [-0.03, -0.14, 0.12], pole: [-0.5, -1, 0] }], cutBones: /^[LR]_arm_\d+$/, hip: { at: [0.095, -0.13, -0.47], yaw: 6 }, src: 'allanims',
    cut: { idle: [0.45, 0.5], fire: [0, 0.45], reload: [0.5, 9.2] },
    clips: {},
    ev: { reload: [[1.0, 'open'], [1.4, 'shell'], [4.0, 'magin'], [7.6, 'close']] }
  }
};
// 게임 총 → 팩. 없는 총(DB-2 더블배럴)은 맞는 무료 팩이 없어 기존 절차적 장전을 쓴다.
const GUNS = { kr98: 'sniper', r45: 'revolver', ka47: 'ak74', sc17: 'acr', mk14: 'acr', sa12: 'saiga', aa12: 'saiga', s12: 'remington', m1014: 'remington', p92: 'p9mm', m1911: 'xdm', de7: 'xdm' };
// 반자동 산탄총은 펌프 동작 앞(반동)까지만 쓰고 대기 자세로 돌아간다
const FIRE_SPAN = { m1014: 0.36 };
// v55 같은 팩(팔·동작)을 쓰는 두 번째 총은 총 메시만 다른 실사 총으로 바꿔 끼운다 (tools/viewmodels/build-swap.cjs)
//  file: GLB 경로, shift: 가늠자 기준 총열 방향(앞 +) 보정 m, lift: 위 보정 m
//  노드 이름이 mag… → 팩의 탄창 뼈, slide… → 팩의 슬라이드 뼈를 따라 움직인다
const SWAP = {
  sc17: { file: 'assets/models/viewmodels/swap/sc17.glb', shift: -0.04, lift: -0.015 },          // SCAR-H (Rotuma) on ACR 팩
  m1014: { file: 'assets/models/viewmodels/swap/m1014.glb', shift: -0.05, lift: 0.015, tilt: -7 },        // Benelli M4 (TastyTony) on Remington 팩
  m1911: { file: 'assets/models/viewmodels/swap/m1911.glb', lift: -0.022 },   // 손잡이가 주먹 안에 들어오게 내림        // Colt M1911 (b0ho) on XD 팩
  de7: { file: 'assets/models/viewmodels/swap/de7.glb', lift: -0.022 },            // Desert Eagle (ELIZION) on XD 팩
  aa12: { file: 'assets/models/viewmodels/swap/aa12.glb', shift: -0.07 },          // v58 AA-12 Redesign (Naudaff3D) on Saiga 팩
  mk14: { file: 'assets/models/guns/mk14.glb', shift: -0.01 }                      // 게임 자체 MK-14 모델 on ACR 팩
};
// v56 지향 자세: at = 가늠자 자리(카메라 공간 m, 오른쪽 +x · 위 +y · 앞 −z), yaw/pitch/roll(도) = 총구를 가운데로 · 살짝 위로 · 윗면을 안쪽으로
// v56 모든 팩 공통 팔 색 (선형 RGB): 검은 전술 장갑 · 레인저 그린 소매
const ARM_LOOK = { glove: [0.032, 0.032, 0.034], sleeve: [0.075, 0.08, 0.06] };
const HIP = {
  rifle: { at: [0.105, -0.095, -0.3], yaw: 4.5, pitch: 1.5, roll: 0 },
  pistol: { at: [0.085, -0.095, -0.34], yaw: 3, pitch: 2, roll: 0 }
};
// v56 장전 중 들어 올리기 (m, 도)
// v56 권총 반동 (도, m, 초): 오르는 시간 · 돌아오는 빠르기 · 흔들림
const PISTOL_KICK = { pitch: 9, roll: 2.5, back: 0.022, lift: 0.006, rise: 0.035, ret: 13, wob: 9 };
// v57 전력질주 자세 (도, m): pitch − = 총구 아래, yaw + = 총구 왼쪽(가운데), roll + = 윗면 왼쪽
const SPRINT = {
  rifle: { pitch: -7, yaw: 3, roll: 16, at: [0.0, -0.015, 0.01] },
  pistol: { pitch: -8, yaw: 0, roll: 8, at: [0.0, -0.02, 0.01] }
};
const RELOAD_LIFT = { at: [-0.025, 0.04, -0.03], pitch: 4, yaw: 0, roll: 7 };
const ADS_DIST = { reddot: 0.32, holo: 0.3, x2: 0.25, x4: 0.22, x8: 0.2 };

const AV = G.AssetVM = {
  packs: {}, GUNS, PACKS, SWAP,
  pack(id) { const P = this.packs[GUNS[id]]; return P && P.ready ? P : null; },
  owns(id) { return !!this.pack(id); },
  init() {
    if (location.protocol === 'file:' || !T.GLTFLoader || !G.VM) return;
    const vm = G.VM, update = vm.update, fire = vm.fireKick, muzzle = vm.muzzleWorld, set = vm.set;
    vm.update = function (dt, s) { update.call(this, dt, s); AV.update(dt, s, this); };
    vm.set = function (id) { set.call(this, id); for (const k in AV.packs) { const P = AV.packs[k]; if (P.pivot && GUNS[id] !== k) { P.pivot.visible = false; P.active = false; } } };
    vm.fireKick = function (a, sup) { fire.call(this, a, sup); const P = AV.pack(this.cur); if (P) { P.shotT = 0; P.drawT = 99; P.kickSide = Math.random() < 0.5 ? -1 : 1; } };
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
      return [...new Set([...want, 'ak74', 'p9mm', 'remington', 'saiga', 'acr', 'xdm', 'sniper', 'revolver'])].filter(k => !this.packs[k]);
    };
    for (let next = order()[0]; next; next = order()[0]) {
      const P = this.packs[next] = { key: next, ready: false };
      try {
        const g = await gl.loadAsync('assets/models/viewmodels/' + PACKS[next].file + '.glb' + (v ? '?v=' + v : ''));
        this.install(P, g);
        for (const id in SWAP) if (GUNS[id] === next) {
          try { this.installSwap(P, id, await gl.loadAsync(SWAP[id].file + (v ? '?v=' + v : ''))); }
          catch (e) { console.warn('[AssetVM] ' + id + ' 총 모델 실패 — 팩 총을 쓴다', e); }
        }
      } catch (e) { P.failed = true; console.warn('[AssetVM] ' + next + ' 팩 실패', e); }
    }
  },
  install(P, g) {
    const C = PACKS[P.key], model = g.scene, clips = {};
    for (const c of g.animations) clips[c.name] = c;
    if (C.cut) {
      // 한 클립을 구간마다 잘라 쓴다 (시간 기준, 앞을 0 으로)
      const src = clips[C.src]; if (!src) throw Error(C.src + ' 클립이 없습니다');
      C.clips = {};
      for (const [k, [a, b]] of Object.entries(C.cut)) {
        const tracks = src.tracks.map(tr => {
          const n = tr.getValueSize(), tt = [], vv = [];
          const push = (t, v) => { tt.push(t - a); for (let j = 0; j < n; j++) vv.push(v[j]); };
          const at = t => { const iv = tr.createInterpolant(); return Array.from(iv.evaluate(t)); };
          push(a, at(a));
          for (let i = 0; i < tr.times.length; i++) if (tr.times[i] > a && tr.times[i] < b) push(tr.times[i], tr.values.slice(i * n, i * n + n));
          push(b, at(b));
          return new tr.constructor(tr.name, tt, vv);
        });
        clips['cut_' + k] = new T.AnimationClip('cut_' + k, b - a, tracks); C.clips[k] = 'cut_' + k;
      }
    }
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
    P.gunMeshes = []; P.swaps = {}; P.find = find;
    this.pose(P, [['idle', 0, 1]]);
    model.updateMatrixWorld(true);
    // 눈 위치 (모델 좌표)
    const eye = Array.isArray(C.eye) ? new V(...C.eye) : find(C.eye).getWorldPosition(new V());
    if (C.off) eye.add(_v.set(...C.off));
    // 총 메시(총 몸통 뼈 아래에 주로 묶인 메시)의 정점 → 크기·총구·가늠자 위치
    const under = b => { for (let o = b; o; o = o.parent) if (o === gunBone) return true; return false; };
    const pts = [], arms = [];
    model.traverse(o => {
      if (o.isMesh && !o.isSkinnedMesh && under(o)) {
        // 스킨 없는 총 메시 (총 노드 아래 부품)
        P.gunMeshes.push(o);
        const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 3000));
        for (let i = 0; i < pos.count; i += step) pts.push(new V().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
        return;
      }
      if (!o.isSkinnedMesh) return;
      const w = o.geometry.attributes.skinWeight, ix = o.geometry.attributes.skinIndex, tot = new Map();
      for (let i = 0; i < w.count; i++) for (let k = 0; k < 4; k++) { const x = w.getComponent(i, k); if (x > 0) { const b = ix.getComponent(i, k); tot.set(b, (tot.get(b) || 0) + x); } }
      const main = [...tot].sort((a, b) => b[1] - a[1])[0];
      if (!main || !under(o.skeleton.bones[main[0]])) {
        if (!main || P.spare.includes(o.skeleton.bones[main[0]])) return;
        // v58 팔 메시 = 여러 뼈(손가락·손목·팔)에 나눠 묶인 메시. 뼈 하나에만 묶인 메시는 손에 드는 총 부품(탄창·낱개 탄)이다
        //  → 팔로 칠하거나 숨기지 않는다. 탄창 뼈에 묶인 탄창은 총 메시로 쳐서 바꿔 낀 총에서는 숨긴다 (예전: ACR 탄창이 SC-17 옆에 하나 더 보였다)
        const used = [...tot].filter(([, x]) => x > 1).length;
        if (used >= 4) arms.push(o);
        else if (C.magBone && o.skeleton.bones[main[0]].name.startsWith(C.magBone)) P.gunMeshes.push(o);
        return;
      }
      P.gunMeshes.push(o);
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
    let k = C.len / (zmax - zmin);
    // fore: [팔꿈치 뼈, 손목 뼈, 실제 아래팔 길이 m] — 팩의 팔이 총에 비해 지나치게 크면 총 길이와 아래팔 길이로 잰 크기의 기하 평균을 쓴다
    if (C.fore) {
      const a = find(C.fore[0]), b = find(C.fore[1]);
      if (a && b) { const ka = C.fore[2] / a.getWorldPosition(new V()).distanceTo(b.getWorldPosition(_v)); P.kInfo = [k, ka]; k = Math.sqrt(k * ka); }
    }
    // 모델 → 카메라(피벗) 공간: q⁻¹·k·(p − 눈)
    const qCam = new Q().setFromEuler(new T.Euler((C.pitch || 0) * D, Math.PI + (C.yaw || 0) * D, 0));
    frame.quaternion.copy(qCam).invert();
    model.scale.setScalar(k); model.position.copy(eye).multiplyScalar(-k);
    P.k = k;
    if (C.ik) { this.pose(P, [['idle', 0, 1]]); }   // 팔 IK(어깨 내리기)를 넣은 자세로 다시
    pivot.updateMatrixWorld(true);
    const toPivot = p => p.clone().sub(eye).multiplyScalar(k).applyQuaternion(frame.quaternion);
    const pv = pts.map(toPivot);
    // v54 팔 메시: 잘린 소매 끝(어깨 쪽)이 조준 때 화면에 들어오지 않게 한다.
    //  휴식 자세(지향 화면)에서 화면 밖(아래·옆·눈 뒤)이면서 눈에서 가까운(어깨·위팔 쪽) 정점은 그리지 않는다.
    P.sight = P.sight0 = this.measure(P, pv, C.pistol);
    for (const o of arms) this.unifyArm(o);
    // v58 손 크기 맞추기: 팩마다 팔이 총에 비해 크거나 작다 (같은 팔 리그인데 팩마다 1.5배까지 차이) → 손을 주먹 가운데 기준으로 줄이거나 키운다
    P.hands = [...new Set(arms.flatMap(o => o.userData.handRoots || []))].map(b => ({ bone: b, s0: b.scale.clone(), p0: b.position.clone(),
      anim: Object.values(P.acts).some(x => x.action.getClip().tracks.some(tr => tr.name === b.name + '.position')),
      animS: Object.values(P.acts).some(x => x.action.getClip().tracks.some(tr => tr.name === b.name + '.scale')) }));
    P.handScale = C.handScale ?? 1;
    if (C.foreTarget && C.fore0) { const a = find(C.fore0[0]), b = find(C.fore0[1]); if (a && b) P.handScale = C.foreTarget / a.getWorldPosition(new V()).distanceTo(b.getWorldPosition(_v)) * (C.handScale ?? 1); }   // 월드 = 이미 k 배
    P.armCut = { value: 0.5 };
    // v56 지향 자세에서 화면 밖이고 총에서 먼(손이 아닌 위팔·어깨 쪽) 정점만 그리지 않는다
    const far = C.armFar ?? 0.22, tv = Math.tan(27 * D), mz = P.sight.muzzle, back = P.sight.axis.clone().negate(), segL = P.sight.L * 1.05, d0 = new V();
    for (const o of arms) {
      const pos = o.geometry.attributes.position, rz = new Float32Array(pos.count), w = new V();
      for (let i = 0; i < pos.count; i++) {
        o.getVertexPosition(i, w); w.applyMatrix4(o.matrixWorld);
        const along = clamp(d0.subVectors(w, mz).dot(back), 0, segL), gunD = d0.addScaledVector(back, -along).length();
        w.applyQuaternion(P.sight.qH).add(P.sight.posH);   // 지향 자세의 피벗 공간
        const dz = -w.z, onScreen = dz > 0.02 && Math.abs(w.y) < dz * tv * 1.3 && Math.abs(w.x) < dz * tv * 2.6;
        rz[i] = !onScreen && gunD > far ? 2 : 0;
        // cutBones: 위팔(소매) 뼈에 주로 묶인 정점은 화면 안이어도 숨긴다 (팔이 긴 팩)
        if (C.cutBones && o.isSkinnedMesh) {
          const sw = o.geometry.attributes.skinWeight, si = o.geometry.attributes.skinIndex;
          let bw = 0, bi = 0; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); bi = si.getComponent(i, k); }
          if (C.cutBones.test(o.skeleton.bones[bi]?.name || '') && !rz[i]) rz[i] = 1;   // 위팔: cutReloadOnly 팩은 장전 중에만 숨긴다
        }
      }
      o.geometry.setAttribute('restZ', new T.BufferAttribute(rz, 1));
      const m = o.material;
      const tint = m.userData.armTint;
      m.onBeforeCompile = sh => {
        sh.uniforms.uArmCut = P.armCut;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float restZ;\nattribute float handW;\nvarying float vRestZ;\nvarying float vHandW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRestZ = restZ;\nvHandW = handW;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRestZ;\nvarying float vHandW;\nuniform float uArmCut;').replace('void main() {', 'void main() {\n  if (vRestZ > uArmCut) discard;');
        if (tint) {
          // v56 모든 팩의 팔을 같은 장갑·소매 색으로: 원래 텍스처의 밝기 무늬만 남기고(구역별 평균으로 나눠) 정해진 색을 곱한다
          sh.uniforms.uGlove = { value: new T.Vector4(...ARM_LOOK.glove, tint[0]) };
          sh.uniforms.uSleeve = { value: new T.Vector4(...ARM_LOOK.sleeve, tint[1]) };
          sh.fragmentShader = sh.fragmentShader.replace('uniform float uArmCut;', 'uniform float uArmCut;\nuniform vec4 uGlove;\nuniform vec4 uSleeve;')
            .replace('#include <map_fragment>', `#include <map_fragment>
  { float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float h = smoothstep(0.35, 0.65, vHandW);
    float det = clamp(pow(lum / mix(uSleeve.w, uGlove.w, h), 0.6), 0.45, mix(1.45, 1.15, h));
    diffuseColor.rgb = mix(uSleeve.rgb, uGlove.rgb, h) * det; }`);
        }
      };
      m.customProgramCacheKey = () => 'vmArmCut' + (tint ? 'T' : '');
    }
    P.gunRest = new T.Matrix4().copy(pivot.matrixWorld).invert().multiply(gunBone.matrixWorld);
    P.gunRestInv = P.gunRest.clone().invert();
    P.muzzleLocal = P.muzzle0 = P.sight.muzzle.clone().applyMatrix4(P.gunRestInv);
    // 탄창·슬라이드 뼈의 휴식 자세 (바꿔 끼운 총의 탄창·슬라이드가 따라 움직이게)
    P.boneRest = {};
    for (const [k, nm] of [['mag', C.magBone], ['slide', C.slideBone]]) {
      const b = nm && find(nm);
      if (b) P.boneRest[k] = { bone: b, inv: new T.Matrix4().copy(pivot.matrixWorld).invert().multiply(b.matrixWorld).invert() };
    }
    // 권총 슬라이드 후퇴 방향 (슬라이드 뼈 부모 좌표, 2.2 cm)
    if (C.pistol && P.boneRest.slide) {
      // 피벗이 아직 원점(단위 변환)이라 월드 = 피벗 공간 (m)
      const b = P.boneRest.slide.bone, wp = b.getWorldPosition(new V()), back = P.sight.axis.clone().negate().multiplyScalar(0.022);
      const p0 = b.parent.worldToLocal(wp.clone()), p1 = b.parent.worldToLocal(wp.clone().add(back));
      // 대기 클립이 이 뼈 위치를 매 프레임 다시 쓰는지 (아니면 지난 프레임에 더한 만큼 빼야 한다)
      const anim = Object.values(P.acts).some(a => a.action.getClip().tracks.some(tr => tr.name === b.name + '.position'));
      P.slideKick = { bone: b, d: p1.sub(p0), anim, last: 0 };
    }
    P.mount = null;
    G.VM.root.add(pivot);
    P.ready = true;
    console.info('[AssetVM] ' + P.key + ' 준비 (크기 ×' + k.toFixed(3) + (P.kInfo ? ' 총 ' + P.kInfo[0].toFixed(4) + ' 팔 ' + P.kInfo[1].toFixed(4) : '') + ')');
  },
  // v56 팔 메시마다 정점의 '손(장갑) 비율' handW 와 구역별 텍스처 평균 밝기를 구한다 → 셰이더에서 같은 색으로 칠한다
  unifyArm(o) {
    const g = o.geometry, n = g.attributes.position.count, hw = new Float32Array(n);
    const m = o.material = o.material.clone();
    // 숨긴 어깨 쪽 정점 경계(소매 끝)가 화면에 들어와도 빈 구멍 대신 소매 안쪽이 보이게 양면으로
    m.side = T.DoubleSide;
    const mn = (m.name || '') + ' ' + o.name;
    if (/glove/i.test(mn)) hw.fill(1);
    else if (o.isSkinnedMesh && !/uniform|sleeve/i.test(mn)) {
      // 손 뼈 = 손가락 사슬(자식 뼈가 2개 이상 이어진 가지)을 4개 이상 거느린 뼈. 그 아래 뼈들에 묶인 가중치 합이 손 비율
      const bones = o.skeleton.bones, set = new Set(bones), size = new Map();
      const count = b => { if (size.has(b)) return size.get(b); let c = 0; for (const ch of b.children) if (set.has(ch)) c += 1 + count(ch); size.set(b, c); return c; };
      const cand = bones.filter(b => b.children.filter(ch => set.has(ch) && count(ch) >= 2).length >= 4);
      const below = (a, b) => { for (let x = b.parent; x; x = x.parent) if (x === a) return true; return false; };
      const roots = cand.filter(r => !cand.some(o2 => o2 !== r && below(r, o2)));   // 가장 깊은 것만 (뿌리 뼈 제외)
      const hand = new Set(); const add = b => { hand.add(b); for (const ch of b.children) if (set.has(ch)) add(ch); };
      roots.forEach(add);
      (o.userData.handRoots = roots);
      const isH = bones.map(b => hand.has(b)), sw = g.attributes.skinWeight, si = g.attributes.skinIndex;
      for (let i = 0; i < n; i++) { let h = 0; for (let k = 0; k < 4; k++) if (isH[si.getComponent(i, k)]) h += sw.getComponent(i, k); hw[i] = h; }
    }
    g.setAttribute('handW', new T.BufferAttribute(hw, 1));
    // 구역별 평균 밝기 (선형) — 텍스처를 작게 그려 정점 UV 에서 읽는다
    const img = m.map && m.map.image, uv = g.attributes.uv;
    let tint = null;
    try {
      if (img && uv && typeof document !== 'undefined') {
        const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
        const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, S, S);
        const px = cx.getImageData(0, 0, S, S).data, lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
        const acc = [[0, 0], [0, 0]], flip = m.map.flipY;
        for (let i = 0; i < n; i += 3) {
          let u = uv.getX(i) % 1, v = uv.getY(i) % 1; if (u < 0) u++; if (v < 0) v++;
          const x = Math.min(S - 1, u * S | 0), y = Math.min(S - 1, (flip ? 1 - v : v) * S | 0), j = (y * S + x) * 4;
          const L = 0.2126 * lin(px[j]) + 0.7152 * lin(px[j + 1]) + 0.0722 * lin(px[j + 2]), z = hw[i] > 0.5 ? 0 : 1;
          acc[z][0] += L; acc[z][1]++;
        }
        tint = acc.map(([a, c]) => c ? Math.max(0.01, a / c) : 0.2);
      } else if (!img) {
        const c = m.color; tint = [Math.max(0.01, 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b), 0]; tint[1] = tint[0];
        m.map = null;
      }
    } catch (e) { tint = null; }
    if (tint && !img) m.color.setRGB(1, 1, 1);
    m.userData.armTint = tint;
    if (tint) { m.roughness = Math.max(m.roughness, 0.75); m.metalness = 0; }
  },
  // 휴식 자세의 총 정점(피벗 공간, 앞 = −Z)으로 총구·가늠쇠·가늠자·손잡이 자리를 잰다
  // 팩의 총 대신 다른 총 메시를 같은 손·같은 동작에 끼운다: 두 총의 가늠선·위 방향을 맞추고 가늠자 위치를 맞춘다
  installSwap(P, id, g) {
    const C = SWAP[id], root = g.scene;
    root.updateMatrixWorld(true);
    const pts = [];
    root.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false; o.castShadow = false;
      const m = o.material; if (m.metalness > 0.6 && !m.metalnessMap) m.metalness = 0.55; m.envMapIntensity = 0.6;
      const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 3000)), w = new V();
      for (let i = 0; i < pos.count; i += step) pts.push(w.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
    });
    const Sp = P.sight0, Ss = this.measure(P, pts, P.def.pistol, new V(0, 1, 0));
    const basis = S => { const back = S.axis.clone().negate(), right = new V().crossVectors(S.up, back); return new T.Matrix4().makeBasis(right, S.up, back); };
    const M = basis(Sp).multiply(basis(Ss).transpose());   // 바꿔 끼울 총 방향 → 팩 총 방향
    const anchor = Ss.R.clone().applyMatrix4(M);
    const t = Sp.R.clone().addScaledVector(Sp.axis, C.shift || 0).addScaledVector(Sp.up, C.lift || 0).sub(anchor);
    M.setPosition(t);
    // tilt(도): 앞손(앞쪽 손잡이) 자리를 축으로 총을 숙이거나(−) 든다(+) — 총마다 손잡이 높이가 팩 총과 달라 손이 뜰 때
    if (C.tilt) {
      const ax = new V().crossVectors(Sp.up, Sp.axis.clone().negate()).normalize(), pt = Sp.grip;
      const R = new T.Matrix4().makeRotationAxis(ax, C.tilt * D);
      M.premultiply(new T.Matrix4().makeTranslation(-pt.x, -pt.y, -pt.z)).premultiply(R).premultiply(new T.Matrix4().makeTranslation(pt.x, pt.y, pt.z));
    }
    // 부위마다 휴식 자세의 피벗 공간 변환 → 따라갈 뼈의 로컬로
    const groups = [];
    const kids = (root.children.length === 1 && !root.children[0].isMesh ? root.children[0].children : root.children).slice();
    for (const child of kids) {
      child.matrixWorld.decompose(child.position, child.quaternion, child.scale);   // 원래 부모 변환까지 굽는다 (root 는 원점)
      const kind = /^mag/i.test(child.name) && P.boneRest.mag ? 'mag' : /^slide/i.test(child.name) && P.boneRest.slide ? 'slide' : 'body';
      const bone = kind === 'body' ? P.gunBone : P.boneRest[kind].bone, inv = kind === 'body' ? P.gunRestInv : P.boneRest[kind].inv;
      const holder = new T.Group(); holder.add(child);
      new T.Matrix4().multiplyMatrices(inv, M).decompose(holder.position, holder.quaternion, holder.scale);
      holder.visible = false; bone.add(holder); groups.push(holder);
    }
    const sight = this.measure(P, pts.map(p => p.clone().applyMatrix4(M)), P.def.pistol, Sp.up);
    P.swaps[id] = { groups, sight, muzzleLocal: sight.muzzle.clone().applyMatrix4(P.gunRestInv) };
    if (P.gunId === id) { this.useGun(P, id); P.mountKey = null; }   // 이미 이 총을 들고 있으면 바로 바꿔 보인다
    console.info('[AssetVM] ' + id + ' 총 모델 → ' + P.key + ' 팩');
  },
  // 이번 총에 맞게 팩 총/바꿔 끼운 총을 보이고 조준 정보를 고른다
  useGun(P, id) {
    const sw = P.swaps[id];
    for (const k in P.swaps) for (const h of P.swaps[k].groups) h.visible = k === id;
    for (const m of P.gunMeshes) m.visible = !sw;
    // 지향 자세는 팩 총 기준 그대로 (팔 숨김 구역이 팩 총 자세로 계산돼 있다), 조준만 바꿔 낀 총의 가늠선으로
    P.sight = sw ? Object.assign({}, sw.sight, { qH: P.sight0.qH, posH: P.sight0.posH }) : P.sight0;
    P.muzzleLocal = sw ? sw.muzzleLocal : P.muzzle0;
  },
  measure(P, pv, pistol, upHint) {
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
    if (upHint ? u.dot(upHint) < 0 : hiP > hiN) u.negate();   // upHint: 바꿔 낀 총은 모델의 +Y 가 위 (손잡이가 길어 분포로 헷갈릴 때)
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
    // v56 지향 자세를 팩마다의 원래 카메라 대신 모든 총에 같은 규칙으로 잡는다 (화면을 덜 가리게, 콜옵처럼 오른쪽 아래)
    //  가늠선을 시선과 나란히 놓은 뒤(q) 조금 돌리고(총구가 화면 가운데 쪽), 가늠자(R)를 정해진 자리(H)에 둔다
    const HP = Object.assign({}, pistol ? HIP.pistol : HIP.rifle, P.def.hip);
    const qH = new Q().setFromEuler(new T.Euler(HP.pitch * D, HP.yaw * D, HP.roll * D)).multiply(q);
    const posH = new V(...HP.at).sub(R.clone().applyQuaternion(qH));
    // 가늠선 높이: 총을 시선과 나란히 돌렸을 때 가늠쇠보다 뒤쪽(덮개·레일·개머리)이 더 높으면 그 위로 본다
    let hTop = -Infinity;
    for (let i = 0; i < n; i++) if (f(i) > 0.25) hTop = Math.max(hTop, _v.copy(pv[i]).applyQuaternion(q).y);
    // 손잡이(앞손 아래)·레이저 자리
    let gh = Infinity, ga = 0, gn = 0, gs = -Infinity;
    for (let i = 0; i < n; i++) { const t = f(i); if (t > 0.25 && t < 0.42) { gh = Math.min(gh, A[i][1]); ga += A[i][0]; gn++; gs = Math.max(gs, _v.subVectors(pv[i], c).dot(right)); } }
    const grip = c.clone().addScaledVector(len, gn ? ga / gn : 0).addScaledVector(u, gn ? gh : 0);
    grip.addScaledVector(right, _v.subVectors(muzzle, grip).dot(right));
    const side = grip.clone().addScaledVector(right, (gn ? gs : 0.03) + 0.012).addScaledVector(up, 0.035);
    return { muzzle, F, R, axis, up, q, qInv: q.clone().invert(), grip, side, L, hTop, qH, posH, roll };
  },
  // 여러 클립을 가중치로 섞어 한 자세를 만든다 (모든 클립이 시간 t 를 따로 가진다)
  pose(P, list) {
    for (const k in P.acts) P.acts[k].action.enabled = false;
    for (const [k, t, w] of list) {
      const A = P.acts[k].action;
      A.enabled = true; A.play(); A.paused = true; A.time = clamp(t, 0, P.acts[k].dur - 1e-4); A.setEffectiveWeight(w);
    }
    P.mixer.update(0);
    if (P.def.ik && P.k) for (const ik of P.def.ik) this.armIK(P, ik);
    if (P.hands && Math.abs(P.handScale - 1) > 0.01) this.scaleHands(P, P.handScale);
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
    const name = this.reloadClip(P, empty), w = this.win(P, name), ev = P.def.ev[empty && P.def.ev.reloadEmpty ? 'reloadEmpty' : 'reload'];
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
    if (!P.active || P.gunId !== id) { P.drawT = 0; P.shotT = 99; P.gunId = id; P.mountKey = null; this.useGun(P, id); }
    P.pivot.visible = !s.hideVM; orig.root.visible = false;
    P.shotT += dt; P.drawT += dt;
    const R = s.reload, list = [];
    // fireFit: 볼트액션처럼 사격 동작(볼트 당기기 포함)을 게임의 다음 발 준비 시간에 맞춰 빠르게 돌린다
    const fireLen = FIRE_SPAN[id] || P.acts.fire.dur, fireSpd = C.fireFit ? fireLen / (G.WEAPONS[id].cycle || fireLen) : 1, drawLen = P.acts.draw ? P.acts.draw.dur : 0;
    let reload = false, draw = false;
    if (R && C.shell && R.type !== 'mag') {
      const S = C.shell; let t;
      if (R.phase === 'start') t = S.start[0] + R.pp * (S.start[1] - S.start[0]);
      else if (R.phase === 'load') { const w = this.lastShell(id, R) ? S.last : S.cycle; t = w[0] + clamp(R.shellP, 0, 1) * (w[1] - w[0]); }
      else t = S.end[0] + R.pp * (S.end[1] - S.end[0]);
      list.push(['reload', t, 1]); reload = true;
    } else if (R && (R.type === 'mag' || R.type === 'revolver')) {
      const name = this.reloadClip(P, R.empty), w = this.win(P, name);
      list.push([name, w[0] + clamp(R.p, 0, 1) * (w[1] - w[0]), 1]); reload = true;
    } else if (!C.pistol && P.shotT * fireSpd < fireLen + 0.15) {
      // 사격 → 끝나면 0.15 초 동안 대기 자세로 섞어 돌아간다
      const b = clamp((P.shotT * fireSpd - fireLen) / 0.15, 0, 1);
      list.push(['fire', Math.min(P.shotT * fireSpd, fireLen), 1 - b]);
      if (b > 0) list.push(['idle', 0, b]);
    } else if (drawLen && P.drawT < drawLen && (s.ads || 0) < 0.05) {
      list.push(['draw', P.drawT, 1]); draw = true;
    } else {
      P.idleT = ((P.idleT || 0) + dt) % P.acts.idle.dur;
      list.push(['idle', P.idleT, 1]);
    }
    if (s.ads > 0.05 || reload) P.drawT = 99;
    P.reloading = reload;
    this.pose(P, list);
    for (const b of P.spare) b.scale.setScalar(reload ? 1 : 1e-4);
    this.syncMount(P, id, s.scope);
    // ADS: 총의 가늠선을 시선과 나란히 돌리고, 가늠쇠(또는 조준경 중심)를 화면 가운데로
    const aim = reload ? 0 : clamp(s.ads || 0, 0, 1), weight = 1 - aim * 0.85, M = P.mount;
    const sprint = (vm.sprint || 0) * (!reload && !draw ? 1 : 0);
    // 흔들림·반동 기울기만 카메라 기준으로 돌린다 (전력질주 자세는 아래 sprintPose 에서 손잡이를 축으로)
    _e.set((vm.sway?.y || 0) * weight, (vm.sway?.x || 0) * weight, vm.kickRoll || 0);
    this.place(P, aim, _e);
    if (sprint > 0.001) this.sprintPose(P, sprint * sprint * (3 - 2 * sprint));
    // v56 장전할 때는 총을 화면 가운데 쪽으로 들어 올려 손동작이 보이게 (지향 자세가 오른쪽 아래라 그대로면 화면 밖에서 장전한다)
    P.rlB = (P.rlB || 0) + clamp((reload ? 1 : 0) - (P.rlB || 0), -dt * 5, dt * 5);
    if (P.rlB > 0) this.reloadLift(P, P.rlB * P.rlB * (3 - 2 * P.rlB));
    P.pivot.position.x += (vm.sway?.x || 0) * 0.2 * weight + Math.sin((vm.t || 0) * 0.8) * 0.001 * weight;
    P.pivot.position.y += Math.sin(s.phase || 0) * 0.006 * (s.moving || 0) * weight - (s.landDip || 0) * 0.05;
    if (!draw) P.pivot.position.y -= (1 - (s.raise ?? 1)) * 0.22;
    P.pivot.position.z += vm.kick * (C.pistol ? 0.006 : 0.02);
    if (C.pistol && !reload) this.pistolKick(P, P.shotT, aim);
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
  // v56 권총 반동: 팩의 사격 클립(총이 크게 뒤집힌다) 대신 손목을 축으로 짧게 튀었다가 스프링처럼 돌아온다 + 슬라이드 후퇴
  pistolKick(P, t, aim) {
    if (t > 0.6) { const S = P.slideKick; if (S && S.last) { S.bone.position.addScaledVector(S.d, -S.last); S.last = 0; } return; }
    const K = Object.assign({}, PISTOL_KICK, P.def.kick);
    const up = t < K.rise ? t / K.rise : Math.exp(-(t - K.rise) * K.ret) * Math.cos((t - K.rise) * K.wob);
    const w = 1 - aim * 0.45, ang = K.pitch * D * up * w;
    // 손목(손잡이) 자리를 축으로 돌린다
    const g = P.sight.grip.clone().applyQuaternion(P.pivot.quaternion).add(P.pivot.position);
    _q.setFromEuler(new T.Euler(ang, 0, K.roll * D * up * w * (P.kickSide || 1)));
    P.pivot.quaternion.premultiply(_q);
    P.pivot.position.sub(g).applyQuaternion(_q).add(g);
    P.pivot.position.z += K.back * Math.max(0, up) * w; P.pivot.position.y += K.lift * Math.max(0, up) * w;
    // 슬라이드: 0.02 초에 끝까지 물러났다가 0.06 초에 돌아온다
    const S = P.slideKick;
    if (S) { const e = t < 0.02 ? t / 0.02 : Math.max(0, 1 - (t - 0.02) / 0.06); S.bone.position.addScaledVector(S.d, S.anim ? e : e - S.last); S.last = S.anim ? 0 : e; }
  },
  // 손 뼈(손가락 사슬의 뿌리)를 주먹 가운데(손가락 뼈 평균)를 축으로 s 배 — 총을 쥔 자리는 그대로, 손만 작아진다
  scaleHands(P, s) {
    // 아래팔도 굵기만 같이 (뼈 길이 방향 = 로컬 Y 는 그대로 두어 손목이 떨어지지 않게)
    for (const t of P.thin || (P.thin = (P.def.thin || []).map(n => P.find(n)).filter(Boolean).map(b => ({ b, s0: b.scale.clone() })))) t.b.scale.set(t.s0.x * s, t.s0.y, t.s0.z * s);
    P.model.updateMatrixWorld(true);
    for (const h of P.hands) {
      const b = h.bone;
      if (!h.anim) b.position.copy(h.p0);
      if (!h.animS) b.scale.copy(h.s0);
      b.updateMatrixWorld(true);
      const c = new V(), w = new V(); let n = 0;
      b.traverse(x => { if (x !== b && x.isBone) { c.add(x.getWorldPosition(w)); n++; } });
      if (!n) continue;
      c.multiplyScalar(1 / n);
      const hw = b.getWorldPosition(new V());
      b.scale.multiplyScalar(s);
      b.position.copy(b.parent.worldToLocal(c.clone().add(hw.sub(c).multiplyScalar(s))));
      b.updateMatrixWorld(true);
    }
  },
  // v58 두 뼈 IK: 손(손목)은 그대로 두고 어깨를 옮긴 뒤 팔꿈치를 pole 쪽으로 굽힌다 (팩의 팔 자세가 화면에서 어색할 때)
  //  ik: { bones: [위팔, 아래팔, 손], drop: [x, y, z] 어깨 이동(m, 모델 좌표), pole: [x, y, z] 팔꿈치가 향할 쪽(모델 좌표) }
  armIK(P, ik) {
    const f = P.find, B = ik._b || (ik._b = ik.bones.map(n => f(n)));
    if (B.some(b => !b)) return;
    const [U, F, H] = B, M = P.model;
    // 위팔 위치가 클립에 없으면 지난 프레임에 옮긴 만큼이 남아 있다 → 처음 자리로 되돌린 뒤 계산
    if (ik._anim === undefined) { ik._anim = Object.values(P.acts).some(x => x.action.getClip().tracks.some(tr => tr.name === U.name + '.position')); ik._p0 = U.position.clone(); }
    if (!ik._anim) U.position.copy(ik._p0);
    M.updateMatrixWorld(true);
    const L = b => M.worldToLocal(b.getWorldPosition(new V()));
    const S0 = L(U), E0 = L(F), W = L(H), hq = H.getWorldQuaternion(new Q());
    const a = S0.distanceTo(E0), b = E0.distanceTo(W);
    const S = S0.clone().add(_v.set(...ik.drop).multiplyScalar(1 / P.k));
    const dv = W.clone().sub(S), d = Math.min(dv.length(), (a + b) * 0.999), u = dv.normalize();
    const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    const pole = new V(...ik.pole); pole.addScaledVector(u, -pole.dot(u)).normalize();
    const E = S.clone().addScaledVector(u, x).addScaledVector(pole, h);
    const toW = p => M.localToWorld(p.clone());
    // 어깨 옮기기
    U.position.copy(U.parent.worldToLocal(toW(S)));
    const aim = (bone, from, to, child) => {
      bone.updateMatrixWorld(true);
      const cur = child.getWorldPosition(new V()).sub(from), want = to.clone().sub(from);
      const dq = new Q().setFromUnitVectors(cur.normalize(), want.normalize());
      const wq = bone.getWorldQuaternion(new Q()), pq = bone.parent.getWorldQuaternion(new Q());
      bone.quaternion.copy(pq.invert().multiply(dq.multiply(wq)));
      bone.updateMatrixWorld(true);
    };
    aim(U, toW(S), toW(E), F);
    aim(F, toW(E), toW(W), H);
    H.quaternion.copy(H.parent.getWorldQuaternion(new Q()).invert().multiply(hq));
    H.updateMatrixWorld(true);
  },
  // v57 전력질주: 총을 가늠자(총몸 뒤쪽, 오른손 가까이) 축으로 총구가 왼쪽 아래를 향하게 돌리고 조금 내린다 (이전: 카메라 축으로 돌려 총이 화면 옆으로 날아갔다)
  sprintPose(P, b) {
    const SP = Object.assign({}, P.def.pistol ? SPRINT.pistol : SPRINT.rifle, P.def.sprint);
    const g = P.sight.R.clone().applyQuaternion(P.pivot.quaternion).add(P.pivot.position);
    _q.setFromEuler(new T.Euler(SP.pitch * D * b, SP.yaw * D * b, SP.roll * D * b, 'YXZ'));
    P.pivot.quaternion.premultiply(_q);
    P.pivot.position.sub(g).applyQuaternion(_q).add(g);
    P.pivot.position.x += SP.at[0] * b; P.pivot.position.y += SP.at[1] * b; P.pivot.position.z += SP.at[2] * b;
  },
  reloadLift(P, b) {
    const RL = Object.assign({}, RELOAD_LIFT, P.def.reloadLift);
    P.pivot.position.x += RL.at[0] * b; P.pivot.position.y += RL.at[1] * b; P.pivot.position.z += RL.at[2] * b;
    P.pivot.quaternion.premultiply(_q.setFromEuler(new T.Euler(RL.pitch * D * b, RL.yaw * D * b, RL.roll * D * b)));
  },
  // 지향(캔트만 바로 세움) ↔ 조준(가늠선 정렬) 사이를 섞는다. eul: 흔들림·전력질주 회전
  place(P, aim, eul) {
    const S = P.sight, M = P.mount;
    // 잘린 소매 끝 숨기기 (장전 동작에서는 팔 전체가 보여야 한다)
    // 2 = 화면 밖·총에서 먼 정점(늘 숨김), 1 = 위팔 뼈 정점 (cutReloadOnly 팩은 장전 중에만 숨김)
    if (P.armCut) P.armCut.value = P.def.cutReloadOnly && !P.reloading ? 1.5 : 0.5;
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
    t.set(-Fq.x, -Math.max(Fq.y, S.hTop) - 0.004 - (P.def.adsLift || 0), -(SWAP[id]?.adsDist || P.def.adsDist || (pistol ? 0.3 : 0.27)) - Rq.z);
    // 팔·총을 앞으로 너무 많이 밀면 원래 화면 밖이던 팔(소매 끝)이 들어온다 → 앞으로는 최대 7 cm 만
    t.z = Math.max(t.z, -(SWAP[id]?.adsFwd ?? P.def.adsFwd ?? 0.07));
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
        eye = A.eyeOf(optic, eye, scope === 'x8' ? 1.35 : scope === 'x4' ? 1.05 : 1);   // v59 실사 조준경은 모델에 적힌 조준선 높이
        const holder = new T.Group(); holder.add(optic);
        if (scope === 'reddot' || scope === 'holo') {
          optic.traverse(x => { if (x.isMesh && /glass|blue/i.test(x.material?.name || '')) { x.material = x.material.clone(); P.mountDispose.push(x.material); x.material.transparent = true; x.material.opacity = 0.15; x.material.depthWrite = false; } });
          const dot = new T.Mesh(new T.CircleGeometry(0.0009, 16), new T.MeshBasicMaterial({ color: 0xff2415, depthTest: false }));
          dot.position.set(0, eye, 0.03); dot.renderOrder = 10; holder.add(dot); P.mountDispose.push(dot.geometry, dot.material);
        }
        // 가늠자 바로 앞, 조금 낮춰 레일·덮개 위에 얹는다
        // v59 긴 배율 조준경은 접안렌즈(뒤 끝)가 가늠자 근처에 오도록 반 길이만큼 앞으로 (화면을 덮지 않게)
        const half = (box.max.z - box.min.z) / 2, push = ['x2', 'x4', 'x8'].includes(scope) ? Math.max(0, half - 0.045) : 0;
        const base = S.R.clone().add(_v.set(0, (pistol ? -0.003 : -0.006) - (push ? P.def.scopeDrop || 0 : 0), 0)).addScaledVector(fwd, (pistol ? 0.012 : 0.03) + push);
        this.onBone(P, holder, base, S.qInv);
        const O = base.clone().add(new V(0, eye, 0).applyQuaternion(S.qInv)).applyQuaternion(q);
        t.set(-O.x, -O.y, -(ADS_DIST[scope] || 0.3) - O.z);
      }
    }
    if (A && cls !== 'shotgun') {
      const at = S.muzzle.clone().addScaledVector(fwd, 0.01);
      if (parts.muzzle === 'suppressor') { const o = A.make('suppressor', 1); if (o) this.onBone(P, o, at, S.qInv); }
      else if ((parts.muzzle === 'compensator' || parts.muzzle === 'flash') && A.models.brake) {
        const o = A.make('brake', 1); if (parts.muzzle === 'flash') o.scale.z *= 0.75; this.onBone(P, o, at, S.qInv);
      } else if (parts.muzzle) {
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
