// v107 핸들 예산·림 접촉·차종별 공유 템플릿을 실제 렌더러에서 검사한다.
const fs=require('fs'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
(async()=>{const f=await fixture();try{
 const report=await f.page.evaluate(()=>{
  const C=G.VehicleCabin,T=THREE,rows=[];
  for(const kind of['porter','e2200','izh','fallback']){
   const t=C.template(kind),s=C.wheelSpecs[kind],mesh=new T.Mesh(t.wheelGeo,C.material),ray=new T.Raycaster(),gaps=[],radius=s.grip-Math.sqrt((s.tube*(1+s.bulge))**2-s.z*s.z);mesh.updateMatrixWorld(true);
   for(const fraction of[.24,.76]){const angle=Math.PI*fraction,point=new T.Vector3(Math.cos(angle)*s.grip,Math.sin(angle)*s.grip,s.z),normal=new T.Vector3(Math.cos(angle)*(s.grip-radius),Math.sin(angle)*(s.grip-radius),s.z).normalize();ray.set(point.clone().addScaledVector(normal,.05),normal.negate());const hit=ray.intersectObject(mesh,false)[0];gaps.push(hit?Math.abs(hit.distance-.05):Infinity);}
   rows.push({kind,triangles:t.wheelGeo.attributes.position.count/3,groups:t.wheelGeo.groups.length,gripRadius:s.grip,spokes:s.spokes,gaps,shared:C.template(kind)===t,finish:!!t.wheelGeo.attributes.lzFinish});
  }
  return{rows};
 });
 for(const r of report.rows){assert(r.triangles<=2000,r.kind+' 핸들 삼각형 예산');assert.equal(r.groups,0);assert(r.shared&&r.finish);assert(r.gaps.every(x=>x<.003),r.kind+' 손바닥·림 표면 간격');}
 report.errors=f.errors;assert.deepEqual(f.errors,[]);fs.writeFileSync(process.env.REPORT||'/tmp/lz-cabin-model.json',JSON.stringify(report,null,2)+'\n');console.log('PASS 4종 핸들 2천 삼각형·한 메시·림 접촉·템플릿 재사용',JSON.stringify(report));
 }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
