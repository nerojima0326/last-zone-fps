// 실제 훈련장의 모든 차종·주차선·차종 표지를 촬영한다.
const fs=require('fs'),path=require('path'),fixture=require('./vehicle-physics-fixture.cjs');
const output=path.resolve(process.env.SHOTS||'/workspace/artifacts/v102-training-vehicles.png');
(async()=>{const f=await fixture(process.env.VEHICLE_BASE||null);try{
 const p=f.page,picture=await p.evaluate(()=>{
  const C=G.World.course,x=C.spurX+14,z=C.z1,y=G.World.heightAt(x,z);G.VM.set(null);G.camera.position.set(x-17,y+11,z+8);G.camera.lookAt(x+1,y+.8,z);G.camera.fov=48;G.camera.updateProjectionMatrix();G.camera.updateMatrixWorld(true);G.World.update(0,G.camera.position,G.camera);G.setRenderResolution('100');G.renderer.toneMappingExposure=.85;G.renderNow();G.Perf.gpuWait();return G.renderer.domElement.toDataURL('image/png').split(',')[1];
 });fs.mkdirSync(path.dirname(output),{recursive:true});const bytes=Buffer.from(picture,'base64');if(bytes.length<10000)throw Error('훈련장 캡처가 비어 있습니다');fs.writeFileSync(output,bytes);
 const rows=await p.evaluate(()=>G.Vehicles.list.map(v=>({kind:v.kind,name:G.Vehicles.nameOf?.(v.kind),pos:v.pos.toArray(),contacts:v.groundContacts,wheels:v.wheels.map(w=>({gap:w.groundGap,contact:w.grounded}))})));
 fs.writeFileSync(output.replace(/\.png$/,'.json'),JSON.stringify({rows,errors:f.errors},null,2)+'\n');if(f.errors.length)throw Error(f.errors.join('\n'));console.log('PASS 훈련장 차량 실제 렌더',output,rows.map(r=>r.kind));
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
