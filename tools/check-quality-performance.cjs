
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// v78: rendering contracts, asset residency, real LOD selection and fallbacks.
const assert = require('assert'), fs = require('fs'), path = require('path');
const fixture = require('./optimize/browser-fixture.cjs');
const out = process.env.REPORT || '/tmp/lastzone-v78-quality.json';
(async () => {
  const result = {}, f = await fixture({ console: true });
  try {
    result.boot = await f.page.evaluate(() => ({
      models: Object.keys(G.VM.models), packs: Object.keys(G.AssetVM.packs), gpu: G.Assets.gpuLoaded,
      textureCount: new Set(Object.values(G.Assets.TEX)).size * 3,
      ao: { applied: G.StaticAO.applied, rejected: G.StaticAO.rejected }, lods: Object.keys(G.WorldWeapons.models).length,
      gpuBytes: [...new Set(Object.values(G.Assets.tex).flatMap(e => [e.map,e.normal,e.arm]))].reduce((sum,t) => sum+t.mipmaps.reduce((s,m) => s+(m.data?.byteLength||0),0),0),
      rgbaBytes: [...new Set(Object.values(G.Assets.tex).flatMap(e => [e.map,e.normal,e.arm]))].reduce((sum,t) => sum+t.image.width*t.image.height*4*4/3,0)
    }));
    assert.deepEqual(result.boot.models.sort(), ['ar7','g18','fists','throw'].sort());
    assert.equal(result.boot.packs.length,0,'Unused native animation packs loaded at boot');
    assert.equal(result.boot.gpu,result.boot.textureCount,'GPU textures missing');
    assert(result.boot.gpuBytes > 0 && result.boot.gpuBytes < result.boot.rgbaBytes*.5);
    assert.equal(result.boot.ao.rejected,0,'Static geometry changed since AO bake');
    assert(result.boot.ao.applied>300); assert.equal(result.boot.lods,30);
    result.lods = await f.page.evaluate(() => G.GUN_IDS.map(id => {
      const mesh=G.Guns.tpModel(id,true); mesh.updateMatrixWorld(true);
      const tri=g=>(g.index?g.index.count:g.attributes.position.count)/3;
      const counts=mesh.levels.map(l=>tri(l.object.geometry));
      const high=new THREE.Box3().setFromObject(mesh.levels[0].object), low=new THREE.Box3().setFromObject(mesh.levels[2].object);
      const sizeError=high.getSize(new THREE.Vector3()).distanceTo(low.getSize(new THREE.Vector3()));
      const camera=new THREE.PerspectiveCamera();
      const test=(d,zoom=1)=>{G.lodZoom=zoom;camera.position.set(0,0,d);camera.updateMatrixWorld(true);mesh.update(camera);return mesh.getCurrentLevel()};
      const levels=[test(2),test(18),test(45),test(45,8)];G.lodZoom=1;
      return {id,counts,sizeError,levels};
    }));
    for(const row of result.lods){assert(row.counts[1]<row.counts[0]&&row.counts[2]<row.counts[1],row.id);assert(row.sizeError<.08,row.id+' LOD scale drift '+row.sizeError);assert.deepEqual(row.levels,[0,1,2,0],row.id+' zoom/hysteresis');}
    await f.page.evaluate(()=>document.getElementById('trainBtn').click());
    await f.page.waitForFunction(()=>G.Training.active);
    await f.page.evaluate(async()=>{
      G.onLockChange=()=>{};G.Input.unlock();G.paused=true;G.UI.showPause(false);window.requestAnimationFrame=()=>0;
      await Promise.all(Object.values(G.Game.player.weapons).filter(Boolean).map(w=>G.AssetVM.request(w.id)));
    });
    result.inventory=await f.page.evaluate(()=>({models:Object.keys(G.VM.models),packs:Object.keys(G.AssetVM.packs),equipped:Object.values(G.Game.player.weapons).filter(Boolean).map(w=>w.id)}));
    assert(result.inventory.models.length<=7,'Warmup built unused weapons');
    assert(result.inventory.packs.length<=3,'Warmup fetched unused packs');
    result.native=await f.page.evaluate(()=>{
      const p=G.Player,a=G.Game.player; a.cur='rifle';
      Object.assign(p,{ads:0,raise:1,reload:null,sw:null});
      for(let i=0;i<120;i++)p.updateCamera(1/60);G.__apply('low');G.DRS.scale=.55;G.DRS.apply(true);G.renderNow();
      const rt=G.composerRT(),native=G.viewmodelRT(),size=G.renderer.getDrawingBufferSize(new THREE.Vector2());
      return {world:[rt.width,rt.height],viewmodel:[native.width,native.height],output:[size.x,size.y],gun:G.VM.cur};
    });
    assert.deepEqual(result.native.viewmodel,result.native.output);
    assert(Math.abs(result.native.world[0]/result.native.viewmodel[0]-.55)<.002,'낮음의 DRS 하한은 네이티브 화면의 55%');
    const dir=path.dirname(out);fs.mkdirSync(dir,{recursive:true});
    await f.page.screenshot({path:path.join(dir,'v78-native-hands.png')});
    // Compare framebuffer corners with/without the native weapon. The overlay
    // must preserve the world and only change the gun/hand-covered pixels.
    result.composite=await f.page.evaluate(()=>{
      const R=G.renderer,gl=R.getContext(),W=R.domElement.width,H=R.domElement.height;
      const capture=()=>{G.renderNow();const p=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);return p};
      const visible=G.VM.root.visible;G.VM.root.visible=false;const a=capture();G.VM.root.visible=visible;const b=capture();
      let changed=0,corners=0;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const at=(y*W+x)*4,d=Math.max(Math.abs(a[at]-b[at]),Math.abs(a[at+1]-b[at+1]),Math.abs(a[at+2]-b[at+2]));
        if(d>3){changed++;if((x<12||x>W-13)&&(y<12||y>H-13))corners++}
      }
      return {changed,corners};
    });
    console.log('Composite',result.composite);
    assert(result.composite.changed>500,'Native weapon failed to render');assert.equal(result.composite.corners,0,'Native overlay erased the world');
    await f.page.setViewportSize({width:800,height:600});
    await f.page.waitForFunction(() => G.renderer.domElement.width === 800 && G.renderer.domElement.height === 600);
    result.resize=await f.page.evaluate(()=>{G.renderNow();const r=G.viewmodelRT();return [r.width,r.height]});
    assert.deepEqual(result.resize,[800,600]);
    result.nativeRelease=await f.page.evaluate(()=>{G.__apply('high');G.renderNow();const r=G.viewmodelRT();return [r.width,r.height]});
    assert.deepEqual(result.nativeRelease,[1,1],'Unused native target retained full-resolution storage');
    // Finish a pending pack only after ADS/reload has ended. Repeated calls
    // share the network request; a swap is also awaited before activation.
    result.activation=await f.page.evaluate(async()=>{
      G.VM.set('sc17');G.Player.ads=1;G.Player.reload=null;
      await Promise.all([G.AssetVM.request('sc17'),G.AssetVM.request('sc17')]);
      const duringADS=G.AssetVM.pack('sc17')===null;
      G.Player.ads=0;G.Player.reload={id:'sc17'};const duringReload=G.AssetVM.pack('sc17')===null;
      G.Player.reload=null;const after=!!G.AssetVM.pack('sc17');
      return {duringADS,duringReload,after};
    });
    assert(result.activation.duringADS&&result.activation.duringReload&&result.activation.after);
    const acr=f.requests.filter(s=>s==='/assets/models/viewmodels/acr.glb');assert.equal(acr.length,1,'Duplicate pack download');
    assert.deepEqual(f.errors,[]);
  } finally {await f.close()}
  // Original images, high-detail world mesh and original procedural reload
  // remain playable if optional compressed/baked/animation assets disappear.
  const damagedAO=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/lighting/static-ao.json')));
  const chunks=Object.values(damagedAO.chunks);chunks[0].hash^=1;chunks[1].count++;chunks[2].values='!invalid!';
  const fallback=await fixture({route:async page=>{
    await page.route(/\/assets\/tex\/gpu\/.*\.ktx2/,r=>r.fulfill({status:404,body:''}));
    await page.route('**/assets/models/guns/world-lods.glb*',r=>r.fulfill({status:404,body:''}));
    await page.route('**/assets/lighting/static-ao.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(damagedAO)}));
    await page.route('**/assets/models/viewmodels/saiga.glb*',r=>r.fulfill({status:404,body:''}));
  }});
  try {
    result.fallback=await fallback.page.evaluate(async()=>{
      G.VM.ensure('sa12');await G.AssetVM.request('sa12');
      const mesh=G.Guns.tpModel('sa12',true);
      return {gpu:G.Assets.gpuLoaded,model:mesh.isMesh,real:G.VM.models.sa12.real,pack:!G.AssetVM.owns('sa12'),ao:G.StaticAO.applied,rejected:G.StaticAO.rejected,render:!!G.renderer};
    });
    assert.deepEqual(result.fallback,{gpu:0,model:true,real:true,pack:true,ao:chunks.length-3,rejected:3,render:true});assert.deepEqual(fallback.errors,[]);
  } finally {await fallback.close()}
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log('PASS v78 quality/performance contracts',JSON.stringify({boot:result.boot,inventory:result.inventory,native:result.native,composite:result.composite,fallback:result.fallback}));
})().catch(e=>{console.error(e);process.exitCode=1});
