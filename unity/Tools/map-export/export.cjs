// 웹판 LAST ZONE 의 섬을 Unity 로 옮기기 위해 굽는다.
// 결과(out/): heights.bin · water.bin (513² float32) · weights.png (지형 레이어 가중치) · color.png (색 지도)
//   world.glb (건물·다리·소품) · water.glb (호수·강 수면) · rocks.glb · veg_*.glb (나무 변형별, 임포스터 포함)
//   colliders.bin (상자 충돌체) · veg.bin · rocks.bin (인스턴스 행렬) · meta.json (마을·전리품 자리·호수·강 등)
const fs = require('fs'), path = require('path');
const boot = require('./probe.cjs');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

boot(async page => {
  await page.exposeFunction('__save', (name, b64) => { fs.writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64')); console.log('saved', name, Math.round(Buffer.byteLength(b64, 'base64') / 1024), 'KB'); });
  await page.exposeFunction('__has', (name) => fs.existsSync(path.join(OUT, name)));
  page.on('console', m => { if (m.type() === 'log' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 300)); });
  await page.evaluate(async () => {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const T = THREE, W = G.World, scene = G.scene;
    const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    const save = (name, buf) => window.__save(name, b64(buf));
    const exp = new GLTFExporter();
    const glb = (root) => new Promise((res, rej) => exp.parse(root, res, rej, { binary: true, onlyVisible: false, maxTextureSize: 1024 }));
    const canvasPng = async (cv) => new Uint8Array(await (await new Promise(r => cv.toBlob(r, 'image/png'))).arrayBuffer());

    // ---- 높이 · 물 높이 ----
    await save('heights.bin', W.heights.buffer.slice(0));
    await save('water.bin', W.waterH.buffer.slice(0));
    // ---- 지형 가중치 (R 흙, G 모래, B 바위, A 포장) · 색 지도 ----
    {
      const img = W.terrainW.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext('2d'), id = cx.createImageData(img.width, img.height); id.data.set(img.data); cx.putImageData(id, 0, 0);
      // 알파 채널이 0 인 곳의 RGB 를 브라우저가 지우지 않게: 포장은 따로 저장
      const cv2 = document.createElement('canvas'); cv2.width = img.width; cv2.height = img.height;
      const c2 = cv2.getContext('2d'), i2 = c2.createImageData(img.width, img.height);
      for (let i = 0; i < img.data.length; i += 4) { i2.data[i] = img.data[i]; i2.data[i + 1] = img.data[i + 1]; i2.data[i + 2] = img.data[i + 2]; i2.data[i + 3] = 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = img.data[i + 3]; id.data[i + 3] = 255; }
      c2.putImageData(i2, 0, 0); cx.putImageData(id, 0, 0);
      await save('weights.png', await canvasPng(cv2));
      await save('paved.png', await canvasPng(cv));
      await save('color.png', await canvasPng(W.splatCanvas));
    }

    // ---- 충돌 상자 ----
    {
      const MC = { hard: 0, wood: 1, metal: 2, soft: 3, glass: 4, water: 5 };
      const B = W.boxes, f = new Float32Array(B.length * 7);
      B.forEach((b, i) => { f.set([b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, MC[b.mat] ?? 0], i * 7); });
      await save('colliders.bin', f.buffer);
    }

    // ---- 건물·소품 (지형·하늘·바다·대역·식생·풀 제외) ----
    const skip = new Set();
    if (W.terrain) W.terrain.traverse(o => skip.add(o));
    for (const k of ['sky', 'water', 'clouds']) if (W[k] && W[k].traverse) W[k].traverse(o => skip.add(o));
    if (W.rocks) skip.add(W.rocks.im);
    for (const v of G.Veg.variants) for (const k of ['near', 'nearLeaf', 'far', 'imp', 'farMesh']) if (v[k] && v[k].isObject3D) skip.add(v[k]);
    const waterMat = W.water && W.water.material;
    const statics = new T.Group(), waters = new T.Group();
    let nStatic = 0, nV = 0;
    const cleanMat = (m) => {
      const c = new T.MeshStandardMaterial({ name: m.name || '', color: m.color ? m.color.clone() : new T.Color(1, 1, 1), map: m.map || null, normalMap: m.normalMap || null, roughness: m.roughness ?? 1, metalness: m.metalness ?? 0, vertexColors: !!m.vertexColors, transparent: !!m.transparent, opacity: m.opacity ?? 1, alphaTest: m.alphaTest || 0, side: m.side, emissive: m.emissive ? m.emissive.clone() : new T.Color(0), emissiveMap: m.emissiveMap || null });
      return c;
    };
    const matCache = new Map();
    const cm = (m) => { if (!matCache.has(m)) matCache.set(m, cleanMat(m)); return matCache.get(m); };
    const cleanGeo = (g) => {
      const n = new T.BufferGeometry();
      for (const a of ['position', 'normal', 'uv', 'color']) if (g.attributes[a]) n.setAttribute(a, g.attributes[a]);
      if (g.index) n.setIndex(g.index);
      return n;
    };
    scene.updateMatrixWorld(true);
    scene.traverse(o => {
      if (skip.has(o) || !o.isMesh) return;
      if (o.material && (o.material.isShaderMaterial || Array.isArray(o.material))) return;
      if (o.material === W.mats.proxy) return;
      // 화면 밖 큰 판(바다 바닥)
      const bs = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere);
      if (bs && bs.radius > 2500) return;
      let p = o; while (p && p !== scene) { if (p.isCamera) return; p = p.parent; }
      if (o.material === waterMat) { const m = new T.Mesh(cleanGeo(o.geometry), new T.MeshStandardMaterial({ name: 'water', color: 0x3c6e7a })); m.applyMatrix4(o.matrixWorld); waters.add(m); return; }
      const mat = cm(o.material);
      if (o.isInstancedMesh) {
        const g = cleanGeo(o.geometry), m4 = new T.Matrix4();
        for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); const m = new T.Mesh(g, mat); m.name = o.name; m.applyMatrix4(m4.premultiply(o.matrixWorld)); statics.add(m); nStatic++; }
        return;
      }
      // 행렬은 지오메트리에 굽는다 (분해하다 NaN 이 나지 않게)
      const g = cleanGeo(o.geometry), mw = o.matrixWorld;
      if (mw.elements.every(Number.isFinite) && !mw.equals(new T.Matrix4())) { const g2 = new T.BufferGeometry(); for (const k in g.attributes) g2.setAttribute(k, g.attributes[k].clone()); if (g.index) g2.setIndex(g.index.clone()); g2.applyMatrix4(mw); g2.index = g2.index; var gg = g2; } else var gg = g;
      const m = new T.Mesh(gg, mat); m.name = o.name || ('part' + nStatic);
      statics.add(m); nStatic++; nV += o.geometry.attributes.position.count;
    });
    console.log('statics', nStatic, 'verts', nV, 'waters', waters.children.length);
    await save('world.glb', await glb(statics));
    if (!await window.__has('water.glb')) await save('water.glb', await glb(waters));

    // ---- 바위 ----
    if (W.rocks) {
      const R = W.rocks, rg = new T.Group(); rg.add(new T.Mesh(cleanGeo(R.im.geometry), cleanMat(R.im.material)));
      await save('rocks.glb', await glb(rg));
      const f = new Float32Array(R.n * 19);
      for (let i = 0; i < R.n; i++) { f.set(R.mats.subarray(i * 16, i * 16 + 16), i * 19); f.set(R.cols.subarray(i * 3, i * 3 + 3), i * 19 + 16); }
      await save('rocks.bin', f.buffer);
    }

    // ---- 나무·덤불 (변형별 메시 + 임포스터 + 인스턴스 행렬) ----
    const vegMeta = [];
    const R2 = G.renderer;
    let vi = 0;
    for (const v of G.Veg.variants) {
      const name = 'veg_' + v.kind + '_' + vi++;
      const g = new T.Group();
      const b = new T.Mesh(cleanGeo(v.gB), cleanMat(v.bark)); b.name = 'bark';
      const l = new T.Mesh(cleanGeo(v.gL), cleanMat(v.leaf)); l.name = 'leaf';
      g.add(b, l);
      if (v.imp) {
        // 임포스터 렌더 타깃 → 캔버스 텍스처
        const rt = v.imp.mat.userData.rt, w = rt.width, h = rt.height, px = new Uint8Array(w * h * 4);
        R2.readRenderTargetPixels(rt, 0, 0, w, h, px);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d'), id = cx.createImageData(w, h);
        for (let y = 0; y < h; y++) id.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
        cx.putImageData(id, 0, 0);
        const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
        const im = new T.Mesh(cleanGeo(v.imp.geo), new T.MeshStandardMaterial({ name: 'impostor', map: tex, alphaTest: 0.45, side: T.DoubleSide, roughness: 0.9, color: new T.Color(0.82, 0.82, 0.82) }));
        im.name = 'impostor'; g.add(im);
      }
      await save(name + '.glb', await glb(g));
      const n = v.items.length;
      await save(name + '.bin', v.mats ? v.mats.buffer.slice(0, n * 64) : new ArrayBuffer(0));
      vegMeta.push({ name, kind: v.kind, n, h: v.h, w: v.w });
    }

    // ---- 게임 데이터 ----
    const pick = (o, ks) => { const r = {}; for (const k of ks) if (o[k] !== undefined) r[k] = o[k]; return r; };
    const meta = {
      size: 1600, res: 512, half: 800,
      towns: W.towns.map(t => pick(t, ['name', 'x', 'z', 'r', 'type'])),
      loot: W.lootSpots,
      lakes: (W.lakes || []).map(L => pick(L, ['name', 'cx', 'cz', 'level', 'ext', 'blobs'])),
      rivers: (W.rivers || []).map(R => ({ name: R.name, pts: R.pts.map(p => [p.x, p.z, p.w, p.level]) })),
      roads: (W.roads || []).map(r => [r.ax, r.az, r.bx, r.bz, r.w]),
      bridges: (W.bridges || []).map(b => pick(b, ['x', 'z', 'ax', 'az', 'bx', 'bz', 'y', 'w', 'len'])),
      labels: W.labels, base: W.base, noLoot: W.noLoot, course: W.course,
      range: W.range ? JSON.parse(JSON.stringify(W.range, (k, v) => (v && v.isObject3D) ? undefined : v)) : null,
      footprints: (W.footprints || []).map(f => [f.kind, f.minX, f.minZ, f.maxX, f.maxZ]),
      veg: vegMeta,
      sunDir: W.sunDir ? [W.sunDir.x, W.sunDir.y, W.sunDir.z] : null
    };
    let js; try { js = JSON.stringify(meta); } catch (e) { console.log('meta err', e.message); meta.range = null; meta.course = null; js = JSON.stringify(meta); }
    await save('meta.json', new TextEncoder().encode(js).buffer);
  });
});
