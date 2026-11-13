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
const hands=await page.evaluate(()=>{
 const fail=(ok,msg)=>{if(!ok)throw Error(msg)};let frames=0,vertices=0,maxError=0,maxAngle=0,maxForearmTurn=0,maxElbowSpeed=0;
 for(const id of G.GUN_IDS){
  const m=G.VM.models[id];
  for(const arm of [m.armL,m.armR])arm.grp.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;const w=mesh.geometry.attributes.skinWeight,ix=mesh.geometry.attributes.skinIndex;
   for(let i=0;i<w.count;i++){
    const weights=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];
    fail(weights.every(x=>x>=0&&x<=1)&&Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-5,id+' normalized skin weights');
    fail([ix.getX(i),ix.getY(i),ix.getZ(i),ix.getW(i)].every(x=>x<mesh.skeleton.bones.length),id+' valid skin bone');vertices++;
   }
  });
  for(const mode of ['empty','tactical'])for(const dt of [1/120,1/30]){
   const st=ReloadStudio;st.select(id,mode);st.pause();
   const previous=[m.armL.handQ.clone(),m.armR.handQ.clone()];
   const forearms=[m.armL,m.armR].map(a=>({q:a.bE.quaternion.clone(),elbow:a.bE.position.clone()}));
   for(let t=0;t<st.duration+dt;t+=dt){
    st.advance(dt);
    for(const [j,arm]of [m.armL,m.armR].entries()){
     fail(arm.contactError<0.025,id+' '+mode+' contact gap '+arm.contactError);
     fail(arm.wristAngle<Math.PI/2+0.09,id+' '+mode+' wrist angle '+arm.wristAngle*180/Math.PI);
     fail(arm.handQ.angleTo(previous[j])<dt*10+0.001,id+' continuous wrist rotation');previous[j].copy(arm.handQ);
     const turn=arm.bE.quaternion.angleTo(forearms[j].q),speed=arm.bE.position.distanceTo(forearms[j].elbow)/dt;
     fail(turn<24*dt+0.025,id+' forearm rotation pops');fail(speed<12,id+' elbow position pops');
     forearms[j].q.copy(arm.bE.quaternion);forearms[j].elbow.copy(arm.bE.position);
     fail(arm.bT&&arm.bD,id+' distributed forearm rig');
     maxForearmTurn=Math.max(maxForearmTurn,turn);maxElbowSpeed=Math.max(maxElbowSpeed,speed);
     fail(arm.shoulderShift.length()<=0.09001,id+' limited shoulder reach');
     fail(Math.abs(arm.bS.position.distanceTo(arm.bE.position)-arm.a)<1e-5,id+' upper arm does not stretch');
     fail(Math.abs(arm.bE.position.distanceTo(arm.bW.position)-arm.bw)<1e-5,id+' forearm does not stretch');
     fail(arm.thumbB[0].quaternion.angleTo(arm.thumbRest)<0.521,id+' thumb preserves opposition');
     maxError=Math.max(maxError,arm.contactError);maxAngle=Math.max(maxAngle,arm.wristAngle);
    }
    if(m.holdObj){
     const contact=m.keys.grab.clone().applyAxisAngle(new window.THREE.Vector3(1,0,0),m.holdObj.rotation.x).add(m.holdObj.position);
     fail(contact.distanceTo(m.armL.contact)<1e-6,id+' carried magazine stays in hand');
    }
    frames++;
   }
  }
 }
 return{frames,vertices,maxContactErrorMm:maxError*1000,maxWristDegrees:maxAngle*180/Math.PI,maxForearmTurnDegrees:maxForearmTurn*180/Math.PI,maxElbowSpeed};
});console.log('Hand rig:',JSON.stringify(hands));
// Reloads should move the support shoulder and elbow while the hand works.
// Check every gun and both reload modes, then verify the reload influence clears.
const elbowMotion=await page.evaluate(()=>{
 let cases=0,minShoulder=Infinity,minElbow=Infinity;
 for(const id of G.GUN_IDS)for(const mode of ['empty','tactical']){
  const st=ReloadStudio;st.select(id,mode);st.pause();
  const arm=st.model.armL,start=arm.bE.position.clone();let shoulder=0,elbow=0;
  for(let t=0;t<st.duration;t+=1/60){
   st.advance(1/60);shoulder=Math.max(shoulder,arm.shoulderShift.length());
   elbow=Math.max(elbow,arm.bE.position.distanceTo(start));
  }
  if(shoulder<0.01||elbow<0.04)throw Error(id+' '+mode+' reload shoulder or elbow is static');
  for(let i=0;i<30;i++)st.advance(1/60);
  if(arm.motionWeight!==0)throw Error(id+' reload shoulder influence remains after reload');
  minShoulder=Math.min(minShoulder,shoulder);minElbow=Math.min(minElbow,elbow);cases++;
 }
 return {cases,minShoulderCm:minShoulder*100,minElbowCm:minElbow*100};
});console.log('Reload shoulder and elbow movement:',JSON.stringify(elbowMotion));
const seekChecks=await page.evaluate(()=>{
 let cases=0;
 for(const id of ['ar7','s12','db2','de7']){
  const st=ReloadStudio;st.select(id);st.pause();st.seek(st.duration*0.62);
  const arm=st.model.armL,pose=[arm.bE,arm.bT,arm.bD,arm.bW].map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
  st.seek(st.duration*0.25);st.seek(st.duration*0.62);
  [arm.bE,arm.bT,arm.bD,arm.bW].forEach((b,j)=>{
   if(b.position.distanceTo(pose[j].p)>1e-7||b.quaternion.angleTo(pose[j].q)>1e-5)throw Error(id+' seek leaves stale arm state');
  });cases++;
 }return cases;
});console.log('Repeatable arm seeks:',seekChecks);
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
const imported=await page.evaluate(()=>{
 const R=G.ReloadAssets,st=ReloadStudio,out=[];
 if(!R.ready)throw Error('Bundled reload clips did not load');
 for(const id of ['sc17','sa12','aa12','m1014','db2'])for(const mode of ['empty','tactical']){
  st.select(id,mode);st.pause();st.seek(st.duration*.43);
  const m=st.model, motion=m.reloadMotion;
  if(!motion||!motion.weight||!Number.isFinite(motion.time))throw Error('Source clip not used: '+id);
  const expected=['m1014','db2'].includes(id)?'Armature|SG_FPS_Reload':mode==='empty'?'Rig|AK_Reload_full':'Rig|AK_Reload';
  if(motion.sourceClip!==expected)throw Error('Wrong reload clip: '+id+' '+mode);
  const rotation=m.root.quaternion.clone(),position=m.root.position.clone();
  try{
   R.ready=false;st.seek(st.duration*.43);
   if(m.reloadMotion)throw Error('Missing-asset fallback still uses clip');
   const difference=rotation.angleTo(m.root.quaternion)+position.distanceTo(m.root.position);
   if(difference<.01)throw Error('Imported source has no visible effect: '+id+' '+mode);
   out.push({id,mode,source:expected,difference});
  }finally{R.ready=true;}
  st.select(id,mode);st.pause();let maximum=0;
  for(let t=0;t<st.duration;t+=1/60){st.advance(1/60);maximum=Math.max(maximum,st.model.reloadMotion?.handDisplacement||0);}
  if(maximum<.001)throw Error('Source wrist trajectory was not retargeted: '+id+' '+mode);
  out[out.length-1].handTravelMm=maximum*1000;
 }
 return out;
});
console.log('Imported reload clips:',JSON.stringify(imported));
if(process.env.SHOTS){
 fs.mkdirSync(process.env.SHOTS,{recursive:true});
 for(const id of ['ka47','de7']){
  await page.evaluate(id=>{ReloadStudio.select(id);ReloadStudio.pause();ReloadStudio.seek(ReloadStudio.duration*.76)},id);
  await page.screenshot({path:path.join(process.env.SHOTS,id+'.png')});
 }
}
assert.equal(errors.length,0,errors.join('\n'));
console.log('PASS: 30 real-asset animations, 240 poses, continuous hand rig checks, 360 ammo/sound cases; no page errors.');
}catch(e){console.error(e.stack);process.exitCode=1}finally{await browser.close();server.close()}
})();
