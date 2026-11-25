// 기존 CC-BY 실사 원형을 현재 장착 좌표로 다시 변환한다. 출처는 attachments/CREDITS.md에 유지한다.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),T=require('three');
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS,EXTMeshoptCompression}=require('@gltf-transform/extensions');
const {dequantize,flatten,clearNodeTransform,transformMesh,getBounds,dedup,weld,prune,reorder,quantize}=require('@gltf-transform/functions');
const {MeshoptDecoder,MeshoptEncoder}=require('meshoptimizer');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'assets/models/attachments/v93');
const config={micro:['rmr',1,.023,0,'소형 개방형 도트'],reddot:['rd-aimpoint',1,.040,0,'밀폐형 레드닷'],holo:['holo-eotech',.84,.048,0,'홀로그램 조준경'],x2:['scope-acog',.84,.042,1,'2배율 소형 프리즘'],x4:['scope-acog',1,.046,1,'4배율 ACOG형 조준경'],x8:['scope-sniper',.82,.061,1,'8배율 장거리 조준경']};
function points(doc,filter=()=>true){const out=[];for(const n of doc.getRoot().listNodes())if(n.getMesh())for(const p of n.getMesh().listPrimitives())if(filter(p)){const a=p.getAttribute('POSITION'),v=[];for(let i=0;i<a.getCount();i++){a.getElement(i,v);out.push(v.slice())}}return out}
function box(points){const b=new T.Box3();for(const p of points)b.expandByPoint(new T.Vector3(...p));return b}
function primitive(doc,geo,material){const p=doc.createPrimitive().setMaterial(material),buffer=doc.getRoot().listBuffers()[0]||doc.createBuffer();for(const [k,s]of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0']]){const a=geo.attributes[k];if(a)p.setAttribute(s,doc.createAccessor().setBuffer(buffer).setType(a.itemSize===2?'VEC2':'VEC3').setArray(new Float32Array(a.array)))}if(geo.index)p.setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Uint32Array(geo.index.array)));return p}
function add(doc,name,geo,mat){const n=doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive(doc,geo,mat)));doc.getRoot().listScenes()[0].addChild(n);geo.dispose()}
function clearAperture(doc,eye,radiusLimit){
 let converted=0;const lens=doc.createMaterial('Glass optical lens').setBaseColorFactor([.04,.08,.075,.20]).setMetallicFactor(.15).setRoughnessFactor(.12).setAlphaMode('BLEND').setDoubleSided(true);
 for(const node of doc.getRoot().listNodes())if(node.getMesh())for(const p of node.getMesh().listPrimitives().slice()){
  if(p.getMaterial()?.getAlphaMode()==='BLEND')continue;const a=p.getAttribute('POSITION'),array=a.getArray(),indices=p.getIndices()?.getArray()||Uint32Array.from({length:a.getCount()},(_,i)=>i),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(array.slice(),3));g.setIndex(new T.BufferAttribute(indices.slice(),1));g.computeBoundingSphere();
  const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();const seeds=new Set(),maxZ=g.boundingSphere.center.z+g.boundingSphere.radius+.02;
  for(const x of [-.003,0,.003])for(const y of [-.003,0,.003]){const ray=new T.Raycaster(new T.Vector3(eye[0]+x,eye[1]+y,maxZ),new T.Vector3(0,0,-1));for(const h of ray.intersectObject(mesh,false))if(Math.abs(h.face.normal.z)>.65)seeds.add(h.faceIndex)}
  const vertices=new Map(),faces=[];for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]],v=ids.map(j=>new T.Vector3().fromArray(array,j*3)),normal=new T.Vector3().crossVectors(v[1].clone().sub(v[0]),v[2].clone().sub(v[0])).normalize(),keys=v.map(p=>[p.x,p.y,p.z].map(x=>Math.round(x/1e-5)).join(','));const f={v,normal,keys};faces.push(f);for(const key of keys){if(!vertices.has(key))vertices.set(key,[]);vertices.get(key).push(i/3)}}
  const selected=new Set();for(const index of seeds){const seed=faces[index],radius=Math.max(...seed.v.map(p=>Math.hypot(p.x-eye[0],p.y-eye[1])))+.0006;if(radius>radiusLimit)continue;const z=seed.v.reduce((s,p)=>s+p.z,0)/3,queue=[index];while(queue.length){const i=queue.pop();if(selected.has(i))continue;const f=faces[i];if(Math.abs(f.normal.z)<.65||f.v.some(p=>Math.abs(p.z-z)>.004||Math.hypot(p.x-eye[0],p.y-eye[1])>radius))continue;selected.add(i);for(const key of f.keys)for(const j of vertices.get(key))if(!selected.has(j))queue.push(j)}}
  if(selected.size){const body=[],glass=[];for(let i=0;i<indices.length;i+=3)(selected.has(i/3)?glass:body).push(indices[i],indices[i+1],indices[i+2]);const buffer=doc.getRoot().listBuffers()[0];p.setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Uint32Array(body)));const q=doc.createPrimitive().setMaterial(lens).setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Uint32Array(glass)));for(const semantic of p.listSemantics())q.setAttribute(semantic,p.getAttribute(semantic));node.getMesh().addPrimitive(q);converted+=selected.size}
  mesh.material.dispose();g.dispose();
 }
 if(!converted)lens.dispose();return converted;
}
(async()=>{await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);fs.mkdirSync(OUT,{recursive:true});const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder}),profiles={},files=[];
 for(const [id,[file,scale,target,flip,label]]of Object.entries(config)){
  const doc=await io.read(path.join(ROOT,'assets/models/attachments',file+'.glb'));await doc.transform(dequantize(),flatten());for(const n of doc.getRoot().listNodes())if(n.getMesh())clearNodeTransform(n);
  for(const m of doc.getRoot().listMaterials())if(!/glass/i.test(m.getName())&&m.getBaseColorFactor()[3]>=.99)m.setAlphaMode('OPAQUE');
  const all=points(doc),bounds=box(all),glass=points(doc,p=>/glass/i.test(p.getMaterial()?.getName()||''));let center;
  if(glass.length)center=box(glass).getCenter(new T.Vector3());else{const band=all.filter(p=>p[2]<bounds.min.z+.006&&p[1]>.025);center=box(band).getCenter(new T.Vector3())}
  const rotation=new T.Matrix4().makeRotationY(flip?Math.PI:0).scale(new T.Vector3(scale,scale,scale)),floor=box(all.filter(p=>p[1]<bounds.min.y+.003)),footCenter=floor.getCenter(new T.Vector3()).applyMatrix4(rotation),axis=center.clone().applyMatrix4(rotation);
  const lift=Math.max(.002,target-(axis.y-bounds.min.y*scale)),ty=lift-bounds.min.y*scale,transform=rotation.clone().premultiply(new T.Matrix4().makeTranslation(-axis.x,ty,-footCenter.z));
  for(const mesh of doc.getRoot().listMeshes())transformMesh(mesh,transform.toArray());
  const bodyBounds=box(points(doc)),footBounds=floor.clone().applyMatrix4(transform),upper=footBounds.getCenter(new T.Vector3()),footW=Math.max(.026,Math.min(.040,footBounds.max.x-footBounds.min.x)),footL=Math.max(.036,Math.min(.108,footBounds.max.z-footBounds.min.z)),eye=[0,axis.y+ty,bodyBounds.max.z+.001];
  if(id==='micro')eye[2]=.014;if(id==='reddot')eye[2]=Math.max(...points(doc,p=>/glass/i.test(p.getMaterial()?.getName()||'')).map(p=>p[2]))+.001;if(id==='holo')eye[2]=Math.max(...points(doc,p=>/glass/i.test(p.getMaterial()?.getName()||'')).map(p=>p[2]))+.001;
  const converted=['x2','x4','x8'].includes(id)?clearAperture(doc,eye,id==='x8'?.024:.022*scale):0;
  const mat=doc.createMaterial('Scope mount anodized').setBaseColorFactor([.018,.023,.026,1]).setMetallicFactor(.62).setRoughnessFactor(.46);
  // 바닥부터 원본 체결면까지 막힌 단일 어댑터를 만든다. 본체를 떠받치는 면이 분리되지 않는다.
  const width=Math.max(footW,Math.abs(upper.x)*2+(footBounds.max.x-footBounds.min.x)),depth=Math.max(.036,footL),h=lift+.001;
  const railW=id==='micro'?.026:.029,left=footBounds.min.x-.001,right=footBounds.max.x+.001,shape=new T.Shape();
  shape.moveTo(-railW/2,0);shape.lineTo(railW/2,0);shape.lineTo(right,h);shape.lineTo(left,h);shape.closePath();
  add(doc,'일체형_장착대',new T.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:.0004,bevelThickness:.0004,bevelSegments:1}).translate(0,0,-depth/2),mat);

  const half=railW*.225+(right-left)*.275,cx=(right+left)*.275;for(const x of [-half,half])add(doc,'장착대_볼트',new T.CylinderGeometry(.0023,.0023,.0025,12).rotateZ(Math.PI/2).translate(cx+x,h*.55,-depth*.22),mat);
  for(const material of doc.getRoot().listMaterials())if(/glass/i.test(material.getName()))material.setAlphaMode('BLEND').setDoubleSided(true).setBaseColorFactor([.04,.08,.075,.20]);
  const profile={kind:'optic',label,eye:eye.map(x=>+x.toFixed(7)),foot:[railW,depth].map(x=>+x.toFixed(7)),revision:93};profiles[id]=profile;
  const top=doc.createNode('스코프_'+id).setExtras({...profile,eye:eye[1],eyePoint:profile.eye,source:file,forward:[0,0,-1],seat:[0,0,0]});const scene=doc.getRoot().listScenes()[0];for(const n of scene.listChildren().slice()){scene.removeChild(n);top.addChild(n)}scene.addChild(top);
  await doc.transform(dedup(),weld(),prune(),reorder({encoder:MeshoptEncoder}),quantize({quantizePosition:16,quantizeNormal:12}));doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});const bytes=await io.writeBinary(doc),filename=id+'.glb';fs.writeFileSync(path.join(OUT,filename),bytes);
  const triangles=doc.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0);files.push({id,file:filename,source:file+'.glb',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),triangles,transparentFaces:converted,profile});console.log(id,bytes.length,profile,converted);
 }
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({version:93,coordinates:{unit:'m',forward:'-Z',seat:'Y=0'},files},null,2)+'\n');fs.writeFileSync(path.join(ROOT,'js/scope-profiles.js'),'// 실사 스코프의 광축·체결면. tools/attachments/build-v93.cjs에서 생성한다.\nwindow.G.ScopeProfiles='+JSON.stringify(profiles)+';\n');
})().catch(e=>{console.error(e);process.exitCode=1});
