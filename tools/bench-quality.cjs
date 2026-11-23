// Same-scene v78 comparisons, not a hardware FPS prediction. Software GPU in CI.
const fs=require('fs'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
(async()=>{
 const f=await fixture({query:'perf=1'}),out=process.argv[2]||'/tmp/lz-v78-quality-bench';fs.mkdirSync(out,{recursive:true});
 try{
  const result={gpu:await f.page.evaluate(()=>G.gpuName||G.renderer.getContext().getParameter(G.renderer.getContext().RENDERER)),weapons:[]};
  result.weapons=await f.page.evaluate(()=>{
   window.requestAnimationFrame=()=>0;const R=G.renderer,P=G.Perf;
   const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xdfeaff,0x555555,3));
   const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(1,2,1);scene.add(sun);
   const cam=new THREE.PerspectiveCamera(55,1,.05,100);cam.position.set(0,0,6);cam.lookAt(0,0,0);cam.updateMatrixWorld(true);
   const rt=new THREE.WebGLRenderTarget(512,512);const rows=[];
   for(const full of [false,true]){
    const guns=G.GUN_IDS.map((id,i)=>{const m=G.Guns.tpModel(id,full);m.position.set((i%6-2.5)*.85,(2-Math.floor(i/6))*.55,0);scene.add(m);m.autoUpdate=false;return m});
    for(const level of [0,1,2]){
     for(const gun of guns)for(let i=0;i<gun.levels.length;i++)gun.levels[i].object.visible=i===level;
     R.setRenderTarget(rt);R.render(scene,cam);P.gpuWait();
     const times=[];let calls=0,tris=0;
     for(let i=0;i<5;i++){
      R.info.reset();const start=performance.now();R.render(scene,cam);P.gpuWait();times.push(performance.now()-start);calls+=R.info.render.calls/5;tris+=R.info.render.triangles/5;
     }
     rows.push({use:full?'loot':'held',level,calls:Math.round(calls),triangles:Math.round(tris),medianMs:times.sort((a,b)=>a-b)[2]});
    }
    for(const gun of guns)scene.remove(gun);
   }
   rt.dispose();R.setRenderTarget(null);return rows;
  });
  await f.page.evaluate(()=>{document.getElementById('trainBtn').click();G.onLockChange=()=>{};G.Input.unlock();G.paused=true;G.UI.showPause(false)});
  await f.page.waitForFunction(()=>G.Training.active);
  await f.page.evaluate(()=>{G.__apply('low');G.DRS.scale=.55;G.DRS.apply(true);G.Player.raise=1;for(let i=0;i<120;i++)G.Player.updateCamera(1/60)});
  result.training=[];
  for(const native of [false,true]){
   const row=await f.page.evaluate(native=>{
    G.renderFeatures.nativeViewmodel=native;const P=G.Perf;G.renderNow();P.gpuWait();const times=[];
    for(let i=0;i<5;i++){const start=performance.now();P.frameStart();G.renderNow();P.frameEnd(16,0);P.gpuWait();times.push(performance.now()-start)}
    return {native,medianMs:times.sort((a,b)=>a-b)[2],info:{...P.info},internal:[G.composerRT().width,G.composerRT().height],nativeSize:[G.viewmodelRT().width,G.viewmodelRT().height]};
   },native);result.training.push(row);
   await f.page.screenshot({path:path.join(out,native?'native.png':'shared.png')});
  }
  result.errors=f.errors;fs.writeFileSync(path.join(out,'bench.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
  if(f.errors.length)throw Error(f.errors.join('\n'));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
