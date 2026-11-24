// 같은 좌표·해상도에서 맵 생성, 식생 갱신, 렌더와 고저차 주행을 전후 비교한다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),fixture=require('./optimize/browser-fixture.cjs');
const mode=process.argv[2]||'after',out=process.argv[3]||'/tmp/lz-v87',base='cc88b96bd30ff88ec424d97e748fecfa2d28b4b5',snapshot={};
if(mode==='before')for(const file of ['index.html',...cp.execFileSync('git',['ls-tree','-r','--name-only',base,'js'],{encoding:'utf8'}).trim().split('\n')])snapshot[file]=cp.execFileSync('git',['show',base+':'+file],{encoding:'utf8'});
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const f=await fixture({query:'perf=1',viewport:{width:640,height:360},route:async p=>{
  await p.addInitScript(()=>{Math.random=(()=>{let s=8701;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}})();window.__mapTimes={}});
  if(mode==='before')await p.route('**/assets/lighting/static-ao.json*',r=>r.fulfill({body:cp.execFileSync('git',['show',base+':assets/lighting/static-ao.json'],{maxBuffer:8*1024*1024}),contentType:'application/json'}));
  await p.route('**/version.txt*',r=>r.fulfill({body:mode==='before'?'86':'87'}));
  await p.route(u=>u.hostname==='127.0.0.1'&&(u.pathname==='/'||u.pathname.startsWith('/js/')),r=>{
   const file=new URL(r.request().url()).pathname.slice(1)||'index.html';let body=mode==='before'?snapshot[file]:fs.readFileSync(path.join(__dirname,'..',file),'utf8');if(body===undefined)return r.continue();
   if(file==='js/world.js')body+='\nfor(const key of ["genHeights","genTowns","genWild","genPaths","paintTerrain","buildSkyWater","genVegetation","finalizeParts"]){const fn=G.World[key];G.World[key]=function(...a){const t=performance.now(),done=()=>__mapTimes[key]=performance.now()-t,r=fn.apply(this,a);if(r?.then)return r.then(v=>{done();return v});done();return r}}';
   return r.fulfill({body,contentType:file.endsWith('.html')?'text/html':'application/javascript'});
  });
 }});
 try{
  const p=f.page;await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});
  await p.click('#trainBtn');await p.waitForFunction(()=>G.Training.active);await p.evaluate(()=>{G.paused=true;G.Input.unlock();G.UI.showPause(false);G.VM.set(null)});
  const report={mode,base,version:await p.evaluate(()=>LZ_BUILD),viewport:[640,360],renderer:'Chromium / SwiftShader',note:'소프트웨어 렌더러의 통제 실험. 하드웨어 GPU FPS 또는 실제 플레이어 체감의 측정값이 아님.',stages:await p.evaluate(()=>__mapTimes)};
  report.map=await p.evaluate(()=>{
   const W=G.World,trees=G.Veg.variants.filter(v=>v.kind!=='bush').flatMap(v=>v.items),cells=new Map();let crowded=0,minimum=Infinity;
   for(const t of trees){const ix=Math.floor(t[0]/5),iz=Math.floor(t[2]/5);let near=Infinity;for(let x=ix-1;x<=ix+1;x++)for(let z=iz-1;z<=iz+1;z++)for(const a of cells.get(x+','+z)||[])near=Math.min(near,Math.hypot(a[0]-t[0],a[2]-t[2]));minimum=Math.min(minimum,near);if(near<2)crowded++;const k=ix+','+iz;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(t)}
   let highFoundations=0,buildings=0;for(const f of W.footprints){if(!['house1','house2','apt','shop','cabin','warehouse','barn','shed'].includes(f.kind))continue;buildings++;const h=[];for(const x of[f.minX,f.maxX])for(const z of[f.minZ,f.maxZ])h.push(W.heightAt(x,z));if(Math.max(...h)-Math.min(...h)>2)highFoundations++}
   const rivers=W.rivers.map(R=>{let rise=0,maxGrade=0,maxMismatch=0;for(let i=0;i<R.pts.length;i++){const p=R.pts[i];maxMismatch=Math.max(maxMismatch,Math.abs(W.waterAt(p.x,p.z)-p.level));if(i){const o=R.pts[i-1];if(p.level>o.level+.01)rise++;maxGrade=Math.max(maxGrade,Math.abs(p.level-o.level)/Math.hypot(p.x-o.x,p.z-o.z))}}return{name:R.name,rise,maxGrade,maxMismatch,source:R.pts[0].level,end:R.pts.at(-1).level}});
   let shore=0,exposedOutside=0;for(const L of W.lakes)for(let x=L.cx-L.ext-10;x<L.cx+L.ext+10;x+=2)for(let z=L.cz-L.ext-10;z<L.cz+L.ext+10;z+=2){if(Math.hypot(x-L.cx,z-L.cz)>L.ext+12)continue;shore++;if(W.lakeSD(L,x,z)>1&&W.heightAt(x,z)<L.level-.02)exposedOutside++}
   const waterMeshes=W.inlandWater?[W.inlandWater]:G.scene.children.filter(o=>o.isMesh&&o!==W.water&&o.material===W.water.material);
   return{inlandTriangles:waterMeshes.reduce((s,o)=>s+o.geometry.index.count/3,0),roadClearanceBytes:W.roadClearance?.byteLength||0,buildings,highFoundations,trees:trees.length,crowdedPairsUnder2m:crowded,minimumTreeDistance:minimum,rivers,lakeOutsideVisibleSamples:exposedOutside,lakeDiscSamples:shore,colliders:W.boxes.length,staticAO:{applied:G.StaticAO.applied,rejected:G.StaticAO.rejected},layout:W.layoutStats||null};
  });
  report.driving=await p.evaluate(()=>{
   const W=G.World,V=G.Vehicles,original={heightAt:W.heightAt,waterAt:W.waterAt,queryBoxes:W.queryBoxes},owner=G.Game.player,saved=owner.pos.clone(),runs=[];
   W.waterAt=()=>-100;W.queryBoxes=()=>{};
   try{for(const profile of['descent','drop']){
    W.heightAt=(x,z)=>profile==='descent'?30-.20*(-z):(-z<15?24:-z<16?24-20*(-z-15):4);
    const v=V.newVehicle(0,W.heightAt(0,0),0,0,{kind:'izh'});V.unblock(v);v.driver=owner;v.speed=15;let lastY=v.pos.y,lastV=0,maxDown=0,airFrames=0,penetration=0,landing=null;const samples=[];
    for(let i=0;i<360;i++){V.step(v,owner,1/60,0,0,false,false);const vy=(v.pos.y-lastY)*60;if(i>2)maxDown=Math.max(maxDown,(lastV-vy)*60);if(v.grounded===false)airFrames++;if(-v.pos.z>20&&landing===null&&v.pos.y<4.1)landing=i/60;penetration=Math.max(penetration,W.heightAt(v.pos.x,v.pos.z)-v.pos.y);if(i%3===0)samples.push({t:(i+1)/60,x:v.pos.x,y:v.pos.y,z:v.pos.z,vy,grounded:v.grounded??null});lastY=v.pos.y;lastV=vy}
    runs.push({profile,maxDownwardAcceleration:maxDown,airborneSeconds:airFrames/60,landingTime:landing,penetration,speed:v.speed,samples});v.driver=null;G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);
   }return runs}finally{Object.assign(W,original);owner.pos.copy(saved)}
  });
  fs.writeFileSync(path.join(out,mode+'-probe.json'),JSON.stringify(report,null,2)+'\n');console.log('맵·주행 기록',mode,JSON.stringify(report.map));
  const before=mode==='after'&&fs.existsSync(path.join(out,'before.json'))?JSON.parse(fs.readFileSync(path.join(out,'before.json'))):null;
  report.scenes=before?.scenes||await p.evaluate(()=>{
   const W=G.World,H=(x,z)=>W.heightAt(x,z);return{city:{pos:[105,H(105,145)+35,145],look:[0,H(0,20)+2,20]},forest:{pos:[-360,H(-360,130)+2,130],look:[-320,H(-320,95)+4,95]},shore:{pos:[500,H(500,245)+25,245],look:[400,W.lakes[0].level,140]}};
  });
  await p.addStyleTag({content:'#hud,#toast,#fpsBox,#perfOverlay{visibility:hidden!important}'});
  report.frames=[];report.foliage=[];
  for(const tier of(process.env.TIERS||'potato,low,medium,high').split(','))for(const [name,scene]of Object.entries(report.scenes)){
   const run=await p.evaluate(({tier,scene,count})=>{
    G.__apply(tier);G.setRenderResolution('100');const cam=G.camera,R=G.renderer,gl=R.getContext();cam.position.set(...scene.pos);cam.lookAt(...scene.look);cam.updateMatrixWorld(true);cam.updateProjectionMatrix();G.DRS.frame=()=>{};
    for(let i=0;i<2;i++){G.World.update(.25,cam.position,cam);G.renderNow();G.Perf.gpuWait()}G.Perf.gpuWait();
    const cpu=[];for(let wave=0;wave<7;wave++){const start=performance.now();for(let i=0;i<16;i++){G.Veg.lastT=2;G.Veg.update(1/60,cam.position,cam)}cpu.push((performance.now()-start)/16)}
    const ms=[],calls=[],tris=[],auto=R.info.autoReset;R.info.autoReset=false;
    try{for(let i=0;i<count;i++){G.World.update(1/60,cam.position,cam);R.shadowMap.needsUpdate=true;G.Perf.gpuWait();R.info.reset();const start=performance.now();G.renderNow();G.Perf.gpuWait();ms.push(performance.now()-start);calls.push(R.info.render.calls);tris.push(R.info.render.triangles)}}finally{R.info.autoReset=auto}
    const median=a=>a.sort((a,b)=>a-b)[a.length>>1];return{ms:median(ms),samples:ms,calls:median(calls),triangles:median(tris),foliageUpdateMs:median(cpu),foliageCandidates:G.Veg.candidatesVisited??null,near:G.Veg.variants.reduce((s,v)=>s+(v.near?.count||0),0),far:G.Veg.variants.reduce((s,v)=>s+(v.far?.count||0),0),output:R.getDrawingBufferSize(new THREE.Vector2()).toArray(),internal:G.composerRT()? [G.composerRT().width,G.composerRT().height]:null};
   },{tier,scene,count:+(process.env.FRAMES||5)});
   report.frames.push({tier,scene:name,...run});console.log(mode,tier,name,JSON.stringify(run));
   if(tier==='medium')await p.screenshot({path:path.join(out,mode+'-'+name+'.png'),timeout:60000});
  }
  const png=await p.evaluate(()=>G.World.mapCanvas.toDataURL('image/png'));fs.writeFileSync(path.join(out,mode+'-map.png'),Buffer.from(png.split(',')[1],'base64'));
  report.errors=f.errors;fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify(report,null,2)+'\n');if(f.errors.length)throw Error(f.errors.join('\n'));console.log('PASS',mode,JSON.stringify(report.map));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
