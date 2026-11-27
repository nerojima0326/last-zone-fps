// v108 4차종 부품 장착·밀착을 검사하고 실제 형상을 떼어 실패 검출도 확인한다.
require('./artifact-paths.cjs');
const fs=require('fs'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
(async()=>{const f=await fixture();try{
 await f.page.evaluate(require('./cabin-mount-checks.cjs'));
 const rows=await f.page.evaluate(()=>{const V=G.Vehicles,C=G.VehicleCabin,P=G.Player,W=G.World,models=V.models,rows=[];W.heightAt=()=>300;W.waterAt=()=>-100;
  for(const kind of['porter','e2200','izh','fallback']){if(kind==='fallback')V.models={};const v=V.newVehicle(0,300,0,0,{kind:kind==='fallback'?'izh':kind});V.models=models;V.enter(P,v);P.vehicleView='first';G.Game.syncModels(1/60);C.camera(P,1);const t=v.cabin.template,base=measureCabinMounts(v),mutations=[];
   for(const name of['climate','hazard-symbol']){const m=t.mounts.find(x=>x.name===name);if(!m)continue;const pos=t.staticGeo.attributes.position,start=m.range[0]*9,end=m.range[1]*9,saved=pos.array.slice(start,end);try{for(let i=start+2;i<end;i+=3)pos.array[i]+=.12;pos.needsUpdate=true;t.staticGeo.computeBoundingSphere();const row=measureCabinMounts(v).find(x=>x.name===name);mutations.push({name,detected:row.samples.some(s=>!s.supported)});}finally{pos.array.set(saved,start);pos.needsUpdate=true;t.staticGeo.computeBoundingSphere();}}
   rows.push({kind,base,mutations});V.exit(P,true);V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);
  }return rows;
 });fs.writeFileSync(process.env.REPORT||'/tmp/lz-cabin-mounts.json',JSON.stringify({rows,errors:f.errors},null,2)+'\n');
 for(const r of rows){assert.deepEqual(r.base.map(x=>x.name).sort(),['climate','glovebox','hazard','hazard-symbol','radio']);for(const m of r.base)assert(m.samples.every(s=>s.supported),r.kind+' '+m.name+' 장착 틈: '+JSON.stringify(m.samples.filter(s=>!s.supported)));assert.equal(r.mutations.length,2);assert(r.mutations.every(m=>m.detected),r.kind+' 부품 이탈 검출');}
 assert.deepEqual(f.errors,[]);console.log('PASS 4종·5부품·180개 장착 표면·12cm 이동 이탈 8건 검출');
 }finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
