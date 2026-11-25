// 경량화가 뼈의 위치·피부 가중치·모델 크기를 훼손하지 않았는지 원본과 비교한다.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert'),T=require('three');
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');
(async()=>{
 await MeshoptDecoder.ready;const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/models/mobile/manifest.json'))),io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}),result={models:[],trees:manifest.trees};
 const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 for(const item of manifest.models){
  assert.equal(hash(item.source),item.sourceSha256);assert.equal(hash(item.target),item.sha256);const docs=await Promise.all([item.source,item.target].map(file=>io.read(path.join(root,file))));
  const maps=docs.map(doc=>{const joints=doc.getRoot().listSkins().flatMap(s=>s.listJoints());return new Map(joints.map(j=>[j.getName(),j.getWorldMatrix()]));});let matrixError=0,weightError=0;
  for(const [name,a]of maps[0]){const b=maps[1].get(name);assert(b,'뼈 누락 '+name);for(let i=0;i<16;i++)matrixError=Math.max(matrixError,Math.abs(a[i]-b[i]));}
  const bounds=docs.map(doc=>{const box=new T.Box3(),point=new T.Vector3();for(const node of doc.getRoot().listNodes()){const mesh=node.getMesh();if(!mesh)continue;const matrix=new T.Matrix4().fromArray(node.getWorldMatrix());for(const p of mesh.listPrimitives()){const a=p.getAttribute('POSITION');for(let i=0;i<a.getCount();i++)box.expandByPoint(point.fromArray(a.getElement(i,[])).applyMatrix4(matrix));}}return box;});
  for(const mesh of docs[1].getRoot().listMeshes())for(const p of mesh.listPrimitives()){const w=p.getAttribute('WEIGHTS_0');if(!w)continue;for(let i=0;i<w.getCount();i++)weightError=Math.max(weightError,Math.abs(w.getElement(i,[]).reduce((s,n)=>s+n,0)-1));}
  const sizeError=bounds[0].getSize(new T.Vector3()).distanceTo(bounds[1].getSize(new T.Vector3()));assert(matrixError<1e-6);assert(weightError<.005);assert(sizeError<.025,'모델 외곽 크기 오차 '+sizeError);assert(item.after.triangles<item.before.triangles*.7);
  result.models.push({source:item.source,target:item.target,bones:maps[0].size,matrixError,weightError,sizeError,before:item.before.triangles,after:item.after.triangles});
 }
 assert.equal(hash('assets/models/mobile/tree-branches.glb'),manifest.treeSha256);const trees=await io.read(path.join(root,'assets/models/mobile/tree-branches.glb'));for(const t of manifest.trees){assert(t.after<t.before,t.name);const p=trees.getRoot().listMeshes().find(m=>m.getName()===t.name).listPrimitives()[0];for(const key of ['POSITION','NORMAL','TEXCOORD_0'])assert(p.getAttribute(key),'모바일 가지 속성 누락 '+t.name+' '+key);t.attributes=p.listSemantics();}
 const output=process.env.MOBILE_MODEL_REPORT||'/tmp/lz-v97-models.json';fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log('PASS 모바일 모델 뼈대·가중치·크기·경량화',JSON.stringify(result.models));
})().catch(e=>{console.error(e);process.exitCode=1});
