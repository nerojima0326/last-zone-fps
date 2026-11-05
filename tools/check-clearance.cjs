// npm i playwright; npx playwright install chromium
// Optional: THREE_DIR, CHROME_BIN, REPORT (JSON), BASELINE_WEAPONS (old source; expected failure).
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
if(process.env.BASELINE_WEAPONS)await page.route('**/js/weapons.js?*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(process.env.BASELINE_WEAPONS)}));
await page.goto(`http://127.0.0.1:${server.address().port}/tools/reloads.html`);
await page.waitForFunction(()=>window.ReloadStudio?.ready,null,{timeout:120000});
console.log('Studio loaded');await page.evaluate(()=>ReloadStudio.pause());
// Optional regression replay: use an old weapons.js while measuring with today's envelopes.
if(process.env.BASELINE_WEAPONS){
 const source=fs.readFileSync(path.join(root,'js/weapons.js'),'utf8');
 const helpers=source.slice(source.indexOf('function armEnvelopes('),source.indexOf('// Keep the elbow'));
 await page.addScriptTag({content:`(()=>{const THREE=window.THREE,G=window.G,U=G.U,V3=THREE.Vector3;${helpers};window.clearanceBaseline=true;G.Guns.armOverlap=armOverlap;for(const m of Object.values(G.VM.models))if(m.def){m.armObstacles=armEnvelopes(m.gun);for(const arm of [m.armL,m.armR])arm.obstacles=m.armObstacles;}})()`});
}
const results=await page.evaluate(()=>{
 const out=[];let frames=0;
 for(const id of G.GUN_IDS)for(const mode of ['empty','tactical'])for(const fps of [30,60,144]){
  const st=ReloadStudio;st.select(id,mode);st.pause();const m=st.model,byMode={};
  for(let time=0;time<st.duration;time+=1/fps){
   st.advance(1/fps);frames++;const R=st.state;if(!R)continue;
   const p=R.kind==='mag'?R.t/R.dur:R.t/G.Player.phaseDur(R,m.def);
   for(const [side,arm]of [['L',m.armL],['R',m.armR]]){
    const key=side+':'+arm.contactMode,depth=G.Guns.armOverlap(arm,arm.bE.position,arm.bW.position,36);
    if(!byMode[key]||depth>byMode[key].mm/1000)byMode[key]={mm:depth*1000,p,phase:R.phase};
   }
   // The handle must follow the solved hand in the same frame.
   const T=m.keys.E?.T;
   if(!window.clearanceBaseline&&mode==='empty'&&R.kind==='mag'&&T?.chA!==undefined&&p>=T.chA&&p<T.chRel){
    const expected=m.rest.charge.z+G.U.clamp(m.armL.contact.z-m.keys.chGrab.z,0,.075);
    if(Math.abs(m.parts.charge.position.z-expected)>.001)throw Error(id+' handle lags hand at '+fps+' FPS');
   }
  }out.push({id,mode,fps,byMode});
 }return {frames,cases:out};
});
const active=new Set(['handle','slide','bolt','pinch','button','buttonThumb','loader','shell','cylinder']);
const failures=[];let maxActive=0,maxReturn=0;
for(const row of results.cases)for(const [key,pose]of Object.entries(row.byMode)){
 const name=key.slice(2),operating=active.has(name),returning=['support','reach','shellReach','grip'].includes(name);
 if(operating)maxActive=Math.max(maxActive,pose.mm);
 if(returning)maxReturn=Math.max(maxReturn,pose.mm);
 if((operating&&pose.mm>3)||(returning&&pose.mm>10))failures.push({...row,byMode:undefined,key,...pose});
}
if(process.env.REPORT)fs.writeFileSync(process.env.REPORT,JSON.stringify(results,null,2));
console.log(JSON.stringify({cases:results.cases.length,frames:results.frames,maxActiveMm:maxActive,maxReturnMm:maxReturn,failures},null,2));
assert.equal(failures.length,0,'arm/receiver clearance regression; see poses above');
assert.equal(errors.length,0,errors.join('\n'));
console.log('PASS: empty/tactical reload clearance at 30, 60, 144 FPS; moving handles stay in the solved hand.');

}catch(e){console.error(e.stack);process.exitCode=1}finally{await browser.close();server.close()}
})();
