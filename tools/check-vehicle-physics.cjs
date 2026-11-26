// 벽 충돌·부분 접지·절벽 접근·공중 관성과 훈련장의 모든 차종을 검사한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
const output=path.resolve(process.env.REPORT||'/tmp/lz-vehicle-physics.json');
(async()=>{
 const f=await fixture(process.env.VEHICLE_BASE||null,{fallback:process.env.VEHICLE_FALLBACK==='1'}),p=f.page;
 try{
  const report=await p.evaluate(()=>{
   const V=G.Vehicles,W=G.World,T=THREE,P=G.Player,a=P.a,ownerPos=a.pos.clone(),methods={heightAt:W.heightAt,waterAt:W.waterAt},models=V.models,rows=[],failures=[];
   const check=(ok,message,details={})=>{if(!ok)failures.push({message,...details});};
   const training={kinds:V.list.map(v=>v.kind).sort(),positions:V.list.map(v=>({kind:v.kind,pos:v.pos.toArray(),yaw:v.yaw,hl:v.dim.hl,hw:v.dim.hw})),labels:document.querySelector('#trainingHint')?.textContent};
   check(['porter','e2200','izh'].every(k=>training.kinds.includes(k)),'훈련장 모든 차종 배치',{kinds:training.kinds});
   const remove=v=>{v.driver=null;V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);};
   const make=kind=>{W.heightAt=()=>300;V.models=kind==='fallback'?{}:models;const v=V.newVehicle(0,300,0,0,{kind:kind==='fallback'?'izh':kind});V.models=models;V.unblock(v);v.driver=a;return v;};
   const contacts=v=>{v.mesh.updateMatrixWorld(true);return v.wheels.filter(w=>{const box=new T.Box3().setFromObject(w.model),point=w.o.getWorldPosition(new T.Vector3());return Math.abs(box.min.y-W.heightAt(point.x,point.z))<.08;}).length;};
   W.waterAt=()=>-100;
   try{
    for(const kind of ['porter','e2200','izh','fallback'])for(const fps of [30,60,144]){
     let v=make(kind),wall=W.addCollider(-8,299,-9,8,305,-8.7,'hard',true);v.speed=18;let hit=false;const initialHP=v.hp;
     try{
      for(let i=0;i<fps*2;i++){V.step(v,a,1/fps,0,0,false,false);if(v.bump||v.hp<initialHP){hit=true;break;}}
      const impactSpeed=v.speed,at=v.pos.z;for(let i=0;i<fps*.5;i++)V.step(v,a,1/fps,-1,0,false,false);
      const row={kind,fps,type:'정면 충돌',hit,impactSpeed,reverseDistance:v.pos.z-at,speed:v.speed,hp:v.hp};rows.push(row);
      check(hit&&Math.abs(impactSpeed)<1.0,'정면 충돌 뒤 전진 속도 제거',row);check(row.reverseDistance>.40,'충돌 후 후진 복귀',row);
     }finally{W.removeCollider(wall);remove(v);}
     v=make(kind);wall=W.addCollider(3,299,-40,3.3,305,10,'hard',true);v.pos.x=3-v.dim.hw-.045;v.speed=16;v.lat=1;V.place(v,1);const hp=v.hp;
     try{
      for(let i=0;i<fps*.5;i++)V.step(v,a,1/fps,0,-.12,false,false);
      const parallel=-Math.cos(v.yaw)*v.speed-Math.sin(v.yaw)*v.lat,row={kind,fps,type:'벽 스침',parallelSpeed:-parallel,hpLost:hp-v.hp};rows.push(row);
      check(row.parallelSpeed>12,'벽을 스칠 때 진행 방향 유지',row);check(row.hpLost===0,'약한 접촉에 고속 정면 충돌 피해를 적용하지 않음',row);
     }finally{W.removeCollider(wall);remove(v);}
    }
    for(const kind of ['porter','e2200','izh','fallback']){
     let v=make(kind);V.step(v,a,1/60,1,0,false,false);const full=v.speed;remove(v);
     v=make(kind);W.heightAt=(x,z)=>z<-.25?299:300;V.place(v,1-Math.exp(-10/120),1/120);const actual=contacts(v),reported=v.groundContacts;V.step(v,a,1/60,1,0,false,false);
     const partial={kind,type:'부분 접지',actual,reported,fullAcceleration:full,partialAcceleration:v.speed};rows.push(partial);check(actual===2&&reported===actual,'실제 타이어의 부분 접지 수',partial);check(v.speed<full*.8,'두 바퀴만 닿았을 때 구동력 감소',partial);remove(v);
     v=make(kind);const edge=Math.max(...v.dim.wheelPts.map(p=>-p[1]))+.15;W.heightAt=(x,z)=>z<-edge?299:300;v.speed=1;V.step(v,a,1/60,0,0,false,false);
     const ledge={kind,type:'절벽 접근',speed:v.speed,pitch:v.pitch,contacts:contacts(v)};rows.push(ledge);check(v.speed<1&&Math.abs(v.pitch)<.001,'바퀴가 평지에 있을 때 절벽 예측으로 가속하지 않음',ledge);remove(v);
     const air=[];
     for(const steer of [-1,1]){
      v=make(kind);v.speed=12;for(let i=0;i<24;i++)V.step(v,a,1/60,0,1,false,false);const yaw=v.yaw,speed=Math.hypot(v.speed,v.lat);v.pos.y+=6;v.grounded=false;v.flight=true;v.vy=0;
      for(let i=0;i<15;i++)V.step(v,a,1/60,1,steer,false,false);
      air.push({steer,yawDelta:v.yaw-yaw,pos:v.pos.toArray(),speed:Math.hypot(v.speed,v.lat),initialSpeed:speed});remove(v);
     }
     const airborne={kind,type:'공중 회전',air};rows.push(airborne);check(air.every(r=>r.yawDelta>.04&&r.speed<=r.initialSpeed+.001),'공중에서 기존 각운동량 유지·가속 차단',airborne);check(Math.abs(air[0].yawDelta-air[1].yawDelta)<1e-8,'공중 핸들 입력으로 차체를 돌리지 않음',airborne);
     v=make(kind);const beam=W.addCollider(-8,300+v.dim.top-.12,-9,8,300+v.dim.top+.2,-8.7,'hard',true);v.speed=12;let roofHit=false;
     try{for(let i=0;i<180;i++){const speed=v.speed;V.step(v,a,1/60,0,0,false,false);if(v.bump||speed>5&&Math.abs(v.speed)<speed*.25){roofHit=true;break;}}const row={kind,type:'차체 높이',top:v.dim.top,hit:roofHit,z:v.pos.z};rows.push(row);check(roofHit,'실제 지붕 높이의 장애물 충돌',row);}finally{W.removeCollider(beam);remove(v);}
     v=make(kind);v.driver=null;v.speed=18;const wall=W.addCollider(-8,299,-9,8,305,-8.7,'hard',true);let minimum=Infinity;
     try{for(let i=0;i<120;i++){V.update(1/60);minimum=Math.min(minimum,v.pos.z-v.dim.hl);}const row={kind,type:'하차한 차량 충돌',minimum,limit:-8.7,parked:!!v.box};rows.push(row);check(minimum>=-8.78&&row.parked,'하차한 차량의 범퍼 관통·정차',row);}finally{W.removeCollider(wall);remove(v);}
    }
    return {training,rows,failures};
   }finally{Object.assign(W,methods);V.models=models;a.pos.copy(ownerPos);G.FX.reset();}
  });
  fs.writeFileSync(output,JSON.stringify({...report,errors:f.errors},null,2)+'\n');
  if(!process.env.VEHICLE_BASE){
   report.range=[];
   for(let visit=0;visit<3;visit++){
    const cars=await p.evaluate(()=>G.Vehicles.list.map(v=>v.kind));
    const initial=await p.evaluate(()=>{
     const V=G.Vehicles,W=G.World;let colliders=0;for(const v of V.list){if(!v.box)continue;W.queryBoxes(v.box.minX,v.box.minZ,v.box.maxX,v.box.maxZ,b=>{if(b===v.box)colliders++;});if(Math.abs(v.box.maxY-v.box.minY-v.dim.top)>.001)throw Error('주차 차량의 실제 높이 충돌 '+v.kind);}
     return {cars:V.list.length,bays:G.Training.vehicleBays.map(b=>b.kind),colliders};
    });
    assert.equal(initial.cars,3);assert.equal(initial.colliders,3);assert.deepEqual([...initial.bays].sort(),['e2200','izh','porter']);
    const rows=[];
    for(const kind of cars){
     await p.evaluate(kind=>{
      const P=G.Player,V=G.Vehicles,v=V.list.find(v=>v.kind===kind),a=P.a;G.paused=false;document.activeElement?.blur?.();G.Input.reset();G.Input.locked=true;a.pos.copy(v.pos).add(new THREE.Vector3(Math.cos(v.yaw)*(v.dim.hw+.8),0,-Math.sin(v.yaw)*(v.dim.hw+.8)));a.vel.set(0,0,0);a.state='ground';a.onGround=true;P.update(1/60);G.Input.endFrame();
     },kind);
     await p.keyboard.down('f');await p.evaluate(()=>{G.Player.update(1/60);G.Input.endFrame();});await p.keyboard.up('f');
     const entered=await p.evaluate(()=>G.Player.vehicle?.kind);assert.equal(entered,kind,'F 탑승 '+kind);
     await p.keyboard.down('w');await p.evaluate(()=>{for(let i=0;i<60;i++){G.Player.update(1/60);G.Input.endFrame();}});await p.keyboard.up('w');
     const driven=await p.evaluate(()=>{const v=G.Player.vehicle;return {kind:v.kind,speed:v.speed,moved:Math.hypot(v.pos.x-v.home.x,v.pos.z-v.home.z),home:{...v.home}}});assert(driven.speed>3&&driven.moved>1,kind+' 실제 입력 주행');
     await p.keyboard.down('f');await p.evaluate(()=>{G.Player.update(1/60);G.Input.endFrame();});await p.keyboard.up('f');assert(await p.evaluate(()=>!G.Player.vehicle),kind+' F 하차');rows.push(driven);
    }
    const respawn=await p.evaluate(()=>{
     const V=G.Vehicles,P=G.Player,C=G.World.course;P.a.pos.set(C.x1-10,G.World.heightAt(C.x1-10,C.z0+10),C.z0+10);G.Input.reset();
     const old=V.list.slice();for(const v of old)V.explode(v);
     return old.map(v=>{const home=v.home,kind=v.kind,ok=V.respawn(v),fresh=V.list.find(v=>v.home===home);return {kind,ok,homeMatches:!!fresh&&fresh.kind===home.kind,hp:fresh?.hp,tires:fresh?.wheels.every(w=>w.hp===36&&!w.flat)};});
    });for(const r of respawn)assert(r.ok&&r.homeMatches&&r.hp===1600&&r.tires,'훈련장 차종 재생성 '+r.kind);
    report.range.push({visit,initial,rows,respawn});
    if(visit<2)await p.evaluate(()=>{G.toMenu();G.startGame({...G.UI.opts,mode:'training',quality:'low'});G.paused=true;G.UI.showPause(false);G.Input.locked=true;});
   }
  }
  report.errors=f.errors;fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({training:report.training,rows:report.rows.length,failures:report.failures.slice(0,8),failureCount:report.failures.length,errors:f.errors},null,2));
  assert.deepEqual(f.errors,[]);assert.equal(report.failures.length,0,'차량 물리·훈련장 오류 — '+output);console.log('PASS 정면/측면 충돌·후진·부분 접지·절벽 접근·공중 관성·모든 차종 훈련장');
 }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
