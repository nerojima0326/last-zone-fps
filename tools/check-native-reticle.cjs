
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 장면 해상도를 바꿔도 HUD·2D 스코프·1인칭 조준경의 네이티브 픽셀을 유지한다.
const assert=require('assert'),fs=require('fs'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.env.REPORT||'/tmp/lz-v81-reticle.json';
(async()=>{
 const f=await fixture({deviceScaleFactor:1.5});
 try{
  const p=f.page;
  await p.evaluate(()=>{
   const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);
   G.onLockChange=()=>{};G.Input.unlock();
  });await p.waitForTimeout(100);await p.click('#trainBtn');await p.evaluate(()=>G.startReady);await p.waitForFunction(()=>(!G.preparing&&G.Training.active));
  const result=await p.evaluate(()=>{
   G.paused=true;G.Input.unlock();G.UI.showPause(false);G.__apply('low');G.setRenderResolution('67');
   const inst=G.Game.player.weapons.rifle;G.Game.player.cur='rifle';inst.scope='reddot';G.VM.set(inst.id);
   Object.assign(G.Player,{ads:1,raise:1,reload:null,sw:null});
   for(let i=0;i<120;i++)G.Player.updateCamera(1/60);
   G.UI.update(1/60);
   G.renderNow();G.UI.fps(60,G.DRS.scale,1000/60);
   const r=G.renderer,c=document.getElementById('crosshair'),scope=document.getElementById('scopeOverlay'),vm=G.viewmodelRT();
   const rows=[];
   for(const dpr of [1,1.25,1.5,2]){
    Object.defineProperty(window,'devicePixelRatio',{value:dpr,configurable:true});
    for(const type of ['x2','x4','x8']){
     G.UI.drawScope(1,type,G.Player);rows.push({dpr,type,size:[scope.width,scope.height],css:[innerWidth,innerHeight],transform:scope.getContext('2d').getTransform().a});
    }
   }
   Object.defineProperty(window,'devicePixelRatio',{value:1.5,configurable:true});G.UI.drawScope(0,null,G.Player);
   return{rows,output:[r.domElement.width,r.domElement.height],world:[G.composerRT().width,G.composerRT().height],viewmodel:[vm.width,vm.height],crosshair:c.tagName,fps:document.getElementById('fpsBox').textContent};
  });
  for(const row of result.rows){assert.deepEqual(row.size,row.css.map(v=>Math.floor(v*row.dpr)));assert.equal(row.transform,row.dpr)}
  assert.deepEqual(result.viewmodel,result.output);assert(result.world[0]<result.output[0]);assert.equal(result.crosshair,'DIV');
  await p.screenshot({path:path.join(path.dirname(out),'v81-reddot-native.png'),style:'#fpsBox{visibility:hidden!important}'});
  await p.evaluate(()=>{
   G.Game.player.weapons.rifle.scope='x4';G.Player.scopeView=1;
   for(let i=0;i<120;i++)G.Player.updateCamera(1/60);
   G.UI.update(1/60);G.renderNow();G.UI.drawScope(1,'x4',G.Player);
  });
  await p.screenshot({path:path.join(path.dirname(out),'v81-scope-native.png'),style:'#fpsBox{visibility:hidden!important}'});
  assert.deepEqual(f.errors,[]);fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log('PASS 네이티브 HUD·레티클',JSON.stringify(result));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
