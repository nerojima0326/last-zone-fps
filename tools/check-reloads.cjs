// npm i playwright; npx playwright install chromium
// Optional: THREE_DIR, CHROME_BIN, SHOTS (screenshot directory).
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
const results=await page.evaluate(()=>{
 const out=[];const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
 for(const id of G.GUN_IDS)for(const mode of ['empty','tactical']){
  const studio=ReloadStudio;studio.select(id,mode);studio.pause();
  const m=studio.model;assert(m.real,id+' real asset loaded');
  for(const keys of [m.keys.E,m.keys.Tac])if(keys){for(let i=1;i<keys.k.length;i++)assert(keys.k[i][0]>keys.k[i-1][0],id+' increasing hand keys');}
  let max=0;
  for(const fraction of [0,.1,.27,.48,.6,.76,.9,1]){
   studio.seek(studio.duration*fraction);
   studio.scene.updateMatrixWorld(true);
   m.root.traverse(o=>{assert(o.matrixWorld.elements.every(Number.isFinite),id+' finite transform '+o.name)});
   max=Math.max(max,m.armL.cur.length());
  }
  const inst=G.Player.a.weapons[G.Player.a.cur],def=G.WEAPONS[id];assert(inst.mag===def.mag,id+' '+mode+' loaded all ammo: '+inst.mag+'/'+def.mag+' duration='+studio.duration+' R='+JSON.stringify(G.Player.reload));
  out.push({id,mode,seconds:+studio.duration.toFixed(3),maxHand:+max.toFixed(3)});
 }
 return out;
});console.log('Animation cases:',results.length);
assert.equal(errors.length,0,errors.join('\n'));
const logic=await page.evaluate(()=>{
 const P=G.Player, events=[]; let cases=0;
 G.Audio.click=type=>events.push(type);
 for(const id of G.GUN_IDS)for(const dt of [1/30,1/60,1/144,0.1])for(const reserve of [1,2,100])for(const initial of [0,G.WEAPONS[id].mag-1]){
  const def=G.WEAPONS[id], inst={id,mag:initial};
  P.init({cur:def.cls,weapons:{[def.cls]:inst},ammo:{[def.ammo]:reserve}});events.length=0;P.startReload();
  let ticks=0;while(P.reload&&ticks++<4000)P.reloadLogic(dt);
  if(P.reload||inst.mag!==Math.min(def.mag,initial+reserve)||inst.mag+P.a.ammo[def.ammo]!==initial+reserve)throw Error(id+' ammo conservation dt='+dt);
  if(def.reloadType==='mag'){
   const expected=G.Guns.reloadEvents(id,initial===0).map(e=>e[1]);
   if(events.join()!==expected.join())throw Error(id+' sound events lost/duplicated');
   if(initial>0&&events.some(e=>e==='open'||e==='close'))throw Error(id+' tactical reload racked bolt');
  }
  cases++;
 }
 return cases;
});
console.log('Ammo and sound cases:',logic);
if(process.env.SHOTS){
 fs.mkdirSync(process.env.SHOTS,{recursive:true});
 for(const id of ['ka47','de7']){
  await page.evaluate(id=>{ReloadStudio.select(id);ReloadStudio.pause();ReloadStudio.seek(ReloadStudio.duration*.76)},id);
  await page.screenshot({path:path.join(process.env.SHOTS,id+'.png')});
 }
}
console.log('PASS: 30 real-asset animations, 240 poses, 360 ammo/sound cases; no page errors.');
}catch(e){console.error(e.stack);process.exitCode=1}finally{await browser.close();server.close()}
})();
