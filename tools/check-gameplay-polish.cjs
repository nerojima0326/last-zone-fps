// v79 integration: real material classification, distance/foot contacts, poses,
// bounded samples, bot wall/cover behavior, settings and complementary LODs.
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const fixture=require('./optimize/browser-fixture.cjs');
(async()=>{
 const result={},out=process.env.REPORT||'/tmp/lz-v79-polish.json';
 const sources=require('../assets/audio/footsteps/sources.json');
 for(const f of sources.files)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../assets/audio/footsteps',f.file))).digest('hex'),f.sha256);
 assert.equal(sources.files.length,25);
 const f=await fixture({console:true});
 try{
  await f.page.evaluate(()=>{window.requestAnimationFrame=()=>0;G.Audio.init()});
  await f.page.evaluate(()=>G.Footsteps.load(G.Audio.ctx));
  result.samples=await f.page.evaluate(()=>Object.entries(G.Footsteps.buffers).map(([id,b])=>{
   let peak=0;for(let c=0;c<b.numberOfChannels;c++)for(const x of b.getChannelData(c))peak=Math.max(peak,Math.abs(x));return{id,duration:b.duration,peak};
  }));
  assert.equal(result.samples.length,25);assert(result.samples.every(s=>s.duration>.025&&s.peak>.05&&s.peak<=.721));
  result.surfaces=await f.page.evaluate(()=>{
   const W=G.World,tex=W.terrainW,expected=new Map(),actual=new Map(),size=tex.image.width;
   for(let pz=5;pz<size;pz+=19)for(let px=5;px<size;px+=19){
    const x=(px+.5)/size*W.SIZE-W.HALF,z=(pz+.5)/size*W.SIZE-W.HALF,i=(pz*size+px)*4,d=tex.image.data;
    const surface=d[i+3]>128?(W.roadDist(x,z)<3.4?'asphalt':'concrete'):d[i+1]>112?'sand':d[i+2]>145?'gravel':d[i]>125?'dirt':'grass';
    if(!expected.has(surface)){expected.set(surface,{x,z});actual.set(surface,W.surfaceAt(x,z))}
   }
   return Object.fromEntries([...actual].map(([k,v])=>[k,{actual:v,point:expected.get(k)}]));
  });
  for(const [surface,row]of Object.entries(result.surfaces))assert.equal(row.actual,surface);assert(Object.keys(result.surfaces).length>=5);
  result.gait=await f.page.evaluate(()=>{
   const old=G.Audio.footstep,cases=[];G.Audio.footstep=()=>{};
   try{
    for(const fps of[30,60,144])for(const mode of['walk','sprint','crouch','prone']){
     const a=new G.Actor({id:900,team:1});Object.assign(a,{state:'ground',onGround:true,crouch:mode==='crouch',prone:mode==='prone',groundMat:'wood'});
     G.Locomotion.tick(a,0);const speed=mode==='sprint'?6:mode==='crouch'?2.2:mode==='prone'?1:4;
     for(let i=0;i<fps*8;i++){a.pos.z-=speed/fps;G.Locomotion.tick(a,1/fps,mode==='sprint')}
     const stride=G.Locomotion.stride(a,mode==='sprint'),expected=Math.floor(speed*8/stride+1e-6);
     const phase=a.gait.phase,contacts=a.gait.contacts;
     for(let i=0;i<fps;i++)G.Locomotion.tick(a,1/fps,mode==='sprint');
     cases.push({fps,mode,expected,contacts,stopped:a.gait.contacts===contacts&&a.gait.phase===phase});
    }
   }finally{G.Audio.footstep=old}
   return cases;
  });
  for(const c of result.gait){assert(Math.abs(c.contacts-c.expected)<=1,JSON.stringify(c));assert(c.stopped)}
  result.feet=await f.page.evaluate(()=>{
   const W=G.World,original=W.ground,cases=[];
   try{
    W.ground=(x,z)=>.14*x+.04*z;
    for(const fps of[30,60,144]){
     const m=new G.CharacterModel({soldier:false});m.root.position.set(0,0,0);
     const a={speed:0,pitch:0,crouch:false,knocked:false,prone:false,lean:0,dead:false,state:'ground',cur:'fists',onGround:true,groundY:0,distance2:4};
     for(let i=0;i<fps*2;i++){m.root.position.set(0,0,0);m.update(1/fps,a)}
     m.root.updateMatrixWorld(true);
     const error=(bone,side)=>{
      const point=bone.localToWorld(new THREE.Vector3(0,-.44,0));
      const target=m.motion.feet[side].actualTarget;
      return point.distanceTo(new THREE.Vector3(target.x,target.y,target.z));
     };
     const slopeError=Math.max(error(m.kneeL,0),error(m.kneeR,1));
     let maxHipDelta=0;let previous=m.hip.position.y;
     for(let i=0;i<fps;i++){a.crouch=true;m.root.position.set(0,0,0);m.update(1/fps,a);maxHipDelta=Math.max(maxHipDelta,Math.abs(m.hip.position.y-previous));previous=m.hip.position.y}
     const crouchHeight=m.hip.position.y;
     a.prone=true;for(let i=0;i<fps;i++){m.root.position.set(0,0,0);m.update(1/fps,a)}
     cases.push({fps,slopeError,maxHipDelta,crouchHeight,pronePitch:m.root.rotation.x,finite:m.root.matrixWorld.elements.every(Number.isFinite)});m.dispose();
    }
   }finally{W.ground=original}
   return cases;
  });
  for(const c of result.feet){assert(c.slopeError<.012,JSON.stringify(c));assert(c.maxHipDelta<.14);assert(c.crouchHeight<.66);assert(c.pronePitch< -1.35&&c.finite)}
  result.soldierFeet=await f.page.evaluate(()=>{
   const W=G.World,original=W.ground,rows=[];
   try{
    W.ground=(x,z)=>.1*x+.03*z;
    for(let template=0;template<G.Soldiers.templates.length;template++){
     const m=new G.CharacterModel({soldier:true});
     if(m.soldier.T!==G.Soldiers.templates[template]){
       m.soldier.root.removeFromParent();
       m.soldier=G.Soldiers.create(()=> (template+.1)/G.Soldiers.templates.length);m.root.add(m.soldier.root);
     }
     m.root.position.set(0,0,0);
     const actor=new G.Actor({id:800+template,team:1});Object.assign(actor,{state:'ground',onGround:true,groundMat:'wood'});G.Locomotion.tick(actor,0);
     let maxError=0,plantedError=0,slip=0,worst=null;const planted=[null,null];
     for(let frame=0;frame<300;frame++){
      if(frame<180)actor.pos.z-=2/60;
      actor.pos.y=W.ground(actor.pos.x,actor.pos.z);G.Locomotion.tick(actor,1/60);
      m.root.position.copy(actor.pos);m.update(1/60,{speed:actor.gait.speed,gait:actor.gait,pitch:0,crouch:frame>240,knocked:false,prone:false,dead:false,state:'ground',cur:'fists',onGround:true,groundY:actor.pos.y,distance2:4});
      m.root.updateMatrixWorld(true);
      if(frame<30||m.motion.ik<.99)continue;
      for(let side=0;side<2;side++){
       const info=m.soldier.T.feet[side],foot=m.soldier.footBones[side],f=m.motion.feet[side];if(!info||!foot)continue;
       const at=foot.getWorldPosition(new THREE.Vector3()),target=new THREE.Vector3(m.root.position.x+f.actualTarget.x,f.actualTarget.y-.05+info.sole,m.root.position.z+f.actualTarget.z);
       const error=at.distanceTo(target);if(!f.swing)plantedError=Math.max(plantedError,error);
       if(error>maxError){maxError=error;const upper=info.pair[0],lower=info.pair[1];worst={frame,side,actual:at.toArray(),target:target.toArray(),upper:m.soldier.X[upper].toArray(),lengths:[m.soldier.T.entries[upper].len,m.soldier.T.entries[lower].len],hip:m.hip.position.y,sole:info.sole,swing:f.swing};}
       if(!f.swing&&planted[side]&&planted[side].anchor.distanceTo(f.plant)<1e-7)slip=Math.max(slip,Math.hypot(at.x-planted[side].at.x,at.z-planted[side].at.z));
       planted[side]=f.swing?null:{anchor:f.plant.clone(),at};
      }
     }
     rows.push({template:m.soldier.T.name,maxError,plantedError,slip,worst,feet:m.soldier.footBones.filter(Boolean).length});m.dispose();
    }
   }finally{W.ground=original}
   return rows;
  });
  console.log('SOLDIER FEET',JSON.stringify(result.soldierFeet));
  for(const row of result.soldierFeet){assert.equal(row.feet,2);assert(row.maxError<.05&&row.plantedError<.015,JSON.stringify(row));assert(row.slip<.015,JSON.stringify(row))}
  result.finishes=await f.page.evaluate(()=>{
   const rows=[];
   for(const id of G.GUN_IDS){const data=G.Guns.gunData(id),mats=data.mats||{};rows.push({id,checked:Object.values(mats).filter(m=>m.userData.finishRole).length,valid:Object.values(mats).every(m=>!m.userData.finishRole||(m.roughness>=.38&&m.roughness<=1&&m.metalness<=.85))})}
   const lens=new THREE.MeshStandardMaterial({name:'optic glass',transparent:true,roughness:.06,metalness:.1});G.WeaponFinish.material(lens);
   return {rows,lens:{roughness:lens.roughness,metalness:lens.metalness}};
  });
  assert(result.finishes.rows.every(r=>r.valid&&r.checked));assert.deepEqual(result.finishes.lens,{roughness:.06,metalness:.1});
  result.lod=await f.page.evaluate(()=>{
   let partitionError=0;for(let d=0;d<80;d+=.05)partitionError=Math.max(partitionError,Math.abs([0,1,2].reduce((s,l)=>s+G.LODFade.coverage(d,l),0)-1));
   const before=G.LODFade.clones;const a=G.Guns.tpModel('mp9',true);const once=G.LODFade.clones;for(let i=0;i<20;i++)G.Guns.tpModel('mp9',true);
   const camera=new THREE.PerspectiveCamera();a.updateMatrixWorld(true);
   const states=[10,12,18,28,40].map(d=>{camera.position.set(0,0,d);camera.updateMatrixWorld(true);a.update(camera);return{d,visible:a.levels.map(l=>l.object.visible),casters:a.levels.filter(l=>l.object.castShadow).length}});
   return{partitionError,clones:[before,once,G.LODFade.clones],states};
  });
  assert(result.lod.partitionError<1e-10);assert.equal(result.lod.clones[1],result.lod.clones[2]);assert.deepEqual(result.lod.states.map(s=>s.visible.filter(Boolean).length),[1,2,1,2,1]);assert(result.lod.states.every(s=>s.casters===1));
  // Existing target acquisition/shooting remains in combat; suppress only its
  // shot timer here so deterministic wall and cover movement can be inspected.
  result.bots=await f.page.evaluate(()=>{
   const actor=new G.Actor({id:998,team:1});Object.assign(actor,{state:'ground',onGround:true,cur:'rifle',hp:100});actor.give('ar7',60);actor.pos.set(0,20,0);
   const target=new G.Actor({id:997,team:0});target.pos.set(0,20,-20);const b=new G.Bot(actor);b.target=target;b.visible=true;b.reactT=0;b.nextFire=1e9;b.strafe=1;b.strafeT=99;
   b.blocked=()=>true;const out=new THREE.Vector3();let flips=0,last=0;
   for(let i=0;i<120;i++){b.combat(1/60,out);const sign=Math.sign(out.x);if(sign&&last&&sign!==last)flips++;last=sign||last}
   const narrowSpeed=out.length();b.blocked=()=>false;b.sideProbeT=0;b.reloadT=2;b.coverT=3;b.coverPos.copy(actor.pos).add(new THREE.Vector3(.7,0,0));b.coverArrived=false;
   b.combat(1/60,out);const arrived=b.coverArrived&&actor.crouch&&out.length()===0;
   actor.pos.x-=.25;b.combat(1/60,out);const held=b.coverArrived&&out.length()===0;
   actor.pos.x-=.5;b.combat(1/60,out);const resumed=!b.coverArrived&&out.length()>0;
   return{flips,narrowSpeed,arrived,held,resumed};
  });
  assert.equal(result.bots.flips,0);assert(result.bots.narrowSpeed<.05);assert(result.bots.arrived&&result.bots.held&&result.bots.resumed);
  // Exercise the actual settings inputs, including persistence after reload.
  await f.page.click('#settingsBtn');await f.page.locator('#setGrain').evaluate(el=>{el.value='.4';el.dispatchEvent(new Event('input',{bubbles:true}))});await f.page.locator('#setShadows').evaluate(el=>{el.value='.65';el.dispatchEvent(new Event('input',{bubbles:true}))});
  result.settings=await f.page.evaluate(()=>JSON.parse(localStorage.lastzone_settings).visual);
  assert.equal(result.settings.grain,.4);assert.equal(result.settings.shadows,.65);
  await f.page.click('#setClose');await f.page.evaluate(()=>document.getElementById('trainBtn').click());await f.page.waitForFunction(()=>G.Training.active);
  await f.page.evaluate(()=>{G.onLockChange=()=>{};G.Input.unlock();G.paused=true;G.UI.showPause(false);G.Player.raise=1;for(let i=0;i<120;i++)G.Player.updateCamera(1/60);G.__apply('medium');G.World.update(1/60,G.camera.position,G.camera);G.renderNow()});
  fs.mkdirSync(path.dirname(out),{recursive:true});await f.page.screenshot({path:path.join(path.dirname(out),'v79-training.png')});
  await f.page.evaluate(()=>{
   const scene=new THREE.Scene();scene.environment=G.scene.environment;scene.background=new THREE.Color(0x88929c);
   scene.add(new THREE.HemisphereLight(0xe3eeff,0x625949,1.5));const light=new THREE.DirectionalLight(0xffedd7,3);light.position.set(-2,4,-2);scene.add(light);
   const plane=new THREE.PlaneGeometry(10,8).rotateX(-Math.PI/2),p=plane.attributes.position;
   for(let i=0;i<p.count;i++)p.setY(i,.1*p.getX(i)+.03*p.getZ(i));plane.computeVertexNormals();
   const mat=new THREE.MeshStandardMaterial({color:0x777e69,roughness:.95});scene.add(new THREE.Mesh(plane,mat));
   const old=G.World.ground,oldNormal=G.World.normalAt,oldMat=G.World._gmat;const models=[];
   try{G.World.ground=(x,z)=>{G.World._gmat='terrain';return .1*x+.03*z};G.World.normalAt=(x,z,out)=>out.set(-.1,1,-.03).normalize();
    for(let i=0;i<3;i++){
     const m=new G.CharacterModel({soldier:true});models.push(m);scene.add(m.root);const x=(i-1)*1.25,y=.1*x;
     for(let frame=0;frame<180;frame++){m.root.position.set(x,y,0);m.update(1/60,{speed:0,pitch:0,crouch:i===1,prone:i===2,dead:false,knocked:false,state:'ground',cur:'rifle',gun:'ar7',groundMat:'terrain',onGround:true,groundY:y,distance2:4})}
    }
    const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.05,50);camera.position.set(3,2.2,-5.8);camera.lookAt(0,.8,0);
    G.LODFade.update(camera);G.renderer.setRenderTarget(null);const shadow=G.renderer.shadowMap.enabled;G.renderer.shadowMap.enabled=false;G.renderer.render(scene,camera);G.renderer.shadowMap.enabled=shadow;
   }finally{G.World.ground=old;G.World.normalAt=oldNormal;G.World._gmat=oldMat}
   window.__posePreview={models,plane,mat};
  });
  const hide=await f.page.addStyleTag({content:'#hud,#crosshair,#menu,#fpsBox,#perfOverlay,#trainingOverlay{visibility:hidden!important}'});
  await f.page.screenshot({path:path.join(path.dirname(out),'v79-poses.png')});await hide.evaluate(n=>n.remove());
  await f.page.evaluate(()=>{for(const m of window.__posePreview.models)m.dispose();window.__posePreview.plane.dispose();window.__posePreview.mat.dispose();delete window.__posePreview});
  result.audio=await f.page.evaluate(()=>{
   const a=G.Audio,old=a.vol.ambient;a.vol.ambient=0;const start=G.Footsteps.voices.length;const muted=G.Footsteps.play(a,null,'grass',.3),unchanged=G.Footsteps.voices.length===start;a.vol.ambient=old;
   const empty=G.Footsteps.buffers;G.Footsteps.buffers={};const fallback=!G.Footsteps.play(a,null,'grass',.3);G.Footsteps.buffers=empty;
   for(let i=0;i<80;i++)G.Audio.footstep(null,'metal',.3,i%2);
   return{muted,unchanged,voices:G.Footsteps.voices.length,fallback};
  });
  assert(result.audio.muted&&result.audio.unchanged&&result.audio.fallback&&result.audio.voices<=20);
  await f.page.reload();
  await f.page.waitForFunction(()=>window.G?.Settings?.data&&document.querySelector('#menu:not(.hidden)'),null,{timeout:180000});
  result.reloadedSettings=await f.page.evaluate(()=>G.Settings.data.visual);assert.deepEqual(result.reloadedSettings,result.settings);
  assert.deepEqual(f.errors,[]);result.errors=f.errors;
 }finally{await f.close()}
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log('PASS gameplay polish',JSON.stringify({gait:result.gait.length,feet:result.feet,bots:result.bots,samples:result.samples.length,lod:result.lod,audio:result.audio}));
})().catch(e=>{console.error(e);process.exitCode=1});
