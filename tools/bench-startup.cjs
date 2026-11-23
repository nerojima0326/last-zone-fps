// 같은 v81/작업 트리를 Chromium에서 로딩해 메뉴·첫 프레임·초기화 구간을 측정한다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),fixture=require('./optimize/browser-fixture.cjs');
const mode=process.argv[2]||'after',out=process.argv[3]||'/tmp/lz-v82-startup',latency=Number(process.env.LOAD_LATENCY||0),runs=Number(process.env.LOAD_RUNS||1);
const base='fd69227425cc4db76f520d2fc11e5678788c0f48',root=path.resolve(__dirname,'..');
const snapshot={};if(mode==='before')for(const file of ['index.html',...cp.execFileSync('git',['ls-tree','-r','--name-only',base,'js'],{encoding:'utf8'}).trim().split('\n')])snapshot[file]=cp.execFileSync('git',['show',base+':'+file],{encoding:'utf8'});
const probe=()=>{
 const P=window.__StartupProbe={events:[],marks:{},errors:[],stage(name){this.marks[name]=performance.now()},wrap(o,key,label){
  if(!o||typeof o[key]!=='function')return;const fn=o[key];
  o[key]=function(...args){const start=performance.now();const finish=()=>P.events.push({name:label||key,start,ms:performance.now()-start});
   try{const value=fn.apply(this,args);if(value?.then)return value.then(v=>{finish();return v},e=>{finish();throw e});finish();return value}catch(e){finish();throw e}
  };
 },install(){
  for(const [owner,keys] of [['World',['init','genHeights','makeMaterials','genTowns','genBridges','genWild','genPaths','paintTerrain','buildTerrainMesh','buildSkyWater','genVegetation','finalizeParts','setTimeOfDay']],['Assets',['load','analyzeSky']],['StaticAO',['load']],['RangeProps',['load']],['Soldiers',['load']],['GunModels',['load']],['WorldWeapons',['load']],['Attachments',['load']],['Veg',['makeVariant','makeImpostor','calibrate']],['ReloadAssets',['load']],['ThrowModels',['load']],['Vehicles',['load']],['G17Pilot',['init']],['M4Viewmodel',['init']],['RT',['init','prepare']]])for(const key of keys)this.wrap(G[owner],key,owner+'.'+key);
  const Renderer=THREE.WebGLRenderer;
  THREE.WebGLRenderer=new Proxy(Renderer,{construct(target,args){const r=new target(...args);P.wrap(r,'compile','renderer.compile');P.renderer=r;return r}});
 }};
 const raf=requestAnimationFrame.bind(window);
 window.requestAnimationFrame=fn=>raf(now=>{if(fn.name==='frame'&&P.marks.firstFrame)return;fn(now);if(fn.name==='frame'&&!P.marks.firstFrame){G.Perf.gpuWait();P.stage('firstFrame')}});
 new PerformanceObserver(list=>{for(const e of list.getEntries())P.events.push({name:'longtask',start:e.startTime,ms:e.duration})}).observe({type:'longtask',buffered:true});
};
(async()=>{
 fs.mkdirSync(out,{recursive:true});const report={mode,base,latency,runs:[],note:'로컬 에셋·Chromium SwiftShader. 요청별 지연은 LOAD_LATENCY로 지정하며 실제 인터넷/하드웨어 수치가 아님.'};
 for(let i=0;i<runs;i++){
  const f=await fixture({viewport:{width:800,height:450},route:async page=>{
   await page.addInitScript(probe);
   await page.route('**/version.txt*',r=>r.fulfill({body:mode==='before'?'81':fs.readFileSync(path.join(root,'version.txt'),'utf8')}));
   await page.route(u=>u.hostname==='127.0.0.1'&&(u.pathname==='/'||u.pathname.startsWith('/js/')),async r=>{
    const file=new URL(r.request().url()).pathname.slice(1)||'index.html';
    let body=mode==='before'?snapshot[file]:fs.readFileSync(path.join(root,file),'utf8');
    if(body===undefined)return r.continue();
    if(file==='index.html')body=body.replace('<script type="module">','<script type="module">\nwindow.__StartupProbe.stage("librariesStart");')
     .replace('  // 실사 나무 생성기',"  window.__StartupProbe.stage('librariesReady');\n  // 실사 나무 생성기")
     .replace('  const files =',"  window.__StartupProbe.stage('scriptsStart');\n  const files =")
     .replace('  await window.G.boot();',"  window.__StartupProbe.stage('scriptsReady');\n  await window.G.boot();\n  window.__StartupProbe.stage('bootReady');");
    if(file==='js/main.js')body='window.__StartupProbe.install();\n'+body;
    if(latency)await new Promise(res=>setTimeout(res,latency));
    await r.fulfill({body,contentType:file.endsWith('.html')?'text/html':'application/javascript'});
   });
   if(latency&&process.env.THREE_DIR)await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',async r=>{await new Promise(res=>setTimeout(res,latency));await r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(process.env.THREE_DIR,r.request().url().split('/three@0.160.0/')[1]))})});
  }});
  try{
   await f.page.waitForFunction(()=>window.__StartupProbe.marks.firstFrame,null,{timeout:120000});
   const result=await f.page.evaluate(()=>({marks:__StartupProbe.marks,events:__StartupProbe.events.filter(e=>e.name!=='longtask'||e.ms>100),resources:performance.getEntriesByType('resource').map(e=>({url:e.name,start:e.startTime,ms:e.duration,bytes:e.transferSize})),models:{guns:Object.keys(G.GunModels.guns).length,lods:Object.keys(G.WorldWeapons.models).length,soldiers:G.Soldiers.templates.length,vegetation:G.Veg.variants.length,ao:G.StaticAO.applied}}));
   result.errors=f.errors;report.runs.push(result);console.log(mode,i+1,JSON.stringify(result.marks));
   console.log(result.events.filter(e=>!['longtask','Assets.analyzeSky','Veg.makeVariant','Veg.makeImpostor'].includes(e.name)).sort((a,b)=>b.ms-a.ms).slice(0,12).map(e=>e.name+' '+Math.round(e.ms)+'ms').join('\n'));
   if(f.errors.length)throw Error(f.errors.join('\n'));
  }finally{await f.close()}
 }
 fs.writeFileSync(path.join(out,mode+'-'+latency+'ms.json'),JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
