// v107 실제 30정의 표시 메시 법선과 M4 가늠자 분리 전후 속성 보존을 검사한다.
const fs=require('fs'),assert=require('assert'),fixture=require('./expanded-motion-fixture.cjs');
(async()=>{const f=await fixture({base:process.env.BASELINE});try{
 await f.page.evaluate(()=>G.AssetVM.loadAll());
 const result=await f.page.evaluate(async()=>{
  const rows=[],T=THREE;
  for(const id of G.GUN_IDS){gunStudio.select(id);const roots=id==='ar7'?[G.M4Viewmodel.model]:id==='g18'?[G.G17Pilot.model]:G.AssetVM.pack(id)?[G.AssetVM.pack(id).pivot]:[G.VM.models[id].root];let vertices=0,invalid=0,zero=0;
   for(const root of roots)root?.traverseVisible(o=>{const n=o.geometry?.attributes.normal;if(!n)return;for(let i=0;i<n.count;i++){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));vertices++;if(!Number.isFinite(length)||Math.abs(length-1)>.02)invalid++;if(length<.01)zero++;}});rows.push({id,vertices,invalid,zero});
  }
  const gl=await new T.GLTFLoader().setMeshoptDecoder(T.MeshoptDecoder).loadAsync('assets/models/viewmodels/m4.glb'),body=gl.scene.getObjectByName('Main'),main=gl.scene.getObjectByName('Main_j'),source=body.geometry,normal=source.attributes.normal,expected=new Map();
  const key=(g,i)=>['position','normal','uv'].flatMap(k=>{const a=g.attributes[k];return Array.from({length:a.itemSize},(_,j)=>a[['getX','getY','getZ','getW'][j]](i));}).join(',');
  for(let i=0;i<normal.count;i++){const k=key(source,i);expected.set(k,(expected.get(k)||0)+1);}
  const rear=G.M4Viewmodel.splitRearSight(body,main);let mismatch=0,count=0;
  for(const mesh of [body,rear])for(let i=0;i<mesh.geometry.attributes.position.count;i++){count++;const k=key(mesh.geometry,i),n=expected.get(k)||0;if(!n)mismatch++;else expected.set(k,n-1);}
  return{rows,split:{sourceVertices:normal.count,count,mismatch,missing:[...expected.values()].reduce((a,b)=>a+b,0),sourceStride:normal.data?.stride||normal.itemSize},errors:[]};
 });
 result.errors=f.errors;if(process.env.REPORT)fs.writeFileSync(process.env.REPORT,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));assert.deepEqual(f.errors,[]);assert.equal(result.rows.length,30);assert(result.rows.every(r=>r.vertices>0&&r.invalid===0),'총기 법선 손상');assert.equal(result.split.mismatch,0);assert.equal(result.split.missing,0);assert.equal(result.split.count,result.split.sourceVertices);console.log('PASS 30정 표시 메시·압축 법선·UV 원본 보존');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
