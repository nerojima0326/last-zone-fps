// Uses the real character and reload previews, plus the actual game boot and training.
// Optional: CHROME_BIN, THREE_DIR, SHOTS; npm install playwright.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),shots=process.env.SHOTS;
const mime={'.html':'text/html','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.css':'text/css'};
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.text().includes('[Patch'))console.log(m.text());});
  if(process.env.THREE_DIR)await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(process.env.THREE_DIR,route.request().url().split('/three@0.160.0/')[1]))}));
  const base='http://127.0.0.1:'+server.address().port;
  const snap=async name=>{if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,name+'.png')});}};
  await page.goto(base+'/tools/people.html');await page.waitForFunction(()=>window.PeopleStudio?.ready,null,{timeout:120000});
  const people=await page.evaluate(()=>{
   const s=PeopleStudio,T=THREE;s.pause();const results=[];const ensure=(v,m)=>{if(!v)throw Error(m);};
   ensure(s.models.every(m=>m.soldier?.patch),'Imported people did not load');
   ensure(s.models[0].soldier.T!==s.models[1].soldier.T,'Both character variants must be exercised');
   for(const m of s.models){m.setLOD(true,false);ensure(!m.soldier.root.visible&&!m.body.visible&&m.lodMesh.visible,'Far character LOD');m.setLOD(false,false);ensure(m.soldier.root.visible&&m.body.visible&&!m.lodMesh.visible,'Near character LOD');}
   const hips=[];
   for(const pose of ['idle','run','crouch','air','chute','knocked','dead']){
    s.pose(pose);for(let i=0;i<60;i++)s.step(1/60);
    const bounds=[];
    for(const m of s.models){
     m.root.traverse(o=>ensure(o.matrixWorld.elements.every(Number.isFinite),'Invalid character transform '+pose+' '+o.name));
     const box=new T.Box3(),v=new T.Vector3();
     for(const mesh of m.soldier.meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);box.expandByPoint(v.applyMatrix4(mesh.matrixWorld));}
     const size=box.getSize(new T.Vector3());ensure(size.length()<4&&size.length()>1,'Exploded/collapsed character skin '+pose);bounds.push(size.toArray());
     if(pose==='idle'||pose==='crouch')hips.push({pose,name:m.soldier.T.name,y:m.soldier.hip.getWorldPosition(new T.Vector3()).y});
    }
    results.push({pose,bounds});
   }
   for(const name of ['cargo','sweater'])ensure(hips.find(x=>x.name===name&&x.pose==='idle').y-hips.find(x=>x.name===name&&x.pose==='crouch').y>.25,'Crouching did not lower pelvis');
   s.pose('idle');s.step(1/60);return {variants:s.models.map(m=>m.soldier.T.name),poses:results,hips};
  });console.log('People:',JSON.stringify(people));await snap('patch-people');
  await page.goto(base+'/tools/reloads.html');await page.waitForFunction(()=>window.ReloadStudio?.ready,null,{timeout:120000});
  const arms=await page.evaluate(()=>{
   ReloadStudio.pause();const out=[];for(const id of G.GUN_IDS)for(const mode of ['empty','tactical']){
    ReloadStudio.select(id,mode);ReloadStudio.pause();const m=ReloadStudio.model;
    for(const a of [m.armL,m.armR])if(a.skinSource!=='patch:mpfb:human-0408'||a.meshes.length!==2)throw Error('Missing imported arm '+id);
    for(const f of [0,.27,.6,.76,1]){ReloadStudio.seek(ReloadStudio.duration*f);ReloadStudio.scene.updateMatrixWorld(true);
     for(const a of [m.armL,m.armR])for(const mesh of a.meshes){const v=new THREE.Vector3();let nearest=0;
      for(let i=0;i<mesh.geometry.attributes.position.count;i+=7){mesh.getVertexPosition(i,v);if(![v.x,v.y,v.z].every(Number.isFinite)||v.length()>2)throw Error('Invalid imported arm skin '+id+' '+f);nearest=Math.max(nearest,v.distanceTo(a.bW.position));}
      if(nearest>1.4)throw Error('Arm geometry escaped its rig '+id);
     }
    }out.push({id,mode});
   }return {cases:out.length,ready:G.PatchCharacters.armsReady};
  });console.log('Arms:',JSON.stringify(arms));
  await page.evaluate(()=>{ReloadStudio.select('ar7','empty');ReloadStudio.pause();ReloadStudio.seek(0);});await snap('patch-arms-rifle');
  await page.evaluate(()=>{document.getElementById('view').value='leftHand';ReloadStudio.seek(ReloadStudio.duration*.6);});await snap('patch-arms-reload');
  await page.route('**/assets/patch/people/**',route=>route.abort());
  await page.goto(base+'/tools/reloads.html');await page.waitForFunction(()=>window.ReloadStudio?.ready,null,{timeout:120000});
  const fallback=await page.evaluate(()=>{ReloadStudio.pause();ReloadStudio.select('ar7');ReloadStudio.seek(.5);return {ready:G.PatchCharacters.armsReady,imported:!!G.VM.models.ar7.armL.skinSource};});
  assert.equal(fallback.ready,false);assert.equal(fallback.imported,false);await page.unroute('**/assets/patch/people/**');console.log('Missing-file fallback: PASS');
  await page.addInitScript(()=>localStorage.setItem('lastzone_opts',JSON.stringify({quality:'low',qv:2,tod:'day',players:24,loadout:'all',fpsTarget:60})));
  await page.goto(base+'/index.html');await page.waitForFunction(()=>window.G?.UI&&document.querySelector('#menu:not(.hidden)'),null,{timeout:180000});
  assert(await page.evaluate(()=>G.Soldiers.patch&&G.PatchCharacters.ready&&G.PatchCharacters.armsReady),'Game did not use Patch assets');
  await page.click('#trainBtn');await page.waitForFunction(()=>G.Game.training&&G.Training.active);
  const game=await page.evaluate(()=>{G.Input.unlock();G.paused=true;return {build:window.LZ_BUILD,targets:G.Training.targets.length,guns:G.Training.items.filter(i=>G.GUN_IDS.includes(i.kind)).length,arms:G.VM.models.ar7.armL.skinSource};});
  assert.equal(game.build,'34');assert.equal(game.targets,14);assert.equal(game.guns,15);
  await page.waitForTimeout(150);await page.evaluate(()=>{G.paused=true;G.UI.showPause(false);G.renderNow();});await snap('patch-game-training');console.log('Actual game:',JSON.stringify(game));
  assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: two characters, seven poses, 30 imported-arm reload cases, missing-file fallback, actual game training; no page errors.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
