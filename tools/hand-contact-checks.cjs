// Runs in the shipped game. Geometry checks use deformed mesh vertices, not
// the fitter's target points, so a detached glove or wrong rig can be detected.
module.exports = function checkHandContacts() {
  const { VM, HandContact: H, Player: P, Game } = G, a = Game.player;
  const cases = [], failures = [], transitions = [], coordinates = [];
  const state = ads => ({ ads, sprint: false, crouch: false, moving: 0, phase: 0, lookDX: 0, lookDY: 0,
    landDip: 0, raise: 1, reload: null, pumpP: -1, cycleP: -1, empty: false, scope: null, hideVM: false });
  const prepare = (id, ads, fps) => {
    const d = G.WEAPONS[id]; a.cur = d.cls; a.crouch = a.prone = false;
    a.weapons[d.cls] = { id, mag: d.mag, scope: null, iron: true, attachments: {} };
    P.ads = ads; VM.set(null); VM.set(id);
    Object.assign(VM, { kick: 0, kickV: 0, slideT: 0, sprint: 0, kickRoll: 0 });
    VM.sway.x = VM.sway.y = 0; G.WeaponMotion.reset(VM);
    const s = state(ads); for (let i = 0; i < fps * 2; i++) VM.update(1 / fps, s);
    return { d, s };
  };
  const advance = (duration, fps, s) => { for (let t = 0; t < duration - 1e-9;) { const dt = Math.min(1 / fps, duration - t); VM.update(dt, s); t += dt; } };
  const inspect = (id, fps, pose) => {
    const measurement = HandGeometry.audit(id);
    const regions = Object.fromEntries(Object.entries(measurement.result).map(([k, v]) => [k, { samples: v.samples, count: v.count, depthMm: v.max * 1000 }]));
    const row = { id, fps, pose, regions }; cases.push(row);
    for (const [region, m] of Object.entries(regions)) {
      // Authored gloves have contact thickness; guard against a visible palm
      // buried in furniture, allowing the small existing seam at finger wraps.
      const free = pose.startsWith('reload');
      const limit = region.endsWith('palm') ? (free ? 10 : 6.5) : (free ? 15 : 11);
      if (!Number.isFinite(m.depthMm) || m.depthMm > limit) failures.push({ ...row, regions: undefined, region, ...m, worst: measurement.worst.slice(0, 2) });
    }
    if (!Object.keys(regions).some(k => k.startsWith('L:')) || !Object.keys(regions).some(k => k.startsWith('R:'))) failures.push({ id, fps, pose, reason: 'Missing visible left/right hand skin' });
    return measurement;
  };
  for (const id of G.GUN_IDS) for (const fps of [30, 60, 144]) {
    const { d, s } = prepare(id, 0, fps);
    const baseline = inspect(id, fps, 'hip');
    if (fps === 60) {
      // A rigid change of coordinates cannot change contact. Open asset meshes
      // make ray-parity volume tests fail this check; triangle crossings do not.
      const pos = VM.root.position.clone(), q = VM.root.quaternion.clone();
      VM.root.position.add(new THREE.Vector3(.13, -.07, .11));
      VM.root.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.43, .79, .31)));
      const rotated = HandGeometry.audit(id);
      const error = Math.max(...Object.entries(baseline.result).map(([key,r]) => Math.abs(r.max - rotated.result[key].max)));
      coordinates.push({ id, errorMm: error * 1000 });
      if (!Number.isFinite(error) || error > .0002) failures.push({ id, reason: 'Contact measurement changes under rigid rotation', errorMm: error * 1000 });
      VM.root.position.copy(pos); VM.root.quaternion.copy(q);
    }
    const restSkin = HandGeometry.skinSample(id);
    const grip = pose => {
      const skin = HandGeometry.skinSample(id), points = Object.entries(restSkin).filter(([k]) => skin[k]);
      const slip = Math.max(0, ...points.map(([k,p]) => Math.hypot(...p.map((v,i) => v - skin[k][i]))));
      if (!points.length || !Number.isFinite(slip) || slip > (id === 'db2' ? .012 : .004)) failures.push({ id, fps, pose, reason: 'Holding glove slips relative to the gun', slipMm: slip * 1000, points: points.length });
    };
    s.ads = P.ads = 1; advance(.5, fps, s); inspect(id, fps, 'ADS'); grip('ADS');
    s.ads = P.ads = 0; s.moving = 1; s.phase = 2.1; advance(.5, fps, s); inspect(id, fps, 'walk'); grip('walk');
    s.sprint = true; advance(.6, fps, s); inspect(id, fps, 'sprint'); grip('sprint');
    s.sprint = false; s.moving = 0; advance(.6, fps, s);
    VM.fireKick(d.kick, true); advance(.05, fps, s); inspect(id, fps, 'fire');
    advance(1.5, fps, s);
  }
  // Imported clips and procedural actions are sampled continuously. The
  // support hand must be free to leave the furniture and return to its grip.
  for (const id of G.GUN_IDS) for (const empty of [false, true]) {
    const fps = 60, { d, s } = prepare(id, 0, fps), samples = [.12, .4, .68, .92];
    const shell = d.reloadType === 'shell' || d.reloadType === 'break';
    const phases = shell ? ['start', 'load', 'last', 'end'] : [null];
    const initialMag = empty ? 0 : Math.max(1, d.mag - 2), style = G.Guns.rstyle(id);
    a.weapons[d.cls].mag = initialMag;
    for (const phase of phases) {
      const per = id === 'kr98' && empty ? 5 : d.reloadType === 'break' ? 2 : 1;
      a.weapons[d.cls].mag = phase === 'last' ? Math.max(0, d.mag - per) : initialMag;
      let index = 0;
      for (let frame = 0; frame <= 90; frame++) {
        const p = frame / 90;
        s.reload = { type: d.reloadType, empty, phase: phase === 'last' ? 'load' : phase, p, pp: phase === 'load' || phase === 'last' ? 0 : p, shellP: phase === 'load' || phase === 'last' ? p : -1, per, port: empty && (style.s === 'pump' || style.s === 'semi') };
        VM.update(1 / fps, s);
        if (index < samples.length && p >= samples[index]) { inspect(id, fps, `reload-${empty ? 'empty' : 'tactical'}-${phase || 'mag'}-${samples[index]}`); index++; }
      }
    }
    s.reload = null; advance(2, fps, s);
    const Pk = G.AssetVM.pack(id), N = id === 'ar7' ? G.M4Viewmodel : id === 'g18' ? G.G17Pilot : null;
    const model = Pk?.model || (N?.ready ? N.model : G.RealArms.copy);
    const frame = Pk ? H.frame(Pk.gunBone, Pk.gunRest, Pk.sight0.qInv) : N?.ready ? H.frame(N.main, N.mainRestMatrix, N.ironQ?.clone().invert()) : VM.models[id].gun.matrixWorld;
    const rig = H.bind(model, frame);
    const before = rig.hands.map(h => h.hand.position.clone());
    for (let n = 0; n < 100; n++) VM.update(0, s);
    const drift = Math.max(...rig.hands.map((h, i) => h.hand.position.distanceTo(before[i])));
    transitions.push({ id, empty, hands: rig.hands.map(h => h.hand.name), drift });
    if (rig.hands.length !== 2 || !Number.isFinite(drift) || drift > 1e-5) failures.push({ id, empty, phase: 'pose accumulation', drift, hands: rig.hands.length });
  }
  VM.set(null); return { cases, transitions, coordinates, failures };
};
