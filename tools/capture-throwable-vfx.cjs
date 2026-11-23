// 같은 사격장·카메라·시각에서 v83과 v84의 투척 효과 및 드로 수를 비교한다.
const fs=require('fs'),cp=require('child_process'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
const mode=process.argv[2]||'after',out=process.argv[3]||'/tmp/lz-v84-vfx',close=process.env.VFX_CLOSE==='1',base='83563f6eecc062ca3b4f07196f51840a19434bf2',old={};
if(mode==='before')for(const file of['index.html',...cp.execFileSync('git',['ls-tree','-r','--name-only',base,'js'],{encoding:'utf8'}).trim().split('\n')])old[file]=cp.execFileSync('git',['show',base+':'+file],{encoding:'utf8'});
(async()=>{
 const f=await fixture({query:'perf=1',viewport:{width:800,height:450},route:async p=>{
  if(mode!=='before')return;await p.route('**/version.txt*',r=>r.fulfill({body:'83'}));await p.route('**/assets/audio/weapons/manifest.json*',r=>r.fulfill({body:cp.execFileSync('git',['show',base+':assets/audio/weapons/manifest.json'],{encoding:'utf8'}),contentType:'application/json'}));
  await p.route(u=>u.hostname==='127.0.0.1'&&(u.pathname==='/'||old[u.pathname.slice(1)]!==undefined),r=>{const name=new URL(r.request().url()).pathname.slice(1)||'index.html';return r.fulfill({body:old[name],contentType:name.endsWith('.html')?'text/html':'application/javascript'})});
 }});
 try{
  const p=f.page;fs.mkdirSync(out,{recursive:true});await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});await p.waitForTimeout(60);await p.click('#trainBtn');await p.waitForFunction(()=>G.Training.active);
  await p.evaluate(close=>{G.paused=true;G.Input.unlock();G.UI.showPause(false);G.__apply('medium');G.setRenderResolution('100');G.VM.set(null);G.VM.update(0,{hideVM:true,ads:0,raise:1,reload:null,moving:0,landDip:0,phase:0});const r=G.World.range,p=new THREE.Vector3(r.x+23,r.y+.12,r.line-17);G.camera.position.copy(p).add(close?new THREE.Vector3(1.3,.7,2.5):new THREE.Vector3(4.8,3.2,8.2));G.camera.lookAt(p.x,p.y+(close?.2:.7),p.z);G.camera.updateMatrixWorld(true);window.__blastPoint=p;G.World.update(0,G.camera.position,G.camera);G.renderNow()},close);
  await p.addStyleTag({content:'#hud,#toast,#fpsBox,#perfOverlay{visibility:hidden!important}'});const rows=[];
  for(const[kind,times]of(close?[['molotov',[.28]]]:[['frag',[.05,.25,.85]],['molotov',[.08,1.2,5]]])){
   await p.evaluate(kind=>{G.Throwables.reset();G.FX.reset();Math.random=G.U.mulberry32(840225);G.Throwables.detonate({kind,pos:__blastPoint.clone(),owner:G.Game.player,team:0,contactNormal:new THREE.Vector3(0,1,0)});window.__blastElapsed=0},kind);
   for(const time of times){
    const row=await p.evaluate(time=>{while(__blastElapsed<time-1e-8){const dt=Math.min(1/60,time-__blastElapsed);G.Throwables.update(dt);G.FX.update(dt);__blastElapsed+=dt}const r=G.renderer,auto=r.info.autoReset;r.info.autoReset=false;r.info.reset();G.Perf.gpuWait();const start=performance.now();G.renderNow();G.Perf.gpuWait();const ms=performance.now()-start;const data={time,ms,calls:r.info.render.calls,triangles:r.info.render.triangles,legacySprites:G.FX.add.list.length+G.FX.norm.list.length,sprites:G.ThrowableVFX?.sprites.length||0,chunks:G.ThrowableVFX?.shardMesh.count||0,marks:G.ThrowableVFX?.groundMesh.count||0,lights:G.FX.lights.length};r.info.autoReset=auto;return data},time);
    row.kind=kind;rows.push(row);await p.screenshot({path:path.join(out,mode+'-'+kind+'-'+String(time).replace('.','_')+'.png')});
   }
  }
  fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify({mode,base,rows,errors:f.errors},null,2)+'\n');if(f.errors.length)throw Error(f.errors.join('\n'));console.log('PASS 화면 저장',mode,out,JSON.stringify(rows));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
