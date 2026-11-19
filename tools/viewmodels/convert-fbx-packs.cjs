// tools/viewmodels/convert-fbx-packs.cjs — AR-7(M4 ZIP)·G-18(Glock FBX) 1인칭 팩을 GLB 로 바꾼다 (v61)
//  게임을 헤드리스 크롬으로 띄워 게임과 똑같이 FBX 를 읽은 뒤(M4 는 재질 변환까지) GLTFExporter 로 내보낸다.
//  그다음 squash 단계: 애니메이션 키 정리, 텍스처 1024 px WebP, meshopt 압축 → 35 MB → 약 2.7 MB, 부팅 때 FBX 해석 시간도 없어진다.
//  결과: assets/models/viewmodels/m4.glb · glock17.glb (원본 ZIP·FBX 는 출처 보관용, 게임은 읽지 않는다)
// 쓰는 법: THREE_DIR=<node_modules/three> NODE_PATH=<playwright·@gltf-transform·meshoptimizer·sharp> node tools/viewmodels/convert-fbx-packs.cjs
const fs = require('fs'), http = require('http'), path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
async function squash(raw, out) {
  const { NodeIO } = require('@gltf-transform/core');
  const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
  const { resample, textureCompress, reorder } = require('@gltf-transform/functions');
  const { MeshoptEncoder } = require('meshoptimizer'); const sharp = require('sharp');
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.readBinary(new Uint8Array(raw));
  // 스킨 메시는 양자화하지 않는다 (뼈 바인드가 어긋난다)
  await doc.transform(resample({ tolerance: 1e-4 }), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 85 }), reorder({ encoder: MeshoptEncoder }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  fs.writeFileSync(out, await io.writeBinary(doc));
  console.log(path.basename(out), (fs.statSync(out).size / 1048576).toFixed(2) + ' MB');
}
(async () => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.resolve(root, '.' + (rel === '/' ? '/index.html' : rel));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(process.env.THREE_DIR, route.request().url().split('/three@0.160.0/')[1])) }));
  const t0 = Date.now();
  await page.addInitScript(() => localStorage.setItem('lastzone_opts', JSON.stringify({ quality: 'potato', qv: 2, tod: 'day', players: 4, loadout: 'all', fpsTarget: 30 })));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.G && G.UI && document.querySelector('#menu:not(.hidden)'), null, { timeout: 300000 });

  page.on('console', m => { if (/conv/.test(m.text()) || m.type() === 'error') console.log('[page]', m.text().slice(0, 300)); });
  const out = await page.evaluate(async () => {
    const T = THREE;
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const { unzipSync } = await import('three/addons/libs/fflate.module.js');
    const { TGALoader } = await import('three/addons/loaders/TGALoader.js');
    const exp = async (obj) => { const ab = await new GLTFExporter().parseAsync(obj, { binary: true, animations: obj.animations, onlyVisible: false, maxTextureSize: 2048 }); let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
    const M = G.M4Viewmodel, inst = M.install; let cap = null; M.install = function (m) { cap = m; };
    const zip = await (await fetch('assets/models/viewmodels/m4_animations.zip')).arrayBuffer();
    await M.loadZip(zip, unzipSync); M.install = inst;
    console.log('conv m4 captured', !!cap, cap && cap.animations.length);
    const m4 = await exp(cap);
    const manager = new T.LoadingManager(); manager.addHandler(/\.tga$/i, new TGALoader(manager));
    const loaded = new Promise(r => { manager.onLoad = r; setTimeout(r, 15000); });
    const fbx = await (await fetch('assets/models/viewmodels/glock17.fbx')).arrayBuffer();
    const gm = new T.FBXLoader(manager).parse(fbx, '');
    await loaded;
    // DataTexture(TGA)는 내보내기에서 flipY 가 빠진다 → 같은 방향의 캔버스 텍스처로 바꿔 둔다
    const done = new Map();
    gm.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap']) { const t = m[k]; if (!t || !t.image || !t.image.data) continue;
      if (!done.has(t)) { const im = t.image, cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const cx = cv.getContext('2d');
        const d = new Uint8ClampedArray(im.width * im.height * 4), ch = im.data.length / (im.width * im.height);
        for (let i = 0; i < im.width * im.height; i++) { for (let c = 0; c < 3; c++) d[i * 4 + c] = im.data[i * ch + c]; d[i * 4 + 3] = ch === 4 ? im.data[i * 4 + 3] : 255; }
        cx.putImageData(new ImageData(d, im.width, im.height), 0, 0);
        // putImageData 는 위→아래 행 순서 = 데이터 0행이 맨 위. flipY=false DataTexture 는 0행이 v=0(아래) → 캔버스를 뒤집어 GL 과 같게
        const cv2 = document.createElement('canvas'); cv2.width = im.width; cv2.height = im.height; const c2 = cv2.getContext('2d');
        if (!t.flipY) { c2.translate(0, im.height); c2.scale(1, -1); } c2.drawImage(cv, 0, 0);
        const nt = new T.CanvasTexture(cv2); nt.flipY = true; nt.colorSpace = t.colorSpace; nt.wrapS = t.wrapS; nt.wrapT = t.wrapT; done.set(t, nt); }
      m[k] = done.get(t); } });
    console.log('conv glock datatex', done.size);
    const mats = new Set(); gm.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => mats.add(m.type + ':' + m.name + ':' + (m.map ? (m.map.image ? (m.map.image.width + 'x' + m.map.image.height + (m.map.isDataTexture ? 'D' : '')) : 'pending') : '-'))); });
    console.log('conv glock mats', [...mats].join(' | '), 'anims', gm.animations.map(a => a.name).join(','));
    const gl = await exp(gm);
    return { m4, gl };
  });
  const OUT = path.join(root, 'assets/models/viewmodels');
  await squash(Buffer.from(out.m4, 'base64'), path.join(OUT, 'm4.glb'));
  await squash(Buffer.from(out.gl, 'base64'), path.join(OUT, 'glock17.glb'));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
