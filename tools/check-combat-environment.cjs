
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// Runs the shipped game: wall/window/floor acoustics, all-weapon clearance,
// directional reactions, surface shaders, bounded decals/fragments/window light.
const assert=require('assert'),fs=require('fs'),path=require('path');
const fixture=require('./optimize/browser-fixture.cjs');
const out=process.env.REPORT||'/tmp/lz-v80-combat-environment.json';
(async()=>{
 const result={},f=await fixture({console:true});
 try{
  const page=f.page;page.setDefaultTimeout(180000);
  await page.evaluate(()=>{window.requestAnimationFrame=()=>0;G.onLockChange=()=>{};G.Input.unlock()});
  await page.waitForTimeout(80);await page.click('#trainBtn');await page.waitForFunction(()=>G.Training.active);
  await page.evaluate(()=>{
   G.paused=true;G.Input.unlock();G.UI.showPause(false);G.Audio.init();
   window.V80Lab={colliders:[],add(...args){const b=G.World.addCollider(...args,true);this.colliders.push(b);return b},clear(){for(const b of this.colliders)G.World.removeCollider(b);this.colliders.length=0;G.Acoustics.reset()}};
  });
  result.acoustics=await page.evaluate(()=>{
   const lab=V80Lab,W=G.World,A=G.Audio,C=G.Acoustics,T=THREE,p=new T.Vector3(0,301.6,5);
   const read=()=>{C.reset();A.setListener(new T.Vector3(0,301.6,0),0);return A.spatial(p,10)};
   const clear=read();lab.add(-4,300,2,4,304,2.25,'hard');const wall=read();lab.clear();
   lab.add(-4,300,2,-.6,304,2.25,'hard');lab.add(.6,300,2,4,304,2.25,'hard');lab.add(-.6,300,2,.6,301,2.25,'hard');lab.add(-.6,302.3,2,.6,304,2.25,'hard');
   const window=read();lab.add(-.6,301,2,.6,302.3,2.05,'glass');const glass=read();lab.clear();
   p.set(0,305,0);lab.add(-4,303,-4,4,303.25,4,'hard');const floor=read();lab.clear();
   const profiles=[];
   for(const [width,length]of [[6,6],[2,20]]){
    lab.add(-width/2,303,-length/2,width/2,303.2,length/2,'hard');
    lab.add(-width/2-.15,300,-length/2,-width/2,303,length/2,'hard');lab.add(width/2,300,-length/2,width/2+.15,303,length/2,'hard');
    if(length<10){lab.add(-width/2,300,-length/2-.15,width/2,303,-length/2,'hard');lab.add(-width/2,300,length/2,width/2,303,length/2+.15,'hard')}
    profiles.push({...G.SceneSense.sample(new T.Vector3(0,301.6,0),true)});lab.clear();
   }
   return {clear,wall,window,glass,floor,profiles};
  });
  const a=result.acoustics;
  assert(!a.clear.blocked&&a.wall.blocked&&a.floor.blocked&&!a.window.blocked);
  assert(a.wall.g<a.clear.g*.5&&a.wall.lp<1600);assert(Math.abs(a.window.g-a.clear.g)<1e-9);
  assert(a.glass.g>a.wall.g&&a.glass.lp>a.wall.lp);assert.deepEqual(a.profiles.map(p=>p.kind),['room','corridor']);
  result.audio=await page.evaluate(async()=>{
   const render=async(room,lp=20000)=>{
    const c=new OfflineAudioContext(2,72000,48000),master=c.createGain();master.connect(c.destination);
    const verb=c.createGain();verb.gain.value=0;verb.connect(master);const verbOut=c.createGain();verbOut.gain.value=.55;verbOut.connect(master);
    const bus={ctx:c,master,verb,verbOut};G.Acoustics.init(bus);
    const output=G.Audio.out.call(bus,{g:1,pan:0,lp,rev:.45,room},.3),source=c.createBufferSource(),buffer=c.createBuffer(1,480,48000),rnd=G.U.mulberry32(234);
    for(let i=0;i<480;i++)buffer.getChannelData(0)[i]=rnd()*2-1;source.buffer=buffer;source.connect(output);source.start();
    const rendered=await c.startRendering(),data=rendered.getChannelData(0);let energy=0,tail=0,peak=0;
    for(let i=0;i<data.length;i++){energy+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));if(i>31200&&i<48000)tail+=data[i]*data[i]}
    return {energy,tail,peak,impulses:Object.fromEntries(Object.entries(bus.acousticBuses.nodes).map(([k,n])=>[k,n.buffer.duration]))};
   };
   return {room:await render('room'),corridor:await render('corridor'),clear:await render('outdoor'),blocked:await render('outdoor',1050)};
  });
  assert(result.audio.corridor.tail>result.audio.room.tail+1e-7);assert(result.audio.blocked.energy<result.audio.clear.energy*.25);
  console.log('Acoustics and rendered room tails PASS');
  await page.evaluate(()=>G.AssetVM.loadAll());
  result.clearance=await page.evaluate(()=>{
   const T=THREE,P=G.Player,V=G.VM,O=G.WeaponObstruction,a=G.Game.player,cam=G.camera,lab=V80Lab;
   a.pos.set(0,300,0);a.state='ground';a.yaw=a.pitch=0;P.a=a;P.camMode='fp';P.vehicle=null;
   cam.position.set(0,301.62,0);cam.quaternion.identity();cam.updateMatrixWorld(true);
   lab.add(-10,299.8,-10,10,300,10,'hard');const results=[];
   const state={ads:0,sprint:false,crouch:false,moving:0,phase:0,lookDX:0,lookDY:0,landDip:0,raise:1,reload:null,pumpP:-1,cycleP:-1,scope:null,hideVM:false,throwP:-1,punchP:-1};
   const tick=n=>{for(let i=0;i<n;i++){O.restore(V);V.update(1/60,state);O.update(V,1/60)}};
   const muzzle=()=>{const p=new T.Vector3();V.muzzleWorld(cam,p);return p};
   const renderer=G.renderer,rt=new T.WebGLRenderTarget(160,90),pixels=new Uint8Array(160*90*4),clearColor=renderer.getClearColor(new T.Color()),clearAlpha=renderer.getClearAlpha(),oldTarget=renderer.getRenderTarget();
   for(const id of G.GUN_IDS)for(const ads of [0,1]){
    const def=G.WEAPONS[id];O.reset(V);a.cur=def.cls;a.weapons[def.cls]={id,mag:def.mag};P.ads=state.ads=ads;P.reload=null;V.set(id);tick(120);
    const before=muzzle();if(O.blocked||O.amount>1e-4)throw Error('Clear weapon tucked '+id);
    const wall=lab.add(-3,300,-.18,3,304,-.14,'hard');tick(30);
    const inverse=new T.Matrix4().copy(V.root.matrixWorld).invert(),m=V.models[id],wrist=m.armL.bW.getWorldPosition(new T.Vector3()).applyMatrix4(inverse);
    const mag=a.weapons[def.cls].mag,bullets=G.Ballistics.list.length,amount=O.amount;
    P.fire(def,a.weapons[def.cls],1);
    if(a.weapons[def.cls].mag!==mag||G.Ballistics.list.length!==bullets)throw Error('Fired through blocked muzzle '+id);
    if(!O.blocked||amount<.9)throw Error('Missing wall pose '+id+' '+amount);
    renderer.setClearColor(0,0);renderer.setRenderTarget(rt);renderer.render(G.vmScene,G.vmCamera);renderer.readRenderTargetPixels(rt,0,0,160,90,pixels);
    renderer.setRenderTarget(oldTarget);renderer.setClearColor(clearColor,clearAlpha);
    let visiblePixels=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>16)visiblePixels++;
    if(visiblePixels<50)throw Error('Wall pose disappeared from view '+id+' '+ads+' '+visiblePixels);
    O.restore(V);const local=m.armL.bW.getWorldPosition(new T.Vector3()).applyMatrix4(new T.Matrix4().copy(V.root.matrixWorld).invert());
    const gripError=wrist.distanceTo(local);if(gripError>1e-7)throw Error('Hand detached '+id);
    G.World.removeCollider(wall);lab.colliders.splice(lab.colliders.indexOf(wall),1);tick(100);
    // Native idle clips move by a few millimetres. Compare the same animation
    // frame with/without the clearance transform, rather than two clip phases.
    O.restore(V);V.update(1/60,state);const reference=muzzle();O.update(V,1/60);
    const recovery=muzzle().distanceTo(reference),idleTravel=reference.distanceTo(before);
    if(O.blocked||O.amount>1e-5||recovery>1e-7)throw Error('Clearance failed to recover '+id+' '+recovery);
    results.push({id,ads,reach:O.reach,amount,gripError,recovery,idleTravel,visiblePixels});
   }
   rt.dispose();lab.clear();O.reset(V);return results;
  });
  assert.equal(result.clearance.length,60);console.log('All 30 weapons, hip/ADS clearance, grip and blocked-shot conservation PASS');
  result.reactions=await page.evaluate(()=>{
   const T=THREE,H=G.HitResponse,lab=V80Lab,results=[];
   lab.add(-8,299.8,-8,8,300,8,'hard');
   for(const fps of [30,60,144])for(const region of ['head','shoulder','leg','torso']){
    const m=new G.CharacterModel({soldier:false}),a=new G.Actor({id:990,team:1});a.model=m;a.pos.set(0,300,0);a.state='ground';m.root.position.copy(a.pos);
    const pose={speed:0,pitch:0,onGround:true,state:'ground',cur:'fists',groundY:300,distance2:4};
    for(let i=0;i<fps;i++)m.update(1/fps,pose);
    const y=region==='head'?1.62:region==='leg'?.45:1.35,x=region==='shoulder'?-.22:0;
    G.Game.damage(a,20,null,'ar7',region==='head',new T.Vector3(x,300+y,0),new T.Vector3(1,0,0));
    if(a.hp!==80||m.hitResponse.region!==region)throw Error('Damage/reaction integration '+region);
    let peak=0;for(let i=0;i<fps;i++){m.update(1/fps,pose);m.root.updateMatrixWorld(true);peak=Math.max(peak,Math.abs(m.spine.rotation.z));m.root.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))throw Error('Invalid hit transform')})}
    H.restore(m);results.push({fps,region,peak,residual:Math.abs(m.spine.rotation.z),events:m.hitResponse.events.length});m.dispose();
   }
   const m=new G.CharacterModel({soldier:false}),a=new G.Actor({id:991,team:1});a.model=m;a.pos.set(0,300,0);m.root.position.copy(a.pos);
   const wall=lab.add(-2,300,.55,2,302,.75,'hard');H.receive(a,new T.Vector3(0,301.3,0),new T.Vector3(0,0,1),80,false);
   for(let i=0;i<180;i++){m.root.position.copy(a.pos);m.root.rotation.y=0;m.update(1/60,{speed:0,pitch:0,onGround:true,state:'ground',cur:'fists',groundY:300,distance2:4,dead:true})}
   const death={clearance:m.hitResponse.death.clearance,direction:m.hitResponse.death.direction.toArray(),up:new T.Vector3(0,1,0).applyQuaternion(m.root.quaternion).toArray(),height:m.root.position.y-300};
   m.dispose();lab.clear();return {cases:results,death};
  });
  for(const row of result.reactions.cases){assert(row.peak>.025&&row.residual<.002&&row.events===0)}
  assert(result.reactions.death.clearance>1.5);assert(Math.abs(result.reactions.death.direction[2])<.1);assert(result.reactions.death.height>=.1);
  console.log('Directional hit reactions and wall-aware death pose PASS');
  result.stanceHits=await page.evaluate(()=>{
   const T=THREE,rows=[];
   for(const [stance,region,x,y,z]of [['crouch','shoulder',-.22,.9,0],['crouch','leg',.1,.3,0],['crouch','torso',0,.7,0],['prone','torso',0,.25,-.3],['prone','shoulder',-.2,.25,-.45],['prone','leg',.1,.2,.45],['prone','head',0,.28,-.85],['knocked','torso',0,.25,-.3]]){
    const actor=new G.Actor({id:995,team:1});actor.model=new G.CharacterModel({soldier:false});actor.pos.set(0,300,0);actor[stance]=true;
    G.HitResponse.receive(actor,new T.Vector3(x,300+y,z),new T.Vector3(1,0,0),20,region==='head');
    rows.push({stance,expected:region,actual:actor.model.hitResponse.region});actor.model.dispose();
   }return rows;
  });
  for(const row of result.stanceHits)assert.equal(row.actual,row.expected);
  result.bodySupport=await page.evaluate(()=>{
   const T=THREE,W=G.World,ground=W.ground,templates=G.Soldiers.templates,rows=[];
   try{
    for(const slope of [0,.12])for(const direction of [[0,0,1],[1,0,0],[0,0,-1],[-1,0,0]])for(const template of templates){
     W.ground=(x,z)=>300+slope*x;G.Soldiers.templates=[template];const m=new G.CharacterModel({soldier:true,helmet:true});G.Soldiers.templates=templates;
     m.root.position.set(0,300,0);const actor=new G.Actor({id:992,team:1});actor.model=m;actor.pos.set(0,300,0);
     G.HitResponse.receive(actor,new T.Vector3(0,301.3,0),new T.Vector3(...direction),100,false);
     for(let i=0;i<180;i++){m.root.position.copy(actor.pos);m.root.rotation.y=0;m.update(1/60,{speed:0,pitch:0,onGround:true,state:'ground',cur:'fists',groundY:300,distance2:4,dead:true})}
     m.root.updateMatrixWorld(true);let minimum=Infinity,maximum=-Infinity,samples=0;const v=new T.Vector3();
     m.soldier.root.traverse(mesh=>{if(!mesh.isSkinnedMesh||!mesh.visible)return;for(let i=0;i<mesh.geometry.attributes.position.count;i+=8){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);const height=v.y-W.ground(v.x,v.z);minimum=Math.min(minimum,height);maximum=Math.max(maximum,height);samples++}});
     rows.push({template:template.name,slope,direction,minimum,maximum,samples,settled:!!m.hitResponse.death.done});m.dispose();
    }
   }finally{W.ground=ground;G.Soldiers.templates=templates}
   return rows;
  });
  for(const row of result.bodySupport){assert(row.minimum>-.015,JSON.stringify(row));assert(row.maximum<.85,JSON.stringify(row));assert(row.settled)}
  console.log('Real soldier skin contact: all variants, four directions and two slopes PASS');
  result.impacts=await page.evaluate(()=>{
   const T=THREE,I=G.ImpactDetail,FX=G.FX,lab=V80Lab,n=new T.Vector3(0,0,1),p=new T.Vector3(0,301,-2);
   G.camera.position.set(0,301.6,0);lab.add(-5,299.8,-5,5,300,5,'hard');
   I.reset();const geometries=G.renderer.info.memory.geometries;
   for(let i=0;i<240;i++)FX.impact(p,n,['hard','wood','metal'][i%3],{direction:new T.Vector3(.7,0,-.7).normalize(),weapon:G.WEAPONS.ar7});
   const marks=I.marks.filter(Boolean).length,tiles=new Set(Array.from(I.tiles.array)),capacity=I.chunks.length;
   for(let i=0;i<150;i++)I.update(1/60);
   const live=I.fragmentMesh.count;
   for(let i=0;i<2400;i++)I.update(1/60);
   const expired=I.marks.filter(Boolean).length,opaque=Array.from(I.fades.array).filter(x=>x>0).length;
   const grows=G.renderer.info.memory.geometries-geometries;
   lab.clear();return {marks,tiles:[...tiles],capacity,live,expired,opaque,grows};
  });
  assert.equal(result.impacts.marks,200);assert.equal(result.impacts.capacity,48);assert.equal(result.impacts.live,0);assert.equal(result.impacts.expired,0);assert.equal(result.impacts.opaque,0);assert.equal(result.impacts.grows,0);
  result.surfaces=await page.evaluate(()=>{
   const W=G.World,counts={meshes:0,bytes:0,invalid:0},hashes=[];
   G.scene.traverse(o=>{if(!o.userData.staticChunk)return;const geo=o.geometry;counts.meshes++;for(const name of ['surfaceInfo','wearEdges']){const a=geo.attributes[name];if(a){counts.bytes+=a.array.byteLength;for(const x of a.array)if(!Number.isFinite(x))counts.invalid++}}if(hashes.length<5)hashes.push([o.userData.staticChunk,G.StaticAO.hash(geo)])});
   return {...counts,appliedAO:G.StaticAO.applied,windows:W.windows.length,noise:[G.SurfaceWear.texture.image.width,G.SurfaceWear.texture.image.height],hashes};
  });
  assert(result.surfaces.meshes>100&&result.surfaces.appliedAO>300&&result.surfaces.windows>100);assert.equal(result.surfaces.invalid,0);
  result.lighting=await page.evaluate(()=>{
   const R=G.RoomLighting,W=G.World,T=THREE;let selected=null;
   for(const w of W.windows){if(w.normal.dot(W.sunDir)<.2)continue;R.refresh(w.position);if(R.stats.patches){selected=w;break}}
   if(!selected)throw Error('No real window casts a floor patch');
   const mat=new T.Matrix4();R.mesh.getMatrixAt(0,mat);const patch=new T.Vector3().setFromMatrixPosition(mat);
   const point=selected.position.clone().addScaledVector(selected.normal,-2);G.SceneSense.reset();R.last.set(1e9,0,0);
   for(let i=0;i<180;i++)R.update(1/60,point);
   const inside=G.renderer.toneMappingExposure/R.base,patches=R.stats.patches;R.enabled=false;for(let i=0;i<180;i++)R.update(1/60,point);const disabled=G.renderer.toneMappingExposure/R.base;R.enabled=true;
   return {windows:W.windows.length,patches,patch:patch.toArray(),inside,disabled,point:point.toArray()};
  });
  assert(result.lighting.patches>0&&result.lighting.patches<=6);assert(result.lighting.inside>=1&&result.lighting.inside<=1.161);assert(Math.abs(result.lighting.disabled-1)<.001);
  await page.evaluate(()=>{G.VM.set(null);G.renderNow()});
  assert.deepEqual(f.errors,[]);result.errors=f.errors;
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log('PASS: combat/environment integration',out);
 }finally{try{await f.page.evaluate(()=>V80Lab?.clear())}catch(e){}await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
