// 같은 S24 FE 화면·에셋으로 변경 전 소스와 현재 소스의 GL 저장소를 비교한다.
// MOBILE_BASE_REF=4b5219e MOBILE_SHOTS=/tmp/lz-v91-before node tools/bench-mobile-memory.cjs
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process'),fixture=require('./optimize/browser-fixture.cjs'),gpu=require('./optimize/gpu-allocations.cjs');
const base=process.env.MOBILE_BASE_REF,out=path.resolve(process.env.MOBILE_SHOTS||'/tmp/lz-v91-before'),original=new Map();let ref=null;
if(base){
 ref=execFileSync('git',['rev-parse','--verify',base+'^{commit}'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}).trim();
 for(const file of ['index.html','version.txt','js/core.js','js/main.js','js/ui.js','js/armory.js','js/render-prep.js','js/texture-quality.js','js/perf.js'])original.set('/'+file,execFileSync('git',['show',ref+':'+file],{cwd:path.resolve(__dirname,'..')}));
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const f=await fixture({viewport:{width:412,height:892},deviceScaleFactor:2.625,contextOptions:{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'},initialOptions:{quality:'low',players:40},route:async page=>{
  await page.addInitScript(gpu);if(original.size)await page.route('**/*',r=>{const url=new URL(r.request().url()),file=url.pathname==='/'?'/index.html':url.pathname;if(!original.has(file))return r.fallback();return r.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/plain',body:original.get(file)})});
 }}),report={sourceRef:ref||'작업 트리'};
 try{
  const {page}=f;await page.evaluate(()=>{window.requestAnimationFrame=()=>0;G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.UI.showPause(false)});
  for(const stage of ['menu','training']){
   if(stage==='training')await page.evaluate(()=>{G.startGame({...G.UI.opts,mode:'training'});G.paused=true;G.UI.showPause(false);for(let i=0;i<3;i++){G.Player.update(1/60);G.Input.endFrame()}});
   report[stage]=await page.evaluate(()=>{G.UI.update(1/60);G.renderNow();G.Perf.gpuWait();const c=G.renderer.domElement,r=c.getBoundingClientRect(),rt=G.composerRT(),vm=G.viewmodelRT();return{build:LZ_BUILD,viewport:[document.documentElement.clientWidth,document.documentElement.clientHeight],dpr:devicePixelRatio,stage:[innerWidth,innerHeight],stageScale:__stageScale,canvas:[c.width,c.height],display:[r.width,r.height],rendererPR:G.renderer.getPixelRatio(),scene:[rt.width,rt.height,rt.samples],viewmodel:[vm.width,vm.height,vm.samples],gpu:__lzGpuAlloc.snapshot()}});
   await page.screenshot({path:path.join(out,stage+'.png'),timeout:90000});console.log(stage,Math.round(report[stage].gpu.estimatedBytes/1048576)+' MiB');
  }
  report.errors=f.errors;fs.writeFileSync(path.join(out,'memory.json'),JSON.stringify(report,null,2)+'\n');
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
