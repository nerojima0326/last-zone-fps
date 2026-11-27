// Bundled BarcodeGames M4 pack, with optional browser-local replacement.
(function () {
'use strict';
const HIP_OFF=new window.THREE.Vector3();
const G=window.G,T=window.THREE,V=T.Vector3;
const clamp=T.MathUtils.clamp,point=new V(),aimQ=new T.Quaternion();
const M=G.M4Viewmodel={ready:false,active:false,shotT:99,equipT:99,
 preload(){
  // 파싱만 먼저 끝내고, VM 후크·사용자 ZIP 복원은 기존 init 순서에서 처리한다.
  if(!this.pending){const L=new T.GLTFLoader();if(T.MeshoptDecoder)L.setMeshoptDecoder(T.MeshoptDecoder);this.pending=L.loadAsync('assets/models/viewmodels/m4.glb?v='+(window.LZ_BUILD||''))}
  return this.pending;
 },
 async init(){
  const input=document.getElementById('m4File'),status=document.getElementById('m4Status'),reset=document.getElementById('m4Reset');
  const update=G.VM.update,fire=G.VM.fireKick,muzzle=G.VM.muzzleWorld,set=G.VM.set;
  G.VM.update=function(dt,s){update.call(this,dt,s);M.update(dt,s,this)};
  G.VM.set=function(id){set.call(this,id);if(M.pivot&&id!=='ar7'){M.pivot.visible=false;M.active=false}};
  G.VM.fireKick=function(a,suppressed){fire.call(this,a,suppressed);if(M.ready&&this.cur==='ar7'){M.shotT=0;M.equipT=99}};
  G.VM.muzzleWorld=function(cam,out){
   if(!M.ready||this.cur!=='ar7')return muzzle.call(this,cam,out);
   M.pivot.updateMatrixWorld(true);out.copy(M.muzzleLocal);M.main.localToWorld(out);
   const k=Math.tan(T.MathUtils.degToRad(cam.fov/2))/Math.tan(T.MathUtils.degToRad(G.vmCamera.fov/2));out.x*=k;out.y*=k;
   return out.applyMatrix4(cam.matrixWorld);
  };
  const duration=G.Guns.reloadDuration,events=G.Guns.reloadEvents;
  G.Guns.reloadDuration=function(id,empty){return id==='ar7'&&M.ready?M.reloadDuration(empty):duration.call(this,id,empty)};
  G.Guns.reloadEvents=function(id,empty,phase,port){return id==='ar7'&&M.ready?M.reloadEvents(empty):events.call(this,id,empty,phase,port)};
  const importFile=async(bytes,save,bundled=false)=>{
   input.disabled=true;status.textContent='M4 모델과 텍스처 불러오는 중…';
   try{
    const {unzipSync}=await import('three/addons/libs/fflate.module.js');await M.loadZip(bytes,unzipSync);
    reset.hidden=false;status.textContent='AR-7에 M4 적용됨';
    if(save){try{await M.cache('put',bytes);status.textContent+=' · 다음 접속 자동 적용'}catch(e){status.textContent+=' · 기기 저장 불가'}}
    else status.textContent+=bundled?' · 자동 적용됨':' · 저장된 파일 복원됨';
   }catch(e){status.textContent='불러오기 실패: '+e.message;console.error('[M4]',e)}
   finally{input.disabled=false;input.value=''}
  };
  input.addEventListener('change',async()=>{const f=input.files?.[0];if(f)await importFile(await f.arrayBuffer(),true)});
  reset.addEventListener('click',async()=>{M.unload();reset.hidden=true;status.textContent='기본 AR-7 모델 사용 중';try{await M.cache('delete')}catch(e){status.textContent+=' · 저장 파일 삭제 실패'}});
  input.disabled=true;status.textContent='M4 모델 자동 적용 중…';
  try{
   // v61 기본 모델은 미리 변환한 GLB (12 MB ZIP+FBX → 1.3 MB, WebP·meshopt). 직접 고른 ZIP 은 아래 importFile 로 그대로
   const g=await this.preload();
   const model=g.scene;model.animations=g.animations;model.traverse(o=>{if(o.isMesh)o.frustumCulled=false});
   this.install(model);reset.hidden=false;status.textContent='AR-7에 M4 적용됨 · 자동 적용됨';
  }catch(e){status.textContent='M4 자동 적용 실패 · 기본 모델 사용 중';console.warn('[M4]',e)}
  finally{input.disabled=false}
  // A previously chosen custom ZIP remains an override; bundled files need no device storage.
  try{const bytes=await this.cache('get');if(bytes)await importFile(bytes,false)}catch(e){/* Private browsing can disable IndexedDB. Bundled models still work. */}
 },
 cache(method,value){
  return new Promise((resolve,reject)=>{
   const req=indexedDB.open('last-zone-viewmodels',1);req.onupgradeneeded=()=>req.result.createObjectStore('files');req.onerror=()=>reject(req.error);
   req.onsuccess=()=>{
    const db=req.result,tx=db.transaction('files',method==='get'?'readonly':'readwrite'),store=tx.objectStore('files');
    const op=method==='get'?store.get('ar7-m4'):method==='put'?store.put(value,'ar7-m4'):store.delete('ar7-m4');
    let result;op.onsuccess=()=>{result=op.result};tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error)};
   };
  });
 },
 async loadZip(bytes,unzipSync){
  if(bytes.byteLength>60*1024*1024)throw Error('ZIP 파일이 너무 큽니다');
  let size=0;
  const files=unzipSync(new Uint8Array(bytes),{filter(f){
   if(!/\.(fbx|png|jpg)$/i.test(f.name))return false;size+=f.originalSize;
   if(size>100*1024*1024)throw Error('압축을 푼 파일이 너무 큽니다');return true;
  }});
  const entries=new Map();for(const [name,data]of Object.entries(files))entries.set(name.split(/[\\/]/).pop().toLowerCase(),data);
  for(const f of ['m4.fbx','hand_d.jpg','glove_d.png','m4_d.png','bullet5.56x45mm_d.png'])if(!entries.has(f))throw Error('M4 원본 ZIP에 '+f+' 파일이 필요합니다');
  const urls=new Map();
  try{
   for(const [name,data]of entries)if(/\.(png|jpg)$/.test(name))urls.set(name,URL.createObjectURL(new Blob([data],{type:name.endsWith('.jpg')?'image/jpeg':'image/png'})));
   const aliases={'m4_d.tga':'m4_d.png','bullet5.56x45mm_d.tga':'bullet5.56x45mm_d.png','t_body_normal.png':'hand_n.png','t_glove_normal.png':'glove_n.png'};
   const manager=new T.LoadingManager();manager.addHandler(/\.tga$/i,new T.TextureLoader(manager));
   manager.setURLModifier(url=>{
    const base=url.split(/[\\/]/).pop().toLowerCase(),key=aliases[base]||base;
    if(!urls.has(key))throw Error('텍스처를 찾을 수 없습니다: '+key);return urls.get(key);
   });
   let failed=false;const loaded=new Promise((resolve,reject)=>{manager.onLoad=()=>resolve();manager.onError=()=>{failed=true;reject(Error('M4 텍스처를 읽을 수 없습니다'))}});
   const src=entries.get('m4.fbx'),model=new T.FBXLoader(manager).parse(src.buffer.slice(src.byteOffset,src.byteOffset+src.byteLength),'');
   const normals={};for(const [mat,file]of [['Hand_D','hand_n.png'],['Glove_D','glove_n.png'],['M4_D','m4_n.png'],['Bullet5_56x45mm_D','bullet5.56x45mm_n.png']])if(urls.has(file))normals[mat]=new T.TextureLoader(manager).load(file);
   await loaded;if(failed)throw Error('M4 텍스처를 읽을 수 없습니다');
   const materials=new Map(),oldMaterials=new Set();
   model.traverse(o=>{if(!o.isMesh)return;
    const convert=old=>{
     oldMaterials.add(old);if(materials.has(old.name))return materials.get(old.name);
     if(old.map)old.map.colorSpace=T.SRGBColorSpace;
     const metal=old.name==='M4_D'||old.name==='Bullet5_56x45mm_D';
     const mat=new T.MeshStandardMaterial({name:old.name,map:old.map,normalMap:normals[old.name]||null,normalScale:new T.Vector2(.65,.65),color:0xffffff,metalness:metal?.38:0,roughness:metal?.5:.82});
     materials.set(old.name,mat);return mat;
    };
    o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);o.frustumCulled=false;
   });
   for(const mat of oldMaterials)mat.dispose();
   try{this.install(model)}catch(e){this.dispose(model);throw e}
  }finally{for(const url of urls.values())URL.revokeObjectURL(url)}
 },
 install(model){
  // v60 다른 1인칭 팩과 같은 장갑·소매 색
  if(G.AssetVM?.tintArms)G.AssetVM.tintArms(model).catch(e=>console.warn('[M4] 팔 색',e));
  const clips=Object.fromEntries(model.animations.map(c=>[c.name,c]));
  for(const n of ['Idle','Fire','Reload','Reload_Empty','Draw'])if(!clips[n])throw Error(n+' 애니메이션이 없습니다');
  const eye=model.getObjectByName('FPS_Camera_j'),main=model.getObjectByName('Main_j'),body=model.getObjectByName('Main');
  if(!eye||!main||!body||!model.getObjectByName('M4_Root'))throw Error('M4 뼈대가 올바르지 않습니다');
  model.updateMatrixWorld(true);const origin=eye.getWorldPosition(new V()),pivot=new T.Group(),frame=new T.Group();frame.rotation.y=Math.PI;
  model.scale.setScalar(.01);model.position.copy(origin).multiplyScalar(-.01);frame.add(model);pivot.add(frame);pivot.visible=false;
  const mixer=new T.AnimationMixer(model),actions={};
  for(const [n,c]of Object.entries(clips)){
   const start=Math.min(...c.tracks.map(t=>t.times[0])),end=c.duration;
   if(!Number.isFinite(start)||end<=start)throw Error('M4 애니메이션 시간이 올바르지 않습니다');
   const action=mixer.clipAction(c);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;actions[n]={action,start,end,duration:end-start};
  }
  actions.Idle.action.play();mixer.setTime(actions.Idle.start);pivot.updateMatrixWorld(true);
  const spare=model.getObjectByName('Mag2');if(spare)spare.visible=false;
  // Fold the rear aperture out of the sight line when an optic occupies the rail.
  // It is part of the source's single Main mesh, so separate its upper triangles.
  const rearSight=this.splitRearSight(body,main);
  // Anchors measured from the supplied M4's barrel, rear aperture and rail (cm).
  const mainRestMatrix=new T.Matrix4().copy(pivot.matrixWorld).invert().multiply(main.matrixWorld);
  const muzzleLocal=new V(.344,1.8,51.5),ironLocal=new V(.34094,8.63109,-6.3),ironOffset=new V();
  const rear=ironLocal.clone().applyMatrix4(mainRestMatrix),front=new V(.33915,8.628555,34.35).applyMatrix4(mainRestMatrix);
  const back=rear.clone().sub(front).normalize(),up=new V(0,1,0).transformDirection(mainRestMatrix);
  up.addScaledVector(back,-up.dot(back)).normalize();
  const ironQ=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new V().crossVectors(up,back).normalize(),up,back).transpose());
  point.copy(rear).applyQuaternion(ironQ);ironOffset.set(-point.x,-point.y,-.22-point.z);
  G.WeaponFinish?.root(model);
  const flash=G.VM.models.ar7.flash.clone();flash.name='M4Flash';flash.visible=false;pivot.add(flash);
  this.unload();G.VM.root.add(pivot);
  Object.assign(this,{ready:true,active:false,model,pivot,frame,main,mainRestMatrix,body,rearSight,mixer,actions,spare,flash,muzzleLocal,ironLocal,ironQ,ironOffset,aimOffset:ironOffset.clone(),scope:null,mount:null,mountKey:null,name:'Idle',shotT:99,equipT:99,aim:0});
  G.HandContact?.bind(model,G.HandContact.frame(main,mainRestMatrix,ironQ.clone().invert()));
  const F=G.AttachmentMounts,N=F.nativeFrame,fromWorld=N.clone().multiply(main.matrixWorld.clone().invert()),meshes=[];
  model.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)meshes.push(o)});
  this.attachmentProfile=F.measure(meshes,fromWorld,{rail:new V(.344,5.1,-3).applyMatrix4(N),muzzle:muzzleLocal.clone().applyMatrix4(N),under:new V(.344,-3.1,23).applyMatrix4(N)},G.WEAPONS.ar7);
  this.magContacts=['Mag1_j','Mag2_j'].map(n=>G.HandContact?.magazine(model,model.getObjectByName(n),meshes)).filter(Boolean);
  for(const c of this.magContacts)c.toCanonical=fromWorld.clone().multiply(c.bone.matrixWorld);

 },
 splitRearSight(body,main){
  const source=body.geometry.index?body.geometry.toNonIndexed():body.geometry,lists=[[],[]],v=new V();
  body.updateWorldMatrix(true,false);main.updateWorldMatrix(true,false);
  const transform=new T.Matrix4().copy(main.matrixWorld).invert().multiply(body.matrixWorld);
  for(let i=0;i<source.attributes.position.count;i+=3){
   let top=-Infinity,front=-Infinity;
   for(let j=0;j<3;j++){v.fromBufferAttribute(source.attributes.position,i+j).applyMatrix4(transform);top=Math.max(top,v.y);front=Math.max(front,v.z)}
   const target=top>5.2&&front<2?lists[1]:lists[0];target.push(i,i+1,i+2);
  }
  // v107 압축 법선의 패딩·간격을 보존한다. 4바이트 법선을 3바이트씩 읽으면 삼각형이 반짝인다.
  const geometry=ids=>{const result=new T.BufferGeometry();for(const [name,a]of Object.entries(source.attributes)){const stride=a.isInterleavedBufferAttribute?a.data.stride:a.itemSize,offset=a.isInterleavedBufferAttribute?a.offset:0,out=new a.array.constructor(ids.length*a.itemSize);for(let i=0;i<ids.length;i++)for(let j=0;j<a.itemSize;j++)out[i*a.itemSize+j]=a.array[ids[i]*stride+offset+j];result.setAttribute(name,new T.BufferAttribute(out,a.itemSize,a.normalized))}result.computeBoundingSphere();return result};
  const rear=body.clone(false);rear.name='M4RearSight';rear.geometry=geometry(lists[1]);body.parent.add(rear);body.geometry=geometry(lists[0]);source.dispose();return rear;
 },
 sample(name,p){
  G.HandContact?.restore(this.model);
  const part=this.actions[name];if(this.name!==name){this.mixer.stopAllAction();part.action.reset().play();this.name=name}
  part.action.paused=false;
  this.mixer.setTime(part.start+clamp(p,0,1)*part.duration);
 },
 reloadDuration(empty){return empty?Math.max(this.actions.Reload_Empty.duration,this.actions.Reload.duration*1.1):this.actions.Reload.duration},
 reloadEvents(empty){return empty?[[.225,'magout'],[.55,'magin'],[.695,'close']]:[[.225,'magout'],[.595,'magin']]},
 update(dt,s,vm){
  if(!this.ready)return;
  const active=vm.cur==='ar7';this.pivot.visible=active&&!s.hideVM;
  if(!active){this.active=false;this.shotT=99;this.equipT=99;return}
  if(!this.active){this.equipT=0;this.aim=0}
  vm.models.ar7.root.visible=false;this.shotT+=dt;this.equipT+=dt;
  const reload=s.reload?.type==='mag',firing=!reload&&this.shotT<this.actions.Fire.duration;
  const draw=!reload&&!firing&&this.equipT<this.actions.Draw.duration&&(s.ads||0)<.05;
  const name=reload?(s.reload.empty?'Reload_Empty':'Reload'):firing?'Fire':draw?'Draw':'Idle';
  this.sample(name,reload?s.reload.p:firing?this.shotT/this.actions.Fire.duration:draw?this.equipT/this.actions.Draw.duration:0);
  this.syncAttachments(s.scope);
  G.HandContact?.apply('ar7',this.model,G.HandContact.frame(this.main,this.mainRestMatrix,this.ironQ.clone().invert()),undefined,{reload:s.reload,supportPoint:this.supportPoint,supportTurn:this.supportTurn});
  if(s.ads>.05||reload)this.equipT=99;
  if(!reload&&s.empty){const bolt=this.model.getObjectByName('Bolt_j');if(bolt)bolt.position.z=-.7}
  const aim=reload?0:clamp(s.ads||0,0,1),weight=1-aim;
  this.aim=aim;this.pivot.position.copy(this.aimOffset).multiplyScalar(aim);
  // v60 지향 자세를 다른 총들처럼 화면 오른쪽 아래·조금 앞으로 (손·총이 화면 가운데를 덮지 않게)
  this.pivot.position.addScaledVector(HIP_OFF.set(.035,-.02,-.05),1-aim);
  this.pivot.position.x+=(vm.sway?.x||0)*.2*weight+Math.sin((vm.t||0)*.8)*.001*weight;
  this.pivot.position.y+=Math.sin(s.phase||0)*.006*(s.moving||0)*weight-(s.landDip||0)*.05;
  if(!draw)this.pivot.position.y-=(1-(s.raise??1))*.22;
  const sprint=(vm.sprint||0)*weight*weight*(!reload&&!draw?1:0);
  this.pivot.rotation.set((vm.sway?.y||0)*weight-sprint*.2,(vm.sway?.x||0)*weight+sprint*.5,sprint*.16);
  if(!s.scope)this.pivot.quaternion.multiply(aimQ.identity().slerp(this.ironQ,aim));
  if(firing)G.WeaponMotion?.stabilize(this.pivot,this.main,this.mainRestMatrix);
  this.pivot.updateMatrixWorld(true);this.flash.visible=vm.flashT>0;
  this.flash.position.copy(this.muzzleLocal);this.main.localToWorld(this.flash.position);this.pivot.worldToLocal(this.flash.position);
  this.flash.rotation.z=vm.models.ar7.flash.rotation.z;this.flash.scale.copy(vm.models.ar7.flash.scale);
  if(vm.flashLight&&vm.flashT>0)vm.flashLight.position.copy(this.flash.position).applyMatrix4(this.pivot.matrixWorld);
  this.active=true;
 },
 syncAttachments(scope){
  const inst=G.Game?.player?.weapons?.rifle,parts=inst?.id==='ar7'?(inst.attachments||{}):{},key=JSON.stringify([scope,parts]);
  if(key===this.mountKey)return;this.mountKey=key;this.scope=scope;
  const F=G.AttachmentMounts,def=G.WEAPONS.ar7;F.clear(this);this.mount?.removeFromParent();
  this.aimOffset.copy(this.ironOffset);if(this.rearSight)this.rearSight.visible=!scope;
  const built=F.accessories(this.attachmentProfile,parts,def),toMain=F.nativeFrame.clone().invert();
  this.mount=built.root;this.mount.name='M4Attachments';F.attach(this.main,this.mount,toMain);
  if(scope){const optic=F.optic(this.attachmentProfile,scope,def);if(optic){
   F.attach(this.main,optic.root,toMain);this.attachmentExtras.push(optic.root);this.opticRoot=optic.root;
   const eye=optic.eye.clone().applyMatrix4(toMain).applyMatrix4(this.mainRestMatrix);
   this.aimOffset.set(-eye.x,-eye.y,-({reddot:.32,holo:.30,x2:.25,x4:.22,x8:.20}[scope]||.3)-eye.z);
  }}else this.opticRoot=null;
  for(const contact of this.magContacts){const o=F.magazine(contact,parts.magazine);if(o)this.attachmentExtras.push(o)}
  this.supportPoint=built.support?.clone().applyMatrix4(toMain).applyMatrix4(this.mainRestMatrix)?.applyQuaternion(this.ironQ);
  this.supportTurn=parts.under==='angled'?[0,0,0]:parts.under?[0,0,-60]:null;
 },
 preview(scope){this.syncAttachments(scope);return G.AttachmentMounts.nativeSnapshot(this)},
 dispose(root){
  const geometries=new Set(),materials=new Set(),textures=new Set();const collect=o=>{if(o.name==='M4Attachments')return;if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v)}for(const child of o.children)collect(child)};collect(root);
  // Attachment clones share geometry/textures with the existing asset catalogue.
  if(root.name==='M4Attachments')return;
  for(const x of geometries)x.dispose();for(const x of materials)x.dispose();for(const x of textures)x.dispose();
 },
 unload(){
  G.AttachmentMounts.clear(this);if(this.pivot)this.pivot.removeFromParent();if(this.mixer)this.mixer.stopAllAction();if(this.model)this.dispose(this.model);
  if(this.ready&&G.VM.cur==='ar7')G.VM.models.ar7.root.visible=true;
  Object.assign(this,{ready:false,active:false,pivot:null,model:null,mixer:null,actions:null,mount:null,mountKey:null,name:null});
 }
};
})();
