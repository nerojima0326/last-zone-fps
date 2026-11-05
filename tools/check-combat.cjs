// npm i playwright; npx playwright install chromium
// Optional: THREE_DIR, CHROME_BIN, SHOTS (screenshot directory).
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.css':'text/css','.html':'text/html','.js':'application/javascript','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.jpg':'image/jpeg','.png':'image/png','.hdr':'application/octet-stream'};
(async()=>{
const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(file.endsWith('/'))file+='index.html';if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return}res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');fs.createReadStream(file).pipe(res)}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('console:',m.text())});
if(process.env.THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',route=>{const file=path.join(process.env.THREE_DIR,route.request().url().split('/three@0.160.0/')[1]);return route.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(file)})});
await page.addInitScript(()=>localStorage.setItem('lastzone_opts',JSON.stringify({quality:'potato',qv:2,players:24,loadout:'all',fpsTarget:60})));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(()=>window.G&&G.UI&&G.Game&&document.querySelector('#menu:not(.hidden)'),null,{timeout:180000});
console.log('Full game menu ready');
await page.click('#trainBtn');
await page.waitForFunction(()=>G.Game.training&&G.Game.state==='playing',null,{timeout:30000});
await page.evaluate(()=>{const a=G.Game.player;a.cur='rifle';a.weapons.rifle={id:'ar7',mag:30};G.VM.set('ar7');G.Player.reload=null;G.Player.cycleT=-1;G.Player.pumpT=-1;});
await page.keyboard.press('Tab');
await page.waitForSelector('#attachmentPanel:not([hidden])',{timeout:10000});
await page.click('[data-slot=optic][data-value=holo]');
await page.click('[data-slot=muzzle][data-value=suppressor]');
await page.click('[data-slot=under][data-value=grip]');
await page.click('[data-slot=side][data-value=laser]');
console.log('Attachment UI',await page.evaluate(()=>({selection:G.Game.player.weapons.rifle, assets:Object.keys(G.Attachments.models),groups:G.VM.models.ar7.accessories.children.length,paused:G.paused})));

await page.keyboard.press('Tab');
await page.waitForSelector('#attachmentPanel[hidden]',{state:'attached'});
const checks=await page.evaluate(()=>{
 const town=G.World.towns.find(t=>t.name==='북부 전초기지');if(!town)throw Error('new combat area missing');
 const ranges=[],saveNoise=G.Game.onNoise;G.Game.onNoise=(pos,r)=>ranges.push(r);const shooter=G.Game.player,inst=shooter.weapons.rifle;inst.attachments.muzzle=null;G.Game.onShot(shooter,G.WEAPONS.ar7);inst.attachments.muzzle='suppressor';G.Game.onShot(shooter,G.WEAPONS.ar7);G.Game.onNoise=saveNoise;if(!(ranges[1]<ranges[0]))throw Error('suppressor noise');
 const W=G.World,old={queryBoxes:W.queryBoxes,rayBoxes:W.rayBoxes,heightAt:W.heightAt};const actor={pos:new THREE.Vector3(0,0,0)};const bot=new G.Bot(actor);
 W.queryBoxes=(x,z,x1,z1,cb)=>cb({minX:2,maxX:3,minY:0,maxY:2,minZ:-1,maxZ:1});W.heightAt=()=>0;let n=0;W.rayBoxes=()=>++n%2===1?Infinity:1;
 const cover=bot.findCover({pos:new THREE.Vector3(10,0,0)});Object.assign(W,old);if(!cover||!Number.isFinite(bot.coverPos.x))throw Error('bot cover selection');
 let optics=0;for(const id of G.GUN_IDS)for(const o of Object.values(G.VM.models[id].scopes)){if(!o.sight.toArray().every(Number.isFinite)||!o.ads.toArray().every(Number.isFinite))throw Error('invalid sight '+id);optics++}
 return {town:town.name,lootSpots:G.World.lootSpots.filter(p=>Math.hypot(p.x-town.x,p.z-town.z)<town.r).length,noise:ranges,cover:bot.coverPos.toArray(),optics};
});console.log('Combat checks',checks);if(checks.lootSpots<1)throw Error('new area lacks loot');
const result=await page.evaluate(()=>{
 G.paused=true;const P=G.Player,a=G.Game.player,output=[];
 for(const id of ['ar7','aa12','p92','de7','s12','r45']){
  const def=G.WEAPONS[id];a.cur=def.cls;a.weapons[a.cur]={id,mag:0};a.ammo[def.ammo]=100;P.reload=null;P.sw=null;P.throwSt=null;P.startReload();
  let steps=0;while(P.reload&&steps++<3000)P.reloadLogic(1/60);
  if(a.weapons[a.cur].mag!==def.mag)throw Error(id+' training reload');output.push(id);
 }
 const heard=[],shot=G.Audio.shot;G.Audio.shot=(id,pos,own)=>{heard.push(id);shot.call(G.Audio,id,pos,own)};for(const id of G.GUN_IDS){const d=G.WEAPONS[id];a.cur=d.cls;a.weapons[a.cur]={id,mag:d.mag};G.VM.set(id);P.fire(d,a.weapons[a.cur],G.U.now())}G.Audio.shot=shot;if(heard.length!==15)throw Error('actual firearm path did not route all weapon IDs');P.pumpT=.2;P.cycleT=.2;P.switchTo('rifle');if(P.pumpT!==-1||P.cycleT!==-1)throw Error('switch leaves a weapon action playing');return {training:G.Game.training,checked:output,fired:heard,version:window.LZ_BUILD};
});
assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify(result));console.log('PASS: main menu, training entry, 6 weapon reloads in actual game.');
}catch(e){console.error(e.stack);process.exitCode=1}finally{await browser.close();server.close()}
})();
