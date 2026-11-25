(function(){
'use strict';
const G=window.G,T=window.THREE;
// 실사 스코프와 경량 부품은 같은 단위·광축·접면을 모든 뷰모델에서 사용한다.
const A=G.Attachments={models:{},open:false,
 async load(){await Promise.all(G.AttachmentModels.ids.map(async id=>{
  try{const L=new T.GLTFLoader();if(T.MeshoptDecoder)L.setMeshoptDecoder(T.MeshoptDecoder);const m=await L.loadAsync('assets/models/attachments/'+(G.ScopeProfiles?.[id]?'v93/':'v92/')+id+'.glb?v='+(window.LZ_BUILD||'93'));this.models[id]=m.scene}
  catch(e){this.models[id]=G.AttachmentModels.build(id)}
  if(G.ScopeProfiles?.[id])G.WeaponFinish?.root(this.models[id]);
  Object.assign(this.models[id].userData,G.AttachmentModels.specs[id]);
 }));this.models.brake=this.models.compensator},
 options(def){
  const mag=def.reloadType==='mag'&&def.key!=='kr98';
  return {
   optic:[['iron','가늠쇠'],...def.scopes.map(x=>[x,G.SCOPES[x].name])],
   muzzle:[['none','기본'],...(def.key==='db2'||def.key==='r45'?[]:def.cls==='shotgun'?[['choke','초크']]:[['suppressor','소음기'],['compensator','보정기'],['flash','소염기']])],
   under:[['none','기본'],...(def.cls==='rifle'&&def.action!=='bolt'?[['grip','수직 손잡이'],['angled','앵글 손잡이'],['light','경량 손잡이'],['half','하프 손잡이']]:[])],
   magazine:[['none','기본'],...(mag?[['extended','대용량 탄창'],['quick','퀵드로우 탄창'],['extendedQuick','대용량 퀵드로우']]:[])],
   stock:[['none','기본'],...(def.cls==='rifle'?[['tactical','전술 개머리판'],['cheek','뺨 받침대']]:[])],
   side:[['none','기본'],['laser','레이저 모듈']]
  };
 },
 catalog(){
  if(this._catalog)return this._catalog;const out={};
  for(const id of G.GUN_IDS)for(const [slot,list] of Object.entries(this.options(G.WEAPONS[id])))if(slot!=='optic')for(const [value,name] of list)if(value!=='none')out['att_'+slot+'_'+value]={slot,value,name};
  return this._catalog=out;
 },
 change(a,inst,slot,val){
  const d=G.WEAPONS[inst.id];if(!this.options(d)[slot]?.some(([v])=>v===val))return false;
  const old=slot==='optic'?(inst.scope||null):(inst.attachments?.[slot]||null),next=val==='none'||val==='iron'?null:val;
  if(old===next&&(slot!=='optic'||inst.iron===(val==='iron')))return true;
  const oldItem=slot==='optic'?(old&&old!==d.baseSight?'scope_'+old:null):(old?'att_'+slot+'_'+old:null);
  const newItem=slot==='optic'?(next&&next!==d.baseSight?'scope_'+next:null):(next?'att_'+slot+'_'+next:null);
  const count=k=>k?.startsWith('scope_')?(a.scopes[k.slice(6)]||0):(a.attachmentBag[k]||0);
  const add=(k,n)=>{if(!k)return;if(k.startsWith('scope_'))a.scopes[k.slice(6)]+=n;else a.attachmentBag[k]=(a.attachmentBag[k]||0)+n};
  if(newItem&&count(newItem)<1){G.UI.toast('먼저 해당 부착물을 획득하세요');return false}
  if(slot==='magazine'){
   const proposed={...inst,attachments:{...inst.attachments,magazine:next}},excess=Math.max(0,inst.mag-this.capacity(proposed,d));
   if(!G.Game.training&&excess>0&&excess>Math.max(0,a.ammoMax(d.ammo)-a.ammo[d.ammo])){G.UI.toast('예비 탄약 공간이 부족합니다');return false}
   inst.mag-=excess;if(!G.Game.training)a.ammo[d.ammo]+=excess;
  }
  add(oldItem,1);add(newItem,-1);
  if(slot==='optic'){inst.scope=next;inst.iron=val==='iron'}else{inst.attachments=inst.attachments||{};inst.attachments[slot]=next}
  this.update(G.VM.models[inst.id],inst);return true;
 },
 capacity(inst,def){const t=inst?.attachments?.magazine;return def.mag+((t==='extended'||t==='extendedQuick')?Math.max(2,Math.ceil(def.mag*.3)):0)},
 modifiers(inst){const p=inst?.attachments||{};let v=1,h=1,hip=1,spread=1,ads=1,reload=1;
  if(p.muzzle==='compensator'){v*=.88;h*=.9}else if(p.muzzle==='flash'){v*=.95;h*=.95}else if(p.muzzle==='choke')spread*=.88;
  if(p.under==='grip')v*=.9;else if(p.under==='angled'){h*=.85;ads*=.95}else if(p.under==='light'){v*=.95;ads*=.9}else if(p.under==='half'){v*=.94;h*=.94}
  if(p.stock==='tactical'){v*=.95;h*=.93}else if(p.stock==='cheek'){ads*=.93;v*=.96}
  if(p.side==='laser')hip*=.9;
  if(p.magazine==='quick'||p.magazine==='extendedQuick')reload*=.8;
  return {v,h,hip,spread,ads,reload};
 },
 optic(inst,def){if(inst.iron)return null;return def.scopes.includes(inst.scope)?inst.scope:(def.scopes.includes(def.baseSight)?def.baseSight:null)},
 make(id,scale=1){const source=this.models[id]||G.AttachmentModels.build(id);if(!source)return null;const obj=source.clone(true);obj.scale.setScalar(scale);obj.userData.keep=true;obj.userData.lzAttachment=true;return obj},
 eyeOf(obj,fallback,k=1){return (obj?.userData?.eye?.[1]??obj?.userData?.eyePoint?.[1])?((obj.userData.eye?.[1]??obj.userData.eyePoint[1])*obj.scale.y*k):fallback},
 install(m,def,D,P){
  const rail=D.rail||{y:D.sight?.y??D.muzzle.y+.02,z:D.sight?.z??D.trigger.z-.05};const F=G.AttachmentMounts,offset=P(new T.Vector3()),toGun=new T.Matrix4().makeScale(m.s,m.s,m.s).setPosition(offset);
  m.gun.updateWorldMatrix(true,true);
  const fromWorld=toGun.clone().invert().multiply(m.gun.matrixWorld.clone().invert());
  const roots=m.gun.children.filter(o=>o!==m.flash&&o!==m.parts.rearsight&&o!==m.parts.mag&&!Object.values(m.scopes).some(s=>s.group===o));
  m.attachmentProfile=F.measure(roots,fromWorld,{rail:[D.muzzle.x,rail.y,rail.z],muzzle:D.muzzle,under:D.fore},def);m.attachmentTransform=toGun;
  const host=rail.on==='slide'&&m.parts.slide?m.parts.slide:(m.id==='db2'&&m.parts.barrel?m.parts.barrel:m.gun);
  const transform=toGun.clone();if(host!==m.gun)transform.premultiply(new T.Matrix4().makeTranslation(-host.position.x,-host.position.y,-host.position.z));
  for(const id of Object.keys(m.scopes)){
   const optic=F.optic(m.attachmentProfile,id,def);if(!optic)continue;
   m.scopes[id].group.removeFromParent();optic.root.visible=false;F.attach(host,optic.root,transform);
   const sight=optic.eye.clone().applyMatrix4(toGun);
   m.scopes[id]={group:optic.root,sight,ads:new T.Vector3(0,0,-({reddot:.34,holo:.32,x2:.24,x4:.2,x8:.17}[id])).sub(sight)};
  }
 },
 update(m,inst){if(!m?.def||!m.attachmentProfile)return;const key=JSON.stringify(inst?.attachments||{});if(m.attachmentKey===key)return;m.attachmentKey=key;
  const F=G.AttachmentMounts;F.clear(m);m.accessories?.removeFromParent();
  const a=inst?.attachments||{},built=F.accessories(m.attachmentProfile,a,m.def);m.accessories=built.root;F.attach(m.gun,built.root,m.attachmentTransform);
  m.baseSupport||={fore:m.fore.clone(),normal:m.supportN,fingers:m.supportF};
  if(built.support)G.Guns.fitSupport(m,built.support,a.under);else{m.fore.copy(m.baseSupport.fore);m.supportN=m.baseSupport.normal;m.supportF=m.baseSupport.fingers}
  G.Guns.makeKeys(m);
  for(const bone of [m.parts.mag,m.mag2])if(bone&&a.magazine){const box=m.magBox?.clone();if(box){const o=F.magazine({bone,box},a.magazine);if(o)m.attachmentExtras.push(o)}}
 },
 initUI(){const panel=document.createElement('div');panel.id='attachmentPanel';panel.hidden=true;panel.innerHTML='<div class="attach-card"><header><div><small>LAST ZONE / LOADOUT</small><h2>총기 부착물</h2></div><button data-close aria-label="닫기">✕</button></header><p class="attach-hint">주변에서 부착물을 획득하고 보유한 부품을 장착하세요. Tab 또는 Esc로 닫기</p><div id="attachPreview" aria-label="현재 총기 미리보기"></div><div id="attachBody"></div></div>';document.body.appendChild(panel);this.panel=panel;
  panel.addEventListener('click',e=>{
   const a=G.Game.player;if(e.target.closest('[data-close]'))return this.close();
   const weapon=e.target.closest('[data-weapon]');if(weapon){this.viewSlot=weapon.dataset.weapon;return this.render()}
   const take=e.target.closest('[data-take]');if(take){const it=G.Game.loot[+take.dataset.take];if(it&&!it.taken){const res=G.Game.pickup(a,it);if(res)G.UI.pickup(res)}return this.render()}
   const drop=e.target.closest('[data-drop]');if(drop){const kind=drop.dataset.drop;if(kind.startsWith('scope_')){const k=kind.slice(6);if(!(a.scopes[k]>0))return;a.scopes[k]--}else{if(!(a.attachmentBag[kind]>0))return;a.attachmentBag[kind]--}
    const pos=a.pos.clone().add(new T.Vector3(.5,.1,0));const it=G.Game.addLoot(kind,1,pos);it.mesh.visible=true;return this.render()}
   const b=e.target.closest('[data-slot]');if(!b)return;const inst=a.weapons[this.viewSlot],slot=b.dataset.slot,val=b.dataset.value;if(!inst)return;
   this.change(a,inst,slot,val);this.render();
  });
  addEventListener('keydown',e=>{if(e.repeat||G.Game?.state!=='playing'||G.Settings?.open)return;if(e.code==='Tab'&&(this.open||!G.paused)){e.preventDefault();e.stopImmediatePropagation();this.open?this.close():this.show()}else if(e.code==='Escape'&&this.open){e.preventDefault();e.stopImmediatePropagation();this.close()}},true)
 },
 show(){const p=G.Player,a=G.Game.player;if(!a?.alive||a.knocked||!['rifle','shotgun','pistol'].some(k=>a.weapons[k])){G.UI.toast('총을 보유한 상태에서 부착물을 변경할 수 있습니다');return}if(p.reload||p.throwSt||p.cycleT>=0||p.pumpT>=0){G.UI.toast('동작이 끝난 뒤 부착물을 변경하세요');return}this.viewSlot=a.weapons[a.cur]?a.cur:['rifle','shotgun','pistol'].find(k=>a.weapons[k]);this.wasLocked=G.Input.locked;this.open=true;this.panel.hidden=false;G.paused=true;G.Input.unlock();G.UI.showPause(false);this.render()},
 close(){if(!this.open)return;this.open=false;this.panel.hidden=true;if(this.wasLocked)G.resume();else G.UI.showPause(true)},
 preview(m,scope){
  const host=document.getElementById('attachPreview');
  if(!this.previewRenderer){
   const r=this.previewRenderer=new T.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(Math.min(G.screenPixelRatio(),1.5));r.setSize(660,210,false);r.outputColorSpace=T.SRGBColorSpace;
   this.previewScene=new T.Scene();this.previewScene.add(new T.HemisphereLight(0xe5efff,0x657481,2));
   const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(1,3,2);this.previewScene.add(sun);
   this.previewCam=new T.PerspectiveCamera(35,660/210,0.01,30);host.appendChild(r.domElement);
  }
  if(this.previewModel){this.previewScene.remove(this.previewModel);G.AttachmentMounts.disposeSnapshot(this.previewModel)}
  const saved=Object.entries(m.scopes).map(([id,v])=>[v.group,v.group.visible]);
  for(const [id,v] of Object.entries(m.scopes))v.group.visible=id===scope;
  const flash=m.flash?.visible;if(m.flash)m.flash.visible=false;
  const pack=G.AssetVM?.pack(m.id),M=m.id==='ar7'?G.M4Viewmodel:m.id==='g18'?G.G17Pilot:null;
  let model;
  if(M?.ready)model=M.preview(scope);
  else if(pack)model=G.AssetVM.preview(pack,m.id,scope);
  else{m.gun.updateWorldMatrix(true,true);model=G.AttachmentMounts.snapshot([m.gun],m.gun.matrixWorld.clone().invert())}
  this.previewModel=model;
  for(const [group,visible]of saved)group.visible=visible;if(m.flash)m.flash.visible=flash;
  this.previewScene.add(model);const box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
  const distance=Math.max(size.z*0.95,size.x*2.2,size.y*2.2,0.4);
  this.previewCam.position.copy(center).add(new T.Vector3(distance*.62,distance*.32,distance*.85));this.previewCam.lookAt(center);this.previewCam.updateProjectionMatrix();
  G.TextureQuality?.scan(this.previewScene,true);this.previewRenderer.render(this.previewScene,this.previewCam);
 },
 render(){
  const a=G.Game.player,inst=a.weapons[this.viewSlot];a.detachUnsupportedScope(inst);
  const d=G.WEAPONS[inst.id],parts=inst.attachments||{},scope=this.optic(inst,d),opts=this.options(d),mod=this.modifiers(inst);
  const names={optic:'조준경',muzzle:'총구',under:'하부',magazine:'탄창',stock:'개머리판',side:'측면'};
  this.update(G.VM.models[inst.id],inst);this.preview(G.VM.models[inst.id],scope);
  const pct=x=>Math.round((1-x)*100);const label=(n)=>n>0?'−'+n+'%':n<0?'+'+(-n)+'%':'기본';
  const tabs=['rifle','shotgun','pistol'].filter(k=>a.weapons[k]).map(k=>'<button data-weapon="'+k+'" class="'+(k===this.viewSlot?'selected':'')+'">'+G.esc(G.WEAPONS[a.weapons[k].id].short)+'</button>').join('');
  const bag=Object.entries(a.attachmentBag).filter(([k,n])=>n>0).map(([k,n])=>[k,this.catalog()[k]?.name,n]).concat(Object.entries(a.scopes).filter(([k,n])=>n>0).map(([k,n])=>['scope_'+k,G.SCOPES[k].name,n]));
  const near=[];G.Game.lootAround(a.pos.x,a.pos.z,3,it=>{if(!it.taken&&Math.abs(it.pos.y-a.pos.y)<2&&it.pos.distanceTo(a.pos)<2.5&&(it.kind.startsWith('att_')||it.kind.startsWith('scope_')))near.push(it)});
  const nearby='<div class="attach-inventory"><strong>주변 부착물</strong> '+(near.map(it=>'<button data-take="'+G.Game.loot.indexOf(it)+'">줍기 · '+G.esc(G.Game.LOOT_NAMES[it.kind]||it.kind)+'</button>').join('')||'<small>주변에 없음</small>')+'</div>';
  const carried='<div class="attach-inventory"><strong>가방</strong> '+(bag.map(([k,nm,n])=>'<button data-drop="'+k+'">버리기 · '+G.esc(nm||k)+' ×'+n+'</button>').join('')||'<small>보유 부착물 없음</small>')+'</div>';
  document.getElementById('attachBody').innerHTML='<div class="attach-tabs">'+tabs+'</div>'+nearby+carried+'<h3>'+G.esc(d.name)+'</h3>'+Object.entries(opts).map(([key,choices])=>{
   const selected=key==='optic'?(scope||'iron'):(parts[key]||'none');
   return '<section><strong>'+names[key]+'</strong><div>'+choices.map(([v,n])=>{const kind=key==='optic'?'scope_'+v:'att_'+key+'_'+v,free=v==='none'||v==='iron'||(key==='optic'&&v===d.baseSight),count=key==='optic'?(a.scopes[v]||0):(a.attachmentBag[kind]||0),allowed=free||count>0||v===selected;return '<button data-slot="'+key+'" data-value="'+v+'" '+(allowed?'':'disabled')+' class="'+(v===selected?'selected':'')+'">'+n+(count?' ×'+count:'')+'</button>'}).join('')+'</div></section>';
  }).join('')+'<p class="attach-stats">수직 반동 '+label(pct(mod.v))+' · 수평 반동 '+label(pct(mod.h))+' · 탄 퍼짐 '+label(pct(mod.spread))+' · 비조준 탄 퍼짐 '+label(pct(mod.hip))+'<br>조준 시간 '+label(pct(mod.ads))+' · 장전 시간 '+label(pct(mod.reload))+' · 탄창 '+this.capacity(inst,d)+'발 · 총성 '+(parts.muzzle==='suppressor'?'감소':'기본')+'</p>';
 }
};
})();
