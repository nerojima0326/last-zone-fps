// v107 실제 훈련장의 AR-7 표면과 원인별 대조 화면. 큰 이미지는 외부 폴더에만 저장한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./expanded-motion-fixture.cjs');
const out=path.resolve(process.env.SHOTS||'/tmp/lz-weapon-surface');
(async()=>{const f=await fixture({base:process.env.BASELINE,viewport:{width:1280,height:720}});try{
 fs.mkdirSync(out,{recursive:true});await f.page.evaluate(()=>{gunStudio.select('ar7',false);G.__apply('medium');G.setRenderResolution('100');G.Player.ads=0;for(let i=0;i<120;i++)G.Player.updateCamera(1/60);G.World.update(0,G.camera.position,G.camera);});
 const rows=[];
 for(const size of [{width:1280,height:720},{width:1920,height:1080}]){
  await f.page.setViewportSize(size);
  for(const variant of process.env.PROBE==='1'&&size.width===1280?['original','noNormal','noMetal','filter','tangent']:['original']){
   const row=await f.page.evaluate(async variant=>{
    const M=G.M4Viewmodel,T=THREE,m=M.body.material,saved={normalMap:m.normalMap,metalness:m.metalness,envMapIntensity:m.envMapIntensity},geometries=[];
    if(variant==='noNormal')m.normalMap=null;
    if(variant==='noMetal'){m.metalness=0;m.envMapIntensity=0;}
    if(variant==='filter'&&m.normalMap){G.TextureQuality.texture(m.normalMap);m.normalMap.anisotropy=G.renderer.capabilities.getMaxAnisotropy();m.normalMap.needsUpdate=true;}
    if(variant==='tangent'){
     const {computeMikkTSpaceTangents}=await import('three/addons/utils/BufferGeometryUtils.js'),MikkTSpace=await import('three/addons/libs/mikktspace.module.js');await MikkTSpace.ready;
     for(const mesh of [M.body,M.rearSight]){geometries.push([mesh,mesh.geometry]);mesh.geometry=computeMikkTSpaceTangents(mesh.geometry.clone(),MikkTSpace);}
    }
    m.needsUpdate=true;G.UI.update(1/60);G.renderNow();G.Perf.gpuWait();const n=M.body.geometry.attributes.normal;let nonUnit=0;
    for(let i=0;i<n.count;i++)if(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)>.02)nonUnit++;
    const result={variant,active:M.active,material:m.name,metalness:m.metalness,roughness:m.roughness,aniso:m.normalMap?.anisotropy,mipmap:m.normalMap?.generateMipmaps,minFilter:m.normalMap?.minFilter,normalVertices:n.count,nonUnit,image:G.renderer.domElement.toDataURL('image/png').split(',')[1]};
    Object.assign(m,saved);m.needsUpdate=true;for(const [mesh,g]of geometries){mesh.geometry.dispose();mesh.geometry=g;}return result;
   },variant);
   assert(row.active,'실제 M4 표시');fs.writeFileSync(path.join(out,`ar7-${size.width}-${variant}.png`),Buffer.from(row.image,'base64'));delete row.image;rows.push({size,...row});
  }
 }
 fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({rows,errors:f.errors},null,2)+'\n');assert.deepEqual(f.errors,[]);console.log('PASS 훈련장 AR-7 두 해상도 촬영',JSON.stringify(rows));
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
