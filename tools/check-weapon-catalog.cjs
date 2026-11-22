// Actual menu/training flows for the expanded roster. Optional SHOTS directory.
const fs = require('fs'), http = require('http'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), catalog = require('../js/weapon-catalog.js');
assert.equal(Object.keys(catalog).length, 15, 'Expansion must add 15 weapons');
(async () => {
  const server = http.createServer((req, res) => {
    let file = path.resolve(root, '.' + req.url.split('?')[0]);
    if (file === root) file += '/index.html';
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream'); fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r)); let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, headless: true,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (/Shader Error|program not valid/.test(m.text())) errors.push(m.text()); });
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
    if (process.env.THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => r.fulfill({
      contentType: 'application/javascript', body: fs.readFileSync(path.join(process.env.THREE_DIR, r.request().url().split('/three@0.160.0/')[1])) }));
    await page.addInitScript(() => localStorage.setItem('lastzone_opts', JSON.stringify({ quality: 'potato', qv: 2, players: 24, loadout: 'all', fpsTarget: 60 })));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.G?.UI && document.querySelector('#loading.hidden'), null, { timeout: 180000 });
    console.log('Menu ready');
    assert.equal(await page.evaluate(() => G.GUN_IDS.length), 30);
    const imported = await page.evaluate(() => Object.keys(G.WeaponCatalog).map(id => {
      const d = G.Guns.gunData(id), needed = id === 'sp12' ? ['pump'] : id === 'mg60' ? ['mag', 'cover', 'belt', 'charge'] : id === 'p226' ? ['mag', 'slide'] : id === 'm24' ? ['mag', 'bolt'] : ['mag'];
      const actor = G.GunModels.tpMesh(id, false), colors = [];
      actor.traverse(m => { if (m.isMesh && m.geometry.attributes.color) colors.push(...m.geometry.attributes.color.array.slice(0, 3)); });
      return { id, ready: d.real && d.extra?.importedExpansion && !!d.sourceAsset && !!d.credit,
        parts: needed.every(k => !!d.parts[k]), maps: Object.values(d.mats || {}).some(m => !!m.map), motion: G.ReloadAssets.has(id),
        actorColor: colors.every(Number.isFinite) && (!colors.length || Math.min(...colors) < .9) };
    }));
    for (const row of imported) assert(row.ready && row.parts && row.maps && row.motion && row.actorColor, 'Incomplete imported asset: ' + JSON.stringify(row));
    await page.click('#armoryBtn');
    for (const [family, count] of Object.entries({ all: 30, new: 15, assault: 6, smg: 4, lmg: 3, dmr: 3, sniper: 2, shotgun: 6, pistol: 6 })) {
      await page.click(`[data-family="${family}"]`); assert.equal(await page.locator('#armoryList [data-gun]').count(), count, family);
    }
    await page.click('[data-family="all"]'); await page.fill('#armorySearch', '7.62');
    assert.equal(await page.locator('#armoryList [data-gun]').count(), 8, 'Ammo search');
    await page.fill('#armorySearch', 'no such gun'); assert.equal(await page.locator('#armoryList [data-gun]').count(), 0);
    await page.fill('#armorySearch', ''); await page.click('[data-family="new"]');
    if (process.env.SHOTS) fs.mkdirSync(process.env.SHOTS, { recursive: true });
    for (const id of Object.keys(catalog)) {
      await page.click(`[data-gun="${id}"]`); assert(await page.locator('#armoryDetail h3').textContent());
      if (process.env.SHOTS) await page.locator('#armoryPreview').screenshot({ path: path.join(process.env.SHOTS, id + '-model.png') });
    }
    await page.click('[data-gun="mp9"]');
    await page.click('#armorySound');
    assert(await page.evaluate(() => G.WeaponAudio.sequence.mp9 > 0), 'Catalogue gunshot preview');
    if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'armory-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.querySelector('.armory-panel').getBoundingClientRect().right <= innerWidth), 'Mobile dialog overflow');
    if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'armory-mobile.png') });
    await page.click('#armoryClose'); await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Catalogue filters, search, models and mobile layout checked');
    await page.click('#trainBtn'); await page.waitForFunction(() => G.Training.active, null, { timeout: 90000 });
    const layout = await page.evaluate(() => {
      const ids = G.Training.items.filter(i => G.WEAPONS[i.kind]?.cls).map(i => i.kind);
      const random = Math.random, kinds = new Set();
      try { for (let i = 0; i < 20000; i++) { Math.random = () => (i + .5) / 20000; kinds.add(G.Game.rollKind()); } } finally { Math.random = random; }
      const fingerprints = Object.keys(G.WeaponCatalog).map(id => {
        let hash = 2166136261;
        for (const part of Object.values(G.Guns.gunData(id).parts)) for (const geo of Object.values(part)) for (const x of geo.attributes.position.array) hash = Math.imul(hash ^ Math.round(x * 1e6), 16777619);
        return hash;
      });
      return { ids, tables: G.World.range.tables.length, profiles: G.GUN_IDS.every(id => G.WeaponMotion.profiles[id] && G.WeaponSound.profiles[id]), models: G.GUN_IDS.every(id => !!G.Guns.gunData(id)), loot: G.GUN_IDS.every(id => kinds.has(id)), uniqueNewModels: new Set(fingerprints).size };
    });
    assert.equal(new Set(layout.ids).size, 30); assert.equal(layout.tables, 6); assert(layout.models && layout.profiles && layout.loot); assert.equal(layout.uniqueNewModels, 15);
    if (process.env.SHOTS) {
      await page.waitForFunction(() => G.RealArms.ready && Object.keys(G.AssetVM.PACKS).every(k => G.AssetVM.packs[k]?.ready), null, { timeout: 240000 });
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; G.Input.unlock(); G.paused = true; });
      await page.waitForTimeout(100);
    }
    // Exercise the public training selector, retaining the real pointer-lock handler.
    await page.keyboard.press('KeyJ'); await page.waitForFunction(() => G.Armory.open);
    await page.fill('#armorySearch', ''); await page.click('[data-family="new"]');
    for (const id of Object.keys(catalog)) {
      await page.click(`[data-gun="${id}"]`); await page.click('#armoryEquip');
      const equipped = await page.evaluate(id => {
        const d = G.WEAPONS[id], w = G.Game.player.weapons[d.cls];
        return { id: w.id, mag: w.mag, expected: d.mag, ammo: G.Game.player.ammo[d.ammo], open: G.Armory.open, active: G.VM.cur };
      }, id);
      assert.equal(equipped.id, id); assert.equal(equipped.active, id); assert.equal(equipped.mag, equipped.expected); assert.equal(equipped.ammo, 999); assert(!equipped.open);
      if (process.env.SHOTS) {
        await page.evaluate(() => { G.Input.unlock(); G.paused = true; });
        await page.waitForFunction(() => !G.Input.locked);
        for (const ads of [false, true]) {
          await page.evaluate(ads => {
            const p = G.Player, a = G.Game.player; G.UI.showPause(false);
            p.raise = 1; p.ads = ads ? 1 : 0; p.scopeView = 0; p.sprinting = false;
            a.weapons[a.cur].iron = ads; G.Input.mdx = G.Input.mdy = 0;
            for (let i = 0; i < 90; i++) p.updateCamera(1 / 60);
            G.UI.update(0); G.renderNow();
          }, ads);
          await page.screenshot({ path: path.join(process.env.SHOTS, id + (ads ? '-iron-ads.png' : '-hip.png')) });
        }
        if (['v45', 'lm86', 'mg60', 'sr25', 'dm56', 'm24', 'sp12'].includes(id)) {
          await page.evaluate(() => {
            const p = G.Player, a = G.Game.player, d = a.wdef(a.cur);
            p.ads = p.scopeView = 0; a.weapons[a.cur].iron = false; a.weapons[a.cur].mag = 0; p.startReload();
            const r = p.reload, duration = r.kind === 'mag' ? r.dur : p.phaseDur(r, d), fraction = d.family === 'lmg' ? .6 : .45;
            for (let t = 0; t < duration * fraction; t += 1 / 60) { p.reloadLogic(1 / 60); p.updateCamera(1 / 60); }
            G.UI.update(0); G.renderNow();
          });
          await page.screenshot({ path: path.join(process.env.SHOTS, id + '-reload.png') });
        }
      }
      await page.keyboard.press('KeyJ'); await page.waitForFunction(() => G.Armory.open);
    }
    // A regular match cannot call the training grant path.
    assert.equal(await page.evaluate(() => { G.Game.training = false; const result = G.Armory.equip('mg60'); G.Game.training = true; return result; }), false);
    await page.click('#armoryClose');
    await page.evaluate(() => { G.toMenu(); });
    assert(await page.evaluate(() => !G.Armory.open && document.querySelector('#trainArmoryBtn').classList.contains('hidden')));
    assert.deepEqual(errors, []);
    console.log('PASS: 30 models and recoil/audio profiles; 15 distinct new geometries; all guns in loot; family/ammo search; desktop/mobile viewer; 6 training racks; all 15 new weapons equipped; match restrictions and cleanup.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
