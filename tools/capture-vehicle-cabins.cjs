
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// v107 실제 훈련장·동일 출발점에서 정지/A/D 고속·외부·밤 운전석을 촬영한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
const out=path.resolve(process.env.SHOTS||'/tmp/last-zone-cabins'),mobile=process.env.CABIN_MOBILE==='1',viewport=mobile?{width:844,height:390}:{width:1280,height:720};
const root=path.resolve(__dirname,'..');if(out===root||out.startsWith(root+path.sep))throw Error('원본 캡처는 저장소 밖에 저장하세요.');
(async()=>{const f=await fixture(process.env.BASELINE,{viewport,contextOptions:mobile?{hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}:undefined}),p=f.page,report={mobile,viewport,baseline:process.env.BASELINE||null,rows:[]};fs.mkdirSync(out,{recursive:true});
 try{
  await p.evaluate(scale=>{
   const S=G.Soldiers,templates=S.templates,old=G.Player.a.model;S.templates=[templates.find(t=>/ranger/.test(t.name))||templates[0]];const m=new G.CharacterModel({outfit:{top:0x4a5236,pants:0x3e4430,gear:0x2f3324},skin:0xd8a77f});S.templates=templates;G.Player.a.model=m;G.scene.add(m.root);old.dispose();
   window.cabinShot={models:G.Vehicles.models,course:G.World.course};G.VM.set(null);G.setRenderResolution(scale);G.World.setTimeOfDay('day');
  },process.env.CABIN_SCALE||'100');
  const take=async(kind,state)=>{
   const row=await p.evaluate(()=>{
    const v=cabinShot.v,P=G.Player,R=G.renderer;G.World.update(0,G.camera.position,G.camera);G.UI.update(1/60);G.renderNow();G.Perf.gpuWait();
    const c=v.cabin;return{speed:Math.hypot(v.speed,v.lat||0)*3.6,steer:v.steer,wheelAngle:c.wheel.rotation.z,rpm:c.rpm??null,eye:G.camera.position.toArray(),view:P.vehicleView,lookPitch:P.vehicleLookPitch,resolution:G.renderResolutionInfo(),image:R.domElement.toDataURL('image/png').split(',')[1]};
   });
   const file=kind+'-'+state+'.png';fs.writeFileSync(path.join(out,file),Buffer.from(row.image,'base64'));delete row.image;Object.assign(row,{kind,state,file});report.rows.push(row);if(state==='right-fast')assert(row.speed>=60,kind+' D 주행 60km/h 이상');console.log(kind,state,row.speed.toFixed(1)+'km/h');
  };
  for(const kind of['porter','e2200','izh','fallback']){
   await p.evaluate(kind=>{const V=G.Vehicles,C=cabinShot.course;if(kind==='fallback')V.models={};const x=C.x1,z=(C.z0+C.z1)/2+12,v=cabinShot.v=V.newVehicle(x,G.World.heightAt(x,z),z,0,{kind:kind==='fallback'?'izh':kind});V.models=cabinShot.models;cabinShot.start=v.pos.clone();V.enter(G.Player,v);G.Player.vehicleView='first';G.paused=false;G.Input.reset();G.Input.locked=true;document.activeElement?.blur();},kind);
   for(const [state,key]of[['stopped',null],['left','a'],['right-fast','d']]){
    await p.evaluate(moving=>{const v=cabinShot.v;G.Input.reset();v.pos.copy(cabinShot.start);Object.assign(v,{yaw:0,steer:0,steerAngle:0,yawRate:0,speed:moving?18:0,lat:0,pitch:0,roll:0,driftBlend:0,verticalSpeed:0,displayRpm:800});G.Vehicles.place(v,1);G.VehicleWheels.sync(v);for(let i=0;i<20;i++){if(!moving)G.Player.update(1/60);G.Game.syncModels(1/60);}G.VehicleCabin.camera(G.Player,1);},!!key);
    if(key){await p.keyboard.down('w');await p.keyboard.down(key);await p.keyboard.down('Shift');await p.evaluate(()=>{for(let i=0;i<30;i++){G.Player.update(1/60);G.Game.syncModels(1/60);G.Input.endFrame();}});await p.keyboard.up(key);await p.keyboard.up('w');await p.keyboard.up('Shift');}
    await take(kind,state);
   }
   await p.evaluate(()=>{const v=cabinShot.v,s=G.VehicleCabin.profile(v),T=THREE;G.Player.vehicleView='third';G.Game.syncModels(1/60);v.mesh.updateMatrixWorld(true);G.camera.position.set(-2.2,s.eye[1]+.3,s.wheel[2]-1.8).applyMatrix4(v.mesh.matrixWorld);G.camera.lookAt(new T.Vector3(s.hip[0],s.dash+.1,s.wheel[2]).applyMatrix4(v.mesh.matrixWorld));G.camera.fov=55;G.camera.updateProjectionMatrix();});await take(kind,'outside');
   await p.evaluate(()=>{const v=cabinShot.v;G.World.setTimeOfDay('night');v.hp=v.maxHp?v.maxHp*.2:320;v.handbrake=true;G.Player.vehicleView='first';G.Player.vehicleLookYaw=0;G.VehicleCabin.camera(G.Player,1);G.Game.syncModels(1/60);});await take(kind,'night');
   await p.evaluate(()=>{G.World.setTimeOfDay('day');const V=G.Vehicles,v=cabinShot.v;V.exit(G.Player,true);V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);});
  }
  report.resources=await p.evaluate(()=>{
   const V=G.Vehicles,P=G.Player,T=THREE,C=cabinShot.course,x=C.x1,z=(C.z0+C.z1)/2,v=V.newVehicle(x,G.World.heightAt(x,z),z,0,{kind:'porter'}),proof=new T.Scene(),m=P.a.model,R=G.renderer;proof.add(new T.HemisphereLight(0xffffff,0x667066,2),v.mesh,m.root);
   const cycle=i=>{if(P.vehicle)V.exit(P,true);V.enter(P,v);P.vehicleView=i%2?'third':'first';P.update(1/60);G.Game.syncModels(1/60);R.setRenderTarget(null);R.render(proof,G.camera);G.Perf.gpuWait();};for(let i=0;i<4;i++)cycle(i);const base={...R.info.memory};for(let i=0;i<8;i++)cycle(i);const result={geometries:R.info.memory.geometries-base.geometries,textures:R.info.memory.textures-base.textures};G.scene.add(v.mesh,m.root);V.exit(P,true);V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);return result;
  });
  report.errors=f.errors;assert.deepEqual(f.errors,[]);assert.deepEqual(report.resources,{geometries:0,textures:0});console.log('PASS 4차종 정지/A/D 60km/h·외부·밤·자원 재사용');
 }finally{fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({...report,errors:f.errors},null,2)+'\n');await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
