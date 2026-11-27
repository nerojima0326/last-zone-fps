
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 게임의 운전 입력·추적 카메라로 12m 낙차를 주행한다. 고정 간격 영상이며 실제 FPS 측정이 아니다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.argv[2]||'/tmp/lz-v87-drive';
(async()=>{
 fs.mkdirSync(path.join(out,'frames'),{recursive:true});const f=await fixture({viewport:{width:800,height:450}});
 try{
  const p=f.page;await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});await p.click('#trainBtn');await p.waitForFunction(()=>G.Training.active);
  await p.evaluate(()=>{
   const T=THREE,W=G.World;G.paused=true;G.UI.showPause(false);G.Input.unlock();G.__apply('medium');G.setRenderResolution('100');G.VM.set(null);
   for(const o of G.scene.children)if(!o.isLight&&o!==W.sky)o.visible=false;
   W.heightAt=(x,z)=>300+(-z<15?12:-z<16?12*(16+z):0);W.waterAt=()=>0;
   const geo=new T.PlaneGeometry(42,120,42,120).rotateX(-Math.PI/2).translate(0,0,-40),a=geo.attributes.position,c=[];
   for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i);a.setY(i,W.heightAt(x,z));const color=new T.Color(Math.abs(x)<4?0x595c5c:0x7e826c);c.push(color.r,color.g,color.b)}geo.setAttribute('color',new T.Float32BufferAttribute(c,3));geo.computeVertexNormals();const ground=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.95}));ground.receiveShadow=true;G.scene.add(ground);
   const v=window.__driveCar=G.Vehicles.newVehicle(0,312,0,0,{kind:'porter'});G.Vehicles.enter(G.Player,v);v.speed=13;G.Player.orbitYaw=0;G.Player.orbitPitch=-.22;G.Input.keys.KeyW=true;
  });
  await p.addStyleTag({content:'#hud,#toast,#fpsBox,#perfOverlay{visibility:hidden!important}'});const rows=[];
  for(let i=0;i<60;i++){
   rows.push(await p.evaluate(()=>{
    for(let i=0;i<5;i++){G.Input.keys.KeyW=true;G.Game.time+=1/60;G.Vehicles.drive(G.Player,1/60);G.FX.update(1/60)}
    const W=G.World,v=__driveCar;W.sun.target.position.copy(v.pos);W.sun.position.copy(v.pos).addScaledVector(W.sunDir,80);const sc=W.sun.shadow.camera;Object.assign(sc,{left:-25,right:25,top:25,bottom:-25,near:.1,far:180});sc.updateProjectionMatrix();W.sun.target.updateMatrixWorld(true);G.renderer.shadowMap.needsUpdate=true;G.Audio.setListener(G.camera.position,G.Player.orbitYaw);G.renderNow();G.Perf.gpuWait();return{pos:v.pos.toArray(),throttle:G.Input.down('KeyW'),pitch:v.pitch,vy:v.vy,grounded:v.grounded,landings:v.landings||0,speed:v.speed};
   }));
   await p.screenshot({path:path.join(out,'frames',String(i).padStart(3,'0')+'.png'),timeout:60000});
  }
  cp.execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-framerate','12','-i',path.join(out,'frames','%03d.png'),'-c:v','libvpx-vp9','-crf','31','-b:v','0',path.join(out,'v87-downhill.webm')]);
  fs.writeFileSync(path.join(out,'drive.json'),JSON.stringify({version:87,method:'실제 운전 입력·추적 카메라, 60Hz 시뮬레이션·12fps 고정 캡처, 12m 실험 낙차',rows,errors:f.errors},null,2)+'\n');
  if(!rows.some(r=>!r.grounded)||rows.at(-1).landings!==1||f.errors.length)throw Error('주행 영상 검증 실패 '+JSON.stringify(f.errors));console.log('PASS 낙하·착지·추적 카메라 영상');
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
