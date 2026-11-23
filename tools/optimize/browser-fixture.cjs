// Local, deterministic game fixture for asset builders and regression checks.
const fs = require('fs'), http = require('http'), path = require('path');
const { chromium } = require('playwright');
module.exports = async function fixture(opts = {}) {
  const root = path.resolve(__dirname, '../..');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.resolve(root, '.' + (rel === '/' ? '/index.html' : rel));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(file);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[ext] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, headless: true,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: opts.viewport || { width: 960, height: 540 } });
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push(new URL(r.url()).pathname));
    if (opts.console) page.on('console', m => { if (m.type() === 'error') console.log(m.text()); });
    if (process.env.THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => r.fulfill({
      contentType: 'application/javascript', body: fs.readFileSync(path.join(process.env.THREE_DIR, r.request().url().split('/three@0.160.0/')[1]))
    }));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ contentType: 'text/css', body: '' }));
    await page.addInitScript(() => localStorage.setItem('lastzone_opts', JSON.stringify({ quality: 'potato', qv: 2, players: 4, loadout: 'all', fpsTarget: 60 })));
    if (opts.route) await opts.route(page);
    await page.goto('http://127.0.0.1:' + server.address().port + '/?' + (opts.query || ''));
    await page.waitForFunction(() => window.G?.VM && document.querySelector('#menu:not(.hidden)'), null, { timeout: 240000 });
    await page.evaluate(() => { G.paused = true; G.DRS.frame = () => {}; });
    return { page, errors, requests, close: async () => { await browser.close(); await new Promise(r => server.close(r)); } };
  } catch (e) { if (browser) await browser.close(); server.close(); throw e; }
};
