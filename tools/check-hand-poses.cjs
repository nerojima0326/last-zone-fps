
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// CHROME_BIN, THREE_DIR, REPORT and BASELINE_HANDS=1 are optional.
const fs = require('fs'), http = require('http'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const installGeometry = require('./hand-geometry.cjs'), checkHands = require('./hand-contact-checks.cjs');
const root = path.resolve(__dirname, '..'), bvhDir = path.dirname(path.dirname(require.resolve('three-mesh-bvh')));
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream'); fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r)); let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, headless: true,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
    if (process.env.THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => r.fulfill({
      contentType: 'application/javascript', body: fs.readFileSync(path.join(process.env.THREE_DIR, r.request().url().split('/three@0.160.0/')[1])) }));
    await page.route('https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.8/**', r => r.fulfill({
      contentType: 'application/javascript', body: fs.readFileSync(path.join(bvhDir, r.request().url().split('/three-mesh-bvh@0.7.8/')[1])) }));
    await page.addInitScript(() => localStorage.setItem('lastzone_opts', JSON.stringify({ quality: 'potato', qv: 2, players: 24, loadout: 'all', fpsTarget: 60 })));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.G?.UI && document.querySelector('#loading.hidden'), null, { timeout: 180000 });
    await page.click('#trainBtn');
    // 이후 자세는 직접 진행한다. 소프트웨어 렌더러에서 팩 준비와 화면 렌더가 경쟁하지 않게 한다.
    await page.evaluate(() => { G.onLockChange = () => {}; G.Input.unlock(); G.paused = true; G.UI.showPause(false); window.requestAnimationFrame = () => 0; });
    await page.evaluate(async () => { for (const id of G.GUN_IDS) G.VM.ensure(id); await G.AssetVM.loadAll(); });
    await page.waitForFunction(() => G.Training.active && Object.keys(G.AssetVM.PACKS).every(k => G.AssetVM.packs[k]?.ready), null, { timeout: 240000 });
    await page.evaluate(() => { G.onLockChange = () => {}; G.Input.unlock(); G.paused = true; G.UI.showPause(false); window.requestAnimationFrame = () => 0; });
    if (process.env.BASELINE_HANDS) await page.evaluate(() => { G.HandContact.apply = () => {}; });
    if (process.env.HAND_IDS) await page.evaluate(ids => { if (!ids.length || ids.some(id => !G.GUN_IDS.includes(id))) throw Error('알 수 없는 검사 총기'); window.__handCheckIDs = ids; }, process.env.HAND_IDS.split(','));
    await page.evaluate(installGeometry);
    const result = await page.evaluate(checkHands);
    if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ cases: result.cases.length, transitions: result.transitions.length, failures: result.failures.slice(0, 15), failureCount: result.failures.length }, null, 2));
    assert.deepEqual(errors, [], 'Browser errors');
    assert.equal(result.failures.length, 0, 'Hand/weapon contact or animation continuity regressed; see REPORT for all cases');
    console.log('PASS: '+result.weapons+' weapons; holding/ADS/walk/sprint/fire at 30/60/144 FPS; reloads and repeated poses at 60 FPS.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
