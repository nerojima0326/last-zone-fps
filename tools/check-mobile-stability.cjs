// S24 FE 화면 조건에서 메모리·조작·회전·품질·컨텍스트 복구를 실제 WebGL로 검사한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs'),gpu=require('./optimize/gpu-allocations.cjs');
const out=path.resolve(process.env.MOBILE_SHOTS||'/tmp/lz-v91-mobile');
const device={viewport:{width:412,height:892},deviceScaleFactor:2.625,contextOptions:{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}};
async function snapshot(page){return page.evaluate(()=>{
 G.UI.update(1/60);G.renderNow();G.Perf.gpuWait();const c=G.renderer.domElement,r=c.getBoundingClientRect(),rt=G.composerRT(),vm=G.viewmodelRT(),pr=G.presentationRT();
 return{dpr:devicePixelRatio,mobile:document.documentElement.classList.contains('mobile'),viewport:[document.documentElement.clientWidth,document.documentElement.clientHeight],stage:[innerWidth,innerHeight],stageScale:__stageScale,canvas:[c.width,c.height],display:[r.width,r.height],rendererPR:G.renderer.getPixelRatio(),scene:[rt.width,rt.height,rt.samples],viewmodel:[vm.width,vm.height,vm.samples],presentation:[pr.width,pr.height],quality:G.quality,drs:G.DRS.scale,memory:{...G.renderer.info.memory},heap:performance.memory?.usedJSHeapSize,gpu:__lzGpuAlloc.snapshot(),imageLimit:G.TextureQuality.imageLimit,resized:G.TextureQuality.resized};
})}
function native(row){assert(row.mobile);assert(Math.abs(row.rendererPR-row.dpr*row.stageScale)<1e-6);const actual=row.viewport.map(v=>v*row.dpr).sort((a,b)=>a-b),rendered=row.canvas.slice().sort((a,b)=>a-b);for(let i=0;i<2;i++)assert(Math.abs(actual[i]-rendered[i])<2,'캔버스가 실제 표시 픽셀보다 큼');assert.deepEqual(row.gpu.unknownFormats,[])}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const crashes=[],f=await fixture({...device,initialOptions:{quality:'low',players:40},route:async p=>{await p.addInitScript(gpu);p.on('crash',()=>crashes.push('페이지 종료'))}}),{page}=f,report={};
 try{
  await page.evaluate(()=>{window.__lzRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:window.__lzRAF(fn);G.onLockChange=()=>{};G.Input.unlock();G.UI.showPause(false)});
  report.menu=await snapshot(page);native(report.menu);await page.screenshot({path:path.join(out,'menu.png'),timeout:90000});
  await page.evaluate(()=>{G.startGame({...G.UI.opts,mode:'training'});G.paused=true;G.UI.showPause(false);for(let i=0;i<3;i++){G.Player.update(1/60);G.Input.endFrame()}});
  report.training=await snapshot(page);native(report.training);assert(report.training.gpu.estimatedBytes<550*1048576,'모바일 그래픽 저장소 예산 초과');assert.equal(report.training.imageLimit,512);assert(report.training.resized>30);
  await page.screenshot({path:path.join(out,'training.png'),timeout:90000});console.log('PASS S24 FE 세로 화면·실제 출력 픽셀·모바일 저장소 예산');
  await page.evaluate(()=>{G.paused=false;G.Input.locked=true});await page.waitForFunction(()=>document.getElementById('touchUI').classList.contains('show'),null,{timeout:5000,polling:50});
  report.controls=await page.evaluate(()=>{
   const P=G.Player,I=G.Input;I.locked=true;I.reset();G.paused=false;
   const press=(id,n)=>{const el=document.querySelector('#touchUI [data-id="'+id+'"]'),r=el.getBoundingClientRect(),touch=new Touch({identifier:19,target:el,clientX:r.x+r.width/2,clientY:r.y+r.height/2});
    el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,changedTouches:[touch],touches:[touch]}));for(let i=0;i<n;i++){P.update(1/60);I.endFrame()}el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,changedTouches:[touch],touches:[]}));};
   for(let i=0;i<90;i++){P.update(1/60);I.endFrame()}const shots=G.Training.stats.shots;press('fire',40);const fired=G.Training.stats.shots>shots;press('reload',1);const reloading=!!P.reload;let n=0;while(P.reload&&n++<600){P.update(1/60);I.endFrame()}const reloaded=!P.reload&&P.a.weapons.rifle.mag===G.WEAPONS[P.a.weapons.rifle.id].mag;
   const expandedReloads=[],saved={cur:P.a.cur,weapons:{...P.a.weapons},ammo:{...P.a.ammo}};
   for(const id of Object.keys(G.WeaponCatalog)){const d=G.WEAPONS[id];P.a.cur=d.cls;P.a.weapons[d.cls]={id,mag:0,scope:null,iron:true,attachments:{}};P.a.ammo[d.ammo]=999;Object.assign(P,{sw:null,reload:null,ads:0,scopeView:0,raise:1});I.reset();G.VM.set(id);for(let i=0;i<30;i++){P.update(1/60);I.endFrame()}press('reload',1);const started=!!P.reload;let n=0;while(P.reload&&n++<900){P.update(1/60);I.endFrame()}expandedReloads.push({id,started,finished:!P.reload,mag:P.a.weapons[d.cls].mag,expected:d.mag,oldHands:G.RealArms.copy.visible&&G.RealArms.copy.parent===G.VM.models[id].root});}
   P.a.cur=saved.cur;P.a.weapons=saved.weapons;P.a.ammo=saved.ammo;G.VM.set(P.a.gunId(P.a.cur));
   const throwActions=[];for(const kind of G.THROW_ORDER){P.abortThrow();G.Throwables.reset();P.sw=null;P.reload=null;P.throwKind=kind;P.a.cur='throw';P.raise=1;P.a.throwables[kind]=3;G.VM.set('throw');G.VM.setThrowKind(kind);press('fire',30);for(let i=0;i<120;i++){P.update(1/60);I.endFrame()}throwActions.push({kind,created:G.Throwables.list.length,ammo:P.a.throwables[kind],finished:!P.throwSt});}G.Throwables.reset();
   press('knife',90);const knife=P.a.cur==='melee';press('ads',1);const inspect=P.melee?.kind==='inspect';
   G.UI.drawScope(1,'x4',P);const c=document.getElementById('scopeOverlay'),scope=[c.width,c.height];G.UI.drawScope(0,null,P);G.paused=true;I.reset();return{fired,reloading,reloaded,knife,inspect,scope,throwActions,expandedReloads};
  });for(const key of ['fired','reloading','reloaded','knife','inspect'])assert(report.controls[key],key);assert.deepEqual(report.controls.scope,report.training.canvas);for(const t of report.controls.throwActions){assert.equal(t.created,1,t.kind);assert.equal(t.ammo,2,t.kind);assert(t.finished,t.kind);}for(const r of report.controls.expandedReloads){assert(r.started&&r.finished&&r.oldHands,r.id);assert.equal(r.mag,r.expected,r.id);}
  // 장착 가능한 실사 스코프를 실제로 업로드한 뒤 모바일 예산을 확인한다.
  report.scopes=[];
  const scopes=await page.evaluate(()=>G.WEAPONS.ar7.scopes);assert(!scopes.includes('x8'));
  for(const scope of scopes){
   await page.evaluate(scope=>{const P=G.Player,a=P.a;a.cur='rifle';a.weapons.rifle.scope=scope;a.weapons.rifle.iron=false;Object.assign(P,{melee:null,sw:null,reload:null,ads:0,scopeView:0,raise:1});for(let i=0;i<90;i++)P.updateCamera(1/60)},scope);
   const row=await snapshot(page);native(row);assert(row.gpu.estimatedBytes<550*1048576,'실사 스코프 저장소 예산 초과');report.scopes.push({scope,estimatedBytes:row.gpu.estimatedBytes,textures:row.memory.textures});
  }
  await page.evaluate(()=>{const P=G.Player;P.a.cur='pistol';P.a.weapons.pistol.scope='reddot';P.a.weapons.pistol.iron=false;for(let i=0;i<90;i++)P.updateCamera(1/60)});
  const micro=await snapshot(page);native(micro);assert(micro.gpu.estimatedBytes<550*1048576);report.scopes.push({scope:'micro',estimatedBytes:micro.gpu.estimatedBytes,textures:micro.memory.textures});
  report.tiers=[];
  for(const tier of ['potato','low','medium','high']){
   await page.evaluate(tier=>{G.__apply(tier);G.Player.updateCamera(1/60)},tier);const row=await snapshot(page);native(row);report.tiers.push(row);assert.equal(row.scene[2],tier==='potato'?0:tier==='high'?4:2);
   const colorBuffers=row.gpu.storage.filter(x=>x.kind==='renderbuffer'&&x.format===34842&&x.w===row.scene[0]&&x.h===row.scene[1]);assert(colorBuffers.length<=1,'장면 외 후처리 버퍼에 중복 MSAA');
  }
  await page.evaluate(()=>{G.__apply('low');G.setRenderResolution('100')});const fixed=await snapshot(page);assert.equal(fixed.drs,1);native(fixed);report.fixed=fixed;
  await page.evaluate(()=>G.setRenderResolution('auto'));await page.setViewportSize({width:892,height:412});
  await page.waitForFunction(()=>!window.__stageRot&&G.renderer.domElement.width===Math.floor(innerWidth*G.screenPixelRatio()),null,{timeout:10000,polling:50});report.landscape=await snapshot(page);native(report.landscape);
  await page.evaluate(()=>{G.paused=false;G.Input.locked=true});await page.waitForFunction(()=>document.getElementById('touchUI').classList.contains('show'),null,{timeout:5000,polling:50});
  await page.screenshot({path:path.join(out,'landscape.png'),timeout:90000});await page.evaluate(()=>{G.paused=true;G.Input.reset()});console.log('PASS 터치 사격·장전·칼·스코프·4단계 품질·고정 해상도·가로 회전');
  // 압축 밉과 일반 이미지의 예산, 데이터 텍스처의 보존을 별도로 확인한다.
  report.textures=await page.evaluate(()=>{
   const T=THREE,Q=G.TextureQuality,image=document.createElement('canvas');image.width=2048;image.height=1024;
   const a=new T.CanvasTexture(image),b=a.clone();Q.texture(a);Q.texture(b);
   const compressed=new T.CompressedTexture([{width:1024,height:1024,data:new Uint8Array(8)},{width:512,height:512,data:new Uint8Array(8)},{width:256,height:256,data:new Uint8Array(8)}],1024,1024);Q.texture(compressed);
   const data=new T.DataTexture(new Uint8Array(1024*1024),1024,1024,T.RedFormat);Q.texture(data);
   return{image:[a.image.width,a.image.height],shared:a.image===b.image,compressed:[compressed.image.width,compressed.image.height,compressed.mipmaps.length],data:[data.image.width,data.image.height]};
  });assert.deepEqual(report.textures,{image:[512,256],shared:true,compressed:[512,512,2],data:[1024,1024]});
  await page.evaluate(()=>{window.requestAnimationFrame=fn=>fn.name==='frame'?0:window.__lzRAF(fn);G.Perf.toggle(true);G.Perf.frameStart();G.renderNow();G.Perf.frameEnd(16.7,0);G.Perf.gpuWait();window.__lzLost=G.renderer.getContext().getExtension('WEBGL_lose_context');if(!window.__lzLost)throw Error('컨텍스트 손실 검사 확장 없음');window.__lzLost.loseContext()});
  await page.waitForFunction(()=>G.GraphicsRecovery.lost,null,{timeout:10000,polling:50});
  const lost=await page.evaluate(()=>{const time=G.Game.time,player=G.Player.a,render=G.renderer.render;let calls=0;G.renderer.render=()=>calls++;try{G.resume();G.renderNow();G.startGame({...G.UI.opts,mode:'training'})}finally{G.renderer.render=render}return{paused:G.paused,loading:!document.getElementById('loading').classList.contains('hidden'),time,renders:calls,samePlayer:G.Player.a===player}});assert(lost.paused&&lost.loading&&lost.samePlayer);assert.equal(lost.renders,0);
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>G.Game.time),lost.time);await page.evaluate(()=>window.__lzLost.restoreContext());
  await page.waitForFunction(()=>!G.GraphicsRecovery.lost&&G.GraphicsRecovery.recoveries===1,null,{timeout:20000,polling:50});
  report.recovery=await page.evaluate(()=>{G.Perf.toggle(false);G.renderNow();G.Perf.gpuWait();const gl=G.renderer.getContext();return{paused:G.paused,pauseMenu:!document.getElementById('pause').classList.contains('hidden'),loading:!document.getElementById('loading').classList.contains('hidden'),recoveries:G.GraphicsRecovery.recoveries,error:gl.getError()}});
  assert(report.recovery.paused&&report.recovery.pauseMenu&&!report.recovery.loading);assert.equal(report.recovery.error,0);
  const stable=await snapshot(page);native(stable);assert(stable.gpu.estimatedBytes<550*1048576);report.restored=stable;
  await page.screenshot({path:path.join(out,'restored.png'),timeout:90000});
  await page.evaluate(()=>{G.resume();if(G.paused)throw Error('복구 후 재개 실패');G.toMenu();G.startGame({...G.UI.opts,mode:'training'});G.paused=true;G.UI.showPause(false);for(let i=0;i<3;i++){G.Player.update(1/60);G.Input.endFrame()}});
  report.reentry=await snapshot(page);native(report.reentry);assert(report.reentry.gpu.estimatedBytes<550*1048576);
  const landing=await page.evaluate(()=>{
   G.toMenu();G.startGame({...G.UI.opts,mode:'battle',players:40});G.paused=true;G.UI.showPause(false);
   const a=G.Player.a;G.Game.updatePlane(8);G.Game.jump(a);let steps=0;
   // 지형 고도에 따라 자동 낙하산 착지가 20초를 넘을 수 있다.
   while(a.state!=='ground'&&steps++<900){G.Game.time+=1/30;G.Game.updatePlane(1/30);G.Player.update(1/30);G.UI.update(1/30);G.Input.endFrame()}
   for(let i=0;i<90;i++){G.Player.update(1/60);G.UI.update(1/60);G.Input.endFrame()}G.Game.syncModels(1/60);
   return{steps,state:a.state,camera:G.Player.camMode,height:a.pos.y,ground:G.World.heightAt(a.pos.x,a.pos.z),water:G.World.waterAt(a.pos.x,a.pos.z)};
  });
  report.match=await snapshot(page);native(report.match);report.match.landing=landing;assert.equal(landing.state,'ground');assert.equal(landing.camera,'fp');assert(landing.steps<900);report.match.actors=await page.evaluate(()=>G.Game.actors.length);assert.equal(report.match.actors,40);assert(report.match.gpu.estimatedBytes<550*1048576);
  await page.screenshot({path:path.join(out,'match.png'),timeout:90000});console.log('PASS 40명 매치 생성·강하·착지·게임 화면');
  assert.deepEqual(crashes,[]);assert.deepEqual(f.errors,[]);report.crashes=crashes;report.errors=f.errors;fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS 실제 컨텍스트 손실·정지·복구·재개·재진입·GL 오류 없음');
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
