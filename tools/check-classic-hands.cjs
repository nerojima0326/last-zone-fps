
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 게임과 독립 장전 화면이 같은 기존 장갑·소매를 쓰는지 브라우저에서 검사한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./expanded-motion-fixture.cjs');
const report=path.resolve(process.env.REPORT||'/tmp/lz-classic-hands.json'),shots=process.env.SHOTS;
(async()=>{
 const f=await fixture(),p=f.page,result={};
 try{
  result.game=await p.evaluate(()=>{
   const R=G.RealArms,VM=G.VM,old=R.enabled,rows=[];
   const fingerprint=mesh=>{
    const attributes={};for(const key of ['position','normal','uv']){const a=mesh.geometry.attributes[key].array,bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);attributes[key]=(h>>>0).toString(16);}
    return {vertices:mesh.geometry.attributes.position.count,attributes,materials:[].concat(mesh.material).map(m=>m.name),tinted:[].concat(mesh.material).every(m=>m.map?.image?.width>0&&m.userData.armTint?.every(Number.isFinite)&&m.customProgramCacheKey()==='vmArmCutT')};
   };
   const source=[];G.M4Viewmodel.model.getObjectByName('Hand_Mesh').traverse(o=>{if(o.isSkinnedMesh)source.push(fingerprint(o))});
   R.enabled=false;
   for(const id of Object.keys(G.WeaponCatalog)){
    gunStudio.select(id);const m=VM.models[id],sourceMotion=G.ExpandedMotion;
    // 모션 확장 모듈이 없어도 기존 손 선택은 유지해야 한다.
    try{G.ExpandedMotion=null;G.Player.updateCamera(1/60);}finally{G.ExpandedMotion=sourceMotion;}
    const meshes=[];R.copy.traverse(o=>{if(o.isSkinnedMesh)meshes.push(fingerprint(o))});
    rows.push({id,visible:R.ready&&R.copy.visible&&R.copy.parent===m.root,proceduralHidden:[m.armL,m.armR].every(a=>a.grp.children.filter(o=>o.isSkinnedMesh).every(o=>!o.visible)),meshes});
   }
   R.enabled=old;return {source,rows};
  });
  assert.equal(result.game.rows.length,15);
  for(const r of result.game.rows){assert(r.visible&&r.proceduralHidden,r.id+' 게임 손 선택');assert.deepEqual(r.meshes,result.game.source,r.id+' 원본 손 형상·텍스처 좌표');assert(r.meshes.every(m=>m.tinted),r.id+' 기존 장갑·소매 색과 텍스처');}
  if(shots){
   fs.mkdirSync(shots,{recursive:true});
   const frames=await p.evaluate(()=>{
    gunStudio.select('ar416',false);const normal=gunStudio.image(),C=G.vmCamera,L=G.RealArms.S.L.b,focus=L.hand.getWorldPosition(new THREE.Vector3()).lerp(L.fingers.Middle[0].getWorldPosition(new THREE.Vector3()),.55);
    C.position.copy(focus).add(new THREE.Vector3(-.11,.09,.22));C.lookAt(focus);C.fov=43;C.updateProjectionMatrix();
    return {normal,detail:gunStudio.image()};
   });
   for(const [name,body]of Object.entries(frames))fs.writeFileSync(path.join(shots,'game-'+name+'.png'),Buffer.from(body,'base64'));
  }
  const base=new URL('/tools/reloads.html',p.url()).href;
  await p.goto(base);await p.waitForFunction(()=>window.ReloadStudio?.ready,null,{timeout:120000});
  result.studio=await p.evaluate(()=>{
   const S=ReloadStudio,R=G.RealArms,rows=[];S.pause();
   for(const id of Object.keys(G.WeaponCatalog))for(const mode of ['empty','tactical']){
    S.select(id,mode);S.pause();let visible=true,finite=true;
    for(const t of [0,.18,.48,.76,1]){
     S.seek(S.duration*t);S.scene.updateMatrixWorld(true);
     visible=visible&&!!R?.copy?.visible&&R.copy.parent===S.model.root&&S.model._realHidden;
     S.model.root.traverse(o=>{finite=finite&&o.matrixWorld.elements.every(Number.isFinite)});
    }
    rows.push({id,mode,visible,finite,mag:G.Player.a.weapons[G.Player.a.cur].mag,expected:G.WEAPONS[id].mag});
   }
   const meshes=[];R?.copy?.traverse(o=>{if(!o.isSkinnedMesh)return;const attributes={};for(const key of ['position','normal','uv']){const a=o.geometry.attributes[key].array,bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);attributes[key]=(h>>>0).toString(16)}meshes.push({vertices:o.geometry.attributes.position.count,attributes,materials:[].concat(o.material).map(m=>m.name),tinted:[].concat(o.material).every(m=>m.map?.image?.width>0&&m.userData.armTint?.every(Number.isFinite)&&m.customProgramCacheKey()==='vmArmCutT')});});
   return {label:document.getElementById('status').textContent,ready:!!R?.ready,meshes,rows};
  });
  if(shots){await p.setViewportSize({width:1440,height:900});for(const id of ['ar416','mp9','p226','mg60']){
   await p.evaluate(id=>{ReloadStudio.select(id);ReloadStudio.pause();ReloadStudio.seek(ReloadStudio.duration*.66);},id);
   await p.screenshot({path:path.join(shots,id+'.png')});
  }}
  assert(result.studio.ready,'장전 화면의 기존 손 준비');assert.deepEqual(result.studio.meshes,result.game.source,'게임·미리보기의 원본 손 형상 일치');
  for(const r of result.studio.rows)assert(r.visible&&r.finite&&r.mag===r.expected,JSON.stringify(r));
  assert(result.studio.label.includes('검은 장갑 / 녹색 소매'),'기존 손 표시');
  await p.goto(base+'?arms=procedural');await p.waitForFunction(()=>window.ReloadStudio?.ready,null,{timeout:120000});
  result.procedural=await p.evaluate(()=>{ReloadStudio.select('ar416');ReloadStudio.pause();ReloadStudio.seek(ReloadStudio.duration);return {ready:G.RealArms.ready,hidden:!!ReloadStudio.model._realHidden,mag:G.Player.a.weapons[G.Player.a.cur].mag,label:document.getElementById('status').textContent}});
  assert(!result.procedural.ready&&!result.procedural.hidden&&result.procedural.mag===30,'기본 손 비교 경로');
  await p.route('**/assets/models/viewmodels/m4.glb*',r=>r.fulfill({status:404,body:''}));
  await p.goto(base);await p.waitForFunction(()=>window.ReloadStudio?.ready,null,{timeout:120000});
  result.missing=await p.evaluate(()=>{ReloadStudio.select('ar416');ReloadStudio.pause();ReloadStudio.seek(ReloadStudio.duration);return {ready:G.RealArms.ready,hidden:!!ReloadStudio.model._realHidden,mag:G.Player.a.weapons[G.Player.a.cur].mag,label:document.getElementById('status').textContent}});
  assert(!result.missing.ready&&!result.missing.hidden&&result.missing.mag===30&&result.missing.label.includes('로드 실패'),'손 파일 누락 시 기본 손 장전');
  result.errors=f.errors;assert.deepEqual(f.errors,[]);fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');
  console.log('PASS 게임 15종·장전 화면 30조합의 기존 손, 기본 손 비교·파일 누락 복귀');
 }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
