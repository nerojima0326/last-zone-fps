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
const _pose = new T.Matrix4(), _poseRot = new T.Matrix4(), _aimQ = new Q(), _aimT = new V();

// 팩 설정 — 시간은 원본 클립의 초 단위
//  eye: 카메라 뼈 이름(또는 모델 좌표), off: 눈 위치 보정, pitch/yaw: 카메라를 숙이고 돌리는 각(도)
//  gun: 총 몸통 뼈, len: 실제 총 길이(m, 크기 맞춤), win: 클립에서 쓸 구간, ev: 장전 소리 시각
//  spare: 장전 중에만 보이는 예비 탄창 뼈 (평소엔 0 크기로 접는다)
//  iron: 실제 가늠쇠 끝(F)·가늠자 홈/구멍 중심(R), 총 뼈의 원본 좌표·단위
const PACKS = {
  ak74: {
    iron: { F: [0, 0.593655, -0.070780], R: [0, 0.126403, -0.071075], up: [0, 0, -1] },
    aimTop: true, file: 'ak74', cutBones: /^UpArm_[LR]/, magBone: 'Pmag', eye: 'Head_Cam', off: [0.08, 0.05, 0.15], pitch: 12, gun: 'PBody', len: 0.94, spare: ['Pmag2'],
    clips: { idle: 'Rig|AK_Idle', fire: 'Rig|AK_Shot', reload: 'Rig|AK_Reload', reloadEmpty: 'Rig|AK_Reload_full', draw: 'Rig|AK_Draw' },
    // AK 식: 새 탄창으로 헌 탄창을 쳐내고 → 끼우고 → (빈 총) 장전손잡이 당기기
    ev: { reload: [[1.2, 'magout'], [1.9, 'magin']], reloadEmpty: [[1.2, 'magout'], [1.9, 'magin'], [2.47, 'open'], [2.62, 'close']] }
  },
  saiga: {
    iron: { F: [0, 0.450680, 0.481049], R: [0, 0.293365, 0.108033], up: [0, 1, 0] },
    aimTop: true, file: 'saiga', handScale: 0.88, cutBones: /^UpArm_[LR]/, magBone: 'Pmag', eye: 'Head_Cam', off: [0.02, 0.0, 0.04], pitch: 4, gun: 'Saiga', len: 1.0,
    clips: { idle: 'Armature|Saiga_Idle', fire: 'Armature|Saiga_Fire', reload: 'Armature|Saiga_Reload_Fast', reloadEmpty: 'Armature|Saiga_Reload_Full' },
    win: { reload: [0, 1.88] },
    ev: { reload: [[0.7, 'magout'], [1.13, 'magin']], reloadEmpty: [[0.63, 'magout'], [1.07, 'magin'], [1.83, 'open'], [1.97, 'close']] }
  },
  acr: {
    file: 'acr', cutBones: /^UpArm_[LR]/, cutReloadOnly: true, magBone: 'Pmag', eye: 'Head_Cam', off: [0.01, 0.0, 0.02], pitch: 3, gun: 'ACRRifle', len: 0.9, adsDist: 0.33,
    clips: { idle: 'Armature|Arms_FPS_Anim_Idle', fire: 'Armature|Arms_FPS_Anim_Shoot', reload: 'Armature|Arms_FPS_Anim_Reload_Fast', draw: 'Armature|Arms_FPS_Anim_Draw' },
    win: { reload: [0, 1.55] },
    ev: { reload: [[0.47, 'magout'], [0.77, 'magin']], reloadEmpty: [[0.47, 'magout'], [0.77, 'magin'], [1.2, 'close']] }
  },
  remington: {
    file: 'remington', cutBones: /^UpArm_[LR]/, cutReloadOnly: true, eye: 'Head_Cam', off: [0.06, 0.04, -0.08], pitch: 8, gun: 'Body', len: 1.0, adsDist: 0.5, adsFwd: 0.16, reloadLift: { at: [0.01, -0.01, -0.11], pitch: 0, roll: 6 },
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
    iron: { F: [-0.003706, 0.029725, 0.079205], R: [-0.003706, 0.029376, -0.065794], up: [0, 1, 0] },
    file: 'p9mm', magBone: 'Magazine', slideBone: 'Slidder', eye: [0.0, 1.44, 0.08], pitch: 10, yaw: -2, gun: 'Weapon', len: 0.19, pistol: true, hip: { at: [0.11, -0.1, -0.37], yaw: 13, pitch: 4 }, spare: ['Magazine_2', 'Bullet_2'],
    clips: { idle: 'Idle', fire: 'Fire', reload: 'Reload', reloadEmpty: 'Reload_Empty', draw: 'Equip' },
    win: { reload: [0, 2.6], reloadEmpty: [0, 3.6] },
    ev: { reload: [[0.43, 'magout'], [1.43, 'magin']], reloadEmpty: [[0.43, 'magout'], [1.43, 'magin'], [2.9, 'close']] }
  },
  // v56 DJMaesen 팩: 클립 하나(allanims)에 모든 동작이 이어져 있어 cut 구간으로 나눈다. 총은 뼈가 아닌 노드(스킨 없는 메시)
  sniper: {
    file: 'sniper', magBone: 'clip', eye: [8, 12, -42], pitch: 4, gun: 'sniper', len: 1.12, scopeDrop: 0.03,   // 배율 조준경 마운트를 레일까지 내림
    // v63 Kar98k 볼트: 사격 뒤 볼트 조작·한 발씩 장전·클립 장전을 모두 오른팔 IK 로 만든다 (팔·왼손은 대기 자세)
    boltLoad: { arm: ['R_arm', 'R_elbow', 'R_wrist'], palm: 'R_middle2' },
    // 볼트를 열면 손잡이가 눈앞 10 cm 까지 온다 → 장전할 때는 총을 앞으로 밀고 오른쪽으로 눕혀 배출구가 화면 가운데에 보이게
    reloadLift: { at: [-0.09, 0.0, -0.21], pitch: 7, yaw: 6, roll: 22 },
    cutBones: /^[LR]_arm_\d+$/, adsDist: 0.42, src: 'allanims', fireFit: true,
    cut: { idle: [0, 0.05], fire: [0.02, 1.5], reload: [1.5, 3.75] },
    clips: {},
    ev: { reload: [[1.75, 'magout'], [2.55, 'magin'], [3.2, 'open'], [3.45, 'close']] }
  },
  revolver: {
    iron: { F: [0, 11.37123, 35.61014], R: [0, 11.39594, 5.6], up: [0, 1, 0] },
    aimTop: true, file: 'revolver', eye: [6, 9, -40], pitch: 6, gun: 'revolver', len: 0.36, adsDist: 0.44, pistol: true, ik: [{ bones: ['R_arm', 'R_elbow', 'R_wrist'], drop: [-0.03, -0.14, 0.12], pole: [-0.5, -1, 0] }], cutBones: /^[LR]_arm_\d+$/, hip: { at: [0.095, -0.13, -0.47], yaw: 6 }, src: 'allanims',
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
//  iron: GLB 모델 좌표(m)의 실제 조준기 위치. 손에 끼우는 기준과 따로 보정한다.
const SWAP = {
  sc17: { file: 'assets/models/viewmodels/swap/sc17.glb', shift: -0.04, lift: -0.015,
    iron: { F: [0.004914, 0.139703, -0.295], R: [0.004914, 0.1328, 0.1642] } },
  m1014: { file: 'assets/models/viewmodels/swap/m1014.glb', shift: -0.05, lift: 0.015, tilt: -7,
    iron: { F: [-0.00937, 0.089265, -0.4601], R: [-0.00937, 0.0916, 0.1441] } },
  m1911: { file: 'assets/models/viewmodels/swap/m1911.glb', lift: -0.022,
    iron: { F: [0.000564, 0.067375, -0.095], R: [0.000564, 0.069093, 0.063282] } },
  de7: { file: 'assets/models/viewmodels/swap/de7.glb', lift: -0.022,
    iron: { F: [0, 0.07683, -0.1266], R: [0, 0.07669, 0.084] } },
  aa12: { file: 'assets/models/viewmodels/swap/aa12.glb', shift: -0.07, adsFwd: 0.3,
    iron: { F: [0, 0.123669, -0.233144], R: [0, 0.1103, 0.281] } },
  // v70 MK-14: 앞·뒤 고리 가늠쇠/가늠자의 가운데를 조준선으로 (정점 분포로 잡으면 총이 위로 들려 보였다), 조준경은 레일 위
  mk14: { file: 'assets/models/guns/mk14.glb', shift: -0.01, sight: { R: [-0.0007, 0.1325, 0.0345], F: [-0.0007, 0.1325, -0.528], mount: [-0.0007, 0.0886, -0.1] }, fold: { y: 0.09 } },                     // 게임 자체 MK-14 모델 on ACR 팩
  kr98: { file: 'assets/models/viewmodels/swap/kr98.glb', kar: true, sight: { R: [0, 0.0175, -0.216], F: [0.0005, 0.019, -0.6985], mount: [0, 0.017, -0.09] } }   // mount: 조준경은 가늠자(총열 위) 말고 기관부 위에               // v63 Kar98k (Kvark025) on 저격 팩 — 볼트·손잡이·탄 노드를 따로 움직인다
};
// v56 지향 자세: at = 가늠자 자리(카메라 공간 m, 오른쪽 +x · 위 +y · 앞 −z), yaw/pitch/roll(도) = 총구를 가운데로 · 살짝 위로 · 윗면을 안쪽으로
// v56 모든 팩 공통 팔 색 (선형 RGB): 검은 전술 장갑 · 레인저 그린 소매
const ARM_LOOK = { glove: [0.032, 0.032, 0.034], sleeve: [0.075, 0.08, 0.06] };
const HIP = {
  rifle: { at: [0.105, -0.095, -0.3], yaw: 4.5, pitch: 1.5, roll: 0 },
  pistol: { at: [0.085, -0.095, -0.34], yaw: 3, pitch: 2, roll: 0 }
};
// v56 장전 중 들어 올리기 (m, 도)
// v57 전력질주 자세 (도, m): pitch − = 총구 아래, yaw + = 총구 왼쪽(가운데), roll + = 윗면 왼쪽
const SPRINT = {
  rifle: { pitch: -7, yaw: 3, roll: 16, at: [0.0, -0.015, 0.01] },
  pistol: { pitch: -8, yaw: 0, roll: 8, at: [0.0, -0.02, 0.01] }
};
const RELOAD_LIFT = { at: [-0.025, 0.04, -0.03], pitch: 4, yaw: 0, roll: 7 };
const ADS_DIST = { reddot: 0.32, holo: 0.3, x2: 0.25, x4: 0.22, x8: 0.2 };

const AV = G.AssetVM = {
  packs: {}, GUNS, PACKS, SWAP,
  pack(id) {
    const P = this.packs[GUNS[id]];
    if (!P?.ready || (SWAP[id] && !P.swaps[id] && !P.swapFailed?.[id])) return null;
    if (P.prepared && !P.prepared.has(id)) return null;
    // A downloaded pack must not change reload durations halfway through a
    // reload, or snap the sight while the player is aiming.
    P.activated ||= new Set();
    if (!P.activated.has(id)) {
      if (G.VM.cur === id && (G.Player.reload || G.Player.ads > 0.15 || G.PoseRecovery?.active)) return null;
      P.activated.add(id);
    }
    return P;
  },
  owns(id) { return !!this.pack(id); },
  init() {
    if (location.protocol === 'file:' || !T.GLTFLoader || !G.VM) return;
    const vm = G.VM, update = vm.update, fire = vm.fireKick, muzzle = vm.muzzleWorld, set = vm.set;
    vm.update = function (dt, s) { update.call(this, dt, s); AV.update(dt, s, this); };
    vm.set = function (id) { const changed = this.cur !== id; set.call(this, id); if (changed) AV.request(id); for (const k in AV.packs) { const P = AV.packs[k]; if (P.pivot && GUNS[id] !== k) { P.pivot.visible = false; P.active = false; } } };
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
    this.initialized = true;
  },
  // Only equipped/requested packs are fetched. Shared packs and swaps each
  // have one in-flight promise; visiting the catalogue doesn't fetch all arms.
  async request(id) {
    const key = GUNS[id];
    if (!key || !this.initialized) return;
    let P = this.packs[key];
    if (!P) {
      P = this.packs[key] = { key, ready: false, swapPending: {}, swapFailed: {}, prepared: new Set(), preparePending: {} };
      P.pending = (async () => {
        const gl = new T.GLTFLoader();
        if (T.MeshoptDecoder) gl.setMeshoptDecoder(T.MeshoptDecoder);
        try {
          const v = '?v=' + (window.LZ_BUILD || '');
          this.install(P, await G.loadGLB(gl, 'assets/models/viewmodels/' + PACKS[key].file + '.glb' + v));
        } catch (e) { P.failed = true; console.warn('[AssetVM] ' + key + ' 팩 실패', e); }
      })();
    }
    await P.pending;
    if (P.failed) return;
    if (!SWAP[id]) { await this.prepare(P,id); return; }
    if (!P.swapPending[id]) P.swapPending[id] = (async () => {
      const gl = new T.GLTFLoader();
      if (T.MeshoptDecoder) gl.setMeshoptDecoder(T.MeshoptDecoder);
      try { this.installSwap(P, id, await G.loadGLB(gl, SWAP[id].file + '?v=' + (window.LZ_BUILD || ''))); }
      catch (e) { P.swapFailed[id] = true; console.warn('[AssetVM] ' + id + ' 총 모델 실패 — 팩 총을 쓴다', e); }
    })();
    await P.swapPending[id];
    await this.prepare(P,id);
  },
  prepare(P,id) {
    if (!P.preparePending[id]) P.preparePending[id] = Promise.resolve(G.RenderPrep?.prepare(P.pivot)).then(() => P.prepared.add(id)).catch(e => { console.info('[AssetVM] 총기 준비 실패 · 기본 모델 유지',id,e.message); });
    return P.preparePending[id];
  },
  // Explicit preloading is useful for offline validation. Normal play only
  // requests the player's inventory, leaving unused animation packs unloaded.
  async loadAll() { for (const id in GUNS) await this.request(id); },
  install(P, g) {
    const C = PACKS[P.key], model = g.scene, clips = {};
    G.WeaponFinish?.root(model);
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
      for (const m of [].concat(o.material)) this.armShader(m, P.armCut);
    }
    P.gunRest = new T.Matrix4().copy(pivot.matrixWorld).invert().multiply(gunBone.matrixWorld);
    P.gunRestInv = P.gunRest.clone().invert();
    if (P.hands && Math.abs(P.handScale - 1) > .01) this.scaleHands(P, P.handScale);
    G.HandContact?.bind(model, G.HandContact.frame(gunBone, P.gunRest, P.sight0.qInv));
    if (C.iron) this.calibrateIron(P.sight, C.iron, P.gunRest);
    P.muzzleLocal = P.muzzle0 = P.sight.muzzle.clone().applyMatrix4(P.gunRestInv);
    // 탄창·슬라이드 뼈의 휴식 자세 (바꿔 끼운 총의 탄창·슬라이드가 따라 움직이게)
    P.boneRest = {};
    for (const [k, nm] of [['mag', C.magBone], ['slide', C.slideBone]]) {
      const b = nm && find(nm);
      if (b) P.boneRest[k] = { bone: b, inv: new T.Matrix4().copy(pivot.matrixWorld).invert().multiply(b.matrixWorld).invert() };
    }
    P.magazineContact = G.HandContact?.magazine(model, P.boneRest.mag?.bone, P.gunMeshes);
    // 권총 슬라이드 후퇴 방향 (슬라이드 뼈 부모 좌표, 2.2 cm)
    if (C.pistol && P.boneRest.slide) {
      // 피벗이 아직 원점(단위 변환)이라 월드 = 피벗 공간 (m)
      const b = P.boneRest.slide.bone, wp = b.getWorldPosition(new V()), back = P.sight.axis.clone().negate().multiplyScalar(0.022);
      const p0 = b.parent.worldToLocal(wp.clone()), p1 = b.parent.worldToLocal(wp.clone().add(back));
      P.slideKick = { bone: b, d: p1.sub(p0), p0: b.position.clone() };
    }
    P.mount = null;
    G.VM.root.add(pivot);
    P.ready = true;
    console.info('[AssetVM] ' + P.key + ' 준비 (크기 ×' + k.toFixed(3) + (P.kInfo ? ' 총 ' + P.kInfo[0].toFixed(4) + ' 팔 ' + P.kInfo[1].toFixed(4) : '') + ')');
  },
  // v56 팔 메시마다 정점의 '손(장갑) 비율' handW 와 구역별 텍스처 평균 밝기를 구한다 → 셰이더에서 같은 색으로 칠한다
  unifyArm(o) {
    const g = o.geometry, n = g.attributes.position.count, hw = new Float32Array(n);
    // 재질이 여럿(손 + 장갑)인 메시도 다룬다: 재질마다 그 그룹의 정점 목록
    const multi = Array.isArray(o.material);
    const mats = (multi ? o.material : [o.material]).map(m0 => m0.clone());
    o.material = multi ? mats : mats[0];
    const vertsOf = mi => {
      if (!multi) return null;
      const out = new Set(), idx = g.index;
      for (const gr of g.groups) if (gr.materialIndex === mi) for (let i = gr.start; i < gr.start + gr.count; i++) out.add(idx ? idx.getX(i) : i);
      return out;
    };
    const nameAll = mats.map(m => m.name || '').join(' ') + ' ' + o.name;
    if (o.isSkinnedMesh && !/uniform|sleeve/i.test(nameAll) && !(!multi && /glove/i.test(nameAll))) {
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
    // 장갑 재질의 정점은 모두 손
    mats.forEach((m, mi) => { if (!/glove/i.test((m.name || '') + (multi ? '' : ' ' + o.name))) return; const vs = vertsOf(mi); if (!vs) hw.fill(1); else for (const i of vs) hw[i] = 1; });
    g.setAttribute('handW', new T.BufferAttribute(hw, 1));
    mats.forEach((m, mi) => this.armTint(m, g, hw, vertsOf(mi)));
  },
  // 재질 하나의 구역별(손·소매) 평균 밝기 (선형) — 텍스처를 작게 그려 정점 UV 에서 읽는다
  armTint(m, g, hw, verts) {
    // 숨긴 어깨 쪽 정점 경계(소매 끝)가 화면에 들어와도 빈 구멍 대신 소매 안쪽이 보이게 양면으로
    m.side = T.DoubleSide;
    const n = g.attributes.position.count, img = m.map && m.map.image, uv = g.attributes.uv;
    let tint = null;
    try {
      if (img && uv && typeof document !== 'undefined') {
        let S = 128, px;
        if (img.data && img.width) {
          // TGA 등 DataTexture: 픽셀 배열에서 128×128 로 건너뛰며 읽는다 (RGBA 또는 RGB)
          const W = img.width, H = img.height, ch = img.data.length / (W * H) | 0; px = new Uint8ClampedArray(S * S * 4);
          for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const j = ((y * H / S | 0) * W + (x * W / S | 0)) * ch; for (let c = 0; c < 3; c++) px[(y * S + x) * 4 + c] = img.data[j + c]; }
          // DataTexture 는 flipY 를 하지 않는다 → 아래 flip 계산이 맞게 행 순서를 맞춘다
          if (!m.map.flipY) { const t = new Uint8ClampedArray(px); for (let y = 0; y < S; y++) px.set(t.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4); }
        } else {
          const cv = document.createElement('canvas'); cv.width = cv.height = S;
          const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, S, S);
          px = cx.getImageData(0, 0, S, S).data;
        }
        const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
        const acc = [[0, 0], [0, 0]], flip = m.map.flipY;
        const each = f => { if (verts) { let k = 0; for (const i of verts) if (k++ % 3 === 0) f(i); } else for (let i = 0; i < n; i += 3) f(i); };
        each(i => {
          let u = uv.getX(i) % 1, v = uv.getY(i) % 1; if (u < 0) u++; if (v < 0) v++;
          const x = Math.min(S - 1, u * S | 0), y = Math.min(S - 1, (flip ? 1 - v : v) * S | 0), j = (y * S + x) * 4;
          const L = 0.2126 * lin(px[j]) + 0.7152 * lin(px[j + 1]) + 0.0722 * lin(px[j + 2]), z = hw[i] > 0.5 ? 0 : 1;
          acc[z][0] += L; acc[z][1]++;
        });
        tint = acc.map(([a, c]) => c ? Math.max(0.01, a / c) : 0.2);
      } else if (!m.map) {
        const c = m.color; tint = [Math.max(0.01, 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b), 0]; tint[1] = tint[0];
      }
    } catch (e) { tint = null; }
    if (tint && !m.map) m.color.setRGB(1, 1, 1);
    m.userData.armTint = tint;
    if (tint) { m.roughness = Math.max(m.roughness, 0.75); m.metalness = 0; m.envMapIntensity = Math.min(m.envMapIntensity ?? 1, 0.45); if (m.emissive) { m.emissive.setRGB(0, 0, 0); m.emissiveMap = null; } }   // v60 9mm 팩 장갑의 흰 발광 줄무늬 끄기
  },
  // 휴식 자세의 총 정점(피벗 공간, 앞 = −Z)으로 총구·가늠쇠·가늠자·손잡이 자리를 잰다
  // 팩의 총 대신 다른 총 메시를 같은 손·같은 동작에 끼운다: 두 총의 가늠선·위 방향을 맞추고 가늠자 위치를 맞춘다
  installSwap(P, id, g) {
    G.WeaponFinish?.root(g.scene);
    const C = SWAP[id], root = g.scene;
    root.updateMatrixWorld(true);
    const pts = [];
    // v63 Kar98k: 움직이는 부품을 옮기기 전에 잡아 둔다 (팩 볼트 노드도 — 같은 이름 'bolt' 가 뒤에 생긴다)
    const kar = C.kar ? { bolt: root.getObjectByName('bolt'), handle: root.getObjectByName('handle'), tmpl: root.getObjectByName('round'), rounds: [0, 1, 2, 3].map(i => root.getObjectByName('round' + i)).filter(Boolean) } : null;
    root.traverse(o => {
      if (!o.isMesh) return;
      if (kar && /^round/.test(o.name)) { o.frustumCulled = false; return; }   // 탄은 총 크기 재기에서 뺀다
      o.frustumCulled = false; o.castShadow = false;
      const m = o.material; if (m.metalness > 0.6 && !m.metalnessMap) m.metalness = 0.55; m.envMapIntensity = 0.6;
      const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 3000)), w = new V();
      for (let i = 0; i < pos.count; i += step) pts.push(w.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
    });
    // v70 fold: 높이 y(모델 좌표) 위로 솟은 가늠자·가늠쇠 삼각형을 따로 떼어, 조준경을 달면 숨긴다 (조준경 시야를 막지 않게)
    const foldParts = [];
    if (C.fold) {
      const meshes = []; root.traverse(o => { if (o.isMesh && !(kar && /^round/.test(o.name))) meshes.push(o); });
      for (const o of meshes) {
        const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, pos = src.attributes.position, up = [], rest = [], w = new V();
        for (let i = 0; i < pos.count; i += 3) {
          let lo = Infinity;
          for (let j = 0; j < 3; j++) lo = Math.min(lo, w.fromBufferAttribute(pos, i + j).applyMatrix4(o.matrixWorld).y);
          (lo > C.fold.y ? up : rest).push(i, i + 1, i + 2);
        }
        if (!up.length) continue;
        const sub = ids => { const g = new T.BufferGeometry(); for (const [k, a] of Object.entries(src.attributes)) { const out = new a.array.constructor(ids.length * a.itemSize); for (let i = 0; i < ids.length; i++) for (let j = 0; j < a.itemSize; j++) out[i * a.itemSize + j] = a.array[ids[i] * a.itemSize + j]; g.setAttribute(k, new T.BufferAttribute(out, a.itemSize, a.normalized)); } g.computeBoundingSphere(); return g; };
        const part = o.clone(false); part.name = o.name + '_sight'; part.geometry = sub(up); o.geometry = sub(rest);
        o.parent.add(part); foldParts.push(part);
      }
      root.updateMatrixWorld(true);
    }
    // sight: 가늠자 홈·가늠쇠 끝을 모델 좌표로 직접 (정점 분포로 찾으면 볼트·안전장치 위로 조준선이 잡힌다)
    const fix = C.sight ? { R: new V(...C.sight.R), F: new V(...C.sight.F), mount: C.sight.mount && new V(...C.sight.mount), noTop: true } : null;
    const Sp = P.sight0, Ss = this.measure(P, pts, P.def.pistol, new V(0, 1, 0), fix);
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
    const sight = this.measure(P, pts.map(p => p.clone().applyMatrix4(M)), P.def.pistol, Sp.up, fix && { R: fix.R.clone().applyMatrix4(M), F: fix.F.clone().applyMatrix4(M), mount: fix.mount?.clone().applyMatrix4(M), noTop: true });
    if (C.iron) this.calibrateIron(sight, C.iron, M);
    P.swaps[id] = { groups, sight, foldParts, muzzleLocal: sight.muzzle.clone().applyMatrix4(P.gunRestInv) };
    P.swaps[id].magazineContact = G.HandContact?.swappedMagazine(P.magazineContact, groups);
    if (kar && kar.bolt && kar.handle) this.karSetup(P.swaps[id], kar);
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
  // Pack anchors use gun-bone coordinates; swap anchors use GLB coordinates.
  // Keep the fitting frame for hands/hip poses separate from the actual sights.
  calibrateIron(S, C, matrix) {
    const F = new V(...C.F).applyMatrix4(matrix), R = new V(...C.R).applyMatrix4(matrix);
    const axis = F.clone().sub(R).normalize(), up = new V(...(C.up || [0, 1, 0])).transformDirection(matrix);
    up.addScaledVector(axis, -up.dot(axis)).normalize();
    const back = axis.clone().negate(), right = new V().crossVectors(up, back).normalize();
    const q = new Q().setFromRotationMatrix(new T.Matrix4().makeBasis(right, up, back).transpose());
    S.iron = { F, R, q, qInv: q.clone().invert() };
  },
  measure(P, pv, pistol, upHint, fix) {
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
    const F = fix ? fix.F.clone() : top(0, pistol ? 0.16 : 0.22), R = fix ? fix.R.clone() : top(pistol ? 0.78 : 0.45, pistol ? 1 : 0.8);
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
    if (!fix?.noTop) for (let i = 0; i < n; i++) if (f(i) > 0.25) hTop = Math.max(hTop, _v.copy(pv[i]).applyQuaternion(q).y);
    // 손잡이(앞손 아래)·레이저 자리
    let gh = Infinity, ga = 0, gn = 0, gs = -Infinity;
    for (let i = 0; i < n; i++) { const t = f(i); if (t > 0.25 && t < 0.42) { gh = Math.min(gh, A[i][1]); ga += A[i][0]; gn++; gs = Math.max(gs, _v.subVectors(pv[i], c).dot(right)); } }
    const grip = c.clone().addScaledVector(len, gn ? ga / gn : 0).addScaledVector(u, gn ? gh : 0);
    grip.addScaledVector(right, _v.subVectors(muzzle, grip).dot(right));
    const side = grip.clone().addScaledVector(right, (gn ? gs : 0.03) + 0.012).addScaledVector(up, 0.035);
    return { muzzle, F, R, axis, up, q, qInv: q.clone().invert(), grip, side, L, hTop, qH, posH, roll, mount: fix?.mount || null };
  },
  // 여러 클립을 가중치로 섞어 한 자세를 만든다 (모든 클립이 시간 t 를 따로 가진다)
  pose(P, list) {
    P.poseList=list;G.HandContact?.restore(P.model);
    for (const k in P.acts) P.acts[k].action.enabled = false;
    for (const [k, t, w] of list) {
      const A = P.acts[k].action;
      A.enabled = true; A.play(); A.paused = true; A.time = clamp(t, 0, P.acts[k].dur - 1e-4); A.setEffectiveWeight(w);
    }
    // v62 손 크기·팔 IK 가 옮긴 뼈를 매 프레임 처음 자리로 되돌린 뒤 클립을 입힌다.
    //  이번 클립에 그 뼈 트랙이 없으면 지난 프레임에 옮긴 값이 남아 프레임마다 쌓였다
    //  (M-1911·DE-7 왼손이 2 m 넘게 날아가 조준 때 길게 늘어난 팔이 보이고, 총·손이 떨리던 원인)
    for (const h of P.hands || []) { h.bone.position.copy(h.p0); h.bone.scale.copy(h.s0); }
    for (const ik of P.def.ik || []) if (ik._rest) for (const r of ik._rest) { r.b.position.copy(r.p); r.b.quaternion.copy(r.q); }
    // v65 권총 슬라이드도: 장전 클립에만 슬라이드 트랙이 있으면 대기 중엔 아무도 되돌리지 않아 쏠 때마다 뒤로 쌓였다
    //  (사격하면 슬라이드가 뒤로 간 채 남고, 빈 탄창 장전 클립이 돌 때만 제자리로 왔다)
    if (P.slideKick) P.slideKick.bone.position.copy(P.slideKick.p0);
    P.mixer.update(0);
    if (P.def.ik && P.k) for (const ik of P.def.ik) this.armIK(P, ik);
    if (P.hands && Math.abs(P.handScale - 1) > 0.01) this.scaleHands(P, P.handScale);
  },
  win(P, name) { const w = P.def.win && P.def.win[name]; return w || [0, P.acts[name].dur]; },
  reloadClip(P, empty) { return empty && P.acts.reloadEmpty ? 'reloadEmpty' : 'reload'; },
  reloadDuration(P, id, empty) {
    const S = P.def.shell, f = G.Guns.reloadFactor(empty), base = G.WEAPONS[id].reload * f;
    if (P.def.boltLoad && P.swaps[id]?.kar) return base;   // v63 한 발 넣는 시간 (W() 가 이미 RELOAD_SPEED 로 나눠 둔 값 — v64 두 번 나누던 것 수정)
    if (S) return S.cycleDur * f / (G.RELOAD_SPEED || 1);
    // 게임 장전 시간을 기준으로 하되, 동작이 너무 빨리 감기지 않게 최대 1.3 배까지 늘린다
    const w = this.win(P, this.reloadClip(P, empty));
    return base * clamp((w[1] - w[0]) / base, 0.85, 1.3);
  },
  reloadEvents(P, id, empty, phase, port) {
    const S = P.def.shell;
    // v63 KR-98: 볼트 올리기·당기기 / 탄(또는 클립 5발) 밀어 넣기 / 볼트 밀기·내리기
    //  v64 올림·당김은 'open' 한 번(무기 소리가 올림+당김을 함께 낸다), 닫기도 한 번. 클립은 실제로 클립을 쓸 때만 (예비탄 2 발 이상)
    if (P.def.boltLoad && P.swaps[id]?.kar) {
      const pl = G.Game?.player, clip = empty && (pl?.ammo?.[G.WEAPONS[id].ammo] ?? 5) >= 2;
      return phase === 'start' ? [[0.45, 'open']] : phase === 'load' ? (clip ? [[0.56, 'magin'], [0.68, 'shell'], [0.74, 'shell'], [0.8, 'shell']] : [[0.66, 'shell']]) : [[0.3, 'close']];
    }
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
    } else if (R && C.boltLoad && R.phase && P.swaps[id]?.kar) {
      // v63 KR-98: 볼트 열기(사격 클립의 볼트 당기기) → 연 채로 탄 넣기(IK) → 볼트 닫기
      //  팔은 대기 자세 그대로 두고, 오른손·볼트·탄은 karUpdate 가 움직인다
      list.push(['idle', 0, 1]); reload = true;
    } else if (R && (R.type === 'mag' || R.type === 'revolver')) {
      const name = this.reloadClip(P, R.empty), w = this.win(P, name);
      list.push([name, w[0] + clamp(R.p, 0, 1) * (w[1] - w[0]), 1]); reload = true;
    } else if (!C.pistol && !P.swaps[id]?.kar && P.shotT * fireSpd < fireLen + 0.15) {
      // 사격 → 끝나면 0.15 초 동안 대기 자세로 섞어 돌아간다
      const b = clamp((P.shotT * fireSpd - fireLen) / 0.15, 0, 1);
      list.push(['fire', Math.min(P.shotT * fireSpd, fireLen), 1 - b]);
      if (b > 0) list.push(['idle', 0, b]);
    } else if (drawLen && P.drawT < drawLen && (s.ads || 0) < 0.05) {
      list.push(['draw', P.drawT, 1]); draw = true;
    } else {
      // v62 대기 클립이 0.05 초짜리(한 클립을 잘라 쓰는 KR-98·R-45 팩)면 돌리지 않고 첫 자세로 멈춘다
      //  (3 프레임마다 되감기며 총이 4 cm 씩 앞뒤로 떨렸다 — 그 구간 끝이 사격 동작의 시작이라)
      P.idleT = P.acts.idle.dur < 0.25 ? 0 : ((P.idleT || 0) + dt) % P.acts.idle.dur;
      list.push(['idle', P.idleT, 1]);
    }
    if (s.ads > 0.05 || reload) P.drawT = 99;
    P.reloading = reload;
    P.aimIdle = list.length === 1 && list[0][0] === 'idle';
    this.pose(P, list);
    if (P.swaps[id]?.kar && P.gunId === id) this.karUpdate(P, P.swaps[id].kar, id, R, dt);
    this.syncMount(P, id, s.scope);
    G.HandContact?.apply(id, P.model, G.HandContact.frame(P.gunBone, P.gunRest, P.sight0.qInv), undefined,
      { reload: R, magazine: P.swaps[id]?.magazineContact || P.magazineContact,supportPoint:P.supportPoint,supportTurn:P.supportTurn,
        movingLeft: G.WEAPONS[id].action === 'pump' && !R && P.shotT * fireSpd < fireLen + .15,
        movingRight: id === 'kr98' && (R || P.shotT < (G.WEAPONS[id].cycle || .95)) || id === 'r45' && !!R });
    for (const b of P.spare) b.scale.setScalar(reload ? 1 : 1e-4);
    // ADS: 총의 가늠선을 시선과 나란히 돌리고, 가늠쇠(또는 조준경 중심)를 화면 가운데로
    const aim = reload ? 0 : clamp(s.ads || 0, 0, 1), weight = 1 - aim, M = P.mount;
    const sprint = (vm.sprint || 0) * weight * weight * (!reload && !draw ? 1 : 0);
    // 흔들림·반동 기울기만 카메라 기준으로 돌린다 (전력질주 자세는 아래 sprintPose 에서 손잡이를 축으로)
    _e.set((vm.sway?.y || 0) * weight, (vm.sway?.x || 0) * weight, 0);
    this.place(P, aim, _e);
    if (!reload && !draw && !P.aimIdle) G.WeaponMotion?.stabilize(P.pivot, P.gunBone, P.gunRest);
    if (sprint > 0.001) this.sprintPose(P, sprint * sprint * (3 - 2 * sprint));
    // v56 장전할 때는 총을 화면 가운데 쪽으로 들어 올려 손동작이 보이게 (지향 자세가 오른쪽 아래라 그대로면 화면 밖에서 장전한다)
    // v63 KR-98 사격 뒤 볼트 조작도 반쯤 들어 올린다 (손잡이가 얼굴에 붙지 않게)
    const boltCyc = P.swaps[id]?.kar && P.shotT > 0.06 && P.shotT < (G.WEAPONS[id].cycle || 0.95) * 0.85 ? 0.5 : 0;
    P.rlB = (P.rlB || 0) + clamp((reload ? 1 : boltCyc) - (P.rlB || 0), -dt * 5, dt * 5);
    if (P.rlB > 0) this.reloadLift(P, P.rlB * P.rlB * (3 - 2 * P.rlB));
    P.pivot.position.x += (vm.sway?.x || 0) * 0.2 * weight + Math.sin((vm.t || 0) * 0.8) * 0.001 * weight;
    P.pivot.position.y += Math.sin(s.phase || 0) * 0.006 * (s.moving || 0) * weight - (s.landDip || 0) * 0.05;
    if (!draw) P.pivot.position.y -= (1 - (s.raise ?? 1)) * 0.22;
    if (C.pistol && !reload) this.pistolSlide(P, P.shotT, !!s.empty);
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
  // Slide motion stays local; wrist recoil is supplied by the shared rig.
  pistolSlide(P, t, empty) {
    const S = P.slideKick;
    // 슬라이드: 0.025 초에 끝까지 물러났다가 0.07 초에 돌아온다 (pose() 가 매 프레임 제자리로 되돌린 뒤 더한다).
    //  탄창이 비면 마지막 발 뒤 슬라이드가 뒤로 걸린 채 (슬라이드 멈춤)
    if (S) { const e = empty && t > 0.025 ? 1 : t < 0.025 ? t / 0.025 : Math.max(0, 1 - (t - 0.025) / 0.07); if (e > 0) S.bone.position.addScaledVector(S.d, e); }
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
  // 팔 재질 셰이더: restZ 로 소매 끝 숨기기(cut 유니폼) + armTint 가 있으면 공통 장갑·소매 색
  armShader(m, cut) {
    const tint = m.userData.armTint;
    m.onBeforeCompile = sh => {
      sh.uniforms.uArmCut = cut;
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
    m.needsUpdate = true;
  },
  // v60 AR-7(M4 팩)·G-18(Glock 팩)·DB-2(실사 팔 복사) 처럼 이 파일 밖의 1인칭 팔도 같은 장갑·소매 색으로
  //  손·장갑 재질(Hand_D · Glove_D)의 스킨 메시만 고른다. 텍스처가 다 읽힌 뒤 색 평균을 잰다
  async tintArms(root) {
    const list = [];
    root.traverse(o => { if (o.isSkinnedMesh && !o.userData.lzTinted && [].concat(o.material).some(m => /hand|glove|arm|sleeve/i.test(m.name || ''))) list.push(o); });
    for (const o of list) {
      for (const m of [].concat(o.material)) {
        // 텍스처가 아직 내려받는 중이면(image 없음·불완전) 최대 8 초 기다린다
        for (let t = 0; m.map && !(m.map.image && m.map.image.width > 0 && m.map.image.complete !== false) && t < 160; t++) await new Promise(r => setTimeout(r, 50));
      }
      this.unifyArm(o); o.userData.lzTinted = true;
      if (!o.geometry.attributes.restZ) o.geometry.setAttribute('restZ', new T.BufferAttribute(new Float32Array(o.geometry.attributes.position.count), 1));
      for (const m of [].concat(o.material)) this.armShader(m, { value: 99 });
    }
    return list.length;
  },
  // v63 Kar98k 부품 준비: 볼트 닫힌 자리·여는 거리·손잡이 회전, 탄 견본(손에 든 탄·클립 5발), 탄창 맨 위 탄 자리
  karSetup(sw, k) {
    sw.kar = k; const ud = k.handle.userData;
    k.frame = k.bolt.parent; k.closed = k.bolt.position.clone(); k.open = new V().fromArray(k.bolt.userData.open);
    k.up = new Q().fromArray(ud.up); k.down = new Q().fromArray(ud.down); k.knob = new V().fromArray(ud.knob);
    if (k.tmpl) k.tmpl.visible = false;
    // 내부 탄창 탄: 휴식 자세(틀 좌표)의 가운데·길이 — round0 이 맨 위
    const r0 = k.rounds[0]; r0.geometry.computeBoundingBox();
    const box = r0.geometry.boundingBox.clone().applyMatrix4(r0.matrix).applyMatrix4(r0.parent.matrix);
    k.top = box.getCenter(new V()); k.rlen = box.max.z - box.min.z; k.rdia = box.max.y - box.min.y;
    const geo = r0.geometry.clone(); geo.translate(...r0.geometry.boundingBox.getCenter(new V()).negate().toArray());
    k.rq = r0.quaternion.clone().premultiply(r0.parent.quaternion);
    const mk = () => { const m = new T.Mesh(geo, r0.material); m.frustumCulled = false; m.quaternion.copy(k.rq); return m; };
    // 손에 든 한 발
    k.held = mk(); k.held.visible = false; k.frame.add(k.held);
    // 클립: 탄 5발(지그재그로 쌓음) + 뒤끝의 철판 (원점 = 아래 탄의 가운데)
    k.clip = new T.Group(); k.clip.visible = false; k.frame.add(k.clip); k.clipRounds = [];
    const step = k.rdia * 0.86;
    for (let i = 0; i < 5; i++) { const m = mk(); m.position.set((i % 2 ? 1 : -1) * k.rdia * 0.22, i * step, 0); k.clip.add(m); k.clipRounds.push(m); }
    const steel = new T.MeshStandardMaterial({ color: 0x3b3a36, metalness: 0.8, roughness: 0.45 });
    const plate = new T.Mesh(new T.BoxGeometry(k.rdia * 1.25, step * 5 + k.rdia * 0.4, 0.0015), steel);
    plate.position.set(0, step * 2, k.rlen * 0.5 - k.rlen * 0.08); k.clip.add(plate); k.plate = plate;
    for (const sx of [-1, 1]) { const lip = new T.Mesh(new T.BoxGeometry(0.0012, step * 5 + k.rdia * 0.4, k.rlen * 0.16), steel); lip.position.set(sx * k.rdia * 0.6, step * 2, k.rlen * 0.42); k.clip.add(lip); }
    // 클립 꽂는 자리: 맨 위 탄 바로 위 (탄 끝이 볼트 앞에)
    k.seat = k.top.clone().add(new V(0, k.rdia * 1.1, 0)); k.clipStep = step;
    k.state = { clipOut: -1 };
  },
  // 경로 [u, 틀 좌표 점] 를 부드럽게 잇는다
  karPath(path, u) {
    for (let i = 1; i < path.length; i++) if (u <= path[i][0]) { const A = path[i - 1], t = clamp((u - A[0]) / Math.max(1e-4, path[i][0] - A[0]), 0, 1); return this.karLerp(A, path[i], t * t * (3 - 2 * t)); }
    const Z = path[path.length - 1]; return [Z[1].clone(), Z[2].clone()];
  },
  karUpdate(P, k, id, R, dt) {
    const B = P.def.boltLoad, bones = B._b || (B._b = B.arm.map(n => P.find(n))), palmB = B._p || (B._p = P.find(B.palm));
    if (bones.some(b => !b) || !palmB) return;
    P.model.updateMatrixWorld(true);
    const F = k.frame, toF = w => F.worldToLocal(w.clone()), ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    // 대기 자세: 손목(손잡이 쥔 자리)·손가락 방향(손목 → 가운데 손가락 둘째 마디) — Kar98k 틀 좌표 (오른쪽 +x · 위 +y · 총구 −z)
    const grip = toF(bones[2].getWorldPosition(new V())), fv = toF(palmB.getWorldPosition(new V())).sub(grip), L = fv.length(), d0 = fv.clone().normalize();
    // 쥐는 점(손바닥)과 손가락 방향: 볼트 손잡이는 오른쪽 위에서 감싸 쥐고, 탄·클립은 위에서 누른다
    const dKnob = new V(-0.9, -0.15, -0.4).normalize(), dPush = new V(-0.7, -0.6, -0.3).normalize(), dCarry = new V(-0.5, -0.2, -0.85).normalize();
    const setBolt = (lift, pull) => { k.handle.quaternion.copy(k.down).slerp(k.up, lift); k.bolt.position.copy(k.closed).addScaledVector(k.open, pull); k.bolt.updateMatrixWorld(true); };
    const knobAt = (lift, pull) => { setBolt(lift, pull); return toF(k.handle.localToWorld(k.knob.clone())); };
    const a = G.Game?.player, inst = a?.weapons ? Object.values(a.weapons).find(w => w && w.id === id) : null;
    const mag = inst ? inst.mag : 5, st = k.state;
    // v64 총을 꺼낼 때 지난번 장전에서 남은 클립 상태를 지운다 (클립을 꽂은 채 무기를 바꾼 경우)
    if (P.drawT < 0.05) { k.clip.visible = false; st.clipOut = -1; for (const r of k.clipRounds) { r.position.y = r.userData.y0 ?? r.position.y; r.visible = true; } }
    let lift = 0, pull = 0, key = null, extra = 0, held = false, clipOn = false;
    const cyc = G.WEAPONS[id].cycle || 0.95;
    const gripP = grip.clone().addScaledVector(d0, L);   // 대기 자세의 쥔 점
    const pocket = gripP.clone().add(new V(0.1, -0.22, -0.02));
    const port = k.top.clone().add(new V(0.004, k.rdia * 3.4, -0.005)), press = k.top.clone().add(new V(0.002, k.rdia * 0.9, 0));
    // 쥔 자리 ↔ 손잡이 (u: 0 = 쥔 자리, 1 = 손잡이)
    const toKnob = (u, l, p) => this.karLerp([0, gripP, d0], [1, knobAt(l, p), dKnob], u);
    if (R && R.phase) {
      const pp = clamp(R.pp || 0, 0, 1);
      if (R.phase === 'start') {
        lift = ss(0.38, 0.58, pp); pull = ss(0.6, 0.9, pp);
        key = toKnob(ss(0.08, 0.36, pp), lift, pull);
      } else if (R.phase === 'load') {
        lift = 1; pull = 1; const kn = [knobAt(1, 1), dKnob], u = clamp(R.shellP, 0, 1), pk = [pocket, d0];
        if ((R.per || 1) > 1) {
          // 클립: 주머니 → 클립을 홈에 꽂기 → 엄지로 다섯 발 눌러 넣기 → 손잡이
          const seatP = k.seat.clone().add(new V(0, k.clipStep * 5.4, k.rlen * 0.42)), above = seatP.clone().add(new V(0.03, 0.06, 0.03));
          const thumb = k.seat.clone().add(new V(0.002, k.clipStep * 5.2, 0)), down = k.seat.clone().add(new V(0.002, k.clipStep * 0.9, 0));
          key = this.karPath([[0, ...kn], [0.18, ...pk], [0.28, ...pk], [0.46, above, dCarry], [0.55, seatP, dPush], [0.6, seatP, dPush], [0.64, thumb, dPush], [0.84, down, dPush], [1, ...kn]], u);
          clipOn = u > 0.24; st.clipOut = -1;
          if (u < 0.55) { k.clip.position.copy(key[0]).sub(new V(0, k.clipStep * 5.4, k.rlen * 0.42)); k.clip.rotation.set(0, 0, 0.35 * (1 - ss(0.24, 0.55, u))); }
          else { k.clip.position.copy(k.seat); k.clip.rotation.set(0, 0, 0); }
          const dn = ss(0.64, 0.84, u) * k.clipStep * 5.6;
          // v64 예비탄이 5 발보다 적으면 클립에도 그만큼만 (위에서부터 비운다)
          const have = Math.min(k.clipRounds.length, a?.ammo?.[G.WEAPONS[id].ammo] ?? 5);
          k.clipRounds.forEach((r, i) => { const y = r.userData.y0 ?? (r.userData.y0 = r.position.y); r.position.y = y - dn; r.visible = i < have && k.clip.position.y + r.position.y > k.top.y + k.rdia * 0.3; if (i < have && !r.visible) extra++; });
        } else {
          // 한 발: 주머니 → 배출구 위 → 눌러 넣기 → 손잡이
          key = this.karPath([[0, ...kn], [0.2, ...pk], [0.32, ...pk], [0.56, port, dCarry], [0.7, press, dPush], [0.8, port, dPush], [1, ...kn]], u);
          held = u > 0.27 && u < 0.7;
          if (held) { k.held.position.copy(key[0]); k.held.quaternion.copy(k.rq).multiply(_q.setFromAxisAngle(_v.set(1, 0, 0), -0.3 * (1 - ss(0.56, 0.7, u)))); }
          if (u >= 0.7) extra = 1;
        }
      } else {
        pull = 1 - ss(0.05, 0.4, pp); lift = 1 - ss(0.42, 0.6, pp);
        key = toKnob(1 - ss(0.64, 0.95, pp), lift, pull);
      }
    } else if (P.shotT < cyc && mag > 0) {
      // 사격 뒤 볼트 조작 (게임의 다음 발 준비 시간 안에). v64 소리에 맞춤: 올림 0.24 · 탄피 0.4 · 닫힘 0.58 (player.js cycleT)
      //  마지막 발을 쏘면 게임도 볼트를 돌리지 않는다 → 장전 때 연다
      const t = P.shotT / cyc;
      lift = ss(0.2, 0.3, t) * (1 - ss(0.58, 0.68, t)); pull = ss(0.3, 0.42, t) * (1 - ss(0.47, 0.58, t));
      key = toKnob(ss(0.06, 0.2, t) * (1 - ss(0.7, 0.88, t)), lift, pull);
    }
    setBolt(lift, pull);
    if (key) {
      // 손목 = 쥔 점 − 손가락 방향 × 손 길이, 손 회전 = 대기 자세 손을 손가락 방향만큼 돌린 것
      const [gp, dir] = key, fq = F.getWorldQuaternion(new Q());
      const turn = new Q().setFromUnitVectors(d0, dir.clone().normalize()), turnW = fq.clone().multiply(turn).multiply(fq.clone().invert());
      const hq = turnW.multiply(bones[2].getWorldQuaternion(new Q()));
      // 팔꿈치는 늘 오른쪽 아래로 (팔이 화면 위를 가로지르지 않게)
      this.ik2(bones, F.localToWorld(gp.clone().addScaledVector(dir.clone().normalize(), -L)), hq, new V(0.55, -0.8, 0.1).applyQuaternion(P.pivot.getWorldQuaternion(new Q())));
    }
    k.held.visible = held;
    if (clipOn) k.clip.visible = true;
    else if (k.clip.visible) {
      // 장전이 끝나고 볼트를 밀면 빈 클립이 튀어나간다
      for (const r of k.clipRounds) r.visible = false;
      if (st.clipOut < 0 && pull < 0.9) st.clipOut = 0;
      if (st.clipOut >= 0) { st.clipOut += dt; const t = st.clipOut; k.clip.position.copy(k.seat).add(new V(0.25 * t, 0.6 * t - 2.5 * t * t, 0.05 * t)); k.clip.rotation.z = -6 * t; if (t > 0.45) { k.clip.visible = false; st.clipOut = -1; for (const r of k.clipRounds) { r.visible = true; r.position.y = r.userData.y0 ?? r.position.y; } } }
    }
    // 내부 탄창: 들어 있는 탄 수만큼 (약실 한 발은 안 보인다)
    const n = Math.min(k.rounds.length, Math.max(0, (R && R.phase === 'load' ? mag : mag - 1) + extra));
    k.rounds.forEach((r, i) => { r.visible = i < n; });
  },
  // [u, 점, 손가락 방향] 둘 사이
  karLerp(A, B, u) { return [A[1].clone().lerp(B[1], u), A[2].clone().lerp(B[2], u).normalize()]; },
  // 두 뼈 IK (월드): 어깨는 그대로, 손목을 W 로, 팔꿈치는 지금 굽은 쪽으로. 손 방향은 유지
  ik2(B, W, handQ, poleW) {
    const [U, F, H] = B, hq = handQ || H.getWorldQuaternion(new Q());
    const S = U.getWorldPosition(new V()), E0 = F.getWorldPosition(new V()), W0 = H.getWorldPosition(new V());
    const a = S.distanceTo(E0), b = E0.distanceTo(W0), dv = W.clone().sub(S);
    const d = clamp(dv.length(), Math.abs(a - b) * 1.01 + 1e-4, (a + b) * 0.999), u = dv.normalize();
    const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    const pole = poleW ? poleW.clone() : E0.clone().sub(S); pole.addScaledVector(u, -pole.dot(u)); if (pole.lengthSq() < 1e-10) pole.set(0, -1, 0); pole.normalize();
    const E = S.clone().addScaledVector(u, x).addScaledVector(pole, h), Wt = S.clone().addScaledVector(u, d);
    const aim = (bone, from, to, child) => {
      const cur = child.getWorldPosition(new V()).sub(from).normalize(), want = to.clone().sub(from).normalize();
      const dq = new Q().setFromUnitVectors(cur, want), wq = bone.getWorldQuaternion(new Q()), pq = bone.parent.getWorldQuaternion(new Q()).invert();
      bone.quaternion.copy(pq.multiply(dq.multiply(wq))); bone.updateMatrixWorld(true);
    };
    aim(U, S, E, F); aim(F, E, Wt, H);
    H.quaternion.copy(H.parent.getWorldQuaternion(new Q()).invert().multiply(hq)); H.updateMatrixWorld(true);
  },
  // v58 두 뼈 IK: 손(손목)은 그대로 두고 어깨를 옮긴 뒤 팔꿈치를 pole 쪽으로 굽힌다 (팩의 팔 자세가 화면에서 어색할 때)
  //  ik: { bones: [위팔, 아래팔, 손], drop: [x, y, z] 어깨 이동(m, 모델 좌표), pole: [x, y, z] 팔꿈치가 향할 쪽(모델 좌표) }
  armIK(P, ik) {
    const f = P.find, B = ik._b || (ik._b = ik.bones.map(n => f(n)));
    if (B.some(b => !b)) return;
    if (!ik._rest) ik._rest = B.map(b => ({ b, p: b.position.clone(), q: b.quaternion.clone() }));
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
    _aimQ.copy(M.q); _aimT.copy(M.t);
    if (aim > 0 && P.aimIdle) {
      // Cancel idle gun-bone motion while aiming. Firing and reloads keep their animation.
      P.gunBone.updateWorldMatrix(true, false);
      _pose.copy(P.pivot.matrixWorld).invert().multiply(P.gunBone.matrixWorld).multiply(P.gunRestInv);
      _aimQ.multiply(_q.setFromRotationMatrix(_poseRot.extractRotation(_pose)).invert());
      _aimT.copy(M.aimPt).applyQuaternion(M.q).add(M.t)
        .sub(_v.copy(M.aimPt).applyMatrix4(_pose).applyQuaternion(_aimQ));
    }
    _q.copy(S.qH).slerp(_aimQ, aim);
    if (eul) P.pivot.quaternion.setFromEuler(eul).multiply(_q); else P.pivot.quaternion.copy(_q);
    P.pivot.position.copy(S.posH).lerp(_aimT, aim);
  },
  // 선택한 총의 휴식 자세를 굽고, 플레이 중인 팩의 상태는 복원한다.
  preview(P,id,scope){
    const saved={id:P.gunId,sight:P.sight,muzzle:P.muzzleLocal,scope:P.mountScope,pose:P.poseList||[['idle',0,1]]};
    this.useGun(P,id);this.pose(P,[['idle',0,1]]);this.syncMount(P,id,scope);P.pivot.updateWorldMatrix(true,true);
    const result=G.AttachmentMounts.snapshot([...(P.swaps[id]?.groups||P.gunMeshes),P.mountGroup,...(P.attachmentExtras||[])],P.pivot.matrixWorld.clone().invert());
    if(saved.id){this.useGun(P,saved.id);this.pose(P,saved.pose);this.syncMount(P,saved.id,saved.scope)}
    else{P.sight=saved.sight;P.muzzleLocal=saved.muzzle;P.mountKey=null}
    return result;
  },
  syncMount(P, id, scope) {
    const a = G.Game?.player, inst = Object.values(a?.weapons || {}).find(w => w && w.id === id);
    const parts = inst?.attachments || {}, key = id + JSON.stringify([scope, parts]);
    if (key === P.mountKey) return;
    P.mountKey = key;
    if(P.mountGroup)P.mountGroup.removeFromParent();
    P.mountGroup = new T.Group();P.mountScope=scope;
    P.gunBone.add(P.mountGroup);
    // 뼈 공간 그룹은 단위 변환 없이 쓰고, 자식마다 휴식 자세 기준 변환을 넣는다
    if (!P.flashes[id] && G.VM.models[id]?.flash) { const fl = G.VM.models[id].flash.clone(); fl.visible = false; P.pivot.add(fl); P.flashes[id] = fl; }
    for (const k in P.flashes) if (k !== id) P.flashes[k].visible = false;
    const S = P.sight, A = G.Attachments, pistol = P.def.pistol;
    for (const m of P.swaps?.[id]?.foldParts || []) {m.visible = !scope;m.userData.lzFoldSight=true}   // v70 조준경을 달면 가늠자·가늠쇠 접기
    const I = S.iron || S, t = new V(), q = I.q.clone();
    const Fq = I.F.clone().applyQuaternion(q), Rq = I.R.clone().applyQuaternion(q);
    // v70 영점: 가늠쇠 끝(F)을 화면 정가운데(=총알이 가는 곳)에 정확히 둔다.
    //  예전에는 총 윗면(hTop) + 4 mm + adsLift 만큼 총을 내려서, 보이는 가늠쇠가 탄착점보다 0.5~4° 아래에 있었다.
    //  가늠쇠가 없는 총만 SWAP/팩의 sightLift 로 레일 위를 본다 (조준점 = 가늠쇠 위 sightLift)
    //  aimTop: 가늠쇠가 낮게 잡히고 뒤쪽 가늠자(덮개·손잡이·리볼버 윗면)가 시선을 가리는 총은 그 윗면을 조준선으로
    const aimTop = !S.iron && (SWAP[id] ? SWAP[id].aimTop : P.def.aimTop);
    const lift = (SWAP[id]?.sightLift ?? (SWAP[id] ? 0 : P.def.sightLift || 0)) + (aimTop && S.hTop > Fq.y ? S.hTop - Fq.y : 0);
    t.set(-Fq.x, -Fq.y - lift, -(SWAP[id]?.adsDist || P.def.adsDist || (pistol ? 0.3 : 0.27)) - Rq.z);
    // 소매 끝이 들어오지 않도록 기본 전진은 7 cm 제한. 가까운 가늠자는 총별 adsFwd 로 조절한다.
    t.z = Math.max(t.z, -(SWAP[id]?.adsFwd ?? P.def.adsFwd ?? 0.07));
    let aimPt = I.F.clone().add(new V(0, lift, 0).applyQuaternion(I.qInv));
    const F=G.AttachmentMounts,C=new T.Matrix4().makeRotationFromQuaternion(S.q),fromWorld=C.clone().multiply(P.gunRest).multiply(P.gunBone.matrixWorld.clone().invert());
    P.attachmentProfiles ||= {};
    const source=P.swaps[id]||P.gunMeshes;
    let profile=P.attachmentProfiles[id];
    if(!profile||profile.source!==source){
      const rail=(S.mount||S.R).clone().applyQuaternion(S.q);if(!S.mount){rail.y-=pistol?.003:.006;rail.z-=pistol?.012:.03}
      profile=F.measure(P.swaps[id]?.groups||P.gunMeshes,fromWorld,{rail,muzzle:S.muzzle.clone().applyQuaternion(S.q),under:S.grip.clone().applyQuaternion(S.q),side:S.side.clone().applyQuaternion(S.q)},G.WEAPONS[id]);
      profile.source=source;P.attachmentProfiles[id]=profile;
    }
    F.clear(P);
    const transform=P.gunRestInv.clone().multiply(new T.Matrix4().makeRotationFromQuaternion(S.qInv));
    if(scope&&A){const optic=F.optic(profile,scope,G.WEAPONS[id]);if(optic){
      F.attach(P.mountGroup,optic.root,transform);q.copy(S.q);
      const O=optic.eye;t.set(-O.x,-O.y,-(ADS_DIST[scope]||.3)-O.z);aimPt=O.clone().applyQuaternion(S.qInv);
    }}
    const built=F.accessories(profile,parts,G.WEAPONS[id]);F.attach(P.mountGroup,built.root,transform);
    P.supportPoint=built.support?.clone().applyQuaternion(S.qInv).applyQuaternion(P.sight0.q);
    P.supportTurn=parts.under==='angled'?[0,0,0]:parts.under?[0,0,-60]:null;
    const contact=P.swaps[id]?.magazineContact||P.magazineContact;
    if(contact){
      // 탄창 뼈의 휴식 변환으로 바닥판을 붙여 장전 때 총몸에 남지 않게 한다.
      const c={...contact,toCanonical:C.clone().multiply(P.boneRest.mag.inv.clone().invert())};
      const o=F.magazine(c,parts.magazine);if(o)P.attachmentExtras.push(o);
    }
    P.mount = { t, q, aimPt };
  }
};
})();
