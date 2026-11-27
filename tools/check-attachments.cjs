
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 부착물의 실제 메시·광축·움직이는 부품 연결을 브라우저에서 확인한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs');
(async()=>{const f=await fixture({viewport:{width:1100,height:700}});try{
 const p=f.page;await p.evaluate(async()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='frame'?0:raf(cb);G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};for(const id of G.GUN_IDS)G.VM.ensure(id);await G.AssetVM.loadAll();G.startGame({...G.UI.opts,mode:'training',quality:'medium'});G.paused=true;G.UI.showPause(false)});
 const report=await p.evaluate(()=>{
  const T=THREE,V=T.Vector3,out={guns:[],optics:[],reloads:[],failures:[]},a=G.Game.player,P=G.Player;
  const equip=(id,scope,parts)=>{const d=G.WEAPONS[id];a.weapons[d.cls]={id,mag:d.mag,scope,iron:!scope,attachments:parts};a.cur=d.cls;Object.assign(P,{raise:1,sw:null,reload:null,heal:null,ads:1,scopeView:0,landDip:0,camKick:0,cycleT:-1,pumpT:-1,sprinting:false});Object.assign(G.VM,{kick:0,kickV:0,kickRoll:0,sprint:0,camRX:0,camRY:0,camRZ:0});a.hspeed=0;G.FX.shakeAmt=0;for(let i=0;i<120;i++)P.updateCamera(1/60);G.vmScene.updateMatrixWorld(true);return G.VM.models[id]};
  for(const id of G.GUN_IDS){
   const d=G.WEAPONS[id],options=G.Attachments.options(d),parts={};for(const slot of ['muzzle','under','side','stock','magazine'])if(options[slot][1])parts[slot]=options[slot][1][0];
   const m=equip(id,null,parts),pack=G.AssetVM.pack(id),native=id==='ar7'?G.M4Viewmodel:id==='g18'?G.G17Pilot:null,profile=native?.attachmentProfile||pack?.attachmentProfiles[id]||m.attachmentProfile;
   if(!profile){out.failures.push(id+' 장착 프로필 없음');continue}
   const counts=profile.contacts;out.guns.push({id,contacts:counts,rail:profile.rail.toArray(),under:profile.under.toArray(),side:profile.side.toArray(),muzzle:profile.muzzle.toArray()});
   for(const slot of ['side','under'])if(parts[slot]&&!counts[slot])out.failures.push(id+' '+slot+' 접점 없음');
   if(parts.stock&&!counts.stock)out.failures.push(id+' 개머리판 접점 없음');
   if(parts.muzzle&&!counts.muzzle)out.failures.push(id+' 총구 접점 없음');
   for(const scope of d.scopes){
    equip(id,scope,parts);const root=native?.opticRoot||pack?.mountGroup||m.scopes[scope]?.group,dots=[],glass=[];
    root?.traverse(o=>{if(o.userData.lzReticle)dots.push(o);if(o.isMesh&&/glass/i.test(o.material?.name||''))glass.push(o)});
    let error=0;for(const dot of dots){const v=dot.getWorldPosition(new V()).project(G.vmCamera);error=Math.max(error,Math.hypot(v.x*innerWidth/2,v.y*innerHeight/2))}
    const record={id,scope,pixels:error,reticles:dots.length,glass:glass.length};out.optics.push(record);
    if(!root||!glass.length||error>.5||(['reddot','holo','x2'].includes(scope)&&dots.length!==1))out.failures.push(record);
    const optics=[];root?.traverse(o=>{if(o.userData.seat&&o.userData.asset)optics.push(o)});
    for(const optic of optics){
     const seat=new V(...optic.userData.seat),origin=seat.clone().add(new V(0,.02,0));optic.localToWorld(origin);
     const direction=new V(0,-1,0).transformDirection(optic.matrixWorld),scale=optic.getWorldScale(new V()).y,ray=new T.Raycaster(origin,direction,0,.2*scale),meshes=[];
     const sources=native?[native.model]:pack?(pack.swaps[id]?.groups||pack.gunMeshes):[m.gun];
     for(const source of sources)source.traverse(o=>{if(!o.isMesh||native&&o.isSkinnedMesh)return;for(let n=o;n;n=n.parent){if(!n.visible||n.userData.lzAttachment||n.userData.lzFoldSight)return;if(n===source)break}meshes.push(o)});
     const hit=ray.intersectObjects(meshes,false)[0],gap=hit?hit.distance/scale-.023:null;record.seatGap=gap;
     if(gap===null||gap<-.003)out.failures.push({id,scope,seatGap:gap});
     record.contactGaps=[];for(const point of optic.userData.contacts||[]){const pos=new V(...point).add(new V(0,.02,0));optic.localToWorld(pos);ray.set(pos,direction);const hit=ray.intersectObjects(meshes,false)[0],gap=hit?hit.distance/scale-.02:null;record.contactGaps.push(gap);if(gap===null||Math.abs(gap)>.006)out.failures.push({id,scope,contactGap:gap})}
    }
    // 중심 광선이 렌즈 뒤의 불투명 하우징에 가려지는지 검사한다.
    if(dots.length){const dot=dots[0],target=dot.getWorldPosition(new V()),ray=new T.Raycaster(G.vmCamera.position,target.clone().sub(G.vmCamera.position).normalize(),.001,target.distanceTo(G.vmCamera.position)-.001),meshes=[];root.traverse(o=>{if(o.isMesh&&!o.userData.lzReticle&&!/glass/i.test(o.material?.name||'')&&o.geometry.type!=='RingGeometry')meshes.push(o)});const hit=ray.intersectObjects(meshes,false)[0];if(hit)out.failures.push({id,scope,blocked:hit.object.name,distance:hit.distance})}
   }
   // 레일/하부 선택을 반복해도 공유 원형 메시가 손상되거나 자식이 쌓이지 않아야 한다.
   const scope=d.scopes[0]||null;for(const under of options.under.slice(1).map(x=>x[0])){equip(id,scope,{...parts,under});const r=native?.mount||pack?.mountGroup||m.accessories;if(!r)out.failures.push(id+' '+under+' 모델 없음')}
   if(d.reloadType==='mag'){
    equip(id,scope,parts);for(const progress of [.12,.35,.6,.88,1]){P.reload={kind:'mag',t:progress,dur:1,empty:true};P.updateCamera(1/60);G.vmScene.updateMatrixWorld(true);let valid=true;const root=native?.pivot||pack?.pivot||m.root;root.traverse(o=>{if(o.isMesh&&!o.matrixWorld.elements.every(Number.isFinite))valid=false});if(!valid)out.failures.push(id+' 장전 변환 오류 '+progress)}P.reload=null;out.reloads.push(id);
   }
  }
  out.previews=[];
  for(const id of ['ar7','g18','sc17','mk14']){
   equip(id,'reddot',{muzzle:'suppressor',magazine:'extendedQuick'});const m=G.VM.models[id],pack=G.AssetVM.pack(id),savedId=pack?.gunId,savedMuzzle=pack?.muzzleLocal.clone();
   // 다른 무기를 든 상태에서도 선택한 총만 보여야 한다.
   if(id!=='g18')equip('g18','reddot',{});
   G.Attachments.update(m,a.weapons[G.WEAPONS[id].cls]);let count=0;
   for(let i=0;i<4;i++){G.Attachments.preview(m,'reddot');const n=G.Attachments.previewRenderer.info.memory.geometries;if(i&&n>count+1)out.failures.push(id+' 미리보기 버퍼 누적');count=n}
   const bounds=new T.Box3().setFromObject(G.Attachments.previewModel);if(bounds.isEmpty()||!Number.isFinite(bounds.max.z))out.failures.push(id+' 미리보기 형상 없음');
   if(pack&&(pack.gunId!==savedId||pack.muzzleLocal.distanceTo(savedMuzzle)>1e-6))out.failures.push(id+' 미리보기가 플레이 총기 상태를 변경함');
   out.previews.push({id,geometries:count,length:bounds.max.z-bounds.min.z});
  }
  // 원형 모델을 다시 복제해도 양자화·병합으로 형상이 사라지지 않아야 한다.
  out.assets=G.AttachmentModels.ids.map(id=>{const root=G.Attachments.make(id,1),b=new T.Box3().setFromObject(root);let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3});if(b.isEmpty()||!Number.isFinite(b.min.x)||triangles<20)out.failures.push(id+' 형상 손상');return{id,triangles,size:b.getSize(new V()).toArray()}});
  return out;
 });
 if(process.env.REPORT)fs.writeFileSync(process.env.REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({guns:report.guns.length,optics:report.optics.length,reloads:report.reloads.length,assets:report.assets.length,maxPixels:Math.max(...report.optics.map(x=>x.pixels)),failures:report.failures,errors:f.errors}));assert.deepEqual(f.errors,[]);assert.deepEqual(report.failures,[]);
 if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});for(const id of ['ar7','g18','ka47','kr98','mp9','lm86']){await p.evaluate(id=>{const a=G.Game.player,d=G.WEAPONS[id],options=G.Attachments.options(d),parts={};for(const k of ['muzzle','under','side','stock','magazine'])if(options[k][1])parts[k]=k==='under'?'angled':k==='magazine'?'extendedQuick':options[k][1][0];a.weapons[d.cls]={id,mag:d.mag,scope:d.scopes.includes('x4')?'x4':'reddot',attachments:parts};a.cur=d.cls;Object.assign(G.Player,{raise:1,sw:null,reload:null,ads:0,scopeView:0,landDip:0,sprinting:false});for(let i=0;i<120;i++)G.Player.updateCamera(1/60);G.Attachments.viewSlot=d.cls;G.Attachments.open=true;G.Attachments.panel.hidden=false;G.Attachments.render()},id);await p.locator('#attachPreview').screenshot({path:path.join(process.env.SHOTS,id+'.png')})}}
 console.log('PASS: 부착물 형상·접면·광축·장전 확인');
 }finally{await f.close()}})().catch(e=>{console.error(e);process.exitCode=1});
