// v109 좀비 전용 모델만 압축하고 재현 가능한 해시를 남긴다.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{meshopt,resample,prune,dedup}=require('@gltf-transform/functions'),{MeshoptEncoder,MeshoptDecoder}=require('meshoptimizer'),sharp=require('sharp');
(async()=>{await MeshoptEncoder.ready;await MeshoptDecoder.ready;const src=process.argv[2];if(!src)throw Error('블렌더 출력 폴더가 필요합니다');const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});const list=[];
for(let v=0;v<2;v++)for(let lod=0;lod<3;lod++){
 const file=`infected-${v}-lod${lod}.glb`,doc=await io.read(path.join(src,file)),root=doc.getRoot();
 for(const t of root.listTextures())t.setImage(new Uint8Array(await sharp(t.getImage()).resize(1024,1024).webp({quality:88}).toBuffer())).setMimeType('image/webp');
 // v109 먼 모델은 첫 모델의 피부 텍스처를 공유해 중복 전송·해독을 없앤다.
 if(lod){for(const a of root.listAnimations()){for(const c of a.listChannels())c.dispose();for(const sampler of a.listSamplers())sampler.dispose();a.dispose();}for(const t of root.listTextures())t.dispose();}
 await doc.transform(resample({tolerance:1e-5}),dedup(),prune({keepLeaves:true}),meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16,quantizeNormal:12,quantizeTexcoord:14}));
 const data=await io.writeBinary(doc);fs.writeFileSync('assets/zombies/'+file,data);list.push({file,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),animations:root.listAnimations().map(a=>a.getName())});
}
fs.writeFileSync('assets/zombies/manifest.json',JSON.stringify({version:109,license:'CC0-1.0',models:list},null,2)+'\n');console.log(list);
})().catch(e=>{console.error(e);process.exitCode=1});
