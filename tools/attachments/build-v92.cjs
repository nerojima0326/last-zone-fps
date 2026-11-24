// 같은 형상 모듈로 파일과 누락 시 대체 모델을 만든다. 외부 원본 메시를 사용하지 않는다.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url'),T=require('three');
const {Document,NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS,EXTMeshoptCompression}=require('@gltf-transform/extensions');
const {dedup,weld,prune,quantize,reorder}=require('@gltf-transform/functions'),{MeshoptEncoder}=require('meshoptimizer');
(async()=>{
 const {mergeGeometries}=await import(pathToFileURL(require.resolve('three').replace(/build\/three\.cjs$/,'examples/jsm/utils/BufferGeometryUtils.js')).href),library=require('../../js/attachment-models.js')(T,mergeGeometries),out=path.resolve(__dirname,'../../assets/models/attachments/v92');
 await MeshoptEncoder.ready;fs.mkdirSync(out,{recursive:true});const files=[],io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
 for(const id of library.ids){
  const model=library.build(id),doc=new Document(),buffer=doc.createBuffer(),root=doc.createNode(id).setExtras(model.userData);doc.createScene().addChild(root);
  model.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,m=o.material,material=doc.createMaterial(m.name).setBaseColorFactor([...m.color.toArray(),m.opacity]).setMetallicFactor(m.metalness).setRoughnessFactor(m.roughness).setDoubleSided(m.side===T.DoubleSide);if(m.transparent)material.setAlphaMode('BLEND');const p=doc.createPrimitive().setMaterial(material);
   for(const [name,semantic]of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0']]){const a=g.attributes[name];if(a)p.setAttribute(semantic,doc.createAccessor().setBuffer(buffer).setType(a.itemSize===2?'VEC2':'VEC3').setArray(new Float32Array(a.array)))}
   root.addChild(doc.createNode(o.name).setMesh(doc.createMesh(o.name).addPrimitive(p)));
  });
  await doc.transform(dedup(),weld(),prune(),reorder({encoder:MeshoptEncoder}),quantize({quantizePosition:16,quantizeNormal:12}));doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const bytes=await io.writeBinary(doc),bounds=new T.Box3().setFromObject(model),triangles=doc.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0);
  fs.writeFileSync(path.join(out,id+'.glb'),bytes);files.push({id,file:id+'.glb',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),triangles,meshes:model.children.length,min:bounds.min.toArray(),max:bounds.max.toArray(),...model.userData});
  console.log(id,bytes.length,triangles);
 }
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:92,coordinates:{unit:'m',forward:'-Z',railSeat:'Y=0',muzzleSeat:'Z=0'},files},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
