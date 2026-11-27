
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 실제 브라우저에서 로딩 순서·모델 준비·지연/누락 복구를 확인한다.
const assert=require('assert'),fs=require('fs'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.env.REPORT||'/tmp/lz-v82-startup-checks.json';
const bakedChunks=Object.keys(JSON.parse(fs.readFileSync(__dirname+'/../assets/lighting/static-ao.json','utf8')).chunks).length;
assert(bakedChunks>300,'맵 전체의 정적 음영 데이터가 필요함');
(async()=>{
 const report={};let page,signal,release;
 const configured=new Promise(r=>signal=r),modelGate=new Promise(r=>release=r);
 const pending=fixture({route:async p=>{
  page=p;
  await p.route('**/assets/models/viewmodels/m4.glb*',async route=>{await modelGate;await route.continue()});
  signal();
 }});
 let f;
 try{
  await configured;
  await page.waitForFunction(()=>window.G?.World?.heightTex,null,{timeout:240000});
  report.waiting=await page.evaluate(()=>({world:!!G.World.heightTex,m4:G.M4Viewmodel.ready,loading:!document.getElementById('loading').classList.contains('hidden'),menu:!document.getElementById('menu').classList.contains('hidden')}));
  assert.deepEqual(report.waiting,{world:true,m4:false,loading:true,menu:false});
  release();f=await pending;
  report.ready=await page.evaluate(()=>({m4:G.M4Viewmodel.ready,glock:G.G17Pilot.ready,guns:Object.keys(G.GunModels.guns).length,lods:Object.keys(G.WorldWeapons.models).length,soldiers:G.Soldiers.templates.length,ao:G.StaticAO.applied,rejected:G.StaticAO.rejected,reloads:G.ReloadAssets.ready,expansion:!!G.ReloadAssets.expansion}));
  assert.deepEqual(report.ready,{m4:true,glock:true,guns:30,lods:30,soldiers:4,ao:bakedChunks,rejected:0,reloads:true,expansion:true});
  const scripts=f.requests.filter(u=>u.startsWith('/js/'));
  assert.equal(new Set(scripts).size,scripts.length,'미리 받은 스크립트를 중복 요청함');
  assert.equal(f.requests.filter(u=>u==='/assets/models/viewmodels/m4.glb').length,1);
  assert.equal(f.requests.filter(u=>u==='/assets/models/viewmodels/glock17.glb').length,1);
  await page.evaluate(()=>{G.onLockChange=()=>{};G.Input.unlock();window.requestAnimationFrame=()=>0});
  await page.click('#trainBtn');await page.waitForFunction(()=>G.Training.active);
  report.training=await page.evaluate(()=>{
   G.Input.unlock();G.paused=true;G.UI.showPause(false);
   for(let i=0;i<30;i++)G.Player.updateCamera(1/60);G.renderNow();
   return{active:G.Training.active,weapon:G.VM.cur,m4:G.M4Viewmodel.ready,mag:G.Game.player.weapons.rifle.mag};
  });
  assert(report.training.active&&report.training.m4);assert.equal(report.training.weapon,'ar7');assert(report.training.mag>0);
  assert.deepEqual(f.errors,[]);
 }finally{release();if(!f)f=await pending;await f.close()}
 console.log('PASS 지연 모델: 맵과 병렬 준비·준비 전 메뉴 차단·단일 다운로드·즉시 훈련 진입');
 const missing=await fixture({route:async p=>{
  await p.route('**/assets/models/viewmodels/m4.glb*',r=>r.fulfill({status:404,body:''}));
  await p.route('**/assets/models/viewmodels/glock17.glb*',r=>r.fulfill({status:404,body:''}));
  await p.route('**/vendor/ez-tree.es.js*',r=>r.fulfill({status:404,body:''}));
 }});
 try{
  report.fallback=await missing.page.evaluate(()=>({m4:G.M4Viewmodel.ready,glock:G.G17Pilot.ready,vegetation:G.Veg.available(),procedural:!!G.VM.models.ar7&&!!G.VM.models.g18,world:!!G.World.heightTex}));
  assert.deepEqual(report.fallback,{m4:false,glock:false,vegetation:false,procedural:true,world:true});
  assert.deepEqual(missing.errors,[]);
 }finally{await missing.close()}
 console.log('PASS 누락 에셋: 번들 총기·나무 생성기 없이 기본 모델로 시작');
 const broken=await fixture({expectBootError:true,route:async p=>{
  await p.route('**/js/world.js*',r=>r.fulfill({status:404,body:''}));
 }});
 try{
  report.scriptError=await broken.page.evaluate(()=>({text:document.getElementById('loadText').textContent,loading:!document.getElementById('loading').classList.contains('hidden'),menu:!document.getElementById('menu').classList.contains('hidden'),laterScript:!!G.FX}));
  assert.match(report.scriptError.text,/world\.js/);assert(report.scriptError.loading&&!report.scriptError.menu&&!report.scriptError.laterScript);
  assert.deepEqual(broken.errors,[]);
 }finally{await broken.close()}
 console.log('PASS 필수 스크립트 누락: 후속 실행을 멈추고 한국어 오류 표시');
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
