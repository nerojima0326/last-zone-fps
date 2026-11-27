
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// v107 핸들 예산·림 접촉·차종별 공유 템플릿을 실제 렌더러에서 검사한다.
const fs=require('fs'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
(async()=>{const f=await fixture();try{
 const report=await f.page.evaluate(()=>{
  const C=G.VehicleCabin,T=THREE,rows=[],V=G.Vehicles,P=G.Player,S=G.Soldiers,models=V.models,templates=S.templates,methods={height:G.World.heightAt,water:G.World.waterAt};G.World.heightAt=()=>300;G.World.waterAt=()=>-100;
  try{
  for(const kind of['porter','e2200','izh','fallback']){
   const t=C.template(kind),s=C.wheelSpecs[kind],mesh=new T.Mesh(t.wheelGeo,C.material),ray=new T.Raycaster(),gaps=[],radius=s.grip-Math.sqrt((s.tube*(1+s.bulge))**2-s.z*s.z);mesh.updateMatrixWorld(true);
   for(const fraction of[.24,.76]){const angle=Math.PI*fraction,point=new T.Vector3(Math.cos(angle)*s.grip,Math.sin(angle)*s.grip,s.z),normal=new T.Vector3(Math.cos(angle)*(s.grip-radius),Math.sin(angle)*(s.grip-radius),s.z).normalize();ray.set(point.clone().addScaledVector(normal,.05),normal.negate());const hit=ray.intersectObject(mesh,false)[0];gaps.push(hit?Math.abs(hit.distance-.05):Infinity);}
   const hands=[];if(kind==='fallback')V.models={};const v=V.newVehicle(0,300,0,0,{kind:kind==='fallback'?'izh':kind});V.models=models;V.enter(P,v);
   try{for(const template of[...templates,null]){S.templates=template?[template]:templates;const m=new G.CharacterModel({soldier:!!template});try{for(const steer of[-1,0,1]){v.steer=steer;C.pose(m,v,false);const inv=v.mesh.matrixWorld.clone().invert(),errors=[0,1].map(i=>C.contact(m,i,new T.Vector3()).applyMatrix4(inv).distanceTo(C.grip(v,i,new T.Vector3())));hands.push({rig:template?.name||'절차적 대체',steer,errors});}}finally{C.release(m);m.dispose();}}}finally{S.templates=templates;V.exit(P,true);V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);}
   rows.push({kind,triangles:t.wheelGeo.attributes.position.count/3,groups:t.wheelGeo.groups.length,gripRadius:s.grip,spokes:s.spokes,gaps,hands,shared:C.template(kind)===t,finish:!!t.wheelGeo.attributes.lzFinish});
  }
  }finally{G.World.heightAt=methods.height;G.World.waterAt=methods.water;V.models=models;S.templates=templates;}
  return{rows};
 });
 fs.writeFileSync(process.env.REPORT||'/tmp/lz-cabin-model.json',JSON.stringify({...report,errors:f.errors},null,2)+'\n');
 for(const r of report.rows){assert(r.triangles<=2000,r.kind+' 핸들 삼각형 예산');assert.equal(r.groups,0);assert(r.shared&&r.finish);assert(r.gaps.every(x=>x<.003),r.kind+' 손바닥·림 표면 간격');assert(r.hands.every(h=>h.errors.every(x=>x<.025)),r.kind+' 모든 캐릭터·조향의 손 접촉');}
 assert.deepEqual(f.errors,[]);console.log('PASS 4종 핸들 2천 삼각형·한 메시·림 접촉·템플릿 재사용',JSON.stringify(report.rows.map(r=>({kind:r.kind,triangles:r.triangles,rigCases:r.hands.length,maxHandError:Math.max(...r.hands.flatMap(h=>h.errors))}))));
 }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
