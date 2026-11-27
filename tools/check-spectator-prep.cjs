// v108 관전 중 도착한 실제 총기 팩을 보류하고 관전 종료 후 준비한다.
require('./artifact-paths.cjs');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.env.REPORT||path.join(os.tmpdir(),'last-zone-spectator-prep.json'),report={renderer:'SwiftShader 기능 검사, 실제 기기의 FPS가 아님'};
function save(){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
(async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve});
 const f=await fixture({shaderDebug:false,liveDRS:true,viewport:{width:320,height:180},route:async p=>{
  await p.route('**/assets/models/viewmodels/acr.glb*',async r=>{await gate;await r.continue()});
 }}),p=f.page;
 try{
  report.start=await p.evaluate(async()=>{
   G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{G.Input.locked=true};
   const ready=await G.startGame({...G.UI.opts,players:4,loadout:'rifle'}),C=window.spectatorCheck={uploads:[],queries:[],ticks:0,renders:0,finished:false};
   C.request=G.AssetVM.request('sc17').then(()=>{C.finished=true});
   const init=G.renderer.initTexture,render=G.renderer.render,update=G.Game.update;
   G.renderer.initTexture=function(...a){C.uploads.push({spectating:G.Game.spectating,paused:G.paused});return init.apply(this,a)};
   G.renderer.render=function(...a){if(G.Game.spectating&&!G.paused)C.renders++;return render.apply(this,a)};
   G.Game.update=function(dt){if(this.spectating&&!G.paused)C.ticks++;return update.call(this,dt)};
   const gl=G.renderer.getContext();for(const key of['getProgramInfoLog','getShaderInfoLog']){const fn=gl[key];gl[key]=function(...a){if(G.Game.spectating&&!G.paused)C.queries.push(key);return fn.apply(this,a)}}
   G.Game.kill(G.Game.player,null,'bullet',false);G.Game.finish(false);G.Game.startSpectate();C.started=performance.now();C.from=G.Game.time;
   return{ready,state:G.Game.state,spectating:G.Game.spectating,paused:G.paused,teams:G.Game.teamsAlive()};
  });
  assert(report.start.ready&&report.start.spectating&&!report.start.paused&&report.start.teams>1);release();
  await p.waitForFunction(()=>G.RenderPrep.jobs.length>0,null,{timeout:30000});await p.waitForTimeout(3000);
  report.watch=await p.evaluate(()=>({wallMs:performance.now()-spectatorCheck.started,advanced:G.Game.time-spectatorCheck.from,ticks:spectatorCheck.ticks,renders:spectatorCheck.renders,uploads:spectatorCheck.uploads,queries:spectatorCheck.queries,finished:spectatorCheck.finished,pack:!!G.AssetVM.packs.acr?.ready,pending:G.RenderPrep.jobs.length,running:!!G.RenderPrep.running,spectating:G.Game.spectating,paused:G.paused,lost:G.GraphicsRecovery.lost}));
  const w=report.watch;assert(w.spectating&&!w.paused&&!w.lost);assert(w.wallMs>=3000&&w.advanced>.1&&w.ticks>3&&w.renders>3,'실제 관전 프레임이 진행되어야 함');assert(!w.finished&&!w.pack&&!w.running&&w.pending>0,'관전 중 지연 팩 준비 금지');assert.deepEqual(w.uploads,[]);assert.deepEqual(w.queries,[]);
  await p.evaluate(async()=>{G.Game.stopSpectate();await spectatorCheck.request});
  await p.waitForFunction(()=>!G.RenderPrep.running&&!G.RenderPrep.jobs.length,null,{timeout:90000});
  report.result=await p.evaluate(()=>({finished:spectatorCheck.finished,pack:!!G.AssetVM.pack('sc17'),spectating:G.Game.spectating,uploads:spectatorCheck.uploads,target:G.renderer.getRenderTarget()===null,error:G.renderer.getContext().getError()}));
  const r=report.result;assert(r.finished&&r.pack&&!r.spectating&&r.target);assert(r.uploads.length>0&&r.uploads.every(u=>!u.spectating||u.paused));assert.equal(r.error,0);assert.deepEqual(f.errors,[]);report.errors=f.errors;save();console.log('PASS 실제 관전 진행·지연 총기 팩 보류·진행 중 업로드/진단 조회 0·종료 후 준비');
 }catch(e){report.failure=e.stack;report.errors=f.errors;save();throw e}finally{release();await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
