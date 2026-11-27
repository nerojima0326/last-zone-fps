
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// Reproducible close views of the actual runtime shaders, rigs and effects.
const fs=require('fs'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.argv[2]||'/tmp/lz-v80-captures';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const f=await fixture();
 try{
  const page=f.page;
  await page.evaluate(()=>{window.requestAnimationFrame=()=>0;G.onLockChange=()=>{};G.Input.unlock()});await page.waitForTimeout(80);
  await page.click('#trainBtn');await page.waitForFunction(()=>G.Training.active);
  const capture=async name=>{
   const data=await page.evaluate(()=>{G.renderer.shadowMap.needsUpdate=true;G.renderNow();return G.renderer.domElement.toDataURL('image/png').split(',')[1]});
   fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));
  };
  await page.evaluate(()=>{
   const T=THREE,W=G.World;G.paused=true;G.Input.unlock();G.UI.showPause(false);G.__apply('low');G.DRS.scale=1;G.DRS.apply(true);G.VM.set(null);
   window.DetailCapture={objects:[],colliders:[],add(o){G.scene.add(o);this.objects.push(o);return o}};
   const S=DetailCapture;S.colliders.push(W.addCollider(-10,299.8,-10,10,300,10,'hard',true));
   const floor=S.add(new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0x8b8d88,roughness:.95})));floor.rotation.x=-Math.PI/2;floor.position.y=300;floor.receiveShadow=true;
   G.camera.position.set(0,301.5,.35);G.camera.lookAt(0,301.12,-2.5);G.camera.updateMatrixWorld(true);
   for(let i=0;i<3;i++){
    const kind=['concrete','wood','metal'][i],src=W.mats[kind];
    const mat=new T.MeshStandardMaterial({color:kind==='wood'?0xb19a7e:kind==='metal'?0x888c8c:0xc2bcae,map:src.map,normalMap:src.normalMap,roughnessMap:src.roughnessMap,roughness:kind==='metal'?.48:.86,metalness:kind==='metal'?.6:0});
    const panel=S.add(new T.Mesh(new T.BoxGeometry(1.4,2,.08),mat));panel.position.set((i-1)*1.6,301.05,-2.5);panel.castShadow=true;panel.receiveShadow=true;
    const box={minX:panel.position.x-.7,maxX:panel.position.x+.7,minY:300.05,maxY:302.05,minZ:-2.54,maxZ:-2.46};
    for(const [x,y,graze]of [[-.25,.35,false],[.24,.12,true],[0,-.30,false]])G.FX.impact(new T.Vector3(panel.position.x+x,301.2+y,-2.459),new T.Vector3(0,0,1),kind==='concrete'?'hard':kind,{box,direction:new T.Vector3(graze?.95:.1,.03,graze?-.3:-1).normalize(),weapon:G.WEAPONS.ar7});
   }
   G.camera.position.set(0,301.5,.35);G.camera.lookAt(0,301.12,-2.5);G.camera.updateMatrixWorld(true);
   for(let i=0;i<75;i++)G.FX.update(1/60);
   for(let i=0;i<60;i++){W.update(1/30,G.camera.position,G.camera);G.RoomLighting.update(1/30,G.camera.position)}
  });
  await capture('v80-material-impacts');
  await page.evaluate(()=>{
   const P=G.Player,a=P.a;G.FX.reset();a.pos.set(0,300,0);a.yaw=a.pitch=0;a.state='ground';a.onGround=true;a.crouch=a.prone=false;a.cur='rifle';a.weapons.rifle={id:'ar7',mag:30};P.ads=P.scopeView=0;P.sw=P.reload=null;P.raise=1;P.camMode='fp';G.VM.set('ar7');
   for(let i=0;i<120;i++)P.updateCamera(1/60);
  });
  await capture('v80-weapon-clear');
  await page.evaluate(()=>{
   const T=THREE,S=DetailCapture;S.wall=G.World.addCollider(-3,300,-.25,3,303.5,-.20,'hard',true);S.colliders.push(S.wall);
   S.wallMesh=S.add(new T.Mesh(new T.BoxGeometry(6,3.5,.05),new T.MeshStandardMaterial({color:0x91928c,map:G.World.mats.concrete.map,roughness:.9})));S.wallMesh.position.set(0,301.75,-.225);S.wallMesh.receiveShadow=true;
   for(let i=0;i<90;i++)G.Player.updateCamera(1/60);
  });
  await capture('v80-weapon-wall');
  await page.evaluate(()=>{
   const a=G.Player.a;a.cur='pistol';a.weapons.pistol={id:'p226',mag:18};G.VM.set('p226');
   for(let i=0;i<90;i++)G.Player.updateCamera(1/60);
  });
  await capture('v80-pistol-wall');
  await page.evaluate(()=>{
   const T=THREE,S=DetailCapture;G.World.removeCollider(S.wall);G.scene.remove(S.wallMesh);G.WeaponObstruction.reset(G.VM);G.VM.set(null);
   const create=(x,z)=>{const m=new G.CharacterModel({soldier:true,helmet:true}),a=new G.Actor({id:998,team:1});a.pos.set(x,300,z);a.yaw=Math.PI;a.model=m;m.root.position.copy(a.pos);G.scene.add(m.root);S.objects.push(m.root);return{m,a}};
   const stand=create(-.9,0),dead=create(.45,0),state={speed:0,pitch:0,onGround:true,state:'ground',cur:'rifle',gun:'ar7',groundY:300,distance2:4};
   for(let i=0;i<90;i++){stand.m.root.rotation.y=Math.PI;stand.m.update(1/60,state)}
   G.HitResponse.receive(stand.a,new T.Vector3(-1.1,301.4,0),new T.Vector3(1,0,0),50,false);
   for(let i=0;i<5;i++)stand.m.update(1/60,state);
   G.HitResponse.receive(dead.a,new T.Vector3(.45,301.4,0),new T.Vector3(1,0,0),100,false);
   for(let i=0;i<180;i++){dead.m.root.position.copy(dead.a.pos);dead.m.root.rotation.y=Math.PI;dead.m.update(1/60,{...state,dead:true})}
   G.camera.fov=60;G.camera.updateProjectionMatrix();G.camera.position.set(1.8,301.6,3.4);G.camera.lookAt(.3,300.75,0);G.camera.updateMatrixWorld(true);
   for(let i=0;i<60;i++){G.World.update(1/30,G.camera.position,G.camera);G.RoomLighting.update(1/30,G.camera.position)}
  });
  await capture('v80-hit-and-death');
  fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify({version:'80',files:fs.readdirSync(out).filter(p=>p.endsWith('.png')),errors:f.errors},null,2)+'\n');
  if(f.errors.length)throw Error(f.errors.join('\n'));console.log('PASS runtime close views',out);
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
