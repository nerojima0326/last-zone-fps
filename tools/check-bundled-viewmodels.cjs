// CHROME_BIN and THREE_DIR are optional. No manual file selection or cached models.
const fs = require('fs'), http = require('http'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const longGuns = { sc17: 'Rifle_Battle_West.glb', m1014: 'Shotgun_Pump_East.glb',
  sa12: 'Shotgun_Auto_East.glb', aa12: 'Shotgun_Auto_West.glb', db2: 'doublebarrelshotgun.gltf' };
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, headless: true,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [], requests = [], scripts = [], gunRequests = [];
    page.on('request', r => { if (/\/js\/[^/]+\.js\?/.test(r.url())) scripts.push(r.url()); });
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().includes('/models/viewmodels/')) requests.push(r.status()); });
    page.on('response', r => { if (/\/models\/guns\/(sc17|m1014|sa12|aa12|db2)\.glb/.test(r.url())) gunRequests.push({ url: r.url(), status: r.status() }); });
    await page.route('https://fonts.googleapis.com/**', r => r.abort());
    if (process.env.THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => route.fulfill({
      contentType: 'application/javascript', body: fs.readFileSync(path.join(process.env.THREE_DIR, route.request().url().split('/three@0.160.0/')[1]))
    }));
    await page.addInitScript(() => {
      localStorage.setItem('lastzone_opts', JSON.stringify({ quality: 'potato', qv: 2, players: 24, loadout: 'all', fpsTarget: 60 }));
      // Automatic models must also work when browser-local file storage is unavailable.
      Object.defineProperty(window, 'indexedDB', { get() { throw Error('Device storage unavailable'); } });
    });
    const url = `http://127.0.0.1:${server.address().port}/`;
    const ready = () => page.waitForFunction(() => window.G?.UI && document.querySelector('#menu:not(.hidden)') && document.querySelector('#loading.hidden'), null, { timeout: 180000 });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await ready();
    const build = await page.evaluate(() => window.LZ_BUILD);
    assert(scripts.length > 20, 'Game scripts did not load');
    assert(scripts.every(url => new URL(url).searchParams.get('v') === build), 'Script cache version differs from page build');
    for (let visit = 0; visit < 2; visit++) {
      const models = await page.evaluate(() => ({ m4: G.M4Viewmodel.ready, glock: G.G17Pilot.ready,
        m4Status: document.querySelector('#m4Status').textContent, glockStatus: document.querySelector('#g17Status').textContent,
        inputsEmpty: [...document.querySelectorAll('input[type=file]')].every(i => !i.files.length) }));
      assert(models.m4 && models.glock && models.inputsEmpty, JSON.stringify(models));
      assert(models.m4Status.includes('자동 적용') && models.glockStatus.includes('자동 적용'), JSON.stringify(models));
      const bundled = await page.evaluate(expected => Object.entries(expected).map(([id, source]) => {
        const data = G.GunModels.data(id), vm = G.VM.models[id];
        return { id, loaded: data?.sourceAsset === source && vm?.real && data.muzzle.toArray().every(Number.isFinite),
          parts: Object.keys(data?.parts || {}) };
      }), longGuns);
      assert(bundled.every(g => g.loaded && g.parts.includes('body')), JSON.stringify(bundled));
      for (const id of ['sc17', 'sa12', 'aa12']) assert(bundled.find(g => g.id === id).parts.includes('mag'), id + ' missing movable magazine');
      assert(bundled.find(g => g.id === 'db2').parts.includes('barrel'), 'DB-2 missing break-action barrels');
      assert(!bundled.find(g => g.id === 'm1014').parts.includes('pump'), 'Semi-auto shotgun must use a fixed fore-end');
      if (!visit) { await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); }
    }
    await page.click('#trainBtn');
    await page.waitForFunction(() => G.Game.training && G.Training.active, null, { timeout: 30000 });
    const gameplay = await page.evaluate(expected => {
      G.Input.unlock(); G.paused = true;
      const state = { ads: 0, raise: 1, phase: 0, moving: 0, landDip: 0, lookDX: 0, lookDY: 0, sprint: false, hideVM: false, reload: null };
      for (const [id, model] of [['ar7', G.M4Viewmodel], ['g18', G.G17Pilot]]) {
        // Calibrate in idle, then mount the same optic during the first draw/reload.
        model.sample('Idle',0); model.mountKey=null; model.syncAttachments('reddot');
        const reference=model.aimOffset.clone();
        G.VM.set(null);G.VM.update(.016,state);G.VM.set(id);
        model.mountKey=null;G.VM.update(.016,{...state,scope:'reddot'});
        if (reference.distanceTo(model.aimOffset)>1e-8) throw Error('First equip changed ADS alignment: '+id);
        for(const empty of [false,true]) {
          model.mountKey=null;G.VM.update(.016,{...state,scope:'reddot',reload:{type:'mag',empty,p:.55}});
          if (reference.distanceTo(model.aimOffset)>1e-8) throw Error('Reload changed ADS alignment: '+id);
        }
        G.VM.set(id); G.VM.update(1, state);
        if (!model.pivot.visible || G.VM.models[id].root.visible) throw Error('Replacement not shown: ' + id);
        for (const empty of [false, true]) {
          G.VM.update(.016, { ...state, reload: { type: 'mag', empty, p: .5 } });
          if (!model.name.startsWith('Reload')) throw Error('Missing reload: ' + id);
        }
        G.VM.fireKick(1, false); G.VM.update(.016, state);
        if (model.name !== 'Fire') throw Error('Missing fire: ' + id);
        G.renderNow();
      }
      for (const id of Object.keys(expected)) {
        G.VM.set(id); G.VM.update(1, state);
        const model = G.VM.models[id];
        if (!model.root.visible || !model.real) throw Error('Bundled gun not shown: ' + id);
        G.VM.fireKick(1, false); G.VM.update(.016, { ...state, ads: 1, scope: 'reddot' });
        model.root.updateMatrixWorld(true);
        model.root.traverse(o => { if (!o.matrixWorld.elements.every(Number.isFinite)) throw Error('Nonfinite gun transform: ' + id); });
        const thirdPerson = G.Guns.tpModel(id, true);
        if (!thirdPerson) throw Error('Missing loot/third-person gun: ' + id);
        G.renderNow();
      }
      return { m4: G.M4Viewmodel.ready, glock: G.G17Pilot.ready, longGuns: Object.keys(expected) };
    }, longGuns);
    assert.equal(gunRequests.length, 10, 'Each long gun must load automatically on both visits');
    assert(gunRequests.every(r => r.status === 200 && new URL(r.url).searchParams.get('v') === build), JSON.stringify(gunRequests));
    assert.deepEqual(requests, [200, 200, 200, 200]);
    assert.deepEqual(errors, []);
    // Missing hosted files must not prevent entering the game with its original models.
    await page.route('**/assets/models/viewmodels/**', r => r.fulfill({ status: 404, body: '' }));
    await page.route(/\/assets\/models\/guns\/(sc17|m1014|sa12|aa12|db2)\.glb/, r => r.fulfill({ status: 404, body: '' }));
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
    const fallback = await page.evaluate(() => !G.M4Viewmodel.ready && !G.G17Pilot.ready &&
      document.querySelector('#m4Status').textContent.includes('실패') && document.querySelector('#g17Status').textContent.includes('실패'));
    assert(fallback, 'Missing-file fallback failed');
    const longGunFallback = await page.evaluate(ids => ids.every(id => !G.GunModels.has(id) && !G.VM.models[id].real), Object.keys(longGuns));
    assert(longGunFallback, 'Missing long-gun files must use the procedural fallback');
    assert.deepEqual(errors, []);
    console.log('PASS', { visits: 2, requests, gameplay, fallback, errors });
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
