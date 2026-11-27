
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 실제 탄도·차량 생명주기·투척 충돌·효과 풀·렌더 오류를 함께 검사한다.
const assert=require('assert'),fs=require('fs'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.env.REPORT||'/tmp/lz-v84-vehicle-vfx.json';
(async()=>{
 const f=await fixture({viewport:{width:640,height:360}}),p=f.page,report={};
 try{
  await p.waitForFunction(()=>G.ThrowableVFX.fireState!=='loading');
  await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});await p.click('#trainBtn');await p.evaluate(()=>G.startReady);await p.waitForFunction(()=>(!G.preparing&&G.Training.active));
  await p.evaluate(()=>{G.paused=true;G.Input.unlock();G.UI.showPause(false)});
  report.vehicles=await p.evaluate(()=>{
   const V=G.Vehicles,W=G.World,owner=G.Game.player,def=G.WEAPONS.ar7,rows=[];
   const remove=v=>{V.unblock(v);G.scene.remove(v.mesh);const i=V.list.indexOf(v);if(i>=0)V.list.splice(i,1)};
   for(const[k,kind]of['porter','e2200','izh'].entries()){
    const height=W.heightAt;let v;try{W.heightAt=()=>300;v=V.newVehicle(k*15,300,0,0,{kind})}finally{W.heightAt=height}
    const hp=v.hp,center=V.center(v,new THREE.Vector3()),origin=center.clone().add(new THREE.Vector3(0,0,8)),direction=center.clone().sub(origin).normalize();let shots=0;
    while(!v.burnT&&shots<200){G.Ballistics.fire(owner,origin,direction,def,origin,false,{hit:false,head:false});for(let n=0;n<8&&G.Ballistics.list.length;n++)G.Ballistics.update(.01);shots++}
    if(!v.burnT)throw Error('실제 탄도가 차량에 맞지 않음 '+kind);
    const burn=v.burnT;V.explode(v);const before=V.list.length,respawned=V.respawn(v),next=V.list.find(o=>o.home===v.home);if(!respawned||!next)throw Error('차량 재생성 실패');
    const restored=next.hp,maxHp=V.spec(v).hp,expectedShots=Math.ceil(hp/(G.dmgAt(def,8)*.8));remove(next);rows.push({kind,hp,maxHp,expectedShots,shots,burn,respawned,restored,countStable:before===V.list.length+1});
   }
   const height=W.heightAt;let v;try{W.heightAt=()=>300;v=V.newVehicle(70,300,0,0,{kind:'izh'})}finally{W.heightAt=height}
   const center=V.center(v,new THREE.Vector3());let grenades=0;while(!v.burnT&&grenades<20){V.blast(center,8,230,owner);grenades++}const blast={grenades,expected:Math.ceil(v.maxHp/230),burn:v.burnT};remove(v);G.Ballistics.reset();G.FX.reset();return{rows,blast};
  });
  for(const r of report.vehicles.rows){assert.equal(r.hp,r.maxHp);assert(r.shots>=r.expectedShots&&r.shots<=r.expectedShots+1);assert.equal(r.burn,2.4);assert.equal(r.restored,r.maxHp);assert(r.respawned&&r.countStable)}assert.equal(report.vehicles.blast.grenades,report.vehicles.blast.expected);
  report.collision=await p.evaluate(()=>{
   const T=G.Throwables,W=G.World,P=G.ThrowableVFX;T.reset();G.FX.reset();const floor=W.addCollider(-12,299.8,-12,12,300,12,'hard',true);
   G.camera.position.set(5,303,8);G.camera.lookAt(0,300,0);G.camera.updateMatrixWorld(true);
   try{
    T.throw(G.Game.player,'molotov',new THREE.Vector3(0,302,0),new THREE.Vector3(0,-4,0));const o=T.list[0];for(let n=0;n<90&&T.list.length;n++)T.update(1/60);
    const fires=T.fires.length;T.detonate(o);P.update(1/60);const result={removed:!o.mesh.parent,listed:T.list.includes(o),fires,duplicate:T.fires.length===fires,glass:P.shardMesh.count,normal:o.contactNormal.toArray(),radius:T.fires[0]?.r,duration:T.fires[0]?.t};
    return result;
   }finally{T.reset();G.FX.reset();W.removeCollider(floor)}
  });
  assert(report.collision.removed&&!report.collision.listed&&report.collision.duplicate);assert.equal(report.collision.fires,1);assert(report.collision.glass>0&&report.collision.normal[1]>.99);assert.equal(report.collision.radius,3.4);assert(report.collision.duration>8.8);
  report.quality=await p.evaluate(()=>{
   const P=G.ThrowableVFX,T=G.Throwables,r=G.World.range,p=new THREE.Vector3(r.x,r.y+.12,r.line-12),owner=G.Game.player,rows=[];
   G.camera.position.copy(p).add(new THREE.Vector3(4,3.5,8));G.camera.lookAt(p.x,p.y+.7,p.z);G.camera.updateMatrixWorld(true);G.VM.set(null);
   for(const quality of['potato','low','medium','high']){
    G.__apply(quality);T.reset();G.FX.reset();T.detonate({kind:'frag',pos:p.clone(),owner,team:0});T.detonate({kind:'molotov',pos:p.clone().add(new THREE.Vector3(2,0,0)),owner,team:0});
    for(let n=0;n<24;n++){T.update(1/60);G.FX.update(1/60)}G.renderNow();
    const caps=P.caps();rows.push({quality,sprites:P.sprites.length,chunks:P.shardMesh.count,marks:P.groundMesh.count,caps:caps.slice(0,2),pool:P.free.length+P.sprites.length,lights:G.FX.lights.length});
   }return rows;
  });
  for(const r of report.quality){assert(r.sprites>0&&r.sprites<=r.caps[0]);assert(r.chunks>0&&r.chunks<=r.caps[1]);assert(r.marks>0&&r.marks<=48);assert.equal(r.pool,256);assert.equal(r.lights,2)}
  report.stress=await p.evaluate(()=>{
   const P=G.ThrowableVFX,T=G.Throwables,r=G.World.range,p=new THREE.Vector3(r.x,r.y+.12,r.line-12),owner=G.Game.player,rows=[];G.__apply('potato');T.reset();G.FX.reset();G.renderNow();
   const objects=G.scene.children.length,geometries=G.renderer.info.memory.geometries,textures=G.renderer.info.memory.textures;
   for(let wave=0;wave<30;wave++){T.detonate({kind:'frag',pos:p.clone(),owner,team:0});T.detonate({kind:'molotov',pos:p.clone(),owner,team:0});for(let n=0;n<8;n++){T.update(1/60);G.FX.update(1/60)}}
   G.renderNow();const max={sprites:P.sprites.length,chunks:P.shardMesh.count,marks:P.groundMesh.count,objects:G.scene.children.length-objects,geometries:G.renderer.info.memory.geometries-geometries,textures:G.renderer.info.memory.textures-textures};
   T.reset();G.FX.reset();for(let n=0;n<1300;n++)G.FX.update(1/60);const cleared={sprites:P.sprites.length,chunks:P.shardMesh.count,marks:P.groundMesh.count,free:P.free.length};
   for(const fps of[30,60,144]){const random=Math.random;Math.random=G.U.mulberry32(84612);try{T.reset();G.FX.reset();T.detonate({kind:'molotov',pos:p.clone(),owner,team:0});for(let n=0;n<fps*2;n++){T.update(1/fps);G.FX.update(1/fps)}rows.push({fps,sprites:P.sprites.length,flames:P.sprites.filter(s=>s.kind===0).length})}finally{Math.random=random}}
   const held=G.ThrowableVFX;G.ThrowableVFX=null;T.reset();G.FX.reset();T.detonate({kind:'frag',pos:p.clone(),owner,team:0});T.detonate({kind:'molotov',pos:p.clone(),owner,team:0});const fallback=G.FX.add.list.length>0&&T.fires.length===1;G.ThrowableVFX=held;T.reset();G.FX.reset();return{max,cleared,cadence:rows,fallback};
  });
  assert(report.stress.max.sprites<=80&&report.stress.max.chunks<=24&&report.stress.max.marks<=48);assert.equal(report.stress.max.objects,0);assert.equal(report.stress.max.geometries,0);assert.equal(report.stress.max.textures,0);assert.deepEqual(report.stress.cleared,{sprites:0,chunks:0,marks:0,free:256});assert(report.stress.fallback);assert(Math.max(...report.stress.cadence.map(r=>r.flames))-Math.min(...report.stress.cadence.map(r=>r.flames))<=8);
  report.errors=f.errors;assert.deepEqual(f.errors,[]);fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
