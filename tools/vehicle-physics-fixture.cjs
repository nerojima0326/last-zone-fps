// 실제 차량·지형 충돌을 일정한 시간 간격으로 검사한다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),fixture=require('./optimize/browser-fixture.cjs');
module.exports=async function vehicleFixture(base,options={}){
 const cache=new Map(),root=path.resolve(__dirname,'..');
 const f=await fixture({viewport:options.viewport||{width:960,height:540},contextOptions:options.contextOptions,initialOptions:{quality:'low'},route:async p=>{
  await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);});
  if(options.fallback)await p.route('**/assets/models/vehicles/*.glb*',r=>r.fulfill({status:404,body:''}));
  if(base)await p.route('**/*',r=>{const u=new URL(r.request().url()),file=u.pathname==='/'?'index.html':u.pathname.slice(1);if(u.hostname!=='127.0.0.1'||!(file==='index.html'||file==='version.txt'||/^js\/.*\.js$/.test(file)))return r.fallback();if(!cache.has(file))try{cache.set(file,cp.execFileSync('git',['show',base+':'+file],{cwd:root,stdio:['ignore','pipe','ignore']}))}catch(e){cache.set(file,null)}return cache.get(file)?r.fulfill({body:cache.get(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'text/plain'}):r.fallback();});
 }});
 await f.page.evaluate(()=>{G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.startGame({...G.UI.opts,mode:'training',quality:'low'});G.paused=true;G.UI.showPause(false);G.Input.locked=true;});
 return f;
};
