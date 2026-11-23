// 동일한 v80/v81 장면을 브라우저 DPR 1.5에서 비교한다. 실제 GPU 게임 FPS로 환산하지 않는다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),fixture=require('./optimize/browser-fixture.cjs');
const mode=process.argv[2]||'before',out=process.argv[3]||'/tmp/lz-v81-clarity',base='69bf2f2bca0c290287f5aff2823cad2d4bc2d75b';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const old={};
 if(mode==='before')for(const file of ['index.html',...cp.execFileSync('git',['ls-tree','-r','--name-only',base,'js'],{encoding:'utf8'}).trim().split('\n')])old[file]=cp.execFileSync('git',['show',base+':'+file],{encoding:'utf8'});
 const f=await fixture({query:'perf=1',deviceScaleFactor:1.5,viewport:{width:800,height:450},route:async page=>{
  if(mode==='before'){
   await page.route('**/version.txt*',r=>r.fulfill({body:'80'}));
   await page.route(u=>{const p=new URL(u).pathname;return p==='/'||old[p.slice(1)]!==undefined},r=>{const p=new URL(r.request().url()).pathname.slice(1)||'index.html';return r.fulfill({contentType:p.endsWith('.html')?'text/html':'application/javascript',body:old[p]})});
  }
 }});
 try{
  const page=f.page;page.setDefaultTimeout(180000);
  await page.evaluate(()=>{
   const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);
   G.onLockChange=()=>{};G.Input.unlock();G.qualityMode='manual';
  });await page.waitForTimeout(100);await page.click('#trainBtn');await page.waitForFunction(()=>G.Training.active);
  await page.evaluate(()=>{G.paused=true;G.Input.unlock();G.UI.showPause(false);G.VM.set(null)});
  const cases=await page.evaluate(()=>{
   const T=THREE,W=G.World,rows=[],center=b=>new T.Vector3((b.minX+b.maxX)/2,(b.minY+b.maxY)/2,(b.minZ+b.maxZ)/2);
   const rails=W.boxes.filter(b=>b.mat==='wood'&&Math.abs(b.maxY-b.minY-1.35)<.002&&Math.max(b.maxX-b.minX,b.maxZ-b.minZ)>2.5&&Math.min(b.maxX-b.minX,b.maxZ-b.minZ)<.09);
   const farmFor=p=>W.towns.filter(t=>t.type==='farm').sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
   const edgeCenter=b=>{const p=center(b),farm=farmFor(p);return b.maxX-b.minX>b.maxZ-b.minZ?Math.abs(p.x-farm.x):Math.abs(p.z-farm.z)};
   rails.sort((a,b)=>edgeCenter(a)-edgeCenter(b));
   for(const b of rails){
    const target=center(b),x=b.maxX-b.minX>b.maxZ-b.minZ;target.y=b.maxY-.55;
    const farm=W.towns.filter(t=>t.type==='farm').sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z))[0];
    const signs=[-1,1].sort((a,b)=>Math.hypot(target.x+(x?0:45*a)-farm.x,target.z+(x?45*a:0)-farm.z)-Math.hypot(target.x+(x?0:45*b)-farm.x,target.z+(x?45*b:0)-farm.z));
    for(const sign of signs){
     const near=target.clone().add(new T.Vector3(x?2:8*sign,1.3,x?8*sign:2)),far=target.clone().add(new T.Vector3(x?5:45*sign,2,x?45*sign:5));
     near.y=Math.max(near.y,W.heightAt(near.x,near.z)+1.3);far.y=Math.max(far.y,W.heightAt(far.x,far.z)+1.5);
     if(Math.hypot(far.x-farm.x,far.z-farm.z)>Math.hypot(target.x-farm.x,target.z-farm.z))continue;
     if([near,far].some(p=>W.footprints.some(b=>p.x>b.minX-1&&p.x<b.maxX+1&&p.z>b.minZ-1&&p.z<b.maxZ+1)))continue;
     const clear=p=>{const d=target.clone().sub(p),length=d.length();d.divideScalar(length);return W.rayTerrain(p.x,p.y,p.z,d.x,d.y,d.z,length-.3)===Infinity&&W.rayBoxes(p.x,p.y,p.z,d.x,d.y,d.z,length-.3)===Infinity};
     if(!clear(near)||!clear(far))continue;
     rows.push({name:'fence-near',position:near.toArray(),look:target.toArray()},{name:'fence-far',position:far.toArray(),look:target.toArray()});break;
    }if(rows.length)break;
   }
   const house=W.footprints.find(p=>p.kind==='house1');
   if(house){const x=(house.minX+house.maxX)/2,z=(house.minZ+house.maxZ)/2,y=W.heightAt(x,z)+.12;rows.push({name:'roof-near',position:[x+12,y+3,z+16],look:[x,y+4,z]},{name:'roof-far',position:[x+44,y+4,z+60],look:[x,y+4,z]})}
   if(rows.length!==4)throw Error('울타리·지붕 비교 위치를 찾지 못함');return rows;
  });
  const report={mode,base,dpr:1.5,viewport:[800,450],note:'정지 장면의 동기식 렌더 시간. SwiftShader 소프트웨어 GPU이며 실제 GPU 게임 FPS가 아님.',cases,runs:[],screens:[]};
  const point=cases.find(c=>c.name==='roof-far');
  await page.evaluate(p=>{G.camera.position.fromArray(p.position);G.camera.lookAt(...p.look);G.camera.updateMatrixWorld(true)},point);
  if(process.argv.includes('--screens'))report.runs=JSON.parse(fs.readFileSync(path.join(out,mode+'.json'))).runs;
  else for(const tier of ['potato','low','medium','high'])for(const state of mode==='after'&&tier==='low'?['initial','floor','floor-no-msaa']:['initial','floor']){
   const run=await page.evaluate(({tier,state,mode})=>{
    if(mode==='after')G.renderFeatures.lowMSAA=state!=='floor-no-msaa';
    G.__apply(tier);if(state.startsWith('floor')){G.DRS.scale=G.DRS.minScale;G.DRS.apply(true)}
    for(let i=0;i<15;i++){G.World.update(1/60,G.camera.position,G.camera);G.RoomLighting.update(1/60,G.camera.position)}
    G.renderer.shadowMap.needsUpdate=true;G.renderNow();G.Perf.gpuWait();
    const times=[];let calls=0,triangles=0;
    for(let i=0;i<3;i++){G.Perf.frameStart();const start=performance.now();G.renderNow();G.Perf.frameEnd(16,0);G.Perf.gpuWait();times.push(performance.now()-start);calls+=G.Perf.info.calls/3;triangles+=G.Perf.info.tris/3}
    const median=times.slice().sort((a,b)=>a-b)[1],rt=G.composerRT(),R=G.renderer;
    return{tier,state,medianMs:median,renderFps:1000/median,times,canvas:[R.domElement.width,R.domElement.height],scene:[rt.width,rt.height],samples:rt.samples,fxaa:G.fxaaPass.enabled,scale:G.DRS.scale,calls:Math.round(calls),triangles:Math.round(triangles)};
   },{tier,state,mode});report.runs.push(run);console.log(mode,tier,state,run.renderFps.toFixed(2),'FPS',run.scene);
  }
  if(mode==='after')await page.evaluate(()=>G.renderFeatures.lowMSAA=true);
  for(const c of cases){
   await page.evaluate(c=>{
    G.__apply('medium');G.DRS.scale=G.DRS.minScale;G.DRS.apply(true);G.camera.position.fromArray(c.position);G.camera.lookAt(...c.look);G.camera.updateMatrixWorld(true);
    for(let i=0;i<30;i++){G.World.update(1/60,G.camera.position,G.camera);G.RoomLighting.update(1/60,G.camera.position)}
    G.renderer.shadowMap.needsUpdate=true;G.renderNow();
   },c);
   const name=mode+'-'+c.name+'.png';await page.screenshot({path:path.join(out,name),style:'#hud,#fpsBox,#perfOverlay,#pause,#menu{visibility:hidden!important}'});report.screens.push(name);
  }
  await page.evaluate(()=>{
   const T=THREE,W=G.World;window.LineLab={hidden:[],meshes:[],oldBackground:G.scene.background};
   for(const o of G.scene.children)if(!o.isLight&&o.visible){o.visible=false;LineLab.hidden.push(o)}
   G.scene.background=new T.Color(0xffffff);const old=W.parts,cur=W.cur;W.parts={};W.cur=null;
   for(let i=0;i<3;i++)W.box(W.ctx(0,300,0,0),0,.5-i*.5,0,10,[.006,.02,.08][i],[.006,.02,.08][i],'dark',new T.Color(.08,.08,.08),{nc:true});
   for(const geos of Object.values(W.parts)){
    const geo=T.mergeGeometries(geos,false);G.StaticAO.apply(geo,'line-lab');
    const mesh=new T.Mesh(geo,W.mats.dark);G.scene.add(mesh);LineLab.meshes.push(mesh);
   }W.parts=old;W.cur=cur;
   G.VM.set(null);G.__apply('low');G.DRS.scale=G.DRS.minScale;G.DRS.apply(true);
  });
  report.lines=[];
  for(const distance of [8,35])for(const phase of [0,.25,.5,.75]){
   const project=await page.evaluate(({distance,phase})=>{
    const T=THREE,cam=G.camera,R=G.renderer,pixelWorld=2*distance*Math.tan(cam.fov*Math.PI/360)/(innerHeight*devicePixelRatio);
    cam.position.set(0,300+phase*pixelWorld,distance);cam.rotation.set(0,0,.025);cam.updateMatrixWorld(true);G.renderNow();
    return [0,1,2].map(i=>{const points=[-4,4].map(x=>new T.Vector3(x,300+.5-i*.5,0).project(cam)).map(v=>[(v.x+1)*innerWidth*devicePixelRatio/2,(1-v.y)*innerHeight*devicePixelRatio/2]);return{points,thickness:[.006,.02,.08][i]}});
   },{distance,phase});
   const name=mode+'-wires-'+distance+'-'+phase+'.png';await page.screenshot({path:path.join(out,name),style:'#hud,#fpsBox,#perfOverlay,#pause,#menu{visibility:hidden!important}'});report.lines.push({distance,phase,file:name,project});
  }
  report.errors=f.errors;fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify(report,null,2)+'\n');if(f.errors.length)throw Error(f.errors.join('\n'));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
