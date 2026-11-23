// Fixed-camera v78/v79 comparison. Timings are software-renderer diagnostics.
const fs=require('fs'),path=require('path'),cp=require('child_process'),fixture=require('./optimize/browser-fixture.cjs');
const base='b5b7241',out=process.argv[2]||'/tmp/lz-v79-bench';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const changed=cp.execFileSync('git',['diff','--diff-filter=M','--name-only',base],{encoding:'utf8'}).split('\n').filter(p=>p==='index.html'||/^js\/.*\.js$/.test(p));
 const old=Object.fromEntries(changed.map(file=>[file,cp.execFileSync('git',['show',base+':'+file],{encoding:'utf8'})]));
 const result={base,viewport:[960,540],frames:5,renderer:'Chromium, forced ANGLE SwiftShader; not hardware FPS',runs:[]};
 for(const mode of ['v78','v79']){
  const f=await fixture({query:'perf=1',route:async page=>{
   if(mode!=='v78')return;
   await page.route('**/version.txt*',r=>r.fulfill({body:'78'}));
   await page.route(u=>{const p=new URL(u).pathname;return p==='/'||old[p.slice(1)]!==undefined},r=>{const p=new URL(r.request().url()).pathname.slice(1)||'index.html';return r.fulfill({contentType:p.endsWith('.html')?'text/html':'application/javascript',body:old[p]})});
  }});
  try{
   await f.page.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('trainBtn').click();G.onLockChange=()=>{};G.Input.unlock();G.paused=true;G.UI.showPause(false)});
   await f.page.waitForFunction(()=>G.Training.active);
   await f.page.evaluate(()=>{
    G.__apply('low');G.DRS.scale=1;G.DRS.apply(true);
    const a=G.Game.player;a.yaw=0;a.pitch=0;a.cur='rifle';G.Player.ads=0;G.Player.raise=1;
    for(let i=0;i<120;i++)G.Player.updateCamera(1/60);
    for(let i=0;i<60;i++)G.World.update(1/30,G.camera.position,G.camera);
   });
   const run=await f.page.evaluate(mode=>{
    const P=G.Perf,R=G.renderer;
    G.renderNow();P.gpuWait();const times=[];let calls=0,triangles=0;
    for(let i=0;i<5;i++){const start=performance.now();P.frameStart();G.renderNow();P.frameEnd(16,0);P.gpuWait();times.push(performance.now()-start);calls+=P.info.calls/5;triangles+=P.info.tris/5}
    return{mode,medianMs:times.sort((a,b)=>a-b)[2],calls:Math.round(calls),triangles:Math.round(triangles),internal:[G.composerRT().width,G.composerRT().height],output:[R.domElement.width,R.domElement.height],programs:R.info.programs.length,models:Object.keys(G.VM.models).length};
   },mode);
   await f.page.screenshot({path:path.join(out,mode+'-training.png'),style:'#perfOverlay{visibility:hidden}'});
   if(mode==='v79'){
    run.locomotion=await f.page.evaluate(()=>{
     const W=G.World,ground=W.ground,a=new G.Actor({id:888,team:1});Object.assign(a,{state:'ground',onGround:true,groundMat:'wood'});
     const m=new G.CharacterModel({soldier:true});G.Locomotion.tick(a,0);let sum=0;
     try{W.ground=()=>0;for(let i=0;i<1200;i++){a.pos.z-=2/60;G.Locomotion.tick(a,1/60);m.root.position.copy(a.pos);const start=performance.now();m.update(1/60,{speed:2,gait:a.gait,pitch:0,crouch:false,dead:false,prone:false,knocked:false,state:'ground',cur:'fists',onGround:true,groundY:0,distance2:4});sum+=performance.now()-start}}finally{W.ground=ground;m.dispose()}
     return{nearbyCharacterCpuMs:sum/1200,samples:1200,footGroundQueriesPerSecond:24};
    });
   }
   run.errors=f.errors;result.runs.push(run);console.log(run);if(f.errors.length)throw Error(f.errors.join('\n'));
  }finally{await f.close()}
 }
 fs.writeFileSync(path.join(out,'bench.json'),JSON.stringify(result,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
