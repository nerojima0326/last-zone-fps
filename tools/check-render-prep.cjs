// v108 실제 이동 중 GPU 준비 금지·시작 완료·지연 모델·재시작을 검사한다.
require('./artifact-paths.cjs');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.env.REPORT||path.join(os.tmpdir(),'last-zone-render-prep.json');
(async()=>{
 let releaseFire;const fireGate=new Promise(resolve=>{releaseFire=resolve});
 const f=await fixture({shaderDebug:false,liveDRS:true,viewport:{width:320,height:180},initialOptions:{quality:'low',renderResolution:'75'},route:async p=>{
  await p.route('**/assets/textures/vfx/pool-fire-v85.webp',async r=>{await fireGate;await r.continue()});
  await p.addInitScript(()=>{
   let seed=107;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   window.prepCheck={active:false,frames:[],tasks:[],queries:[],uploads:0,finished:false};
   for(const proto of[WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype])for(const key of['getProgramInfoLog','getShaderInfoLog']){
    const fn=proto[key];proto[key]=function(...args){if(prepCheck.active&&!G.preparing&&!G.paused)prepCheck.queries.push(key);return fn.apply(this,args)};
   }
   new PerformanceObserver(list=>{if(prepCheck.active)for(const e of list.getEntries())if(e.startTime>=prepCheck.started)prepCheck.tasks.push({at:e.startTime-prepCheck.started,ms:e.duration})}).observe({type:'longtask',buffered:true});
   const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>raf(now=>{const on=prepCheck.active&&fn.name==='frame',t=performance.now();fn(now);if(on)prepCheck.frames.push({at:performance.now()-prepCheck.started,cpuMs:performance.now()-t,ms:prepCheck.last?now-prepCheck.last:0,paused:G.paused});if(on)prepCheck.last=now;});
  });
 }}),p=f.page,report={renderer:'SwiftShader 진단, 실제 기기의 FPS가 아님'};
 try{
  report.start=await p.evaluate(async()=>{
   G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{G.Input.locked=true};G.Perf.setQuiet(true);
   const one=G.startGame({...G.UI.opts,mode:'training'}),two=G.startGame({...G.UI.opts,mode:'training'}),same=one===two,ready=await one;
   const C=prepCheck;C.started=performance.now();C.active=true;C.update=G.Game.update;
   const init=G.renderer.initTexture;G.renderer.initTexture=function(...args){if(C.active&&!G.paused&&!G.preparing)C.uploads++;return init.apply(this,args)};
   const root=new THREE.Group(),tex=new THREE.DataTexture(new Uint8Array(16).fill(255),2,2);tex.needsUpdate=true;
   root.add(new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshBasicMaterial({map:tex})));
   C.pending=G.RenderPrep.prepare(root).then(()=>{C.finished=true;root.children[0].geometry.dispose();root.children[0].material.dispose();tex.dispose()});
   C.pack=G.AssetVM.request('sc17');C.from=G.Player.a.pos.toArray();C.phase=-1;
   G.Game.update=function(dt){
    const wall=(performance.now()-C.started)/1000,a=G.Player.a,I=G.Input;I.keys.KeyW=true;I.keys.ShiftLeft=true;
    if(wall>4&&!C.switched){C.switched=true;a.give('sc17');a.cur='rifle';G.Player.sw=null;G.Player.raise=1;G.VM.set('sc17')}
    const phase=Math.floor(wall/10);if(phase!==C.phase){C.phase=phase;if(phase===1||phase===2){const town=G.World.towns.find(t=>t.type==='city'),x=town.x+(phase===1?120:8),z=town.z+(phase===1?120:4);a.pos.set(x,G.World.heightAt(x,z),z);a.vel.set(0,0,0);G.Player.camY=0;a.onGround=true;}}
    a.yaw+=dt*.2;return C.update.call(this,dt);
   };
   const perf={on:G.Perf.on,query:G.Perf.cur};G.Perf.setQuiet(false);
   return{same,ready,preparing:G.preparing,loading:!document.getElementById('loading').classList.contains('hidden'),time:G.Game.time,warmup:G.warmupStats,debug:G.renderer.debug.checkShaderErrors,perf};
  });
  assert(report.start.same&&report.start.ready&&!report.start.preparing&&!report.start.loading);assert.equal(report.start.time,0);assert.equal(report.start.warmup.texturesRemaining,0);assert.equal(report.start.debug,false);assert(report.start.perf.on);assert.equal(report.start.perf.query,null,'시작 준비의 GPU 쿼리가 플레이로 넘어가면 안 됨');
  releaseFire();
  const started=Date.now();while(Date.now()-started<30000)await p.waitForTimeout(1000);
  report.play=await p.evaluate(()=>{const C=prepCheck;C.active=false;G.Game.update=C.update;G.Input.reset();const r={wallMs:performance.now()-C.started,frames:C.frames,tasks:C.tasks,queries:C.queries,uploads:C.uploads,preparedWhilePlaying:C.finished,packInstalled:!!G.AssetVM.packs.acr?.ready,fire:G.ThrowableVFX.fireState,fallback:G.VM.cur==='sc17'&&!G.AssetVM.owns('sc17')&&G.RealArms.copy.visible,position:G.Player.a.pos.toArray(),gameSeconds:G.Game.time};G.paused=true;return r});
  assert(report.play.frames.length>20&&report.play.wallMs>=30000);assert(report.play.frames.every(f=>!f.paused));assert(report.play.fallback,'지연된 팩 대신 기존 손·총 모델로 플레이');assert.equal(report.play.uploads,0,'이동 중 명시적 텍스처 업로드');assert.equal(report.play.preparedWhilePlaying,false);assert.equal(report.play.packInstalled,false,'이동 중 늦은 팩 설치');assert.deepEqual(report.play.queries,[],'플레이 중 동기 셰이더 진단 조회');
  assert.equal(report.play.fire,'loading','지연 효과 이미지의 플레이 중 교체 금지');
  const maxCpuMs=Math.max(...report.play.frames.map(f=>f.cpuMs));assert(maxCpuMs<2000,'플레이 중 2초 이상 메인 스레드 정지: '+maxCpuMs);report.maxCpuMs=maxCpuMs;
  await p.waitForFunction(()=>G.ThrowableVFX.fireState==='ready');
  report.pause=await p.evaluate(async()=>{await Promise.all([prepCheck.pending,prepCheck.pack]);return{finished:prepCheck.finished,pack:!!G.AssetVM.pack('sc17'),fire:G.ThrowableVFX.fireState,target:G.renderer.getRenderTarget()===null}});assert(report.pause.finished&&report.pause.pack&&report.pause.target);
  report.retry=await p.evaluate(async()=>{
   const textures=G.RenderPrep.textures;G.RenderPrep.textures=async()=>{throw Error('의도한 준비 실패')};let failed;
   try{failed=await G.startGame({...G.UI.opts,mode:'training'})}finally{G.RenderPrep.textures=textures}
   const recovered=await G.startGame({...G.UI.opts,mode:'training'});G.paused=true;
   return{failed,recovered,preparing:G.preparing,loading:!document.getElementById('loading').classList.contains('hidden'),time:G.Game.time};
  });assert.equal(report.retry.failed,false);assert(report.retry.recovered&&!report.retry.preparing&&!report.retry.loading);assert.equal(report.retry.time,0);assert.deepEqual(f.errors,[]);
  report.potato=await p.evaluate(async()=>{
   const set=G.renderer.setRenderTarget;let hdr=0;G.renderer.setRenderTarget=function(t,...args){if(G.preparing&&G.quality==='potato'&&t?.texture.type===THREE.HalfFloatType)hdr++;return set.call(this,t,...args)};
   try{const ready=await G.startGame({...G.UI.opts,quality:'potato',mode:'training'}),rt=G.composerRT();G.paused=true;return{ready,hdrBindings:hdr,hdr:rt?.texture.type===THREE.HalfFloatType,quality:G.quality,samples:G.msaaSamples,composer:!!rt,viewport:G.renderer.getViewport(new THREE.Vector4()).toArray(),scissor:G.renderer.getScissorTest()}}finally{G.renderer.setRenderTarget=set}
  });assert(report.potato.ready&&report.potato.composer&&report.potato.hdr&&!report.potato.scissor,'최저의 기존 HDR 후처리 경로 유지');assert.equal(report.potato.quality,'potato');assert.equal(report.potato.samples,0);assert.deepEqual(report.potato.viewport,[0,0,320,180],'준비 후 전체 화면의 뷰포트를 복구해야 함');
  report.errors=f.errors;fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log('PASS 이동 30초·플레이 중 업로드/진단 조회 0·지연 팩·실패 후 재시작',JSON.stringify({start:report.start,maxCpuMs,pause:report.pause,retry:report.retry}));
 }catch(e){report.failure=e.stack;report.errors=f.errors;fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');throw e}finally{releaseFire();await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
