// 출처가 고정된 칼 메시와 실제 애니메이션의 손목 곡선을 게임 좌표로 변환한다.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),T=require('three');
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS,EXTMeshoptCompression}=require('@gltf-transform/extensions');
const {dedup,weld,prune,textureCompress}=require('@gltf-transform/functions');
const {MeshoptDecoder,MeshoptEncoder}=require('meshoptimizer'),sharp=require('sharp');
const {animate}=require('../guns/import-expansion.cjs'),manifest=require('./sources.json');
const src=path.resolve(process.argv[2]||'/tmp/lz-knife-source'),out=path.resolve(__dirname,'../../assets/models/knives');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const qz=a=>new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),a);
const configs={dagger:{q:new T.Quaternion(),scale:1.15,origin:[0,0,0]},combat:{q:new T.Quaternion(),scale:1,origin:[0,-.067,0]},
 kunai:{q:qz(-Math.PI/2).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2)),scale:1.15,origin:[.065,0,0]},
 machete:{q:qz(Math.PI/2),scale:.85,origin:[0,0,0]},
 karambit:{q:new T.Quaternion().setFromRotationMatrix(new T.Matrix4().set(0,1,0,0,0,0,-1,0,-1,0,0,0,0,0,0,1)),scale:.00065,origin:[0,0,40]}};
const butterfly={
 'Left Handle':{name:'safeHandle',dir:[1,0,0],at:[.30,1.648,-.00655],target:[0,-1,0],pivot:[-.011,.065,0],scale:.065},
 'Right Handle':{name:'biteHandle',dir:[.62,.785,0],at:[.21,1.84,-.00655],target:[0,-1,0],pivot:[.011,.065,0],scale:.065},
 Blade:{name:'blade',dir:[-.81,-.586,0],at:[.35,1.82,-.00637],target:[0,1,0],pivot:[0,.065,0],scale:.075}
};
async function model(io,id){
 const source=manifest.sources[id],file=path.join(src,source.file),bytes=fs.readFileSync(file);
 if(hash(bytes)!==source.sha256)throw Error('원본 체크섬 불일치: '+id);
 const doc=await io.read(file),root=doc.getRoot(),nodes=root.listNodes().filter(n=>n.getMesh()),old=root.listNodes().slice(),scene=doc.createScene('칼');
 for(const node of nodes){
  const world=new T.Matrix4().fromArray(node.getWorldMatrix()),normalMatrix=new T.Matrix3().getNormalMatrix(world),b=butterfly[node.getName()];
  const cfg=id==='butterfly'?{q:new T.Quaternion().setFromUnitVectors(new T.Vector3(...b.dir).normalize(),new T.Vector3(...b.target)),scale:b.scale,origin:b.at}:configs[id];
  let mesh=node.getMesh();const origin=new T.Vector3(...cfg.origin);
  for(const primitive of mesh.listPrimitives()){
   const position=primitive.getAttribute('POSITION'),normal=primitive.getAttribute('NORMAL'),tangent=primitive.getAttribute('TANGENT'),p=new T.Vector3(),n=new T.Vector3(),t=new T.Vector3();
   const positions=new Float32Array(position.getCount()*3),normals=new Float32Array(position.getCount()*3);
   const tangents=tangent?new Float32Array(position.getCount()*4):null,handedness=world.determinant()<0?-1:1;
   for(let i=0;i<position.getCount();i++){
    p.fromArray(position.getElement(i,[])).applyMatrix4(world).sub(origin).applyQuaternion(cfg.q).multiplyScalar(cfg.scale);p.toArray(positions,i*3);
    n.fromArray(normal.getElement(i,[])).applyNormalMatrix(normalMatrix).applyQuaternion(cfg.q).normalize();n.toArray(normals,i*3);
    if(tangent){const v=tangent.getElement(i,[]);t.fromArray(v).transformDirection(world).applyQuaternion(cfg.q);t.addScaledVector(n,-t.dot(n)).normalize();t.toArray(tangents,i*4);tangents[i*4+3]=v[3]*handedness;}
   }
   const buffer=position.getBuffer();primitive.setAttribute('POSITION',doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(positions));
   primitive.setAttribute('NORMAL',doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(normals));
   if(tangents)primitive.setAttribute('TANGENT',doc.createAccessor().setBuffer(buffer).setType('VEC4').setArray(tangents));
   if(id==='butterfly'){
    const mat=primitive.getMaterial().clone();mat.setMetallicFactor(b.name==='blade'?.85:.55).setRoughnessFactor(b.name==='blade'?.26:.42);
    mat.setBaseColorFactor(b.name==='blade'?[.65,.73,.79,1]:[.055,.078,.095,1]);primitive.setMaterial(mat);
   }
  }
  if(id==='butterfly'&&b.name==='blade'){
   // 원본 트레이너 칼날을 게임용 양날 프로필로 교체한다. 손잡이 메시는 원본이다.
   const shape=new T.Shape();shape.moveTo(-.008,0);shape.lineTo(-.012,.025);shape.lineTo(-.012,.095);shape.lineTo(0,.132);shape.lineTo(.010,.105);shape.lineTo(.012,.027);shape.lineTo(.008,0);shape.closePath();
   const geo=new T.ExtrudeGeometry(shape,{depth:.0025,bevelEnabled:true,bevelSize:.0012,bevelThickness:.0007,bevelSegments:1,steps:1}).translate(0,0,-.00125),primitive=doc.createPrimitive().setMaterial(mesh.listPrimitives()[0].getMaterial()),buffer=root.listBuffers()[0];
   for(const [key,semantic]of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0']]){const a=geo.attributes[key];primitive.setAttribute(semantic,doc.createAccessor().setBuffer(buffer).setType(a.itemSize===2?'VEC2':'VEC3').setArray(new Float32Array(a.array)));}
   mesh=doc.createMesh('blade').addPrimitive(primitive);
  }
  const added=doc.createNode(id==='butterfly'?b.name:'body').setMesh(mesh);
  if(id==='butterfly')added.setTranslation(b.pivot);
  scene.addChild(added);
 }
 for(const s of root.listScenes())if(s!==scene)s.dispose();for(const node of old)node.dispose();root.setDefaultScene(scene);
 await doc.transform(dedup(),weld(),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:88}));
 doc.createExtension(EXTMeshoptCompression).setRequired(true);
 const bytesOut=await io.writeBinary(doc);fs.writeFileSync(path.join(out,id+'.glb'),bytesOut);
 const triangles=root.listMeshes().reduce((sum,m)=>sum+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0);
 return{id,file:id+'.glb',bytes:bytesOut.length,sha256:hash(bytesOut),triangles,source:id};
}
async function motion(io,source,clipName,range,restAt){
 const file=source==='acr'?path.resolve(__dirname,'../../assets/models/viewmodels/acr.glb'):path.join(src,'ual.glb');
 const doc=await io.read(file),nodes=doc.getRoot().listNodes(),right=nodes.find(n=>/^(Hand_R|hand_r)/.test(n.getName())),left=nodes.find(n=>/^(Hand_L|hand_l)/.test(n.getName()));
 const animation=doc.getRoot().listAnimations().find(a=>a.getName()===clipName),duration=Math.max(...animation.listSamplers().map(s=>s.getInput().getMax([])[0]));
 const [start,end]=range||[0,duration],pos=node=>new T.Vector3().setFromMatrixPosition(new T.Matrix4().fromArray(node.getWorldMatrix()));
 const quat=node=>new T.Quaternion().setFromRotationMatrix(new T.Matrix4().extractRotation(new T.Matrix4().fromArray(node.getWorldMatrix())));
 const basis=qz(0).setFromAxisAngle(new T.Vector3(0,1,0),Math.PI);
 const at=t=>{animate(doc,clipName,t);return{r:pos(right).applyQuaternion(basis),l:pos(left).applyQuaternion(basis),q:quat(right)}};
 const rest=at(restAt==='end'?end:start),qInverse=rest.q.clone().invert(),frames=Math.ceil((end-start)*60)+1,raw=[];
 for(let i=0;i<frames;i++){const v=at(start+(end-start)*i/(frames-1));raw.push([...v.r.sub(rest.r).toArray(),...v.l.sub(rest.l).toArray(),...qInverse.clone().multiply(v.q).normalize().toArray()])}
 // 3인칭 공격의 큰 상체 이동을 손목 변위로 제한하고 끝 자세를 대기로 연결한다.
 if(source==='ual')for(let i=0;i<raw.length;i++)for(let k=0;k<6;k++)raw[i][k]-=raw.at(-1)[k]*i/(raw.length-1);
 const max=[0,0,0];for(const row of raw)for(let k=0;k<3;k++)max[k]=Math.max(max[k],Math.abs(row[k]));
 const limits=source==='ual'?[.25,.16,.19]:[.12,.12,.14];
 for(const row of raw)for(let k=0;k<6;k++)row[k]*=Math.min(source==='ual'?1:.8,limits[k%3]/Math.max(max[k%3],.001));
 return{source,sourceClip:clipName,sourceRange:[start,end],duration:end-start,samples:raw.map(row=>row.map(x=>+x.toFixed(6)))};
}
(async()=>{
 await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);fs.mkdirSync(out,{recursive:true});
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}),files=[];
 for(const id of ['butterfly','dagger','combat','karambit','kunai','machete']){const r=await model(io,id);files.push(r);console.log(JSON.stringify(r))}
 const clips={draw:await motion(io,'acr','Armature|Arms_FPS_Anim_Draw',null,'end'),inspect:await motion(io,'acr','Armature|Arms_FPS_Anim_rifle_inspect'),slash:await motion(io,'ual','Sword_Attack',[0,.65])};
 fs.writeFileSync(path.join(out,'motion.json'),JSON.stringify({fps:60,clips})+'\n');
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:90,files,sources:manifest.sources},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
