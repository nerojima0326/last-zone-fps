// range-props.js — 사격장 시설과 Patch 에셋. 정적 소품은 공유 메시/재질을 재사용한다.
(function () {
'use strict';
const THREE = window.THREE, G = window.G;
const BASE = 'assets/patch/range/';
const NC = { nc: true };

function fallbackModel(w, h, d, color) {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  scene.add(mesh);
  return scene;
}

const P = G.RangeProps = {
  models: {}, textures: {},

  async load(renderer) {
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const loader = new THREE.TextureLoader();
    const model = async (key, file, fallback) => {
      try {
        if (!THREE.GLTFLoader) throw new Error('GLTFLoader unavailable');
        this.models[key] = (await new THREE.GLTFLoader().loadAsync(BASE + file)).scene;
      } catch (e) {
        this.models[key] = fallback();
        console.info('[range] ' + key + ' unavailable; using a simple prop');
      }
    };
    const texture = async (key, name, srgb) => {
      const t = await G.Assets.loadTex(loader, BASE + 'concreteFloorPainted/concrete_floor_painted_' + name + '.jpg', srgb, aniso);
      if (t) this.textures[key] = t;
    };
    await Promise.all([
      model('sandbag', 'sandbag-wall-section-7075ee.glb', () => fallbackModel(4, 1.2, 0.61, 0x797449)),
      model('crate', 'plastic_crate_01.glb', () => fallbackModel(0.3, 0.264, 0.408, 0x465044)),
      texture('map', 'baseColor', true), texture('normalMap', 'normal', false), texture('arm', 'arm', false)
    ]);
    // Retain the photographed wear while matching the range's grey/olive concrete palette.
    if (this.textures.map) {
      const original = this.textures.map;
      this.textures.map = this.recolor(original, [103, 109, 103], 0.49);
      original.dispose();
    }
  },

  recolor(texture, base, contrast) {
    const image = texture.image;
    const map = G.Tex.canvas(image.width, image.height, (c, w, h) => {
      c.drawImage(image, 0, 0, w, h);
      const pixels = c.getImageData(0, 0, w, h), d = pixels.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
        d[i] = base[0] + l * contrast; d[i + 1] = base[1] + l * contrast; d[i + 2] = base[2] + l * contrast;
      }
      c.putImageData(pixels, 0, 0);
    });
    map.flipY = texture.flipY; map.anisotropy = texture.anisotropy;
    return map;
  },

  // A small shared atlas per sign; all lettering is painted into the scene, not DOM labels.
  sign(group, text, sub, x, y, z, w, h, yaw, accent) {
    const cache = this.signMaterials || (this.signMaterials = new Map());
    const key = [text, sub, accent].join('|');
    if (!cache.has(key)) {
    const map = G.Tex.canvas(1024, 256, (c, W, H) => {
      c.fillStyle = '#252d29'; c.fillRect(0, 0, W, H);
      c.fillStyle = accent || '#d8b05d'; c.fillRect(0, 0, 15, H);
      c.strokeStyle = '#6a7266'; c.lineWidth = 3; c.strokeRect(25, 15, W - 40, H - 30);
      c.fillStyle = '#eee8d4'; c.font = 'bold 92px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, W / 2, sub ? 96 : H / 2, W - 80);
      if (sub) { c.fillStyle = '#c2c6b5'; c.font = '30px sans-serif'; c.fillText(sub, W / 2, 192, W - 80); }
      // Slightly rubbed edges and rivets, without dirtying the lettering.
      for (const px of [39, W - 26]) for (const py of [29, H - 29]) {
        c.fillStyle = '#a7aaa0'; c.beginPath(); c.arc(px, py, 5, 0, Math.PI * 2); c.fill();
      }
    }, { clamp: true });
    cache.set(key, new THREE.MeshStandardMaterial({ map, roughness: 0.9, side: THREE.FrontSide }));
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cache.get(key));
    m.position.set(x, y, z); m.rotation.y = yaw || 0; m.receiveShadow = true;
    m.name = 'range-sign-' + text;
    group.add(m);
    const back = m.clone();
    back.name += '-back'; back.rotation.y += Math.PI;
    back.position.x -= Math.sin(yaw || 0) * 0.006;
    back.position.z -= Math.cos(yaw || 0) * 0.006;
    group.add(back);
    return m;
  },

  // One instanced draw per glTF mesh, with collision bounds derived from the same transform.
  instances(W, group, key, placements, width, matKind) {
    const source = this.models[key];
    source.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(source), size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3()), scale = width / size.x;
    const normal = new THREE.Matrix4().makeScale(scale, scale, scale);
    normal.setPosition(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    const transforms = placements.map(p => {
      const m = new THREE.Matrix4().makeRotationY(p.yaw || 0);
      m.setPosition(p.x, p.y || 0, p.z);
      return m.multiply(normal);
    });
    source.traverse(mesh => {
      if (!mesh.isMesh) return;
      const material = mesh.material.clone();
      material.vertexColors = !!mesh.geometry.getAttribute('color');
      if (key === 'sandbag') { material.side = THREE.FrontSide; material.roughness = 0.98; material.metalness = 0; }
      if (key === 'crate' && material.map) {
        // Desaturate the red plastic and tint it olive; reuse one map for all supply crates.
        this.crateMap = this.crateMap || this.recolor(material.map, [29, 39, 25], 0.66);
        material.map = this.crateMap;
      }
      const inst = new THREE.InstancedMesh(mesh.geometry, material, placements.length);
      inst.name = 'range-' + key;
      transforms.forEach((m, i) => inst.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld)));
      inst.instanceMatrix.needsUpdate = true; inst.castShadow = true; inst.receiveShadow = true;
      inst.computeBoundingSphere(); group.add(inst);
    });
    return transforms.map(m => {
      const box = bounds.clone().applyMatrix4(m).translate(group.position);
      return W.addCollider(box.min.x + 0.025, box.min.y, box.min.z + 0.025,
        box.max.x - 0.025, box.max.y, box.max.z - 0.025, matKind);
    });
  },

  build(W, b, FL) {
    const R = W.range, C = hex => new THREE.Color(hex);
    const group = new THREE.Group(); group.name = 'training-range-props';
    group.position.set(b.x, b.y, b.z); W.scene.add(group);
    const olive = C(0x4d5945), steel = C(0x444b46), yellow = C(0xd5ad48), wood = C(0x796749);
    const box = (x0, y0, z0, x1, y1, z1, mat, color, opts) => W.boxMM(b, x0, y0, z0, x1, y1, z1, mat, color, opts);
    const pad = (x, z, w, d) => {
      // The original slab remains underneath. The small top collider also gives hard footsteps.
      box(x - w / 2, -0.18, z - d / 2, x + w / 2, 0.075, z + d / 2, 'concrete', C(0x8b887c));
      const maps = {}, source = this.textures;
      for (const key of ['map', 'normalMap', 'arm']) if (source[key]) {
        maps[key] = source[key].clone(); maps[key].repeat.set(w / 3, d / 3); maps[key].needsUpdate = true;
      }
      const material = new THREE.MeshStandardMaterial({ color: maps.map ? 0xc7c4b4 : 0x77776a,
        map: maps.map || null, normalMap: maps.normalMap || null, normalScale: new THREE.Vector2(0.45, 0.45),
        roughnessMap: maps.arm || null, aoMap: maps.arm || null, aoMapIntensity: 0.45, roughness: 1 });
      const geo = new THREE.PlaneGeometry(w, d);
      geo.setAttribute('uv1', geo.attributes.uv.clone());
      const m = new THREE.Mesh(geo, material); m.name = 'range-concrete-pad';
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.077, z); m.receiveShadow = true; group.add(m);
      W.footprints.push({ minX: b.x + x - w / 2, maxX: b.x + x + w / 2,
        minZ: b.z + z - d / 2, maxZ: b.z + z + d / 2, kind: 'pad' });
      // Slab joints break up the repeated texture.
      for (let xx = x - w / 2 + 4; xx < x + w / 2; xx += 4)
        box(xx, 0.081, z - d / 2, xx + 0.018, 0.089, z + d / 2, 'dark', C(0x41433d), NC);
    };
    pad(0, FL + 5, 32, 10);
    pad(0, FL + 12, 44, 4);
    pad(-24, FL + 5, 14, 10);
    pad(23, FL + 5, 12, 10);

    // Four numbered booths; the aisle behind them and both table approaches stay open.
    const booths = [-11.2, -4, 3.2, 10.4];
    for (const x of [-15.4, -7.6, -0.4, 6.8, 15.4]) {
      box(x - 0.045, 0.08, FL + 0.15, x + 0.045, 1.3, FL + 3.5, 'metal', olive);
      box(x - 0.065, 1.3, FL + 0.15, x + 0.065, 1.37, FL + 3.5, 'metal', steel, NC);
      box(x - 0.065, 0.6, FL + 3.38, x + 0.065, 1.2, FL + 3.52, 'paint', yellow, NC);
    }
    const names = ['RIFLES', 'SHOTGUNS', 'SIDEARMS', 'OPTICS / GRENADES'];
    booths.forEach((x, i) => {
      this.sign(group, '0' + (i + 1) + '  /  ' + names[i], 'FIRING BAY', x, 2.85, FL + 0.28, 5.5, 0.7);
      // Scuffed lane borders and a visible firing line, kept below feet.
      for (const edge of [-2.8, 2.8]) box(x + edge, 0.083, FL + 0.1, x + edge + 0.045, 0.093, FL + 3.45, 'paint', yellow, NC);
      box(x - 2.8, 0.083, FL + 0.12, x + 2.8, 0.093, FL + 0.23, 'paint', yellow, NC);
    });
    R.spawn.x = b.x + 3.2; R.spawn.z = b.z + FL + 4.5;
    this.sign(group, 'LAST ZONE', 'TRAINING RANGE   /   120 M', 0, 3.1, FL + 10.51, 10, 0.82);
    this.sign(group, 'ATTACHMENTS', 'RETURN EQUIPMENT AFTER USE', 0, 1.65, FL + 8.28, 4.2, 0.55);
    this.sign(group, 'SUPPLY', 'AMMUNITION / EQUIPMENT', -24, 1.85, FL + 0.2, 4.8, 0.75);
    this.sign(group, 'KEEP CLEAR', 'LIVE FIRE / EYE & EAR PROTECTION', 23, 1.85, FL + 0.2, 4.8, 0.75);
    for (const x of [-26, -22, 21, 25]) box(x - 0.045, 0.08, FL + 0.12, x + 0.045, 2.25, FL + 0.21, 'metal', steel);
    // Rear walkway: dashed safe boundary, not a wall.
    for (let x = -20; x < 21; x += 1.5) box(x, 0.083, FL + 13.65, x + 0.8, 0.093, FL + 13.8, 'paint', yellow, NC);

    // Sandbag pockets sit outside the complete target/rail corridor (|x| <= 17.4 m).
    const bags = [];
    for (const side of [-1, 1]) {
      for (const x of [22, 26]) bags.push({ x: side * x, z: FL - 2 });
      for (const z of [FL - 4.3, FL - 8.3]) bags.push({ x: side * 28.3, z, yaw: Math.PI / 2 });
      for (const z of [FL - 11, FL - 30, FL - 50]) {
        bags.push({ x: side * 24, z });
        bags.push({ x: side * 26.3, z: z - 2.3, yaw: Math.PI / 2 });
      }
    }
    // Follow the actual ground rather than floating where the flattened town meets terrain.
    bags.forEach(p => { p.y = W.heightAt(b.x + p.x, b.z + p.z) - b.y; });
    const bagColliders = this.instances(W, group, 'sandbag', bags, 4, 'soft');

    // Pallet and reusable supply crates, kept off the weapon and attachment tables.
    for (const x of [-25.6, -24.4]) box(x - 0.08, 0.08, FL + 5, x + 0.08, 0.18, FL + 8, 'wood', wood);
    for (let z = FL + 5; z < FL + 8; z += 0.35) box(-26, 0.18, z, -24, 0.24, z + 0.27, 'wood', wood, NC);
    const crates = [];
    const crateWidth = 0.66, crateHeight = 0.2641694248 / 0.2980006337 * crateWidth;
    for (const x of [-25.5, -24.65]) for (let layer = 0; layer < 2; layer++)
      crates.push({ x, y: 0.24 + layer * crateHeight, z: FL + 6.1 });
    const crateColliders = this.instances(W, group, 'crate', crates, crateWidth, 'hard');
    const cases = [];
    for (const x of [-21.8, -20.4, 20.5]) for (let layer = 0; layer < 2; layer++) {
      const z = FL + 7.1, yy = 0.08 + layer * 0.48;
      const colliderStart = W.boxes.length;
      box(x - 0.55, yy, z - 0.33, x + 0.55, yy + 0.45, z + 0.33, 'metal', olive);
      cases.push(W.boxes[colliderStart]);
      box(x - 0.58, yy + 0.37, z - 0.35, x + 0.58, yy + 0.46, z + 0.35, 'metal', steel, NC);
      for (const dx of [-0.37, 0.37]) box(x + dx - 0.035, yy + 0.25, z + 0.335, x + dx + 0.035, yy + 0.43, z + 0.365, 'paint', yellow, NC);
      this.sign(group, x > 0 ? '7.62' : '5.56', '', x, yy + 0.2, z + 0.337, 0.46, 0.15);
    }
    R.props = { group, sandbags: bagColliders, crates: crateColliders, ammoCases: cases, booths: booths.length };
  }
};
})();
