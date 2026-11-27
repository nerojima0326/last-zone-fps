
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// v83: 실제 게임에서 기록·프레임 측정·전환·봇 재조준·입자 재사용을 검사한다.
const assert=require('assert'),fs=require('fs'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.env.REPORT||'/tmp/lz-v83-session-checks.json';
(async()=>{
 const f=await fixture({viewport:{width:800,height:450}}),p=f.page,report={};
 try{
  await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});
  await p.click('#trainingHistoryBtn');assert(await p.locator('#trainingRecordPanel').isVisible());assert(await p.locator('#recordStart').isDisabled());await p.click('#recordClose');
  await p.click('#trainBtn');await p.evaluate(()=>G.startReady);await p.waitForFunction(()=>(!G.preparing&&G.Training.active));
  await p.evaluate(async()=>{G.paused=true;G.Input.unlock();G.UI.showPause(false);const a=G.Game.player;a.give('ar7');a.cur='rifle';G.VM.set('ar7');await Promise.all(Object.values(a.weapons).filter(Boolean).map(w=>G.AssetVM.request(w.id)))});
  report.renderPrep=await p.evaluate(async()=>{
   const P=G.RenderPrep,root=new THREE.Group(),tex=new THREE.DataTexture(new Uint8Array(16).fill(255),2,2);tex.needsUpdate=true;
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshBasicMaterial({map:tex}));root.add(mesh);
   const uploads=P.uploads,compiled=P.compiled,target=G.renderer.getRenderTarget();G.paused=false;G.Input.lmb=true;
   const promise=P.prepare(root);await new Promise(r=>setTimeout(r,80));const deferred=P.uploads===uploads&&P.compiled===compiled;
   G.paused=true;G.Input.lmb=false;await promise;const prepared=P.uploads===uploads+1&&P.compiled===compiled+1&&G.renderer.getRenderTarget()===target;
   mesh.geometry.dispose();mesh.material.dispose();tex.dispose();
   const compile=G.prepareViewmodel,a=new THREE.Group(),b=new THREE.Group();let recover;
   try{G.prepareViewmodel=root=>{if(root===a)throw Error('의도한 셰이더 준비 실패');return Promise.resolve(root)};const rows=await Promise.allSettled([P.prepare(a),P.prepare(b)]);recover=rows[0].status==='rejected'&&rows[1].status==='fulfilled'}finally{G.prepareViewmodel=compile}
   return{deferred,prepared,recover};
  });assert(report.renderPrep.deferred&&report.renderPrep.prepared&&report.renderPrep.recover);
  report.particles=await p.evaluate(()=>{
   const rows=[];
   for(const kind of['add','norm']){
    const fx=G.FX[kind],seen=new Set();fx.clear();
    const old=fx.spawn({x:0,y:5,z:0,life:.01,floor:4,r:.1,g:.2,b:.3,grav:9});fx.update(.02);
    const clean=fx.spawn({x:1,y:8,z:2,life:.01});const reset=clean===old&&clean.floor===undefined&&clean.r===1&&clean.grav===0;fx.clear();
    for(let wave=0;wave<100;wave++){for(let i=0;i<64;i++)seen.add(fx.spawn({x:0,y:10,z:0,life:.01}));fx.update(.02)}
    for(let i=0;i<fx.max;i++)fx.spawn({x:0,y:10,z:0});const capped=fx.spawn({x:0,y:10,z:0})===null;fx.clear();fx.clear();
    rows.push({kind,objects:seen.size,reset,capped,bounded:fx.free.length===fx.max&&new Set(fx.free).size===fx.max});
   }return rows;
  });
  for(const r of report.particles){assert.equal(r.objects,64);assert(r.reset&&r.capped&&r.bounded)}
  report.poses=await p.evaluate(()=>{
   const R=G.PoseRecovery,vm={cur:'test'},original={type:'mag',p:.2};
   R.reset();R.state(vm,{reload:original},0);const state={reload:null,ads:0},half=R.state(vm,state,.065).reload.p;
   const untouched=original.p===.2&&state.reload===null,ended=R.state(vm,state,.065)===state&&!R.active;
   R.state(vm,{reload:original},0);const fullADS={ads:1};const ads=R.state(vm,fullADS,.01)===fullADS&&!R.active;
   R.reset();return{half,untouched,ended,ads};
  });
  assert(Math.abs(report.poses.half-.1)<1e-5);assert(report.poses.untouched&&report.poses.ended&&report.poses.ads);
  report.switches=await p.evaluate(()=>{
   const P=G.Player,a=G.Game.player,rows=[];G.Input.reset();
   for(const fps of[30,60,144]){
    a.cur='rifle';P.sw=null;P.raise=.35;P.reload=P.autoReload=null;P.switchTo('pistol');const from=P.sw.from;let maxStep=0,previous=P.raise;
    for(let n=0;n<Math.ceil(fps*.1);n++){P.weaponsLogic(1/fps,P.time);maxStep=Math.max(maxStep,Math.abs(P.raise-previous));previous=P.raise}
    const height=P.raise;P.switchTo('shotgun');const continuous=P.raise===height&&P.sw.from===height;
    for(let n=0;n<Math.ceil(fps*.5);n++){P.weaponsLogic(1/fps,P.time);maxStep=Math.max(maxStep,Math.abs(P.raise-previous));previous=P.raise}
    rows.push({fps,from,continuous,maxStep,ended:!P.sw&&P.raise===1&&a.cur==='shotgun'});
   }a.cur='rifle';G.VM.set('ar7');return rows;
  });for(const r of report.switches){assert.equal(r.from,.35);assert(r.continuous&&r.ended&&r.maxStep<.2)}
  report.bots=await p.evaluate(()=>{
   const rows=[],W=G.World,actors=G.Game.actors,los=W.los,query=W.queryBoxes,height=W.heightAt,ray=W.rayBoxes;
   function pair(team=1,dist=40){const a=new G.Actor({id:999,team}),t=new G.Actor({id:998,team:team===0?1:0});for(const x of[a,t])Object.assign(x,{state:'ground',onGround:true});a.give('ar7',60);a.cur='rifle';a.pos.set(0,20,0);t.pos.set(0,20,-dist);const b=new G.Bot(a);Object.assign(b,{target:t,visible:true,reactT:0,nextFire:1e9,strafeT:99,aimHead:false,aimPhase:.7});b.d={...b.d,head:0};b.blocked=()=>false;return{a,t,b}}
   let reaction,hidden;
   try{const{a,t,b}=pair();G.Game.actors=[a,t];W.los=()=>true;b.visible=false;b.lostT=1;b.perceive();reaction=b.reactT;b.visible=false;b.combat(.1,new THREE.Vector3());hidden=b.reactT;
    for(const fps of[30,60,144])for(const dist of[10,80]){const{b}=pair(1,dist);for(let i=0;i<fps;i++)b.combat(1/fps,new THREE.Vector3());rows.push({fps,dist,error:b.sightError.toArray()})}
    const ally=pair(0).b;ally.combat(1,new THREE.Vector3());
    const cover=pair(),box={minX:-1,maxX:1,minZ:-6,maxZ:-4,minY:20,maxY:22};let occupied=false,vertical=false;
    W.heightAt=()=>20;W.queryBoxes=(x0,z0,x1,z1,cb)=>{if(x1-x0>20)cb(box);else if(occupied)cb({minX:x0,maxX:x1,minZ:z0,maxZ:z1,minY:20,maxY:22})};
    W.rayBoxes=(x,y,z,dx,dy,dz)=>{if(Math.abs(dy)<1e-6)return Infinity;vertical=true;return 2};
    const accepted=cover.b.findCover(cover.t);occupied=true;const rejected=!cover.b.findCover(cover.t);
    return{reaction,hidden,rows,ally:ally.sightError.length(),cover:{accepted,rejected,vertical}};
   }finally{G.Game.actors=actors;W.los=los;W.queryBoxes=query;W.heightAt=height;W.rayBoxes=ray}
  });
  assert(report.bots.reaction>=.18);assert.equal(report.bots.reaction,report.bots.hidden);assert.equal(report.bots.ally,0);
  assert(report.bots.cover.accepted&&report.bots.cover.rejected&&report.bots.cover.vertical);
  for(const dist of[10,80]){const rows=report.bots.rows.filter(r=>r.dist===dist);for(const r of rows)for(let k=0;k<3;k++)assert(Math.abs(r.error[k]-rows[0].error[k])<1e-10)}
  assert(Math.hypot(...report.bots.rows[1].error)>Math.hypot(...report.bots.rows[0].error));
  report.perf=await p.evaluate(()=>{
   const S=G.SessionPerf;G.paused=false;S.start();S.frame(999,0,0);for(let i=0;i<99;i++)S.frame(16,2,3);S.mark('발사');S.frame(100,8,15);G.paused=true;S.frame(9999,0,0);G.paused=false;S.frame(9999,0,0);const r=S.stop();
   S.start();S.frame(1,0,0);for(let i=0;i<60;i++)S.frame(1000,1,1);const auto=!S.recording&&S.result.frames===60;G.paused=true;return{...r,auto};
  });
  assert.equal(report.perf.frames,100);assert(Math.abs(report.perf.fps-100000/1684)<.001);assert.equal(report.perf.low1,10);assert.equal(report.perf.maxMs,100);assert.equal(report.perf.spikes[0].action,'발사');assert(report.perf.auto);assert(await p.locator('#setPerfSave').isEnabled());
  // 버튼을 통해 시작하고 실제 사격·훈련 판정 경로로 산탄 중복 집계와 저장을 검사한다.
  await p.evaluate(()=>G.TrainingRecords.show());await p.selectOption('#recordDistance','25');await p.click('#recordStart');
  report.records=await p.evaluate(()=>{
   const R=G.TrainingRecords,T=G.Training,P=G.Player,a=G.Game.player,dir=new THREE.Vector3(0,0,-1),r=R.run;R.history=[];
   const check=(ok,msg)=>{if(!ok)throw Error(msg)};
   check(r?.distance===25&&!R.open&&!G.paused,'측정 시작/닫기');
   // v108 실제 1인칭의 꺼내기 동작을 마친 뒤 발사를 검사한다.
   for(let n=0;n<90;n++)P.updateCamera(1/60);
   check(new THREE.Vector3().setFromMatrixPosition(G.camera.matrixWorld).distanceTo(G.camera.position)<1e-6,'이동한 시점의 행렬 갱신');
   const def=G.WEAPONS.ar7,inst=a.weapons[a.cur],mag=inst.mag;P.fire(def,inst,P.time);
   check(inst.mag===mag-1&&r.shots===1,'실제 발사 집계 '+JSON.stringify({before:mag,after:inst.mag,shots:r.shots,blocked:G.WeaponObstruction.blocked,local:G.WeaponObstruction.local.toArray(),mode:P.camMode}));G.Ballistics.reset();
   r.elapsed=1;const shot=T.onShot();for(let i=0;i<3;i++)T.onHit({target:r.target,head:i===2},10,r.target.root.position,dir,shot);T.flush();
   const other=T.targets.find(t=>t!==r.target);T.onHit({target:other,head:false},1,other.root.position,dir,shot);T.flush();check(r.hits===1&&r.heads===1,'동일 발사/다른 표적');
   r.elapsed=1.4;T.onHit({target:r.target,head:false},100,r.target.root.position,dir,T.onShot());T.flush();check(r.downs===1&&Math.abs(r.ttks[0]-.4)<1e-8,'첫 명중부터 처치 시간');
   R.tickClock(1000,true);R.tickClock(1100,true);const elapsed=r.elapsed;R.tickClock(2000,false);R.tickClock(9000,true);check(r.elapsed===elapsed,'일시정지 시간 제외');
   r.elapsed=29.9;R.tickClock(9200,true);const late=T.onShot();R.onHit({target:r.target,head:true},{drill:r.id});check(!late.drill&&r.shots===3&&r.hits===2,'30초 이후 발사/명중 제외');R.update(0);check(R.history.length===1&&R.open,'완료/저장/결과');const first={...R.history[0]};
   R.start(25);const r2=R.run;r2.elapsed=2;T.onHit({target:r2.target,head:true},200,r2.target.root.position,dir,T.onShot());T.flush();r2.elapsed=30;R.update(0);check(R.history.length===2&&R.best(R.history)===R.history[1],'이전/최고 비교');
   const second={...R.history[1]},body=document.getElementById('recordBody').textContent;check(body.includes('이전 대비')&&body.includes('이전 기록'),'비교 화면');
   R.start(25);a.pos.x+=2;R.update(0);check(!R.run&&R.history.length===2,'이동 중단');
   R.start(25);a.cur='pistol';R.update(0);check(!R.run&&R.history.length===2,'무기 변경 중단');a.cur='rifle';
   R.start(25);P.throwSt={};R.update(0);P.throwSt=null;check(!R.run&&R.history.length===2,'투척 중단');
   R.start(25);R.run.elapsed=30;R.update(0);check(R.history.length===2,'미발사 저장 제외');
   const key='lastzone_training_records_v1',valid=JSON.parse(localStorage.getItem(key));localStorage.setItem(key,'{broken');R.load();check(!R.history.length,'손상 데이터');
   localStorage.setItem(key,JSON.stringify({version:1,history:[...Array(75).fill(first),{...first,hits:99999}]}));R.load();check(R.history.length===60,'스키마/개수 제한');
   localStorage.setItem(key,JSON.stringify(valid));R.load();check(R.history.length===2,'영구 저장');
   const set=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('blocked')};const fallback=!R.save();Storage.prototype.setItem=set;check(fallback&&R.history.length===2,'저장 제한 메모리 유지');
   const live=[];
   for(const distance of[10,25,50,100]){
    check(R.start(distance),'실사격 시작');const target=R.run.target;P.ads=1;P.updateCamera(1/60);
    const point=target.pivot.localToWorld(new THREE.Vector3(0,1.15,0)),direction=point.sub(G.camera.position).normalize();a.yaw=Math.atan2(-direction.x,-direction.z);a.pitch=Math.asin(direction.y);P.updateCamera(1/60);
    P.fire(G.WEAPONS.ar7,a.weapons.rifle,P.time);for(let n=0;n<100&&G.Ballistics.list.length;n++)G.Ballistics.update(.01);T.flush();
    check(R.run.shots===1&&R.run.hits===1,'거리별 실제 탄도 명중 '+distance+' '+JSON.stringify({shots:R.run.shots,hits:R.run.hits,spread:P.currentSpread(G.WEAPONS.ar7),pos:a.pos.toArray(),hp:target.hp,blocked:G.WeaponObstruction.blocked}));live.push(distance);R.abort();
   }
   R.close(false);G.paused=true;G.UI.showPause(false);return{first,second,fallback,live,checks:16};
  });
  const pending=p.waitForEvent('download');await p.evaluate(()=>document.getElementById('setPerfSave').click());const download=await pending;
  const saved=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(download.suggestedFilename(),'last-zone-performance.json');assert.equal(saved.frames,60);assert.equal(saved.frameMs.length,60);report.download={frames:saved.frames,filename:download.suggestedFilename()};
  for(let i=0;i<2;i++){await p.evaluate(()=>G.toMenu());await p.click('#trainBtn');await p.evaluate(()=>G.startReady);await p.waitForFunction(()=>G.Game.training&&(!G.preparing&&G.Training.active));await p.evaluate(()=>{G.paused=true;G.Input.unlock();G.UI.showPause(false)});assert(await p.locator('#trainingRecordPanel').isHidden())}
  report.reentry=2;
  await p.reload();await p.waitForFunction(()=>window.G?.TrainingRecords?.panel&&document.querySelector('#menu:not(.hidden)'),null,{timeout:240000});
  assert.equal(await p.evaluate(()=>G.TrainingRecords.history.length),2);
  report.errors=f.errors;assert.deepEqual(f.errors,[]);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log('PASS v83',JSON.stringify({particles:report.particles,poses:report.poses,bots:report.bots,records:report.records,perf:{frames:report.perf.frames,fps:report.perf.fps,low1:report.perf.low1},report:out}));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
