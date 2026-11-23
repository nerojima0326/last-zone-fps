// v78: precomputed ambient visibility for deterministic static world chunks.
// No screen-space buffer or per-frame rays. Hashes reject stale bake data.
(function () {
'use strict';
const G = window.G, T = window.THREE;
G.StaticAO = {
  data: null, enabled: { value: 1 }, applied: 0, rejected: 0,
  hash(geometry) {
    const a = geometry.attributes.position.array;
    const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    let h = 2166136261;
    for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 16777619);
    return h >>> 0;
  },
  async load() {
    if (location.protocol === 'file:') return;
    try {
      const r = await fetch('assets/lighting/static-ao.json?v=' + (window.LZ_BUILD || ''));
      if (!r.ok) return;
      const data = await r.json();
      if (data.version === 1 && data.chunks && typeof data.chunks === 'object') this.data = data;
    } catch (e) { console.info('[lighting] static AO unavailable'); }
  },
  apply(geometry, key) {
    const n = geometry.attributes.position.count, entry = this.data?.chunks?.[key];
    const values = new Uint8Array(n); values.fill(255);
    if (entry && entry.count === n && entry.hash === this.hash(geometry)) {
      let bytes = '';
      try { bytes = atob(typeof entry.values === 'string' ? entry.values : ''); } catch (e) { /* invalid bake: full ambient visibility */ }
      if (bytes.length === n) { for (let i = 0; i < n; i++) values[i] = bytes.charCodeAt(i); this.applied++; }
      else this.rejected++;
    } else if (entry) this.rejected++;
    geometry.setAttribute('staticAO', new T.BufferAttribute(values, 1, true));
  },
  shader(shader) {
    shader.uniforms.uStaticAO = this.enabled;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float staticAO; varying float vStaticAO;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStaticAO = staticAO;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uStaticAO; varying float vStaticAO;')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nfloat bakedAO = mix(1.0, vStaticAO, uStaticAO);\nreflectedLight.indirectDiffuse *= bakedAO;\nreflectedLight.indirectSpecular *= mix(1.0, bakedAO, material.roughness);');
  }
};
})();
