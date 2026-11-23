// v85 GLB에서 차체에 남은 타이어 삼각형을 회수하고 바퀴 중심을 다시 맞춘다.
// 원본 텍스처·재질·삼각형 수를 유지하며 출력 파일을 다시 입력으로 사용하지 않는다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS,EXTMeshoptCompression}=require('@gltf-transform/extensions');
const {dequantize,flatten,clearNodeTransform,getBounds,dedup,prune,join,weld,reorder,quantize}=require('@gltf-transform/functions');
const {MeshoptDecoder,MeshoptEncoder}=require('meshoptimizer');
const base='401a95292dae33004113cb06264fcebba1934177',root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||path.join(root,'assets/models/vehicles')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function frame(w,p){const x=p[0]-w.center[0],z=p[2]-w.center[2];return[w.cos*x+w.sin*z,p[1]-w.center[1],-w.sin*x+w.cos*z]}
function copyPart(doc,prim,indices,center,angle=0){
 const order=[],map=new Map();for(const i of indices)if(!map.has(i)){map.set(i,order.length);order.push(i)}
 const p=doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(4);
 for(const sem of prim.listSemantics()){
  const a=prim.getAttribute(sem),n=a.getElementSize(),data=new Float32Array(order.length*n),el=[];
  order.forEach((index,j)=>{a.getElement(index,el);for(let k=0;k<n;k++)data[j*n+k]=el[k]-(sem==='POSITION'?center[k]:0);if(sem==='POSITION'||sem==='NORMAL'||sem==='TANGENT'){const x=data[j*n],z=data[j*n+2];data[j*n]=Math.cos(angle)*x+Math.sin(angle)*z;data[j*n+2]=-Math.sin(angle)*x+Math.cos(angle)*z}});
  p.setAttribute(sem,doc.createAccessor().setType(a.getType()).setArray(data));
 }p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices.map(i=>map.get(i)))));return p;
}
(async()=>{
 await MeshoptDecoder.ready;await MeshoptEncoder.ready;fs.mkdirSync(out,{recursive:true});
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}),rows=[];
 for(const kind of['porter','e2200','izh']){
  const source=cp.execFileSync('git',['show',base+':assets/models/vehicles/'+kind+'.glb'],{cwd:root,maxBuffer:16*1024*1024}),doc=await io.readBinary(source),r=doc.getRoot(),scene=r.getDefaultScene()||r.listScenes()[0],bounds=getBounds(scene);
  const names=['frontLeft','frontRight','backLeft','backRight'],wheels=names.map(name=>{const node=r.listNodes().find(n=>n.getName()==='wheel_'+name),b=getBounds(node);return{name,node,center:b.min.map((x,i)=>(x+b.max[i])/2),r:(b.max[1]-b.min[1])/2,half:(b.max[0]-b.min[0])/2+.015}});
  const textures=r.listTextures().map(t=>sha(t.getImage())).sort();
  for(const w of wheels){w.materials=new Set();for(const p of w.node.getMesh()?.listPrimitives()||[])w.materials.add(p.getMaterial())}
  await doc.transform(dequantize(),flatten());for(const node of r.listNodes())if(node.getMesh())clearNodeTransform(node);
  const sources=[];for(const node of r.listNodes())if(node.getMesh())for(const prim of node.getMesh().listPrimitives())sources.push({name:node.getName(),prim});
  for(const w of wheels){
   const own=sources.filter(s=>s.name==='wheel_'+w.name),rubber=own.filter(s=>/tire|tier|rubber/i.test(s.prim.getMaterial()?.getName()||'')),samples=[],bins=new Map();let nx=0,nz=0,weight=0;const n=[];
   // 곡면의 기울어진 법선 평균 대신 평평한 옆면의 우세 방향을 축으로 삼는다.
   for(const s of rubber.length?rubber:own){const a=s.prim.getAttribute('NORMAL');if(!a)continue;for(let i=0;i<a.getCount();i++){a.getElement(i,n);if(Math.abs(n[0])<.85||Math.abs(n[1])>.08)continue;const sign=Math.sign(n[0]),angle=Math.atan2(n[2]*sign,Math.abs(n[0]))*180/Math.PI,key=Math.round(angle*2)/2;samples.push([Math.abs(n[0]),n[2]*sign,angle]);bins.set(key,(bins.get(key)||0)+1)}}
   const peak=[...bins].sort((a,b)=>b[1]-a[1])[0]?.[0]||0;for(const s of samples)if(Math.abs(s[2]-peak)<1){const k=s[0]**6;nx+=s[0]*k;nz+=s[1]*k;weight+=k}
   w.axisAngle=weight?Math.atan2(nz,nx):0;
   w.cos=Math.cos(w.axisAngle);w.sin=Math.sin(w.axisAngle);w.lo=Infinity;w.hi=-Infinity;
   for(const s of own){const a=s.prim.getAttribute('POSITION'),el=[];for(let i=0;i<a.getCount();i++){a.getElement(i,el);const x=frame(w,el)[0];w.lo=Math.min(w.lo,x);w.hi=Math.max(w.hi,x)}}w.lo-=.02;w.hi+=.02;
  }
  for(const w of wheels){
   const samples=[],el=[],normal=[],side=Math.sign(w.center[0]),dual=kind==='porter'&&w.name.startsWith('back');
   if(dual){if(side<0)w.hi+=.13;else w.lo-=.13}
   // 바닥 쪽 트레드의 위치·법선으로 원의 중심과 반지름을 맞춘다. 림의 평평한 옆면은 제외한다.
   for(const s of sources){const a=s.prim.getAttribute('POSITION'),norm=s.prim.getAttribute('NORMAL');if(!norm)continue;for(let i=0;i<a.getCount();i++){
    a.getElement(i,el);norm.getElement(i,normal);const p=frame(w,el),nz0=-w.sin*normal[0]+w.cos*normal[2],nr=Math.hypot(normal[1],nz0),radial=Math.hypot(p[1],p[2]);
    if(p[0]<w.lo||p[0]>w.hi||p[1]>w.r*.6||radial<w.r*.8||radial>w.r*1.2||nr<.85)continue;
    const ny=normal[1]/nr,nz=nz0/nr,cy=p[1]-ny*w.r,cz=p[2]-nz*w.r;if(Math.abs(cy)>.05||Math.abs(cz)>.10)continue;samples.push([p[1],p[2],ny,nz]);
   }}
   if(samples.length>=12){
    const mean=[0,0,0,0];for(const s of samples)for(let i=0;i<4;i++)mean[i]+=s[i]/samples.length;let num=0,den=0;
    for(const s of samples){num+=(s[2]-mean[2])*(s[0]-mean[0])+(s[3]-mean[3])*(s[1]-mean[1]);den+=(s[2]-mean[2])**2+(s[3]-mean[3])**2}
    const radius=num/den,cy=mean[0]-w.r*mean[2],cz=mean[1]-w.r*mean[3];
    if(radius>w.r*.9&&radius<w.r*1.1&&Math.abs(cy)<.06&&Math.abs(cz)<.10){w.center[0]-=w.sin*cz;w.center[1]+=cy;w.center[2]+=w.cos*cz}
   }
  }
  const buckets={body:[]};for(const w of wheels)buckets[w.name]=[];
  const counts={body:0},moved={};for(const w of wheels){counts[w.name]=0;moved[w.name]=0}
  let triangles=0;
  for(const src of sources){
   const prim=src.prim,a=prim.getAttribute('POSITION'),idx=prim.getIndices(),count=idx?idx.getCount():a.getCount(),parts={};for(const key in buckets)parts[key]=[];
   const p=[[],[],[]];
   for(let i=0;i<count;i+=3){
    const ids=[0,1,2].map(j=>idx?idx.getScalar(i+j):i+j);for(let j=0;j<3;j++)a.getElement(ids[j],p[j]);
    const center=[0,1,2].map(j=>(p[0][j]+p[1][j]+p[2][j])/3);let target=src.name.startsWith('wheel_')?src.name.slice(6):'body';
    for(const w of wheels){
     const margin=w.materials.has(prim.getMaterial())?1.04:1.02;
     const inside=(q,extra)=>{const p=frame(w,q);return p[0]>w.lo-Math.min(extra,.008)&&p[0]<w.hi+Math.min(extra,.008)&&Math.hypot(p[1],p[2])<w.r*(margin+extra)};
     if(inside(center,0)&&p.every(q=>inside(q,.03))){target=w.name;break}
    }
    parts[target].push(...ids);counts[target]++;triangles++;if(target!=='body'&&src.name==='body')moved[target]++;
   }for(const key in parts)if(parts[key].length)buckets[key].push({prim,indices:parts[key]});
  }
  const centers={},wheelBounds={};
  for(const w of wheels){
   const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],el=[];
   for(const part of buckets[w.name]){const a=part.prim.getAttribute('POSITION');for(const i of part.indices){a.getElement(i,el);const p=frame(w,el);for(let j=0;j<3;j++){min[j]=Math.min(min[j],p[j]);max[j]=Math.max(max[j],p[j])}}}
   if(!counts[w.name])throw Error(kind+' '+w.name+' 타이어 삼각형 누락');
   const axial=(min[0]+max[0])/2;centers[w.name]=[w.center[0]+w.cos*axial,w.center[1],w.center[2]+w.sin*axial];wheelBounds[w.name]={min,max,fitRadius:w.r,space:'aligned-local'};
  }
  const built={};for(const key in buckets)built[key]=buckets[key].map(b=>copyPart(doc,b.prim,b.indices,key==='body'?[0,0,0]:centers[key],key==='body'?0:wheels.find(w=>w.name===key).axisAngle));
  for(const n of r.listNodes())n.dispose();for(const m of r.listMeshes())m.dispose();
  const car=doc.createNode('car');scene.addChild(car);
  for(const key in built){
   const mesh=doc.createMesh(key);for(const p of built[key])mesh.addPrimitive(p);
   if(key==='body')car.addChild(doc.createNode('body').setMesh(mesh));
   else{
    // 압축용 위치·스케일은 자식에만 붙여 양자화가 축의 중심을 옮기지 않게 한다.
    const pivot=doc.createNode('wheel_'+key).setTranslation(centers[key]);pivot.addChild(doc.createNode(key+'_geometry').setMesh(mesh));car.addChild(pivot);
   }
  }
  await doc.transform(dedup(),prune(),join({keepNamed:true}),weld(),reorder({encoder:MeshoptEncoder}),quantize({pattern:/^(POSITION|NORMAL)$/,quantizePosition:14,quantizeNormal:10}));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const imageHashes=r.listTextures().map(t=>sha(t.getImage())).sort();if(JSON.stringify(imageHashes)!==JSON.stringify(textures))throw Error('원본 텍스처가 바뀜');
  const after=getBounds(scene);for(let i=0;i<3;i++)if(Math.abs(after.min[i]-bounds.min[i])>.004||Math.abs(after.max[i]-bounds.max[i])>.004)throw Error(kind+' 차체 외곽이 바뀜');
  let writtenTriangles=0;for(const m of r.listMeshes())for(const p of m.listPrimitives())writtenTriangles+=(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3;if(writtenTriangles!==triangles)throw Error(kind+' 삼각형 수가 바뀜');
  const binary=await io.writeBinary(doc);fs.writeFileSync(path.join(out,kind+'.glb'),binary);
  const row={kind,sourceBytes:source.length,bytes:binary.length,sourceHash:sha(source),hash:sha(binary),triangles,counts,recoveredFromBody:moved,centers,wheelBounds,axisAngles:wheels.map(w=>w.axisAngle*180/Math.PI),texturesUnchanged:true};rows.push(row);console.log('PASS 모델',JSON.stringify(row));
 }
 fs.writeFileSync(path.join(out,'wheel-repair-v86.json'),JSON.stringify({version:86,base,rows},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
