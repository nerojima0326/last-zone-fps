// 실제 캐릭터·차량 실내를 같은 조명에서 촬영하고 훈련장의 내부 시점도 저장한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
const out=path.resolve(process.env.SHOTS||'/workspace/artifacts/v104-cabins');
(async()=>{const f=await fixture();try{
 const data=await f.page.evaluate(()=>{
  const T=THREE,V=G.Vehicles,P=G.Player,a=P.a,m=a.model,W=G.World,methods={height:W.heightAt,water:W.waterAt},rows=[],pics=[],R=G.renderer;
  W.heightAt=()=>300;W.waterAt=()=>-100;G.VM.set(null);R.setPixelRatio(1);R.setSize(960,540,false);R.toneMappingExposure=.85;
  const scene=new T.Scene();scene.background=new T.Color(0x879caa);scene.add(new T.HemisphereLight(0xd6efff,0x6c6858,2));
  const sun=new T.DirectionalLight(0xffedd0,3);sun.position.set(-6,309,-4);sun.target.position.set(0,301,-1);scene.add(sun,sun.target);
  const road=new T.Mesh(new T.PlaneGeometry(40,40).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x777c7e}));road.position.y=300;scene.add(road);
  const paintGeo=new T.BoxGeometry(.07,.015,.6),paintMat=new T.MeshBasicMaterial({color:0xd8c888});
  for(let i=0;i<12;i++){const mark=new T.Mesh(paintGeo,paintMat);mark.position.set(.3,300.01,-3-i*2);scene.add(mark);}
  const capture=(kind,view,camera)=>{camera.updateMatrixWorld(true);R.setRenderTarget(null);R.render(scene,camera);G.Perf.gpuWait();pics.push({kind,view,image:R.domElement.toDataURL('image/png').split(',')[1]});};
  try{
   for(const kind of[...V.kinds,'fallback']){
    const models=V.models;if(kind==='fallback')V.models={};const v=V.newVehicle(0,300,0,0,{kind:kind==='fallback'?'izh':kind});V.models=models;
    V.enter(P,v);V.step(v,a,1/60,0,0,false,false);v.steer=.25;scene.add(v.mesh,m.root);P.camMode='vehicle';P.vehicleView='third';G.camera.position.set(-2.4,301.8,-3.5);G.Game.syncModels(1/60);
    const outside=new T.PerspectiveCamera(55,960/540,.035,300);outside.position.set(-2.2,301.85,kind==='izh'?-2.6:-3.7);outside.lookAt(-.1,301.10,kind==='izh'?-.10:-1.10);capture(kind,'outside',outside);
    P.vehicleView='first';P.vehicleLookYaw=0;P.vehicleLookPitch=-.12;G.VehicleCabin.camera(P,1/60);G.Game.syncModels(1/60);capture(kind,'inside',G.camera);
    if(kind==='izh'){P.vehicleLookPitch=-.42;G.VehicleCabin.camera(P,1/60);G.Game.syncModels(1/60);capture(kind,'hands',G.camera);}
    rows.push({kind,visible:m.root.visible,hiddenHead:m.driverHead.hidden,camera:G.camera.position.toArray(),profile:v.cabin.profile,glassVertices:v.mesh.getObjectByName('IZH 창유리')?.geometry.attributes.position.count});
    V.exit(P,true);G.scene.add(v.mesh,m.root);G.scene.remove(v.mesh);V.unblock(v);V.list.splice(V.list.indexOf(v),1);G.VehicleWheels.dispose(v);
   }
  }finally{W.heightAt=methods.height;W.waterAt=methods.water;road.geometry.dispose();road.material.dispose();paintGeo.dispose();paintMat.dispose();}
  // 별도 조명 검사용 장면에 이어 실제 훈련장에서도 게임 렌더 경로를 사용한다.
  const v=V.list.find(v=>v.kind==='izh');V.enter(P,v);P.vehicleView='first';G.Input.reset();
  for(let i=0;i<60;i++){P.update(1/60);G.Game.syncModels(1/60);G.Input.endFrame();}
  G.setRenderResolution('100');W.update(0,G.camera.position,G.camera);G.UI.update(1/60);G.renderNow();G.Perf.gpuWait();pics.push({kind:'training',view:'inside',image:R.domElement.toDataURL('image/png').split(',')[1]});
  // 시점마다 새로 보이는 맵 자원의 지연 업로드를 제외하고, 같은 차량·캐릭터의 재탑승만 측정한다.
  const proof=new T.Scene();proof.add(new T.HemisphereLight(0xffffff,0x667066,2),v.mesh,m.root);
  const cycle=i=>{V.exit(P,true);V.enter(P,v);P.vehicleView=i%2?'third':'first';P.update(1/60);G.Game.syncModels(1/60);R.render(proof,G.camera);G.Perf.gpuWait();};
  for(let i=0;i<4;i++)cycle(i);const base={...R.info.memory};for(let i=0;i<8;i++)cycle(i);
  const resources={geometries:R.info.memory.geometries-base.geometries,textures:R.info.memory.textures-base.textures};G.scene.add(v.mesh,m.root);V.exit(P,true);return{rows,pics,resources};
 });
 fs.mkdirSync(out,{recursive:true});for(const x of data.pics){const buffer=Buffer.from(x.image,'base64');assert(buffer.length>10000,'빈 실내 캡처');fs.writeFileSync(path.join(out,x.kind+'-'+x.view+'.png'),buffer);}delete data.pics;data.errors=f.errors;fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify(data,null,2)+'\n');assert.deepEqual(f.errors,[]);assert.deepEqual(data.resources,{geometries:0,textures:0});console.log('PASS 4종 내외부·실제 훈련장·반복 탑승 자원 재사용',JSON.stringify(data));
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
