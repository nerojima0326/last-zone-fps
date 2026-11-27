// Identical camera/quality against immutable v79. SwiftShader timings are
// diagnostics, not a claim about hardware FPS. Exports actual rendered frames.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const fixture=require('./optimize/browser-fixture.cjs'),base='a427bd89bcc80c9938bd0ab0850e2519b7721168';
const out=process.argv[2]||'/tmp/lz-v80-benchmark';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const changed=cp.execFileSync('git',['diff','--diff-filter=M','--name-only',base],{encoding:'utf8'}).trim().split('\n').filter(p=>p==='index.html'||/^js\/.*\.js$/.test(p));
 const old=Object.fromEntries(changed.map(p=>[p,cp.execFileSync('git',['show',base+':'+p],{encoding:'utf8'})]));
 const result={base,viewport:[960,540],renderer:'Chromium ANGLE SwiftShader; software-renderer diagnostics',runs:[]};let camera=null;
 for(const mode of ['v80','v79']){
  const f=await fixture({query:'perf=1',route:async page=>{
   if(mode==='v80')return;
   await page.route('**/version.txt*',r=>r.fulfill({body:'79'}));
   await page.route(u=>{const p=new URL(u).pathname;return p==='/'||old[p.slice(1)]!==undefined},r=>{const p=new URL(r.request().url()).pathname.slice(1)||'index.html';return r.fulfill({contentType:p.endsWith('.html')?'text/html':'application/javascript',body:old[p]})});
  }});
  try{
   await f.page.evaluate(()=>{window.requestAnimationFrame=()=>0;G.onLockChange=()=>{};G.Input.unlock()});await f.page.waitForTimeout(80);
   await f.page.click('#trainBtn');await f.page.waitForFunction(()=>(!G.preparing&&G.Training.active));
   if(!camera)camera=await f.page.evaluate(()=>{
    const W=G.World,R=G.RoomLighting,T=THREE;
    for(const w of W.windows){
     if(w.normal.dot(W.sunDir)<.2)continue;R.refresh(w.position);if(!R.stats.patches)continue;
     const tangent=new T.Vector3(w.normal.z,0,-w.normal.x),position=w.position.clone().addScaledVector(w.normal,-2.2).addScaledVector(tangent,.7);
     const look=w.position.clone().addScaledVector(w.normal,-.3);look.y-=.55;
     if(!G.SceneSense.sample(position,true).covered)continue;
     return{position:position.toArray(),look:look.toArray()};
    }throw Error('No suitable real interior');
   });
   await f.page.evaluate(camera=>{
    G.Input.unlock();G.paused=true;G.UI.showPause(false);G.VM.set(null);G.__apply('low');G.DRS.scale=1;G.DRS.apply(true);
    G.camera.position.fromArray(camera.position);G.camera.lookAt(...camera.look);G.camera.updateMatrixWorld(true);
    for(let i=0;i<90;i++){G.World.update(1/30,G.camera.position,G.camera);G.RoomLighting?.update(1/30,G.camera.position)}
    G.renderer.shadowMap.needsUpdate=true;G.renderNow();G.Perf.gpuWait();
   },camera);
   const run=await f.page.evaluate(mode=>{
    const P=G.Perf,times=[];let calls=0,triangles=0;
    for(let i=0;i<7;i++){P.frameStart();const start=performance.now();G.renderNow();P.frameEnd(16,0);P.gpuWait();times.push(performance.now()-start);calls+=P.info.calls/7;triangles+=P.info.tris/7}
    const R=G.renderer;
    return{mode,medianMs:times.sort((a,b)=>a-b)[3],calls:Math.round(calls),triangles:Math.round(triangles),geometries:R.info.memory.geometries,textures:R.info.memory.textures,programs:R.info.programs.length,exposure:R.toneMappingExposure,patches:G.RoomLighting?.stats.patches||0,staticAO:G.StaticAO.applied};
   },mode);
   const png=await f.page.evaluate(()=>{G.renderNow();return G.renderer.domElement.toDataURL('image/png').split(',')[1]});fs.writeFileSync(path.join(out,mode+'-interior.png'),Buffer.from(png,'base64'));
   run.errors=f.errors;result.runs.push(run);console.log(run);if(f.errors.length)throw Error(f.errors.join('\n'));
  }finally{await f.close()}
 }
 result.camera=camera;fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify(result,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
