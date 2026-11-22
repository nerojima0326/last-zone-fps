// Licensed expansion assets -> the game's metre/trigger/-Z coordinate contract.
// NODE_PATH=<gltf-transform,meshoptimizer,sharp,three> node tools/guns/import-expansion.cjs <sources> [id,...]
// Pinned downloads and attribution: expansion-sources.json. Never run source repos.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const T = require('three');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { dedup, prune, weld, reorder, quantize, textureCompress, simplify } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = require('meshoptimizer');
const sharp = require('sharp');
const manifest = require('./expansion-sources.json');
const V = T.Vector3, M = T.Matrix4, Q = T.Quaternion;
const OUT = path.resolve(__dirname, '../../assets/models/guns');

function animate(document, name, seconds) {
  const animation = document.getRoot().listAnimations().find(a => a.getName() === name);
  if (!animation) throw Error('Missing clip: ' + name);
  for (const channel of animation.listChannels()) {
    const sampler = channel.getSampler(), input = sampler.getInput(), output = sampler.getOutput();
    if (!['LINEAR', 'STEP'].includes(sampler.getInterpolation())) throw Error('Unsupported interpolation');
    let i = 0;
    while (i < input.getCount() - 2 && input.getScalar(i + 1) < seconds) i++;
    const next = Math.min(i + 1, input.getCount() - 1), a = [], b = [];
    output.getElement(i, a); output.getElement(next, b);
    const u = sampler.getInterpolation() === 'STEP' ? 0 : T.MathUtils.clamp((seconds - input.getScalar(i)) / Math.max(1e-8, input.getScalar(next) - input.getScalar(i)), 0, 1);
    const property = channel.getTargetPath(), node = channel.getTargetNode();
    if (property === 'rotation') node.setRotation(new Q().fromArray(a).slerp(new Q().fromArray(b), u).toArray());
    else if (property === 'translation') node.setTranslation(a.map((x, k) => x + (b[k] - x) * u));
    else if (property === 'scale') node.setScale(a.map((x, k) => x + (b[k] - x) * u));
  }
}

function subset(document, primitive, triangles, positions, normals) {
  const order = [], map = new Map();
  for (const i of triangles) if (!map.has(i)) { map.set(i, order.length); order.push(i); }
  const out = document.createPrimitive().setMaterial(primitive.getMaterial());
  for (const semantic of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TEXCOORD_1']) {
    const a = primitive.getAttribute(semantic); if (!a) continue;
    const size = a.getElementSize(), array = new Float32Array(order.length * size), row = [];
    order.forEach((v, i) => {
      const value = semantic === 'POSITION' ? positions[v] : semantic === 'NORMAL' ? normals[v] : a.getElement(v, row);
      array.set(value, i * size);
    });
    out.setAttribute(semantic, document.createAccessor().setType(a.getType()).setArray(array));
  }
  out.setIndices(document.createAccessor().setType('SCALAR').setArray(Uint32Array.from(triangles, i => map.get(i))));
  return out;
}
function addGeometry(document, parts, part, geometry, material) {
  const p = document.createPrimitive().setMaterial(material);
  for (const [key, semantic] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['uv', 'TEXCOORD_0']]) {
    const a = geometry.attributes[key]; if (a) p.setAttribute(semantic, document.createAccessor().setType(a.itemSize === 2 ? 'VEC2' : 'VEC3').setArray(Float32Array.from(a.array)));
  }
  p.setIndices(document.createAccessor().setType('SCALAR').setArray(Uint32Array.from(geometry.index ? geometry.index.array : Array.from({ length: geometry.attributes.position.count }, (_, i) => i))));
  (parts[part] ||= []).push(p);
}
function bake(node) {
  const mesh = node.getMesh(), skin = node.getSkin(), world = new M().fromArray(node.getWorldMatrix());
  const joints = skin?.listJoints(), bind = skin?.getInverseBindMatrices(), matrices = joints?.map((joint, i) => new M().fromArray(joint.getWorldMatrix()).multiply(new M().fromArray(bind.getElement(i, []))));
  return mesh.listPrimitives().map(primitive => {
    const p = primitive.getAttribute('POSITION'), n = primitive.getAttribute('NORMAL');
    const indices = primitive.getAttribute('JOINTS_0'), weights = primitive.getAttribute('WEIGHTS_0');
    const positions = [], normals = [], dominant = [];
    for (let i = 0; i < p.getCount(); i++) {
      let matrix = world;
      if (skin) {
        const ix = indices.getElement(i, []), w = weights.getElement(i, []); matrix = new M(); matrix.elements.fill(0);
        for (let j = 0; j < w.length; j++) if (w[j]) for (let k = 0; k < 16; k++) matrix.elements[k] += matrices[ix[j]].elements[k] * w[j];
        dominant.push(joints[ix[w.indexOf(Math.max(...w))]].getName());
      }
      positions.push(new V().fromArray(p.getElement(i, [])).applyMatrix4(matrix).toArray());
      normals.push(n ? new V().fromArray(n.getElement(i, [])).applyNormalMatrix(new T.Matrix3().getNormalMatrix(matrix)).toArray() : [0, 1, 0]);
    }
    return { primitive, positions, normals, dominant, node: node.getName() };
  });
}
const bounds = rows => new T.Box3().setFromPoints(rows.flatMap(r => r.positions.map(p => new V(...p))));

async function build(io, folder, id, config) {
  const source = manifest.sources[config.source], file = path.join(folder, source.file);
  if (source.sha256 && crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== source.sha256) throw Error('Source hash mismatch: ' + source.file);
  const doc = await io.read(file), root = doc.getRoot();
  if (config.sample) animate(doc, ...config.sample);
  const keep = new RegExp(config.keep || '.*'), drop = new RegExp(config.drop || '(?!)');
  const rows = root.listNodes().filter(n => n.getMesh() && keep.test(n.getName()) && !drop.test(n.getName())).flatMap(bake)
    .filter(r => !config.dropMaterials || !new RegExp(config.dropMaterials).test(r.primitive.getMaterial()?.getName() || ''));
  if (!rows.length) throw Error(id + ': no gun meshes');
  if (config.frameNode) {
    const frame = root.listNodes().find(n => n.getName() === config.frameNode);
    if (!frame) throw Error('Missing source frame: ' + config.frameNode);
    const inverse = new M().fromArray(frame.getWorldMatrix()).invert(), normal = new T.Matrix3().getNormalMatrix(inverse);
    for (const row of rows) {
      row.positions = row.positions.map(p => new V(...p).applyMatrix4(inverse).toArray());
      row.normals = row.normals.map(p => new V(...p).applyNormalMatrix(normal).toArray());
    }
  }
  const turn = new Q().setFromEuler(new T.Euler(...(config.rotation || [0, 0, 0])));
  const turned = new T.Box3().setFromPoints(rows.flatMap(r => r.positions.map(p => new V(...p).applyQuaternion(turn))));
  const scale = config.length / (turned.max.z - turned.min.z);
  console.log(id, 'raw rotated bounds', JSON.stringify({ min: turned.min.toArray(), max: turned.max.toArray() }), 'scale', scale);
  const oriented = p => new V(...p).applyQuaternion(turn).multiplyScalar(scale);
  for (const row of rows) { row.positions = row.positions.map(p => oriented(p).toArray()); row.normals = row.normals.map(p => new V(...p).applyQuaternion(turn).toArray()); }
  const triggerRows = rows.filter(r => /trigger/i.test(r.node));
  const trigger = config.trigger ? oriented(config.trigger) : triggerRows.length ? bounds(triggerRows).getCenter(new V()) : new V(0, 0, 0);
  if (config.triggerOffset) trigger.add(new V(...config.triggerOffset));
  const mutate = p => {
    const v = new V(...p).sub(trigger);
    // Barrel/handguard extensions leave the trigger, grip, receiver and magwell intact.
    if (config.extend && v.z < config.extend[0]) v.z += config.extend[1] * T.MathUtils.clamp((config.extend[0] - v.z) / .18, 0, 1);
    return v.toArray();
  };
  for (const row of rows) row.positions = row.positions.map(mutate);
  const gunBox = bounds(rows), parts = {}, rules = Object.entries(config.parts || {}).map(([part, re]) => [part, new RegExp(re)]);
  for (const row of rows) {
    const p = row.primitive, indices = p.getIndices(), count = indices ? indices.getCount() : p.getAttribute('POSITION').getCount(), buckets = {};
    for (let i = 0; i < count; i += 3) {
      const triangle = [0, 1, 2].map(k => indices ? indices.getScalar(i + k) : i + k), center = triangle.map(v => row.positions[v]).reduce((a, v) => a.map((x, k) => x + v[k] / 3), [0, 0, 0]);
      let part = rules.find(([_, re]) => re.test(row.node) || triangle.filter(v => re.test(row.dominant[v] || '')).length >= 2)?.[0] || 'body';
      if ((config.trim || []).some(([lo, hi]) => center.every((x, k) => x >= lo[k] && x <= hi[k]))) continue;
      for (const [name, lo, hi, node] of config.split || []) if ((!node || new RegExp(node).test(row.node)) && center.every((x, k) => x >= lo[k] && x <= hi[k])) { part = name; break; }
      (buckets[part] ||= []).push(...triangle);
    }
    for (const [part, triangles] of Object.entries(buckets)) (parts[part] ||= []).push(subset(doc, p, triangles, row.positions, row.normals));
  }
  for (const [part, transform] of Object.entries(config.partScale || {})) {
    const list = parts[part] || [], b = new T.Box3();
    for (const p of list) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) b.expandByPoint(new V(...a.getElement(i, []))); }
    const pivot = b.getCenter(new V()); pivot.y = b.max.y;
    for (const p of list) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) a.setElement(i, new V(...a.getElement(i, [])).sub(pivot).multiply(new V(...transform)).add(pivot).toArray()); }
  }
  const metal = doc.createMaterial(id + '_machined').setBaseColorFactor([.022, .025, .03, 1]).setMetallicFactor(.65).setRoughnessFactor(.48);
  const polymer = doc.createMaterial(id + '_polymer').setBaseColorFactor([.014, .018, .017, 1]).setMetallicFactor(.05).setRoughnessFactor(.7);
  for (const detail of config.add || []) {
    const [part, type, at, size, rotation] = detail;
    const geometry = type === 'box' ? new T.BoxGeometry(...size) : new T.CylinderGeometry(...size, 24).rotateX(Math.PI / 2);
    if (rotation) geometry.rotateX(rotation);
    geometry.translate(...at); addGeometry(doc, parts, part, geometry, type === 'box' ? polymer : metal);
  }
  // Replace source display optics with the game's usable optics and add measured,
  // open rear/front irons where the source omitted them.
  const sightY = config.sight[0], rearZ = config.sight[1], frontZ = config.sight[2];
  const surface = (z, maxY) => {
    let y = -Infinity;
    for (const primitive of [...(parts.body || []), ...(parts.slide || [])]) {
      const positions = primitive.getAttribute('POSITION');
      for (let i = 0; i < positions.getCount(); i++) {
        const p = positions.getElement(i, []);
        if (Math.abs(p[0]) < .022 && Math.abs(p[2] - z) < .018 && p[1] < maxY) y = Math.max(y, p[1]);
      }
    }
    return Number.isFinite(y) ? y : sightY - .045;
  };
  const rail = [...(config.rail || [sightY - .025, -.04, config.cls === 'pistol' ? 'slide' : 'body'])];
  const roof = surface(rail[1], sightY - .004);
  rail[0] = Math.max(rail[0], roof + .0015);
  // The optic's mounting surface must meet the actual receiver/slide. Preserve
  // the calibrated optic height with a physical riser instead of an air gap.
  if (rail[0] - roof > .003) addGeometry(doc, parts, rail[2] === 'slide' ? 'slide' : 'body',
    new T.BoxGeometry(.026, rail[0] - roof, config.cls === 'pistol' ? .035 : .075)
      .translate(0, (rail[0] + roof) / 2, rail[1]), metal);
  if (config.addSights !== false) {
    const back = Math.min(sightY - .016, surface(rearZ, sightY - .004)), front = Math.min(sightY - .012, surface(frontZ, sightY - .004));
    if (config.cls === 'pistol') {
      for (const x of [-.009, .009]) addGeometry(doc, parts, 'rearsight', new T.BoxGeometry(.005, sightY - back, .012).translate(x, (sightY + back) / 2, rearZ), metal);
    } else {
      addGeometry(doc, parts, 'rearsight', new T.TorusGeometry(.006, .0014, 8, 28).translate(0, sightY, rearZ), metal);
      for (const sign of [-1, 1]) {
        const a = new V(sign * .009, back, rearZ), b = new V(sign * .005, sightY - .004, rearZ), direction = b.clone().sub(a);
        const leg = new T.CylinderGeometry(.0022, .003, direction.length(), 8)
          .applyQuaternion(new Q().setFromUnitVectors(new V(0, 1, 0), direction.clone().normalize())).translate(...a.add(b).multiplyScalar(.5).toArray());
        addGeometry(doc, parts, 'rearsight', leg, metal);
      }
    }
    addGeometry(doc, parts, 'rearsight', new T.BoxGeometry(.024, .004, .016).translate(0, back, rearZ), metal);
    const frontPart = config.cls === 'pistol' ? 'slide' : 'body';
    addGeometry(doc, parts, frontPart, new T.BoxGeometry(.003, sightY - front, .006).translate(0, (sightY + front) / 2, frontZ), metal);
    addGeometry(doc, parts, frontPart, new T.BoxGeometry(.021, .004, .012).translate(0, front, frontZ), metal);
  }
  const partBox = part => {
    const b = new T.Box3(), v = [];
    for (const p of parts[part] || []) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) b.expandByPoint(new V(...a.getElement(i, v))); }
    return b;
  };
  const pivots = { ...config.pivots };
  for (const [part, name] of Object.entries(config.pivotNodes || {})) {
    const node = root.listNodes().find(n => n.getName() === name);
    if (!node) throw Error('Missing pivot: ' + name);
    pivots[part] = mutate(new V().setFromMatrixPosition(new M().fromArray(node.getWorldMatrix())).applyQuaternion(turn).multiplyScalar(scale).toArray());
  }
  for (const part of Object.keys(parts)) {
    if (part === 'body' || pivots[part]) continue;
    const b = partBox(part), c = b.getCenter(new V());
    if (part === 'mag') c.y = config.cls === 'pistol' ? b.min.y : b.max.y;
    pivots[part] = c.toArray();
  }
  const tip = rows.flatMap(r => r.positions).filter(p => p[2] < gunBox.min.z + .006 * config.length);
  const muzzle = config.muzzle || [tip.reduce((s, p) => s + p[0], 0) / tip.length, tip.reduce((s, p) => s + p[1], 0) / tip.length, gunBox.min.z];
  let charge = config.charge || null;
  if (parts.charge && !config.manualCharge) {
    const box = partBox('charge'), left = config.chargeSide ? config.chargeSide === 'left' : Math.abs(box.min.x) >= Math.abs(box.max.x), x = left ? box.min.x : box.max.x, points = [];
    for (const p of parts.charge) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { const v = a.getElement(i, []); if (Math.abs(v[0] - x) < .004) points.push(v); } }
    charge = [x, points.reduce((s, p) => s + p[1], 0) / points.length, points.reduce((s, p) => s + p[2], 0) / points.length];
  }
  const meta = { cls: config.cls || 'rifle', sourceAsset: source.title, credit: source.author,
    muzzle, sight: [sightY, rearZ], ironDist: config.ironDist || .35,
    rail,
    fore: config.fore, grip: config.grip || null, port: config.port || null, charge,
    slideTop: config.slideTop || null, magDir: config.magDir || [0, -1, 0], pivots,
    extra: { importedExpansion: true, ironFront: [0, sightY, frontZ], ironRear: [0, sightY, rearZ], ...(config.extra || {}) } };
  for (const a of root.listAnimations()) a.dispose();
  for (const n of root.listNodes()) n.dispose();
  for (const m of root.listMeshes()) m.dispose();
  for (const s of root.listSkins()) s.dispose();
  const scene = root.getDefaultScene() || root.listScenes()[0], top = doc.createNode(id).setExtras({ lz: meta }); scene.addChild(top);
  for (const [part, primitives] of Object.entries(parts)) {
    const mesh = doc.createMesh(part); primitives.forEach(p => mesh.addPrimitive(p));
    top.addChild(doc.createNode(part).setMesh(mesh).setExtras({ part }));
  }
  if (config.surfaceFinish) {
    // The MCX/R700 sources use solid PBR colours. Add a restrained manufactured
    // surface grain, keeping the artist's colour and metal/roughness factors.
    const pixels = new Uint8Array(256 * 256 * 3); let seed = 0x4c5a77;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const value = 244 + (seed >>> 0) % 12 - (x % 43 === 0 ? 4 : 0);
      for (let c = 0; c < 3; c++) pixels[(y * 256 + x) * 3 + c] = value;
    }
    const finish = doc.createTexture('authored_surface_grain').setImage(await sharp(pixels, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer()).setMimeType('image/png');
    for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
      const material = p.getMaterial(); if (material.getBaseColorTexture() && material.getBaseColorTexture() !== finish) continue;
      material.setBaseColorTexture(finish);
      material.getBaseColorTextureInfo().setWrapS(10497).setWrapT(10497);
      const positions = p.getAttribute('POSITION'), normals = p.getAttribute('NORMAL'), uv = new Float32Array(positions.getCount() * 2);
      for (let i = 0; i < positions.getCount(); i++) {
        const v = positions.getElement(i, []), n = normals.getElement(i, []).map(Math.abs);
        const axes = n[1] > n[0] && n[1] > n[2] ? [2, 0] : n[0] > n[2] ? [2, 1] : [0, 1];
        uv[i * 2] = v[axes[0]] * 8; uv[i * 2 + 1] = v[axes[1]] * 8;
      }
      p.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv));
    }
  }
  // Source atlases often share the same material name; names must identify maps.
  root.listMaterials().forEach((m, i) => m.setName(id + '_' + i + '_' + m.getName()).setDoubleSided(false));
  await doc.transform(prune(), dedup(), weld(),
    ...(config.simplify ? [simplify({ simplifier: MeshoptSimplifier, ratio: config.simplify, error: .0005 })] : []),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 85 }),
    reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 15, quantizeNormal: 10 }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const binary = await io.writeBinary(doc);
  fs.writeFileSync(path.join(OUT, id + '.glb'), binary);
  console.log(id, (binary.length / 1024).toFixed(0) + ' KiB', JSON.stringify(meta), 'parts', Object.keys(parts).join(','));
}
if (require.main === module) (async () => {
  const folder = process.argv[2]; if (!folder) throw Error('Provide the downloaded source directory');
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of process.argv[3]?.split(',') || Object.keys(manifest.models)) await build(io, folder, id, manifest.models[id]);
})().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { animate, bake };
