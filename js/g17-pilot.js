// Bundled Glock viewmodel, with optional local file replacement.
(function () {
'use strict';
const G=window.G,T=window.THREE;
const v=new T.Vector3();
const pilot=G.G17Pilot={ready:false,active:false,name:null,pivot:null,shotT:99,
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
   const response=await fetch('assets/models/viewmodels/glock17.fbx',{signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('모델 다운로드 실패 ('+response.status+')');
   const {TGALoader}=await import('three/addons/loaders/TGALoader.js');
   await pilot.load(await response.arrayBuffer(),TGALoader);
   status.textContent='G-18에 Glock 자동 적용됨';reset.hidden=false;
  }catch(e){status.textContent='Glock 자동 적용 실패 · 기본 모델 사용 중';console.warn('[G18 Glock]',e)}
  finally{input.disabled=false}
 },
 sample(name,p){
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
  // The spare magazine lives behind the camera in the source idle; omit it then.
  if(this.spare)this.spare.visible=!!reload;
  if(this.slide&&!reload&&s.empty)this.slide.position.z=this.slideRestZ-5.1;
  this.syncAttachments(s.scope);
  const aim=T.MathUtils.clamp(s.ads||0,0,1),weight=1-aim*.8;
  this.pivot.position.copy(this.aimOffset).multiplyScalar(aim);
  this.pivot.position.x+=(vm.sway?.x||0)*.25*weight;
  this.pivot.position.y-=(1-(s.raise??1))*.28+(s.landDip||0)*.06;
  this.pivot.position.y+=Math.sin(s.phase||0)*.008*(s.moving||0)*weight;
  this.pivot.position.z+=vm.kick*.025;
  this.pivot.rotation.set((vm.sway?.y||0)*weight-(s.sprint?.5:0),(vm.sway?.x||0)*weight,vm.kickRoll||0);
  this.pivot.updateMatrixWorld(true);
  this.flash.visible=vm.flashT>0;
  this.flash.position.copy(this.muzzleLocal);this.main.localToWorld(this.flash.position);this.pivot.worldToLocal(this.flash.position);
  if(vm.flashLight&&vm.flashT>0)vm.flashLight.position.copy(this.flash.position).applyMatrix4(this.pivot.matrixWorld);
  this.active=true;
 },
 syncAttachments(scope){
  const inst=G.Game?.player?.weapons?.pistol,parts=inst?.id==='g18'?(inst.attachments||{}):{};
  const key=JSON.stringify([scope,parts]);if(this.mountKey===key)return;this.mountKey=key;
  if(this.mount)this.mount.removeFromParent();this.mount=new T.Group();this.main.add(this.mount);
  this.aimOffset.copy(this.ironOffset);
  const A=G.Attachments;if(!A)return;
  if(scope==='reddot'){
   const optic=A.make('micro',100);if(optic){
    const box=new T.Box3().setFromObject(optic);optic.position.y-=box.min.y;
    const glass=new T.Box3();optic.updateMatrixWorld(true);
    optic.traverse(x=>{if(x.isMesh&&/glass|blue/i.test(x.material?.name||'')){if(/glass/i.test(x.material.name))glass.union(new T.Box3().setFromObject(x));x.material=x.material.clone();x.material.transparent=true;x.material.opacity=.15;x.material.depthWrite=false}});
    const eye=glass.isEmpty()?3.1:glass.getCenter(new T.Vector3()).y;
    const holder=new T.Group();holder.rotation.y=Math.PI;holder.position.set(0,4.15,1);holder.add(optic);this.mount.add(holder);
    const point=new T.Object3D();point.position.set(0,eye,0);holder.add(point);
    const dot=new T.Mesh(new T.CircleGeometry(.08,16),new T.MeshBasicMaterial({color:0xff2519,depthTest:false}));dot.position.set(0,eye,2);holder.add(dot);
    holder.updateMatrix();v.copy(point.position).applyMatrix4(holder.matrix).applyMatrix4(this.mainRestMatrix);this.aimOffset.set(-v.x,-v.y,-.28-v.z);
   }
  }
  if(parts.muzzle){
   let o=parts.muzzle==='suppressor'?A.make('suppressor',100):null;
   if(!o)o=new T.Mesh(new T.CylinderGeometry(1.2,1.3,3.8,12).rotateX(Math.PI/2),new T.MeshStandardMaterial({color:0x252b2d,metalness:.75,roughness:.45}));
   o.rotation.y=Math.PI;o.position.set(0,2.5,23.5);this.mount.add(o);
  }
  if(parts.side==='laser'){const o=A.make('laser',100);if(o){o.rotation.y=Math.PI;o.position.set(-2,-1,15);this.mount.add(o)}}
 },
 preview(scope){
  this.syncAttachments(scope);const result=this.pivot.clone(true),remove=[];
  result.traverse(o=>{if(o.isSkinnedMesh||o.isCamera||o.name==='G18Flash')remove.push(o)});
  for(const o of remove)o.removeFromParent();result.visible=true;return result;
 },
 async load(bytes,TGALoader){
  const manager=new T.LoadingManager();if(TGALoader)manager.addHandler(/\.tga$/i,new TGALoader(manager));
  const model=new T.FBXLoader(manager).parse(bytes,''),clips=Object.fromEntries(model.animations.map(c=>[c.name,c]));
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
  const ironOffset=new T.Vector3(-x,-box.max.y-.001,-.28-(box.max.z-.01));
  const muzzleLocal=main.worldToLocal(new T.Vector3(x,box.max.y-.019,box.min.z-.002));
  const slide=model.getObjectByName('Slide_j'),spare=model.getObjectByName('Mag1');
  const flash=G.VM.models.g18.flash.clone();flash.name='G18Flash';flash.visible=false;pivot.add(flash);
  this.unload();G.VM.root.add(pivot);
  Object.assign(this,{ready:true,model,pivot,mixer,actions,active:false,name:'Idle',main,mainRestMatrix,slide,slideRestZ:slide?.position.z,spare,flash,muzzleLocal,ironOffset,aimOffset:ironOffset.clone(),mount:null,mountKey:null,shotT:99});
  if(spare)spare.visible=false;
 },
 unload(){
  if(this.pivot)this.pivot.removeFromParent();if(this.mixer)this.mixer.stopAllAction();
  if(this.ready&&G.VM.cur==='g18')G.VM.models.g18.root.visible=true;
  Object.assign(this,{ready:false,active:false,name:null,pivot:null,mixer:null,model:null,actions:null,mount:null,mountKey:null});
 }
};
})();
