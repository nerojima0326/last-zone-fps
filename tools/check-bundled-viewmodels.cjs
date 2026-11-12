// CHROME_BIN and THREE_DIR are optional. No manual file selection or cached models.
const fs = require('fs'), http = require('http'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
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
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().includes('/models/viewmodels/')) requests.push(r.status()); });
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
    for (let visit = 0; visit < 2; visit++) {
      const models = await page.evaluate(() => ({ m4: G.M4Viewmodel.ready, glock: G.G17Pilot.ready,
        m4Status: document.querySelector('#m4Status').textContent, glockStatus: document.querySelector('#g17Status').textContent,
        inputsEmpty: [...document.querySelectorAll('input[type=file]')].every(i => !i.files.length) }));
      assert(models.m4 && models.glock && models.inputsEmpty, JSON.stringify(models));
      assert(models.m4Status.includes('자동 적용') && models.glockStatus.includes('자동 적용'), JSON.stringify(models));
      if (!visit) { await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); }
    }
    await page.click('#trainBtn');
    await page.waitForFunction(() => G.Game.training && G.Training.active, null, { timeout: 30000 });
    const gameplay = await page.evaluate(() => {
      G.Input.unlock(); G.paused = true;
      const state = { ads: 0, raise: 1, phase: 0, moving: 0, hideVM: false, reload: null };
      for (const [id, model] of [['ar7', G.M4Viewmodel], ['g18', G.G17Pilot]]) {
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
      return { m4: G.M4Viewmodel.ready, glock: G.G17Pilot.ready };
    });
    assert.deepEqual(requests, [200, 200, 200, 200]);
    assert.deepEqual(errors, []);
    // Missing hosted files must not prevent entering the game with its original models.
    await page.route('**/assets/models/viewmodels/**', r => r.fulfill({ status: 404, body: '' }));
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
    const fallback = await page.evaluate(() => !G.M4Viewmodel.ready && !G.G17Pilot.ready &&
      document.querySelector('#m4Status').textContent.includes('실패') && document.querySelector('#g17Status').textContent.includes('실패'));
    assert(fallback, 'Missing-file fallback failed');
    assert.deepEqual(errors, []);
    console.log('PASS', { visits: 2, requests, gameplay, fallback, errors });
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
