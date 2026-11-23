// v68 고정 벤치마크: 장면 3개 (숲 한가운데 · 마을 위 고지대 · 교전 중) × 품질 4단계
// 매 프레임 GPU 를 기다리며 끊어 패스별 시간(소프트웨어 렌더러에서는 GPU 비용의 근사)과 draw call·삼각형을 잰다.
// 사용: THREE_DIR=.../node_modules/three node tools/bench-perf.cjs [출력폴더]   (env: VW, VH, FRAMES, TIERS, SCENES)
const fs = require('fs'), http = require('http'), path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = process.argv[2] || path.join(root, 'bench-out');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json', '.hdr': 'application/octet-stream' };
const FRAMES = +(process.env.FRAMES || 6);
const TIERS = (process.env.TIERS || 'potato,low,medium,high').split(',');
// MODES=off,on : 같은 판에서 시야 밖 자르기(v68)를 끄고/켜고 비교
const MODES = (process.env.MODES || '').split(',');
const SCENES = (process.env.SCENES || 'forest,vista,combat').split(',');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.resolve(root, '.' + (rel === '/' ? '/index.html' : rel));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +(process.env.VW || 1280), height: +(process.env.VH || 720) } });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('ERR', e.message); });
  if (process.env.THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(process.env.THREE_DIR, route.request().url().split('/three@0.160.0/')[1])) }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.addInitScript(() => localStorage.setItem('lastzone_opts', JSON.stringify({ quality: 'high', qv: 2, tod: 'day', players: 4, loadout: 'all', fpsTarget: 30 })));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?perf=1`);
  await page.waitForFunction(() => window.G && G.UI && document.querySelector('#menu:not(.hidden)'), null, { timeout: 240000 });
  await page.evaluate(() => document.getElementById('trainBtn').click());
  await page.waitForFunction(() => G.Game.training && G.Training.active, null, { timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    G.Input.unlock(); G.onLockChange = () => {}; G.paused = true; G.UI.showPause(false);
    G.DRS.frame = () => {};
    const W = G.World, H = (x, z) => W.heightAt(x, z);
    // 숲: 반경 40 m 안 나무가 가장 많은 곳 (월드 배치가 판마다 조금 달라서, 전/후 비교는 MODES=off,on 으로 같은 판에서)
    let best = null, bc = -1;
    for (let x = -900; x <= 900; x += 30) for (let z = -900; z <= 900; z += 30) {
      if (W.towns.some(t => Math.hypot(x - t.x, z - t.z) < t.r + 30) || H(x, z) < 3) continue;
      let c = 0;
      for (const v of G.Veg.variants) { if (v.kind === 'bush') continue; const M = v.mats; for (let i = 0; i < v.items.length; i++) { const dx = M[i * 16 + 12] - x, dz = M[i * 16 + 14] - z; if (dx * dx + dz * dz < 1600) c++; } }
      if (c > bc) { bc = c; best = [x, z]; }
    }
    const city = W.towns.find(t => t.type === 'city');
    window.__scenes = {
      forest: { pos: [best[0], H(best[0], best[1]) + 1.7, best[1]], look: [best[0] + 40, H(best[0] + 40, best[1] + 25) + 3, best[1] + 25], trees: bc },
      vista: { pos: [city.x + 150, H(city.x + 150, city.z + 150) + 55, city.z + 150], look: [city.x, H(city.x, city.z) + 5, city.z] },
      combat: { pos: [city.x + 8, H(city.x + 8, city.z + 4) + 1.7, city.z + 4], look: [city.x - 40, H(city.x - 40, city.z - 10) + 2, city.z - 10], fx: true }
    };
    // 1인칭 총을 들고 있게
    const p = G.Game.player; if (p.weapons.rifle) G.Player.switchTo('rifle');
    for (let i = 0; i < 120; i++) G.Game.update(1 / 60);
    G.paused = true;
  });
  if (process.env.BREAKDOWN) await page.evaluate(() => { window.__breakdown = true; });
  if (process.env.EXTRA) await page.evaluate(process.env.EXTRA);   // 실험용 (예: 특정 기능 끄기)
  const cdp = await page.context().newCDPSession(page);
  const result = { viewport: [+(process.env.VW || 1280), +(process.env.VH || 720)], frames: FRAMES, version: await page.evaluate(() => window.LZ_BUILD), scenes: await page.evaluate(() => window.__scenes), runs: [] };
  for (const q of TIERS) {
    await page.evaluate(q => { G.__apply(q); G.DRS.scale = 1; G.DRS.apply(true); }, q);
    for (const sc of SCENES) for (const mode of MODES) {
      const r = await page.evaluate(([sc, N, mode]) => {
        G.noCull = G.noLam = mode === 'off';   // off = v67 처럼 (시야 밖 자르기·나무 램버트 재질 끔)
        if (G.Veg && G.Veg.applyMats) G.Veg.applyMats();
        if (window.__mode) window.__mode(mode);   // EXTRA 에서 정의한 실험 모드
        const S = window.__scenes[sc], cam = G.camera, P = G.Perf, gl = G.renderer.getContext();
        cam.position.set(...S.pos); cam.lookAt(...S.look); cam.fov = 80; cam.updateProjectionMatrix();
        P.toggle(true); P.sync = true;
        const fxStep = (k) => {
          if (!S.fx) return;
          const c = cam.position, d = new THREE.Vector3(); cam.getWorldDirection(d);
          const at = (m, s) => new THREE.Vector3(c.x + d.x * m + s, G.World.heightAt(c.x + d.x * m + s, c.z + d.z * m) + 0.5, c.z + d.z * m);
          if (k % 4 === 0) G.FX.explosion(at(18 + (k % 3) * 6, (k % 5) - 2));
          for (let j = 0; j < 3; j++) { const p = at(10 + j * 4, j - 1); G.FX.impact(p, new THREE.Vector3(0, 1, 0), 'concrete'); }
          G.FX.muzzle(c.clone().addScaledVector(d, 0.8), d.x, d.y, d.z, false);
          G.FX.shell(c.clone().addScaledVector(d, 0.4), new THREE.Vector3(1.5, 2, 0), false);
          G.FX.update(1 / 30);
        };
        // 시야 안 LOD·나무·지형이 자리를 잡도록 몇 번 갱신하고 미리 그린다
        for (let k = 0; k < 4; k++) { G.World.update(1 / 30, cam.position, cam); G.Veg && G.Veg.update(1 / 30, cam.position); fxStep(k); G.renderNow(); }
        P.gpuWait();
        const segs = {}, tot = []; let calls = 0, tris = 0;
        for (let k = 0; k < N; k++) {
          G.World.update(1 / 30, cam.position, cam); fxStep(k + 4);
          G.renderer.shadowMap.needsUpdate = true;   // 그림자 비용도 매 프레임 잰다 (단계별 갱신 주기로 나눠 보면 평균)
          P.gpuWait(); const t0 = performance.now();
          P.frameStart(); G.renderNow(); P.frameEnd(16, 0);
          P.gpuWait(); tot.push(performance.now() - t0);
          for (const n in P.acc) segs[n] = (segs[n] || 0) + P.acc[n] / N;
          calls += P.info.calls / N; tris += P.info.tris / N;
        }
        tot.sort((a, b) => a - b);
        // 무엇이 삼각형·draw call 을 쓰는지 (BREAKDOWN=1)
        let top = null;
        if (window.__breakdown) {
          const R = G.renderer, rb = R.renderBufferDirect, acc = {};
          let inShadow = false; const sm = R.shadowMap, smr = sm.render;
          sm.render = function () { inShadow = true; try { return smr.apply(this, arguments); } finally { inShadow = false; } };
          R.renderBufferDirect = function (camera, scene, geo, mat, obj, group) {
            const idx = geo.index, n = group ? group.count : idx ? idx.count : geo.attributes.position.count;
            const inst = obj.isInstancedMesh ? obj.count : (geo.isInstancedBufferGeometry ? geo.instanceCount : 1);
            let nm = obj.name || '', o = obj; while (!nm && o.parent) { o = o.parent; nm = o.name; }
            if (!nm) for (const v of (G.Veg && G.Veg.variants) || []) for (const k in v) if (v[k] === obj) nm = 'veg.' + v.kind + '.' + k;
            if (!nm && G.World) for (const k in G.World) { const w = G.World[k]; if (w === obj || (Array.isArray(w) && w.includes(obj))) nm = 'World.' + k; }
            const img = mat.map && mat.map.image, src = img && (img.src || img.currentSrc || (img.width ? 'canvas' + img.width : '')) || '';
            const key = (inShadow ? '[sh] ' : '') + (nm || '?' + obj.type + (obj.isInstancedMesh ? '[I]' : '')) + ' / ' + (mat.type || '') + (mat.name ? ':' + mat.name : '') + ' ' + String(src).split('/').pop().slice(0, 30) + ' ' + Math.round(n / 3) + 't';
            const e = acc[key] || (acc[key] = { tris: 0, calls: 0 });
            e.tris += Math.min(n, (idx ? idx.count : geo.attributes.position.count)) / 3 * (inst === Infinity ? 1 : inst); e.calls++;
            return rb.apply(this, arguments);
          };
          R.shadowMap.needsUpdate = true; G.renderNow();
          R.renderBufferDirect = rb; sm.render = smr;
          top = Object.entries(acc).sort((a, b) => b[1].tris - a[1].tris).slice(0, 25).map(([k, v]) => [k, Math.round(v.tris), v.calls]);
        }
        const rt = G.composerRT(), sz = G.renderer.getDrawingBufferSize(new THREE.Vector2());
        return { ms: tot[Math.floor(tot.length / 2)], top, shEvery: G.qualityShEvery && G.qualityShEvery(), segs, calls: Math.round(calls), tris: Math.round(tris), internal: rt ? [rt.width, rt.height] : null, output: [sz.x, sz.y] };
      }, [sc, FRAMES, mode]);
      r.tier = q; r.scene = sc; r.mode = mode;
      result.runs.push(r);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(out, `${sc}_${q}${mode ? '_' + mode : ''}.png`), Buffer.from(data, 'base64'));
      if (r.top) for (const [k, t, c] of r.top) console.log('    ', String(Math.round(t / 1000) + 'k').padStart(6), String(c).padStart(4), k);
      console.log(q.padEnd(7), sc.padEnd(7), (mode || '').padEnd(3), (r.ms.toFixed(0) + 'ms').padStart(7), 'draw', String(r.calls).padStart(4), 'tris', (Math.round(r.tris / 1000) + 'k').padStart(6), 'in', r.internal && r.internal.join('x'), Object.entries(r.segs).map(([k, v]) => k + ' ' + v.toFixed(0)).join(' | '));
    }
  }
  result.errors = errors;
  fs.writeFileSync(path.join(out, 'bench.json'), JSON.stringify(result, null, 1));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
