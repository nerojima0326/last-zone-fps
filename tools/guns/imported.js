// CC0 models baked into the same movable-part format as the existing guns.
// Source downloads, pinned revisions and SHA-256 hashes: imported-sources.json.
import { THREE } from './kit.js';
import { DESIGNS } from './designs.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const IMPORTED = {
  sc17: 'Rifle_Battle_West.glb',
  m1014: 'Shotgun_Pump_East.glb',
  sa12: 'Shotgun_Auto_East.glb',
  aa12: 'Shotgun_Auto_West.glb',
  db2: 'doublebarrelshotgun.gltf'
};
const dir = './src/imported/';
const key = name => name.toLowerCase().replace(/[^a-z]/g, '');

function partFor(name, id) {
  const n = key(name);
  if (n === 'shell') return null; // Gameplay supplies the loading/ejected shells.
  if (n === 'magazine') return 'mag';
  if (n === 'rearsights') return 'rearsight';
  if (n === 'bolt' || n.startsWith('charginghandle')) return 'charge';
  if (id === 'db2' && n === 'barrel') return 'barrel';
  // M-1014 uses a fixed fore-end; it must not pump on a semi-auto shot.
  return 'body';
}

async function texture(name, srgb) {
  const original = await new THREE.TextureLoader().loadAsync(dir + name);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  canvas.getContext('2d').drawImage(original.image, 0, 0, 1024, 1024);
  const result = new THREE.Texture(canvas);
  result.flipY = false;
  result.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  result.userData.mimeType = 'image/jpeg';
  result.needsUpdate = true;
  original.dispose();
  return result;
}

export async function buildImported(id) {
  const gltf = await new GLTFLoader().loadAsync(dir + IMPORTED[id]);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
  const bounds = new THREE.Box3().setFromObject(root);
  const triggerNode = root.getObjectByName('Trigger');
  const trigger = triggerNode.isMesh
    ? new THREE.Box3().setFromObject(triggerNode).getCenter(new THREE.Vector3())
    : triggerNode.getWorldPosition(new THREE.Vector3());
  // Keep muzzle length close to the previous rig, except the short DB-2 asset.
  const meta = structuredClone(DESIGNS[id]().meta);
  const scale = id === 'db2' ? 1.1 : Math.abs(meta.muzzle[2] / (bounds.min.z - trigger.z));
  const point = p => p.clone().sub(trigger).multiplyScalar(scale);
  const namedPoint = name => {
    let node;
    root.traverse(o => { if (key(o.name) === key(name)) node = o; });
    return node ? point(node.getWorldPosition(new THREE.Vector3())).toArray() : null;
  };
  const mats = {}, meshes = [];
  let boomstick;
  if (id === 'db2') {
    const [map, normalMap, arm] = await Promise.all([
      texture('Boomstick_baseColor.png', true), texture('Boomstick_normal.png', false),
      texture('Boomstick_occlusionRoughnessMetallic.png', false)
    ]);
    boomstick = new THREE.MeshStandardMaterial({ name: 'boomstick', map, normalMap,
      roughnessMap: arm, metalnessMap: arm, roughness: 1, metalness: 1 });
  }
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const g = mesh.geometry, pos = g.attributes.position, normal = g.attributes.normal;
    const joints = g.attributes.skinIndex, weights = g.attributes.skinWeight;
    const buckets = new Map();
    const material = boomstick || mesh.material.clone();
    material.name = boomstick ? 'boomstick' : material.name;
    mats[material.name] = material;
    // Split whole triangles by the strongest bone influence. The source rigs
    // have rigid gun parts; never export skinning or split a triangle's vertices.
    const count = g.index ? g.index.count : pos.count;
    for (let t = 0; t < count; t += 3) {
      const indices = [0, 1, 2].map(k => g.index ? g.index.getX(t + k) : t + k);
      const votes = new Map();
      if (mesh.isSkinnedMesh) for (const i of indices) for (let k = 0; k < 4; k++) {
        const bone = joints.getComponent(i, k);
        votes.set(bone, (votes.get(bone) || 0) + weights.getComponent(i, k));
      }
      const bone = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
      const part = partFor(bone === undefined ? mesh.name : mesh.skeleton.bones[bone].name, id);
      if (!part) continue;
      if (!buckets.has(part)) buckets.set(part, { p: [], n: [], uv: [] });
      const out = buckets.get(part);
      for (const i of indices) {
        const p = new THREE.Vector3().fromBufferAttribute(pos, i);
        if (mesh.isSkinnedMesh) mesh.applyBoneTransform(i, p);
        point(p.applyMatrix4(mesh.matrixWorld)).toArray(out.p, out.p.length);
        const n = new THREE.Vector3().fromBufferAttribute(normal, i)
          .transformDirection(mesh.matrixWorld);
        n.toArray(out.n, out.n.length);
        out.uv.push(g.attributes.uv?.getX(i) || 0, g.attributes.uv?.getY(i) || 0);
      }
    }
    for (const [part, out] of buckets) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(out.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
      meshes.push({ part, mat: material.name, geo });
    }
  });
  const box = part => {
    const b = new THREE.Box3();
    for (const m of meshes) if (!part || m.part === part) {
      m.geo.computeBoundingBox(); b.union(m.geo.boundingBox);
    }
    return b;
  };
  const B = box(), muzzleBone = namedPoint('Attach_Muzzle');
  // Muzzle attachment bones can sit behind a flash hider: use the geometry tip.
  const front = meshes.flatMap(m => {
    const a = m.geo.attributes.position, result = [];
    for (let i = 0; i < a.count; i++) if (a.getZ(i) < B.min.z + .008) result.push(a.getY(i));
    return result;
  });
  meta.muzzle = [0, muzzleBone?.[1] ?? (Math.min(...front) + Math.max(...front)) / 2, B.min.z];
  meta.sight = [B.max.y + .002, Math.min(.075, B.max.z - .05)];
  const rail = namedPoint('Attach_Scope');
  meta.rail = rail ? [rail[1], rail[2], 'body'] : [meta.sight[0] - .012, -.07, 'body'];
  meta.pivots = {};
  for (const part of ['mag', 'charge']) {
    const b = box(part);
    if (!b.isEmpty()) {
      const c = b.getCenter(new THREE.Vector3());
      if (part === 'mag') c.y = b.max.y;
      meta.pivots[part] = c.toArray();
      if (part === 'charge') meta.charge = [b.max.x + .008, c.y, c.z];
    }
  }
  // A bolt's bounding box includes its internal slide. Hook the actual exposed
  // charging handle, rather than the centre of that combined moving assembly.
  const handle = namedPoint('Charging Handle End') || namedPoint('Charging Handle');
  if (handle) meta.charge = handle;
  if (id === 'sa12') {
    const chargeBox = box('charge');
    const a = meshes.filter(m => m.part === 'charge').flatMap(m => {
      const p = m.geo.attributes.position, result = [];
      for (let i = 0; i < p.count; i++) if (p.getX(i) > chargeBox.max.x - .004)
        result.push(new THREE.Vector3().fromBufferAttribute(p, i));
      return result;
    });
    meta.charge = a.reduce((v, p) => v.add(p), new THREE.Vector3()).divideScalar(a.length).toArray();
  }
  if (id === 'sa12') meta.extra.chargeMode = 'under';
  if (id === 'sc17') {
    meta.extra.chargeApproachLift = .025;
    // The source magazine includes the feed lips and rounds inside the receiver.
    // Its insertion pivot belongs at the magwell mouth, below those hidden tips.
    meta.pivots.mag[1] -= .035;
  }
  if (id === 'm1014') {
    const pump = namedPoint('Pump');
    meta.fore = [pump[0] - .004, pump[1] - .025, pump[2]];
    const lifter = namedPoint('Lifter');
    meta.port = [0, lifter[1] - .006, lifter[2]];
  }
  if (id === 'db2') {
    meta.pivots.barrel = point(new THREE.Vector3(0, -.018, -.082)).toArray();
    meta.fore = point(new THREE.Vector3(-.004, -.026, -.23)).toArray();
    meta.port = point(new THREE.Vector3(0, .018, -.083)).toArray();
  }
  meta.credit = id === 'db2' ? 'Boomstick / Godot-Dojo (CC0)' : 'Flat Guns / Pichuliru (CC0)';
  meta.sourceAsset = IMPORTED[id];
  meta.license = 'CC0-1.0';
  return { meshes, mats, meta, tris: meshes.reduce((n, m) => n + m.geo.attributes.position.count / 3, 0) };
}
