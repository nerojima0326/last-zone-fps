// Extract animation curves only; source meshes and textures are not bundled.
// Usage: THREE_DIR=/path/to/three node tools/extract-reload-motions.mjs <source-dir> <output.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const T = await import(pathToFileURL(path.join(process.env.THREE_DIR, 'build/three.module.js')).href);
const [sourceDir, output] = process.argv.slice(2);
if (!sourceDir || !output) throw Error('Provide source directory and output JSON');
for (const entry of JSON.parse(fs.readFileSync(new URL('./reload-motion-sources.json', import.meta.url)))) {
  const hash = createHash('sha256').update(fs.readFileSync(path.join(sourceDir, entry.file))).digest('hex');
  if (hash !== entry.sha256) throw Error('Source checksum mismatch: ' + entry.file);
}

function read(name) {
  const raw = fs.readFileSync(path.join(sourceDir, name));
  if (name.endsWith('.glb')) {
    const size = raw.readUInt32LE(12);
    return { json: JSON.parse(raw.subarray(20, 20 + size)), binary: raw.subarray(28 + size) };
  }
  return { json: JSON.parse(raw), binary: fs.readFileSync(path.join(sourceDir, 'ak.bin')) };
}
function rig(source, clipName) {
  const { json: j, binary } = source;
  const get = index => {
    const a = j.accessors[index], v = j.bufferViews[a.bufferView];
    if (a.componentType !== 5126 || a.sparse) throw Error('Unsupported animation accessor');
    const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
    const result = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++)
      result[i * n + k] = binary.readFloatLE((v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || 4 * n) + k * 4);
    return result;
  };
  const nodes = j.nodes.map(n => {
    const o = new T.Object3D(); o.name = n.name;
    if (n.matrix) new T.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
    else { if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); }
    return o;
  });
  j.nodes.forEach((n, i) => (n.children || []).forEach(child => nodes[i].add(nodes[child])));
  const scene = new T.Group(); nodes.filter(o => !o.parent).forEach(o => scene.add(o));
  const anim = j.animations.find(a => a.name === clipName);
  if (!anim) throw Error('Missing source clip: ' + clipName);
  const tracks = anim.channels.map(c => {
    const sampler = anim.samplers[c.sampler];
    if (sampler.interpolation && sampler.interpolation !== 'LINEAR') throw Error('Unsupported interpolation');
    const property = { translation: 'position', rotation: 'quaternion', scale: 'scale' }[c.target.path];
    const Type = c.target.path === 'rotation' ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack;
    return new Type(nodes[c.target.node].uuid + '.' + property, get(sampler.input), get(sampler.output));
  });
  const clip = new T.AnimationClip(clipName, -1, tracks), mixer = new T.AnimationMixer(scene);
  mixer.clipAction(clip).setLoop(T.LoopOnce, 1).play().clampWhenFinished = true;
  const find = prefix => nodes.find(o => o.name.startsWith(prefix));
  return { scene, mixer, clip, left: find('Hand_L_'), right: find('Hand_R_'),
    gun: find('PBody_') || find('Body_'), camera: find('Head_Cam_') };
}
function extract(source, name) {
  const r = rig(source, name), v = () => new T.Vector3(), q = () => new T.Quaternion();
  r.mixer.setTime(0); r.scene.updateMatrixWorld(true);
  const camera = r.camera.getWorldQuaternion(q()).invert();
  const gunStart = r.gun.getWorldPosition(v()), orientation = r.gun.getWorldQuaternion(q());
  const sample = time => {
    r.mixer.setTime(time); r.scene.updateMatrixWorld(true);
    const gun = r.gun.getWorldPosition(v());
    const delta = r.gun.getWorldQuaternion(q()).multiply(orientation.clone().invert());
    const hand = node => node.getWorldPosition(v()).sub(gun).applyQuaternion(delta.clone().invert()).applyQuaternion(camera).toArray();
    const viewRotation = camera.clone().multiply(delta).multiply(camera.clone().invert());
    const angles = new T.Euler().setFromQuaternion(viewRotation, 'YXZ');
    return [...hand(r.left), ...hand(r.right),
      ...gun.clone().sub(gunStart).applyQuaternion(camera).toArray(), angles.x, angles.y, angles.z];
  };
  const frames = Math.ceil(r.clip.duration * 60) + 1;
  const samples = Array.from({ length: frames }, (_, i) => sample(i / (frames - 1) * r.clip.duration)
    .map(x => +x.toFixed(6)));
  if (!samples.flat().every(Number.isFinite)) throw Error('Nonfinite source animation');
  return { sourceClip: name, duration: r.clip.duration, samples };
}
const ak = read('ak.gltf'), sg = read('remington.glb');
const data = { version: 1, fps: 60, license: 'CC-BY-4.0', author: 'Cransh', clips: {
  magazine: extract(ak, 'Rig|AK_Reload'),
  magazineEmpty: extract(ak, 'Rig|AK_Reload_full'),
  shell: extract(sg, 'Armature|SG_FPS_Reload')
} };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(data) + '\n');
for (const [id, c] of Object.entries(data.clips)) console.log(id, c.duration, 'seconds', c.samples.length, 'samples',
  'first', c.samples[0], 'middle', c.samples[Math.floor(c.samples.length / 2)]);
