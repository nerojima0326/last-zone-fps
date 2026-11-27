
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// v107 실제 속도·입력·체력·밤 상태, 숫자 가림과 계기판의 그리기·텍스처 비용을 검사한다.
const fs=require('fs'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
const mobile=process.env.CABIN_MOBILE==='1',viewport=mobile?{width:844,height:390}:{width:1280,height:720};
(async()=>{const f=await fixture(process.env.BASELINE_DASH,{viewport,contextOptions:mobile?{hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}:undefined});try{
 const report=await f.page.evaluate(({mobile,viewport})=>{
  const C=G.VehicleCabin,V=G.Vehicles,P=G.Player,T=THREE,R=G.renderer,W=G.World,methods={height:W.heightAt,water:W.waterAt},models=V.models,rows=[];W.heightAt=()=>300;W.waterAt=()=>-100;
  const lightCount=()=>{let n=0;G.scene.traverse(o=>{if(o.isLight)n++;});return n;},lights=lightCount();
  try{for(const kind of['porter','e2200','izh','fallback']){
   if(kind==='fallback')V.models={};const v=V.newVehicle(0,300,0,0,{kind:kind==='fallback'?'izh':kind});V.models=models;V.enter(P,v);P.vehicleView='first';G.Input.reset();G.Game.syncModels(1/60);C.camera(P,1);v.mesh.updateMatrixWorld(true);G.camera.updateMatrixWorld(true);const c=v.cabin,t=C.template(kind),row={kind,legacy:!c.cluster};
   try{
    // v107 같은 프레임에 실내만 그려 맵·그림자의 호출 수를 제외한다.
    const proof=new T.Scene(),parent=c.root.parent,shadow=R.shadowMap.enabled;proof.add(new T.HemisphereLight(0xffffff,0x667066,2),c.root);c.root.position.y=300;R.shadowMap.enabled=false;R.setRenderTarget(null);R.info.reset();R.render(proof,G.camera);G.Perf.gpuWait();row.calls=R.info.render.calls;row.triangles=R.info.render.triangles;parent.add(c.root);c.root.position.y=0;R.shadowMap.enabled=shadow;
    if(!c.cluster){rows.push(row);continue;}
    // v108 계기판 전체가 화면에서 차지하는 높이·면적을 기록한다.
    const pos=t.faceGeo.attributes.position,lo=new T.Vector2(Infinity,Infinity),hi=new T.Vector2(-Infinity,-Infinity);for(let i=0;i<pos.count;i++){const point=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(c.faces.matrixWorld).project(G.camera);lo.min(point);hi.max(point);}row.footprint={width:(hi.x-lo.x)/2,height:(hi.y-lo.y)/2,area:(hi.x-lo.x)*(hi.y-lo.y)/4};
    const samples=[];for(const kph of[0,30,60,90,120]){v.speed=kph/3.6;v.lat=0;C.animate(v);samples.push({kph,angle:c.needle.rotation.z,error:Math.abs(c.needle.rotation.z-(Math.PI*.75-Math.min(1,kph/c.cluster.maxKph)*Math.PI*1.5))});}row.speed=samples;
    v.speed=-Math.sqrt((60/3.6)**2-4**2);v.lat=4;C.animate(v);row.reverseLateralError=Math.abs(c.kph-60);
    // v108 같은 속도대에서 입력만 비교해 가속 중 상향 변속의 RPM 하락을 분리한다.
    const rpm=boost=>{v.pos.set(0,300,0);Object.assign(v,{speed:18,lat:0,yaw:0,steer:0,displayRpm:800});for(let i=0;i<120;i++){v.speed=18;V.stepPhysics(v,P.a,1/120,1,0,false,false,boost);}C.animate(v);return c.rpm;};row.rpm={idle:800,throttle:rpm(false),boost:rpm(true)};
    const running=row.rpm.boost;for(let i=0;i<120;i++)V.stepPhysics(v,P.a,1/120,0,0,false,false,false);C.animate(v);row.rpm.coast=c.rpm;row.rpm.running=running;
    v.hp=v.maxHp*.29;V.stepPhysics(v,P.a,1/120,0,0,false,true,false);C.animate(v);row.warning={engine:c.warning,handbrake:c.handbrake,colors:Array.from(c.lamps.instanceColor.array)};v.hp=v.maxHp;v.handbrake=false;C.animate(v);row.clear={engine:c.warning,handbrake:c.handbrake};
    const weather=W.weather,version=t.atlas.version,draws=t.atlas.userData.canvasDraws;W.weather='day';C.animate(v);const day=c.faces.material.emissiveIntensity;W.weather='night';C.animate(v);row.night={day,night:c.faces.material.emissiveIntensity,lightsBefore:lights,lightsAfter:lightCount()};W.weather=weather;
    for(let i=0;i<180;i++){v.steer=Math.sin(i*.1);C.animate(v);}row.texture={versionBefore:version,versionAfter:t.atlas.version,drawsBefore:draws,drawsAfter:t.atlas.userData.canvasDraws,mipmaps:t.atlas.generateMipmaps,minFilter:t.atlas.minFilter,anisotropy:t.atlas.anisotropy,maxAnisotropy:Math.min(16,R.capabilities.getMaxAnisotropy()),width:t.atlas.image.width,height:t.atlas.image.height,id:t.atlas.uuid};
    v.pos.set(0,300,0);v.yaw=v.pitch=v.roll=0;V.place(v,1);P.vehicleLookYaw=0;P.vehicleLookPitch=-.22;C.camera(P,1);const ctx=t.atlas.image.getContext('2d');
    row.layout=t.gauges.map(g=>({kind:g.kind,x:g.x,y:g.y,r:g.r,max:g.max}));row.visibility=[];const visible=o=>{for(let node=o;node;node=node.parent)if(!node.visible)return false;return true;};
    for(const steer of[-1,0,1]){
     v.steer=steer;C.pose(P.a.model,v,true);v.mesh.updateMatrixWorld(true);G.camera.updateMatrixWorld(true);const labels=[];
     for(const gi of t.gauges){const major=gi.kind==='speed'?gi.max/20:gi.kind==='rpm'?7:2,font=gi.font*gi.cell[2]/512*t.atlas.image.width/1024;ctx.font='bold '+font+'px '+(kind==='izh'?'Georgia':'Arial');const metrics=ctx.measureText('60'),fontHeight=(metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent)/(gi.cell[2]*t.atlas.image.width/1024)*(gi.faceRadius||gi.r-.004)*2;
      for(let i=0;i<=major;i++){
       const angle=Math.PI*.75-i/major*Math.PI*1.5,pos=new T.Vector3(gi.x-Math.sin(angle)*(gi.faceRadius||gi.r-.004)*gi.labelRadius/256,gi.y+Math.cos(angle)*(gi.faceRadius||gi.r-.004)*gi.labelRadius/256,gi.z).applyMatrix4(v.mesh.matrixWorld),ndc=pos.clone().project(G.camera),up=pos.clone().add(new T.Vector3(0,1,0).transformDirection(v.mesh.matrixWorld).multiplyScalar(fontHeight)).project(G.camera),ray=new T.Raycaster(G.camera.position,pos.clone().sub(G.camera.position).normalize()),hit=ray.intersectObjects([c.wheel,...P.a.model.meshes].filter(visible),false)[0];
       labels.push({dial:gi.kind,value:gi.kind==='speed'?i*20:gi.kind==='rpm'?i*1000:i/2,x:ndc.x,y:ndc.y,pixels:Math.abs(up.y-ndc.y)*viewport.height/2,blocked:!!hit&&hit.distance<G.camera.position.distanceTo(pos)-.003});
      }
     }row.visibility.push({steer,labels});
    }
    row.aux=c.aux.map(g=>g.kind);v.fuel=.1;v.engineHeat=.8;C.animate(v);row.auxFinite=!c.auxNeedles||c.auxNeedles.instanceMatrix.array.every(Number.isFinite);
    row.shared=C.template(kind)===t;rows.push(row);
   }finally{V.exit(P,true);V.unblock(v);G.scene.remove(v.mesh);V.list.splice(V.list.indexOf(v),1);let disposed=false;if(c.lamps)c.lamps.addEventListener('dispose',()=>disposed=true);G.VehicleWheels.dispose(v);row.disposed=disposed&&v.cabin===null;}
  }}finally{W.heightAt=methods.height;W.waterAt=methods.water;}
  return{mobile,viewport,rows};
 },{mobile,viewport});
 fs.writeFileSync(process.env.REPORT||'/tmp/lz-cabin-instruments.json',JSON.stringify({...report,errors:f.errors},null,2)+'\n');
 for(const r of report.rows){assert(r.calls<=6,r.kind+' 기존 3회 + 증가 3회 이하');if(r.legacy){assert.equal(r.calls,3);continue;}assert(r.footprint.height<.18&&r.footprint.width<.21,r.kind+' 계기판 시야 점유 한도');assert(r.disposed,r.kind+' 표시등 전용 버퍼 해제');assert(r.speed.every(s=>s.error<1e-7));assert(r.reverseLateralError<1e-7);assert(r.rpm.throttle>r.rpm.idle+500&&r.rpm.boost>r.rpm.throttle+500&&r.rpm.coast<r.rpm.running,r.kind+' 회전수 입력 추종');assert(r.warning.engine&&r.warning.handbrake&&!r.clear.engine&&!r.clear.handbrake);assert(r.warning.colors[0]>r.warning.colors[1]&&r.warning.colors[3]>r.warning.colors[5]);assert(r.night.night>r.night.day&&r.night.lightsAfter===r.night.lightsBefore);assert(r.auxFinite);assert(r.shared&&r.texture.drawsAfter===1&&r.texture.versionBefore===r.texture.versionAfter);assert(r.texture.mipmaps&&r.texture.minFilter===1008&&r.texture.anisotropy===r.texture.maxAnisotropy);
  for(const view of r.visibility){assert(view.labels.every(l=>Math.abs(l.x)<1&&Math.abs(l.y)<1&&l.pixels>=(['speed','rpm'].includes(l.dial)?8:4)),r.kind+' 숫자 화면 범위·높이');assert(view.labels.filter(l=>l.blocked).length===0,r.kind+' 핸들·손의 과도한 숫자 가림');assert(!view.labels.find(l=>l.dial==='speed'&&l.value===60).blocked,r.kind+' 60 눈금 가림');}
 }
 assert.deepEqual(f.errors,[]);if(report.rows.every(r=>!r.legacy))assert.equal(new Set(report.rows.map(r=>r.texture.id)).size,4,'차종별 아틀라스 재사용');console.log('PASS 4종 속도·회전수·경고등·밤 발광·숫자 가림·텍스처 1회·3회 이내 증가',JSON.stringify(report.rows.map(r=>({kind:r.kind,calls:r.calls,legacy:r.legacy,minPixels:r.visibility?Math.min(...r.visibility.flatMap(v=>v.labels.map(l=>l.pixels))):null,hidden:r.visibility?.map(v=>v.labels.filter(l=>l.blocked).map(l=>l.dial+':'+l.value))}))));
 }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
