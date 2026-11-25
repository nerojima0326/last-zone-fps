// real-arms.js — M4 팩(BarcodeGames)의 실사 팔·손 모델을 다른 총기에도 쓴다.
// 다른 총에는 이 팔용 애니메이션이 없으므로, 기존 절차적 팔 IK(weapons.js armRig/solveArm)가
// 매 프레임 계산한 손 위치·손 방향·팔꿈치 방향·손가락 굽힘을 실사 팔의 뼈대에 옮긴다.
//  - 손: 절차적 손의 접촉점(손바닥·손가락)에 실사 손의 같은 점을 맞추고, 손 방향(손가락·손바닥 축)을 그대로 쓴다
//  - 팔: 실사 팔 길이로 2관절 IK를 다시 풀되, 팔꿈치가 나가는 방향은 절차적 팔과 같게
//  - 손가락: 원본의 "편 손"과 "총을 쥔 손"(M4/Glock 대기 자세) 사이를 절차적 굽힘 값으로 섞는다
// M4(AR-7)·Glock(G-18)은 원본 애니메이션을 그대로 쓰므로 건드리지 않는다.
(function () {
'use strict';
const G = window.G, T = window.THREE, V3 = T.Vector3, Q = T.Quaternion, U = G.U;
const FING = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
const SIDES = [{ key: 'R', name: 'Right', side: 1 }, { key: 'L', name: 'Left', side: -1 }];
// 절차적 손의 기준 굽힘 값 (weapons.js 의 기본 쥔 자세). 이 값에서 원본 쥔 자세가 그대로 나온다
const REF = { R: { curl: 0.9, thumb: 0.65, trig: 0.7 }, L: { curl: 0.76, thumb: 0.45, trig: 0.7 } };
const _m = new T.Matrix4(), _m2 = new T.Matrix4(), _s = new V3(), _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3();
const _q = new Q(), _q2 = new Q(), _w = new V3(), _e = new V3(), _sh = new V3(), _bend = new V3(), _pz = new V3();
const _fingerEuler = new T.Euler();
// Y 축 = y, Z 축 = z 를 y에 직교화한 회전
const _fy = new V3(), _fz = new V3(), _fx = new V3(), _fm = new T.Matrix4();
function frame(y, z, out) {
  _fy.copy(y).normalize();
  _fz.copy(z).addScaledVector(_fy, -z.dot(_fy));
  if (_fz.lengthSq() < 1e-8) _fz.set(0, 0, 1).addScaledVector(_fy, -_fy.z);
  _fz.normalize(); _fx.crossVectors(_fy, _fz);
  return out.setFromRotationMatrix(_fm.makeBasis(_fx, _fy, _fz));
}
// 로컬 (ay, az) 축이 월드 (wy, wz) 축을 향하게 하는 월드 회전
const _lq = new Q(), _dq = new Q(), _ax = new V3();
// open → grip 회전을 t 배만큼 (t > 1 이면 같은 축으로 더 굽힌다)
function bend(open, grip, t, out) {
  if (t <= 1) return out.copy(open).slerp(grip, t);
  _dq.copy(open).invert().multiply(grip);
  if (_dq.w < 0) { _dq.x = -_dq.x; _dq.y = -_dq.y; _dq.z = -_dq.z; _dq.w = -_dq.w; }
  const ang = 2 * Math.acos(Math.min(1, _dq.w)), sn = Math.sqrt(Math.max(0, 1 - _dq.w * _dq.w));
  if (sn < 1e-5) return out.copy(grip);
  _ax.set(_dq.x / sn, _dq.y / sn, _dq.z / sn);
  return out.copy(open).multiply(_dq.setFromAxisAngle(_ax, ang * t));
}
function mapFrame(ly, lz, wy, wz, out) {
  frame(ly, lz, _lq);
  return frame(wy, wz, out).multiply(_lq.invert());
}

const R = G.RealArms = {
  ready: false, enabled: true, copy: null, host: null,
  init() {
    try { this.enabled = localStorage.getItem('lastzone_realarms') !== '0'; } catch (e) { /* 저장소 없음 */ }
    const M = G.M4Viewmodel;
    if (!M) return;
    // M4 모델을 다시 불러오거나 내리면 함께 따라간다 (같은 지오메트리·재질을 공유한다)
    const install = M.install, unload = M.unload;
    M.install = function (model) { install.call(this, model); R.build(); };
    M.unload = function () { R.dispose(); unload.call(this); };
    const update = G.VM.update;
    G.VM.update = function (dt, s) { update.call(this, dt, s); R.update(this, s); };
    if (M.ready) this.build();
  },
  setEnabled(on) {
    this.enabled = !!on;
    try { localStorage.setItem('lastzone_realarms', on ? '1' : '0'); } catch (e) { /* 저장 안 됨 */ }
    if (!on) this.hide();
  },
  bonesOf(root, side) {
    const p = side.name, get = n => root.getObjectByName(p + n);
    const b = { arm: get('Arm'), fore: get('ForeArm'), hand: get('Hand'), fingers: {} };
    for (const f of FING) b.fingers[f] = [1, 2, 3].map(i => get('Hand' + f + i)).filter(Boolean);
    return b;
  },
  // 원본 클립의 대기 자세(시작 프레임)로 맞춘다
  pose(model, clipName) {
    const clip = model.animations.find(c => c.name === clipName);
    if (!clip) return null;
    const mixer = new T.AnimationMixer(model), act = mixer.clipAction(clip);
    act.play(); mixer.setTime(Math.min(...clip.tracks.map(t => t.times[0])));
    model.updateMatrixWorld(true);
    return mixer;
  },
  fingerQuats(b) {
    const out = {};
    for (const f of FING) out[f] = b.fingers[f].map(x => x.quaternion.clone());
    return out;
  },
  // 복제 시점의 Idle 자세를 편 손으로 쓰면 손가락을 펴도 계속 주먹이 된다.
  // 칼은 원본 스킨의 역바인드 행렬에서 실제 편 손의 로컬 회전을 복구한다.
  knifeBind(mesh, b) {
    const bones=mesh.skeleton.bones, inv=mesh.skeleton.boneInverses, out={};
    for(const f of FING)out[f]=b.fingers[f].map(bone=>{
      const i=bones.indexOf(bone),p=bones.indexOf(bone.parent);
      if(i<0||p<0)return bone.quaternion.clone();
      const local=inv[p].clone().multiply(inv[i].clone().invert()),q=new Q();local.decompose(new V3(),q,new V3());return q.normalize();
    });
    return out;
  },
  build() {
    this.dispose();
    const M = G.M4Viewmodel, SU = T.SkeletonUtils;
    if (!M || !M.ready || !SU) return;
    try {
      const src = M.model, copy = SU.clone(src);
      copy.animations = src.animations;
      const drop = [];
      copy.traverse(o => { if ((o.isMesh && !o.isSkinnedMesh) || o.isCamera || o.isLight) drop.push(o); });
      for (const o of drop) o.removeFromParent();
      // v62 GLB 변환본은 재질이 둘이라 Hand_Mesh 가 스킨 메시 둘을 담은 그룹이다
      const node = copy.getObjectByName('Hand_Mesh'), mesh = node?.isSkinnedMesh ? node : node?.children.find(o => o.isSkinnedMesh);
      if (!mesh) throw Error('Hand_Mesh 없음');
      node.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; });
      if (G.AssetVM && G.AssetVM.tintArms) G.AssetVM.tintArms(copy).catch(() => {});   // v60 공통 장갑·소매 색
      const S = {};
      for (const sd of SIDES) {
        const b = this.bonesOf(copy, sd);
        if (!b.arm || !b.fore || !b.hand || !b.fingers.Middle.length || !b.fingers.Index.length || !b.fingers.Pinky.length) throw Error(sd.name + ' 팔 뼈대가 없습니다');
        S[sd.key] = { b, sd, open: this.fingerQuats(b), openKnife: this.knifeBind(mesh,b) };
      }
      // M4 대기 자세: 소총·산탄총의 쥔 손 + 팔 축 보정
      const mix = this.pose(copy, 'Idle');
      if (!mix) throw Error('Idle 클립 없음');
      for (const sd of SIDES) {
        const s = S[sd.key], b = s.b;
        s.gripRifle = this.fingerQuats(b);
        // 칼에는 방아쇠가 없다. 검지도 가운뎃손가락과 같은 굽힘으로 손잡이를 감싼다.
        s.gripKnife = { ...s.gripRifle, Index: s.openKnife.Index.map((q,i) => q.clone().multiply(s.openKnife.Middle[i].clone().invert()).multiply(s.gripRifle.Middle[i])) };
        const P = o => o.getWorldPosition(new V3()), Qw = o => o.getWorldQuaternion(new Q());
        const sp = P(b.arm), ep = P(b.fore), wp = P(b.hand);
        const axis = _d.subVectors(wp, sp).normalize(), bend = new V3().subVectors(ep, sp);
        bend.addScaledVector(axis, -bend.dot(axis)).normalize();
        const qa = Qw(b.arm).invert(), qf = Qw(b.fore).invert(), qh = Qw(b.hand);
        s.upAxis = b.fore.position.clone().normalize(); s.upBend = bend.clone().applyQuaternion(qa);
        s.foreAxis = b.hand.position.clone().normalize(); s.foreBend = bend.clone().applyQuaternion(qf);
        // 손 좌표: 손가락 방향(가운뎃손가락 뿌리), 손바닥 법선(검지→새끼 가로축과 수직)
        const fdir = b.fingers.Middle[0].position.clone().normalize();
        const across = b.fingers.Index[0].position.clone().sub(b.fingers.Pinky[0].position);
        const palm = new V3().crossVectors(fdir, across).multiplyScalar(-sd.side).normalize();
        s.handInv = frame(fdir, palm, new Q()).invert();
        // 손바닥 방향을 아래팔 좌표로 (아래팔 비틀림 기준)
        s.forePalm = palm.clone().applyQuaternion(qh).applyQuaternion(qf);
        s.upper = b.fore.position.length(); s.lower = b.hand.position.length(); s.palmLen = b.fingers.Middle[0].position.length();
      }
      mix.stopAllAction(); mix.uncacheRoot(copy);
      // 권총: Glock 대기 자세의 손가락 (같은 팔 뼈대)
      const gp = G.G17Pilot;
      if (gp && gp.ready && gp.model) {
        const g = SU.clone(gp.model); g.animations = gp.model.animations;
        const gm = this.pose(g, 'Idle');
        if (gm) {
          for (const sd of SIDES) {
            const gb = this.bonesOf(g, sd), s = S[sd.key];
            s.gripPistol = {};
            for (const f of FING) s.gripPistol[f] = s.b.fingers[f].map((x, i) => (gb.fingers[f][i] || x).quaternion.clone());
          }
          gm.stopAllAction(); gm.uncacheRoot(g);
        }
      }
      for (const sd of SIDES) if (!S[sd.key].gripPistol) S[sd.key].gripPistol = S[sd.key].gripRifle;
      copy.visible = false;
      Object.assign(this, { copy, mesh, S, ready: true, host: null });
    } catch (e) {
      console.warn('[RealArms]', e.message);
      this.ready = false;
    }
  },
  dispose() {
    this.hide();
    if (this.copy) this.copy.removeFromParent();
    Object.assign(this, { copy: null, mesh: null, S: null, ready: false, host: null });
  },
  // 절차적 팔 메시 보이기/숨기기
  armsOf(m) { return m.def ? { L: m.armL, R: m.armR } : m.staticArms; },
  procVisible(m, on) {
    if (!m || m._realHidden === !on) return;
    const A = this.armsOf(m);
    if (A) for (const r of [A.L, A.R]) if (r) for (const c of r.grp.children) if (c.isSkinnedMesh) c.visible = on;
    m._realHidden = !on;
  },
  hide() {
    if (this.copy) this.copy.visible = false;
    if (this.lastM) { this.procVisible(this.lastM, true); this.lastM = null; }
  },
  update(vm, s) {
    G.HandContact?.restore(this.copy);
    const m = vm.models[vm.cur];
    const own = (vm.cur === 'ar7' && G.M4Viewmodel?.ready) || (vm.cur === 'g18' && G.G17Pilot?.ready) || G.AssetVM?.owns(vm.cur);
    const A = m && this.armsOf(m);
    // v65 투척물·맨손은 설정과 상관없이 총과 같은 실사 팔 (절차적 팔과 섞이지 않게)
    const use = this.ready && (this.enabled || vm.cur === 'throw' || vm.cur === 'fists' || G.Knives?.is(vm.cur)) && A && (A.L || A.R) && !own && !s.hideVM;
    if (this.lastM && this.lastM !== m) this.procVisible(this.lastM, true);
    if (!use) { this.hide(); return; }
    if (this.copy.parent !== m.root) m.root.add(this.copy);
    this.procVisible(m, false); this.lastM = m;
    this.copy.visible = true;
    m.root.updateMatrixWorld(true);
    const pistol = m.cls === 'pistol';
    for (const sd of SIDES) {
      const r = A[sd.key], S = this.S[sd.key];
      if (r) { S.b.arm.scale.setScalar(1); this.drive(m, r, S, pistol); }
      else this.tuck(S);   // 한 팔만 쓰는 동작(투척): 다른 팔은 접어서 감춘다
    }
    G.HandContact?.apply(vm.cur, this.copy, m.gun.matrixWorld, {
      L: A.L?.contactMode === 'support' ? 1 : 0, R: A.R?.contactMode === 'grip' ? 1 : 0
    }, { reload: s.reload, proceduralArms: A, recoveryGap: s.recoveryGap });
    if(m.type==='knife')G.Knives.fitRealGrip(m,A.R,this.S.R,.01*(this.scale||1));
  },
  tuck(S) {
    const b = S.b; b.arm.scale.setScalar(1e-4); b.arm.updateMatrixWorld(true);
  },
  // 팔 그룹(rig.grp) 공간의 위치·회전을 뼈의 로컬 변환으로
  place(bone, pos, quat, unit, rootW) {
    _m.compose(pos, quat, _s.setScalar(unit)).premultiply(rootW);
    bone.parent.updateMatrixWorld(true);
    _m2.copy(bone.parent.matrixWorld).invert().multiply(_m);
    _m2.decompose(bone.position, bone.quaternion, bone.scale);
    bone.updateMatrixWorld(true);
  },
  drive(m, r, S, pistol) {
    const AC = G.ARM_CONST, b = S.b, rootW = r.grp.matrixWorld;
    // 실사 손 크기: 원본 비율 그대로 (단위 cm → m)
    const unit = 0.01 * (this.scale || 1);
    const ratio = S.palmLen * unit / (AC.middleBase * AC.handS);
    // 손: 절차적 손의 접촉점에 같은 상대 위치의 실사 손 점을 맞춘다
    const hq = r.handQ;
    _pz.copy(r.anchorLocal).multiplyScalar(AC.handS * ratio).applyQuaternion(hq);
    _w.copy(r.contact).sub(_pz);
    _q.copy(hq).multiply(S.handInv);
    const handQ = _q.clone();
    // 팔: 실사 길이로 2관절 IK. 어깨는 화면 밖에서 손 쪽으로 당겨 둔다
    const La = S.upper * unit, Lb = S.lower * unit;
    _sh.copy(r.S);
    _d.subVectors(_w, _sh); let L = _d.length(); _d.divideScalar(L || 1);
    const maxL = (La + Lb) * 0.985, minL = Math.abs(La - Lb) + 0.03;
    if (L > maxL) { _sh.copy(_w).addScaledVector(_d, -maxL); L = maxL; }
    else if (L < minL) { _sh.copy(_w).addScaledVector(_d, -minL); L = minL; }
    // 팔꿈치가 나가는 방향은 절차적 팔과 같게
    _bend.subVectors(r.bE.position, r.S); _bend.addScaledVector(_d, -_bend.dot(_d));
    if (_bend.lengthSq() < 1e-6) _bend.copy(r.pole).addScaledVector(_d, -r.pole.dot(_d));
    _bend.normalize();
    const cosA = U.clamp((La * La + L * L - Lb * Lb) / (2 * La * L), -1, 1);
    _e.copy(_sh).addScaledVector(_d, La * cosA).addScaledVector(_bend, La * Math.sqrt(1 - cosA * cosA));
    // 위팔
    mapFrame(S.upAxis, S.upBend, _a.subVectors(_e, _sh), _bend, _q);
    this.place(b.arm, _sh, _q, unit, rootW);
    // 아래팔 (+ 손바닥 쪽으로 일부 비틀기)
    const fa = new V3().subVectors(_w, _e).normalize();
    mapFrame(S.foreAxis, S.foreBend, fa, _bend, _q);
    _b.copy(S.forePalm).applyQuaternion(_q); _b.addScaledVector(fa, -_b.dot(fa));
    _c.set(0, 0, 1).applyQuaternion(hq); _c.addScaledVector(fa, -_c.dot(fa));
    if (_b.lengthSq() > 1e-4 && _c.lengthSq() > 1e-4) {
      _b.normalize(); _c.normalize();
      const ang = Math.atan2(fa.dot(_d.crossVectors(_b, _c)), U.clamp(_b.dot(_c), -1, 1));
      _q.premultiply(_q2.setFromAxisAngle(fa, U.clamp(ang * 0.6, -1.3, 1.3)));
    }
    this.place(b.fore, _e, _q, unit, rootW);
    // 손
    this.place(b.hand, _w, handQ, unit, rootW);
    // 손가락: 편 손 ↔ 쥔 손
    const key = r.side > 0 ? 'R' : 'L', ref = REF[key], knife = m.type === 'knife' && r.side > 0, grip = knife ? S.gripKnife : pistol ? S.gripPistol : S.gripRifle, open = knife ? S.openKnife : S.open;
    // 칼 손잡이는 주먹과 달리 손 안에 공간이 필요하다. 주먹의 과도한 추가 굽힘을 적용하지 않는다.
    const closed = m.type === 'fists';
    const fist = closed ? 1.55 : 1, lim = closed ? 1.7 : 1.15;
    const tCurl = U.clamp(r.curl / ref.curl * fist, 0, lim), tThumb = U.clamp(r.thumb / ref.thumb, 0, 1.1), tTrig = U.clamp(r.trig / ref.trig * fist, 0, lim);
    for (const f of FING) {
      const t = f === 'Thumb' ? tThumb : f === 'Index' ? tTrig : tCurl, bones = b.fingers[f], digit=FING.indexOf(f), fit=knife?m.knifeProfile:null;
      for (let i = 0; i < bones.length; i++) {
        const curl = knife ? fit.fingers[digit][i] * (f === 'Thumb' ? r.thumb / .72 : f === 'Index' ? r.trig / .9 : r.curl / .9) : t;
        bend(open[f][i], grip[f][i], curl, bones[i].quaternion);
      }
      if(fit?.turns?.[digit])bones[0].quaternion.multiply(_q2.setFromEuler(_fingerEuler.set(...fit.turns[digit])));
    }
    b.hand.updateMatrixWorld(true);
  }
};
})();
