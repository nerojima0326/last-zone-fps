// Optional G-18 reload test. FBX bytes are selected locally and never uploaded.
(function () {
'use strict';
const G=window.G,T=window.THREE;
const pilot=G.G17Pilot={ready:false,error:null,active:false,name:null,pivot:null,mixer:null,actions:null,
 init(){
  const input=document.getElementById('g17File'),status=document.getElementById('g17Status'),reset=document.getElementById('g17Reset');
  const update=G.VM.update;
  G.VM.update=function(dt,s){
   update.call(this,dt,s);
   if(!pilot.ready)return;
   const original=this.models.g18,active=this.cur==='g18'&&s.reload?.type==='mag';
   pilot.pivot.visible=!!active&&!s.hideVM;
   if(!active){if(pilot.active&&this.cur==='g18')original.root.visible=true;pilot.active=false;return}
   original.root.visible=false;
   const name=s.reload.empty?'ReloadEmpty':'Reload',part=pilot.actions[name];
   if(pilot.name!==name||!pilot.active){pilot.mixer.stopAllAction();part.action.reset().play();pilot.name=name}
   pilot.mixer.setTime(part.start+Math.max(0,Math.min(1,s.reload.p))*(part.end-part.start));pilot.active=true;
  };
  input.addEventListener('change',async()=>{
   const file=input.files?.[0];if(!file)return;status.textContent='불러오는 중…';input.disabled=true;
   try{const {TGALoader}=await import('three/addons/loaders/TGALoader.js');await pilot.load(await file.arrayBuffer(),TGALoader);status.textContent='G-18 시험 모션 준비됨';reset.hidden=false}
   catch(e){status.textContent='불러오기 실패: '+e.message;console.error('[G18 reload]',e)}finally{input.disabled=false;input.value=''}
  });
  reset.addEventListener('click',()=>{pilot.unload();status.textContent='기본 장전 모션 사용 중';reset.hidden=true});
 },
 async load(bytes,TGALoader){
  const manager=new T.LoadingManager();if(TGALoader)manager.addHandler(/\.tga$/i,new TGALoader(manager));
  const model=new T.FBXLoader(manager).parse(bytes,'');
  const clips=Object.fromEntries(model.animations.map(c=>[c.name,c]));
  if(!clips.Reload||!clips.ReloadEmpty)throw Error('일반·빈 탄창 장전 클립이 필요합니다');
  model.updateMatrixWorld(true);const eye=model.getObjectByName('FPS_Camera_j');if(!eye)throw Error('기준 카메라가 없습니다');
  const origin=eye.getWorldPosition(new T.Vector3()),pivot=new T.Group();pivot.rotation.y=Math.PI;
  model.scale.setScalar(.01);model.position.copy(origin).multiplyScalar(-.01);pivot.add(model);pivot.visible=false;
  const mixer=new T.AnimationMixer(model),actions={};
  for(const name of ['Reload','ReloadEmpty']){
   const clip=clips[name],start=Math.min(...clip.tracks.map(t=>t.times[0])),end=clip.duration;
   if(!Number.isFinite(start)||end<=start)throw Error('장전 클립이 올바르지 않습니다');
   const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;actions[name]={action,start,end};
  }
  this.unload();G.VM.root.add(pivot);Object.assign(this,{ready:true,error:null,model,pivot,mixer,actions,active:false,name:null});
 },
 unload(){
  if(this.pivot)this.pivot.removeFromParent();if(this.mixer)this.mixer.stopAllAction();
  if(this.active&&G.VM.cur==='g18')G.VM.models.g18.root.visible=true;
  Object.assign(this,{ready:false,active:false,name:null,pivot:null,mixer:null,model:null,actions:null});
 }
};
})();
