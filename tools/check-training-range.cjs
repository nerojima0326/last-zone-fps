// CHROME_BIN, THREE_DIR, SHOTS and RANGE_FALLBACK=1 are optional.
// Runs the real game: training entry, pickups, shooting, cover collision and repeat entry.
const fs = require('fs'), http = require('http'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };

async function checkBindings(page) {
  await page.click('#settingsBtn');
  await page.click('button.kb[data-act="KeyW"]');
  await page.keyboard.press('s');
  await page.click('button.kr[data-act="KeyW"]');
  assert.deepEqual(await page.evaluate(() => ['KeyW', 'KeyS'].map(k => G.Input.map(k))), ['KeyW', 'KeyS']);
  assert.equal(await page.locator('button.kr[data-act="KeyS"]').count(), 0);
  await page.click('button.kb[data-act="KeyF"]');
  await page.keyboard.press('j');
  assert.equal(await page.locator('kbd[data-k="KeyF"]').textContent(), 'J');
  await page.keyboard.press('Escape');
  assert(await page.locator('#settingsPanel').isHidden());
}

function checkTrainingLifecycle() {
  const { Game, Training, Vehicles, World, Player } = G;
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const v = Vehicles.list[0];
  const countCells = () => World.grid.reduce((n, cell) => n + cell.length, 0);
  const cells = countCells(), boxes = World.boxes.length;
  for (let i = 0; i < 12; i++) {
    Vehicles.enter(Player, v);
    Vehicles.exit(Player);
  }
  check(countCells() === cells && World.boxes.length === boxes, 'Repeated parking leaked colliders');
  const collider = v.box;
  let matches = 0;
  World.queryBoxes(collider.minX, collider.minZ, collider.maxX, collider.maxZ, b => { if (b === collider) matches++; });
  check(matches === 1, 'Parked vehicle collision missing or duplicated');

  Game.time += 0.5; Training.update(0);
  const kind = 'att_under_grip', slots = Training.items.length;
  const pickup = () => Game.pickup(Game.player, Training.items.find(it => it.kind === kind && !it.taken));
  check(pickup(), 'Pickup before respawn');
  Game.time += 0.41; Training.update(0);
  check(Training.items.length === slots && Training.items.filter(it => it.kind === kind).length === 1, 'Pickup retained stale table entries');
  check(pickup(), 'Pickup before range exit');
  const opts = { ...G.UI.opts, mode: 'training' };
  G.toMenu(); G.startGame(opts); G.paused = true;
  Game.time += 0.5; Training.update(0);
  check(Training.items.filter(it => it.kind === kind).length === 1, 'Old range respawn leaked into a new session');
  const shot = Training.onShot(), target = Training.targets[0];
  for (let i = 0; i < 3; i++) Training.onHit({ target, head: true }, 1, target.root.position, new THREE.Vector3(0, 0, -1), shot);
  check(Training.stats.shots === 1 && Training.stats.hits === 1 && Training.stats.heads === 1, 'Pellets counted as separate trigger pulls');
}

function checkMatchLifecycle() {
  const { Game, Player, Stats, Vehicles } = G;
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const player = Game.player, enemy = Game.actors.find(a => a.team !== player.team);
  check(Game.actors.length === G.UI.opts.players && Game.teams.length === Math.ceil(Game.actors.length / 2), 'Duo team setup');
  Game.updatePlane(8); Game.jump(player); Game.openChute(player); Game.land(player);
  Player.onLand(); enemy.state = 'ground';
  const model = enemy.model;
  model.setLOD(true, true);
  check(model.lodMesh.visible && !model.body.visible && !model.soldier?.root.visible, 'Distant character still renders detailed mesh');
  model.setLOD(false, false);
  check(!model.lodMesh.visible && model.body.visible && (!model.soldier || model.soldier.root.visible), 'Near character failed to restore');

  const a = new G.Actor({ id: 999, team: 1, isPlayer: true }), def = G.WEAPONS.ar7;
  a.give('ar7'); a.ammo[def.ammo] = a.ammoMax(def.ammo) - 2;
  const duplicate = { kind: 'ar7', mag: 19, scope: 'x4', attachments: { under: 'grip' } };
  check(a.pickup(duplicate) && !duplicate.taken && duplicate.mag === 17 && a.scopes.x4 === 1 && !a.weapons.rifle.scope, 'Partial duplicate pickup lost items or changed the active optic');
  check(!a.pickup(duplicate) && duplicate.mag === 17, 'Repeated pickup duplicated ammo');
  const car = Vehicles.list[0], bot = enemy.brain;
  bot.carGoal = car; car.claim = enemy; bot.setGoal(car.pos, 'car');
  enemy.pos.copy(car.pos); enemy.pos.x += 18;
  bot.goalT = 61; bot.navigate(0, new THREE.Vector3());
  check(!bot.goal && !bot.carGoal && !car.claim, 'Abandoned vehicle stayed reserved');

  const shot1 = Stats.onShot(), shot2 = Stats.onShot();
  for (const shot of [shot2, shot1, shot2]) Game.damage(enemy, 1, player, 'ar7', false, null, null, shot);
  check(Stats.m.shots === 2 && Stats.m.hits === 2, 'Overlapping shots lost or duplicated a hit');
  const mate = Game.teams[player.team].members.find(a => a !== player);
  mate.state = 'ground'; Game.knock(mate, enemy, 'ar7', false); Game.revive(mate, player);
  check(mate.alive && !mate.knocked && mate.hp === 25, 'Team revive');
  Game.kill(player, enemy, 'ar7', false); Game.kill(mate, enemy, 'ar7', false);
  check(Game.pendingResult && Game.state === 'playing', 'Defeat skipped killcam delay');
  Game.time = Game.pendingResult.at; Game.update(0);
  const endedAt = Game.time, matches = Stats.data.matches;
  Game.update(1);
  check(Game.state === 'ended' && Game.time === endedAt && Stats.data.matches === matches, 'Results kept simulating');
  Game.startSpectate(); Game.update(1 / 60);
  check(Game.spectating && Game.time > endedAt, 'Spectating failed to resume simulation');
  Game.stopSpectate(); G.toMenu();
}

(async () => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.resolve(root, '.' + (rel === '/' ? '/index.html' : rel));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, headless: true,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], assetResponses = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()); });
    page.on('response', r => { if (r.url().includes('/assets/patch/range/')) assetResponses.push({ url: r.url().split('/range/')[1], status: r.status() }); });
    if (process.env.THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => {
      const file = path.join(process.env.THREE_DIR, route.request().url().split('/three@0.160.0/')[1]);
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
    if (process.env.RANGE_FALLBACK) await page.route('**/assets/patch/range/**', route => route.abort());
    await page.addInitScript(() => localStorage.setItem('lastzone_opts', JSON.stringify({ quality: 'low', qv: 2, tod: 'day', players: 24, loadout: 'all', fpsTarget: 60 })));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.waitForFunction(() => window.G && G.UI && document.querySelector('#menu:not(.hidden)'), null, { timeout: 180000 });
    console.log('Full game menu ready');
    await checkBindings(page);
    await page.click('#trainBtn');
    await page.waitForFunction(() => G.Game.training && G.Training.active, null, { timeout: 30000 });
    await page.evaluate(() => { G.Input.unlock(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { G.paused = true; G.UI.showPause(false); G.scene.updateMatrixWorld(true); });
    const loaded = await page.evaluate(() => {
      const R = G.World.range, props = R.props;
      return { version: window.LZ_BUILD, booths: props.booths, bags: props.sandbags.length, crates: props.crates.length,
        cases: props.ammoCases.length, targets: G.Training.targets.length,
        guns: G.Training.items.filter(i => G.GUN_IDS.includes(i.kind)).length,
        attachments: G.Training.items.filter(i => i.kind.startsWith('att_')).length,
        attachmentCatalog: Object.keys(G.Attachments.catalog()).length,
        importedSandbags: !!G.RangeProps.models.sandbag.getObjectByName('sandbags'),
        floorTexture: !!G.RangeProps.textures.map,
        instances: props.group.children.filter(c => c.isInstancedMesh).map(c => ({ name: c.name, count: c.count })) };
    });
    console.log('Training assets:', JSON.stringify(loaded));
    assert.equal(loaded.booths, 4); assert(loaded.bags >= 8); assert(loaded.crates >= 4); assert(loaded.cases >= 4);
    assert.equal(loaded.targets, 14); assert.equal(loaded.guns, 15); assert.equal(loaded.attachments, loaded.attachmentCatalog);
    assert.equal(loaded.importedSandbags, !process.env.RANGE_FALLBACK); assert.equal(loaded.floorTexture, !process.env.RANGE_FALLBACK);
    if (!process.env.RANGE_FALLBACK) { assert.equal(assetResponses.length, 5); assert(assetResponses.every(r => r.status === 200)); }

    const checks = await page.evaluate(() => {
      const W = G.World, R = W.range, T = G.Training;
      const ensure = (ok, msg) => { if (!ok) throw new Error(msg); };
      const o = new THREE.Vector3(R.x + 3.2, W.heightAt(R.x + 3.2, R.line - 0.8) + 1.62, R.line - 0.8);
      let clearTargets = 0;
      for (const target of T.targets) {
        const p = target.pivot.localToWorld(new THREE.Vector3(0, target.kind === 'gong' ? target.cy : 1.15, 0));
        const dir = p.clone().sub(o), distance = dir.length(); dir.normalize();
        ensure(!W.raycast(o, dir, distance - 0.05), 'Target sightline blocked at ' + target.d + ' m');
        ensure(T.hitTest(o, dir, distance + 0.1), 'Target cannot be hit at ' + target.d + ' m');
        clearTargets++;
      }
      const b = R.props.sandbags[0], x = (b.minX + b.maxX) / 2;
      const hit = W.raycast(new THREE.Vector3(x, (b.minY + b.maxY) / 2, b.maxZ + 1), new THREE.Vector3(0, 0, -1), 3);
      ensure(hit && W.hit.box === b && W.hit.mat === 'soft', 'Sandbag does not stop a bullet');
      const probe = new G.Actor({ id: 998, name: 'collision probe', team: 0 });
      probe.state = 'ground'; probe.onGround = true; probe.pos.set(x, W.heightAt(x, b.maxZ + 1), b.maxZ + 1);
      for (let i = 0; i < 120; i++) { probe.vel.set(0, 0, -3); G.Physics.move(probe, 1 / 60); }
      ensure(probe.pos.z >= b.maxZ + G.Physics.R - 0.02, 'Player can walk through sandbag cover');
      probe.pos.set(R.x - 14, R.y + 0.075, R.line + 4.8); probe.vel.set(0, 0, 0);
      for (let i = 0; i < 240; i++) { probe.vel.x = 7; probe.vel.z = 0; G.Physics.move(probe, 1 / 60); }
      ensure(probe.pos.x > R.x + 13, 'Rear booth aisle is blocked');
      const item = T.items.find(i => i.kind === 'att_under_grip');
      ensure(item && G.Game.pickup(G.Game.player, item), 'Attachment pickup broken');
      const target = T.targets.find(t => t.kind === 'sil' && t.d === 7 && t.x > R.x);
      const point = target.pivot.localToWorld(new THREE.Vector3(0, 1.15, 0));
      G.camera.position.copy(o); G.camera.lookAt(point); G.camera.updateMatrixWorld(true);
      const player = G.Game.player, weapon = player.weapons.rifle;
      player.cur = 'rifle'; G.VM.set(weapon.id);
      const originalSpread = G.Player.currentSpread; G.Player.currentSpread = () => 0;
      try { G.Player.fire(G.WEAPONS[weapon.id], weapon, G.U.now()); } finally { G.Player.currentSpread = originalSpread; }
      for (let i = 0; i < 120; i++) G.Ballistics.update(1 / 120);
      T.flush(); ensure(T.stats.hits >= 1, 'Actual weapon shot did not damage training target');
      return { clearTargets, bulletBlocked: true, walkingBlocked: true, aisleClear: true, attachmentPickup: true, shotHits: T.stats.hits };
    });
    console.log('Gameplay:', JSON.stringify(checks));
    assert((await page.locator('#centerMsg').textContent()).includes('J'));
    await page.evaluate(checkTrainingLifecycle);

    if (process.env.SHOTS) {
      fs.mkdirSync(process.env.SHOTS, { recursive: true });
      await page.evaluate(() => {
        G.paused = true; G.UI.showPause(false); document.getElementById('hud').classList.add('hidden');
        G.vmScene.visible = false; G.renderer.setPixelRatio(1); G.renderer.setSize(1440, 900);
        window.__rangeTestRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = () => 0;
        document.getElementById('fpsBox').style.display = 'none';
      });
      for (const view of [{ name: 'training-range-overview', p: [36, 12, 72], target: [0, 1, 31] },
        { name: 'training-range-supply', p: [-17, 2.8, 55], target: [-25, 1, 49] },
        { name: 'training-range-booths', p: [12, 2.3, 52], target: [-6, 1.3, 43] }]) {
        await page.evaluate(view => {
          const R = G.World.range;
          G.camera.fov = 66; G.camera.updateProjectionMatrix();
          G.camera.position.set(R.x + view.p[0], R.y + view.p[1], R.z + view.p[2]);
          G.camera.lookAt(R.x + view.target[0], R.y + view.target[1], R.z + view.target[2]);
          G.World.updateLOD(G.camera.position, true); G.renderer.shadowMap.needsUpdate = true;
          G.renderNow();
        }, view);
        await page.screenshot({ path: path.join(process.env.SHOTS, view.name + '.png'), timeout: 90000 });
      }
      await page.evaluate(() => { window.requestAnimationFrame = window.__rangeTestRAF; });
    }
    await page.evaluate(() => { G.toMenu(); G.vmScene.visible = true; });
    await page.click('#trainBtn');
    const repeated = await page.evaluate(() => ({ targets: G.Training.targets.length,
      groups: G.scene.children.filter(c => c.name === 'training-range-props').length,
      crates: G.World.range.props.crates.length, version: window.LZ_BUILD }));
    assert.equal(repeated.targets, loaded.targets); assert.equal(repeated.groups, 1);
    await page.evaluate(() => G.toMenu());
    await page.click('button.mode[data-size="2"]');
    await page.click('#startBtn');
    await page.evaluate(checkMatchLifecycle);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS:', JSON.stringify({ ...loaded, checks, repeated, errors, assets: assetResponses }));
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
