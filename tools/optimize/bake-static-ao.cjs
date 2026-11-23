// Bake static world contact/ambient occlusion with short hemisphere rays.
// Rebuild after world generation changes. Runtime validates count + position hash.
const fs = require('fs'), path = require('path'), fixture = require('./browser-fixture.cjs');
(async () => {
  const f = await fixture({ query: 'textures=jpeg' });
  try {
    const data = await f.page.evaluate(() => {
      const W = G.World, cache = new Map(), chunks = {}; let samples = 0;
      const n = new THREE.Vector3(), t = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
      const dirs = [[0,0], [.85,0], [-.85,0], [0,.85], [0,-.85]];
      for (const mesh of G.scene.children.filter(o => o.userData.staticChunk)) {
        const g = mesh.geometry, p = g.attributes.position, normal = g.attributes.normal;
        const values = new Uint8Array(p.count);
        for (let i = 0; i < p.count; i++) {
          n.fromBufferAttribute(normal, i).normalize();
          const x = p.getX(i) + n.x * .035, y = p.getY(i) + n.y * .035, z = p.getZ(i) + n.z * .035;
          const key = [x,y,z,n.x,n.y,n.z].map(v => Math.round(v * 100)).join(',');
          let value = cache.get(key);
          if (value === undefined) {
            t.set(Math.abs(n.y) > .9 ? 1 : 0, Math.abs(n.y) > .9 ? 0 : 1, 0).cross(n).normalize(); b.crossVectors(n,t);
            let blocked = 0;
            for (const [u,v] of dirs) {
              d.copy(n).multiplyScalar(.65).addScaledVector(t,u).addScaledVector(b,v).normalize();
              const hit = W.rayBoxes(x,y,z,d.x,d.y,d.z,1.6,null);
              if (Number.isFinite(hit)) blocked += (1 - Math.min(1,hit / 1.6)) ** 1.2;
            }
            value = Math.round(255 * (1 - .42 * blocked / dirs.length)); cache.set(key,value); samples++;
          }
          values[i] = value;
        }
        let binary = ''; for (let i = 0; i < values.length; i++) binary += String.fromCharCode(values[i]);
        chunks[mesh.userData.staticChunk] = { count: p.count, hash: G.StaticAO.hash(g), values: btoa(binary) };
      }
      return { version: 1, seed: 20261028, rays: 5, radius: 1.6, strength: .42, samples, chunks };
    });
    if (f.errors.length) throw Error(f.errors.join('\n'));
    const out = path.resolve(__dirname, '../../assets/lighting'); fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'static-ao.json'),JSON.stringify(data)+'\n');
    console.log('Baked chunks:',Object.keys(data.chunks).length,'unique samples:',data.samples);
  } finally { await f.close(); }
})().catch(e => { console.error(e); process.exit(1); });
