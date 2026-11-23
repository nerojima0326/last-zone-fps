// Extract the game's normalized 30 world weapons, then build two real mesh LODs.
// NODE_PATH=<playwright,three,gltf-transform,meshoptimizer> THREE_DIR=... CHROME_BIN=... node ...
const fs = require('fs'), path = require('path'), fixture = require('./browser-fixture.cjs');
const { Document, NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { prune, reorder, quantize } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptSimplifier } = require('meshoptimizer');
(async () => {
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const f = await fixture({ query: 'textures=jpeg' }); let rows;
  try {
    rows = await f.page.evaluate(() => {
      const colors = new WeakMap();
      const pixel = (m,u,v) => {
        const c = m.color.clone();
        if (!m.map?.image) return c;
        let data = colors.get(m.map);
        if (!data) {
          const canvas = document.createElement('canvas'); canvas.width=canvas.height=64;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(m.map.image,0,0,64,64);
          data=ctx.getImageData(0,0,64,64).data;colors.set(m.map,data);
        }
        const x=Math.max(0,Math.min(63,Math.floor((u-Math.floor(u))*64)));
        const y=Math.max(0,Math.min(63,Math.floor((m.map.flipY ? 1-(v-Math.floor(v)) : v-Math.floor(v))*64)));
        const at=(y*64+x)*4;
        return c.multiply(new THREE.Color(data[at]/255,data[at+1]/255,data[at+2]/255).convertSRGBToLinear());
      };
      return G.GUN_IDS.map(id => {
        let root=G.Guns.tpModel(id,true); if(root.isLOD) root=root.levels[0].object; root.updateMatrixWorld(true);
        const pos=[],norm=[],color=[];
        root.traverse(o=>{
          if(!o.isMesh)return;
          const g=o.geometry, p=g.attributes.position, n=g.attributes.normal, uv=g.attributes.uv, vc=g.attributes.color;
          const nm=new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
          const groups=g.groups.length ? g.groups : [{start:0,count:g.index?g.index.count:p.count,materialIndex:0}];
          for(const group of groups){
            const m=Array.isArray(o.material)?o.material[group.materialIndex]:o.material;
            for(let j=group.start;j<group.start+group.count;j++){
              const i=g.index?g.index.getX(j):j;
              pos.push(...new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray());
              norm.push(...new THREE.Vector3().fromBufferAttribute(n,i).applyNormalMatrix(nm).toArray());
              const c=pixel(m,uv?uv.getX(i):0,uv?uv.getY(i):0);
              if(m.vertexColors&&vc)c.multiply(new THREE.Color(vc.getX(i),vc.getY(i),vc.getZ(i)));
              color.push(c.r,c.g,c.b);
            }
          }
        });
        return {id,pos,norm,color};
      });
    });
    if (f.errors.length) throw Error(f.errors.join('\n'));
  } finally { await f.close(); }
  const doc=new Document(), buffer=doc.createBuffer(), scene=doc.createScene();
  const mat=doc.createMaterial('World weapon LOD').setRoughnessFactor(.78).setMetallicFactor(.15);
  const report={version:1,distances:[12,28],weapons:[]};
  for(const row of rows){
    // Weld positions independently of hard-normal/UV seams. At these distances
    // the averaged normals/colors avoid cracks and keep the recognizable shape.
    const map=new Map(), pos=[], norm=[], color=[], counts=[], indices=[];
    for(let i=0;i<row.pos.length/3;i++){
      const p=row.pos.slice(i*3,i*3+3),key=p.map(v=>Math.round(v*1e5)).join(',');let at=map.get(key);
      if(at===undefined){at=map.size;map.set(key,at);pos.push(...p);norm.push(0,0,0);color.push(0,0,0);counts.push(0)}
      indices.push(at);counts[at]++;
      for(let k=0;k<3;k++){norm[at*3+k]+=row.norm[i*3+k];color[at*3+k]+=row.color[i*3+k]}
    }
    for(let i=0;i<counts.length;i++){
      const length=Math.hypot(...norm.slice(i*3,i*3+3))||1;
      for(let k=0;k<3;k++){norm[i*3+k]/=length;color[i*3+k]/=counts[i]}
    }
    const positions=Float32Array.from(pos), stats={id:row.id,full:indices.length/3};
    for(const [name,ratio,error] of [['mid',.23,.008],['far',.065,.025]]){
      const target=Math.max(36,Math.floor(indices.length*ratio/3)*3);
      const [idx,actualError]=MeshoptSimplifier.simplify(Uint32Array.from(indices),positions,3,target,error);
      const p=doc.createPrimitive().setMaterial(mat);
      for(const [semantic,array] of [['POSITION',positions],['NORMAL',Float32Array.from(norm)],['COLOR_0',Float32Array.from(color)]])p.setAttribute(semantic,doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(array));
      p.setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(idx));
      scene.addChild(doc.createNode(row.id+'_'+name).setMesh(doc.createMesh().addPrimitive(p)));
      stats[name]=idx.length/3;stats[name+'Error']=actualError;
    }
    report.weapons.push(stats);console.log(stats.id,stats.full,'->',stats.mid,stats.far);
  }
  await doc.transform(prune(),reorder({encoder:MeshoptEncoder}),quantize({quantizePosition:14,quantizeNormal:10,quantizeColor:8}));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
  const dir=path.resolve(__dirname,'../../assets/models/guns');
  fs.writeFileSync(path.join(dir,'world-lods.glb'),await io.writeBinary(doc));
  fs.writeFileSync(path.join(dir,'world-lods.json'),JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exit(1)});
