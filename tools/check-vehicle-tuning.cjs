// v108 차종별 실제 물리의 가속·최고 속도·8m/s 회전 반경을 30/60/144Hz로 잰다.
require('./artifact-paths.cjs');
const fs=require('fs'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
(async()=>{const f=await fixture(process.env.VEHICLE_BASE);try{const r=await f.page.evaluate(baseline=>{
 const V=G.Vehicles,W=G.World,a=G.Player.a,models=V.models,methods={h:W.heightAt,w:W.waterAt},rows=[];W.heightAt=()=>300;W.waterAt=()=>-100;
 try{for(const kind of['porter','e2200','izh','fallback'])for(const hz of baseline?[60]:[30,60,144]){
  if(kind==='fallback')V.models={};const v=V.newVehicle(0,300,0,0,{kind:kind==='fallback'?'izh':kind});V.models=models;V.unblock(v);v.driver=a;let sixty=null;
  for(let i=0;i<hz*18;i++){V.step(v,a,1/hz,1,0,false,false,false);if(sixty===null&&v.speed*3.6>=60)sixty=(i+1)/hz;}
  const top=v.speed*3.6;v.pos.set(0,300,0);v.speed=v.lat=v.yaw=v.steer=v.yawRate=0;V.place(v,1);
  for(let i=0;i<hz*18;i++)V.step(v,a,1/hz,1,0,false,false,true);const boost=v.speed*3.6;
  v.pos.set(0,300,0);v.yaw=v.steer=v.yawRate=v.lat=0;V.place(v,1);for(let i=0;i<hz*8;i++){v.speed=8;V.step(v,a,1/hz,0,1,false,false,false);}const radius=Math.hypot(v.speed,v.lat)/Math.abs(v.yawRate),hp=v.maxHp,before=v.hp;V.damage(v,100,null,'crash');const crashLoss=before-v.hp,spec=V.spec?.(v)||null;
  if(spec)G.VehicleCabin.ensure(v);rows.push({kind,hz,zeroTo60:sixty,topKph:top,boostKph:boost,turnRadiusAt8:radius,hp,crashLoss,spec,dial:v.cabin?.cluster.maxKph});
  V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);
 }}finally{W.heightAt=methods.h;W.waterAt=methods.w;V.models=models;}return{baseline,rows};
 },!!process.env.VEHICLE_BASE);fs.writeFileSync(process.env.REPORT||'/tmp/lz-vehicle-tuning.json',JSON.stringify({...r,errors:f.errors},null,2)+'\n');for(const x of r.rows){assert(x.zeroTo60>0&&x.zeroTo60<18);assert(x.turnRadiusAt8>2);if(x.spec){assert(Math.abs(x.topKph-x.spec.max*3.6)<.05);assert(Math.abs(x.boostKph-x.spec.boost*3.6)<.05);assert.equal(x.hp,x.spec.hp);assert.equal(x.dial,x.spec.dial);assert(Math.abs(x.crashLoss-100*Math.sqrt(x.spec.mass/1.7))<1e-9);}}
 if(!r.baseline){const at=k=>r.rows.find(x=>x.kind===k&&x.hz===60);assert(at('porter').zeroTo60>at('e2200').zeroTo60&&at('e2200').zeroTo60>at('izh').zeroTo60);assert(at('porter').topKph<at('e2200').topKph&&at('e2200').topKph<at('izh').topKph);assert(at('porter').hp>at('e2200').hp&&at('e2200').hp>at('izh').hp);}
 assert.deepEqual(f.errors,[]);console.log('PASS 차종 물리 측정',JSON.stringify(r.rows.map(x=>({kind:x.kind,hz:x.hz,seconds:x.zeroTo60,top:x.topKph,boost:x.boostKph,radius:x.turnRadiusAt8,hp:x.hp}))));
 }finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
