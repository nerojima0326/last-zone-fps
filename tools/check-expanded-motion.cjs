// 신규 15정의 실제 장전·탄 수·기존 장갑·작동부·조준 광축을 검사한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./expanded-motion-fixture.cjs');
const report=path.resolve(process.env.REPORT||'/tmp/lz-v99-motion-checks.json');
(async()=>{const f=await fixture({fallback:process.env.MOTION_FALLBACK==='1'}),p=f.page;try{
 const result=await p.evaluate(({fallback,ids})=>{
  const P=G.Player,a=P.a,VM=G.VM,checks=[],failures=[],fail=(ok,reason,details)=>{if(!ok)failures.push({reason,...details});};
  fail(G.RealArms.ready,'기존 M4 장갑 모델 준비',{});fail(!!G.ExpandedMotion.data!==fallback,'원본 곡선 로드/대체 경로',{});
  const state=ads=>({ads,sprint:false,crouch:false,moving:0,phase:0,lookDX:0,lookDY:0,landDip:0,raise:1,reload:null,pumpP:-1,cycleP:-1,empty:false,scope:null,hideVM:false});
  const enabled=G.RealArms.enabled;G.RealArms.enabled=false;
  for(const id of ids||Object.keys(G.WeaponCatalog)){
   gunStudio.select(id);const m=VM.models[id],s=state(0);VM.update(1/60,s);
   fail(G.RealArms.copy.visible&&G.RealArms.copy.parent===m.root,'기존 장갑·소매 표시',{id});
   const source=[];G.M4Viewmodel.model.getObjectByName('Hand_Mesh').traverse(o=>{if(o.isSkinnedMesh)source.push(o.geometry)});const reused=[];G.RealArms.copy.traverse(o=>{if(o.isSkinnedMesh){const original=G.RealArms.throwSkins?.find(s=>s.mesh===o)?.original||o.geometry;reused.push(source.includes(original)&&o.geometry.attributes.position.count===original.attributes.position.count&&o.geometry.attributes.position.array.every((v,i)=>v===original.attributes.position.array[i]));}});fail(reused.length>0&&reused.every(Boolean),'원본 M4 손 메시 재사용·접촉 가중치 보정',{id});
   for(const scope of [null,...Object.keys(m.scopes)]){
    s.scope=scope;for(const ads of [.01,.15,.35,.65,.85,.99,1]){s.ads=ads;P.ads=ads;VM.update(1/60,s);fail(m.root.matrix.elements.every(Number.isFinite),'조준 전환 변환',{id,scope,ads});}
    G.vmScene.updateMatrixWorld(true);const sight=VM.sightOf(m,scope).sight.clone();m.root.localToWorld(sight);const projected=sight.project(G.vmCamera);fail(Math.hypot(projected.x,projected.y)<1e-5,'조준 완료 광축',{id,scope,x:projected.x,y:projected.y});
   }
   for(const fps of [30,60,144])for(const empty of [false,true]){
    gunStudio.select(id,empty);P.ads=0;const inst=a.weapons[a.cur],start=inst.mag+a.ammo[m.def.ammo],startMag=inst.mag;P.startReload();fail(!!P.reload,'실제 장전 시작',{id,fps,empty});
    let frames=0,maxGap=0,maxWrist=0,movement=0,turn=0,charge=0,openCover=0,sampled=0;const last=[m.armL.handQ.clone(),m.armR.handQ.clone()];
    while(P.reload&&frames<fps*20){P.reloadLogic(1/fps);P.updateCamera(1/fps);frames++;
     for(const[j,arm]of [m.armL,m.armR].entries()){maxGap=Math.max(maxGap,arm.contactError);maxWrist=Math.max(maxWrist,arm.wristAngle);fail(arm.handQ.angleTo(last[j])<11/fps+.015,'손목 회전 연속성',{id,fps,empty,frame:frames,side:j,angle:arm.handQ.angleTo(last[j]),length:arm.handQ.length(),lastLength:last[j].length(),progress:P.reload?.t/P.reload?.dur,contact:arm.contactMode});last[j].copy(arm.handQ);}
     if(m.reloadMotion){sampled++;movement=Math.max(movement,m.reloadMotion.handDisplacement||0);turn=Math.max(turn,m.reloadMotion.wristTurn||0);}
     if(m.parts.charge)charge=Math.max(charge,m.parts.charge.position.z-m.rest.charge.z);if(m.parts.cover)openCover=Math.max(openCover,Math.abs(m.parts.cover.rotation.x));
     if(frames%12===0)m.root.traverse(o=>fail(o.matrixWorld.elements.every(Number.isFinite),'장전 변환 유효성',{id,fps,empty,name:o.name}));
    }
    fail(!P.reload&&inst.mag===m.def.mag,'장전 종료·탄창 채움',{id,fps,empty,frames,mag:inst.mag});fail(inst.mag+a.ammo[m.def.ammo]===start,'탄약 보존',{id,fps,empty,start,after:inst.mag+a.ammo[m.def.ammo]});fail(sampled>0,'원본/대체 모션 재생',{id,fps,empty});fail(maxGap<.025,'손 접촉 오차',{id,fps,empty,maxGap});fail(maxWrist<Math.PI/2+.09,'손목 범위',{id,fps,empty,maxWrist});
    if(['mp9','cx9'].includes(id))fail(empty?charge>.060:charge<.00001,'MP5 계열 빈 총 손잡이 고정·해제/전술 장전 유지',{id,fps,empty,charge});
    if(G.ExpandedMotion.profiles[id].mechanism==='catch')fail(charge<.00001,'볼트 멈치 계열의 불필요한 손잡이 조작 제거',{id,fps,empty,charge});
    if(id==='mg60')fail(openCover>1,'기관총 급탄 덮개 열기',{id,fps,empty,openCover});
    checks.push({id,fps,empty,frames,seconds:frames/fps,startMag,mag:inst.mag,maxGap,maxWrist,movement,turn,charge,openCover});
   }
  }
  // 같은 손 메시를 공유해도 먼저 들었던 총이 다음 총의 장전 자세를 바꾸지 않아야 한다.
  const orders=[],skin=()=>{G.vmScene.updateMatrixWorld(true);const inv=VM.models.ar416.gun.matrixWorld.clone().invert(),points=[];G.RealArms.copy.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=137)points.push(...mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv).toArray());});return points;};
  for(const first of ['mp9','p226','sp12','m24']){
   G.RealArms.build();gunStudio.select(first);gunStudio.select('ar416',true);const hip=skin();P.startReload();while(P.reload&&P.reload.t/P.reload.dur<.4){P.reloadLogic(1/60);P.updateCamera(1/60);}orders.push({first,hip,reload:skin()});
  }
  const orderCases=orders.map(r=>({first:r.first,hipError:Math.max(...r.hip.map((v,i)=>Math.abs(v-orders[0].hip[i]))),reloadError:Math.max(...r.reload.map((v,i)=>Math.abs(v-orders[0].reload[i])))})),orderError=Math.max(...orderCases.flatMap(r=>[r.hipError,r.reloadError]));fail(Number.isFinite(orderError)&&orderError<.0002,'무기 선택 순서와 손 자세 독립',{orderError});
  G.RealArms.enabled=enabled;return {fallback,checks,orderError,orderCases,failures};
 },{fallback:process.env.MOTION_FALLBACK==='1',ids:process.env.MOTION_IDS?.split(',')});result.errors=f.errors;fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({cases:result.checks.length,failures:result.failures.slice(0,12),failureCount:result.failures.length,errors:f.errors},null,2));assert.deepEqual(f.errors,[]);assert.equal(result.failures.length,0,'신규 총기 모션 오류 — '+report);console.log('PASS 신규 총기 장전·기존 손·작동부·조준 광축');
 }finally{await f.close()}})().catch(e=>{console.error(e);process.exitCode=1});
