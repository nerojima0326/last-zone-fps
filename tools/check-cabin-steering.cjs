
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// v107 실제 A/D·터치 입력 0.5초와 차체·앞바퀴·실내 핸들·손의 방향을 함께 검사한다.
const fs=require('fs'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
const mobile=process.env.CABIN_MOBILE==='1',output=process.env.REPORT||'/tmp/lz-cabin-steering.json';
(async()=>{const f=await fixture(process.env.BASELINE_CABIN,mobile?{viewport:{width:844,height:390},contextOptions:{hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}}:{}),p=f.page,report={mobile,rows:[],visibility:[],failures:[]};
 await p.evaluate(require('./cabin-occlusion.cjs'));
 await p.evaluate(()=>{const S=G.Soldiers,templates=S.templates,old=G.Player.a.model;S.templates=[templates.find(t=>/ranger/.test(t.name))||templates[0]];const m=new G.CharacterModel({outfit:{top:0x4a5236,pants:0x3e4430,gear:0x2f3324},skin:0xd8a77f});S.templates=templates;G.Player.a.model=m;G.scene.add(m.root);old.dispose();});
 const tick=()=>p.evaluate(()=>{for(let i=0;i<30;i++){G.Player.update(1/60);G.Game.syncModels(1/60);G.Input.endFrame();}});
 try{
  await p.evaluate(()=>{window.steerTest={height:G.World.heightAt,water:G.World.waterAt,models:G.Vehicles.models};G.World.heightAt=()=>300;G.World.waterAt=()=>-100;G.paused=false;G.Input.reset();G.Input.locked=true;document.activeElement?.blur();});
  const cdp=mobile?await p.context().newCDPSession(p):null;
  for(const kind of ['porter','e2200','izh','fallback']){
   await p.evaluate(kind=>{const V=G.Vehicles,P=G.Player;if(kind==='fallback')V.models={};steerTest.v=V.newVehicle(0,300,0,0,{kind:kind==='fallback'?'izh':kind});V.models=steerTest.models;V.enter(P,steerTest.v);},kind);
   for(const view of ['first','third'])for(const [key,sign]of [['a',1],['d',-1]]){
    await p.evaluate(view=>{const v=steerTest.v,P=G.Player;G.Input.reset();P.vehicleView=view;P.vehicleLookYaw=0;P.vehicleLookPitch=-.22;v.pos.set(0,300,0);Object.assign(v,{yaw:0,steer:0,steerAngle:0,yawRate:0,speed:18,lat:0,pitch:0,roll:0,driftBlend:0});G.Vehicles.place(v,1);G.VehicleWheels.sync(v);G.Game.syncModels(1/60);},view);
    if(mobile){
     const box=await p.locator('#touchUI [data-id="stick"]').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,r=box.width/2;
     const point=(x,y)=>({id:1,x,y,radiusX:2,radiusY:2,force:1});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(x,y)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(x-sign*r*.7,y-r*.7)]});
     await p.waitForFunction(key=>G.Input.down(key)&&G.Input.down('KeyW'),key==='a'?'KeyA':'KeyD');
    }else{await p.keyboard.down('w');await p.keyboard.down(key);}
    await tick();
    const row=await p.evaluate(()=>{const v=steerTest.v,m=G.Player.a.model,c=v.cabin,T=THREE;v.mesh.updateMatrixWorld(true);G.camera.updateMatrixWorld(true);const inv=v.mesh.matrixWorld.clone().invert();const hands=[0,1].map(i=>G.VehicleCabin.contact(m,i,new T.Vector3()).applyMatrix4(inv).distanceTo(G.VehicleCabin.grip(v,i,new T.Vector3())));const center=c.wheel.localToWorld(new T.Vector3()).project(G.camera),top=c.wheel.localToWorld(new T.Vector3(0,.205,0)).project(G.camera);return{yaw:v.yaw,x:v.pos.x,steer:v.steer,wheelAngle:c.wheel.rotation.z,front:(v.wheels||[]).filter(w=>w.front).map(w=>w.steer),hands,topX:top.x-center.x,speed:Math.hypot(v.speed,v.lat)*3.6,occlusion:G.Player.vehicleView==='first'?measureCabinOcclusion(v,m):null};});
    Object.assign(row,{kind,view,key,seconds:.5});report.rows.push(row);
    const fail=reason=>report.failures.push({kind,view,key,reason,...row});
    if(!(row.yaw*sign>0&&row.x*sign<0&&row.steer*sign>0))fail('차체 조향 방향');
    if(!(row.wheelAngle*sign>0))fail('핸들 회전 부호');
    if(row.front.some(a=>a*sign<=0))fail('앞바퀴 조향 방향');
    if(row.hands.some(gap=>gap>.025))fail('핸들 손바닥 접촉');
    if(row.occlusion&&row.occlusion.fraction>.025)fail('팔의 계기판 픽셀 가림 2.5% 초과');
    if(view==='first'&&!(row.topX*sign<0))fail('운전석에서 본 핸들 윗점의 좌우 이동');
    if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});else{await p.keyboard.up(key);await p.keyboard.up('w');}
   }
   // v108 정지·양쪽 기계적 최대 조향도 실제 팔 마스크로 검사한다.
   for(const steer of[0,1,-1]){
    const row=await p.evaluate(steer=>{const v=steerTest.v,P=G.Player;G.Input.reset();P.vehicleView='first';P.vehicleLookYaw=0;P.vehicleLookPitch=-.22;v.pos.set(0,300,0);Object.assign(v,{yaw:0,steer,speed:0,lat:0,pitch:0,roll:0});G.Vehicles.place(v,1);for(let i=0;i<20;i++)G.Game.syncModels(1/60);G.VehicleCabin.camera(P,1);return{steer,wheelAngle:v.cabin.wheel.rotation.z,occlusion:measureCabinOcclusion(v,P.a.model)};},steer);
    report.visibility.push({kind,...row});if(row.occlusion.fraction>.025)report.failures.push({kind,reason:'정지·최대 조향 계기판 가림',...row});
   }
   await p.evaluate(()=>{const V=G.Vehicles,v=steerTest.v;V.exit(G.Player,true);V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);});
  }
  report.errors=f.errors;fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({mobile,cases:report.rows.length,failures:report.failures},null,2));assert.deepEqual(f.errors,[]);assert.deepEqual(report.failures,[]);console.log('PASS 4종·내외부 A/D 0.5초 조향·손 접촉',mobile?'모바일 터치':'키보드');
 }finally{if(!report.errors)fs.writeFileSync(output,JSON.stringify({...report,errors:f.errors},null,2)+'\n');await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
