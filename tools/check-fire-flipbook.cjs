// 아틀라스 실내용·보간·늦은 로딩·누락 복귀와 실제 화염 수명을 검사한다.
const assert=require('assert'),fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),fixture=require('./optimize/browser-fixture.cjs');
const root=path.resolve(__dirname,'..'),file=path.join(root,'assets/textures/vfx/pool-fire-v85.webp'),meta=require('../assets/textures/vfx/pool-fire-v85.json'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),report={};
const data=fs.readFileSync(file);assert.equal(hash(data),meta.sha256);assert.equal(data.length,meta.bytes);
const rgba=cp.execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-f','rawvideo','-pix_fmt','rgba','-'],{maxBuffer:64*1024*1024}),size=meta.tile,side=size*4,frames=[];
assert.equal(rgba.length,side*side*4);
for(let f=0;f<16;f++){
 const tile=Buffer.alloc(size*size*4);let visible=0,transparent=0,edge=0;
 for(let y=0;y<size;y++){
  const row=((Math.floor(f/4)*size+y)*side+(f%4)*size)*4;rgba.copy(tile,y*size*4,row,row+size*4);
  for(let x=0;x<size;x++){const a=rgba[row+x*4+3],warm=rgba[row+x*4]-rgba[row+x*4+2];if(a>160&&warm>20)visible++;if(warm<6)transparent++;if((!x||!y||x===size-1||y===size-1)&&a>160&&warm>20)edge++}
 }
  const coverage=visible/(size*size);assert(coverage>.025&&coverage<.8,'분리 가능한 불꽃 본체와 배경이 모두 있어야 함');assert(transparent>size*size*.15);assert(edge<size,'이웃 프레임으로 불꽃이 잘리면 안 됨');frames.push({frame:f,coverage,edge,hash:hash(tile)});
}assert.equal(new Set(frames.map(f=>f.hash)).size,16);report.atlas={...meta,framesChecked:frames};
const enter=async p=>{
 await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});await p.click('#trainBtn');await p.waitForFunction(()=>G.Training.active);await p.evaluate(()=>{G.paused=true;G.Input.unlock();G.UI.showPause(false);G.__apply('medium');G.VM.set(null)});
};
(async()=>{
 let release;const held=new Promise(r=>{release=r}),f=await fixture({viewport:{width:640,height:360},route:async p=>p.route('**/assets/textures/vfx/pool-fire-v85.webp',async r=>{await held;await r.fulfill({body:data,contentType:'image/webp'})})});
 try{
  report.delayed=await f.page.evaluate(()=>({menu:!document.querySelector('#menu').classList.contains('hidden'),state:G.ThrowableVFX.fireState,ready:G.ThrowableVFX.spriteMaterial.uniforms.fireReady.value}));assert(report.delayed.menu);assert.equal(report.delayed.state,'loading');assert.equal(report.delayed.ready,0);
  release();await f.page.waitForFunction(()=>G.ThrowableVFX.fireState==='ready');
  report.rendered=await f.page.evaluate(()=>{
   const P=G.ThrowableVFX,r=G.renderer,geo=P.spriteMesh.geometry.clone(),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.5,.5,.5,-.5,.1,10),target=new THREE.WebGLRenderTarget(128,128),pixels=new Uint8Array(128*128*4),rows=[];
   geo.instanceCount=1;geo.getAttribute('iPos').setXYZ(0,0,0,0);geo.getAttribute('iSize').setXY(0,1,1);geo.getAttribute('iColor').setXYZW(0,1,1,1,1);scene.add(new THREE.Mesh(geo,P.spriteMaterial));camera.position.set(0,.5,3);camera.lookAt(0,.5,0);camera.updateMatrixWorld(true);
   const oldTarget=r.getRenderTarget(),clear=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha(),fog=P.spriteMaterial.uniforms.fogD.value;r.setRenderTarget(target);r.setClearColor(0,0);P.spriteMaterial.uniforms.fogD.value=0;
   try{
    for(let frame=0;frame<16;frame++){
     geo.getAttribute('iStyle').setXYZW(0,0,0,0,frame);geo.getAttribute('iStyle').needsUpdate=true;r.clear();r.render(scene,camera);r.readRenderTargetPixels(target,0,0,128,128,pixels);let visible=0,h=2166136261;for(let i=0;i<pixels.length;i++){h=Math.imul(h^pixels[i],16777619);if(i%4===3&&pixels[i]>24)visible++}rows.push({frame,visible,hash:h>>>0,corners:[3,127*4+3,127*128*4+3,pixels.length-1].map(i=>pixels[i])});
    }
   }finally{r.setRenderTarget(oldTarget);r.setClearColor(clear,alpha);P.spriteMaterial.uniforms.fogD.value=fog;geo.dispose();target.dispose()}return rows;
  });for(const r of report.rendered){assert(r.visible>20);assert(r.corners.every(a=>a===0),'불꽃 카드의 모서리는 실제 렌더에서도 투명해야 함')}assert.equal(new Set(report.rendered.map(r=>r.hash)).size,16);
  await enter(f.page);
  report.fire=await f.page.evaluate(()=>{
   const T=G.Throwables,P=G.ThrowableVFX,r=G.World.range,p=new THREE.Vector3(r.x+23,r.y+.12,r.line-17);T.reset();G.FX.reset();G.camera.position.copy(p).add(new THREE.Vector3(4,2.5,8));G.camera.lookAt(p);G.camera.updateMatrixWorld(true);Math.random=G.U.mulberry32(85623);T.detonate({kind:'molotov',pos:p.clone(),contactNormal:new THREE.Vector3(0,1,0),owner:G.Game.player,team:0});
   for(let i=0;i<72;i++){T.update(1/60);G.FX.update(1/60)}G.renderNow();const fire=T.fires[0],flames=P.sprites.filter(s=>s.owner===fire.visual),positions=flames.map(s=>s.p.toArray()),styles=P.styles.array,phase=[];for(let i=0;i<P.draw.length;i++)if(P.draw[i].owner)phase.push(styles[i*4+3]);
   const started={radius:fire.r,remaining:fire.t,flames:flames.length,sites:fire.visual.sites.length,footprint:Math.max(...fire.visual.sites.map(s=>s.p.distanceTo(fire.pos))),phase,texture:[P.spriteMaterial.uniforms.fireMap.value.image.width,P.spriteMaterial.uniforms.fireMap.value.image.height]};
   for(let i=0;i<30;i++){T.update(1/60);G.FX.update(1/60)}const anchored=flames.every((s,i)=>s.owner===fire.visual&&s.p.distanceTo(new THREE.Vector3(...positions[i]))<1e-6),camera=G.camera.position.clone();
   G.camera.position.copy(p).add(new THREE.Vector3(100,3,0));for(let i=0;i<15;i++){T.update(1/60);G.FX.update(1/60)}const distance={hidden:P.sprites.filter(s=>s.owner===fire.visual).length===0,gameplay:T.fires.length===1};
   G.camera.position.copy(camera);for(let i=0;i<15;i++){T.update(1/60);G.FX.update(1/60)}distance.returned=P.sprites.filter(s=>s.owner===fire.visual).length;
   for(let i=0;i<480;i++){T.update(1/60);G.FX.update(1/60)}G.renderNow();return{started,anchored,distance,ended:T.fires.length===0,liveFlames:P.sprites.filter(s=>s.kind===0).length,free:P.free.length,pool:P.free.length+P.sprites.length};
  });
  assert.equal(report.fire.started.radius,3.4);assert(report.fire.started.remaining>7.7&&report.fire.started.remaining<7.9);assert(report.fire.started.flames>=10);assert(report.fire.started.footprint<3.5);assert(report.fire.started.phase.some(v=>Math.abs(v-Math.floor(v))>.01));assert.deepEqual(report.fire.started.texture,[side,side]);assert(report.fire.anchored&&report.fire.ended);assert(report.fire.distance.hidden&&report.fire.distance.gameplay&&report.fire.distance.returned>=10);assert.equal(report.fire.liveFlames,0);assert.equal(report.fire.pool,256);assert.equal(f.requests.filter(s=>s.endsWith('pool-fire-v85.webp')).length,1);assert.deepEqual(f.errors,[]);
 }finally{release();await f.close()}
 const missing=await fixture({viewport:{width:640,height:360},route:async p=>p.route('**/assets/textures/vfx/pool-fire-v85.webp',r=>r.fulfill({status:404,body:''}))});
 try{
  const p=missing.page;await p.waitForFunction(()=>G.ThrowableVFX.fireState==='fallback');await enter(p);report.missing=await p.evaluate(()=>{
   const T=G.Throwables,P=G.ThrowableVFX,r=G.World.range,p=new THREE.Vector3(r.x,r.y+.12,r.line-12);T.reset();G.FX.reset();G.camera.position.copy(p).add(new THREE.Vector3(4,3,8));G.camera.lookAt(p);G.camera.updateMatrixWorld(true);T.detonate({kind:'molotov',pos:p.clone(),owner:G.Game.player,team:0});for(let i=0;i<80;i++){T.update(1/60);G.FX.update(1/60)}G.renderNow();return{state:P.fireState,ready:P.spriteMaterial.uniforms.fireReady.value,fires:T.fires.length,flames:P.sprites.filter(s=>s.kind===0).length};
  });assert.equal(report.missing.state,'fallback');assert.equal(report.missing.ready,0);assert.equal(report.missing.fires,1);assert(report.missing.flames>0);assert.deepEqual(missing.errors,[]);
 }finally{await missing.close()}
 fs.writeFileSync(process.env.REPORT||'/tmp/lz-v85-fire-checks.json',JSON.stringify(report,null,2)+'\n');console.log('PASS 화염 아틀라스·무대기 로딩·고정 연료면·수명·누락 복귀',JSON.stringify({atlas:meta.bytes,frames:16,delayed:report.delayed,fire:report.fire,missing:report.missing}));
})().catch(e=>{console.error(e);process.exitCode=1});
