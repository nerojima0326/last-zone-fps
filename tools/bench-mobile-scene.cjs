// S24 FE 화면 조건에서 같은 맵·시점의 제출량과 구간 비용을 비교한다. 휴대폰 실측 FPS가 아니다.
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process'),fixture=require('./optimize/browser-fixture.cjs');
const out=path.resolve(process.env.MOBILE_SHOTS||'/tmp/lz-mobile-scene'),base=process.env.MOBILE_BASE_REF,cache=new Map(),frames=+(process.env.FRAMES||3),tiers=(process.env.TIERS||'potato,low').split(',');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const f=await fixture({viewport:{width:892,height:412},deviceScaleFactor:2.625,contextOptions:{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'},initialOptions:{quality:'low',players:40,renderResolution:'auto'},route:async page=>{
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);Math.random=(()=>{let s=9701;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}})()});
  if(base)await page.route('**/*',r=>{const u=new URL(r.request().url()),name=u.pathname==='/'?'/index.html':u.pathname;if(u.hostname!=='127.0.0.1'||!(/^\/js\/.*\.js$/.test(name)||['/index.html','/version.txt'].includes(name)))return r.fallback();if(!cache.has(name))try{cache.set(name,execFileSync('git',['show',base+':'+name.slice(1)],{cwd:path.resolve(__dirname,'..'),stdio:['ignore','pipe','ignore']}))}catch(e){cache.set(name,null)}const body=cache.get(name);return body?r.fulfill({contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.html')?'text/html':'text/plain',body}):r.fallback();});
 }}),report={source:base||'작업 트리',environment:'Chromium / SwiftShader · 모바일 화면 에뮬레이션',frames,runs:[],errors:f.errors};
 try{
  const p=f.page;await p.evaluate(()=>{
   G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.startGame({...G.UI.opts,mode:'training',quality:'low',players:40});G.paused=true;G.UI.showPause(false);G.DRS.frame=()=>{};
   for(let i=0;i<30;i++){G.Player.update(1/60);G.Input.endFrame()}
   const W=G.World,city=W.towns.find(t=>t.type==='city'),trees=G.Veg.variants.flatMap(v=>v.kind==='bush'?[]:v.items.map((_,i)=>[v.mats[i*16+12],v.mats[i*16+14]]));let forest=[100,100],best=0;
   for(let i=0;i<trees.length;i+=7){const [x,z]=trees[i];if(W.towns.some(t=>Math.hypot(x-t.x,z-t.z)<t.r+35))continue;const count=trees.filter(t=>(t[0]-x)**2+(t[1]-z)**2<1600).length;if(count>best){best=count;forest=[x,z]}}
   const H=(x,z)=>W.heightAt(x,z),make=(x,z,y,dx,dz)=>({pos:[x,H(x,z)+y,z],look:[x+dx,H(x+dx,z+dz)+2,z+dz]});
   window.mobileScenes={forest:make(...forest,1.7,35,15),city:make(city.x+8,city.z+4,1.7,-40,-12),vista:{pos:[city.x+150,H(city.x+150,city.z+150)+55,city.z+150],look:[city.x,H(city.x,city.z)+5,city.z]}};
   G.Perf.toggle(true);G.Perf.sync=true;
  });
  await p.addStyleTag({content:'#perfOverlay,#fpsBox,#toast,#centerMsg{visibility:hidden!important}'});
  report.device=await p.evaluate(()=>({build:LZ_BUILD,mobile:document.documentElement.classList.contains('mobile'),dpr:devicePixelRatio,stage:[innerWidth,innerHeight],stageScale:__stageScale,scenes:mobileScenes,colliders:G.World.boxes.length,buildings:G.World.footprints.length,staticAO:{applied:G.StaticAO.applied,rejected:G.StaticAO.rejected},soldierTriangles:G.Soldiers.templates[0].tris,terrainLayers:G.MobileWorld?.terrainStats,treeTriangles:G.Veg.variants.map(v=>({kind:v.kind,seed:v.def.seed,tris:v.tris}))}));
  for(const tier of tiers)for(const scene of (process.env.SCENES||'forest,city,vista').split(',')){
   const row=await p.evaluate(({tier,scene,N})=>{
    G.__apply(tier);G.DRS.scale=G.DRS.maxScale;G.DRS.apply(true);const camera=G.camera,S=mobileScenes[scene];camera.position.set(...S.pos);camera.lookAt(...S.look);camera.fov=80;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    const P=G.Perf,R=G.renderer,world=G.World,wait=()=>P.gpuWait(),advance=()=>{world.update(1/60,camera.position,camera);G.RoomLighting?.update(1/60,camera.position)};
    for(let i=0;i<150;i++)advance();for(let i=0;i<2;i++){advance();R.shadowMap.needsUpdate=i===0;G.renderNow()}wait();
    const times=[],updates=[],segments={},counts=[];for(let i=0;i<N;i++){
     const t=performance.now();advance();updates.push(performance.now()-t);const every=G.qualityShEvery();R.shadowMap.needsUpdate=!!every&&i%every===0;wait();const start=performance.now();P.frameStart();G.renderNow();P.frameEnd(16,updates.at(-1));wait();times.push(performance.now()-start);counts.push({calls:P.info.calls,tris:P.info.tris});for(const [k,v]of Object.entries(P.acc))segments[k]=(segments[k]||0)+v/N;
    }
    // 레이블 진단은 버퍼 용량이다. 실제 제출 삼각형은 위의 renderer.info 집계를 쓴다.
    const labels=new WeakMap();for(const v of G.Veg.variants)for(const k of ['near','nearLeaf','far'])if(v[k])labels.set(v[k],'식생 '+v.kind+'/'+k);for(const c of world.terrainChunks||[])labels.set(c.mesh,'지형');
    for(const v of G.Vehicles.list||[])v.mesh?.traverse(o=>labels.set(o,'차량 '+(v.type||'')));
    const direct=R.renderBufferDirect,top={};R.renderBufferDirect=function(c,s,g,m,o,group){const n=Math.min(group?.count??(g.index?.count||g.attributes.position.count),g.index?.count||g.attributes.position.count),inst=o.isInstancedMesh?o.count:g.isInstancedBufferGeometry?g.instanceCount:1,key=labels.get(o)||o.name||o.type;const a=top[key]||(top[key]={calls:0,tris:0});a.calls++;a.tris+=n/3*(Number.isFinite(inst)?inst:1);return direct.apply(this,arguments)};R.shadowMap.needsUpdate=false;try{G.renderNow();wait()}finally{R.renderBufferDirect=direct}
    const avg=a=>a.reduce((s,v)=>s+v,0)/a.length,rt=G.composerRT(),vm=G.viewmodelRT();return {tier,scene,ms:avg(times),worldUpdateMs:avg(updates),segments,calls:avg(counts.map(x=>x.calls)),tris:avg(counts.map(x=>x.tris)),world:[rt.width,rt.height],output:[R.domElement.width,R.domElement.height],viewmodel:[vm.width,vm.height],samples:G.msaaSamples,mobileMap:G.MobileWorld?.stats,nearTrees:G.Veg.variants.reduce((s,v)=>s+v.near.count,0),topBufferCapacity:Object.entries(top).sort((a,b)=>b[1].tris-a[1].tris).slice(0,16),resources:{...R.info.memory,programs:R.info.programs.length}};
   },{tier,scene,N:frames});report.runs.push(row);console.log(tier,scene,Math.round(row.ms)+'ms',Math.round(row.calls)+' 호출',Math.round(row.tris/1000)+'천 삼각형');
   await p.screenshot({path:path.join(out,scene+'-'+tier+'.jpg'),type:'jpeg',quality:90,timeout:90000});fs.writeFileSync(path.join(out,'bench.json'),JSON.stringify(report,null,2)+'\n');
  }
 }finally{await f.close()}
 fs.writeFileSync(path.join(out,'bench.json'),JSON.stringify(report,null,2)+'\n');if(f.errors.length)throw Error(f.errors.join('\n'));
})().catch(e=>{console.error(e);process.exitCode=1});
