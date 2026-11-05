(function(){
'use strict';
const G=window.G,T=window.THREE;
const files={micro:'micro-dot',reddot:'red-dot',holo:'holo',x2:'magnifier',x4:'weathered-scope',x8:'weathered-scope',suppressor:'suppressor',grip:'vertical-grip',laser:'laser'};
const A=G.Attachments={models:{},open:false,
 async load(){if(!T.GLTFLoader)return;await Promise.all(Object.entries(files).map(async([id,file])=>{try{const m=await new T.GLTFLoader().loadAsync('assets/models/attachments/'+file+'.glb?v=21');this.models[id]=m.scene}catch(e){console.info('Attachment unavailable',id)}}))},
 options(def){
  const mag=def.reloadType==='mag'&&def.key!=='kr98';
  return {
   optic:[['iron','가늠쇠'],...def.scopes.map(x=>[x,G.SCOPES[x].name])],
   muzzle:[['none','기본'],...(def.key==='db2'||def.key==='r45'?[]:def.cls==='shotgun'?[['choke','초크']]:[['suppressor','소음기'],['compensator','보정기'],['flash','소염기']])],
   under:[['none','기본'],...(def.cls==='rifle'&&def.key!=='kr98'?[['grip','수직 손잡이'],['angled','앵글 손잡이'],['light','경량 손잡이'],['half','하프 손잡이']]:[])],
   magazine:[['none','기본'],...(mag?[['extended','대용량 탄창'],['quick','퀵드로우 탄창'],['extendedQuick','대용량 퀵드로우']]:[])],
   stock:[['none','기본'],...(def.cls==='rifle'?[['tactical','전술 개머리판'],['cheek','뺨 받침대']]:[])],
   side:[['none','기본'],['laser','레이저 모듈']]
  };
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
 optic(inst,def){return inst.iron?null:(inst.scope||def.baseSight||null)},
 make(id,scale){const source=this.models[id];if(!source)return null;const obj=source.clone(true);obj.scale.setScalar(scale);return obj},
 install(m,def,D,P){
  if(!D.rail)return;
  const base=P(new T.Vector3(0,D.rail.y,D.rail.z));const host=D.rail.on==='slide'&&m.parts.slide?m.parts.slide:(m.id==='db2'&&m.parts.barrel?m.parts.barrel:m.gun);
  for(const id of Object.keys(m.scopes)){
   const old=m.scopes[id],asset=this.make(id==='reddot'&&m.cls==='pistol'?'micro':id,m.s);if(!asset)continue;
   const g=new T.Group();g.position.copy(base);if(host!==m.gun)g.position.sub(host.position);
   const box=new T.Box3().setFromObject(asset);asset.position.y-=box.min.y;g.add(asset);
   let eye=id==='reddot'?.032:id==='holo'?.044:id==='x2'?.050:.0264;
   // Derive the optical centre from this asset's glass, including pistol micro sights.
   if(id==='reddot'||id==='holo'||id==='x2'){
    asset.updateMatrixWorld(true);const glass=new T.Box3();
    asset.traverse(x=>{if(x.isMesh&&/glass/i.test(x.material?.name||''))glass.union(new T.Box3().setFromObject(x))});
    if(!glass.isEmpty())eye=glass.getCenter(new T.Vector3()).y/m.s;
   }
   if(id==='x4'||id==='x8'){asset.rotation.y=Math.PI;asset.scale.multiplyScalar(id==='x8'?1.35:1.05);asset.position.y=-box.min.y*(id==='x8'?1.35:1.05)}
   if(id==='reddot'||id==='holo'){
    asset.traverse(x=>{if(x.isMesh&&/glass|blue/i.test(x.material?.name||'')){x.material=x.material.clone();x.material.transparent=true;x.material.opacity=.15;x.material.depthWrite=false}});
    const dot=new T.Mesh(new T.CircleGeometry(.0009*m.s,16),new T.MeshBasicMaterial({color:0xff2415,depthTest:false}));dot.position.set(0,eye*m.s,.029*m.s);dot.renderOrder=10;g.add(dot);
   }
   old.group.removeFromParent();g.visible=false;host.add(g);const sight=base.clone().add(new T.Vector3(0,eye*m.s*(id==='x8'?1.35:id==='x4'?1.05:1),.02*m.s));
   m.scopes[id]={group:g,sight,ads:new T.Vector3(0,0,-({reddot:.34,holo:.32,x2:.24,x4:.2,x8:.17}[id])).sub(sight)};
  }
 },
 update(m,inst){if(!m?.def)return;const key=JSON.stringify(inst?.attachments||{});if(m.attachmentKey===key)return;m.attachmentKey=key;
  if(m.accessories)m.accessories.removeFromParent();m.accessories=new T.Group();m.gun.add(m.accessories);
  const a=inst?.attachments||{};if(a.muzzle==='suppressor'&&m.cls!=='shotgun'&&m.id!=='r45'){const o=this.make('suppressor',m.s);if(o){o.position.copy(m.muzzle).add(new T.Vector3(0,0,.025));m.accessories.add(o)}}
  if(['grip','angled','light','half'].includes(a.under)&&m.cls==='rifle'){const o=this.make('grip',m.s);if(o){o.position.copy(m.fore).add(new T.Vector3(.01,-.01,-.09));if(a.under==='angled')o.rotation.x=-.5;if(a.under==='light'||a.under==='half')o.scale.y*=a.under==='light'?.7:.85;m.accessories.add(o)}}
  if(['compensator','flash','choke'].includes(a.muzzle)){const g=new T.CylinderGeometry(.012*m.s,.014*m.s,.038*m.s,12),mat=new T.MeshStandardMaterial({color:0x252b2d,metalness:.75,roughness:.42}),o=new T.Mesh(g,mat);o.rotation.x=Math.PI/2;o.position.copy(m.muzzle).add(new T.Vector3(0,0,-.012*m.s));m.accessories.add(o)}
  if(['tactical','cheek'].includes(a.stock)){const g=new T.BoxGeometry(.024*m.s,.018*m.s,.08*m.s),mat=new T.MeshStandardMaterial({color:0x292e2d,roughness:.8}),o=new T.Mesh(g,mat);o.position.copy(m.grip).add(new T.Vector3(0,.055*m.s,.23*m.s));m.accessories.add(o)}
  if(a.side==='laser'){const o=this.make('laser',m.s);if(o){o.position.copy(m.fore).add(new T.Vector3(.045,.015,-.08));m.accessories.add(o)}}
 },
 initUI(){const panel=document.createElement('div');panel.id='attachmentPanel';panel.hidden=true;panel.innerHTML='<div class="attach-card"><header><div><small>LAST ZONE / LOADOUT</small><h2>총기 부착물</h2></div><button data-close aria-label="닫기">✕</button></header><p class="attach-hint">현재 총에 맞는 부품을 자유롭게 선택하세요. Tab 또는 Esc로 닫기</p><div id="attachPreview" aria-label="현재 총기 미리보기"></div><div id="attachBody"></div></div>';document.body.appendChild(panel);this.panel=panel;
  panel.addEventListener('click',e=>{if(e.target.closest('[data-close]'))return this.close();const b=e.target.closest('[data-slot]');if(!b)return;const a=G.Game.player,inst=a.weapons[a.cur],slot=b.dataset.slot,val=b.dataset.value;if(!inst)return;const def=G.WEAPONS[inst.id];if(!this.options(def)[slot]?.some(([v])=>v===val))return;
  if(slot==='magazine'){const proposed={...inst,attachments:{...inst.attachments,magazine:val==='none'?null:val}},excess=Math.max(0,inst.mag-this.capacity(proposed,def));if(excess>0&&excess>Math.max(0,G.AMMO_MAX[def.ammo]-a.ammo[def.ammo])){G.UI.toast('예비 탄약 공간이 부족합니다');return}inst.mag-=excess;a.ammo[def.ammo]+=excess}
  if(slot==='optic'){inst.scope=val==='iron'?null:val;inst.iron=val==='iron'}else{inst.attachments=inst.attachments||{};inst.attachments[slot]=val==='none'?null:val}this.update(G.VM.models[inst.id],inst);this.render()});
  addEventListener('keydown',e=>{if(e.repeat||G.Game?.state!=='playing')return;if(e.code==='Tab'){e.preventDefault();e.stopImmediatePropagation();this.open?this.close():this.show()}else if(e.code==='Escape'&&this.open){e.preventDefault();e.stopImmediatePropagation();this.close()}},true)
 },
 show(){const p=G.Player,a=G.Game.player;if(!a?.alive||a.knocked||!a.weapons[a.cur]){G.UI.toast('총을 든 상태에서 부착물을 변경할 수 있습니다');return}if(p.reload||p.throwSt||p.cycleT>=0||p.pumpT>=0){G.UI.toast('동작이 끝난 뒤 부착물을 변경하세요');return}this.wasLocked=G.Input.locked;this.open=true;this.panel.hidden=false;G.paused=true;G.Input.unlock();G.UI.showPause(false);this.render()},
 close(){if(!this.open)return;this.open=false;this.panel.hidden=true;if(this.wasLocked)G.resume();else G.UI.showPause(true)},
 preview(m,scope){
  const host=document.getElementById('attachPreview');
  if(!this.previewRenderer){
   const r=this.previewRenderer=new T.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(Math.min(devicePixelRatio,1.5));r.setSize(660,210,false);r.outputColorSpace=T.SRGBColorSpace;
   this.previewScene=new T.Scene();this.previewScene.add(new T.HemisphereLight(0xe5efff,0x657481,2));
   const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(1,3,2);this.previewScene.add(sun);
   this.previewCam=new T.PerspectiveCamera(35,660/210,0.01,30);host.appendChild(r.domElement);
  }
  if(this.previewModel)this.previewScene.remove(this.previewModel);
  const saved=Object.entries(m.scopes).map(([id,v])=>[v.group,v.group.visible]);
  for(const [id,v] of Object.entries(m.scopes))v.group.visible=id===scope;
  const flash=m.flash?.visible;if(m.flash)m.flash.visible=false;
  const model=this.previewModel=m.gun.clone(true);
  for(const [group,visible]of saved)group.visible=visible;if(m.flash)m.flash.visible=flash;
  this.previewScene.add(model);model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
  const distance=Math.max(size.z*0.95,size.x*2.2,size.y*2.2,0.4);
  this.previewCam.position.copy(center).add(new T.Vector3(distance*.62,distance*.32,distance*.85));this.previewCam.lookAt(center);this.previewCam.updateProjectionMatrix();
  this.previewRenderer.render(this.previewScene,this.previewCam);
 },
 render(){
  const a=G.Game.player,inst=a.weapons[a.cur],d=G.WEAPONS[inst.id],parts=inst.attachments||{},scope=this.optic(inst,d),opts=this.options(d),mod=this.modifiers(inst);
  const names={optic:'조준경',muzzle:'총구',under:'하부',magazine:'탄창',stock:'개머리판',side:'측면'};
  this.update(G.VM.models[inst.id],inst);this.preview(G.VM.models[inst.id],scope);
  const pct=x=>Math.round((1-x)*100);const label=(n)=>n>0?'−'+n+'%':n<0?'+'+(-n)+'%':'기본';
  document.getElementById('attachBody').innerHTML='<h3>'+G.esc(d.name)+'</h3>'+Object.entries(opts).map(([key,choices])=>{
   const selected=key==='optic'?(scope||'iron'):(parts[key]||'none');
   return '<section><strong>'+names[key]+'</strong><div>'+choices.map(([v,n])=>'<button data-slot="'+key+'" data-value="'+v+'" class="'+(v===selected?'selected':'')+'">'+n+'</button>').join('')+'</div></section>';
  }).join('')+'<p class="attach-stats">수직 반동 '+label(pct(mod.v))+' · 수평 반동 '+label(pct(mod.h))+' · 탄 퍼짐 '+label(pct(mod.spread))+' · 비조준 탄 퍼짐 '+label(pct(mod.hip))+'<br>조준 시간 '+label(pct(mod.ads))+' · 장전 시간 '+label(pct(mod.reload))+' · 탄창 '+this.capacity(inst,d)+'발 · 총성 '+(parts.muzzle==='suppressor'?'감소':'기본')+'</p>';
 }
};
})();
