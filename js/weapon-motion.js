// One recoil rig for imported and procedural weapons, including their hands.
(function () {
'use strict';
const G = window.G, T = window.THREE, DEG = Math.PI / 180;
// Art-directed travel (metres/degrees), not changes to ballistic recoil or damage.
// The rearward impulse is faster than muzzle climb; self-loaders also have a
// small, delayed action-return impulse. Manual actions keep their own animations.
const profiles = {
  ar7:   { back: .019, pitch: 2.4, yaw: .32, roll: .40, speed: 30, damping: .78, action: .048 },
  ka47:  { back: .027, pitch: 3.7, yaw: .48, roll: .65, speed: 27, damping: .76, action: .058 },
  sc17:  { back: .029, pitch: 3.3, yaw: .36, roll: .48, speed: 28, damping: .80, action: .055 },
  mk14:  { back: .032, pitch: 4.5, yaw: .42, roll: .58, speed: 25, damping: .80, action: .060 },
  kr98:  { back: .041, pitch: 6.3, yaw: .50, roll: .70, speed: 22, damping: .83 },
  s12:   { back: .043, pitch: 7.0, yaw: .55, roll: .80, speed: 23, damping: .82 },
  m1014: { back: .034, pitch: 5.2, yaw: .42, roll: .58, speed: 26, damping: .82, action: .065 },
  db2:   { back: .047, pitch: 8.2, yaw: .65, roll: .95, speed: 21, damping: .84 },
  sa12:  { back: .037, pitch: 5.8, yaw: .55, roll: .78, speed: 25, damping: .79, action: .070 },
  aa12:  { back: .030, pitch: 4.1, yaw: .36, roll: .46, speed: 24, damping: .86, action: .075 },
  p92:   { back: .022, pitch: 6.4, yaw: .55, roll: 1.0, speed: 29, damping: .77, action: .045 },
  g18:   { back: .017, pitch: 3.2, yaw: .42, roll: .75, speed: 32, damping: .80, action: .032 },
  m1911: { back: .030, pitch: 8.2, yaw: .65, roll: 1.2, speed: 26, damping: .79, action: .055 },
  de7:   { back: .040, pitch: 10.5, yaw: .70, roll: 1.3, speed: 23, damping: .82, action: .065 },
  r45:   { back: .035, pitch: 9.3, yaw: .65, roll: 1.4, speed: 24, damping: .80 }
};

function axis(frequency, damping) {
  const decay = frequency * damping, wave = frequency * Math.sqrt(1 - damping * damping);
  const peakTime = Math.atan2(wave, decay) / wave;
  return { x: 0, v: 0, frequency, decay, wave,
    impulse: wave / (Math.exp(-decay * peakTime) * Math.sin(wave * peakTime)) };
}
// Exact damped spring solution: even a low frame rate cannot add energy or
// change the recovery time. Firing variation is sampled on a shot, never per frame.
function step(a, dt) {
  const e = Math.exp(-a.decay * dt), c = Math.cos(a.wave * dt), s = Math.sin(a.wave * dt);
  const x = a.x, v = a.v;
  a.x = e * (x * c + (v + a.decay * x) * s / a.wave);
  a.v = e * (v * c - (a.decay * v + a.frequency * a.frequency * x) * s / a.wave);
  if (Math.abs(a.x) < 1e-8 && Math.abs(a.v) < 1e-7) a.x = a.v = 0;
}
const anchor = new T.Vector3(), travel = new T.Vector3(), angles = new T.Euler(0, 0, 0, 'YXZ');
const delta = new T.Matrix4(), rotation = new T.Matrix4(), correction = new T.Quaternion(), offset = new T.Vector3();
G.WeaponMotion = {
  profiles, id: null, axes: null, pending: [], shot: 0, ads: 0,
  reset(vm, id = vm.cur) {
    this.id = id; this.pending.length = 0; this.shot = 0; this.ads = 0;
    const p = profiles[id];
    this.axes = p ? {
      x: axis(43, .86), y: axis(36, .85), z: axis(72, .87),
      pitch: axis(p.speed, p.damping), yaw: axis(p.speed * 1.17, .86), roll: axis(p.speed * 1.3, .84)
    } : null;
    if (vm.root) { vm.root.position.set(0, 0, 0); vm.root.quaternion.identity(); vm.root.updateWorldMatrix(true, false); }
  },
  fire(vm, amount) {
    if (this.id !== vm.cur) this.reset(vm);
    const p = profiles[this.id], def = G.WEAPONS[this.id];
    if (!p || !this.axes) return;
    const player = G.Player, actor = player?.a, ads = T.MathUtils.clamp(player?.ads ?? vm.adsT ?? 0, 0, 1);
    const inst = actor?.weapons?.[actor.cur];
    const mod = inst?.id === this.id ? G.Attachments?.modifiers(inst) : null;
    const support = actor?.prone ? .65 : actor?.crouch ? .83 : 1;
    const strength = Math.max(0, amount / def.kick) * support;
    const pistol = def.cls === 'pistol', held = 1 - ads * (pistol ? .42 : .53);
    const vertical = strength * held * (mod?.v ?? 1), horizontal = strength * held * (mod?.h ?? 1);
    // A bounded sequence gives a consistent firing character without a fixed
    // left/right alternation or high-frequency camera noise.
    const n = ++this.shot, side = Math.sin(n * 2.399963 + G.GUN_IDS.indexOf(this.id) * .73);
    const twist = Math.sin(n * 1.618034 + .7), A = this.axes;
    A.z.v += p.back * strength * (1 - ads * .25) * A.z.impulse;
    A.y.v += p.back * .10 * vertical * A.y.impulse;
    A.x.v += .0018 * side * horizontal * A.x.impulse;
    A.pitch.v += p.pitch * DEG * vertical * (1 + .045 * twist) * A.pitch.impulse;
    A.yaw.v += p.yaw * DEG * side * horizontal * A.yaw.impulse;
    A.roll.v += p.roll * DEG * twist * horizontal * A.roll.impulse;
    if (p.action) this.pending.push({ time: p.action, back: -p.back * strength * .10 * (1 - ads * .25), pitch: -p.pitch * DEG * vertical * .035 });
  },
  advance(dt) { for (const a of Object.values(this.axes)) step(a, dt); },
  update(vm, dt, s) {
    if (this.id !== vm.cur) this.reset(vm);
    if (!this.axes || !Number.isFinite(dt) || dt <= 0) return;
    // Split exactly at action events, rather than quantizing them to a frame.
    let left = dt;
    while (left > 1e-9) {
      let next = left;
      for (const event of this.pending) next = Math.min(next, Math.max(0, event.time));
      this.advance(next); left -= next;
      for (let i = this.pending.length - 1; i >= 0; i--) {
        const event = this.pending[i]; event.time -= next;
        if (event.time <= 1e-9) {
          this.axes.z.v += event.back * this.axes.z.impulse;
          this.axes.pitch.v += event.pitch * this.axes.pitch.impulse;
          this.pending.splice(i, 1);
        }
      }
    }
    const A = this.axes, pistol = G.WEAPONS[this.id].cls === 'pistol';
    this.ads = T.MathUtils.clamp(s.ads || 0, 0, 1);
    // Shoulder for long guns, wrist for handguns. Both hands and every weapon
    // part inherit this same transform, so the grip cannot separate on a shot.
    anchor.set((1 - this.ads) * .07, pistol ? -.18 : -.12, pistol ? -.30 : -.035);
    angles.set(A.pitch.x, A.yaw.x, A.roll.x, 'YXZ');
    vm.root.quaternion.setFromEuler(angles);
    travel.set(A.x.x, A.y.x, A.z.x);
    vm.root.position.copy(anchor).sub(offset.copy(anchor).applyQuaternion(vm.root.quaternion)).add(travel);
    vm.root.updateWorldMatrix(true, false);
  },
  // Imported fire clips often animate the entire gun as well as its bolt,
  // slide and fingers. Remove only the rigid gun-body motion, leaving relative
  // mechanical/hand animation intact, before applying our shared parent rig.
  stabilize(pivot, bone, rest) {
    bone.updateWorldMatrix(true, false);
    delta.copy(pivot.matrixWorld).invert().multiply(bone.matrixWorld).multiply(offsetMatrix.copy(rest).invert());
    correction.setFromRotationMatrix(rotation.extractRotation(delta)).invert();
    pivot.quaternion.multiply(correction);
    offset.setFromMatrixPosition(delta).applyQuaternion(pivot.quaternion);
    pivot.position.sub(offset);
  }
};
const offsetMatrix = new T.Matrix4();
})();
