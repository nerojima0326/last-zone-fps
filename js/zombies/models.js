// v109 뼈대 행렬·클립을 공유하고 거리별 감염자를 인스턴스로 그린다.
const T=window.THREE,G=window.G,capacity=72,clock={value:0},up=new T.Vector3(0,1,0),tmp=new T.Matrix4(),rot=new T.Quaternion(),scl=new T.Vector3(),v=new T.Vector3();
const groups=[],assets=[],templates=[],clipNow=new Float64Array(3),clipOld=new Float64Array(3),frustum=new T.Frustum(),cameraMatrix=new T.Matrix4(),sphere=new T.Sphere();
function frameAt(c,time,fps,out){const n=Math.abs(c[1])-1,t=Math.max(0,time-c[2])*c[3]*fps,f=c[1]>0?t%n:Math.min(t,n),i=Math.floor(f);out[0]=c[0]+i;out[1]=c[0]+Math.min(i+1,n);out[2]=f%1;}
// v109 전용 자원 업로드·첫 그리기는 로딩 화면 안에서만 한다.
G.prepareZombieScene=async function(root){const renderer=G.renderer,camera=G.camera;await G.RenderPrep.textures([...new Set(root.children.flatMap(o=>Object.values(o.material||{}).filter(t=>t?.isTexture)))]);await G.prepareWorldShaders(root);const viewport=new T.Vector4(),scissor=new T.Vector4(),target=renderer.getRenderTarget(),test=renderer.getScissorTest();renderer.getViewport(viewport);renderer.getScissor(scissor);try{renderer.setScissorTest(true);renderer.setScissor(0,0,1,1);renderer.render(G.scene,camera);await G.RenderPrep.gpuIdle()}finally{renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test)}};

function skin(material,meta,palette){
 const m=material.clone();m.roughness=.93;m.metalness=0;m.envMapIntensity=.25;
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{zClock:clock,zPalette:{value:palette},zSize:{value:new T.Vector2(meta.bones*4,meta.frames)},zBind:{value:new T.Matrix4().fromArray(meta.bind)},zInverse:{value:new T.Matrix4().fromArray(meta.inverseBind)}});
  shader.vertexShader=`uniform float zClock;uniform sampler2D zPalette;uniform vec2 zSize;uniform mat4 zBind;uniform mat4 zInverse;attribute vec4 skinIndex;attribute vec4 skinWeight;attribute vec4 zClip;attribute vec4 zPrev;attribute vec4 zState;varying vec3 zVisual;
  mat4 zBone(float b,float f){float x=b*4.0;float y=(f+.5)/zSize.y;return mat4(texture2D(zPalette,vec2((x+.5)/zSize.x,y)),texture2D(zPalette,vec2((x+1.5)/zSize.x,y)),texture2D(zPalette,vec2((x+2.5)/zSize.x,y)),texture2D(zPalette,vec2((x+3.5)/zSize.x,y)));}
  mat4 zPose(vec4 c){float n=abs(c.y)-1.0;float t=max(0.0,zClock-c.z)*c.w*20.0;float f=c.y>0.0?mod(t,n):min(t,n);float a=floor(f);float b=min(a+1.0,n);vec4 weights=skinWeight/max(dot(skinWeight,vec4(1.0)),.0001);mat4 one=zBone(skinIndex.x,c.x+a)*weights.x+zBone(skinIndex.y,c.x+a)*weights.y+zBone(skinIndex.z,c.x+a)*weights.z+zBone(skinIndex.w,c.x+a)*weights.w;mat4 two=zBone(skinIndex.x,c.x+b)*weights.x+zBone(skinIndex.y,c.x+b)*weights.y+zBone(skinIndex.z,c.x+b)*weights.z+zBone(skinIndex.w,c.x+b)*weights.w;return one*(1.0-fract(f))+two*fract(f);}
  \n`+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <skinbase_vertex>','mat4 zSkin=zPose(zClip);float blend=clamp((zClock-zState.x)/.18,0.0,1.0);if(blend<1.0)zSkin=zPose(zPrev)*(1.0-blend)+zSkin*blend;mat4 zTransform=zInverse*zSkin*zBind;zVisual=vec3(zState.y,zState.z,0.0);');
  shader.vertexShader=shader.vertexShader.replace('#include <skinnormal_vertex>','objectNormal=mat3(zTransform)*objectNormal;');
  shader.vertexShader=shader.vertexShader.replace('#include <skinning_vertex>','transformed=(zTransform*vec4(transformed,1.0)).xyz;zVisual.z=step(1.05,transformed.y)*(1.0-step(1.58,transformed.y))*(1.0-step(.31,abs(transformed.x)))*step(.35,-objectNormal.z);');
  shader.fragmentShader='varying vec3 zVisual;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\nif(fract(dot(floor(gl_FragCoord.xy),vec2(.754877,.56984)))>zVisual.x)discard;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nif(zVisual.y>5.5)totalEmissiveRadiance+=vec3(.1,.9,.55)*zVisual.z*1.3;');
 };
 m.customProgramCacheKey=()=>`z109-${meta.bones}`;return m;
}
export const Models={
 root:new T.Group(),loaded:false,groups,assets,
 async load(){
  if(this.loaded)return;
  const loader=new T.GLTFLoader().setMeshoptDecoder(T.MeshoptDecoder),base=new URL('../../assets/zombies/',import.meta.url),query=new URL(import.meta.url).search;
  for(let variant=0;variant<2;variant++){
   document.getElementById('loadText').textContent='감염자 동작 준비 · '+(variant+1)+'/2';
   const meta=await fetch(new URL(`palette-${variant}.json${query}`,base)).then(r=>{if(!r.ok)throw Error('좀비 클립 누락');return r.json()});
   const zipped=await fetch(new URL(`palette-${variant}.bin.gz${query}`,base));if(!zipped.ok)throw Error('좀비 뼈대 누락');const bytes=await new Response(zipped.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
   const palette=new T.DataTexture(new Uint16Array(bytes),meta.bones*4,meta.frames,T.RGBAFormat,T.HalfFloatType);palette.minFilter=palette.magFilter=T.NearestFilter;palette.generateMipmaps=false;palette.needsUpdate=true;palette.colorSpace=T.NoColorSpace;
   meta.contacts=new Float32Array(meta.contacts);assets.push({meta,palette});
   for(let lod=0;lod<3;lod++){
    const gltf=await loader.loadAsync(new URL(`infected-${variant}-lod${lod}.glb${query}`,base).href);gltf.scene.updateMatrixWorld(true);let source;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)source=o});if(!source)throw Error('좀비 뼈대가 없습니다');
    if(lod&&assets[variant].map){source.material.map?.dispose();source.material.map=assets[variant].map}else assets[variant].map=source.material.map;
    const geometry=source.geometry,material=skin(source.material,meta,palette),mesh=new T.InstancedMesh(geometry,material,capacity);
    for(const key of ['zClip','zPrev','zState'])geometry.setAttribute(key,new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage));
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;mesh.name=`감염자-${variant}-${lod}`;
    const batch={mesh,variant,lod,meta,matrix:source.matrixWorld.clone(),n:0};groups.push(batch);this.root.add(mesh);templates.push(gltf.scene);G.TextureQuality.scan(mesh,true);await G.RenderPrep.turn();
   }
  }
  this.root.name='감염 구역 · 공유 뼈대';this.loaded=true;
 },
 attach(){G.scene.add(this.root);this.root.visible=true},
 detach(){this.root.removeFromParent();this.root.visible=false;for(const g of groups)g.mesh.count=0},
 animate(a,name,time,rate=1){
  const z=a.z,meta=assets[z.variant].meta,clip=meta.clips[name]||meta.clips.idle;if(z.clip===name)return;
  z.previous=z.current||[clip.offset,clip.count,time,rate];z.current=[clip.offset,clip.loop?clip.count:-clip.count,time,rate];z.clip=name;z.transition=time;
 },
 contacts(a,out){
  const z=a.z,meta=assets[z.variant].meta,scale=1.8/meta.height*z.scale;
  frameAt(z.current,clock.value,meta.fps,clipNow);frameAt(z.previous,clock.value,meta.fps,clipOld);const blend=Math.min(1,Math.max(0,(clock.value-z.transition)/.18)),count=meta.joints.length,data=meta.contacts;rot.setFromAxisAngle(up,a.yaw+Math.PI);
  for(let k=0;k<count;k++){const ci=(clipNow[0]*count+k)*3,cj=(clipNow[1]*count+k)*3,pi=(clipOld[0]*count+k)*3,pj=(clipOld[1]*count+k)*3,ca=clipNow[2],pa=clipOld[2];const cx=data[ci]+(data[cj]-data[ci])*ca,cy=data[ci+1]+(data[cj+1]-data[ci+1])*ca,cz=data[ci+2]+(data[cj+2]-data[ci+2])*ca,px=data[pi]+(data[pj]-data[pi])*pa,py=data[pi+1]+(data[pj+1]-data[pi+1])*pa,pz=data[pi+2]+(data[pj+2]-data[pi+2])*pa;v.set(px+(cx-px)*blend,py+(cy-py)*blend-meta.minY,pz+(cz-pz)*blend).multiplyScalar(scale).applyQuaternion(rot).add(a.pos);(out[k]||(out[k]=new T.Vector3())).copy(v)}return out;
 },
 syncContacts(actors,time){clock.value=time;for(const a of actors)if(a.alive&&a.z?.visible)this.contacts(a,a.z.contacts)},
 update(actors,time){
  clock.value=time;G.camera.updateMatrixWorld();cameraMatrix.multiplyMatrices(G.camera.projectionMatrix,G.camera.matrixWorldInverse);frustum.setFromProjectionMatrix(cameraMatrix);for(const b of groups)b.n=0;
  for(const a of actors){if(!a.zombie||!a.z?.visible)continue;const z=a.z,age=time-a.deathTime;if(!a.alive&&age>7){z.visible=false;continue}
   const d=G.camera.position.distanceTo(a.pos);sphere.center.copy(a.pos);sphere.center.y+=.85*z.scale;sphere.radius=1.65*z.scale;if(d>165||!frustum.intersectsSphere(sphere))continue;const effective=d/Math.max(1,G.lodZoom||1),lod=effective<14?0:effective<38?1:2,b=groups[z.variant*3+lod];if(b.n>=capacity)continue;const n=b.n++,scale=1.8/b.meta.height*z.scale;
   rot.setFromAxisAngle(up,a.yaw+Math.PI);scl.setScalar(scale);v.copy(a.pos);v.y-=b.meta.minY*scale;tmp.compose(v,rot,scl).multiply(b.matrix);b.mesh.setMatrixAt(n,tmp);
   b.mesh.geometry.attributes.zClip.setXYZW(n,...z.current);b.mesh.geometry.attributes.zPrev.setXYZW(n,...z.previous);b.mesh.geometry.attributes.zState.setXYZW(n,z.transition,a.alive?1:Math.min(1,(7-age)/2),z.typeIndex,0);

  }
  for(const b of groups){b.mesh.count=b.n;if(!b.n)continue;b.mesh.instanceMatrix.needsUpdate=true;for(const key of ['zClip','zPrev','zState'])b.mesh.geometry.attributes[key].needsUpdate=true;}
 },
 async ready(){
  // v109 빈 인스턴스도 첫 버퍼 업로드까지 로딩 중에 끝낸다.
  for(const b of groups){b.mesh.count=1;b.mesh.setMatrixAt(0,new T.Matrix4().makeScale(.001,.001,.001));const c=b.meta.clips.idle;for(const key of ['zClip','zPrev'])b.mesh.geometry.attributes[key].setXYZW(0,c.offset,c.count,0,1);b.mesh.geometry.attributes.zState.setXYZW(0,-1,1,0,0);b.mesh.instanceMatrix.needsUpdate=true;}
  await G.RenderPrep.textures(assets.map(a=>a.palette));await G.prepareZombieScene(this.root);for(const b of groups)b.mesh.count=0;
 }
};
