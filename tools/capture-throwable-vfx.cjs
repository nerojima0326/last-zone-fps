
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 같은 사격장·카메라·시각에서 기준 커밋과 현재 투척 효과를 비교한다.
const fs=require('fs'),cp=require('child_process'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
const mode=process.argv[2]||'after',out=process.argv[3]||'/tmp/lz-v84-vfx',close=process.env.VFX_CLOSE==='1';
const base=process.env.VFX_BASE||'83563f6eecc062ca3b4f07196f51840a19434bf2',old={},views=(process.env.VFX_VIEWS||'standard').split(',');
if(mode==='before')for(const file of['index.html',...cp.execFileSync('git',['ls-tree','-r','--name-only',base,'js'],{encoding:'utf8'}).trim().split('\n')])old[file]=cp.execFileSync('git',['show',base+':'+file],{encoding:'utf8'});
(async()=>{
 const f=await fixture({query:'perf=1',viewport:{width:800,height:450},route:async p=>{
  if(mode!=='before')return;
  await p.route('**/version.txt*',r=>r.fulfill({body:cp.execFileSync('git',['show',base+':version.txt'],{encoding:'utf8'})}));
  await p.route('**/assets/audio/weapons/manifest.json*',r=>r.fulfill({body:cp.execFileSync('git',['show',base+':assets/audio/weapons/manifest.json'],{encoding:'utf8'}),contentType:'application/json'}));
  await p.route(u=>u.hostname==='127.0.0.1'&&(u.pathname==='/'||old[u.pathname.slice(1)]!==undefined),r=>{
   const name=new URL(r.request().url()).pathname.slice(1)||'index.html';return r.fulfill({body:old[name],contentType:name.endsWith('.html')?'text/html':'application/javascript'});
  });
 }});
 try{
  const p=f.page;fs.mkdirSync(out,{recursive:true});
  if(mode!=='before')await p.waitForFunction(()=>!G.ThrowableVFX?.fireState||G.ThrowableVFX.fireState!=='loading');
  await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});
  await p.waitForTimeout(60);await p.click('#trainBtn');await p.waitForFunction(()=>G.Training.active);
  await p.evaluate(()=>{
   G.paused=true;G.Input.unlock();G.UI.showPause(false);G.__apply('medium');G.setRenderResolution('100');G.VM.set(null);
   G.VM.update(0,{hideVM:true,ads:0,raise:1,reload:null,moving:0,landDip:0,phase:0});const r=G.World.range;window.__blastPoint=new THREE.Vector3(r.x+23,r.y+.12,r.line-17);
  });
  await p.addStyleTag({content:'#hud,#toast,#fpsBox,#perfOverlay{visibility:hidden!important}'});const rows=[];
  const camera=async view=>p.evaluate(({view,close})=>{
   const offsets={standard:[4.8,3.2,8.2],near:[1.8,1.3,3.8],far:[12,5.5,20]},v=close?[1.3,.7,2.5]:offsets[view]||offsets.standard,p=__blastPoint;
   G.camera.position.copy(p).add(new THREE.Vector3(...v));G.camera.lookAt(p.x,p.y+(close?.2:.7),p.z);G.camera.updateMatrixWorld(true);G.World.update(0,G.camera.position,G.camera);G.renderNow();
  },{view,close});
  const blast=async kind=>p.evaluate(kind=>{
   G.Throwables.reset();G.FX.reset();Math.random=G.U.mulberry32(840225);G.Throwables.detonate({kind,pos:__blastPoint.clone(),owner:G.Game.player,team:0,contactNormal:new THREE.Vector3(0,1,0)});window.__blastElapsed=0;
  },kind);
  const advance=async(time,measure=true)=>p.evaluate(({time,measure})=>{
   while(__blastElapsed<time-1e-8){const dt=Math.min(1/60,time-__blastElapsed);G.Throwables.update(dt);G.FX.update(dt);__blastElapsed+=dt}
   const r=G.renderer,auto=r.info.autoReset;r.info.autoReset=false;r.info.reset();if(measure)G.Perf.gpuWait();const start=performance.now();G.renderNow();if(measure)G.Perf.gpuWait();
   const row={time,ms:performance.now()-start,calls:r.info.render.calls,triangles:r.info.render.triangles,legacySprites:G.FX.add.list.length+G.FX.norm.list.length,sprites:G.ThrowableVFX?.sprites.length||0,chunks:G.ThrowableVFX?.shardMesh.count||0,marks:G.ThrowableVFX?.groundMesh.count||0,lights:G.FX.lights.length};r.info.autoReset=auto;return row;
  },{time,measure});
  for(const view of views){
   await camera(view);
   const cases=close?[['molotov',[.28]]]:view==='standard'?[['frag',[.05,.25,.85]],['molotov',[.08,1.2,5]]]:[['frag',[.25]],['molotov',[1.2]]];
   for(const[kind,times]of cases){
    await blast(kind);
    for(const time of times){
     const row=await advance(time);row.kind=kind;row.view=view;rows.push(row);const prefix=mode+(view==='standard'?'':'-'+view);
     await p.screenshot({path:path.join(out,prefix+'-'+kind+'-'+String(time).replace('.','_')+'.png')});
    }
   }
  }
  if(process.env.VFX_ANIMATE==='1'){
   // 실제 게임 화면 2초를 고정 시간 간격으로 저장해 불길 흐름을 검토한다.
   const dir=path.join(out,mode+'-frames');fs.mkdirSync(dir,{recursive:true});await camera('near');await blast('molotov');
   for(let frame=0;frame<24;frame++){await advance(1.2+frame/12,false);await p.screenshot({path:path.join(dir,String(frame).padStart(3,'0')+'.png')})}
   cp.execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-framerate','12','-i',path.join(dir,'%03d.png'),'-c:v','libvpx-vp9','-crf','28','-b:v','0',path.join(out,mode+'-molotov-motion.webm')]);
  }
  fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify({mode,base,rows,errors:f.errors},null,2)+'\n');if(f.errors.length)throw Error(f.errors.join('\n'));console.log('PASS 화면 저장',mode,out,JSON.stringify(rows));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
