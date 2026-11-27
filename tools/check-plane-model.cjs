
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 실제 게임의 수송기를 여러 각도에서 촬영하고 메시·강하문·팬·정리를 확인한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),{execFileSync}=require('child_process');
const fixture=require('./optimize/browser-fixture.cjs');
const shots=path.resolve(process.env.PLANE_SHOTS||path.join(require('os').tmpdir(),'last-zone-plane')); // v107 외부 산출물
(async()=>{
 const f=await fixture({viewport:{width:960,height:600}}),{page}=f,report={};
 try{
  await page.evaluate(()=>{
   window.requestAnimationFrame=()=>0;G.paused=true;G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};
   const T=THREE,renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
   renderer.setPixelRatio(1);renderer.setSize(960,600);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
   const scene=new T.Scene();scene.background=new T.Color(0x17222c);scene.fog=new T.Fog(0x17222c,95,180);
   scene.add(new T.HemisphereLight(0xc7e2ff,0x444b42,2));
   const key=new T.DirectionalLight(0xffedda,3);key.position.set(-18,32,-25);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
   Object.assign(key.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:1,far:100});key.shadow.bias=-.0005;scene.add(key);
   const fill=new T.DirectionalLight(0xb1d7ff,1.2);fill.position.set(28,10,-4);scene.add(fill);
   const rim=new T.DirectionalLight(0xffffff,2);rim.position.set(-10,15,20);scene.add(rim);
   const floor=new T.Mesh(new T.PlaneGeometry(300,300),new T.MeshStandardMaterial({color:0x27343d,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-3.4;floor.receiveShadow=true;scene.add(floor);
   const stage=document.createElement('div');stage.style.cssText='position:fixed;inset:0;z-index:99999;background:#17222c';stage.appendChild(renderer.domElement);document.body.appendChild(stage);
   const title=document.createElement('div');title.style.cssText='position:absolute;top:20px;left:24px;color:#cedae3;font:16px sans-serif';stage.appendChild(title);
   window.planeStudio={renderer,scene,stage,title,camera:new T.PerspectiveCamera(43,960/600,.1,200),build:G.buildPlane,dispose:G.disposePlane};
  });
  const old=execFileSync('git',['show','635986c:js/plane.js'],{encoding:'utf8'});
  fs.mkdirSync(shots,{recursive:true});
  for(const mode of ['before','after']){
   if(mode==='before')await page.evaluate(source=>{(0,eval)(source)},old);
   else await page.evaluate(()=>{G.buildPlane=planeStudio.build;G.disposePlane=planeStudio.dispose});
   report[mode]=await page.evaluate(()=>{
    const s=planeStudio;s.plane=G.buildPlane();s.scene.add(s.plane);
    let meshes=0,triangles=0;const geometries=new Set();
    s.plane.traverse(o=>{
     if(!o.isMesh)return;meshes++;const g=o.geometry;geometries.add(g);triangles+=(g.index?g.index.count:g.attributes.position.count)/3;
     for(const key of ['position','normal'])if(![...g.attributes[key].array].every(Number.isFinite))throw Error('메시의 비정상 좌표');
    });
    return{meshes,triangles,geometries:geometries.size,size:new THREE.Box3().setFromObject(s.plane).getSize(new THREE.Vector3()).toArray(),fans:s.plane.userData.props.length};
   });
   for(const [name,position,target] of [
    ['front',[40,16,-45],[0,2,0]],['side',[47,10,0],[0,3,0]],['rear',[-36,19,43],[0,3,0]],['engines',[16,3,-15],[9,1,-3]],['exhaust',[16,2,12],[10,1,0]]
   ]){
    await page.evaluate(({mode,name,position,target})=>{
     const s=planeStudio;s.title.textContent=(mode==='before'?'이전 모델 · v88':'새 수송기 · LZ-89')+' · '+({front:'앞쪽',side:'옆면',rear:'뒤쪽',engines:'엔진 상세',exhaust:'배기구 상세'})[name];
     s.camera.position.fromArray(position);s.camera.lookAt(new THREE.Vector3().fromArray(target));
     s.plane.userData.update(.016,true);for(const p of s.plane.userData.props)p.rotation.z+=.2;
     s.renderer.render(s.scene,s.camera);const gl=s.renderer.getContext();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
    },{mode,name,position,target});
    await page.screenshot({path:path.join(shots,mode+'-'+name+'.png'),timeout:60000});
   }
   if(mode==='after')report.model=await page.evaluate(()=>{
    const p=planeStudio.plane,check=(ok,msg)=>{if(!ok)throw Error(msg)};
    check(p.userData.model==='LZ-89','새 수송기 모델 누락');check(p.userData.props.length===4,'엔진 팬 누락');
    const glass=p.getObjectByName('수송기_glass').geometry,pos=glass.attributes.position,n=glass.attributes.normal;
    let minDot=Infinity;
    for(let i=0;i<pos.count;i++)minDot=Math.min(minDot,pos.getX(i)*n.getX(i)+(pos.getY(i)-.25)*n.getY(i));
    check(minDot>0,'조종석 창문이 안쪽을 향함');
    p.updateMatrixWorld(true);
    const hull=p.getObjectByName('수송기_hull');
    for(const side of [-1,1]){
     const ray=new THREE.Raycaster(new THREE.Vector3(side*5,-.8,6.85),new THREE.Vector3(-side,0,0),0,3);
     check(ray.intersectObject(hull).length===0,'강하문에 동체 면이 남음');
     check(Math.abs(p.userData.exits[side<0?0:1].x)>3.5,'강하 시작점이 동체 안에 있음');
    }
    const fans=p.userData.props.map(f=>({depth:f.position.z,meshes:f.children.length}));
    check(fans.every(f=>f.meshes===2),'회전 팬 병합 누락');
    const owned=new Set();p.traverse(o=>{if(o.geometry)owned.add(o.geometry)});const freed=new Set();
    for(const g of owned)g.addEventListener('dispose',()=>freed.add(g));G.disposePlane(p);
    check(!p.parent&&freed.size===owned.size,'기체 지오메트리 정리 누락');
    const next=G.buildPlane();check(next.userData.props.length===4,'반복 생성 실패');G.disposePlane(next);
    return{outwardGlassMinDot:minDot,doorHoles:true,fans,freed:freed.size};
   });
   else await page.evaluate(()=>G.disposePlane(planeStudio.plane));
  }
  assert(report.after.meshes<report.before.meshes,'세부 모델을 병합해야 함');assert(report.after.triangles<50000,'기체 삼각형 예산 초과');
  await page.evaluate(()=>{planeStudio.stage.remove();planeStudio.renderer.dispose();G.UI.opts.renderResolution='100';G.startGame({...G.UI.opts,quality:'medium',players:4,size:2,loadout:'all'});G.paused=true;G.UI.hideMenu()});
  await page.addStyleTag({content:'#hud{visibility:hidden!important}'});
  report.game=await page.evaluate(()=>{
   const p=G.Game.plane;p.start.set(0,0,0);p.dir.set(0,0,-1);p.t=0;p.mesh.rotation.set(0,0,0);G.Game.updatePlane(0);G.Player.updatePlane(0);
   G.camera.position.copy(p.pos).add(new THREE.Vector3(37,15,-32));G.camera.lookAt(p.pos);G.camera.fov=62;G.camera.updateProjectionMatrix();G.renderNow();G.Perf.gpuWait();
   return{model:p.mesh.userData.model,props:G.Game.props.length};
  });
  await page.screenshot({path:path.join(shots,'after-game.png'),timeout:60000});
  report.exits=await page.evaluate(()=>{
   const a=G.Game.player,p=G.Game.plane,id=a.id,rows=[];
   for(const side of [-1,1]){a.id=side<0?1:0;a.state='plane';G.Game.jump(a);rows.push({side,local:p.mesh.worldToLocal(a.pos.clone()).toArray(),state:a.state});}
   a.id=id;return rows;
  });
  assert(report.exits.every(r=>r.state==='freefall'&&Math.abs(r.local[0])>3.5));assert.deepEqual(f.errors,[]);
  report.errors=f.errors;fs.writeFileSync(path.join(shots,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));console.log('PASS 수송기 외형·강하문·팬·반복 생성·정리·게임 장면');
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
