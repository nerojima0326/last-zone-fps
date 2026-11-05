// npm i playwright; npx playwright install chromium
// Optional: THREE_DIR, CHROME_BIN, BASELINE_PLAYER (v19 source), REPORT (JSON).
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.jpg':'image/jpeg','.png':'image/png','.hdr':'application/octet-stream'};
(async()=>{
const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(file.endsWith('/'))file+='index.html';if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return}res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');fs.createReadStream(file).pipe(res)}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('console:',m.text())});
if(process.env.THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',route=>{const file=path.join(process.env.THREE_DIR,route.request().url().split('/three@0.160.0/')[1]);return route.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(file)})});
await page.goto(`http://127.0.0.1:${server.address().port}/tools/reloads.html`);
await page.waitForFunction(()=>window.ReloadStudio?.ready,null,{timeout:120000});
console.log('Studio loaded');await page.evaluate(()=>ReloadStudio.pause());
await page.evaluate(async()=>{G.Audio.init();await G.Audio.ctx.resume();if(!await G.WeaponAudio.load(G.Audio.ctx))throw Error('recorded audio bank failed to load')});
const timing=await page.evaluate(()=>{
 const out=[],P=G.Player;const click=G.Audio.click;
 for(const id of G.GUN_IDS)for(const empty of [false,true]){
  const d=G.WEAPONS[id],events=[],dt=.001;let elapsed=0;
  P.init({cur:d.cls,weapons:{[d.cls]:{id,mag:empty?0:Math.max(1,Math.floor(d.mag/2))}},ammo:{[d.ammo]:100}});
  G.Audio.click=(type,weaponId)=>events.push({type,weaponId,at:elapsed});P.startReload();
  if(P.reload.kind==='mag'||P.reload.kind==='revolver'){
   if(Math.abs(P.reload.dur-d.reload*(empty?1.35:1))>1e-8)throw Error(id+' empty duration');
  }
  while(P.reload&&elapsed<30){elapsed+=dt;P.reloadLogic(dt)}
  if(P.reload)throw Error(id+' reload timeout');
  if(events.some(e=>e.weaponId!==id))throw Error(id+' missing weapon identity in sound event');
  out.push({id,empty,seconds:elapsed,events});
 }
 G.Audio.click=click;return out;
});
if(process.env.BASELINE_PLAYER){
 const old=await browser.newPage();
 if(process.env.THREE_DIR)await old.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(process.env.THREE_DIR,route.request().url().split('/three@0.160.0/')[1]))}));
 await old.route('**/js/player.js?*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(process.env.BASELINE_PLAYER)}));
 await old.goto(`http://127.0.0.1:${server.address().port}/tools/reloads.html`);await old.waitForFunction(()=>window.ReloadStudio?.ready,null,{timeout:120000});
 const baseline=await old.evaluate(()=>{
  ReloadStudio.pause();const out=[],P=G.Player;G.Audio.click=()=>{};
  for(const id of G.GUN_IDS)for(const empty of [false,true]){
   const d=G.WEAPONS[id];let t=0;P.init({cur:d.cls,weapons:{[d.cls]:{id,mag:empty?0:Math.max(1,Math.floor(d.mag/2))}},ammo:{[d.ammo]:100}});P.startReload();
   while(P.reload&&t<30){t+=.001;P.reloadLogic(.001)}out.push({id,empty,seconds:t});
  }return out;
 });
 for(let i=0;i<timing.length;i++)assert(Math.abs(timing[i].seconds-baseline[i].seconds*(timing[i].empty?1.35:1))<.015,timing[i].id+' duration changed outside empty reload scale');
 console.log('PASS: all 15 empty reloads +35% duration; all 15 tactical durations unchanged versus v19.');await old.close();
}
const audio=await page.evaluate(async timing=>{
 const W=G.WeaponAudio,output=[];W.variation=0;
 if(Object.keys(W.buffers).length!==16)throw Error('all 16 MP3 banks must decode');
 const fingerprint=data=>{let h=2166136261;for(let i=0;i<data.length;i+=13){h^=(data[i]*32767)|0;h=Math.imul(h,16777619)}return h>>>0};
 const energy=data=>{let sum=0,peak=0,active=0;for(const v of data){sum+=v*v;peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>.0001)active++}return {peak,rms:Math.sqrt(sum/data.length),active}};
 async function render(id,kind){
  const row=timing.find(x=>x.id===id&&x.empty),seconds=kind==='reload'?row.seconds+.7:kind==='burst'?3.5:2;
  const c=new OfflineAudioContext(2,Math.ceil(seconds*44100),44100),comp=c.createDynamicsCompressor();
  comp.threshold.value=-14;comp.knee.value=12;comp.ratio.value=6;comp.attack.value=.003;comp.release.value=.25;comp.connect(c.destination);
  const master=c.createGain();master.gain.value=.75;master.connect(comp);const verb=c.createGain();verb.gain.value=0;verb.connect(master);
  const clock={currentTime:0};for(const key of ['createBufferSource','createBiquadFilter','createGain','createStereoPanner'])clock[key]=c[key].bind(c);
  const bus={ctx:clock,master,verb,spatial:()=>({g:1,pan:0,lp:20000,rev:0}),_budget:()=>true};
  if(kind==='reload')for(const event of row.events){clock.currentTime=event.at;W.event(bus,event.type,id)}
  else if(kind==='burst')for(let t=0;t<1.8;t+=60/G.WEAPONS[id].rpm){clock.currentTime=t;W.fire(bus,id,null,true)}
  else if(kind==='far'){bus.spatial=G.Audio.spatial.bind(G.Audio);W.fire(bus,id,{x:120,y:0,z:0},false)}
  else W.fire(bus,id,null,true);
  const b=await c.startRendering(),data=b.getChannelData(0),stats=energy(data);
  if(kind==='shot'){const start=data.findIndex(v=>Math.abs(v)>.025);if(start<0||start/44100>.025)throw Error(id+' delayed shot attack: '+start/44100)}
  if(!Number.isFinite(stats.rms)||stats.active<500||stats.peak>1.001)throw Error(id+' '+kind+' silent, invalid, or clipped '+JSON.stringify(stats));
  return {...stats,hash:fingerprint(data)};
 }
 const originalFoley=W.foley;let extraClick=0;W.foley=()=>{extraClick++};await render('ar7','shot');W.foley=originalFoley;if(extraClick)throw Error('extra click layered on gunshot');
 for(const id of G.GUN_IDS){const shot=await render(id,'shot'),reload=await render(id,'reload');output.push({id,shot,reload})}
 for(const row of output)if(row.reload.peak>=row.shot.peak*.65)throw Error(row.id+' handling masks the gun report');
 for(const kind of ['shot','reload'])if(new Set(output.map(r=>r[kind].hash)).size!==15)throw Error('weapon '+kind+' audio is shared');
 const far=await render('ar7','far');if(far.rms>=output.find(x=>x.id==='ar7').shot.rms*.3)throw Error('distant report is not attenuated');
 const bursts=[];for(const id of ['ar7','aa12','g18'])bursts.push({id,...await render(id,'burst')});
 await new Promise(r=>setTimeout(r,50));if(W.voices.length)throw Error('audio nodes leak after completion: '+W.voices.length);
 // A missing bank must hand control back to the existing synthesizer.
 const saved=W.buffers;W.buffers={};if(W.fire({spatial:()=>({g:1})},'ar7',null,true)!==false)throw Error('missing sample fallback');W.buffers=saved;
 return {banks:Object.keys(W.buffers).length,weapons:output,bursts,far};
},timing);
if(process.env.REPORT)fs.writeFileSync(process.env.REPORT,JSON.stringify({timing,audio},null,2));
console.log(JSON.stringify(audio,null,2));
assert.equal(errors.length,0,errors.join('\n'));
console.log('PASS: 16 recorded banks decode; 15 unique shot/reload renders; safe automatic bursts, voice cleanup and missing-bank fallback.');

}catch(e){console.error(e.stack);process.exitCode=1}finally{await browser.close();server.close()}
})();
