// v108 강하·HUD를 같은 코드 기준과 카메라로 재현한다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),fixture=require('./optimize/browser-fixture.cjs');
module.exports=async function(base,viewport={width:1280,height:720}){
 const root=path.resolve(__dirname,'..'),cache=new Map();
 const f=await fixture({viewport,initialOptions:{quality:'potato',players:24,loadout:'all'},route:async p=>{
  await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);});
  if(base)await p.route('**/*',r=>{const u=new URL(r.request().url()),file=u.pathname==='/'?'index.html':u.pathname.slice(1);if(u.hostname!=='127.0.0.1'||!(/^(js|css)\/.*\.(js|css)$/.test(file)||['index.html','version.txt'].includes(file)))return r.fallback();if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show',base+':'+file],{cwd:root}));return r.fulfill({body:cache.get(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'text/plain'});});
 }});
 await f.page.evaluate(()=>{G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.startGame({...G.UI.opts,mode:'solo',players:24,quality:'potato',tod:'day',loadout:'all'});G.paused=true;G.UI.showPause(false);G.Input.reset();G.Input.locked=true;G.setRenderResolution('100');G.UI.centerT=0;});return f;
};
