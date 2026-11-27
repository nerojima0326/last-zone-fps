// v82/작업 트리의 입자 재사용과 늦게 로딩한 총기 첫 렌더를 같은 브라우저에서 비교한다.
const fs=require('fs'),cp=require('child_process'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
const mode=process.argv[2]||'after',out=process.argv[3]||'/tmp/lz-v83-bench',base='a758fec49ba8265ab02b14da5963a40300bab735';
const old={};if(mode==='before')for(const file of ['index.html',...cp.execFileSync('git',['ls-tree','-r','--name-only',base,'js'],{encoding:'utf8'}).trim().split('\n')])old[file]=cp.execFileSync('git',['show',base+':'+file],{encoding:'utf8'});
(async()=>{
 const f=await fixture({query:'perf=1',viewport:{width:480,height:270},route:async p=>{
  if(mode!=='before')return;await p.route('**/version.txt*',r=>r.fulfill({body:'82'}));
  await p.route(u=>u.hostname==='127.0.0.1'&&(u.pathname==='/'||old[u.pathname.slice(1)]!==undefined),r=>{const file=new URL(r.request().url()).pathname.slice(1)||'index.html';return r.fulfill({body:old[file],contentType:file.endsWith('.html')?'text/html':'application/javascript'})});
 }});
 try{
  const p=f.page;await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});await p.waitForTimeout(80);await p.click('#trainBtn');await p.evaluate(()=>G.startReady);await p.waitForFunction(()=>(!G.preparing&&G.Training.active));
  const report=await p.evaluate(async()=>{
   G.paused=true;G.Input.unlock();G.UI.showPause(false);G.VM.set(null);
   await Promise.all(Object.values(G.Game.player.weapons).filter(Boolean).map(w=>G.AssetVM.request(w.id)));
   G.renderNow();G.Perf.gpuWait();
   const particles=[],template={x:0,y:10,z:0,life:.01};
   for(const kind of ['add','norm']){
    const fx=G.FX[kind],seen=new Set(),start=performance.now();fx.clear();
    for(let wave=0;wave<100;wave++){for(let i=0;i<64;i++)seen.add(fx.spawn(template));fx.update(.02)}
    particles.push({kind,births:6400,objects:seen.size,ms:performance.now()-start,remaining:fx.list.length});
   }
   const programs=()=>G.renderer.info.programs.length;
   const before=programs();await G.AssetVM.request('sc17');const loaded=programs();
   G.VM.set('sc17');G.Player.ads=0;G.Player.reload=null;G.VM.update(1/60,{ads:0,raise:1,phase:0,moving:0,landDip:0,lookDX:0,lookDY:0,sprint:false,reload:null});
   const times=[];for(let i=0;i<3;i++){G.Perf.gpuWait();const start=performance.now();G.renderNow();G.Perf.gpuWait();times.push(performance.now()-start)}
   return{particles,lateWeapon:{before,loaded,rendered:programs(),firstMs:times[0],followupMs:times.slice(1)},gpu:G.gpuName||'SwiftShader'};
  });report.mode=mode;report.base=base;report.errors=f.errors;fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(f.errors.length)throw Error(f.errors.join('\n'));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
