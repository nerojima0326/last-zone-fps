// Bundled Glock viewmodel, with optional local file replacement.
(function () {
'use strict';
const HIP_OFF=new window.THREE.Vector3();
const G=window.G,T=window.THREE;
const v=new T.Vector3();
const pilot=G.G17Pilot={ready:false,active:false,name:null,pivot:null,shotT:99,
 preload(){
  // 맵 생성 중 미리 해석한 결과를 init에서도 재사용해 중복 요청을 막는다.
  if(!this.pending){const L=new T.GLTFLoader();if(T.MeshoptDecoder)L.setMeshoptDecoder(T.MeshoptDecoder);this.pending=L.loadAsync('assets/models/viewmodels/glock17.glb?v='+(window.LZ_BUILD||''))}
  return this.pending;
 },
 async init(){
  const input=document.getElementById('g17File'),status=document.getElementById('g17Status'),reset=document.getElementById('g17Reset');
  const update=G.VM.update,fire=G.VM.fireKick,muzzleWorld=G.VM.muzzleWorld;
  G.VM.update=function(dt,s){update.call(this,dt,s);pilot.update(dt,s,this)};
  G.VM.fireKick=function(amount,suppressed){fire.call(this,amount,suppressed);if(pilot.ready&&this.cur==='g18')pilot.shotT=0};
  G.VM.muzzleWorld=function(cam,out){
   if(!pilot.ready||this.cur!=='g18')return muzzleWorld.call(this,cam,out);
   pilot.pivot.updateMatrixWorld(true);out.copy(pilot.muzzleLocal);pilot.main.localToWorld(out);
   const k=Math.tan(T.MathUtils.degToRad(cam.fov/2))/Math.tan(T.MathUtils.degToRad(G.vmCamera.fov/2));
   out.x*=k;out.y*=k;return out.applyMatrix4(cam.matrixWorld);
  };
  input.addEventListener('change',async()=>{
   const file=input.files?.[0];if(!file)return;status.textContent='불러오는 중…';input.disabled=true;
   try{const {TGALoader}=await import('three/addons/loaders/TGALoader.js');await pilot.load(await file.arrayBuffer(),TGALoader);status.textContent='G-18 글록 모델 적용됨';reset.hidden=false}
   catch(e){status.textContent='불러오기 실패: '+e.message;console.error('[G18 Glock]',e)}finally{input.disabled=false;input.value=''}
  });
  reset.addEventListener('click',()=>{pilot.unload();status.textContent='기본 G-18 모델 사용 중';reset.hidden=true});
  input.disabled=true;status.textContent='Glock 모델 자동 적용 중…';
  try{
   // v61 기본 모델은 미리 변환한 GLB (22 MB FBX → 1 MB). 직접 고른 FBX 는 위 load() 로 그대로
   const g=await this.preload();
   g.scene.animations=g.animations;
   // FBX 의 Phong 재질을 glTF 로 옮기면 금속도가 기본값 1 이 된다 → 원래처럼 무광에 가깝게
   g.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;for(const m of [].concat(o.material))if(m.metalness>=.99){m.metalness=/hand|glove/i.test(m.name)?0:.35;m.roughness=/hand|glove/i.test(m.name)?.85:.55}}});
   pilot.setup(g.scene);
   status.textContent='G-18에 Glock 자동 적용됨';reset.hidden=false;
  }catch(e){status.textContent='Glock 자동 적용 실패 · 기본 모델 사용 중';console.warn('[G18 Glock]',e)}
  finally{input.disabled=false}
 },
 sample(name,p){
  G.HandContact?.restore(this.model);
  const part=this.actions[name];if(!part)return;
  // All FBX takes retain absolute source timeline offsets.
  if(this.name!==name){this.mixer.stopAllAction();part.action.reset().play();this.name=name}
   part.action.paused=false;
   this.mixer.setTime(part.start+T.MathUtils.clamp(p,0,1)*(part.end-part.start));
 },
 update(dt,s,vm){
  if(!this.ready)return;
  const original=vm.models.g18,active=vm.cur==='g18';this.pivot.visible=active&&!s.hideVM;
  if(!active){this.active=false;this.shotT=99;return}
  original.root.visible=false;
  this.shotT+=dt;
  const reload=s.reload?.type==='mag',fireDuration=this.actions.Fire.end-this.actions.Fire.start,firing=!reload&&this.shotT<fireDuration;
  this.sample(reload?(s.reload.empty?'ReloadEmpty':'Reload'):firing?'Fire':'Idle',reload?s.reload.p:firing?this.shotT/fireDuration:0);
  this.syncAttachments(s.scope);
  G.HandContact?.apply('g18',this.model,G.HandContact.frame(this.main,this.mainRestMatrix),undefined,{reload:s.reload,supportPoint:this.supportPoint,supportTurn:this.supportTurn});
  // The spare magazine lives behind the camera in the source idle; omit it then.
  if(this.spare)this.spare.visible=!!reload;
  if(this.slide&&!reload&&s.empty)this.slide.position.z=this.slideRestZ-5.1;
  const aim=T.MathUtils.clamp(s.ads||0,0,1),weight=1-aim;
  this.pivot.position.copy(this.aimOffset).multiplyScalar(aim);
  // v60 지향 자세를 다른 총들처럼 화면 오른쪽 아래·조금 앞으로 (손·총이 화면 가운데를 덮지 않게)
  this.pivot.position.addScaledVector(HIP_OFF.set(.07,-.035,-.07),1-aim);
  this.pivot.position.x+=(vm.sway?.x||0)*.25*weight;
  this.pivot.position.y-=(1-(s.raise??1))*.28+(s.landDip||0)*.06;
  this.pivot.position.y+=Math.sin(s.phase||0)*.008*(s.moving||0)*weight;
  this.pivot.rotation.set((vm.sway?.y||0)*weight-(vm.sprint||0)*weight*weight*.5,(vm.sway?.x||0)*weight,0);
  if(firing)G.WeaponMotion?.stabilize(this.pivot,this.main,this.mainRestMatrix);
  this.pivot.updateMatrixWorld(true);
  this.flash.visible=vm.flashT>0;
  this.flash.position.copy(this.muzzleLocal);this.main.localToWorld(this.flash.position);this.pivot.worldToLocal(this.flash.position);
  if(vm.flashLight&&vm.flashT>0)vm.flashLight.position.copy(this.flash.position).applyMatrix4(this.pivot.matrixWorld);
  this.active=true;
 },
 syncAttachments(scope){
  const inst=G.Game?.player?.weapons?.pistol,parts=inst?.id==='g18'?(inst.attachments||{}):{},key=JSON.stringify([scope,parts]);
  if(key===this.mountKey)return;this.mountKey=key;this.scope=scope;
  const F=G.AttachmentMounts,def=G.WEAPONS.g18;F.clear(this);this.mount?.removeFromParent();
  this.aimOffset.copy(this.ironOffset);if(this.rearSight)this.rearSight.visible=!scope;
  const built=F.accessories(this.attachmentProfile,parts,def),toMain=F.nativeFrame.clone().invert();
  this.mount=built.root;this.mount.name='G18Attachments';F.attach(this.main,this.mount,toMain);
  if(scope){const optic=F.optic(this.attachmentProfile,scope,def);if(optic){
   const toHost=toMain.clone();let host=this.main;
   if(this.slide&&this.slideRestMain){host=this.slide;toHost.premultiply(this.slideRestMain.clone().invert())}
   F.attach(host,optic.root,toHost);this.attachmentExtras.push(optic.root);this.opticRoot=optic.root;
   const eye=optic.eye.clone().applyMatrix4(toMain).applyMatrix4(this.mainRestMatrix);
   this.aimOffset.set(-eye.x,-eye.y,-({reddot:.32,holo:.30,x2:.25,x4:.22,x8:.20}[scope]||.3)-eye.z);
  }}else this.opticRoot=null;
  for(const contact of this.magContacts){const o=F.magazine(contact,parts.magazine);if(o)this.attachmentExtras.push(o)}
  this.supportPoint=built.support?.clone().applyMatrix4(toMain).applyMatrix4(this.mainRestMatrix);
  this.supportTurn=parts.under==='angled'?[0,0,0]:parts.under?[0,0,-60]:null;
 },
 preview(scope){this.syncAttachments(scope);return G.AttachmentMounts.nativeSnapshot(this)},
 async load(bytes,TGALoader){
  const manager=new T.LoadingManager();if(TGALoader)manager.addHandler(/\.tga$/i,new TGALoader(manager));
  this.setup(new T.FBXLoader(manager).parse(bytes,''));
 },
 setup(model){
  const clips=Object.fromEntries(model.animations.map(c=>[c.name,c]));
  for(const name of ['Reload','ReloadEmpty','Idle','Fire'])if(!clips[name])throw Error(name+' 클립이 필요합니다');
  model.updateMatrixWorld(true);const eye=model.getObjectByName('FPS_Camera_j'),main=model.getObjectByName('Main_j'),slideMesh=model.getObjectByName('Slide');
  if(!eye||!main||!slideMesh)throw Error('글록의 기준 뼈대가 없습니다');
  const origin=eye.getWorldPosition(new T.Vector3()),pivot=new T.Group(),frame=new T.Group();frame.rotation.y=Math.PI;
  model.scale.setScalar(.01);model.position.copy(origin).multiplyScalar(-.01);frame.add(model);pivot.add(frame);pivot.visible=false;
  const mixer=new T.AnimationMixer(model),actions={};
  for(const name of ['Reload','ReloadEmpty','Idle','Fire']){
   const clip=clips[name],start=Math.min(...clip.tracks.map(t=>t.times[0])),end=clip.duration;
   if(!Number.isFinite(start)||end<=start)throw Error('장전 클립이 올바르지 않습니다');
   const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;actions[name]={action,start,end};
  }
  actions.Idle.action.play();mixer.setTime(actions.Idle.start);pivot.updateMatrixWorld(true);
  const mainRestMatrix=new T.Matrix4().copy(pivot.matrixWorld).invert().multiply(main.matrixWorld);
  const box=new T.Box3().setFromObject(slideMesh),x=(box.min.x+box.max.x)*.5;
  const ironOffset=new T.Vector3(-x,-box.max.y,-.28-(box.max.z-.01));   // v70 가늠자·가늠쇠 윗면을 화면 정가운데(탄착점)에
  const muzzleLocal=main.worldToLocal(new T.Vector3(x,box.max.y-.019,box.min.z-.002));
  const slide=model.getObjectByName('Slide_j'),spare=model.getObjectByName('Mag1');
  G.WeaponFinish?.root(model);
  const flash=G.VM.models.g18.flash.clone();flash.name='G18Flash';flash.visible=false;pivot.add(flash);
  this.unload();G.VM.root.add(pivot);
  Object.assign(this,{ready:true,model,pivot,mixer,actions,active:false,name:'Idle',main,mainRestMatrix,slide,slideRestZ:slide?.position.z,spare,flash,muzzleLocal,ironOffset,aimOffset:ironOffset.clone(),mount:null,mountKey:null,shotT:99});
  G.HandContact?.bind(model,G.HandContact.frame(main,mainRestMatrix));
  const F=G.AttachmentMounts,N=F.nativeFrame,fromWorld=N.clone().multiply(main.matrixWorld.clone().invert()),meshes=[];
  model.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)meshes.push(o)});
  this.attachmentProfile=F.measure(meshes,fromWorld,{rail:new T.Vector3(0,4.15,1).applyMatrix4(N),muzzle:muzzleLocal.clone().applyMatrix4(N),under:new T.Vector3(0,-.5,9).applyMatrix4(N)},G.WEAPONS.g18);
  this.magContacts=['Mag1_j','Mag2_j'].map(n=>G.HandContact?.magazine(model,model.getObjectByName(n),meshes)).filter(Boolean);
  for(const c of this.magContacts)c.toCanonical=fromWorld.clone().multiply(c.bone.matrixWorld);
  this.slideRestMain=slide?main.matrixWorld.clone().invert().multiply(slide.matrixWorld):null;

  if(spare)spare.visible=false;
  // v60 다른 1인칭 팩과 같은 장갑·소매 색
  if(G.AssetVM?.tintArms)G.AssetVM.tintArms(model).catch(e=>console.warn('[G18] 팔 색',e));
 },
 unload(){
  G.AttachmentMounts.clear(this);if(this.pivot)this.pivot.removeFromParent();if(this.mixer)this.mixer.stopAllAction();
  if(this.ready&&G.VM.cur==='g18')G.VM.models.g18.root.visible=true;
  Object.assign(this,{ready:false,active:false,name:null,pivot:null,mixer:null,model:null,actions:null,mount:null,mountKey:null});
 }
};
})();
