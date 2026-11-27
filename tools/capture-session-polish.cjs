
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// v82와 작업 트리의 훈련장 HUD를 같은 위치·해상도에서 저장한다.
const fs=require('fs'),cp=require('child_process'),path=require('path'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs');
const mode=process.argv[2]||'after',out=process.argv[3]||'/tmp/lz-v83-capture',base='a758fec49ba8265ab02b14da5963a40300bab735',old={};
if(mode==='before')for(const file of['index.html','css/style.css','css/mw.css',...cp.execFileSync('git',['ls-tree','-r','--name-only',base,'js'],{encoding:'utf8'}).trim().split('\n')])old[file]=cp.execFileSync('git',['show',base+':'+file],{encoding:'utf8'});
(async()=>{
 const f=await fixture({viewport:{width:800,height:450},route:async p=>{
  if(mode!=='before')return;await p.route('**/version.txt*',r=>r.fulfill({body:'82'}));
  await p.route(u=>u.hostname==='127.0.0.1'&&(u.pathname==='/'||old[u.pathname.slice(1)]!==undefined),r=>{const file=new URL(r.request().url()).pathname.slice(1)||'index.html';return r.fulfill({body:old[file],contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript'})});
 }});
 try{
  const p=f.page;fs.mkdirSync(out,{recursive:true});await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});await p.click('#trainBtn');await p.evaluate(()=>G.startReady);await p.waitForFunction(()=>(!G.preparing&&G.Training.active));
  await p.evaluate(async()=>{G.paused=true;G.Input.unlock();G.UI.showPause(false);const a=G.Game.player;a.give('ar7');a.cur='rifle';G.VM.set('ar7');await G.AssetVM.request('ar7');a.pos.set(G.World.range.x,G.World.range.y,G.World.range.line+1);a.yaw=0;a.pitch=0;G.Player.raise=1;G.Player.sw=null;for(let i=0;i<120;i++)G.Player.updateCamera(1/60);G.__apply('medium');G.UI.update(0);G.Training.drawStats()});
  await p.addStyleTag({content:'#toast,#centerMsg,#fpsBox {visibility:hidden!important}'});
  const bounds=[];
  for(const[width,height]of[[1280,720],[800,450],[640,360]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(100);await p.evaluate(()=>{G.World.update(1/60,G.camera.position,G.camera);G.UI.update(0);G.UI.drawMini();G.renderNow()});await p.screenshot({path:path.join(out,mode+'-'+width+'.png')});
   bounds.push(await p.evaluate(()=>Object.fromEntries(['vitals','weaponPanel','mapWrap','trainStats','compass','prompt'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return[id,{x:r.x,y:r.y,w:r.width,h:r.height,scroll:e.scrollWidth}]}))));
  }
  if(mode==='after'){
   await p.setViewportSize({width:960,height:720});await p.evaluate(()=>{const R=G.TrainingRecords;R.history=[{weapon:'ar7',distance:25,duration:30,at:Date.now()-86400000,shots:50,hits:30,heads:8,downs:8,ttk:.32},{weapon:'ar7',distance:25,duration:30,at:Date.now(),shots:50,hits:36,heads:12,downs:10,ttk:.28}];R.show()});await p.screenshot({path:path.join(out,'after-records.png')});
  }
  if(mode==='after')for(const b of bounds){for(const [a,c]of[['vitals','weaponPanel'],['weaponPanel','mapWrap'],['trainStats','mapWrap']]){const r=b[a],s=b[c];assert(r.x+r.w<=s.x||s.x+s.w<=r.x||r.y+r.h<=s.y||s.y+s.h<=r.y,a+' / '+c+' 겹침')}}
  fs.writeFileSync(path.join(out,mode+'-bounds.json'),JSON.stringify({bounds,errors:f.errors},null,2)+'\n');if(f.errors.length)throw Error(f.errors.join('\n'));console.log(mode+' 화면 저장 완료: '+out);
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
