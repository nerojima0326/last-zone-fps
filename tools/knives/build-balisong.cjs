// 발리송 전개 경로를 비우는 채널 손잡이와 짧은 칼날을 미터 단위로 만든다.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),T=require('three');
const {Document,NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS,EXTMeshoptCompression}=require('@gltf-transform/extensions');
const {dedup,weld,prune}=require('@gltf-transform/functions'),{MeshoptEncoder}=require('meshoptimizer');
const materials={
  handle:new T.MeshStandardMaterial({color:0x667780,metalness:.88,roughness:.29}),
  edge:new T.MeshStandardMaterial({color:0xbac6c9,metalness:.96,roughness:.20}),
  spine:new T.MeshStandardMaterial({color:0x687782,metalness:.9,roughness:.34}),
  dark:new T.MeshStandardMaterial({color:0x111b22,metalness:.65,roughness:.38}),
  brass:new T.MeshStandardMaterial({color:0xa18d5d,metalness:.83,roughness:.3})
};
function box(parent,w,h,d,x,y,z,mat){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;}
function pin(parent,x,y,r=.0048){
  const m=new T.Mesh(new T.CylinderGeometry(r,r,.020,12),materials.edge);m.rotation.x=Math.PI/2;m.position.set(x,y,0);parent.add(m);
  for(const z of [-.0101,.0101]){const screw=box(parent,r*1.1,.0008,.00015,x,y,z,materials.dark);screw.rotation.z=.45;}
}
function roundedPath(x,y,w,h,r){const s=new T.Shape();s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function handle(name,x){
  const group=new T.Group();group.name=name;group.position.set(x,.065,0);
  const shape=roundedPath(-.0077,-.125,.0154,.135,.0045);
  for(const y of [-.040,-.070,-.100]){const hole=roundedPath(-.0033,y,.0066,.019,.003);shape.holes.push(hole);}
  const geo=new T.ExtrudeGeometry(shape,{depth:.0027,bevelEnabled:true,bevelThickness:.00035,bevelSize:.00035,bevelSegments:1,steps:1,curveSegments:4});
  for(const z of [-.0085,.0058]){const m=new T.Mesh(geo,materials.handle);m.position.z=z;group.add(m);}
  box(group,.012,.005,.012,0,-.1215,0,materials.spine);pin(group,0,0);pin(group,0,-.119,.0028);
  if(name==='biteHandle')box(group,.010,.005,.0028,0,-.111,.009,materials.brass);
  return group;
}
function makeBalisong(){
  const root=new T.Group();root.name='channelBalisong';root.userData.imported=true;
  const safe=handle('safeHandle',-.011),bite=handle('biteHandle',.011),blade=new T.Group();blade.name='blade';blade.position.set(0,.065,0);
  const shape=new T.Shape();shape.moveTo(-.007,-.004);shape.lineTo(-.010,.018);shape.lineTo(-.009,.084);shape.lineTo(.001,.111);shape.lineTo(.011,.075);shape.lineTo(.010,.020);shape.lineTo(.007,-.004);shape.closePath();
  const geo=new T.ExtrudeGeometry(shape,{depth:.0016,bevelEnabled:true,bevelThickness:.00065,bevelSize:.0012,bevelSegments:1,steps:1,curveSegments:6});geo.translate(0,0,-.0008);
  const edge=new T.Mesh(geo,materials.edge);edge.name='bladeSurface';blade.add(edge);
  box(blade,.007,.055,.00035,-.002,.043,.00155,materials.spine);
  const latch=new T.Group();latch.name='knifeLatch';latch.position.set(0,-.124,0);bite.add(latch);box(latch,.004,.021,.004,0,-.009,0,materials.brass);pin(latch,0,-.017,.0034);
  root.add(safe,bite,blade);
  return root;
}

(async()=>{
 await MeshoptEncoder.ready;
 const model=makeBalisong(),doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('발리송');doc.getRoot().setDefaultScene(scene);model.updateMatrixWorld(true);
 const mats=new Map(Object.values(materials).map(m=>[m,doc.createMaterial().setBaseColorFactor([...m.color.toArray(),1]).setMetallicFactor(m.metalness).setRoughnessFactor(m.roughness)]));
 let triangles=0;
 // 부품별·재질별로 합쳐서 새 모델의 드로우콜을 제한한다. 회전축은 원래 위치에 남긴다.
 function part(obj){
  const node=doc.createNode(obj.name).setTranslation(obj.position.toArray()).setRotation(obj.quaternion.toArray()),groups=new Map(),inv=obj.matrixWorld.clone().invert();
  obj.traverse(o=>{if(!o.isMesh)return;for(let p=o.parent;p&&p!==obj;p=p.parent)if(p.name==='knifeLatch')return;
   const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(inv.clone().multiply(o.matrixWorld));const group=groups.get(o.material)||[];group.push(g);groups.set(o.material,group);
  });
  const mesh=doc.createMesh(obj.name);
  for(const [mat,geos]of groups){const prim=doc.createPrimitive().setMaterial(mats.get(mat));for(const [key,semantic]of [['position','POSITION'],['normal','NORMAL']]){const count=geos.reduce((s,g)=>s+g.attributes[key].array.length,0),values=new Float32Array(count);let at=0;for(const g of geos){values.set(g.attributes[key].array,at);at+=g.attributes[key].array.length}prim.setAttribute(semantic,doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(values));}triangles+=prim.getAttribute('POSITION').getCount()/3;mesh.addPrimitive(prim);for(const g of geos)g.dispose();}
  node.setMesh(mesh);const latch=obj.children.find(o=>o.name==='knifeLatch');if(latch)node.addChild(part(latch));return node;
 }
 for(const obj of model.children)scene.addChild(part(obj));
 await doc.transform(dedup(),weld(),prune());doc.createExtension(EXTMeshoptCompression).setRequired(true);
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder}),bytes=await io.writeBinary(doc),out=path.resolve(__dirname,'../../assets/models/knives');fs.writeFileSync(path.join(out,'butterfly.glb'),bytes);
 const file=path.join(out,'manifest.json'),manifest=JSON.parse(fs.readFileSync(file));manifest.version=105;const entry=manifest.files.find(f=>f.id==='butterfly');Object.assign(entry,{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),triangles,source:'authored-balisong-v105'});
 manifest.sources['authored-balisong-v105']={author:'LAST ZONE 자체 제작',generator:'tools/knives/build-balisong.cjs',modifications:'안전 손잡이·자유 손잡이의 채널, 두 개의 고정 핀, 래치, 접었을 때 수납되는 칼날'};fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(entry));
})().catch(e=>{console.error(e);process.exitCode=1});
