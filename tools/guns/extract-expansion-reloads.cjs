// Extract the licensed wrist/gun curves. The runtime retargets flights between
// semantic grip events instead of copying a mismatched skeleton or magazine.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), T = require('three');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { MeshoptDecoder } = require('meshoptimizer');
const { animate } = require('./import-expansion.cjs');
const manifest = require('./expansion-sources.json');
const folder = process.argv[2];
const OUT = path.resolve(__dirname, '../../assets/animations/reloads/expansion.json');
const V = T.Vector3, Q = T.Quaternion, M = T.Matrix4;
function extract(document, config) {
  const root = document.getRoot(), nodes = root.listNodes(), animation = root.listAnimations().find(a => a.getName() === config.clip);
  if (!animation) throw Error('Missing animation: ' + config.clip);
  const duration = Math.max(...animation.listSamplers().map(s => s.getInput().getMax([])[0]));
  const [start, end] = config.range || [0, duration];
  if (!(end > start && end <= duration + .01)) throw Error('Invalid source interval');
  const find = pattern => nodes.find(n => new RegExp(pattern).test(n.getName()));
  const left = find(config.left || '^(L_wrist|LeftHand1$|Hand_L(?:_|$))'), right = find(config.right || '^(R_wrist|RightHand1$|Hand_R(?:_|$))'), gun = config.gun && find(config.gun);
  if (!left || !right || (config.gun && !gun)) throw Error('Missing source wrist/gun');
  animate(document, config.clip, start);
  const position = node => new V().setFromMatrixPosition(new M().fromArray(node.getWorldMatrix()));
  const orientation = node => new Q().setFromRotationMatrix(new M().fromArray(node.getWorldMatrix()).extractRotation(new M().fromArray(node.getWorldMatrix())));
  const initial = gun ? position(gun) : position(right), rest = gun ? orientation(gun) : new Q();
  const inverse = rest.clone().invert(), scale = config.scale || 1;
  const frames = Math.ceil((end - start) * 60) + 1, samples = [];
  for (let i = 0; i < frames; i++) {
    animate(document, config.clip, start + (end - start) * i / (frames - 1));
    const origin = gun ? position(gun) : position(right), rotation = gun ? orientation(gun).multiply(inverse) : new Q();
    const hand = node => position(node).sub(origin).applyQuaternion(inverse).multiplyScalar(scale).toArray();
    const angles = new T.Euler().setFromQuaternion(inverse.clone().multiply(rotation).multiply(rest), 'YXZ');
    const row = [...hand(left), ...hand(right), ...origin.clone().sub(initial).applyQuaternion(inverse).multiplyScalar(scale).toArray(), angles.x, angles.y, angles.z];
    if (!row.every(Number.isFinite)) throw Error('Invalid source sample');
    samples.push(row.map(x => +x.toFixed(6)));
  }
  return { source: config.source, sourceClip: config.clip, sourceRange: [start, end], duration: end - start,
    gunMotion: !!gun, samples };
}
(async () => {
  if (!folder) throw Error('Provide downloaded sources');
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }), clips = {}, weapons = {};
  for (const [id, config] of Object.entries(manifest.reloads)) {
    weapons[id] = {};
    for (const mode of ['empty', 'tactical']) {
      const c = config[mode], source = manifest.sources[c.source], key = c.source + ':' + c.clip + ':' + (c.range || []).join('-');
      if (!clips[key]) {
        if (c.source === 'shell-curves') {
          const existing = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../assets/animations/reloads/motion.json')));
          clips[key] = { ...existing.clips.shell, source: c.source, gunMotion: true };
        } else {
          const file = path.join(folder, source.file);
          if (source.sha256 && crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== source.sha256) throw Error('Checksum mismatch: ' + source.file);
          // Each clip starts from a fresh hierarchy; unkeyed transforms must not
          // inherit the preceding weapon's end pose.
          const doc = await io.read(file); clips[key] = extract(doc, c);
        }
        console.log(key, clips[key].samples.length, 'frames', clips[key].duration.toFixed(2), 'seconds');
      }
      weapons[id][mode] = key;
    }
  }
  fs.writeFileSync(OUT, JSON.stringify({ version: 1, fps: 60, license: 'CC-BY-4.0', weapons, clips }) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
