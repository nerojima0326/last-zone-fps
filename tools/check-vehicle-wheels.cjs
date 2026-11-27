
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 실제 차량·총탄으로 굴림 거리, 조향, 타이어 파손, 가림과 재생성을 검사한다.
const assert=require('assert'),fs=require('fs'),fixture=require('./optimize/browser-fixture.cjs');
(async()=>{
 const f=await fixture({viewport:{width:800,height:450}}),p=f.page,report={};
 try{
  await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});await p.click('#trainBtn');await p.evaluate(()=>G.startReady);await p.waitForFunction(()=>(!G.preparing&&G.Training.active));
  console.log('훈련장 준비');
  report.tests=await p.evaluate(()=>{
   const V=G.Vehicles,W=G.World,H=G.VehicleWheels,B=G.Ballistics,T=THREE,owner=G.Game.player,rows=[],guns=[],height=W.heightAt,models=V.models,ownerPos=owner.pos.clone();
   const check=(ok,m)=>{if(!ok)throw Error(m)},remove=v=>{V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);H.dispose(v)},make=kind=>{V.models=kind==='fallback'?{}:models;const v=V.newVehicle(0,300,0,0,{kind:kind==='fallback'?'porter':kind});V.models=models;return v};
   const aim=(v,w)=>{const center=w.o.getWorldPosition(new T.Vector3()),q=w.o.getWorldQuaternion(new T.Quaternion()),axis=new T.Vector3(Math.sign(v.dim.wheelPts[v.wheels.indexOf(w)][0]),0,0).applyQuaternion(q);return{o:center.clone().addScaledVector(axis,4),d:axis.negate()}};
   const shot=(def,o,d)=>{B.fire(owner,o,d,def,o,false);for(let n=0;n<20&&B.list.length;n++)B.update(.005);check(!B.list.length,'탄도가 충돌 없이 통과함');};
   check(['porter','e2200','izh'].every(k=>models[k]),'실사 차량 GLB 3종을 모두 불러와야 함');W.heightAt=()=>300;G.paused=true;G.Input.unlock();G.UI.showPause(false);
   try{
    for(const kind of['porter','e2200','izh','fallback']){
     const v=make(kind),axes=[];v.mesh.updateMatrixWorld(true);
     for(const w of v.wheels){const meshes=[];w.model.traverse(o=>{if(o.isMesh)meshes.push(o)});const rubber=meshes.filter(o=>/tire|tier|rubber/i.test(o.material.name));let nx=0,nz=0;for(const o of rubber.length?rubber:meshes){const a=o.geometry.attributes.normal;if(!a)continue;const q=o.getWorldQuaternion(new T.Quaternion()),n=new T.Vector3();for(let i=0;i<a.count;i++){n.fromBufferAttribute(a,i).applyQuaternion(q);if(Math.abs(n.x)<.9||Math.abs(n.y)>.2)continue;const k=Math.abs(n.x)**6,s=Math.sign(n.x);nx+=n.x*s*k;nz+=n.z*s*k}}const angle=Math.atan2(nz,nx)*180/Math.PI;check(Math.abs(angle)<3,kind+' '+w.o.name+' 원본에 꺾인 바퀴 축이 남음 '+angle);axes.push(angle)}
     V.unblock(v);v.pos.z-=1;V.place(v,1);V.wheelAnim(v,1/60);
     const rolling=v.wheels.map(w=>({radius:w.r,angle:w.angle,error:Math.abs(w.angle-1/w.r)}));check(rolling.every(w=>w.error<.002),kind+' 바퀴별 이동 거리 불일치');
     v.pos.z+=1;V.place(v,1);V.wheelAnim(v,1/60);check(v.wheels.every(w=>Math.abs(w.angle)<.002),kind+' 후진 회전 오류');
     v.speed=12;V.wheelAnim(v,1);check(v.wheels.every(w=>Math.abs(w.angle)<.002),kind+' 정지 중 헛회전');
     v.steerAngle=.4;V.wheelAnim(v,1/60);const front=v.wheels.filter(w=>w.front),rear=v.wheels.filter(w=>!w.front);check(front[0].steer>front[1].steer&&front[1].steer>0&&rear.every(w=>w.steer===0),kind+' 애커먼 조향 오류');
     const locked=rear.map(w=>w.angle);v.handbrake=true;v.pos.z-=.3;V.place(v,1);V.wheelAnim(v,1/60);check(rear.every((w,i)=>Math.abs(w.angle-locked[i])<1e-8),kind+' 핸드브레이크 뒷바퀴 잠김 오류');check(front.some(w=>Math.abs(w.angle)>.1),kind+' 앞바퀴 굴림 누락');
     v.handbrake=false;v.steerAngle=0;v.speed=0;V.block(v);const startHP=v.hp,pops=[];
     for(const w of v.wheels){
      let shots=0;while(!w.flat&&shots<8){const a=aim(v,w);const hit=V.rayHit(a.o,a.d,10);check(hit?.wheel===w,kind+' '+w.o.name+' 바퀴 판정 누락');shot(G.WEAPONS.ar7,a.o,a.d);shots++}
      check(w.flat&&w.hp===0&&w.radius<w.r*.8,kind+' 타이어 파손 누락');check(v.hp===startHP,kind+' 타이어 피격이 차체 내구도를 소모함');pops.push({name:w.o.name,shots,radius:w.radius,normal:w.r});
     }
     const geos=v.ownedGeometries.length;for(let n=0;n<4;n++){const a=aim(v,v.wheels[0]);shot(G.WEAPONS.ar7,a.o,a.d)}check(v.wheelDamage===4&&v.ownedGeometries.length===geos,kind+' 중복 파손');
     rows.push({kind,axes,rolling,steer:front.map(w=>w.steer),pops,bodyHP:v.hp,geometries:geos});remove(v);
    }
    for(const kind of['porter','e2200','izh','fallback'])for(const def of G.GUN_IDS.map(id=>G.WEAPONS[id])){
     const v=make(kind),w=v.wheels[0];let shots=0;while(!w.flat&&shots<16){const a=aim(v,w);shot(def,a.o,a.d);shots++}check(w.flat&&v.hp===v.maxHp,kind+' '+def.key+' 총기 타이어 피해 오류: 차체 '+v.hp+' 타이어 '+w.hp+' 발수 '+shots);guns.push({kind,gun:def.key,shots});remove(v);
    }
    const v=make('izh'),w=v.wheels[0],a=aim(v,w),mid=a.o.clone().addScaledVector(a.d,2),wall=W.addCollider(mid.x-.12,299.5,mid.z-.8,mid.x+.12,302,mid.z+.8,'hard',true);
    try{shot(G.WEAPONS.ar7,a.o,a.d);check(w.hp===36&&v.hp===v.maxHp,'벽 뒤 차량이 피해를 받음')}finally{W.removeCollider(wall)}
    const center=w.o.getWorldPosition(new T.Vector3()),roof=center.clone().add(new T.Vector3(0,4,0)),down=new T.Vector3(0,-1,0),cover=V.rayHit(roof,down,10);check(cover&&!cover.wheel,'차체를 통과해 타이어를 맞힘');shot(G.WEAPONS.ar7,roof,down);check(w.hp===36&&v.hp<v.maxHp,'지붕 피격 피해 분리 오류');
    let tilted=0;W.heightAt=(x,z)=>300+.10*x+.08*z;v.yaw=.7;V.place(v,1);v.steerAngle=.3;V.wheelAnim(v,1/60);for(const wheel of v.wheels){const a=aim(v,wheel),h=V.rayHit(a.o,a.d,10);check(h?.wheel===wheel,'경사·조향 상태의 바퀴 판정 오류');tilted++}W.heightAt=()=>300;remove(v);
    const handling=[];
    for(const flats of[0,1,2,4]){
     const v=make('izh');for(let i=0;i<flats;i++){const w=v.wheels[i],a=aim(v,w);H.damage(v,w,100,owner,a.o.clone().addScaledVector(a.d,4),a.d)}V.unblock(v);v.driver=owner;
     for(let i=0;i<600;i++)V.step(v,owner,1/60,1,0,false,false);handling.push({flats,speed:v.speed,gripDamage:v.wheelDamage});v.driver=null;owner.pos.copy(ownerPos);remove(v);
    }check(handling[0].speed>handling[1].speed&&handling[1].speed>handling[2].speed&&handling[2].speed>handling[3].speed,'파손 개수에 따른 속도 저하 오류');
    const driven=make('izh');V.enter(G.Player,driven);driven.speed=8;G.Input.keys.KeyW=true;V.drive(G.Player,1/60);let a3=aim(driven,driven.wheels[0]);shot(G.WEAPONS.ar7,a3.o,a3.d);shot(G.WEAPONS.ar7,a3.o,a3.d);V.drive(G.Player,1/60);const driverHUD=G.Player.prompt.includes('타이어 파손 1/4');check(driven.wheels[0].flat&&driverHUD&&G.Player.vehicle===driven,'탑승 중 타이어 파손·안내 누락');G.Input.reset();V.exit(G.Player,true);owner.pos.copy(ownerPos);remove(driven);
    const respawn=make('porter');const a2=aim(respawn,respawn.wheels[0]);H.damage(respawn,respawn.wheels[0],100,owner,a2.o,a2.d);V.explode(respawn);check(V.respawn(respawn),'차량 재생성 실패');const fresh=V.list.find(n=>n.home===respawn.home);check(fresh.hp===fresh.maxHp&&fresh.wheels.every(w=>!w.flat&&w.hp===36&&w.radius===w.r),'재생성 후 타이어 복구 실패');remove(fresh);G.FX.reset();
    return{rows,guns,wall:true,roof:true,tilted,handling,driverHUD,respawn:true};
   }finally{W.heightAt=height;V.models=models;owner.pos.copy(ownerPos);B.reset()}
  });
  assert.equal(report.tests.guns.length,120);assert.equal(report.tests.rows.length,4);
  console.log('차종 4종·총기 30종 실제 탄도 통과');
  report.resources=await p.evaluate(()=>{
   const V=G.Vehicles,H=G.VehicleWheels,W=G.World,height=W.heightAt,models=V.models,rows=[],remove=v=>{V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);H.dispose(v)};
   W.heightAt=()=>300;G.camera.position.set(-5,304,-10);G.camera.lookAt(0,300.8,0);G.camera.updateMatrixWorld(true);G.VM.set(null);
   const wave=()=>['porter','e2200','izh','fallback'].map((kind,i)=>{V.models=kind==='fallback'?{}:models;const v=V.newVehicle((i-1.5)*4,300,0,0,{kind:kind==='fallback'?'porter':kind});V.models=models;for(const w of v.wheels.slice(0,2)){w.o.getWorldPosition(new THREE.Vector3());H.damage(v,w,100,G.Game.player,w.o.getWorldPosition(new THREE.Vector3()),new THREE.Vector3(-1,0,0))}return v});
   try{
    const warm=wave();G.renderNow();for(const v of warm)remove(v);G.FX.reset();G.renderNow();const base={objects:G.scene.children.length,...G.renderer.info.memory};
    for(let i=0;i<4;i++){const cars=wave();G.renderNow();for(const v of cars)remove(v);G.FX.reset();G.renderNow();rows.push({objects:G.scene.children.length-base.objects,geometries:G.renderer.info.memory.geometries-base.geometries,textures:G.renderer.info.memory.textures-base.textures})}return{base,rows};
   }finally{W.heightAt=height;V.models=models}
  });for(const r of report.resources.rows)assert.deepEqual(r,{objects:0,geometries:0,textures:0});assert.deepEqual(f.errors,[]);
  fs.writeFileSync(process.env.REPORT||'/tmp/lz-v86-wheels.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
