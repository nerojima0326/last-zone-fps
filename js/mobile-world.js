// 모바일에서는 LOD·시야 밖 맵 조각을 인덱스에서 빼고 같은 재질의 한 호출로 제출한다.
(function(){
'use strict';
const G=window.G,T=window.THREE,frustum=new T.Frustum(),matrix=new T.Matrix4(),point=new T.Vector3();
const M=G.MobileWorld={
 enabled:document.documentElement.classList.contains('mobile'),culling:true,batches:[],records:new WeakMap(),dirty:true,last:new T.Vector3(Infinity,0,0),rotation:new T.Quaternion(),projection:'',wasRT:false,
 stats:{sourceTriangles:0,submittedTriangles:0,visibleBatches:0,uploads:0},
 terrainSparse:{value:1},
 prepareTerrain(world){
  if(!this.enabled||!world.terrainW)return;
  const image=world.terrainW.image,size=image.width,data=image.data,step=8,n=Math.ceil(size/step),blocks=new Uint8Array(n*n);
  // 경계의 선형·밉 필터까지 포함한 보수적인 재질 목록이다. 먼 LOD는 원래 다섯 레이어를 유지한다.
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;blocks[Math.floor(y/step)*n+Math.floor(x/step)]|=(data[i]>0?1:0)|(data[i+1]>0?2:0)|(data[i+2]>0?4:0)|(data[i+3]>63?8:0)|(data[i+3]<192?16:0)}
  this.terrainStats={vertices:0,reduced:0};
  for(const chunk of world.terrainChunks)for(let level=0;level<chunk.lods.length;level++){
   const g=chunk.lods[level],uv=g.attributes.uv,index=g.index,flags=new Uint8Array(uv.count);
   if(level>=3)flags.fill(31);else for(let i=0;i<index.count;i+=3){
    const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),pad=32;
    const x0=Math.max(0,Math.floor((Math.min(uv.getX(a),uv.getX(b),uv.getX(c))*size-pad)/step)),x1=Math.min(n-1,Math.floor((Math.max(uv.getX(a),uv.getX(b),uv.getX(c))*size+pad)/step));
    const y0=Math.max(0,Math.floor((Math.min(uv.getY(a),uv.getY(b),uv.getY(c))*size-pad)/step)),y1=Math.min(n-1,Math.floor((Math.max(uv.getY(a),uv.getY(b),uv.getY(c))*size+pad)/step));
    let mask=0;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)mask|=blocks[y*n+x];flags[a]|=mask;flags[b]|=mask;flags[c]|=mask;
   }
   g.setAttribute('terrainLayers',new T.BufferAttribute(flags,1));this.terrainStats.vertices+=flags.length;for(const mask of flags)if(mask!==31)this.terrainStats.reduced++;
  }
 },
 terrainShader(sh){
  if(!this.enabled)return;
  sh.uniforms.uTerrainSparse=this.terrainSparse;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float terrainLayers;\nflat varying float vTerrainLayers;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainLayers=terrainLayers;');
  sh.fragmentShader=sh.fragmentShader.replace('float tLum(vec3 c)','uniform float uTerrainSparse;\nflat varying float vTerrainLayers;\nfloat tLum(vec3 c)');
  const uv='vec2 uvG = tuv * 1.6, uvD = tuv * 1.25, uvS = tuv * 1.1, uvR = tuv * 0.45, uvA = tuv * 0.9;';
  sh.fragmentShader=sh.fragmentShader.replace(uv,uv+`
    // 삼각형 안에서 일정한 목록으로 분기해 원래 밉·비등방성 미분을 유지한다.
    bool sparse=uTerrainSparse>.5;int layers=uTerrainSparse>1.5?0:int(vTerrainLayers+.5);bool lower=(layers&16)!=0;
    // 비스듬한 시야의 큰 밉이 사전 여유 범위를 넘으면 실제 가중치로 원래 샘플을 복구한다.
    vec2 mipDx=dFdx(tuv),mipDy=dFdy(tuv);bool coverLower=tw.a<.75;
  `);
  const colors={
   G:{needed:'coverLower',grad:'mix(textureGrad(tGrassD,uvG,mipDx*1.6,mipDy*1.6).rgb,textureGrad(tGrassD,tuv*.37+.31,mipDx*.37,mipDy*.37).rgb,.45)',condition:'lower',sample:'mix(texture2D(tGrassD,uvG).rgb,texture2D(tGrassD,tuv*.37+.31).rgb,.45)'},
   D:{needed:'coverLower&&tw.r>0.0',grad:'textureGrad(tDirtD,uvD,mipDx*1.25,mipDy*1.25).rgb',condition:'lower&&(layers&1)!=0',sample:'texture2D(tDirtD,uvD).rgb'},
   S:{needed:'coverLower&&tw.g>0.0',grad:'textureGrad(tSandD,uvS,mipDx*1.1,mipDy*1.1).rgb',condition:'lower&&(layers&2)!=0',sample:'texture2D(tSandD,uvS).rgb'},
   R:{needed:'coverLower&&tw.b>0.0',grad:'textureGrad(tRockD,uvR,mipDx*.45,mipDy*.45).rgb',condition:'lower&&(layers&4)!=0',sample:'texture2D(tRockD,uvR).rgb'},
   A:{needed:'tw.a>.25',grad:'textureGrad(tAsphD,uvA,mipDx*.9,mipDy*.9).rgb',condition:'(layers&8)!=0',sample:'texture2D(tAsphD,uvA).rgb'}
  };
  for(const [key,v]of Object.entries(colors))sh.fragmentShader=sh.fragmentShader.replace(new RegExp('vec3 c'+key+' = [^;]+;'),'vec3 c'+key+'=vec3(1.0);if(!sparse||('+v.condition+'))c'+key+'='+v.sample+'/max(uMean'+key+',vec3(.01));else if('+v.needed+')c'+key+'='+v.grad+'/max(uMean'+key+',vec3(.01));');
  sh.fragmentShader=sh.fragmentShader.replace(/vec3 nG = tNrm\(normalMap, uvG\),[^;]+;/,`
    vec3 nG=vec3(0,0,1),nD=nG,nS=nG,nR=nG,nA=nG;
    if(!sparse||lower)nG=tNrm(normalMap,uvG);else if(coverLower)nG=textureGrad(normalMap,uvG,mipDx*1.6,mipDy*1.6).xyz*2.0-1.0;
    if(!sparse||(lower&&(layers&1)!=0))nD=tNrm(tDirtN,uvD);else if(coverLower&&tw.r>0.0)nD=textureGrad(tDirtN,uvD,mipDx*1.25,mipDy*1.25).xyz*2.0-1.0;
    if(!sparse||(lower&&(layers&2)!=0))nS=tNrm(tSandN,uvS);else if(coverLower&&tw.g>0.0)nS=textureGrad(tSandN,uvS,mipDx*1.1,mipDy*1.1).xyz*2.0-1.0;
    if(!sparse||(lower&&(layers&4)!=0))nR=tNrm(tRockN,uvR);else if(coverLower&&tw.b>0.0)nR=textureGrad(tRockN,uvR,mipDx*.45,mipDy*.45).xyz*2.0-1.0;
    if(!sparse||(layers&8)!=0)nA=tNrm(tAsphN,uvA);else if(tw.a>.25)nA=textureGrad(tAsphN,uvA,mipDx*.9,mipDy*.9).xyz*2.0-1.0;
  `);
 },
 add(mesh){
  if(!this.enabled)return;
  const g=mesh.geometry,p=g.attributes.position,lod=g.attributes.lodk,index=g.index,groups=new Map(),n=index?index.count:p.count;
  // 정점·AO·재질·충돌 데이터는 보존한다. 삼각형을 125m 공간과 표시 종류로 분류한다.
  for(let i=0;i<n;i+=3){
   const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2,kind=Math.round(lod?.getZ(a)||0),cx=kind?Math.round(lod.getX(a)):Math.floor((p.getX(a)+p.getX(b)+p.getX(c))/375),cz=kind?Math.round(lod.getY(a)):Math.floor((p.getZ(a)+p.getZ(b)+p.getZ(c))/375),key=cx+','+cz+','+kind;
   let group=groups.get(key);if(!group){group={kind,cx,cz,indices:[],box:new T.Box3(),visible:true};groups.set(key,group)}
   group.indices.push(a,b,c);for(const v of [a,b,c])group.box.expandByPoint(point.fromBufferAttribute(p,v));
  }
  for(const group of groups.values()){group.indices=Uint32Array.from(group.indices);group.box.expandByScalar(10)}
  const array=new Uint32Array(n),attribute=new T.BufferAttribute(array,1).setUsage(T.DynamicDrawUsage),batch={mesh,groups:[...groups.values()],array,attribute,distanceVisible:true,full:false};
  for(let i=0;i<n;i++)array[i]=index?index.getX(i):i;
  g.setIndex(attribute);this.records.set(mesh,batch);this.batches.push(batch);this.stats.sourceTriangles+=n/3;this.dirty=true;
 },
 invalidate(){this.dirty=true},
 restore(){
  for(const b of this.batches){let at=0;for(const g of b.groups){b.array.set(g.indices,at);at+=g.indices.length;g.visible=true}b.mesh.geometry.setDrawRange(0,at);b.attribute.clearUpdateRanges();b.attribute.addUpdateRange(0,at);b.attribute.needsUpdate=true;b.mesh.visible=b.distanceVisible;b.full=true;}
  this.dirty=true;
 },
 visible(kind,state){return kind===0||kind===1&&state<=1||kind===2&&state===0||kind===3&&state<=2||kind===4&&state>=2},
 update(camera,world){
  if(!this.enabled||!camera||!this.batches.length)return;
  const rt=!!G.RT?.active()||!this.culling,projection=camera.projectionMatrix.elements.join(','),turned=Math.abs(this.rotation.dot(camera.quaternion))<.9999875;
  if(!this.dirty&&rt===this.wasRT&&camera.position.distanceToSquared(this.last)<1&&!turned&&projection===this.projection)return;
  this.dirty=false;this.wasRT=rt;this.last.copy(camera.position);this.rotation.copy(camera.quaternion);this.projection=projection;
  camera.updateMatrixWorld(true);frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const shadow=world.sun?.castShadow;if(shadow){world.sun.updateMatrixWorld(true);world.sun.shadow.updateMatrices(world.sun)}const shadowVolume=shadow?world.sun.shadow.getFrustum():null;
  let triangles=0,visibleBatches=0;
  for(const b of this.batches){let changed=false,count=0;
   for(const group of b.groups){
    // 실제 빛의 절두체에 든 시야 밖 그림자도 유지한다. RT는 전체 인덱스로 복귀한다.
    const state=world.lodData[group.cz*world.lodTex.image.width+group.cx]??3;
    const visible=b.distanceVisible&&(rt||this.visible(group.kind,state)&&(G.noCull||frustum.intersectsBox(group.box))||shadow&&b.mesh.castShadow&&shadowVolume.intersectsBox(group.box));
    if(visible!==group.visible){group.visible=visible;changed=true}if(visible)count+=group.indices.length;
   }
   if(b.full!==rt){changed=true;b.full=rt}
   if(changed||b.mesh.geometry.drawRange.count!==count){let at=0;for(const group of b.groups)if(group.visible){b.array.set(group.indices,at);at+=group.indices.length}b.mesh.geometry.setDrawRange(0,count);if(count){b.attribute.clearUpdateRanges();b.attribute.addUpdateRange(0,count);b.attribute.needsUpdate=true;this.stats.uploads++}}
   b.mesh.visible=count>0;if(count){triangles+=count/3;visibleBatches++}
  }
  this.stats.submittedTriangles=triangles;this.stats.visibleBatches=visibleBatches;
 }
};
})();
