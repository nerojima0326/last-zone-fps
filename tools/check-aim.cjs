
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// Real game ADS regression. Optional: CHROME_BIN, THREE_DIR, SHOTS, REPORT, BASELINE_VM.
const fs = require('fs'), http = require('http'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const checkShooting = require('./shooting-checks.cjs');
const checkRecoil = require('./recoil-checks.cjs');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };

function checkAim() {
  const { Player: P, VM, Game, AssetVM: AV } = G, a = Game.player;
  const failures = [], cases = [];
  let samples = 0, maxError = 0;
  // Let the preceding live shot finish its intentional recoil/fire animation.
  for (let i = 0; i < 120; i++) P.updateCamera(1 / 60);
  const error = point => {
    point.project(G.vmCamera);
    return Math.hypot(point.x * innerWidth / 2, point.y * innerHeight / 2);
  };
  const landmarks = (id, scope) => {
    if (!scope && G.WeaponCatalog[id]) {
      const m = VM.models[id], shape = G.WeaponCatalog[id].shape;
      const imported = G.Guns.gunData(id).extra;
      if (imported?.importedExpansion) return [imported.ironFront, imported.ironRear]
        .map(p => m.gun.localToWorld(m.toVM(new THREE.Vector3(...p))));
      // Authored front-post tip and rear-notch top, independent of VM.iron.
      const y = shape.style === 'pistol' ? .060 : .112;
      return [shape.style === 'pistol' ? -.116 : -.11 - shape.guard, shape.style === 'pistol' ? .031 : .058]
        .map(z => m.gun.localToWorld(m.toVM(new THREE.Vector3(0, y, z))));
    }
    const pack = AV.pack(id), M = id === 'ar7' ? G.M4Viewmodel : id === 'g18' ? G.G17Pilot : null;
    if (scope && M) {
      const dots = []; (M.opticRoot||M.mount).traverse(o => { if (o.isMesh && o.userData.lzReticle) dots.push(o); });
      if (dots.length !== 1) throw Error(id + ' missing visible optic reticle');
      return [dots[0].getWorldPosition(new THREE.Vector3())];
    }
    if (pack) {
      const matrix = pack.gunBone.matrixWorld.clone().multiply(pack.gunRestInv);
      if (scope) {
        const dots = []; pack.mountGroup.traverse(o => { if (o.isMesh && o.userData.lzReticle) dots.push(o); });
        if (dots.length !== 1) throw Error(id + ' missing visible optic reticle');
        return [dots[0].getWorldPosition(new THREE.Vector3())];
      }
      const S = pack.sight.iron || pack.sight;
      return [S.F.clone().applyMatrix4(matrix), S.R.clone().applyMatrix4(matrix)];
    }
    if (id === 'ar7') {
      // Measured mesh landmarks, independent of the runtime's cached aim offset:
      // rear aperture center and front post tip in Main_j's centimeter units.
      return [[.34094, 8.63109, -6.3], [.33915, 8.628555, 34.35]].map(v => M.main.localToWorld(new THREE.Vector3(...v)));
    }
    if (id === 'g18') {
      const point = M.ironOffset.clone().negate(); point.z -= .28;
      return [M.pivot.localToWorld(point)];
    }
    const model = VM.models[id], sight = VM.sightOf(model, scope);
    return [model.root.localToWorld(sight.sight.clone())];
  };
  for (const id of G.GUN_IDS) {
    const def = G.WEAPONS[id];
    for (const scope of [null, ...def.scopes.filter(s => s === 'reddot' || s === 'holo')]) {
      a.weapons[def.cls] = { id, mag: def.mag, scope, iron: !scope, attachments: {} }; a.cur = def.cls;
      Object.assign(P, { ads: 1, raise: 1, sw: null, reload: null, heal: null, cycleT: -1, pumpT: -1, camKick: 0, landDip: 0, lean: 0, sprinting: false });
      Object.assign(VM, { kick: 0, kickV: 0, kickRoll: 0, sprint: 0, camRX: 0, camRY: 0, camRZ: 0 });
      a.hspeed = 0; a.onGround = true; a.crouch = a.prone = false; G.FX.shakeAmt = 0;
      P.updateCamera(1 / 60);
      let worst = 0, blocked = null;
      for (const fps of [30, 60, 144]) {
        for (let frame = 0; frame < 12; frame++) {
          const pack = AV.pack(id);
          if (pack) pack.idleT = pack.acts.idle.dur * frame / 12;
          // Real mouse sway, walking/crouching and breathing used to move the
          // weapon independently of the camera's center ray, even at full ADS.
          G.Input.mdx = Math.sin(frame) * 90; G.Input.mdy = Math.cos(frame) * 70;
          a.hspeed = frame % 3 ? 0 : 2; a.crouch = frame % 4 === 0;
          a.yaw = frame * .13; a.pitch = Math.sin(frame) * .4; P.stepPhase = frame * .7;
          P.updateCamera(1 / fps); G.vmScene.updateMatrixWorld(true); G.vmCamera.updateMatrixWorld(true);
          for (const point of landmarks(id, scope)) {
            const pixels = error(point); samples++;
            if (!Number.isFinite(pixels)) throw Error(id + ' nonfinite ADS projection');
            worst = Math.max(worst, pixels); maxError = Math.max(maxError, pixels);
          }
          if (!scope && (pack?.sight.iron || id === 'ar7') && (frame === 0 || frame === 11)) {
            // A mathematically centered anchor is insufficient if the rear
            // sight/receiver still hides the front post. Check the actual mesh.
            const roots = pack ? (pack.swaps[id]?.groups || pack.gunMeshes) : [G.M4Viewmodel.model], meshes = new Set();
            for (const root of roots) root.traverse(o => {
              if (!o.isMesh) return;
              for (let p = o; p && p !== G.vmScene; p = p.parent) if (!p.visible) return;
              if (o.skeleton) o.skeleton.update(); meshes.add(o);
            });
            const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 6 / innerHeight), G.vmCamera);
            const hit = ray.intersectObjects([...meshes], false)[0];
            const points = landmarks(id, null), front = points[id === 'ar7' ? 1 : 0];
            if (hit && hit.distance < front.distanceTo(G.vmCamera.position) - .03) blocked = hit.object.name;
          }
        }
      }
      cases.push({ id, scope: scope || 'iron', maxPixels: worst, blocked });
      if (worst > .5 || blocked !== null) failures.push(cases[cases.length - 1]);
    }
  }
  G.Input.mdx = G.Input.mdy = 0;
  return { cases, samples, maxError, failures };
}

(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, headless: true,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
    if (process.env.THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => r.fulfill({
      contentType: 'application/javascript', body: fs.readFileSync(path.join(process.env.THREE_DIR, r.request().url().split('/three@0.160.0/')[1]))
    }));
    if (process.env.BASELINE_VM) await page.route(/\/js\/(asset-viewmodels|weapons|m4-viewmodel|g17-pilot)\.js\?/, r => r.fulfill({
      contentType: 'application/javascript', body: fs.readFileSync(path.join(process.env.BASELINE_VM, path.basename(new URL(r.request().url()).pathname)))
    }));
    await page.addInitScript(() => localStorage.setItem('lastzone_opts', JSON.stringify({ quality: 'potato', qv: 2, players: 24, loadout: 'all', fpsTarget: 60 })));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.G?.UI && document.querySelector('#loading.hidden'), null, { timeout: 180000 });
    await page.click('#trainBtn');
    await page.evaluate(async () => { for (const id of G.GUN_IDS) G.VM.ensure(id); await G.AssetVM.loadAll(); });
    await page.waitForFunction(() => G.Training.active && Object.keys(G.AssetVM.PACKS).every(k => G.AssetVM.packs[k]?.ready), null, { timeout: 240000 });
    await page.evaluate(() => {
      const a = G.Game.player, R = G.World.range;
      a.cur = 'rifle'; a.weapons.rifle.iron = true; a.weapons.rifle.scope = null;
      a.pos.set(R.x + 3.2, G.World.heightAt(R.x + 3.2, R.line - .8), R.line - .8);
      const t = G.Training.targets.find(t => !t.kh && !t.zone && !t.move && t.d === 10);
      const target = t.pivot.localToWorld(new THREE.Vector3(0, 1.15, 0));
      const dir = target.sub(a.pos.clone().add(new THREE.Vector3(0, a.eyeH(), 0))).normalize();
      a.yaw = Math.atan2(-dir.x, -dir.z); a.pitch = Math.asin(dir.y);
      G.paused = false; G.UI.showPause(false);
    });
    if (!await page.evaluate(() => G.Input.locked)) await page.locator('#app canvas').click({ force: true });
    await page.waitForFunction(() => G.Input.locked, null, { timeout: 10000 });
    await page.mouse.down({ button: 'right' });
    await page.waitForFunction(() => G.Player.ads === 1, null, { timeout: 30000 });
    await page.evaluate(() => {
      window.liveAimOnHit = G.Training.onHit;
      window.liveAimHits = [];
      G.Training.onHit = function(hit, ...args) { liveAimHits.push(hit.target.d); return liveAimOnHit.call(this, hit, ...args); };
    });
    for (const distance of [10, 50, 100]) {
      assert(await page.evaluate(distance => {
        window.liveAimHits = [];
        // 앞선 사격의 의도된 반동을 마친 뒤 다음 거리로 조준한다.
        for(let i=0;i<120;i++)G.Player.updateCamera(1/60);
        const a = G.Game.player, t = G.Training.targets.find(t => !t.kh && !t.zone && !t.move && t.d === distance);
        const target = t.pivot.localToWorld(new THREE.Vector3(0, 1.15, 0));
        const dir = target.sub(G.camera.position).normalize();
        a.yaw = Math.atan2(-dir.x, -dir.z); a.pitch = Math.asin(dir.y); G.Player.camKick = G.Player.recoilAcc = 0;
        G.FX.shakeAmt = 0; G.VM.camRX = G.VM.camRY = G.VM.camRZ = 0;
        G.Player.updateCamera(1 / 60); G.camera.updateMatrixWorld(true);
        return G.Training.hitTest(G.camera.position, G.camera.getWorldDirection(new THREE.Vector3()), 120)?.target === t;
      }, distance), 'Live ADS camera ray missed the ' + distance + 'm training target');
      const before = await page.evaluate(() => ({ ...G.Training.stats }));
      await page.mouse.down({ button: 'left' });
      await page.waitForFunction(n => G.Training.stats.shots > n, before.shots, { timeout: 15000 });
      await page.mouse.up({ button: 'left' });
      await page.waitForFunction(({ hits, distance }) => G.Training.stats.hits > hits && liveAimHits.includes(distance), { hits: before.hits, distance }, { timeout: 15000 });
      console.log('PASS: real right-mouse ADS and left-mouse shot hit the centered ' + distance + 'm training target.');
    }
    await page.evaluate(() => { G.Training.onHit = liveAimOnHit; delete window.liveAimOnHit; delete window.liveAimHits; });
    if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.SHOTS, 'training-ads.png') }); }
    await page.mouse.up({ button: 'right' });
    await page.evaluate(() => { G.onLockChange = () => {}; G.Input.unlock(); G.paused = true; G.UI.showPause(false); window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(100);
    const reports = [];
    for (const viewport of [{ width: 1280, height: 720 }, { width: 960, height: 720 }]) {
      await page.setViewportSize(viewport);
      const result = await page.evaluate(checkAim); reports.push({ viewport, ...result });
      console.log(JSON.stringify({ viewport, cases: result.cases.length, samples: result.samples, maxPixels: result.maxError, failures: result.failures }));
    }
    if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify(reports, null, 2));
    const shooting = await page.evaluate(checkShooting);
    if (process.env.REPORT) fs.writeFileSync(process.env.REPORT + '.shooting.json', JSON.stringify(shooting, null, 2));
    console.log(JSON.stringify({ impacts: shooting.impacts.length, maxImpactCm: shooting.maxImpactCm, recovery: shooting.recovery.length, reloads: shooting.reloads.length, failures: shooting.failures }));
    const recoil = await page.evaluate(checkRecoil);
    if (process.env.REPORT) fs.writeFileSync(process.env.REPORT + '.recoil.json', JSON.stringify(recoil, null, 2));
    console.log(JSON.stringify({ recoilSingles: recoil.singles.length, recoilBursts: recoil.bursts.length, visibleRigs: recoil.rigs.length, failures: recoil.failures }));
    assert.deepEqual(errors, []);
    assert(reports.every(r => r.failures.length === 0), 'ADS sight/reticle moved away from the crosshair; see failures above');
    assert.deepEqual(shooting.failures, [], 'Distance zero, recoil recovery or post-reload alignment regressed');
    assert.deepEqual(recoil.failures, [], 'Weapon recoil, frame-rate independence or native/fallback rig motion regressed');
    console.log('PASS: all 30 guns, iron/red-dot/holo sights, full idle clips, mouse/walk/crouch motion, 30/60/144 FPS, 16:9 and 4:3.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
