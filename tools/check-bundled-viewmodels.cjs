
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
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
    const packRequests = [];
    page.on('response', r => { if (/\/models\/viewmodels\/(m4|glock17)\.glb/.test(r.url())) requests.push(r.status()); if (/\/models\/viewmodels\/(m4_animations\.zip|glock17\.fbx)/.test(r.url())) errors.push('v61: old ZIP/FBX must not load ' + r.url()); });
    page.on('response', r => { if (/\/models\/viewmodels\/[a-z0-9]+\.glb/.test(r.url())) packRequests.push({ url: r.url(), status: r.status() }); });
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
    const ready = async () => { await page.waitForFunction(() => window.G?.UI && document.querySelector('#menu:not(.hidden)') && document.querySelector('#loading.hidden'), null, { timeout: 180000 }); await page.evaluate(async () => { for (const id of G.GUN_IDS) G.VM.ensure(id); await G.AssetVM.loadAll(); }); };
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
      assert(await page.evaluate(ids=>G.ReloadAssets.ready&&ids.every(id=>G.ReloadAssets.has(id)),Object.keys(longGuns)), 'Reload assets must load without browser file storage');
      const bundled = await page.evaluate(expected => Object.entries(expected).map(([id, source]) => {
        const data = G.GunModels.data(id), vm = G.VM.models[id];
        return { id, loaded: data?.sourceAsset === source && vm?.real && data.muzzle.toArray().every(Number.isFinite),
          parts: Object.keys(data?.parts || {}) };
      }), longGuns);
      assert(bundled.every(g => g.loaded && g.parts.includes('body')), JSON.stringify(bundled));
      for (const id of ['sc17', 'sa12', 'aa12']) assert(bundled.find(g => g.id === id).parts.includes('mag'), id + ' missing movable magazine');
      assert(bundled.find(g => g.id === 'db2').parts.includes('barrel'), 'DB-2 missing break-action barrels');
      assert(!bundled.find(g => g.id === 'm1014').parts.includes('pump'), 'Semi-auto shotgun must use a fixed fore-end');
      if (!visit) { await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(); }
    }
    await page.click('#trainBtn');await page.evaluate(()=>G.startReady);
    await page.waitForFunction(() => G.Game.training && (!G.preparing&&G.Training.active), null, { timeout: 30000 });
    // v51: 총기별 실사 장전 팩은 시작을 막지 않고 뒤에서 받는다
    await page.waitForFunction(() => Object.keys(G.AssetVM.PACKS).every(k => G.AssetVM.packs[k]?.ready), null, { timeout: 240000, polling: 500 });
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
        const model = G.VM.models[id], pack = G.AssetVM.pack(id);
        if (pack ? (!pack.pivot.visible || model.root.visible) : (!model.root.visible || !model.real)) throw Error('Bundled gun not shown: ' + id);
        G.VM.fireKick(1, false); G.VM.update(.016, { ...state, ads: 1, scope: 'reddot' });
        model.root.updateMatrixWorld(true);
        model.root.traverse(o => { if (!o.matrixWorld.elements.every(Number.isFinite)) throw Error('Nonfinite gun transform: ' + id); });
        const thirdPerson = G.Guns.tpModel(id, true);
        if (!thirdPerson) throw Error('Missing loot/third-person gun: ' + id);
        G.renderNow();
      }
      // 총기별 실사 장전 팩: 대체 표시 · 장전(탄창/한 발씩) · 사격 · 조준 정렬
      const AV = G.AssetVM, packGuns = Object.keys(AV.GUNS);
      for (const id of packGuns) {
        const P = AV.pack(id), def = G.WEAPONS[id];
        if (!P) throw Error('Reload pack not ready: ' + id);
        G.VM.set(id); G.VM.update(1, state);
        if (!P.pivot.visible || G.VM.models[id].root.visible) throw Error('Reload pack not shown: ' + id);
        // v55 같은 팩을 쓰는 총은 바꿔 낀 총 메시가 보여야 한다
        const sw = P.swaps[id];
        if (AV.SWAP[id] && !(sw && sw.groups.length && sw.groups.every(h => h.visible) && P.gunMeshes.every(m => !m.visible))) throw Error('Swap gun not shown: ' + id);
        if (!AV.SWAP[id] && (P.gunMeshes.some(m => !m.visible) || Object.values(P.swaps).some(o => o.groups.some(h => h.visible)))) throw Error('Pack gun hidden: ' + id);
        const reloads = def.reloadType === 'mag' ? [{ type: 'mag', empty: false, p: .5 }, { type: 'mag', empty: true, p: .5 }]
          : def.reloadType === 'revolver' ? [{ type: 'revolver', empty: false, p: .5 }]
          : [{ type: 'shell', phase: 'start', pp: .5, shellP: -1 }, { type: 'shell', phase: 'load', pp: 0, shellP: .5 }, { type: 'shell', phase: 'end', pp: .5, shellP: -1 }];
        for (const reload of reloads) {
          G.VM.update(.016, { ...state, reload });
          // v63 KR-98(Kar98k)은 팩 장전 클립 대신 볼트·오른팔 IK: 탄 넣는 동안 노리쇠가 열려 있어야 한다
          const kar = P.swaps[id]?.kar;
          if (kar) { if (reload.phase === 'load' && kar.bolt.position.distanceTo(kar.closed) < 0.08) throw Error('Kar98k bolt not open while loading'); }
          else if (!P.acts[reload.type === 'mag' && reload.empty && P.acts.reloadEmpty ? 'reloadEmpty' : 'reload'].action.enabled) throw Error('Missing pack reload: ' + id);
        }
        const d = G.Guns.reloadDuration(id, false), ev = G.Guns.reloadEvents(id, true, 'load');
        if (!(d > .3 && d < 4) || !ev.length || ev.some(e => !(e[0] >= 0 && e[0] <= 1))) throw Error('Bad pack reload timing: ' + id + ' ' + d + ' ' + JSON.stringify(ev));
        G.VM.fireKick(1, false); G.VM.update(.016, state);
        // v56 권총은 사격 클립 대신 손목 반동(절차적)
        // v63 KR-98 은 사격 클립 대신 볼트 조작(IK) — 쏜 직후 shotT 로 확인
        if (!(P.def.pistol || P.swaps[id]?.kar ? P.shotT < 0.1 : P.acts.fire.action.enabled)) throw Error('Missing pack fire: ' + id);
        P.mountKey = null; G.VM.update(.3, { ...state, ads: 1, scope: 'reddot' });
        if (!P.mount || ![P.mount.t.x, P.mount.t.y, P.mount.t.z].every(Number.isFinite) || P.mount.t.length() > 1) throw Error('Bad pack ADS: ' + id);
        P.pivot.updateMatrixWorld(true);
        P.pivot.traverse(o => { if (!o.matrixWorld.elements.every(Number.isFinite)) throw Error('Nonfinite pack transform: ' + id); });
        const out = G.VM.muzzleWorld(G.camera, new THREE.Vector3());
        if (!out.toArray().every(Number.isFinite)) throw Error('Bad pack muzzle: ' + id);
        G.renderNow();
      }
      return { m4: G.M4Viewmodel.ready, glock: G.G17Pilot.ready, longGuns: Object.keys(expected), packs: packGuns };
    }, longGuns);
    // v61: AR-7·G-18 은 미리 바꾼 GLB 만 받는다 (ZIP 12 MB · FBX 22 MB 대신)
    // v55: 1인칭 팩이 AA-12 모델을 한 번 더 받아 쓴다 (다른 총 모양으로 바꿔 끼우기)
    assert(gunRequests.length >= 10, 'Each long gun must load automatically on both visits ' + gunRequests.length);
    assert(gunRequests.every(r => r.status === 200 && new URL(r.url).searchParams.get('v') === build), JSON.stringify(gunRequests));
    assert.deepEqual(requests, [200, 200, 200, 200]);
    assert(packRequests.length >= 6 && packRequests.every(r => r.status === 200 && new URL(r.url).searchParams.get('v') === build), JSON.stringify(packRequests));
    assert.deepEqual(errors, []);
    // Missing hosted files must not prevent entering the game with its original models.
    await page.route('**/assets/models/viewmodels/**', r => r.fulfill({ status: 404, body: '' }));
    await page.route(/\/assets\/models\/guns\/(sc17|m1014|sa12|aa12|db2)\.glb/, r => r.fulfill({ status: 404, body: '' }));
    await page.route('**/assets/animations/reloads/motion.json*', r => r.fulfill({ status: 404, body: '' }));
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }); await ready();
    const fallback = await page.evaluate(() => !G.M4Viewmodel.ready && !G.G17Pilot.ready &&
      document.querySelector('#m4Status').textContent.includes('실패') && document.querySelector('#g17Status').textContent.includes('실패'));
    assert(fallback, 'Missing-file fallback failed');
    const longGunFallback = await page.evaluate(ids => ids.every(id => !G.GunModels.has(id) && !G.VM.models[id].real), Object.keys(longGuns));
    assert(longGunFallback, 'Missing long-gun files must use the procedural fallback');
    assert(await page.evaluate(()=>!G.ReloadAssets.ready), 'Missing reload data must use the original animations');
    await page.waitForFunction(() => Object.keys(G.AssetVM.PACKS).every(k => G.AssetVM.packs[k]?.failed), null, { timeout: 60000, polling: 500 });
    assert(await page.evaluate(() => Object.keys(G.AssetVM.GUNS).every(id => !G.AssetVM.owns(id))), 'Missing reload packs must keep the procedural viewmodels');
    assert.deepEqual(errors, []);
    console.log('PASS', { visits: 2, requests, gameplay, fallback, errors });
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
