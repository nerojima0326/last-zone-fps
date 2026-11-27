
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 같은 바퀴 경로에서 실제 자국을 확대 렌더링하고 GPU에서 가장자리·시간 감쇠를 확인한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
const mode=process.argv[2]||'after',file=path.resolve(process.env.SHOTS||'/workspace/artifacts/v103-skids-'+mode+'.png');
(async()=>{const f=await fixture(mode==='before'?'6a98b65e38f6486cb21aeef7b8c732b841a81834':null);try{
 const result=await f.page.evaluate(()=>{
  const T=THREE,V=G.Vehicles,W=G.World,S=G.VehicleSkids,methods={heightAt:W.heightAt,waterAt:W.waterAt},R=G.renderer;W.heightAt=()=>300;W.waterAt=()=>-100;G.camera.position.set(0,308,-10);S?.reset();G.FX.reset();
  const v=V.newVehicle(0,300,0,0,{kind:'izh'});V.unblock(v);const scene=new T.Scene();scene.background=new T.Color(0x656b70);scene.fog=new T.FogExp2(0xa4afb6,.002);scene.environment=G.scene.environment;
  const road=new T.Mesh(new T.PlaneGeometry(18,36).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0x96999b}));road.position.set(0,300,-10);scene.add(road);
  scene.add(new T.HemisphereLight(0xffffff,0x667066,2));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(10,330,4);sun.target.position.set(0,300,-10);scene.add(sun,sun.target);
  const camera=new T.OrthographicCamera(-16,16,9,-9,.1,100);camera.position.set(0,340,-10);camera.up.set(1,0,0);camera.lookAt(0,300,-10);camera.updateMatrixWorld(true);
  try{
   for(let i=0;i<=180;i++){
    const t=i/180*10;v.pos.set(Math.sin(t*.62)*4,300,-t*2);v.yaw=Math.atan2(-2.48*Math.cos(t*.62),2);V.place(v,1);v.handbrake=true;v.drift=true;v.speed=12;v.lat=4;V.wheelAnim(v,1/60);V.tires(v,1/60);S?.update(1/60);
   }
   S?.stop(v);scene.add(v.mesh,V.skids);
   R.setPixelRatio(1);R.setSize(960,540,false);R.toneMappingExposure=.9;R.autoClear=true;R.setRenderTarget(null);R.render(scene,camera);G.Perf.gpuWait();const image=R.domElement.toDataURL('image/png').split(',')[1];
   const target=new T.WebGLRenderTarget(512,288),read=()=>{const data=new Uint8Array(512*288*4);R.setRenderTarget(target);R.render(scene,camera);R.readRenderTargetPixels(target,0,0,512,288,data);return data;};
   const fresh=read();V.skids.visible=false;const empty=read();V.skids.visible=true;S?.update(10);const middle=read();S?.update(3);const faded=read();
   const difference=buffer=>{let energy=0,pixels=0;const levels=new Set();for(let i=0;i<buffer.length;i+=4){const dark=Math.max(0,empty[i]+empty[i+1]+empty[i+2]-buffer[i]-buffer[i+1]-buffer[i+2]);if(dark>3){pixels++;energy+=dark;levels.add(dark);}}return {energy,pixels,levels:levels.size};};
   const gpu={fresh:difference(fresh),middle:difference(middle),faded:difference(faded),marks:V.skidN||0};R.setRenderTarget(null);target.dispose();return {image,gpu};
  }finally{Object.assign(W,methods);G.scene.add(v.mesh);if(V.skids)G.scene.add(V.skids);V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);S?.reset();road.geometry.dispose();road.material.dispose();G.FX.reset();}
 });
 fs.mkdirSync(path.dirname(file),{recursive:true});const bytes=Buffer.from(result.image,'base64');assert(bytes.length>10000,'빈 자국 캡처');fs.writeFileSync(file,bytes);
 const report={mode,gpu:result.gpu,errors:f.errors};fs.writeFileSync(file.replace(/\.png$/,'.json'),JSON.stringify(report,null,2)+'\n');assert.deepEqual(f.errors,[]);
 if(mode!=='before'){assert(report.gpu.fresh.energy>1000&&report.gpu.fresh.levels>8,'자국·부드러운 가장자리 렌더');assert(report.gpu.middle.energy<report.gpu.fresh.energy*.8&&report.gpu.faded.energy<10,'실제 GPU 시간 감쇠');}
 console.log('PASS 실제 타이어 자국 렌더',mode,JSON.stringify(report.gpu));
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
