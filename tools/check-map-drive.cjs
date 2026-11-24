// 실제 생성 맵의 수면·집·숲 배치와 고저차 주행을 검사한다.
const assert=require('assert'),fs=require('fs'),fixture=require('./optimize/browser-fixture.cjs');
(async()=>{
 const f=await fixture({viewport:{width:640,height:360},route:async p=>{if(process.env.MAP_FALLBACK==='1')await p.route('**/vendor/ez-tree.es.js',r=>r.abort())}});
 try{
  const p=f.page;await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});await p.click('#trainBtn');await p.waitForFunction(()=>G.Training.active);
  console.log('맵·훈련장 준비');
  const report=await p.evaluate(()=>{
   G.paused=true;G.Input.unlock();G.UI.showPause(false);const W=G.World,T=THREE,U=G.U,V=G.Vehicles,r=U.mulberry32(8702),check=(ok,m)=>{if(!ok)throw Error(m)};
   let roadQueries=0,footQueries=0;
   for(let i=0;i<1200;i++){
    const x=(r()-.5)*1800,z=(r()-.5)*1800,limit=5+r()*35,pad=1+r()*15;
    check(Math.abs(W.roadDist(x,z,limit)-Math.min(limit,W.roadDist(x,z)))<1e-6,'도로 격자 검색이 전체 검색과 다름');roadQueries++;
    const expected=W.footprints.some(f=>x-pad<f.maxX&&x+pad>f.minX&&z-pad<f.maxZ&&z+pad>f.minZ);check(W.overlapsFoot(x-pad,z-pad,x+pad,z+pad)===expected,'건물 격자 검색 누락');footQueries++;
   }
   const housing=W.footprints.filter(f=>f.town&&['house1','house2','apt','shop','cabin','warehouse','barn','shed'].includes(f.kind));
   check(housing.length>120,'마을 건물이 지나치게 줄어듦');check(housing.every(f=>f.foundation<=1.6),'마을 집의 높은 기초');check(W.layoutStats.streetLots>W.layoutStats.randomLots,'도로를 향한 필지가 부족함');
   const rivers=W.rivers.map(R=>{
    let grade=0,error=0;for(let i=0;i<R.pts.length;i++){const p=R.pts[i];error=Math.max(error,Math.abs(p.level-W.waterAt(p.x,p.z)));if(i){const q=R.pts[i-1];check(p.level<=q.level+.001,'강이 거꾸로 흐름');grade=Math.max(grade,(q.level-p.level)/Math.hypot(p.x-q.x,p.z-q.z))}}
    if(R.from!==undefined)check(Math.abs(R.pts[0].level-W.lakes[R.from].level)<.001,'호수 출구 높이 불일치');if(R.to!==undefined)check(Math.abs(R.pts.at(-1).level-W.lakes[R.to].level)<.001,'호수 입구 높이 불일치');
    check(grade<.3,'강 수면에 급격한 수직 계단');check(error<.35,'강 수면과 수영 판정 높이가 다름 '+error);return{name:R.name,maxGrade:grade,maxWaterError:error};
   });
   const mesh=W.inlandWater,geo=mesh.geometry,a=geo.attributes.position,idx=geo.index;let maxWaterError=0,overLand=0;
   for(let i=0;i<idx.count;i+=3){const center=new T.Vector3();for(let j=0;j<3;j++)center.add(new T.Vector3().fromBufferAttribute(a,idx.getX(i+j)));center.multiplyScalar(1/3);maxWaterError=Math.max(maxWaterError,Math.abs(center.y-.008-W.waterAt(center.x,center.z)));if(center.y<W.heightAt(center.x,center.z)-.025)overLand++}
   check(maxWaterError<.025,'수면 메시와 물 높이 판정 불일치 '+maxWaterError);check(!overLand,'수면 삼각형이 육지 안으로 들어감');check(!mesh.material.depthWrite,'투명 수면이 깊이 버퍼를 가림');
   const trees=[...W.vegetationList.pine,...W.vegetationList.oak],grid=new Map();let minimum=Infinity;
   for(const p of trees){check(W.roadDist(p[0],p[2])>=8.5-.001,'나무가 도로를 침범함');check(!W.overlapsFoot(p[0]-5,p[2]-5,p[0]+5,p[2]+5),'나무가 집을 침범함');const x=Math.floor(p[0]/5),z=Math.floor(p[2]/5);for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)for(const q of grid.get(i+','+j)||[])minimum=Math.min(minimum,Math.hypot(p[0]-q[0],p[2]-q[2]));const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p)}check(minimum>=4.2-.001,'나무 최소 간격 불일치');check(trees.length>5000,'숲이 지나치게 비어 있음');
   return{version:LZ_BUILD,roadQueries,footQueries,roadClearanceBytes:W.roadClearance.byteLength,housing:housing.length,streetLots:W.layoutStats.streetLots,randomLots:W.layoutStats.randomLots,rivers,water:{triangles:idx.count/3,maxWaterError,overLand},trees:trees.length,minimumTreeDistance:minimum};
  });console.log('맵 검사',JSON.stringify(report));
  report.driving=await p.evaluate(()=>{
   const W=G.World,V=G.Vehicles,owner=G.Game.player,saved=owner.pos.clone(),methods={heightAt:W.heightAt,waterAt:W.waterAt,queryBoxes:W.queryBoxes},models=V.models,rows=[],check=(ok,m)=>{if(!ok)throw Error(m)},remove=v=>{V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v)};
   W.waterAt=()=>-100;W.queryBoxes=()=>{};
   try{for(const kind of['porter','e2200','izh','fallback'])for(const fps of[30,60,144])for(const profile of['descent','drop']){
    W.heightAt=(x,z)=>profile==='descent'?30-.2*(-z):(-z<15?24:-z<16?24-20*(-z-15):4);V.models=kind==='fallback'?{}:models;
    const v=V.newVehicle(0,W.heightAt(0,0),0,0,{kind:kind==='fallback'?'porter':kind});V.models=models;V.unblock(v);v.driver=owner;v.speed=15;let air=0,gravityError=0,landAt=null,lastY=v.pos.y,minY=v.pos.y,maxY=v.pos.y,maxFall=0,lastVy=0;
    for(let i=0;i<fps*6;i++){const wasAir=v.grounded===false,vy=v.vy;V.step(v,owner,1/fps,0,0,false,false);if(wasAir&&v.grounded===false)gravityError=Math.max(gravityError,Math.abs((v.vy-vy)*fps+9.81));if(v.grounded===false)air++;if(v.landings&&landAt===null)landAt=(i+1)/fps;const actualVy=(v.pos.y-lastY)*fps;if(i>2)maxFall=Math.max(maxFall,(lastVy-actualVy)*fps);lastVy=actualVy;lastY=v.pos.y;minY=Math.min(minY,v.pos.y);maxY=Math.max(maxY,v.pos.y);check(Number.isFinite(v.pos.y+v.pitch+v.roll+v.speed),'차량 물리 NaN')}
    if(profile==='drop'){check(air/fps>.7,kind+' 낙하 체공이 없음');check(v.grounded&&v.pos.y<4.03,kind+' 착지 후 지면 복귀 실패 '+v.pos.y);check(gravityError<.001,'공중 중력이 프레임률에 따라 달라짐');check(minY>=4-.03,'차체가 착지 지면을 뚫음');check(v.landings===1,kind+' 착지가 반복됨 '+v.landings);check(maxY<=24.04,kind+' 내리막에서 위로 튐 '+maxY)}
    rows.push({kind,fps,profile,airborneSeconds:air/fps,gravityError,landAt,minY,maxY,maxDownwardAcceleration:maxFall,speed:v.speed,landings:v.landings||0});v.driver=null;remove(v);
   }
   for(const kind of['porter','e2200','izh','fallback']){const land=rows.filter(a=>a.kind===kind&&a.profile==='drop').map(a=>a.landAt);check(Math.max(...land)-Math.min(...land)<.12,kind+' 프레임률별 착지 시간 차이 '+land)}
   return rows;}finally{Object.assign(W,methods);V.models=models;owner.pos.copy(saved);G.FX.reset()}
  });console.log('주행 24조건 통과');
  report.airborneExit=await p.evaluate(()=>{
   const W=G.World,V=G.Vehicles,P=G.Player,owner=G.Game.player,saved=owner.pos.clone(),methods={heightAt:W.heightAt,waterAt:W.waterAt,queryBoxes:W.queryBoxes};W.heightAt=()=>20;W.waterAt=()=>-100;W.queryBoxes=()=>{};let v;
   try{
    v=V.newVehicle(0,20,0,0,{kind:'izh'});V.enter(P,v);v.pos.y+=6;v.mesh.position.copy(v.pos);v.grounded=false;v.flight=true;v.vy=-1;V.exit(P,true);if(v.box)throw Error('공중 하차 순간에 정차 상자를 만듦');
    const airborneY=v.pos.y,wheel=v.wheels[0];G.VehicleWheels.damage(v,wheel,100,owner,wheel.o.getWorldPosition(new THREE.Vector3()),new THREE.Vector3(-1,0,0));if(v.pos.y!==airborneY||v.grounded)throw Error('공중에서 타이어 파손 시 지면으로 순간이동함');
    for(let i=0;i<180;i++)V.update(1/60);if(!v.box||!v.grounded||Math.abs(v.pos.y-20)>.15||v.landings!==1)throw Error('하차한 차량이 공중에서 멈추거나 착지하지 않음');
    let matches=0;W.queryBoxes=methods.queryBoxes;W.queryBoxes(v.box.minX,v.box.minZ,v.box.maxX,v.box.maxZ,b=>{if(b===v.box)matches++});if(matches!==1)throw Error('착지 후 정차 상자 중복');return{landed:true,landings:v.landings,colliderCount:matches};
   }finally{if(v){V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v)}Object.assign(W,methods);owner.pos.copy(saved);G.FX.reset()}
  });
  report.bridges=await p.evaluate(()=>{
   const W=G.World,V=G.Vehicles,P=G.Player,owner=G.Game.player,saved=owner.pos.clone(),query=W.queryBoxes,rows=[];let car;
   const remove=()=>{if(!car)return;V.unblock(car);G.scene.remove(car.mesh);V.list.splice(V.list.indexOf(car),1);G.VehicleWheels.dispose(car);car=null};
   if(!W.bridges.length)throw Error('검사할 다리가 없음');
   try{for(const bridge of W.bridges){
    // 주변 장애물의 우연한 배치와 분리해 실제 상판·난간을 통과한다.
    W.queryBoxes=function(x0,z0,x1,z1,fn){return query.call(this,x0,z0,x1,z1,b=>{if(b.bridge===bridge)fn(b)})};
    const x=bridge.x+bridge.ux*(bridge.half+6),z=bridge.z+bridge.uz*(bridge.half+6);
    car=V.newVehicle(x,W.heightAt(x,z),z,Math.atan2(bridge.ux,bridge.uz),{kind:'izh'});V.unblock(car);car.driver=owner;car.speed=9;let crossed=false,minClearance=Infinity,maxSpeed=0;
    for(let i=0;i<720;i++){V.step(car,owner,1/60,1,0,false,false);const along=(car.pos.x-bridge.x)*bridge.ux+(car.pos.z-bridge.z)*bridge.uz;if(Math.abs(along)<bridge.half-car.dim.hl-.5){minClearance=Math.min(minClearance,car.pos.y-bridge.y);maxSpeed=Math.max(maxSpeed,car.speed)}if(along<-bridge.half-6){crossed=true;break}}
    if(!crossed||minClearance<-.03||minClearance>.3||!Number.isFinite(minClearance)||maxSpeed<9)throw Error('다리 주행 실패 '+JSON.stringify({bridge,crossed,minClearance,maxSpeed}));
    const below=V.groundAt(bridge.x,bridge.z,bridge.level-1);if(below>=bridge.y-.5)throw Error('다리 아래 차를 상판 위로 올림');rows.push({x:bridge.x,z:bridge.z,crossed,minClearance,maxSpeed,underpass:true});car.driver=null;remove();
   }return rows;}finally{remove();W.queryBoxes=query;owner.pos.copy(saved);G.FX.reset()}
  });console.log('다리 주행',report.bridges.length);
  report.foliage=await p.evaluate(()=>{
   const results=[],W=G.World,cam=G.camera,T=THREE,view=new T.Frustum(),matrix=new T.Matrix4(),center=new T.Vector3();
   for(const tier of['potato','low','medium','high'])for(const yaw of[0,Math.PI/2,Math.PI]){
    G.__apply(tier);cam.position.set(-360,W.heightAt(-360,130)+2,130);cam.lookAt(cam.position.x+Math.sin(yaw)*40,cam.position.y+2,cam.position.z+Math.cos(yaw)*40);cam.updateMatrixWorld(true);cam.updateProjectionMatrix();G.Veg.lastT=2;G.Veg.farDirty=true;G.World.update(1/60,cam.position,cam);view.setFromProjectionMatrix(matrix.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));let checked=0;
    for(const v of G.Veg.variants){if(!v.far)continue;const visible=new Set();for(let i=0;i<v.far.count;i++)visible.add(v.far.instanceMatrix.array[i*16+12]+','+v.far.instanceMatrix.array[i*16+14]);for(let i=0;i<v.items.length;i++){center.set(v.mats[i*16+12],v.mats[i*16+13]+v.h*.5,v.mats[i*16+14]);if(view.containsPoint(center)){if(!visible.has(center.x+','+center.z))throw Error('시야 안 먼 나무가 잘림');checked++}}}
    if(yaw===0)G.renderNow();results.push({tier,yaw,checked,far:G.Veg.variants.reduce((s,v)=>s+(v.far?.count||0),0)});
   }return results;
  });
  assert.deepEqual(f.errors,[]);report.errors=f.errors;fs.writeFileSync(process.env.REPORT||'/tmp/lz-v87-checks.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
