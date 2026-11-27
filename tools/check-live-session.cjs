
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// v107 일시정지·고정 시간 전진 없이 실제 프레임으로 훈련과 수송기→착지를 검사한다.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs');
const output=path.resolve(process.env.REPORT||path.join(os.tmpdir(),'last-zone-live-session.json')),report={renderer:'SwiftShader 소프트웨어 렌더러, 실제 휴대폰 FPS가 아님',sessions:[]};
const seconds=Math.max(30,Number(process.env.LIVE_SECONDS)||30),quality=process.env.LIVE_QUALITY||'potato',viewport={width:Number(process.env.LIVE_WIDTH)||320,height:Number(process.env.LIVE_HEIGHT)||180};
function rss(pid){try{const s=fs.readFileSync('/proc/'+pid+'/status','utf8');return Number(s.match(/^VmRSS:\s+(\d+)/m)?.[1]||0)*1024;}catch(e){return null;}}
const save=()=>{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');};
(async()=>{
 for(const mode of ['training','match']){
  const f=await fixture({shaderDebug:false,liveDRS:true,viewport,browserArgs:['--enable-precise-memory-info'],initialOptions:{quality,players:40,loadout:'all',renderResolution:'auto'},route:async page=>{
   await page.addInitScript(()=>{
    let seed=107;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    window.liveRun={active:false,frames:[],tasks:[],states:[],drs:0,simulation:0};
    new PerformanceObserver(list=>{if(liveRun.active)for(const e of list.getEntries())if(e.startTime>=liveRun.started)liveRun.tasks.push({at:e.startTime-liveRun.started,ms:e.duration});}).observe({type:'longtask',buffered:true});
    const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>raf(now=>{
     const live=window.liveRun,active=live.active&&fn.name==='frame'&&!G.preparing,start=performance.now();fn(now);
     if(active){live.frames.push({at:performance.now()-live.started,ms:live.last?now-live.last:null,cpuMs:performance.now()-start,paused:G.paused,state:G.Game.player?.state,scale:G.DRS.scale});live.last=now;}
    });
   });
  }}),p=f.page,session={mode,quality,viewport,players:mode==='match'?40:1,samples:[]};report.sessions.push(session);
  const cdp=await p.context().newCDPSession(p),system=await p.context().browser().newBrowserCDPSession();
  async function memory(){const [heap,processes]=await Promise.all([cdp.send('Runtime.getHeapUsage'),system.send('SystemInfo.getProcessInfo')]);const renderers=processes.processInfo.filter(r=>r.type==='renderer').map(r=>({pid:r.id,rss:rss(r.id)}));return{heap:heap.usedSize,heapTotal:heap.totalSize,backing:heap.backingStorageSize||0,rendererRss:renderers.reduce((n,r)=>n+(r.rss||0),0),renderers};}
  try{
   session.before=await memory();
   session.start=await p.evaluate(async ({mode,quality})=>{
    const L=liveRun;L.active=true;L.started=performance.now();L.mode=mode;G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{G.Input.locked=true;};document.activeElement?.blur();
    const setup=G.Game.start;G.Game.start=function(opts){const at=performance.now(),heapBefore=performance.memory?.usedJSHeapSize;try{return setup.call(this,opts);}finally{L.setupStats={ms:performance.now()-at,heapBefore,heapAfter:performance.memory?.usedJSHeapSize};}};
    const drs=G.DRS.frame;G.DRS.frame=function(...args){L.drs++;return drs.apply(this,args);};
    const update=G.Game.update,events=L.actions=new Set(),key=(code,down)=>dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code}));
    G.Game.update=function(dt){
     L.simulation+=dt;const a=this.player,t=this.time;
     if(mode==='match'&&a?.state==='plane'&&this.planeCanJump()){key('KeyF',true);events.add('jump');}
     if(mode==='training'){
      if(t>1&&!events.has('walk')){key('KeyW',true);events.add('walk');}
      if(t>4&&!events.has('stop')){key('KeyW',false);dispatchEvent(new MouseEvent('mousedown',{button:0}));events.add('stop');}
      if(t>5&&!events.has('reload')){dispatchEvent(new MouseEvent('mouseup',{button:0}));key('KeyR',true);events.add('reload');}
     }
     update.call(this,dt);key('KeyF',false);key('KeyR',false);
     const state=this.player?.state;if(state!==L.states.at(-1)?.state)L.states.push({state,gameTime:this.time,wallMs:performance.now()-L.started});
     if(mode==='match'&&state==='ground'){key('KeyW',false);key('ShiftLeft',false);}
    };
    const start=performance.now();const ready=await G.startGame({...G.UI.opts,mode:mode==='training'?'training':undefined,quality,players:40,renderResolution:'auto'});if(!ready)throw Error('판 시작 준비 실패');const callMs=performance.now()-start;L.started=performance.now();L.tasks=[];
    if(mode==='match'){key('KeyW',true);key('ShiftLeft',true);}G.UI.showPause(false);
    return{callMs,setup:L.setupStats,warmup:G.warmupStats,paused:G.paused,resolution:G.renderResolutionInfo(),viewmodels:Object.keys(G.VM.models).length};
   },{mode,quality});
   session.afterStart=await memory();const deadline=Date.now()+240000;let progress;
   do{
    await p.waitForTimeout(1000);const sample=await memory();progress=await p.evaluate(()=>({wall:performance.now()-liveRun.started,simulation:liveRun.simulation,state:G.Game.player.state,states:liveRun.states,playing:G.Game.state==='playing',paused:G.paused,frames:liveRun.frames.length}));session.samples.push({...sample,wallMs:progress.wall,simulation:progress.simulation,frames:progress.frames,state:progress.state});save();
    assert(progress.playing&&!progress.paused,'실제 플레이가 중단됨: '+JSON.stringify(progress));
    if(progress.wall>=seconds*1000&&(mode==='training'?progress.simulation>=8:progress.states.some(s=>s.state==='ground')))break;
   }while(Date.now()<deadline);
   session.live=await p.evaluate(()=>{liveRun.active=false;const gl=G.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{wallMs:performance.now()-liveRun.started,simulation:liveRun.simulation,drs:liveRun.drs,states:liveRun.states,actions:[...liveRun.actions],frames:liveRun.frames,tasks:liveRun.tasks,remainingTextures:G.prewarmTex?.length,resolution:G.renderResolutionInfo(),gpu:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};});
   const frames=session.live.frames.filter(r=>r.ms&&r.at>5000),ms=frames.map(r=>r.ms).sort((a,b)=>a-b),percent=p=>ms[Math.min(ms.length-1,Math.floor(ms.length*p))];
   const memoryRows=[session.before,session.afterStart,...session.samples];
   session.summary={frames:frames.length,fps:1000/(ms.reduce((a,b)=>a+b,0)/ms.length),p50Ms:percent(.5),p95Ms:percent(.95),p99Ms:percent(.99),maxMs:Math.max(...ms),firstFrameMs:session.live.frames[0]?.at,peakHeap:Math.max(...memoryRows.map(r=>r.heap)),peakBacking:Math.max(...memoryRows.map(r=>r.backing)),peakJsWithBacking:Math.max(...memoryRows.map(r=>r.heap+r.backing)),peakMemoryApi:Math.max(session.start.setup?.heapBefore||0,session.start.setup?.heapAfter||0,session.start.warmup?.heapBefore||0,session.start.warmup?.heapAfter||0),peakRendererRss:Math.max(...memoryRows.map(r=>r.rendererRss)),longestTaskMs:Math.max(0,...session.live.tasks.map(r=>r.ms))};
   session.errors=f.errors;save();assert.deepEqual(f.errors,[]);assert(session.live.wallMs>=seconds*1000,'30초 실제 진행 부족');assert(session.live.frames.every(r=>!r.paused),'일시정지 프레임');assert(session.live.drs>=session.live.frames.length-2,'DRS 경로 누락');assert(session.live.frames.length>30,'실제 렌더 프레임 부족');
   if(mode==='training')for(const action of ['walk','stop','reload'])assert(session.live.actions.includes(action),'훈련 입력 미실행: '+action);
   if(mode==='match')for(const state of ['plane','freefall','chute','ground'])assert(session.live.states.some(r=>r.state===state),'경기 상태 미도달: '+state);
   console.log('PASS 실제 30초 이상 '+mode,JSON.stringify({start:session.start,summary:session.summary,states:session.live.states}));
  }catch(e){session.failure=e.stack;save();throw e;}finally{await f.close();}
 }
 console.log('PASS 훈련장·40명 경기의 실제 프레임·착지·DRS·메모리 기록: '+output);
})().catch(e=>{console.error(e);process.exitCode=1});
