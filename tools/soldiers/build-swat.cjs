// tools/soldiers/build-swat.cjs — 현대 특수부대 캐릭터 GLB 만들기 (v53)
//  원본: "S.W.A.T. Operator" — Mateusz Woliński (Sketchfab, CC-BY-4.0), Mixamo 뼈대
//        GitHub 사본 Nik-WEBJS/web3-telegram-game frontend/public/assets/swat
//  결과: assets/char/swat/swat.glb + atlas_<색>.webp (위장 색 바꾼 1536 px 아틀라스)
//    · 손에 든 소총·탄창 메시와 팔 패치는 뺀다 (게임이 자기 총을 쥐어 준다)
//    · 재질 10개 → 텍스처 아틀라스 1장 (2048 px) · 재질 1개, 메시 2개 (몸 'soldier_body', 헬멧+야시경 'soldier_helmet')
//    · 무거운 부위(헬멧·야시경·군화·파우치)는 meshopt 로 단순화, 뼈 이름은 'mixamorig:' 와 번호를 뗀다 (Hips, Spine, ...)
// 쓰는 법: NODE_PATH=<@gltf-transform·meshoptimizer·sharp> node tools/soldiers/build-swat.cjs <원본 swat 폴더>
const fs = require('fs'), path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { dedup, prune, weld, reorder, quantize, joinPrimitives, simplifyPrimitive, weldPrimitive } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptSimplifier } = require('meshoptimizer');
const sharp = require('sharp');

const OUT = path.join(__dirname, '../../assets/char/swat');
const A = 2048;
// 아틀라스 칸 (px): x, y, 크기
const CELLS = {
  uniform: [0, 0, 1024], helmet: [1024, 0, 512], pouch: [1536, 0, 512], boots: [1024, 512, 512], gloves: [1536, 512, 512],
  face: [0, 1024, 512], mask: [512, 1024, 512], night_vis_goggles: [1024, 1024, 512], 'lambert1.003': [1536, 1024, 512], eyes: [0, 1536, 512]
};
const HELMET = new Set(['helmet', 'night_vis_goggles']);
const SIMPLIFY = { helmet: 0.22, night_vis_goggles: 0.2, pouch: 0.25, boots: 0.25, 'lambert1.003': 0.3, face: 0.5, eyes: 0.15, gloves: 0.6 };
// 위장 색 (장비 칸에만 곱한다): 검정(원본) · 레인저 그린 · 코요테 브라운 · 회색
const TINTS = { black: null, ranger: [0.3, 0.35, 0.24], coyote: [0.5, 0.41, 0.29], grey: [0.36, 0.37, 0.39] };
const TINT_CELLS = ['uniform', 'pouch', 'gloves', 'helmet', 'boots'];

(async () => {
  const src = process.argv[2];
  if (!src) throw Error('원본 swat 폴더를 주세요');
  await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.read(path.join(src, 'scene.gltf')), root = doc.getRoot();
  for (const a of root.listAnimations()) a.dispose();
  const skin = root.listSkins()[0];
  console.log('skin joints', skin.listJoints().length);
  // 뼈대 밖(소총·패치)과 쓰지 않는 재질의 메시 노드 제거
  const meshNodes = root.listNodes().filter(n => n.getMesh());
  const keep = [];
  for (const n of meshNodes) {
    const prims = n.getMesh().listPrimitives();
    if (!n.getSkin() || prims.some(p => !CELLS[p.getMaterial()?.getName()])) { n.getMesh().dispose(); n.dispose(); continue; }
    keep.push(n);
  }
  for (const n of root.listNodes()) if (!n.getMesh() && !n.listChildren().length && /part_2|Circle|Plane/.test(n.getName())) n.dispose();
  // 아틀라스
  const imgOf = (tex) => tex ? sharp(Buffer.from(tex.getImage())) : null;
  const diffuse = [], normal = [];
  const mats = new Map();
  for (const n of keep) for (const p of n.getMesh().listPrimitives()) mats.set(p.getMaterial().getName(), p.getMaterial());
  for (const [name, m] of mats) {
    const [x, y, s] = CELLS[name];
    const d = imgOf(m.getBaseColorTexture());
    if (d) diffuse.push({ input: await d.resize(s, s, { fit: 'fill' }).removeAlpha().png().toBuffer(), left: x, top: y });
    const nm = imgOf(m.getNormalTexture());
    if (nm) normal.push({ input: await nm.resize(s / 2, s / 2, { fit: 'fill' }).removeAlpha().png().toBuffer(), left: x / 2, top: y / 2 });
    const f = m.getBaseColorFactor();
    if (!d) diffuse.push({ input: await sharp({ create: { width: s, height: s, channels: 3, background: { r: f[0] * 255, g: f[1] * 255, b: f[2] * 255 } } }).png().toBuffer(), left: x, top: y });
  }
  fs.mkdirSync(OUT, { recursive: true });
  const flat = await sharp({ create: { width: A, height: A, channels: 3, background: { r: 40, g: 40, b: 40 } } }).composite(diffuse).png().toBuffer();
  const { data: base, info } = await sharp(flat).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3 || info.width !== A) throw Error('아틀라스 형식 ' + JSON.stringify(info));
  for (const [k, tint] of Object.entries(TINTS)) {
    const buf = Buffer.from(base);
    if (tint) for (const c of TINT_CELLS) {
      const [x0, y0, s] = CELLS[c];
      for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) {
        const i = (y * A + x) * 3, L = (0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]) / 255;
        const g = Math.min(1.2, 0.2 + L * 2.2);
        for (let j = 0; j < 3; j++) buf[i + j] = Math.min(255, Math.round(255 * tint[j] * g));
      }
    }
    await sharp(buf, { raw: { width: A, height: A, channels: 3 } }).resize(1536, 1536).webp({ quality: 84 }).toFile(path.join(OUT, 'atlas_' + k + '.webp'));
  }
  const nbuf = normal.length ? await sharp({ create: { width: A / 2, height: A / 2, channels: 3, background: { r: 128, g: 128, b: 255 } } }).composite(normal).png().toBuffer() : null;
  if (nbuf) await sharp(nbuf).webp({ quality: 88 }).toFile(path.join(OUT, 'atlas_nor.webp'));
  // 프리미티브: UV 를 칸으로, 단순화, 속성 정리 → 몸·헬멧 두 메시
  const mat = doc.createMaterial('soldier').setRoughnessFactor(0.85).setMetallicFactor(0);
  const body = doc.createMesh('soldier_body'), helm = doc.createMesh('soldier_helmet');
  let before = 0, after = 0;
  for (const n of keep) for (const p of n.getMesh().listPrimitives()) {
    const name = p.getMaterial().getName(), [x, y, s] = CELLS[name];
    for (const sem of p.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'].includes(sem)) p.setAttribute(sem, null);
    const uv = p.getAttribute('TEXCOORD_0'), el = [];
    const arr = new Float32Array(uv.getCount() * 2);
    for (let i = 0; i < uv.getCount(); i++) {
      uv.getElement(i, el);
      let u = el[0], v = el[1];
      if (u < -0.001 || u > 1.001) u -= Math.floor(u);
      if (v < -0.001 || v > 1.001) v -= Math.floor(v);
      u = Math.min(0.996, Math.max(0.004, u)); v = Math.min(0.996, Math.max(0.004, v));
      arr[i * 2] = (x + u * s) / A; arr[i * 2 + 1] = (y + v * s) / A;
    }
    p.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(arr));
    // JOINTS 형식을 맞춘다 (합치기 위해)
    const J = p.getAttribute('JOINTS_0'), ja = new Uint16Array(J.getCount() * 4);
    for (let i = 0; i < J.getCount(); i++) { J.getElement(i, el); ja.set(el.slice(0, 4), i * 4); }
    p.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(ja));
    const W = p.getAttribute('WEIGHTS_0'), wa = new Float32Array(W.getCount() * 4);
    for (let i = 0; i < W.getCount(); i++) { W.getElement(i, el); wa.set(el.slice(0, 4), i * 4); }
    p.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(wa));
    before += p.getIndices().getCount() / 3;
    if (SIMPLIFY[name]) { weldPrimitive(p); simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: SIMPLIFY[name], error: 0.02, lockBorder: false }); }
    after += p.getIndices().getCount() / 3; (globalThis.PER || (globalThis.PER = {}))[name] = ((globalThis.PER[name]) || 0) + p.getIndices().getCount() / 3;
    p.setMaterial(mat);
    (HELMET.has(name) ? helm : body).addPrimitive(p);
  }
  const holder = keep[0].getParentNode();
  for (const n of keep) n.dispose();
  // 같은 재질·속성의 프리미티브를 하나로 (그리기 호출 2번)
  for (const m of [body, helm]) {
    const ps = m.listPrimitives(), one = joinPrimitives(ps);
    for (const p of ps) { m.removePrimitive(p); p.dispose(); }
    m.addPrimitive(one);
    holder.addChild(doc.createNode(m.getName()).setMesh(m).setSkin(skin));
  }
  console.log('per material', JSON.stringify(globalThis.PER));
  for (const j of skin.listJoints()) j.setName(j.getName().replace(/^mixamorig:/, '').replace(/_\d+$/, ''));
  await doc.transform(dedup(), prune({ keepLeaves: true }), weld(), reorder({ encoder: MeshoptEncoder }),
    quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 10 }));
  for (const t of root.listTextures()) t.dispose();
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const bin = await io.writeBinary(doc);
  fs.writeFileSync(path.join(OUT, 'swat.glb'), bin);
  console.log('swat.glb', (bin.length / 1024).toFixed(0) + ' KB', 'tris', before, '→', after, 'joints', skin.listJoints().length,
    'meshes', root.listMeshes().map(m => m.getName() + ':' + m.listPrimitives().length).join(' '));
  for (const f of fs.readdirSync(OUT)) console.log(' ', f, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB');
})().catch(e => { console.error(e); process.exit(1); });
