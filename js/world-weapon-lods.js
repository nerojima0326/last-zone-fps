// Shared, offline simplified geometry for world weapons. First-person meshes
// remain untouched. Zoom-aware hysteresis keeps distant silhouettes stable.
(function () {
'use strict';
const G = window.G, T = window.THREE, at = new T.Vector3(), eye = new T.Vector3();
const W = G.WorldWeapons = {
  models: {},
  async load() {
    if (location.protocol === 'file:' || !T.GLTFLoader) return;
    try {
      const loader = new T.GLTFLoader();
      if (T.MeshoptDecoder) loader.setMeshoptDecoder(T.MeshoptDecoder);
      const gltf = await loader.loadAsync('assets/models/guns/world-lods.glb?v=' + (window.LZ_BUILD || ''));
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(o => {
        if (!o.isMesh) return;
        const match = /^(.*)_(mid|far)$/.exec(o.name);
        if (!match) return;
        const geo = o.geometry.clone();
        // Quantized normalized positions may exceed [-1, 1] after the glTF
        // decode transform. Expand before baking that transform into vertices.
        for (const key of ['position', 'normal']) {
          const a = geo.attributes[key]; if (!a) continue;
          const values = new Float32Array(a.count * 3);
          for (let i = 0; i < a.count; i++) values.set([a.getX(i), a.getY(i), a.getZ(i)], i * 3);
          geo.setAttribute(key, new T.BufferAttribute(values, 3));
        }
        geo.applyMatrix4(o.matrixWorld);
        geo.computeBoundingSphere();
        (this.models[match[1]] ||= {})[match[2]] = { geo, mat: o.material };
      });
    } catch (e) { console.info('[guns] world LOD unavailable; full meshes retained'); }
  },
  wrap(id, high) {
    const data = this.models[id];
    if (!data?.mid || !data?.far) return high;
    const lod = new T.LOD(); lod.name = 'World weapon ' + id;
    lod.addLevel(high, 0);
    for (const [key, distance] of [['mid', 12], ['far', 28]]) {
      const m = new T.Mesh(data[key].geo, data[key].mat); m.castShadow = high.castShadow;
      m.name = id + ' ' + key; lod.addLevel(m, distance, .12);
    }
    // Existing actor code sets castShadow on the weapon root.
    Object.defineProperty(lod, 'castShadow', { configurable: true,
      get() { return this.levels[0].object.castShadow; },
      set(on) { for (const level of this.levels) level.object.castShadow = on; }
    });
    lod.update = function (camera) {
      eye.setFromMatrixPosition(camera.matrixWorld); at.setFromMatrixPosition(this.matrixWorld);
      const d = eye.distanceTo(at) / Math.max(1, G.lodZoom || 1);
      let level = 0;
      for (let i = 1; i < this.levels.length; i++) {
        const entry = this.levels[i], threshold = entry.distance * (entry.object.visible ? 1 - entry.hysteresis : 1);
        if (d >= threshold) level = i;
      }
      this._currentLevel = level;
      for (let i = 0; i < this.levels.length; i++) this.levels[i].object.visible = i === level;
    };
    return lod;
  }
};
})();
