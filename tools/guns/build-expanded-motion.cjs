// 기존 에셋의 실제 손목·손가락·총몸 곡선을 추출한다. 외부 코드는 실행하지 않는다.
// NODE_PATH=<도구 의존성> node tools/guns/build-expanded-motion.cjs <v77 원본 폴더>
const fs=require('fs'),path=require('path'),crypto=require('crypto'),T=require('three');
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');
const {animate}=require('./import-expansion.cjs'),manifest=require('./expansion-sources.json');
const root=path.resolve(__dirname,'../..'),folder=process.argv[2],V=T.Vector3,Q=T.Quaternion,M=T.Matrix4;
const sources={
 m4:{file:'assets/models/viewmodels/m4.glb',gun:'^Main_j$',camera:'^FPS_Camera_j$',scale:.01,author:'BarcodeGames',license:'Fab-Standard',original:'https://www.fab.com/listings/38da8f1e-cb54-4cda-beb1-6e55642a55a9',credit:'assets/models/viewmodels/CREDITS.md'},
 ak:{file:'assets/models/viewmodels/ak74.glb',gun:'^PBody',camera:'^Head_Cam',scale:1,author:'Cransh',credit:'assets/models/viewmodels/CREDITS.md'},
 acr:{file:'assets/models/viewmodels/acr.glb',gun:'^ACRRifle',camera:'^Head_Cam',scale:1,author:'Cransh',credit:'assets/models/viewmodels/CREDITS.md'},
 shell:{file:'assets/models/viewmodels/remington.glb',gun:'^Body_',camera:'^Head_Cam',scale:1,author:'Cransh',credit:'assets/models/viewmodels/CREDITS.md'},
 bolt:{file:'assets/models/viewmodels/sniper.glb',gun:'^sniper$',scale:.01,author:'DJMaesen',credit:'assets/models/viewmodels/CREDITS.md'},
 pistol:{file:'assets/models/viewmodels/xdm.glb',gun:'^PBody',camera:'^Head_Cam',scale:1,author:'Cransh',credit:'assets/models/viewmodels/CREDITS.md'},
 pistolRaise:{file:'assets/models/viewmodels/p9mm.glb',gun:'^Weapon_922$',left:'^DEF-hand\\.L_',right:'^DEF-hand\\.R_',scale:1,author:'1Matzh',credit:'assets/models/viewmodels/CREDITS.md'},
 vector:{external:'vector',gun:'^main_j$',scale:1,author:'BarcodeGames',credit:'assets/models/guns/EXPANSION-CREDITS.md'},
 ump:{external:'ump',gun:'^smg45$',scale:.01,author:'DJMaesen',credit:'assets/models/guns/EXPANSION-CREDITS.md'},
 belt:{external:'lmg',gun:'^base$',scale:.01,author:'DJMaesen',credit:'assets/models/guns/EXPANSION-CREDITS.md'}
};
const clips={
 arEmpty:['m4','Reload_Empty'],arTactical:['m4','Reload'],raise:['m4','Draw'],
 akRaise:['ak','Rig|AK_Draw'],scarRaise:['acr','Armature|Arms_FPS_Anim_Draw'],pistolRaise:['pistolRaise','Equip'],
 akEmpty:['ak','Rig|AK_Reload_full'],akTactical:['ak','Rig|AK_Reload'],
 scar:['acr','Armature|Arms_FPS_Anim_Reload_Fast',[0,1.55]],
 shellStart:['shell','Armature|SG_FPS_Reload',[0,.63]],shellLoad:['shell','Armature|SG_FPS_Reload',[.63,1.97]],shellEnd:['shell','Armature|SG_FPS_Reload',[6,6.816666603088379]],
 bolt:['bolt','allanims',[1.5,3.75]],
 pistolEmpty:['pistol','Armature|FPS_Pistol_Reload_full'],pistolTactical:['pistol','Armature|FPS_Pistol_Reload_easy'],
 vector:['vector','Animation'],smgEmpty:['ump','allanims',[.13333333333333333,2.6666666666666665]],smgTactical:['ump','allanims',[2.8,4.3]],
 beltEmpty:['belt','allanims',[9.8,14.4]],beltTactical:['belt','allanims',[.9,5.6]]
};
const matrix=n=>new M().fromArray(n.getWorldMatrix()),position=n=>new V().setFromMatrixPosition(matrix(n));
const orientation=n=>new Q().setFromRotationMatrix(new M().extractRotation(matrix(n))).normalize();
function fingers(hand){
 // 이름이 다른 리그도 손목 아래의 다섯 가지를 따라가 실제 마디 굽힘을 측정한다.
 return hand.listChildren().filter(n=>!n.getMesh()).slice(0,5).map(n=>{const chain=[hand,n];while(chain.length<7){const c=chain.at(-1).listChildren().find(n=>!n.getMesh());if(!c)break;chain.push(c);}return chain;});
}
function curl(chains){
 const values=chains.map(chain=>{const points=chain.map(position).filter((v,i,a)=>!i||v.distanceTo(a[i-1])>1e-6);let angle=0,n=0;for(let i=1;i<points.length-1;i++){const a=points[i].clone().sub(points[i-1]),b=points[i+1].clone().sub(points[i]);if(a.lengthSq()>1e-12&&b.lengthSq()>1e-12){angle+=a.angleTo(b);n++;}}return n?angle/n:0;});
 return T.MathUtils.clamp(values.slice(1,4).reduce((a,b)=>a+b,0)/Math.max(1,values.slice(1,4).length)/1.25,0,1.2);
}
async function extract(io,id,spec){
 const [source,name,range]=spec,c=sources[source],file=c.external?path.join(folder,manifest.sources[c.external].file):path.join(root,c.file),bytes=fs.readFileSync(file),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 if(c.external&&manifest.sources[c.external].sha256&&hash!==manifest.sources[c.external].sha256)throw Error('원본 해시 불일치: '+source);
 const doc=await io.read(file),nodes=doc.getRoot().listNodes(),anim=doc.getRoot().listAnimations().find(a=>a.getName()===name);
 if(!anim)throw Error('원본 클립 없음: '+name);
 const find=re=>nodes.find(n=>new RegExp(re).test(n.getName())),gun=find(c.gun),left=find(c.left||'^(LeftHand1?$|Hand_L_|L_wrist_)'),right=find(c.right||'^(RightHand1?$|Hand_R_|R_wrist_)'),camera=c.camera&&find(c.camera);
 if(!gun||!left||!right)throw Error('원본 총·손 뼈 없음: '+source);
 const start=range?.[0]??Math.min(...anim.listSamplers().map(s=>s.getInput().getMin([])[0])),end=range?.[1]??Math.max(...anim.listSamplers().map(s=>s.getInput().getMax([])[0]));
 animate(doc,name,start);const q0=orientation(gun),origin=position(gun),view=camera?orientation(camera).invert():new Q().setFromAxisAngle(new V(0,1,0),Math.PI),basis=view.clone().multiply(q0),chains=[fingers(left),fingers(right)];
 const hand0=[left,right].map(n=>basis.clone().multiply(q0.clone().invert()).multiply(orientation(n))),samples=[],count=Math.ceil((end-start)*60)+1;
 for(let i=0;i<count;i++){
  animate(doc,name,start+(end-start)*i/(count-1));const at=position(gun),turn=orientation(gun),inv=turn.clone().invert(),row=[];
  for(const n of [left,right])row.push(...position(n).sub(at).applyQuaternion(inv).applyQuaternion(basis).multiplyScalar(c.scale).toArray());
  row.push(...at.clone().sub(origin).applyQuaternion(view).multiplyScalar(c.scale).toArray());
  row.push(...new T.Euler().setFromQuaternion(view.clone().multiply(turn).multiply(q0.clone().invert()).multiply(view.clone().invert()),'YXZ').toArray().slice(0,3));
  for(const [j,n]of [left,right].entries())row.push(...basis.clone().multiply(inv).multiply(orientation(n)).multiply(hand0[j].clone().invert()).normalize().toArray());
  row.push(...chains.map(curl));
  if(!row.every(Number.isFinite))throw Error('원본 곡선 오류: '+id);
  const rounded=row.map(x=>+x.toFixed(6)),previous=samples.at(-1);
  // q와 -q는 같은 회전이다. 연속 프레임의 부호를 맞춰 중간 보간이 0을 통과하지 않게 한다.
  if(previous)for(const offset of [12,16])if(rounded.slice(offset,offset+4).reduce((sum,v,j)=>sum+v*previous[offset+j],0)<0)for(let j=0;j<4;j++)rounded[offset+j]*=-1;
  samples.push(rounded);
 }
 return {source,sourceClip:name,sourceRange:[start,end],sha256:hash,license:c.license||'CC-BY-4.0',duration:end-start,samples};
}
(async()=>{
 if(!folder)throw Error('v77 원본 폴더를 지정하세요');await MeshoptDecoder.ready;
 for(const s of Object.values(sources))s.license||='CC-BY-4.0';
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}),data={version:1,fps:60,license:'per-source',sources,clips:{}};
 for(const[id,spec]of Object.entries(clips)){data.clips[id]=await extract(io,id,spec);console.log(id,data.clips[id].samples.length+'프레임',data.clips[id].duration.toFixed(3)+'초');}
 const out=path.join(root,'assets/animations/reloads/expanded-motion.json');fs.writeFileSync(out,JSON.stringify(data)+'\n');console.log('생성',out,fs.statSync(out).size+'바이트');
})().catch(e=>{console.error(e);process.exitCode=1});
