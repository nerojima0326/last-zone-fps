// Authored CC-BY-4.0 reload curves, retargeted to the game's existing contact rig.
(function () {
'use strict';
const G = window.G;
const IDS = new Set(['sc17', 'sa12', 'aa12', 'm1014', 'db2']);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const A = new Float64Array(12), B = new Float64Array(12), C = new Float64Array(12);
function sample(clip, t, out) {
  const f = clamp(t, 0, 1) * (clip.samples.length - 1), i = Math.floor(f);
  const a = clip.samples[i], b = clip.samples[Math.min(i + 1, clip.samples.length - 1)];
  for (let k = 0; k < 12; k++) out[k] = a[k] + (b[k] - a[k]) * (f - i);
  return out;
}
const R = G.ReloadAssets = {
  ready: false, data: null,
  async load() {
    try {
      const response = await fetch('assets/animations/reloads/motion.json?v=' + encodeURIComponent(window.LZ_BUILD || ''),
        { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw Error('HTTP ' + response.status);
      const data = await response.json();
      if (data.version !== 1) throw Error('Unsupported motion version');
      for (const id of ['magazine', 'magazineEmpty', 'shell']) {
        const c = data.clips[id];
        if (!(c.duration > 0) || c.samples.length < 2 || c.samples.length > 1200 ||
          !c.samples.every(row => row.length === 12 && row.every(Number.isFinite))) throw Error('Invalid motion: ' + id);
      }
      this.data = data; this.ready = true;
    } catch (error) {
      this.ready = false; this.data = null;
      console.info('[reloads] 기본 장전 모션 사용:', error.message);
    }
  },
  has(id) { return this.ready && IDS.has(id); },
  apply(m, reload, pose) {
    m.reloadMotion = null;
    if (!this.has(m.id)) return;
    const magazine = reload.type === 'mag';
    const clip = this.data.clips[magazine ? (reload.empty ? 'magazineEmpty' : 'magazine') : 'shell'];
    const progress = clamp(magazine ? reload.p : reload.phase === 'load' ? reload.shellP : reload.pp, 0, 1);
    const events = magazine ? (reload.empty ? m.keys.E : m.keys.Tac).T : null;
    const timeline = magazine ? [[0, 0], [events.grab ?? events.drop ?? events.knock, .1],
      [events.release, .2], [events.newMag, .3], [events.hook, .42],
      [events.seat, reload.empty ? .52 : .68], [events.chA, .72], [events.chRel, .82],
      [reload.empty ? events.endE : events.endT, .95], [1, 1]]
      .filter(([p]) => Number.isFinite(p)).sort((a, b) => a[0] - b[0]) : null;
    const phaseTime = p => {
      if (!magazine) return reload.phase === 'start' ? p * .1 : reload.phase === 'load' ? .1 + p * .2 : .8 + p * .2;
      for (let i = 1; i < timeline.length; i++) {
        const [x, a] = timeline[i - 1], [y, b] = timeline[i];
        if (p <= y) return a + (b - a) * clamp((p - x) / Math.max(1e-6, y - x), 0, 1);
      }
      return 1;
    };
    // Shotgun source loads several shells. Retarget one complete belt-to-port
    // cycle per gameplay shell, then preserve the interruption/closing phases.
    const t = phaseTime(progress);
    sample(clip, t, A);
    if (!magazine && reload.phase === 'load') {
      sample(clip, .1, B); sample(clip, .3, C);
      for (let k = 6; k < 12; k++) A[k] -= (C[k] - B[k]) * progress;
    }
    if (!magazine && reload.phase === 'end') {
      sample(clip, .1, B); sample(clip, .8, C);
      for (let k = 6; k < 12; k++) A[k] += (B[k] - C[k]) * (1 - progress);
    }
    const weight = magazine ? smooth(progress / .1) * smooth((1 - progress) / .12)
      : reload.phase === 'start' ? smooth(progress / .25)
      : reload.phase === 'end' ? smooth((1 - progress) / .25) : 1;
    // Most of the weapon's broad movement now comes from the authored clip.
    // Keep the procedural part/contact system for magwell, handle and shell locks.
    const blend = weight * .7;
    pose.rx = pose.rx * (1 - blend) + clamp(A[9], -.5, .5) * blend;
    pose.ry = pose.ry * (1 - blend) + clamp(A[10], -.4, .4) * blend;
    pose.rz = pose.rz * (1 - blend) + clamp(A[11], -.85, .85) * blend;
    for (const [key, index, limit] of [['x', 6, .06], ['y', 7, .07], ['z', 8, .09]])
      pose[key] = pose[key] * (1 - blend) + clamp(A[index], -limit, limit) * blend;

    // Transfer the source wrist's curved flight between semantic contact events.
    // At every event the displacement is zero; loaded ammo and contact timing are
    // still controlled by Player. Loose magazines follow the solved hand.
    const knots = magazine ? [0, events.grab, events.out, events.release, events.newMag,
      events.hook, events.seat, events.chA, events.chB, events.chRel, 1]
      .filter(Number.isFinite).sort((a, b) => a - b) : [0, .22, .4, .62, .77, 1];
    let lo = 0, hi = 1;
    for (const k of knots) { if (k <= progress) lo = k; else { hi = k; break; } }
    sample(clip, phaseTime(lo), B); sample(clip, phaseTime(hi), C);
    const u = hi > lo ? (progress - lo) / (hi - lo) : 0;
    const free = ['reach', 'shellReach'].includes(m.armL.contactMode) ||
      (m.holdObj && m.armL.contactMode === 'magazine');
    let movement = 0;
    if (free) {
      const gain = Math.sin(Math.PI * u) ** 2 * .45 * m.s / 1.54;
      const delta = [0, 1, 2].map(i => clamp((A[i] - B[i] - (C[i] - B[i]) * u) * gain, -.035, .035));
      // Preserve the safe outside approach around the gun's receiver.
      delta[0] = -Math.abs(delta[0]); delta[1] = -Math.abs(delta[1]);
      m.armL.tgt.x += delta[0]; m.armL.tgt.y += delta[1]; m.armL.tgt.z += delta[2];
      movement = Math.hypot(...delta);
    }
    m.reloadMotion = { sourceClip: clip.sourceClip, time: t, weight: blend, handDisplacement: movement };
  }
};
})();
