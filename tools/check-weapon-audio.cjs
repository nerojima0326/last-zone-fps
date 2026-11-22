// npm i playwright; npx playwright install chromium
// Optional: THREE_DIR, CHROME_BIN, BASELINE_PLAYER (legacy studio), REPORT, RENDER_AUDIO.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/audio/weapons/manifest.json'),'utf8'));
for(const bank of [manifest.switch,...Object.values(manifest.weapons).flatMap(w=>[w.shot,w.fx])]){
 const digest=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'assets/audio/weapons',bank.path))).digest('hex').slice(0,12);
 assert.equal(bank.sha,digest,bank.path+' cache hash mismatch');
}
const mime={'.html':'text/html','.js':'application/javascript','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.jpg':'image/jpeg','.png':'image/png','.hdr':'application/octet-stream'};
(async()=>{
const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(file.endsWith('/'))file+='index.html';if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return}res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');fs.createReadStream(file).pipe(res)}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('console:',m.text())});
if(process.env.THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',route=>{const file=path.join(process.env.THREE_DIR,route.request().url().split('/three@0.160.0/')[1]);return route.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(file)})});
await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
if(process.env.BASELINE_PLAYER){
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/reloads.html`);
 await page.waitForFunction(()=>window.ReloadStudio?.ready,null,{timeout:120000});
 await page.evaluate(()=>ReloadStudio.pause());
}else{
 await page.addInitScript(()=>localStorage.setItem('lastzone_opts',JSON.stringify({quality:'potato',qv:2,players:24,loadout:'all',fpsTarget:60})));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(()=>window.G?.UI&&document.querySelector('#loading.hidden'),null,{timeout:180000});
 await page.click('#trainBtn');
 await page.waitForFunction(()=>G.Training.active&&G.M4Viewmodel.ready&&G.G17Pilot.ready&&Object.keys(G.AssetVM.PACKS).every(k=>G.AssetVM.packs[k]?.ready),null,{timeout:240000});
 await page.evaluate(()=>{G.onLockChange=()=>{};G.Input.unlock();G.paused=true;G.UI.showPause(false);window.requestAnimationFrame=()=>0;});
}
console.log('Audio scene loaded');
await page.evaluate(async()=>{G.Audio.init();await G.Audio.ctx.resume();if(!await G.WeaponAudio.load(G.Audio.ctx))throw Error('recorded audio bank failed to load')});
const timing=await page.evaluate(()=>{
 const out=[],P=G.Player;const click=G.Audio.click;
 for(const id of G.GUN_IDS)for(const empty of [false,true]){
  const d=G.WEAPONS[id],events=[],dt=.001;let elapsed=0;
  const actor=G.Game?.player||{};Object.assign(actor,{cur:d.cls,weapons:{[d.cls]:{id,mag:empty?0:Math.max(1,Math.floor(d.mag/2)),attachments:{}}},ammo:{[d.ammo]:100}});P.init(actor);
  G.Audio.click=(type,weaponId)=>events.push({type,weaponId,at:elapsed});P.startReload();
  if(P.reload.kind==='mag'||P.reload.kind==='revolver'){
   if(Math.abs(P.reload.dur-G.Guns.reloadDuration(id,empty))>1e-8)throw Error(id+' empty duration');
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
 for(let i=0;i<timing.length;i++)assert(Math.abs(timing[i].seconds-baseline[i].seconds*(timing[i].empty?1.1:1))<.015,timing[i].id+' duration changed outside empty reload scale');
 console.log('PASS: all empty reload durations scaled; tactical durations unchanged.');await old.close();
}
const audio=await page.evaluate(async timing=>{
 const W=G.WeaponAudio,output=[];const rnd=Math.random;Math.random=()=>.5;
 const expectedBanks=new Set([W.manifest.switch,...Object.values(W.manifest.weapons).flatMap(w=>[w.shot,w.fx])].map(b=>b.path)).size;
 if(Object.keys(W.buffers).length!==expectedBanks)throw Error('all '+expectedBanks+' unique MP3 banks must decode');
 const fingerprint=data=>{let h=2166136261;for(let i=0;i<data.length;i+=13){h^=(data[i]*32767)|0;h=Math.imul(h,16777619)}return h>>>0};
 const energy=data=>{let sum=0,peak=0,active=0;for(const v of data){sum+=v*v;peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>.0001)active++}return {peak,rms:Math.sqrt(sum/data.length),active}};
 async function render(id,kind){
  const row=timing.find(x=>x.id===id&&x.empty),seconds=kind==='reload'?row.seconds+.7:kind==='burst'||kind==='far'?3.5:2;
  const c=new OfflineAudioContext(2,Math.ceil(seconds*44100),44100),comp=c.createDynamicsCompressor();
  comp.threshold.value=-14;comp.knee.value=12;comp.ratio.value=6;comp.attack.value=.003;comp.release.value=.25;comp.connect(c.destination);
  const master=c.createGain();master.gain.value=.75;master.connect(comp);const verb=c.createGain();verb.gain.value=0;verb.connect(master);
  const clock={currentTime:0,sampleRate:44100};for(const key of ['createBuffer','createBufferSource','createBiquadFilter','createGain','createStereoPanner'])clock[key]=c[key].bind(c);
  const bus={ctx:clock,master,verb,spatial:()=>({g:1,pan:0,lp:20000,rev:0}),_budget:()=>true};
  if(kind==='reload')for(const event of row.events){clock.currentTime=event.at;if(!W.event(bus,event.type,id))throw Error(id+' unplayable reload cue: '+event.type)}
  else if(kind==='burst')for(let t=0;t<1.8;t+=60/G.WEAPONS[id].rpm){clock.currentTime=t;W.fire(bus,id,null,true)}
  else if(kind==='far'){bus.spatial=pos=>G.Audio.spatial.call({listener:{x:0,y:0,z:0,yaw:0}},pos,30);W.fire(bus,id,{x:120,y:0,z:0},false)}
  else W.fire(bus,id,null,true);
  const b=await c.startRendering(),data=b.getChannelData(0),stats=energy(data);
  if(kind==='shot'){const start=data.findIndex(v=>Math.abs(v)>.025);if(start<0||start/44100>.025)throw Error(id+' delayed shot attack: '+start/44100)}
  if(!Number.isFinite(stats.rms)||stats.active<500||stats.peak>1.001)throw Error(id+' '+kind+' silent, invalid, or clipped '+JSON.stringify(stats));
  return {...stats,hash:fingerprint(data)};
 }
 for(const id of G.GUN_IDS){const shot=await render(id,'shot'),reload=await render(id,'reload');output.push({id,shot,reload})}
 // 게임 압축기는 총성 피크를 약 9dB 누른다. 압축 전에는 조작음이 총성보다 12dB 이상 작다.
 for(const row of output)if(row.reload.peak>=row.shot.peak*.8)throw Error(row.id+' handling masks the gun report '+JSON.stringify(output.map(r=>[r.id,+r.shot.peak.toFixed(3),+r.reload.peak.toFixed(3),+r.shot.rms.toFixed(4),+r.reload.rms.toFixed(4)])));
 for(const kind of ['shot','reload'])if(new Set(output.map(r=>r[kind].hash)).size!==G.GUN_IDS.length)throw Error('weapon '+kind+' audio is shared');
 const far=await render('ar7','far');if(far.rms>=output.find(x=>x.id==='ar7').shot.rms*.3)throw Error('distant report is not attenuated');
 const bursts=[];for(const id of ['ar7','aa12','g18'])bursts.push({id,...await render(id,'burst')});
 await new Promise(r=>setTimeout(r,50));const retained=W.voices.filter(v=>v.ctx!==G.Audio.ctx);if(retained.length)throw Error('offline audio nodes leak after completion: '+JSON.stringify(retained.map(v=>({role:v.role,t:v.t}))));
 // Unknown sounds retain the generic path; known guns have an original fallback.
 if(W.fire({},'unknown-weapon',null,true)!==false)throw Error('unknown weapon fallback');
 Math.random=rnd;
 return {banks:Object.keys(W.buffers).length,weapons:output,bursts,far};
},timing);
if(process.env.REPORT)fs.writeFileSync(process.env.REPORT,JSON.stringify({timing,audio,pendingMixChecks:true},null,2));
const mix=await page.evaluate(require('./audio-mix-checks.cjs'),{render:!!process.env.RENDER_AUDIO,timing});
if(process.env.RENDER_AUDIO){
 fs.mkdirSync(process.env.RENDER_AUDIO,{recursive:true});
 for(const sample of mix.renders){
  const pcm=Buffer.from(sample.pcm,'base64'),header=Buffer.alloc(44);
  header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(44100,24);header.writeUInt32LE(44100*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  fs.writeFileSync(path.join(process.env.RENDER_AUDIO,sample.name+'.wav'),Buffer.concat([header,pcm]));
 }
}
delete mix.renders;
if(process.env.REPORT)fs.writeFileSync(process.env.REPORT,JSON.stringify({timing,audio,mix},null,2));
console.log(JSON.stringify(audio,null,2));
console.log('Mix checks',JSON.stringify({weapons:mix.weapons.length,originalFallback:mix.originalFallback,staleManifest:mix.staleManifest,stereoAttack:mix.stereoAttack,isolatedCues:mix.isolatedCues,mute:mix.mute,fallbackMute:mix.fallbackMute,cleanedUp:mix.cleanedUp}));
assert.equal(errors.length,0,errors.join('\n'));
console.log('PASS: All unique audio banks; 30 original reports, reloads, bursts and generated fallbacks; suppression, mute, cue isolation and cleanup.');

}catch(e){console.error(e.stack);process.exitCode=1}finally{await browser.close();server.close()}
})();
