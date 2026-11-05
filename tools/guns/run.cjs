// run.cjs — 총기 GLB 일괄 제작 (헤드리스 크롬 + glTF-Transform)
//
// 준비:  npm i playwright @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
//        tools/guns/src/ 에 원본 GLB (AK47.glb, Sniper.glb, Shotgun.glb) — README 참고
// 사용:  node tools/guns/run.cjs build [id,id,...|all]      → assets/models/guns/<id>.glb
//        node tools/guns/run.cjs view <id> [persp|side|left|top|front] [final] [out.png]
//
// three.js 는 CDN(jsdelivr)을 쓰는데, THREE_DIR 을 주면 로컬 node_modules/three 로 대신한다 (오프라인).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'assets/models/guns');
const THREE_DIR = process.env.THREE_DIR;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.obj': 'text/plain' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, () => res(srv));
  });
}

async function optimize(id, raw) {
  const { NodeIO } = require('@gltf-transform/core');
  const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
  const { dedup, prune, weld, reorder, quantize } = require('@gltf-transform/functions');
  const { MeshoptEncoder } = require('meshoptimizer');
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.readBinary(raw);
  await doc.transform(
    dedup(), prune(), weld(),
    reorder({ encoder: MeshoptEncoder }),
    // 위치·법선만 양자화 (UV 는 0~1 밖까지 쓰므로 float 유지)
    quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 10 })
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  return io.writeBinary(doc);
}

(async () => {
  const [cmd, arg, ...rest] = process.argv.slice(2);
  const { chromium } = require('playwright');
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +(process.env.W || 1100), height: +(process.env.H || 700) } });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  if (THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => {
    const f = path.join(THREE_DIR, r.request().url().replace('https://cdn.jsdelivr.net/npm/three@0.160.0/', ''));
    if (fs.existsSync(f)) r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); else r.fulfill({ status: 404, body: '' });
  });
  await page.goto(`http://localhost:${port}/tools/guns/build.html`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  try {
    if (cmd === 'build') {
      const ids = !arg || arg === 'all' ? await page.evaluate(() => window.LZ.IDS) : arg.split(',');
      fs.mkdirSync(OUT, { recursive: true });
      for (const id of ids) {
        const b64 = await page.evaluate(id => window.LZ.glb64(id), id);
        const raw = Buffer.from(b64, 'base64');
        const opt = await optimize(id, new Uint8Array(raw));
        fs.writeFileSync(path.join(OUT, id + '.glb'), opt);
        console.log(id.padEnd(6), (raw.length / 1024).toFixed(0).padStart(6) + ' KB →', (opt.length / 1024).toFixed(0).padStart(5) + ' KB');
      }
    } else if (cmd === 'view') {
      const modes = (rest[0] || 'persp').split(','), final = rest.includes('final'), nomark = rest.includes('nomark');
      for (const id of arg.split(',')) for (const mode of modes) {
        const out = path.join(process.env.SHOTS || '.', id + '_' + mode + (final ? '_final' : '') + '.png');
        await page.evaluate(([id, mode, final, nomark]) => { document.body.classList.add('shot'); return window.LZ.show(id, { mode, final, markers: !nomark }); }, [id, mode, final, nomark]);
        await page.evaluate(() => window.LZ.render());
        await page.screenshot({ path: out });
        console.log(await page.evaluate(() => document.getElementById('info').textContent));
        console.log('saved', out);
      }
    }
  } finally { await browser.close(); srv.close(); }
})();
