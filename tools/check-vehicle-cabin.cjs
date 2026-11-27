// 실제 F·V 입력, 좌석·손·발, 경사면 카메라와 하차·재입장 복귀를 검사한다.
const fs=require('fs'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
const mobile=process.env.CABIN_MOBILE==='1',output=process.env.REPORT||'/tmp/lz-vehicle-cabin.json';
(async()=>{const f=await fixture(null,mobile?{viewport:{width:915,height:412},contextOptions:{hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}}:{}),p=f.page,report={mobile,rows:[]};
 const tick=(n=1)=>p.evaluate(n=>{for(let i=0;i<n;i++){G.Player.update(1/60);G.Game.syncModels(1/60);G.Input.endFrame();}},n);
 const key=async(code,n=1)=>{await p.keyboard.down(code);await tick(n);await p.keyboard.up(code);};
 try{
  await p.evaluate(()=>{window.cabinTest={height:G.World.heightAt,water:G.World.waterAt,models:G.Vehicles.models};G.World.heightAt=()=>300;G.World.waterAt=()=>-100;G.paused=false;G.Input.reset();G.Input.locked=true;document.activeElement?.blur?.();});
  for(const kind of['porter','e2200','izh','fallback']){
   await p.evaluate(kind=>{const V=G.Vehicles,P=G.Player;if(kind==='fallback')V.models={};const v=cabinTest.v=V.newVehicle(0,300,0,0,{kind:kind==='fallback'?'izh':kind});V.models=cabinTest.models;P.vehicleView='third';P.a.pos.copy(v.pos);P.a.pos.x-=1.8;P.a.vel.set(0,0,0);P.a.onGround=true;P.a.state='ground';G.Input.reset();},kind);
   await key('f');await tick(2);assert(await p.evaluate(()=>G.Player.vehicle===cabinTest.v),kind+' F 탑승');
   const sample=await p.evaluate(()=>{
    const v=cabinTest.v,m=G.Player.a.model,T=THREE,s=G.VehicleCabin.profile(v),sd=m.soldier,inv=v.mesh.matrixWorld.clone().invert(),point=new T.Vector3();
    const pelvis=(sd?sd.hip:m.hip).getWorldPosition(point).applyMatrix4(inv).toArray();
    const hands=[0,1].map(i=>{G.VehicleCabin.contact(m,i,point);point.applyMatrix4(inv);return{actual:point.toArray(),error:point.distanceTo(G.VehicleCabin.grip(v,i,new T.Vector3()))};});
    let headTop=-Infinity;
    if(sd){const mesh=sd.body,g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,head=new Set(mesh.skeleton.bones.map((b,i)=>/head|neck/i.test(b.name)?i:-1));for(let i=0;i<g.attributes.position.count;i++){let weight=0;for(let k=0;k<4;k++)if(head.has(si.array[i*4+k]))weight+=sw.array[i*4+k];if(weight<.4)continue;mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);headTop=Math.max(headTop,point.y);}}
    const feet=sd?.footBones.map(b=>b.getWorldPosition(new T.Vector3()).applyMatrix4(inv).toArray());
    return{kind:v.cabinKind||v.kind,visible:m.root.visible,model:sd?.T.name||'절차적 대체',pelvis,pelvisError:new T.Vector3().fromArray(pelvis).distanceTo(new T.Vector3().fromArray(s.hip)),hands,feet,headTop:Number.isFinite(headTop)?headTop:null,roof:s.roof,gun:m.curGun,scope:G.Player.a.weapons.rifle.scope,rootQuaternion:m.root.quaternion.toArray(),vehicleQuaternion:v.mesh.quaternion.toArray(),near:G.camera.near};
   });report.rows.push(sample);assert(sample.visible&&sample.gun===null&&sample.pelvisError<.001,kind+' 좌석·무기 숨김');assert(sample.hands.every(h=>h.error<.025),kind+' 손바닥 위치');if(sample.headTop!==null)assert(sample.headTop<sample.roof,kind+' 머리 지붕 관통');
   // 손의 실제 뼈 위치를 기록한다. 모든 조향 각도는 아래 별도 반복 검사에서 확인한다.
   if(mobile){await p.waitForFunction(()=>document.querySelector('#touchUI [data-id="scope"] span').textContent==='시점');await p.locator('#touchUI [data-id="scope"]').tap();await tick();}
   else await key('v',60);
   sample.first=await p.evaluate(()=>{const P=G.Player,v=P.vehicle;G.camera.updateMatrixWorld(true);return{view:P.vehicleView,mode:P.camMode,localCamera:v.mesh.worldToLocal(G.camera.position.clone()).toArray(),near:G.camera.near,visible:P.a.model.root.visible,hidden:P.a.model.driverHead.hidden,culling:P.a.model.meshes.map(m=>m.frustumCulled),scope:P.a.weapons.rifle.scope,prompt:P.prompt};});
   assert.equal(sample.first.view,'first');assert(sample.first.visible&&sample.first.hidden&&sample.first.near<sample.near);assert(sample.first.prompt.includes('외부 시점'));
   sample.first.arms=await p.evaluate(()=>G.Player.a.model.driverBody.map(r=>({drawn:r.mesh.geometry===r.arms,count:r.arms.index.count,total:r.original.index?.count||r.original.attributes.position.count})));assert(sample.first.arms.some(r=>r.count>0)&&sample.first.arms.every(r=>r.drawn&&r.count<r.total),kind+' 내부 시점 몸통 제외');
   assert.equal(sample.first.scope,sample.scope,kind+' 운전 중 조준경 교체 방지');assert(sample.first.culling.every(value=>value===false),kind+' 내부 팔 컬링 방지');
   sample.render=await p.evaluate(()=>{G.renderNow();G.Perf.gpuWait();return{memory:{...G.renderer.info.memory},error:G.renderer.getContext().getError()};});assert.equal(sample.render.error,0);
   sample.slope=await p.evaluate(()=>{const V=G.Vehicles,P=G.Player,v=P.vehicle,W=G.World;W.heightAt=(x,z)=>300+x*.12+z*.18;for(let i=0;i<90;i++){P.update(1/60);G.Game.syncModels(1/60);G.Input.endFrame();}const local=v.mesh.worldToLocal(G.camera.position.clone()),expected=G.VehicleCabin.profile(v).eye,q=v.mesh.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(P.vehicleLookPitch,P.vehicleLookYaw,0,'YXZ')));const result={positionError:local.distanceTo(new THREE.Vector3().fromArray(expected)),rotationError:q.angleTo(G.camera.quaternion),bodyError:v.mesh.quaternion.angleTo(P.a.model.root.quaternion),pitch:v.pitch,roll:v.roll};W.heightAt=()=>300;return result;});
   assert(sample.slope.positionError<1e-5&&sample.slope.rotationError<1e-5&&sample.slope.bodyError<1e-5,kind+' 경사면 좌석·시점 이탈');
   if(mobile){await p.locator('#touchUI [data-id="scope"]').tap();await tick();}else await key('v');
   const third=await p.evaluate(()=>({view:G.Player.vehicleView,hidden:G.Player.a.model.driverHead.hidden,near:G.camera.near,cullingRestored:G.Player.a.model.driverHead.meshes.every(r=>r.mesh.frustumCulled===r.culled)}));assert.equal(third.view,'third');assert(!third.hidden&&third.near===sample.near&&third.cullingRestored);
   assert(await p.evaluate(()=>G.Player.a.model.driverBody.every(r=>r.mesh.geometry===r.original)),kind+' 외부 시점 전체 몸 복원');
   await key('f');await tick(2);assert(await p.evaluate(()=>!G.Player.vehicle&&!G.Player.a.model.driving&&!G.Player.a.model.driverHead.hidden&&G.Player.camMode==='fp'),kind+' 하차 복귀');
   sample.handsRestored=await p.evaluate(()=>(G.Player.a.model.driverGrip||[]).every(hand=>!hand||hand.wrist.quaternion.equals(hand.bind)&&hand.fingers.every(f=>f.bone.quaternion.equals(f.bind))));assert(sample.handsRestored,kind+' 하차 뒤 손 회전 복귀');
   await p.evaluate(()=>{const V=G.Vehicles,v=cabinTest.v;V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);});
  }
  report.rigs=await p.evaluate(()=>{
   const V=G.Vehicles,C=G.VehicleCabin,P=G.Player,original=P.a.model,templates=G.Soldiers.templates,rows=[],failures=[];
   const v=V.newVehicle(0,300,0,0,{kind:'izh'});V.enter(P,v);V.step(v,P.a,1/60,0,0,false,false);
   try{for(const template of[...templates,null]){
    G.Soldiers.templates=template?[template]:templates;const m=new G.CharacterModel({soldier:!!template});P.a.model=m;G.scene.add(m.root);
    try{for(const steer of[-1,0,1]){v.steer=steer;C.pose(m,v,false);const sd=m.soldier,point=new THREE.Vector3(),inv=v.mesh.matrixWorld.clone().invert(),hands=[0,1].map(i=>{C.contact(m,i,point);return point.applyMatrix4(inv).distanceTo(C.grip(v,i,new THREE.Vector3()));});C.pose(m,v,true);const arms=m.driverBody.some(r=>r.arms.index.count>0)&&m.driverBody.every(r=>r.mesh.geometry===r.arms&&r.arms.index.count<(r.original.index?.count||r.original.attributes.position.count));C.pose(m,v,false);const restored=m.driverBody.every(r=>r.mesh.geometry===r.original);rows.push({rig:template?.name||'절차적 대체',steer,hands,arms,restored});if(hands.some(x=>x>.025)||!arms||!restored)failures.push(rows[rows.length-1]);}}finally{C.release(m);m.dispose();}
   }}finally{G.Soldiers.templates=templates;P.a.model=original;V.exit(P,true);V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);}
   return{rows,failures};
  });
  report.cleanup=await p.evaluate(()=>{const P=G.Player,v=G.Vehicles.newVehicle(0,300,0,0,{kind:'porter'});G.Vehicles.enter(P,v);P.vehicleView='first';P.update(1/60);G.Game.syncModels(1/60);const expected=P.vehicleNear;G.toMenu();return{near:G.camera.near,expected,vehicle:!!P.vehicle,state:G.Game.state};});assert(!report.cleanup.vehicle&&report.cleanup.near===report.cleanup.expected&&report.cleanup.state==='menu');
  report.errors=f.errors;fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');assert.deepEqual(f.errors,[]);assert.deepEqual(report.rigs.failures,[],'핸들 손바닥 오차 — '+output);console.log('PASS 차량 좌석·실내 카메라·F/V·경사·하차·모든 캐릭터',JSON.stringify(report));
 }finally{if(!report.errors)fs.writeFileSync(output,JSON.stringify({...report,errors:f.errors},null,2)+'\n');await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
