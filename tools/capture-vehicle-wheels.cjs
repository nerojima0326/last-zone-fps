// 같은 차종·카메라에서 바퀴 굴림과 타이어 파손 전후를 저장한다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),fixture=require('./optimize/browser-fixture.cjs');
const mode=process.argv[2]||'after',out=process.argv[3]||'/tmp/lz-v86-capture',base='401a95292dae33004113cb06264fcebba1934177',old={};
if(mode==='before')for(const name of['index.html','js/vehicles.js','js/world.js','js/weapons.js','js/core.js'])old[name]=cp.execFileSync('git',['show',base+':'+name],{encoding:'utf8'});
(async()=>{
 const f=await fixture({viewport:{width:800,height:450},route:async p=>{
  if(mode!=='before')return;
  await p.route('**/version.txt*',r=>r.fulfill({body:'85'}));
  await p.route('**/assets/models/vehicles/*.glb*',r=>{const name=new URL(r.request().url()).pathname.slice(1);return r.fulfill({body:cp.execFileSync('git',['show',base+':'+name],{maxBuffer:8*1024*1024}),contentType:'model/gltf-binary'})});
  await p.route(u=>u.hostname==='127.0.0.1'&&(u.pathname==='/'||old[u.pathname.slice(1)]!==undefined),r=>{const name=new URL(r.request().url()).pathname.slice(1)||'index.html';return r.fulfill({body:old[name],contentType:name.endsWith('.html')?'text/html':'application/javascript'})});
 }});
 try{
  const p=f.page;fs.mkdirSync(out,{recursive:true});await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock()});await p.click('#trainBtn');await p.waitForFunction(()=>G.Training.active);
  await p.evaluate(()=>{
   G.paused=true;G.Input.unlock();G.UI.showPause(false);G.__apply('medium');G.setRenderResolution('100');G.VM.set(null);G.VM.update(0,{hideVM:true,ads:0,raise:1,reload:null,moving:0,landDip:0,phase:0});
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(32,32).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x596066,roughness:.92}));floor.position.y=300;floor.receiveShadow=true;G.scene.add(floor);const grid=new THREE.GridHelper(32,32,0x444a50,0x525960);grid.position.y=300.003;G.scene.add(grid);window.__vehicleFloor=floor;window.__height=G.World.heightAt;G.World.heightAt=()=>300;
   // 실험 바닥에도 같은 태양 방향의 접지 그림자를 만든다.
   G.scene.traverse(l=>{if(!l.isDirectionalLight||!l.castShadow)return;const dir=l.position.clone().sub(l.target.position).normalize();l.target.position.set(0,300,0);l.position.copy(l.target.position).addScaledVector(dir,80);Object.assign(l.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:.1,far:180});l.shadow.bias=-.00002;l.shadow.normalBias=.005;l.shadow.camera.updateProjectionMatrix();l.target.updateMatrixWorld(true);l.shadow.needsUpdate=true});G.renderer.shadowMap.needsUpdate=true;
   G.Audio.setListener(new THREE.Vector3(-4,302,-5),0);
  });
  await p.addStyleTag({content:'#hud,#toast,#fpsBox,#perfOverlay{visibility:hidden!important}'});const rows=[];
  for(const kind of['porter','e2200','izh']){
   await p.evaluate(kind=>{
    G.FX.reset();Math.random=G.U.mulberry32(8601+['porter','e2200','izh'].indexOf(kind));if(window.__car){G.Vehicles.unblock(__car);G.scene.remove(__car.mesh);G.Vehicles.list.splice(G.Vehicles.list.indexOf(__car),1);G.VehicleWheels?.dispose(__car)}
    window.__car=G.Vehicles.newVehicle(0,300,0,0,{kind});G.Vehicles.unblock(__car);
    // 기본 대체 모델의 난수 소비량이 버전마다 달라도 도장색을 동일하게 맞춘다.
    __car.mesh.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(/^paint/i.test(m.name))m.color.setHex(0x4a5d6e).lerp(new THREE.Color(0x6b6558),.18)});
    G.camera.position.set(-4,301.65,-4.6);G.camera.lookAt(0,300.85,-.1);G.camera.updateMatrixWorld(true);G.renderNow();
   },kind);
   await p.screenshot({path:path.join(out,mode+'-'+kind+'-intact.png')});
   const result=await p.evaluate(()=>{
    const v=__car,V=G.Vehicles;v.speed=3;v.pos.z-=.8;V.place(v,1);V.wheelAnim(v,.8/3);const angle=v.wheels.map(w=>w.angle??v.spin);
    v.pos.z+=.8;V.place(v,1);V.wheelAnim(v,.8/3);G.VehicleWheels?.sync(v);v.speed=0;
    const w=v.wheels[0],c=w.o.getWorldPosition(new THREE.Vector3()),o=c.clone().add(new THREE.Vector3(-4,0,0)),d=c.clone().sub(o).normalize();
    for(let i=0;i<3;i++){G.Ballistics.fire(G.Game.player,o,d,G.WEAPONS.ar7,o,false);for(let n=0;n<30&&G.Ballistics.list.length;n++)G.Ballistics.update(.005)}
    for(let i=0;i<24;i++)G.FX.update(1/60);V.place(v,1);G.renderNow();return{kind:v.kind,angle,hp:v.hp,tireHP:w.hp??null,flat:w.flat??false,damage:v.wheelDamage||0};
   });rows.push(result);await p.screenshot({path:path.join(out,mode+'-'+kind+'-shot.png')});
   if(mode==='after'){
    await p.evaluate(()=>{const v=__car,w=v.wheels[0],c=w.o.getWorldPosition(new THREE.Vector3());G.camera.position.copy(c).add(new THREE.Vector3(-1.5,.35,-.45));G.camera.lookAt(c);G.camera.updateMatrixWorld(true);G.renderNow()});
    await p.screenshot({path:path.join(out,mode+'-'+kind+'-tire-close.png')});
   }
  }
  if(mode==='after'&&process.env.WHEEL_ANIMATE==='1'){
   const dir=path.join(out,'frames');fs.mkdirSync(dir,{recursive:true});
   await p.evaluate(()=>{window.__follow=G.camera.position.clone().sub(__car.pos);G.VehicleWheels.sync(__car)});
   for(let i=0;i<24;i++){
    await p.evaluate(()=>{const v=__car;v.speed=2.4;v.pos.z-=.2;G.Vehicles.place(v,1);G.Vehicles.wheelAnim(v,1/12);G.FX.update(1/12);G.camera.position.copy(v.pos).add(__follow);G.camera.lookAt(v.wheels[0].o.getWorldPosition(new THREE.Vector3()));G.camera.updateMatrixWorld(true);G.renderNow()});
    await p.screenshot({path:path.join(dir,String(i).padStart(3,'0')+'.png')});
   }
   cp.execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-framerate','12','-i',path.join(dir,'%03d.png'),'-c:v','libvpx-vp9','-crf','32','-b:v','0',path.join(out,'v86-tire-rolling.webm')]);
  }
  fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify({mode,base,rows,errors:f.errors},null,2)+'\n');if(f.errors.length)throw Error(f.errors.join('\n'));console.log('PASS 차량 화면',JSON.stringify(rows));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
