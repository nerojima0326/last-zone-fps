(function(){
'use strict';
const G=window.G,T=window.THREE;
const files={micro:'micro-dot',reddot:'red-dot',holo:'holo',x2:'magnifier',x4:'weathered-scope',x8:'weathered-scope',suppressor:'suppressor',grip:'vertical-grip',laser:'laser'};
const A=G.Attachments={models:{},open:false,
 async load(){if(!T.GLTFLoader)return;await Promise.all(Object.entries(files).map(async([id,file])=>{try{const m=await new T.GLTFLoader().loadAsync('assets/models/attachments/'+file+'.glb?v=21');this.models[id]=m.scene}catch(e){console.info('Attachment unavailable',id)}}))},
 optic(inst,def){return inst.iron?null:(inst.scope||def.baseSight||null)},
 make(id,scale){const source=this.models[id];if(!source)return null;const obj=source.clone(true);obj.scale.setScalar(scale);return obj},
 install(m,def,D,P){
  if(!D.rail)return;
  const base=P(new T.Vector3(0,D.rail.y,D.rail.z));const host=D.rail.on==='slide'&&m.parts.slide?m.parts.slide:(m.id==='db2'&&m.parts.barrel?m.parts.barrel:m.gun);
  for(const id of Object.keys(m.scopes)){
   const old=m.scopes[id],asset=this.make(id==='reddot'&&m.cls==='pistol'?'micro':id,m.s);if(!asset)continue;
   const g=new T.Group();g.position.copy(base);if(host!==m.gun)g.position.sub(host.position);
   const box=new T.Box3().setFromObject(asset);asset.position.y-=box.min.y;g.add(asset);
   const eye=id==='reddot'?.032:id==='holo'?.044:id==='x2'?.050:.0264;
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
  if(a.under==='grip'&&m.cls==='rifle'){const o=this.make('grip',m.s);if(o){o.position.copy(m.fore).add(new T.Vector3(.01,-.01,-.09));m.accessories.add(o)}}
  if(a.side==='laser'){const o=this.make('laser',m.s);if(o){o.position.copy(m.fore).add(new T.Vector3(.045,.015,-.08));m.accessories.add(o)}}
 },
 initUI(){const panel=document.createElement('div');panel.id='attachmentPanel';panel.hidden=true;panel.innerHTML='<div class="attach-card"><header><div><small>LAST ZONE / LOADOUT</small><h2>총기 부착물</h2></div><button data-close aria-label="닫기">✕</button></header><p class="attach-hint">현재 총에 맞는 부품을 자유롭게 선택하세요. 소음기: 총성 감소 · 손잡이: 반동 감소 · 레이저: 비조준 정확도 향상. Tab 또는 Esc로 닫기</p><div id="attachBody"></div></div>';document.body.appendChild(panel);this.panel=panel;
  panel.addEventListener('click',e=>{if(e.target.closest('[data-close]'))return this.close();const b=e.target.closest('[data-slot]');if(!b)return;const a=G.Game.player,inst=a.weapons[a.cur],slot=b.dataset.slot,val=b.dataset.value;if(!inst)return;if(slot==='optic'){inst.scope=val==='iron'?null:val;inst.iron=val==='iron'}else{inst.attachments=inst.attachments||{};inst.attachments[slot]=val==='none'?null:val}this.update(G.VM.models[inst.id],inst);this.render()});
  addEventListener('keydown',e=>{if(e.repeat||G.Game?.state!=='playing')return;if(e.code==='Tab'){e.preventDefault();e.stopImmediatePropagation();this.open?this.close():this.show()}else if(e.code==='Escape'&&this.open){e.preventDefault();e.stopImmediatePropagation();this.close()}},true)
 },
 show(){const p=G.Player,a=G.Game.player;if(!a?.alive||a.knocked||!a.weapons[a.cur]){G.UI.toast('총을 든 상태에서 부착물을 변경할 수 있습니다');return}if(p.reload||p.throwSt||p.cycleT>=0||p.pumpT>=0){G.UI.toast('동작이 끝난 뒤 부착물을 변경하세요');return}this.wasLocked=G.Input.locked;this.open=true;this.panel.hidden=false;G.paused=true;G.Input.unlock();G.UI.showPause(false);this.render()},
 close(){if(!this.open)return;this.open=false;this.panel.hidden=true;if(this.wasLocked)G.resume();else G.UI.showPause(true)},
 render(){const a=G.Game.player,inst=a.weapons[a.cur],d=G.WEAPONS[inst.id],parts=inst.attachments||{};const scope=this.optic(inst,d);const rows=[['optic','조준경',[['iron','가늠쇠'],...d.scopes.map(s=>[s,G.SCOPES[s].name])],scope||'iron'],['muzzle','총구',d.cls!=='shotgun'&&inst.id!=='r45'?[['none','기본'],['suppressor','소음기']]:[['none','기본']],parts.muzzle||'none'],['under','하부',d.cls==='rifle'?[['none','기본'],['grip','수직 손잡이']]:[['none','기본']],parts.under||'none'],['side','측면',[['none','기본'],['laser','레이저 모듈']],parts.side||'none']];document.getElementById('attachBody').innerHTML='<h3>'+G.esc(d.name)+'</h3>'+rows.map(([key,label,opts,selected])=>'<section><strong>'+label+'</strong><div>'+opts.map(([v,n])=>'<button data-slot="'+key+'" data-value="'+v+'" class="'+(v===selected?'selected':'')+'">'+n+'</button>').join('')+'</div></section>').join('')}
};
})();
