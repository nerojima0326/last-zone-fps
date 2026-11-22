// Runs inside the real game's browser context (called by check-aim.cjs).
module.exports = function checkShooting() {
  const { Player: P, Game, VM, Training: T, Ballistics: B } = G, a = Game.player;
  const range = G.World.range, failures = [], impacts = [], recovery = [], reloads = [];
  const targetState = T.targets.map(t => ({ t, hp: t.hp, down: t.down, fall: t.fall }));
  const random = Math.random, onHit = T.onHit;
  let captured = [];
  const prepare = (id, distance = 10) => {
    const def = G.WEAPONS[id];
    G.Input.reset(); G.Input.rmb = true;
    a.cur = def.cls; a.weapons[def.cls] = { id, mag: def.mag, scope: null, iron: true, attachments: {} };
    a.ammo[def.ammo] = 1000; a.hspeed = 0; a.onGround = true; a.crouch = a.prone = false;
    a.pos.set(range.x + 3.2, G.World.heightAt(range.x + 3.2, range.line - .8), range.line - .8);
    a.vel.set(0, 0, 0);
    Object.assign(P, { ads: 1, raise: 1, sw: null, reload: null, autoReload: null, heal: null, throwSt: null,
      cycleT: -1, pumpT: -1, camKick: 0, landDip: 0, lean: 0, sprinting: false, bloom: 0,
      recoilAcc: 0, lastShot: -99, nextFire: 0, fireMode: 'auto', camY: a.pos.y + a.eyeH() });
    Object.assign(VM, { kick: 0, kickV: 0, kickRoll: 0, sprint: 0, camRX: 0, camRY: 0, camRZ: 0 });
    VM.sway.x = VM.sway.y = 0; G.FX.shakeAmt = 0;
    for (const t of T.targets) { t.down = 0; t.fall = 0; t.hp = 1e9; t.pivot.rotation.x = 0; t.root.updateMatrixWorld(true); }
    const target = T.targets.find(t => !t.kh && !t.zone && !t.move && t.d === distance);
    if (!target) throw Error('Missing ' + distance + 'm training target');
    const point = target.pivot.localToWorld(new THREE.Vector3(0, 1.15, 0));
    const dir = point.clone().sub(a.pos.clone().add(new THREE.Vector3(0, a.eyeH(), 0))).normalize();
    a.yaw = Math.atan2(-dir.x, -dir.z); a.pitch = Math.asin(dir.y);
    P.updateCamera(1 / 60); G.camera.updateMatrixWorld(true);
    return { def, inst: a.weapons[def.cls], target, point };
  };
  const step = dt => {
    Game.time += dt; P.update(dt); B.update(dt); G.FX.update(dt); G.Input.endFrame();
  };
  const aimError = id => {
    const pack = G.AssetVM.pack(id); let point;
    G.vmScene.updateMatrixWorld(true); G.vmCamera.updateMatrixWorld(true);
    if (pack) point = (pack.sight.iron || pack.sight).F.clone().applyMatrix4(pack.gunBone.matrixWorld.clone().multiply(pack.gunRestInv));
    else if (id === 'ar7') point = G.M4Viewmodel.main.localToWorld(G.M4Viewmodel.ironLocal.clone());
    else if (id === 'g18') { point = G.G17Pilot.ironOffset.clone().negate(); point.z -= .28; G.G17Pilot.pivot.localToWorld(point); }
    else point = VM.models[id].root.localToWorld(VM.models[id].iron.sight.clone());
    point.project(G.vmCamera); return Math.hypot(point.x * innerWidth / 2, point.y * innerHeight / 2);
  };
  try {
    // Isolate systematic zero from intentional random spread and muzzle-speed
    // variation. The live mouse-input test separately fires unmodified weapons.
    Math.random = () => .5;
    T.onHit = function(hit, damage, point, dir, shot) { captured.push({ target: hit.target, point: point.clone() }); return onHit.call(this, hit, damage, point, dir, shot); };
    for (const id of G.GUN_IDS) for (const distance of [10, 50, 100]) for (const fps of [30, 60, 144]) {
      B.reset(); captured = [];
      const { def, inst, target, point } = prepare(id, distance);
      const nominal = { ...def, spread: 0, ads: 0, move: 0, bloom: 0 };
      P.fire(nominal, inst, P.time);
      for (let frame = 0; B.list.length && frame < fps * 3; frame++) B.update(1 / fps);
      const hit = captured.find(h => h.target === target), cm = hit ? hit.point.distanceTo(point) * 100 : Infinity;
      const row = { id, distance, fps, hit: !!hit, errorCm: cm }; impacts.push(row);
      if (!hit || cm > 1) failures.push({ phase: 'impact', ...row });
    }
    T.onHit = onHit;
    for (const id of G.GUN_IDS) {
      B.reset(); const { def } = prepare(id), count = Math.min(5, def.mag - 1), start = T.stats.shots;
      let peakKick = 0;
      for (let frame = 0; T.stats.shots - start < count && frame < 600; frame++) {
        G.Input.lmb = !!def.auto; G.Input.lmbHit = !def.auto;
        step(1 / 60); peakKick = Math.max(peakKick, P.camKick);
      }
      G.Input.lmb = G.Input.lmbHit = false;
      for (let frame = 0; frame < 240; frame++) step(1 / 60);
      const error = aimError(id), row = { id, shots: T.stats.shots - start, peakKick, camKick: P.camKick, recoilAcc: P.recoilAcc, aimPixels: error };
      recovery.push(row);
      if (row.shots !== count || peakKick <= 0 || P.camKick > 1e-6 || P.recoilAcc > 1e-6 || !Number.isFinite(error) || error > .5) failures.push({ phase: 'recovery', ...row });
      for (const empty of [false, true]) {
        const { inst } = prepare(id), initial = empty ? 0 : Math.max(1, Math.floor(def.mag / 2)); inst.mag = initial;
        const reserve = a.ammo[def.ammo]; P.startReload();
        if (!P.reload) throw Error(id + ' reload failed to start');
        let tail = 0, frames = 0;
        for (; frames < 1200 && tail < 90; frames++) { step(1 / 60); tail = !P.reload && P.ads === 1 ? tail + 1 : 0; }
        const error = aimError(id), row = { id, empty, frames, mag: inst.mag, aimPixels: error, ads: P.ads };
        reloads.push(row);
        if (P.reload || P.ads !== 1 || inst.mag !== def.mag || a.ammo[def.ammo] !== reserve - (def.mag - initial) || !Number.isFinite(error) || error > .5) failures.push({ phase: 'reload', ...row });
      }
    }
  } finally {
    Math.random = random; T.onHit = onHit; B.reset(); G.Input.reset();
    for (const s of targetState) { s.t.hp = s.hp; s.t.down = s.down; s.t.fall = s.fall; }
  }
  return { impacts, recovery, reloads, failures, maxImpactCm: Math.max(...impacts.map(r => r.errorCm)) };
};
