const fs = require('fs'), http = require('http'), path = require('path');
const { chromium } = require('playwright');
const root = '/home/claude/last-zone-fps';
const THREE_DIR = '/home/claude/testenv/node_modules/three';
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json', '.hdr': 'application/octet-stream' };
module.exports = async function boot(fn) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.resolve(root, '.' + (rel === '/' ? '/index.html' : rel));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(THREE_DIR, route.request().url().split('/three@0.160.0/')[1])) }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.addInitScript(() => localStorage.setItem('lastzone_opts', JSON.stringify({ quality: 'high', qv: 2, tod: 'day', players: 24, loadout: 'all', fpsTarget: 30 })));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.G && G.UI && document.querySelector('#menu:not(.hidden)'), null, { timeout: 300000 });
  try { return await fn(page); } finally { await browser.close(); server.close(); }
};
if (require.main === module) module.exports(async page => {
  const r = await page.evaluate(() => {
    const out = {}; let n = 0;
    G.scene.traverse(o => {
      if (!o.isMesh && !o.isPoints && !o.isLine) return;
      const k = (o.isInstancedMesh ? 'I:' : '') + (o.material?.type || '?') + ':' + (o.name || o.parent?.name || '-');
      const e = out[k] || (out[k] = { c: 0, v: 0, inst: 0 });
      e.c++; e.v += o.geometry.attributes.position.count; if (o.isInstancedMesh) e.inst += o.count;
    });
    return { out, keys: Object.keys(G.World), boxes: G.World.boxes.length, towns: G.World.towns.length, loot: (G.World.lootSpots||[]).length, veg: Object.keys(G.Veg||{}) };
  });
  for (const [k,e] of Object.entries(r.out)) if (!k.includes("range-sign")) console.log(e.c, e.v, e.inst, k);
});
