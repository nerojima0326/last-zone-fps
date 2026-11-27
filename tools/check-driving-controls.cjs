
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 세 차종·대체 차량의 Space 전용 드리프트, Shift 가속과 자국 연결·고정 풀을 확인한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
const output=path.resolve(process.env.REPORT||'/tmp/lz-driving-controls.json');
(async()=>{const f=await fixture(process.env.VEHICLE_BASE||null),p=f.page;try{
 const report=await p.evaluate(()=>{
  const V=G.Vehicles,W=G.World,S=G.VehicleSkids,a=G.Game.player,T=THREE,methods={heightAt:W.heightAt,waterAt:W.waterAt},models=V.models,saved=a.pos.clone(),rows=[],failures=[];
  const check=(ok,message,details)=>{if(!ok)failures.push({message,...details});};
  const visual=()=>{G.FX.reset();S?.reset();if(!S&&V.skids){V.skids.count=0;V.skidN=0;}};
  const make=kind=>{visual();W.heightAt=()=>300;W.waterAt=()=>-100;V.models=kind==='fallback'?{}:models;const v=V.newVehicle(0,300,0,0,{kind:kind==='fallback'?'izh':kind});V.models=models;V.unblock(v);v.driver=a;return v;};
  const remove=v=>{v.driver=null;S?.stop(v);V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);};
  const tick=(v,dt,thr,steer,space,shift)=>{V.step(v,a,dt,thr,steer,false,space,shift);S?.update(dt);};
  G.camera.position.set(0,307,5);
  try{
   for(const kind of ['porter','e2200','izh','fallback'])for(const fps of [30,60,144]){
    const dt=1/fps;let v=make(kind);v.speed=16;let drift=false,slip=0;
    for(let i=0;i<fps*3;i++){tick(v,dt,1,1,false,false);drift||=!!v.drift;slip=Math.max(slip,Math.abs(v.lat));}
    let row={kind,fps,type:'방향키만',drift,slip,marks:V.skidN||0};rows.push(row);check(!drift&&row.marks===0&&slip<1.4,'방향키만으로 드리프트·자국 발생',row);remove(v);
    v=make(kind);v.speed=16;let active=false;
    for(let i=0;i<fps*2;i++){tick(v,dt,1,1,true,false);active||=!!v.drift;}
    const marks=V.skidN||0,rearLocked=v.wheels.filter(w=>!w.front).every(w=>Math.abs(w.angle)<1e-6);tick(v,dt,1,1,false,false);const stopped=!v.drift,releaseMarks=V.skidN||0;
    for(let i=0;i<fps;i++)tick(v,dt,1,1,false,false);
    row={kind,fps,type:'Space와 해제',active,marks,rearLocked,stopped,releaseMarks,finalMarks:V.skidN||0,slip:Math.abs(v.lat)};rows.push(row);check(active&&marks>0&&rearLocked&&stopped&&releaseMarks<=marks+2&&row.finalMarks===releaseMarks&&row.slip<1.4,'Space 전용 드리프트·해제 복귀',row);remove(v);
    const speeds=[];
    for(const shift of [false,true]){v=make(kind);for(let i=0;i<fps*12;i++)tick(v,dt,1,0,false,shift);speeds.push(v.speed);if(!shift)remove(v);}
    const spec=V.spec?.(v)||{max:21,boost:28},before=v.speed;tick(v,dt,1,0,false,false);const released=v.speed;tick(v,dt,1,1,true,true);const spacePriority=!v.boosting;
    v.pos.y+=6;v.grounded=false;v.flight=true;v.vy=0;const airSpeed=Math.hypot(v.speed,v.lat);tick(v,dt,1,0,false,true);
    row={kind,fps,type:'Shift 가속',normal:speeds[0],boost:speeds[1],spec,released,spacePriority,airBoost:!!v.boosting,airGain:Math.hypot(v.speed,v.lat)-airSpeed};rows.push(row);
    check(Math.abs(speeds[0]-spec.max)<.05&&Math.abs(speeds[1]-spec.boost)<.05&&before-released<.25&&spacePriority&&!row.airBoost&&row.airGain<.001,'Shift 가속·해제·Space 우선·공중 제한',row);remove(v);
   }
   const limits=[];
   for(const mode of ['입력 없음','후진','물속','타이어 4개 파손']){
    const v=make('izh');if(mode==='물속')W.waterAt=()=>300.8;if(mode==='타이어 4개 파손')v.wheelDamage=4;
    for(let i=0;i<600;i++)tick(v,1/60,mode==='입력 없음'?0:mode==='후진'?-1:1,0,false,true);
    limits.push({mode,speed:v.speed,boosting:!!v.boosting,top:V.spec?.(v).boost||28});remove(v);
   }
   check(limits[0].speed===0&&!limits[0].boosting&&limits[1].speed>=-6.01&&!limits[1].boosting&&limits[2].speed<=4.01&&!limits[2].boosting&&limits[3].speed<=limits[3].top*.4+.01,'가속 입력·후진·수면·파손 제한',{limits});
   let ribbons=null;
   if(S){
    visual();const car={skid:[null,null]},points=[];
    for(let i=0;i<600;i++){const t=i*.035;S.add(car,0,new T.Vector3(Math.sin(t)*4,300,Math.cos(t)*4),.26,.4);S.update(1/120);}
    const pos=S.position.array,ids=S.ids,slots=[];for(let i=0;i<S.capacity;i++)if(ids[i])slots.push({slot:i,id:ids[i]});slots.sort((a,b)=>a.id-b.id);let gap=0;
    for(let i=1;i<slots.length;i++)for(let edge=0;edge<2;edge++)for(let axis=0;axis<3;axis++)gap=Math.max(gap,Math.abs(pos[(slots[i-1].slot*4+2+edge)*3+axis]-pos[(slots[i].slot*4+edge)*3+axis]));
    const geometry=S.geometry,material=S.material;for(let i=600;i<600+S.capacity*3;i++){const t=i*.035;S.add(car,0,new T.Vector3(Math.sin(t)*4,300,Math.cos(t)*4),.26,.4);S.update(1/120);}
    ribbons={gap,capacity:S.capacity,total:S.total,count:S.mesh.count,draw:S.geometry.drawRange.count,reused:S.geometry===geometry&&S.material===material,finite:S.position.array.every(Number.isFinite),textures:!!S.material.map};
    check(gap<1e-6&&ribbons.total>ribbons.capacity&&ribbons.count===ribbons.capacity&&ribbons.draw===ribbons.capacity*6&&ribbons.reused&&ribbons.finite&&!ribbons.textures,'타이어 자국 연결·고정 풀',ribbons);
    S.stop(car);S.update(13);ribbons.cleared=S.geometry.drawRange.count===0;check(ribbons.cleared,'오래된 자국 정리',ribbons);
   }
   return {rows,limits,ribbons,failures};
  }finally{Object.assign(W,methods);V.models=models;a.pos.copy(saved);G.Input.reset();visual();}
 });
 report.errors=f.errors;fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:report.rows.length,failures:report.failures.slice(0,8),failureCount:report.failures.length,limits:report.limits,ribbons:report.ribbons,errors:f.errors},null,2));assert.deepEqual(f.errors,[]);assert.equal(report.failures.length,0,'운전 조작·자국 오류 — '+output);console.log('PASS Space 전용 드리프트·Shift 가속·조작 우선순위·부드러운 자국 연결·고정 풀');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
