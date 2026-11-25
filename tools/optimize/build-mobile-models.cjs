// 기존 모델의 뼈·재질·UV를 보존한 모바일 전용 지오메트리를 만든다.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Document,NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS,EXTMeshoptCompression}=require('@gltf-transform/extensions');
const {weld,simplify,prune,reorder,quantize}=require('@gltf-transform/functions');
const {MeshoptDecoder,MeshoptEncoder,MeshoptSimplifier}=require('meshoptimizer');
(async()=>{
 await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}),root=path.resolve(__dirname,'../..'),report={models:[]};
 // 게임에서 텍스처를 별도로 붙이므로 파일 안에 텍스처가 없어도 UV를 삭제하면 안 된다.
 for(const job of [{source:'assets/char/swat/swat.glb',target:'assets/char/swat/swat-mobile.glb',ratio:.35,error:.004}]){
  const source=fs.readFileSync(path.join(root,job.source)),doc=await io.readBinary(source),stats=()=>({triangles:doc.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0),skins:doc.getRoot().listSkins().map(s=>s.listJoints().map(n=>n.getName()))});
  const before=stats();await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:job.ratio,error:job.error,lockBorder:false}),prune({keepLeaves:true,keepAttributes:true}),reorder({encoder:MeshoptEncoder}),quantize({quantizePosition:16,quantizeNormal:12,quantizeTexcoord:14,quantizeWeight:12}));
  const after=stats();if(JSON.stringify(before.skins)!==JSON.stringify(after.skins))throw Error('모바일 모델의 뼈대가 달라짐');
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const bytes=await io.writeBinary(doc);fs.writeFileSync(path.join(root,job.target),bytes);report.models.push({...job,before,after,bytes:bytes.length,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});console.log(job.target,before.triangles,'→',after.triangles);
 }
 fs.mkdirSync(path.join(root,'assets/models/mobile'),{recursive:true});
 const fixture=require('./browser-fixture.cjs'),f=await fixture({viewport:{width:320,height:180},route:async p=>p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn)})});let trees;
 try{trees=await f.page.evaluate(()=>G.Veg.variants.map(v=>{const g=v.gB;return {name:v.kind+'_'+v.def.seed,preset:v.def.preset,seed:v.def.seed,position:Array.from(g.attributes.position.array),normal:Array.from(g.attributes.normal.array),uv:Array.from(g.attributes.uv.array),indices:Array.from(g.index.array)}}));if(f.errors.length)throw Error(f.errors.join('\n'))}finally{await f.close()}
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(),material=doc.createMaterial('모바일 나뭇가지');report.trees=[];
 for(const tree of trees){const mesh=doc.createMesh(tree.name),p=doc.createPrimitive().setMaterial(material);for(const [key,semantic,width]of [['position','POSITION',3],['normal','NORMAL',3],['uv','TEXCOORD_0',2]])p.setAttribute(semantic,doc.createAccessor().setBuffer(buffer).setType('VEC'+width).setArray(Float32Array.from(tree[key])));p.setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(Uint32Array.from(tree.indices)));mesh.addPrimitive(p);scene.addChild(doc.createNode(tree.name).setMesh(mesh));report.trees.push({name:tree.name,preset:tree.preset,seed:tree.seed,before:tree.indices.length/3});}
 await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:.4,error:.001,lockBorder:false}),prune({keepAttributes:true}),reorder({encoder:MeshoptEncoder}),quantize({quantizePosition:16,quantizeNormal:12,quantizeTexcoord:14}));
 for(const row of report.trees){row.after=doc.getRoot().listMeshes().find(m=>m.getName()===row.name).listPrimitives()[0].getIndices().getCount()/3;console.log(row.name,row.before,'→',row.after)}
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});const bytes=await io.writeBinary(doc);fs.writeFileSync(path.join(root,'assets/models/mobile/tree-branches.glb'),bytes);report.treeBytes=bytes.length;report.treeSha256=crypto.createHash('sha256').update(bytes).digest('hex');
 fs.writeFileSync(path.join(root,'assets/models/mobile/manifest.json'),JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
