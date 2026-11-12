// npm install sharp; node tools/build-patch-people.cjs [downloaded-source-directory]
// Public Patch files, verified before editing. No account or API key is needed.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const sharp = require('sharp');
const out = path.resolve(__dirname, '../assets/patch/people');
const ids = ['mpfb:human-0408', 'mpfb:human-0348'];
const bytesPer = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const components = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const hash = b => crypto.createHash('sha256').update(b).digest('hex');

function readGLB(b) {
  if (b.readUInt32LE(0) !== 0x46546c67) throw Error('Not a GLB');
  const n = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20+n));
  return {json, views:json.bufferViews.map(v => Buffer.from(b.subarray(28+n+(v.byteOffset||0),28+n+(v.byteOffset||0)+v.byteLength)))};
}
function accessor(g, i) {
  const a=g.json.accessors[i], v=g.json.bufferViews[a.bufferView], b=g.views[a.bufferView];
  const size=bytesPer[a.componentType], count=components[a.type], stride=v.byteStride||size*count;
  const get=(row,c=0)=>{
    const p=(a.byteOffset||0)+row*stride+c*size;
    let x=a.componentType===5126?b.readFloatLE(p):a.componentType===5125?b.readUInt32LE(p):a.componentType===5123?b.readUInt16LE(p):b.readUInt8(p);
    if(a.normalized&&a.componentType!==5126)x/=a.componentType===5123?65535:255;
    return x;
  };
  return {a,b,size,count,stride,get};
}
function addView(g,b) {const i=g.views.length;g.views.push(b);g.json.bufferViews.push({buffer:0,byteLength:b.length});return i;}
function subset(g, prim, selected) {
  const old=Array.from(new Set(selected)), remap=new Map(old.map((v,i)=>[v,i])), attributes={};
  for(const [name,idx] of Object.entries(prim.attributes)) {
    const s=accessor(g,idx), b=Buffer.alloc(old.length*s.size*s.count);
    old.forEach((v,i)=>s.b.copy(b,i*s.size*s.count,(s.a.byteOffset||0)+v*s.stride,(s.a.byteOffset||0)+v*s.stride+s.size*s.count));
    const a={...s.a,bufferView:addView(g,b),byteOffset:0,count:old.length};delete a.min;delete a.max;
    if(name==='POSITION') {
      a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];
      for(const v of old)for(let c=0;c<3;c++){a.min[c]=Math.min(a.min[c],s.get(v,c));a.max[c]=Math.max(a.max[c],s.get(v,c));}
    }
    attributes[name]=g.json.accessors.push(a)-1;
  }
  const b=Buffer.alloc(selected.length*4);selected.forEach((v,i)=>b.writeUInt32LE(remap.get(v),i*4));
  const indices=g.json.accessors.push({bufferView:addView(g,b),componentType:5125,count:selected.length,type:'SCALAR'})-1;
  return {attributes,indices,material:prim.material,mode:4};
}
function cropArms(g) {
  const j=g.json, originalNodes=j.nodes.slice(), originalMeshes=j.meshes.slice();
  j.meshes=[];
  originalNodes.forEach((node,ni)=>{
    if(node.mesh===undefined)return;
    const mesh=originalMeshes[node.mesh], skinIndex=node.skin, skin=j.skins[skinIndex];delete node.mesh;delete node.skin;
    if(!/male_generic|sweater_fisherman/.test(mesh.name))return;
    const parent=j.nodes.find(n=>n.children?.includes(ni));
    for(const side of ['l','r']) {
      const arm=new Set(skin.joints.map((n,i)=>/^(upperarm|lowerarm|hand|index_\d+|middle_\d+|ring_\d+|pinky_\d+|thumb_\d+)_/.test(j.nodes[n].name)&&j.nodes[n].name.endsWith('_'+side)?i:-1).filter(i=>i>=0));
      const primitives=[];
      for(const p of mesh.primitives) {
        const joints=accessor(g,p.attributes.JOINTS_0), weights=accessor(g,p.attributes.WEIGHTS_0), ix=accessor(g,p.indices), selected=[];
        const keep=i=>{let sum=0;for(let c=0;c<4;c++)if(arm.has(joints.get(i,c)))sum+=weights.get(i,c);return sum>.85;};
        for(let i=0;i<ix.a.count;i+=3){const tri=[ix.get(i),ix.get(i+1),ix.get(i+2)];if(tri.every(keep))selected.push(...tri);}
        if(selected.length)primitives.push(subset(g,p,selected));
      }
      if(!primitives.length)continue;
      const mi=j.meshes.push({name:'fps_'+side+'_'+mesh.name,primitives})-1;
      const added=j.nodes.push({name:'fps_'+side+'_'+mesh.name,mesh:mi,skin:skinIndex,
        extras:{armSide:side,armPart:mesh.name==='male_generic'?'skin':'sleeve'}})-1;
      if(parent)parent.children.push(added);else j.scenes[j.scene||0].nodes.push(added);
    }
  });
}
function compact(g) {
  const j=g.json;
  const trim=(key,used,remap)=>{
    const old=j[key]||[], ids=Array.from(used).sort((a,b)=>a-b), map=new Map(ids.map((v,i)=>[v,i]));
    remap(map);j[key]=ids.map(i=>old[i]);return map;
  };
  const access=new Set(j.skins.map(s=>s.inverseBindMatrices).filter(i=>i!==undefined)), mats=new Set();
  for(const m of j.meshes)for(const p of m.primitives){Object.values(p.attributes).forEach(i=>access.add(i));access.add(p.indices);mats.add(p.material);}
  trim('accessors',access,map=>{for(const m of j.meshes)for(const p of m.primitives){for(const k in p.attributes)p.attributes[k]=map.get(p.attributes[k]);p.indices=map.get(p.indices);}for(const s of j.skins)if(s.inverseBindMatrices!==undefined)s.inverseBindMatrices=map.get(s.inverseBindMatrices);});
  trim('materials',mats,map=>{for(const m of j.meshes)for(const p of m.primitives)p.material=map.get(p.material);});
  const tex=new Set(),visit=(obj,fn)=>{for(const [k,v]of Object.entries(obj||{})){if(v&&typeof v==='object'){if(k.endsWith('Texture')&&v.index!==undefined)fn(v);else visit(v,fn);}}};
  j.materials.forEach(m=>visit(m,v=>tex.add(v.index)));
  trim('textures',tex,map=>j.materials.forEach(m=>visit(m,v=>v.index=map.get(v.index))));
  const imgs=new Set(j.textures.map(t=>t.source));trim('images',imgs,map=>j.textures.forEach(t=>t.source=map.get(t.source)));
  const views=new Set([...j.accessors.map(a=>a.bufferView),...j.images.map(i=>i.bufferView)]);
  const oldViews=g.views.slice(),map=trim('bufferViews',views,map=>{j.accessors.forEach(a=>a.bufferView=map.get(a.bufferView));j.images.forEach(i=>i.bufferView=map.get(i.bufferView));});
  g.views=Array.from(map.keys()).map(i=>oldViews[i]);
}
async function resize(g) {
  for(const im of g.json.images) {
    const input=g.views[im.bufferView], meta=await sharp(input).metadata();
    const s=sharp(input).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true});
    const b=meta.hasAlpha?await s.png().toBuffer():await s.jpeg({quality:85}).toBuffer();
    im.mimeType=meta.hasAlpha?'image/png':'image/jpeg';g.views[im.bufferView]=b;g.json.bufferViews[im.bufferView].byteLength=b.length;
  }
}
function writeGLB(g,file) {
  const j=g.json, chunks=[];let offset=0;
  j.bufferViews.forEach((v,i)=>{v.buffer=0;v.byteOffset=offset;v.byteLength=g.views[i].length;chunks.push(g.views[i]);const pad=(4-v.byteLength%4)%4;if(pad)chunks.push(Buffer.alloc(pad));offset+=v.byteLength+pad;});
  j.buffers=[{byteLength:offset}];
  j.asset.extras={...j.asset.extras,lastZone:'v34: 1K textures; arms copy cropped from the CC0 original; bones and UVs preserved.'};
  let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const bin=Buffer.concat(chunks),head=Buffer.alloc(20),bh=Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+bin.length,8);head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4e4f534a,16);
  bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);
  const b=Buffer.concat([head,json,bh,bin]);fs.writeFileSync(path.join(out,file),b);
  const tris=j.meshes.reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+j.accessors[p.indices].count/3,0),0);
  return {file,sha256:hash(b),size:b.length,triangles:tris};
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const records=[];
  for(const id of ids) {
    const r=await fetch('https://patch.gg/api/v1/assets/'+encodeURIComponent(id));if(!r.ok)throw Error('Patch metadata '+r.status);const a=await r.json();
    const f=a.variants.find(v=>v.name==='web'&&v.carries.includes('rigged')).files.find(f=>f.role==='model');
    const src=process.argv[2]?fs.readFileSync(path.join(process.argv[2],f.name)):Buffer.from(await(await fetch(f.url)).arrayBuffer());
    if(hash(src)!==f.sha256)throw Error('Source SHA-256 mismatch: '+id);
    const g=readGLB(src);compact(g);await resize(g);const files=[writeGLB(g,id.endsWith('0408')?'survivor-sweater.glb':'survivor-cargo.glb')];
    if(id.endsWith('0408')){const arms=readGLB(src);cropArms(arms);compact(arms);await resize(arms);files.push(writeGLB(arms,'fps-arms.glb'));}
    records.push({id,title:a.title,source:a.source,credit:a.credit,license:a.license.spdx,original:{url:f.url,sha256:f.sha256},files});console.log(JSON.stringify(records.at(-1)));
  }
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({runtime:'patch-web@1',changes:'1K textures; separate first-person arm geometry; runtime retargeting to existing game poses.',assets:records},null,2)+'\n');
  const r=await fetch('https://patch.gg/api/v1/assets/licenses/CC0-1.0');const license=await r.json();fs.writeFileSync(path.join(out,'CC0-1.0.txt'),typeof license.text==='string'?license.text:JSON.stringify(license,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
