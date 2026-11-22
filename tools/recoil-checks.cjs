// Executed in the full game's browser by check-aim.cjs.
module.exports = function checkRecoil() {
  const { VM, WeaponMotion: M, Player: P, Game } = G, a = Game.player;
  const failures = [], singles = [], bursts = [], rigs = [], support = [];
  const assert = (ok, detail) => { if (!ok) failures.push(detail); };
  const state = ads => ({ ads, sprint: false, crouch: false, moving: 0, phase: 0, lookDX: 0, lookDY: 0,
    landDip: 0, raise: 1, reload: null, pumpP: -1, cycleP: -1, empty: false, scope: null, hideVM: false });
  const prepare = (id, ads) => {
    const d = G.WEAPONS[id]; a.cur = d.cls;
    a.weapons[d.cls] = { id, mag: d.mag, scope: null, iron: true, attachments: {} };
    a.crouch = a.prone = false; P.ads = ads; VM.set(id); M.reset(VM);
    return d;
  };
  const values = () => Object.values(M.axes).flatMap(v => [v.x, v.v]);
  const savedReady = [G.M4Viewmodel, G.G17Pilot, ...Object.values(G.AssetVM.packs)].map(p => [p, p.ready]);
  try {
    assert(JSON.stringify(Object.keys(M.profiles)) === JSON.stringify(G.GUN_IDS), { phase: 'coverage' });
    for (const id of G.GUN_IDS) {
      const peaks = [];
      for (const ads of [0, 1]) {
        const d = prepare(id, ads), s = state(ads);
        M.fire(VM, d.kick);
        let back = 0, pitch = 0, backAt = 0, pitchAt = 0;
        for (let i = 1; i <= 240; i++) {
          M.update(VM, 1 / 240, s);
          if (M.axes.z.x > back) { back = M.axes.z.x; backAt = i / 240; }
          if (M.axes.pitch.x > pitch) { pitch = M.axes.pitch.x; pitchAt = i / 240; }
        }
        const row = { id, ads, back, pitchDegrees: pitch * 180 / Math.PI, backAt, pitchAt,
          residual: Math.max(...values().map(Math.abs)) };
        singles.push(row); peaks.push(pitch);
        assert(back > .005 && back < .08 && pitch > .005 && pitch < .25 && backAt < pitchAt && row.residual < 1e-5,
          { phase: 'single', ...row });
      }
      assert(peaks[1] < peaks[0] * .9, { phase: 'ADS support', id, peaks });
      for (const ads of [0, 1]) {
        let reference;
        for (const fps of [30, 60, 144]) {
          const d = prepare(id, ads), s = state(ads), interval = Math.max(60 / d.rpm, d.action === 'bolt' ? d.cycle : 0);
          let time = 0, nextShot = 0, peak = 0, back = 0;
          const samples = [];
          for (const target of [.025, .05, .1, .2, .35, .5, 1, 1.5, 2]) {
            while (time < target - 1e-10) {
              if (nextShot <= time + 1e-10 && nextShot < 1) { M.fire(VM, d.kick); nextShot += interval; }
              const end = Math.min(target, time + 1 / fps, nextShot < 1 ? nextShot : Infinity);
              M.update(VM, end - time, s); time = end;
              peak = Math.max(peak, M.axes.pitch.x); back = Math.max(back, M.axes.z.x);
            }
            samples.push(values());
          }
          const error = reference ? Math.max(...samples.flatMap((sample, i) => sample.map((v, j) => Math.abs(v - reference[i][j])))) : 0;
          reference ||= samples;
          const row = { id, ads, fps, peakDegrees: peak * 180 / Math.PI, maxBack: back, fpsError: error,
            residual: Math.max(...values().map(Math.abs)) };
          bursts.push(row);
          assert(peak > .005 && peak < .45 && back < .1 && error < 1e-6 && row.residual < 1e-5,
            { phase: 'burst', ...row });
        }
      }
    }
    for (const stance of ['standing', 'crouch', 'prone', 'attachments']) {
      const d = prepare('ar7', 1);
      a.crouch = stance === 'crouch'; a.prone = stance === 'prone';
      if (stance === 'attachments') a.weapons.rifle.attachments = { muzzle: 'compensator', under: 'grip', stock: 'tactical' };
      M.fire(VM, d.kick); M.update(VM, .05, state(1));
      support.push({ stance, pitch: M.axes.pitch.x, yaw: Math.abs(M.axes.yaw.x) });
    }
    assert(support[0].pitch > support[1].pitch && support[1].pitch > support[2].pitch &&
      support[3].pitch < support[0].pitch && support[3].yaw < support[0].yaw,
      { phase: 'stance and attachments', support });
    // Exercise the actual wrapper chain, not only the spring. All 15 weapons
    // must visibly move with the shared rig, including missing-asset fallback.
    for (const fallback of [false, true]) {
      if (fallback) for (const [pack] of savedReady) { pack.ready = false; if (pack.pivot) pack.pivot.visible = false; }
      for (const id of G.GUN_IDS) for (const ads of [0, 1]) {
        const d = prepare(id, ads), s = state(ads);
        VM.set(null); VM.set(id);
        for (let i = 0; i < 120; i++) VM.update(1 / 60, s);
        M.reset(VM); VM.update(1 / 240, s);
        const pack = G.AssetVM.pack(id), native = id === 'ar7' ? G.M4Viewmodel : id === 'g18' ? G.G17Pilot : null;
        const gun = pack?.gunBone || (native?.ready ? native.main : VM.models[id].gun);
        const holder = pack?.pivot || (native?.ready ? native.pivot : VM.models[id].root);
        G.vmScene.updateMatrixWorld(true);
        const start = gun.getWorldPosition(new THREE.Vector3()), startQ = gun.getWorldQuaternion(new THREE.Quaternion());
        VM.fireKick(d.kick, true);
        for (let i = 0; i < 12; i++) VM.update(1 / 240, s);
        G.vmScene.updateMatrixWorld(true);
        const distance = start.distanceTo(gun.getWorldPosition(new THREE.Vector3()));
        const angle = startQ.angleTo(gun.getWorldQuaternion(new THREE.Quaternion()));
        const row = { id, ads, fallback, distance, degrees: angle * 180 / Math.PI, visible: holder.visible };
        rigs.push(row);
        assert(holder.visible && Number.isFinite(distance) && distance > .001 && distance < .20 && angle > .003 && angle < .45,
          { phase: 'visible rig', ...row });
        for (let i = 0; i < 240; i++) VM.update(1 / 120, s);
        assert(VM.root.position.length() < 1e-6 && VM.root.quaternion.angleTo(new THREE.Quaternion()) < 1e-6,
          { phase: 'rig recovery', id, ads, fallback });
      }
    }
    prepare('ar7', 0); VM.fireKick(G.WEAPONS.ar7.kick); VM.update(.025, state(0));
    VM.set('p92');
    assert(VM.root.position.length() === 0 && VM.root.quaternion.w === 1 && M.pending.length === 0, { phase: 'switch reset' });
    VM.set(null);
    assert(M.axes === null && VM.root.position.length() === 0, { phase: 'unequip reset' });
  } finally {
    for (const [pack, ready] of savedReady) pack.ready = ready;
    VM.set(null); M.reset(VM);
  }
  return { singles, bursts, rigs, support, failures };
};
