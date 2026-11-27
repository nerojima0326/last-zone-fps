// v108 부팅·셰이더 준비 중 실제 연결 손실 뒤 중복 초기화 없이 복구한다.
require('./artifact-paths.cjs');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.env.REPORT||path.join(os.tmpdir(),'last-zone-graphics-recovery.json'),report={};
function save(){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
(async()=>{
 const f=await fixture({shaderDebug:false,liveDRS:true,viewport:{width:320,height:180},initialOptions:{quality:process.env.RECOVERY_QUALITY||'potato'},...(process.env.RECOVERY_MOBILE?{contextOptions:{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}}:{}),route:async p=>{
  p.on('pageerror',e=>console.log(e.stack));
  if(process.env.RECOVERY_DEBUG) p.on('console',m=>{if(['warning','error'].includes(m.type()))console.log(m.type(),m.text())});
  await p.addInitScript(()=>{
   const get=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(...args){
    const gl=get.apply(this,args);
    if(gl&&/^webgl/.test(args[0])&&!window.recoveryCheck){
     const C=window.recoveryCheck={events:[],worldStarts:0,inputStarts:0},ext=gl.getExtension('WEBGL_lose_context');
     if(!ext)throw Error('컨텍스트 손실 검사 확장 없음');
     const world=G.World.init,input=G.Input.init,link=gl.linkProgram;
     G.World.init=function(...a){C.worldStarts++;return world.apply(this,a)};
     G.Input.init=function(...a){C.inputStarts++;return input.apply(this,a)};
     gl.linkProgram=function(...a){const result=link.apply(this,a);if(G.quality&&!G.GraphicsRecovery.booted&&C.events.length&&!C.shaderLoss){C.shaderLoss=true;setTimeout(()=>ext.loseContext(),0)}return result};
     this.addEventListener('webglcontextlost',()=>{
      if(G.GraphicsRecovery.booted)return;
      C.events.push({event:'손실',booted:G.GraphicsRecovery.booted,environment:G.World.envRT?.texture.uuid,text:document.getElementById('loadText').textContent});
      setTimeout(()=>ext.restoreContext(),250);
     });
     this.addEventListener('webglcontextrestored',()=>{if(!G.GraphicsRecovery.booted)C.events.push({event:'복구',booted:false,text:document.getElementById('loadText').textContent})});
     setTimeout(()=>ext.loseContext(),250);
    }
    return gl;
   };
  });
 }}),p=f.page;
 try{
  report.boot=await p.evaluate(()=>({events:recoveryCheck.events,worldStarts:recoveryCheck.worldStarts,inputStarts:recoveryCheck.inputStarts,shaderLoss:recoveryCheck.shaderLoss,environment:G.World.envRT.texture.uuid,booted:G.GraphicsRecovery.booted,recoveries:G.GraphicsRecovery.recoveries,lost:G.GraphicsRecovery.lost,loading:!document.getElementById('loading').classList.contains('hidden'),menu:!document.getElementById('menu').classList.contains('hidden'),error:G.renderer.getContext().getError()}));
  const r=report.boot;assert(r.booted&&!r.lost&&!r.loading&&r.menu);assert(r.shaderLoss);assert.equal(r.recoveries,2);assert.equal(r.events.filter(e=>e.event==='손실').length,2);assert.equal(r.worldStarts,1,'월드 초기화 중복');assert.equal(r.inputStarts,1,'입력 이벤트 초기화 중복');assert.equal(r.error,0);
  assert.notEqual(r.environment,r.events.filter(e=>e.event==='손실').at(-1).environment,'복구 전 환경맵 재사용');
  await p.waitForFunction(()=>!G.RenderPrep.running&&!G.RenderPrep.jobs.length,null,{timeout:90000});
  report.queue=await p.evaluate(()=>({fire:G.ThrowableVFX.fireState,remaining:G.RenderPrep.jobs.length}));assert.equal(report.queue.fire,'ready','복구 때문에 지연 효과 자산을 영구 실패 처리하면 안 됨');
  await p.evaluate(()=>{
   const C=window.matchRecovery={events:[],starts:0,losses:0},ext=G.renderer.getContext().getExtension('WEBGL_lose_context'),start=G.Game.start;
   if(!document.documentElement.classList.contains('mobile')){
    G.Input.lock=function(){this.locked=true;G.onLockChange?.(true)};
    G.Input.unlock=function(){this.locked=false;this.reset();G.onLockChange?.(false)};
   }
   G.Game.start=function(...args){C.starts++;return start.apply(this,args)};
   const lost=()=>{
    G.resume();C.events.push({event:'손실',preparing:G.preparing,paused:G.paused,time:G.Game.time,same:G.startGame({...G.UI.opts,mode:'training'})===C.pending});
    C.asset||=G.AssetVM.request('sc17');setTimeout(()=>ext.restoreContext(),250);
   },restored=()=>C.events.push({event:'복구',preparing:G.preparing,paused:G.paused,time:G.Game.time,loading:!document.getElementById('loading').classList.contains('hidden'),pause:!document.getElementById('pause').classList.contains('hidden')});
   G.renderer.domElement.addEventListener('webglcontextlost',lost);G.renderer.domElement.addEventListener('webglcontextrestored',restored);
   const interval=setInterval(()=>{if(G.preparing&&G.Game.state==='playing'&&!G.GraphicsRecovery.lost&&C.losses<2){C.losses++;ext.loseContext()}},30);
   C.pending=G.startGame({...G.UI.opts,mode:'training'});
   C.pending.then(ready=>{C.ready=ready;C.done=true}).finally(()=>{clearInterval(interval);G.Game.start=start;G.renderer.domElement.removeEventListener('webglcontextlost',lost);G.renderer.domElement.removeEventListener('webglcontextrestored',restored)});
  });
  await p.waitForFunction(()=>matchRecovery.done,null,{timeout:120000,polling:50});
  report.match=await p.evaluate(async()=>{
   const C=matchRecovery;await C.asset;
   return{ready:C.ready,events:C.events,starts:C.starts,losses:C.losses,preparing:G.preparing,paused:G.paused,time:G.Game.time,warmup:G.warmupStats,loading:!document.getElementById('loading').classList.contains('hidden'),pause:!document.getElementById('pause').classList.contains('hidden'),weapon:G.VM.cur,asset:!!G.AssetVM.pack('sc17'),assetFailed:!!G.AssetVM.packs.acr?.failed,mobile:document.documentElement.classList.contains('mobile'),error:G.renderer.getContext().getError()};
  });
  const m=report.match;assert(m.ready&&!m.preparing&&m.paused&&!m.loading&&m.pause);assert.equal(m.starts,1,'복구 중 경기 초기화 중복');assert.equal(m.losses,2);assert.equal(m.time,0);assert.equal(m.warmup.texturesRemaining,0);assert.equal(m.weapon,'ar7');assert(m.asset&&!m.assetFailed,'손실 중 받은 총기 팩 보존');assert.equal(m.error,0);if(process.env.RECOVERY_MOBILE)assert(m.mobile);
  for(const e of m.events){assert(e.preparing&&e.paused);assert.equal(e.time,0);if(e.event==='손실')assert(e.same,'손실 중에도 같은 시작 Promise 유지');else assert(e.loading&&!e.pause,'준비 완료 전 재개 화면 금지');}
  await p.evaluate(()=>G.resume());await p.waitForFunction(()=>G.Game.time>.1,null,{timeout:30000});
  report.resume=await p.evaluate(()=>{G.paused=true;return{time:G.Game.time,weapon:G.VM.cur,error:G.renderer.getContext().getError()}});assert.equal(report.resume.error,0);
  report.reentry=await p.evaluate(async()=>{G.toMenu();const ready=await G.startGame({...G.UI.opts,mode:'training'});G.paused=true;return{ready,preparing:G.preparing,loading:!document.getElementById('loading').classList.contains('hidden'),error:G.renderer.getContext().getError()}});assert(report.reentry.ready&&!report.reentry.preparing&&!report.reentry.loading);assert.equal(report.reentry.error,0,'복구 후 퇴장·재입장 때 이전 GPU 객체 사용');
  report.failurePropagation=await p.evaluate(async()=>{let calls=0;try{await G.GraphicsRecovery.prepare(()=>{calls++;throw Error('일반 준비 오류 검사')})}catch(e){return{calls,message:e.message}}});assert.deepEqual(report.failurePropagation,{calls:1,message:'일반 준비 오류 검사'});
  assert.deepEqual(f.errors,[]);report.errors=f.errors;save();console.log('PASS 부팅 2회·판 준비 2회 연결 손실·중복 초기화 없음·준비 완료 전 재개 차단·지연 자산·재개');
 }catch(e){report.failure=e.stack;report.errors=f.errors;save();throw e}finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
