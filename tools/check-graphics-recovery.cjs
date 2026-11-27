// v108 부팅·셰이더 준비 중 실제 연결 손실 뒤 중복 초기화 없이 복구한다.
require('./artifact-paths.cjs');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.env.REPORT||path.join(os.tmpdir(),'last-zone-graphics-recovery.json'),report={};
function save(){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
(async()=>{
 const f=await fixture({shaderDebug:false,liveDRS:true,viewport:{width:320,height:180},route:async p=>{
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
      C.events.push({event:'손실',booted:G.GraphicsRecovery.booted,environment:G.World.envRT?.texture.uuid,text:document.getElementById('loadText').textContent});
      setTimeout(()=>ext.restoreContext(),250);
     });
     this.addEventListener('webglcontextrestored',()=>C.events.push({event:'복구',booted:G.GraphicsRecovery.booted,text:document.getElementById('loadText').textContent}));
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
  assert.deepEqual(f.errors,[]);report.errors=f.errors;save();console.log('PASS 초기 로딩·셰이더 준비 중 2회 연결 손실·메뉴 복구·초기화 각 1회·지연 자산 보존');
 }catch(e){report.failure=e.stack;report.errors=f.errors;save();throw e}finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
