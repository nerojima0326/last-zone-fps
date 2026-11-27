
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 같은 카메라·중립 재질·자세에서 원본과 모바일 군인의 외곽·관절을 촬영한다.
const fs=require('fs'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
(async()=>{
 const out=process.env.MOBILE_SHOTS||'/tmp/lz-v97-model-shots';fs.mkdirSync(out,{recursive:true});
 const f=await fixture({viewport:{width:960,height:600},route:async p=>p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn)})});
 try{
  await f.page.evaluate(async()=>{
   const T=THREE,loader=new T.GLTFLoader();loader.setMeshoptDecoder(T.MeshoptDecoder);const map=G.Soldiers.templates[0].mat.map,nor=G.Soldiers.templates[0].mat.normalMap;
   window.modelCapture={templates:{},scene:new T.Scene(),camera:new T.PerspectiveCamera(40,960/600,.05,40)};const C=modelCapture;C.scene.background=new T.Color(0x2b3540);C.scene.overrideMaterial=new T.MeshStandardMaterial({color:0xa7b1b5,roughness:.8,metalness:0});
   C.scene.add(new T.HemisphereLight(0xd9e8ff,0x7b7762,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,3,-2);C.scene.add(light);
   C.base=new T.Vector3(G.World.range.x,G.World.heightAt(G.World.range.x,G.World.range.z),G.World.range.z);
   if(!C.base.toArray().every(Number.isFinite))C.base.set(-735,4,660);
   C.camera.position.copy(C.base).add(new T.Vector3(2.1,1.1,-3.6));C.camera.lookAt(C.base.clone().add(new T.Vector3(0,1.0,0)));C.camera.updateMatrixWorld(true);
   for(const [key,file]of [['original','swat.glb'],['mobile','swat-mobile.glb']]){const gltf=await loader.loadAsync('/assets/char/swat/'+file);C.templates[key]=G.Soldiers.makeTemplateGLB(key,gltf.scene,map,nor);}
   G.renderer.toneMapping=T.ACESFilmicToneMapping;G.renderer.toneMappingExposure=1;G.renderer.setPixelRatio(1);G.renderer.setSize(960,600,false);G.renderer.shadowMap.enabled=false;
  });
  for(const kind of ['original','mobile'])for(const pose of ['standing','crouch']){
   const png=await f.page.evaluate(({kind,pose})=>{
    const C=modelCapture;if(C.actor){C.scene.remove(C.actor.root);C.actor.dispose();}const saved=G.Soldiers.templates;G.Soldiers.templates=[C.templates[kind]];C.actor=new G.CharacterModel();G.Soldiers.templates=saved;C.scene.add(C.actor.root);C.actor.root.position.copy(C.base);
    const state={speed:0,pitch:0,crouch:pose==='crouch',knocked:false,prone:false,dead:false,state:'ground',cur:'rifle',gun:'ar7',onGround:true,groundY:C.base.y,distance2:9,groundMat:'concrete'};for(let i=0;i<60;i++)C.actor.update(1/60,state);C.scene.updateMatrixWorld(true);G.renderer.setRenderTarget(null);G.renderer.autoClear=true;G.renderer.render(C.scene,C.camera);G.Perf.gpuWait();return G.renderer.domElement.toDataURL('image/png').split(',')[1];
   },{kind,pose});fs.writeFileSync(path.join(out,kind+'-'+pose+'.png'),Buffer.from(png,'base64'));
  }
  if(f.errors.length)throw Error(f.errors.join('\n'));console.log('PASS 원본·모바일 군인 서기·앉기 촬영');
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
