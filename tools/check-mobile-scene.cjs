
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 모바일 맵의 실제 픽셀 보존, 경량 모델·확대 LOD·자동 품질·누락 복귀를 검사한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs');
const out=path.resolve(process.env.MOBILE_SHOTS||'/tmp/lz-mobile-checks');
const mobile={viewport:{width:892,height:412},deviceScaleFactor:2.625,contextOptions:{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}};
async function setup(p){await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn)})}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const report={},f=await fixture({...mobile,liveDRS:true,initialOptions:{quality:'potato',players:40},route:setup});
 try{
  const p=f.page;await p.evaluate(()=>{G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.startGame({...G.UI.opts,mode:'training',quality:'potato'});G.paused=true;G.UI.showPause(false);G.Settings.data.visual.grain=0;G.refreshVisuals();});
  report.models=await p.evaluate(()=>({batches:G.MobileWorld.batches.length,ao:{applied:G.StaticAO.applied,rejected:G.StaticAO.rejected},soldiers:G.Soldiers.templates.map(t=>t.tris),branches:Object.keys(G.Veg.mobileBranches).length,terrain:{...G.MobileWorld.terrainStats},colliders:G.World.boxes.length,footprints:G.World.footprints.length}));
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n');
  assert(report.models.batches>300);assert.equal(report.models.ao.rejected,0);assert(report.models.soldiers.every(t=>t<15000));assert.equal(report.models.branches,9);assert(report.models.terrain.reduced>0);
  report.pixels=await p.evaluate(()=>{
   const R=G.renderer,gl=R.getContext(),cam=G.camera,W=G.World,city=W.towns.find(t=>t.type==='city'),poses=[{x:city.x+8,z:city.z+4,y:1.7,dx:-40,dz:-12},{x:city.x+100,z:city.z+70,y:40,dx:-100,dz:-70},{x:194,z:-96,y:1.7,dx:35,dz:15},{x:400,z:230,y:20,dx:0,dz:-100}],rows=[];
   const capture=()=>{G.renderNow();G.Perf.gpuWait();const pixels=new Uint8Array(R.domElement.width*R.domElement.height*4);gl.readPixels(0,0,R.domElement.width,R.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels};
   for(const pose of poses){cam.position.set(pose.x,W.heightAt(pose.x,pose.z)+pose.y,pose.z);cam.lookAt(pose.x+pose.dx,W.heightAt(pose.x+pose.dx,pose.z+pose.dz)+2,pose.z+pose.dz);cam.updateMatrixWorld(true);for(let i=0;i<150;i++)W.update(1/60,cam.position,cam);
    G.MobileWorld.culling=false;G.MobileWorld.invalidate();W.update(0,cam.position,cam);const a=capture();
    G.MobileWorld.culling=true;G.MobileWorld.invalidate();W.update(0,cam.position,cam);const b=capture();let changed=0,total=0,max=0;for(let i=0;i<a.length;i+=4){const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));if(d>8)changed++;total+=d;max=Math.max(max,d)}
    G.MobileWorld.terrainSparse.value=0;const t0=performance.now(),full=capture(),fullMs=performance.now()-t0;G.MobileWorld.terrainSparse.value=1;const t1=performance.now(),sparse=capture(),sparseMs=performance.now()-t1;let terrainChanged=0;for(let i=0;i<full.length;i+=4)if(Math.max(Math.abs(full[i]-sparse[i]),Math.abs(full[i+1]-sparse[i+1]),Math.abs(full[i+2]-sparse[i+2]))>8)terrainChanged++;
    G.MobileWorld.terrainSparse.value=2;const guard=capture();G.MobileWorld.terrainSparse.value=1;let guardChanged=0;for(let i=0;i<full.length;i+=4)if(Math.max(Math.abs(full[i]-guard[i]),Math.abs(full[i+1]-guard[i+1]),Math.abs(full[i+2]-guard[i+2]))>8)guardChanged++;
    rows.push({guardChanged,guardFraction:guardChanged/(a.length/4),pose,changedPixels:changed,pixels:a.length/4,fraction:changed/(a.length/4),meanMaxChannel:total/(a.length/4),max,terrainChanged,terrainFraction:terrainChanged/(a.length/4),fullTerrainMs:fullMs,sparseTerrainMs:sparseMs,stats:{...G.MobileWorld.stats}});
   }return rows;
  });
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n');
  for(const row of report.pixels){assert(row.fraction<.002,'맵 제출 최적화 전후 화면 차이 '+JSON.stringify(row));assert(row.terrainFraction<.002,'지형 샘플링 최적화 전후 화면 차이 '+JSON.stringify(row));assert(row.guardFraction<.002,'지형 필터 경계 복귀 화면 차이 '+JSON.stringify(row));}
  report.shadows=await p.evaluate(()=>{
   const R=G.renderer,gl=R.getContext(),cam=G.camera,W=G.World,dir=W.sunDir.clone(),rows=[];cam.position.set(8,W.heightAt(8,24)+1.7,24);cam.lookAt(-32,W.heightAt(-32,12)+2,12);cam.updateMatrixWorld(true);
   const capture=()=>{R.shadowMap.needsUpdate=true;G.renderNow();G.Perf.gpuWait();const p=new Uint8Array(R.domElement.width*R.domElement.height*4);gl.readPixels(0,0,R.domElement.width,R.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p};
   for(const tier of ['low','medium']){G.__apply(tier);W.sunDir.set(-.98,.123,0).normalize();for(let i=0;i<150;i++)W.update(1/60,cam.position,cam);G.MobileWorld.culling=false;G.MobileWorld.invalidate();W.update(0,cam.position,cam);const a=capture();G.MobileWorld.culling=true;G.MobileWorld.invalidate();W.update(0,cam.position,cam);const b=capture();let changed=0;for(let i=0;i<a.length;i+=4)if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>8)changed++;rows.push({tier,changed,pixels:a.length/4,fraction:changed/(a.length/4)});}
   W.sunDir.copy(dir);G.__apply('potato');W.update(0,cam.position,cam);return rows;
  });for(const row of report.shadows)assert(row.fraction<.002,'낮은 태양의 맵 그림자 차이 '+JSON.stringify(row));
  report.lods=await p.evaluate(()=>{const rows=[],cam=G.camera,save=cam.position.clone();for(const key of ['crate','sandbag']){const lod=G.scene.getObjectByName('range-'+key+'-lod');if(!lod)throw Error('소품 LOD 없음');lod.updateWorldMatrix(true,true);const at=lod.localToWorld(lod.levels[1].object.boundingSphere.center.clone()),check=(distance,zoom)=>{cam.position.copy(at).add(new THREE.Vector3(0,0,distance));cam.updateMatrixWorld(true);G.lodZoom=zoom;lod.update(cam);return lod._currentLevel};rows.push({key,near:check(1,1),far:check(500,1),zoom:check(120,8)});}G.lodZoom=1;cam.position.copy(save);return rows;});
  for(const r of report.lods){assert.equal(r.near,0);assert.equal(r.far,1);assert.equal(r.zoom,0)}
  report.slowFrames=await p.evaluate(()=>{G.__apply('medium');G.qualityMode='auto';G.paused=false;G.DRS.checkT=0;let now=performance.now()+40000;for(let i=0;i<80;i++){now+=150;G.DRS.frame(now,150)}const result={tier:G.quality,scale:G.DRS.scale,fps:G.DRS.fps};G.qualityMode='potato';G.__apply('potato');G.paused=true;return result;});assert.equal(report.slowFrames.tier,'potato','실제 150ms 프레임에서 품질이 내려가지 않음');
  report.restore=await p.evaluate(()=>{const M=G.MobileWorld;M.restore();const full=M.batches.every(b=>b.mesh.geometry.drawRange.count===b.array.length);M.invalidate();M.update(G.camera,G.World);return {full,compact:M.stats.submittedTriangles<M.stats.sourceTriangles};});assert(report.restore.full&&report.restore.compact);
  await p.screenshot({path:path.join(out,'mobile-scene.png'),timeout:90000});assert.deepEqual(f.errors,[]);report.errors=f.errors;
 }finally{await f.close()}
 const fallback=await fixture({...mobile,initialOptions:{quality:'potato'},route:async p=>{await setup(p);await p.route('**/assets/models/mobile/tree-branches.glb*',r=>r.fulfill({status:404,body:''}));await p.route('**/assets/char/swat/swat-mobile.glb*',r=>r.fulfill({status:404,body:''}));}});
 try{report.fallback=await fallback.page.evaluate(()=>({soldier:G.Soldiers.templates[0].tris,branches:Object.keys(G.Veg.mobileBranches).length,batches:G.MobileWorld.batches.length,ready:!!G.VM}));assert.equal(report.fallback.soldier,20698);assert.equal(report.fallback.branches,0);assert(report.fallback.ready);assert.deepEqual(fallback.errors,[]);}finally{await fallback.close()}
 const desktop=await fixture({route:setup});try{report.desktop=await desktop.page.evaluate(()=>({map:G.MobileWorld.enabled,batches:G.MobileWorld.batches.length,soldier:G.Soldiers.templates[0].tris,branches:Object.keys(G.Veg.mobileBranches).length,props:!!G.scene.getObjectByName('range-crate-lod')}));assert.deepEqual(report.desktop,{map:false,batches:0,soldier:20698,branches:0,props:false});assert.deepEqual(desktop.errors,[]);}finally{await desktop.close()}
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS 모바일 맵·모델·픽셀·확대·자동 품질·누락 복귀·PC 경로');
})().catch(e=>{console.error(e);process.exitCode=1});
