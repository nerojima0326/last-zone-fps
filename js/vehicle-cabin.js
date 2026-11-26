// 차량별 운전석·실내·운전 자세. 기존 캐릭터와 차량 자원을 공유한다.
(function(){
'use strict';
const G=window.G,T=window.THREE,U=G.U,V=T.Vector3;
const p=new V(),hip=new V(),target=new V(),pole=new V(),direction=new V(),bend=new V(),elbow=new V();
const q=new T.Quaternion(),q2=new T.Quaternion(),euler=new T.Euler(),matrix=new T.Matrix4(),normal=new T.Vector3(),a=new V(),b=new V();
const gripSide=new V(),gripForward=new V(),gripNormal=new V(),gripOffset=new V(),gripMatrix=new T.Matrix4(),gripQ=new T.Quaternion();
const profiles={
 porter:{hip:[-.38,.69,-1.19],eye:[-.38,1.40,-1.15],wheel:[-.38,1.02,-1.40],floor:.31,roof:1.72,back:-.80,front:-2.12,width:1.38,dash:1.02},
 e2200:{hip:[-.43,.84,-1.07],eye:[-.43,1.55,-1.03],wheel:[-.43,1.11,-1.33],floor:.41,roof:1.86,back:-.80,front:-1.96,width:1.34,dash:1.10},
 izh:{hip:[-.36,.60,.06],eye:[-.36,1.31,.10],wheel:[-.36,.93,-.19],floor:.20,roof:1.55,back:.47,front:-.77,width:1.22,dash:.91},
 fallback:{hip:[-.42,.73,.48],eye:[-.42,1.44,.52],wheel:[-.42,1.04,.23],floor:.36,roof:1.70,back:1.35,front:-.48,width:1.64,dash:1.02}
};
const C=G.VehicleCabin={
 profiles,templates:new Map(),glass:null,repairs:new WeakMap(),
 profile(v){return profiles[v.cabinKind||v.kind]||profiles.fallback;},
 // 원본의 유리 재질만 바꾼다. 불투명한 차체는 그대로 둔다.
 glazing(v){
  const key=v.cabinKind||v.kind;
  v.mesh.updateMatrixWorld(true);
  if(key==='izh')this.openWindows(v,v.mesh.getObjectByName('body'));
  if(key==='e2200')v.mesh.getObjectByName('body')?.traverse(o=>{if(o.isMesh&&o.material.name==='Interior')this.removeWheel(v,o);});
  v.mesh.traverse(o=>{if(!o.isMesh)return;
   const swap=m=>{if(!(key==='porter'&&m.name==='Material_87'||key==='e2200'&&m.name==='Glass'))return m;
    this.glass||=new Map();if(!this.glass.has(key))this.glass.set(key,new T.MeshStandardMaterial({name:'차량 창유리',color:0x9eb9c2,transparent:true,opacity:.14,roughness:.12,metalness:.12,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,envMapIntensity:.8}));return this.glass.get(key);};
   o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material);
   if((Array.isArray(o.material)?o.material:[o.material]).some(m=>m.name==='차량 창유리'))o.castShadow=false;
  });
 },
 // 양자화 원본의 UV·법선·흙먼지 속성을 보존하며 창문 영역만 잘라 낸다. 결과는 차종 전체가 공유한다.
 geometryParts(v,mesh,regions,remove){
  const g=mesh.geometry;if(this.repairs.has(g))return this.repairs.get(g);
  matrix.copy(v.mesh.matrixWorld).invert().multiply(mesh.matrixWorld);
  const names=Object.keys(g.attributes),attrs=names.map(n=>g.attributes[n]),offsets=[],stride=attrs.reduce((n,a)=>{offsets.push(n);return n+a.itemSize;},0),body=[],glass=[];
  const read=index=>{const values=[];for(const attr of attrs)for(let k=0;k<attr.itemSize;k++)values.push(attr[['getX','getY','getZ','getW'][k]](index));return{values,p:new V().fromBufferAttribute(g.attributes.position,index).applyMatrix4(matrix)};};
  const interpolate=(x,y,t)=>({values:x.values.map((n,k)=>U.lerp(n,y.values[k],t)),p:x.p.clone().lerp(y.p,t)});
  const clip=(poly,plane,sign)=>{const out=[];for(let i=0;i<poly.length;i++){const x=poly[i],y=poly[(i+1)%poly.length],dx=(x.p.x*plane[0]+x.p.y*plane[1]+x.p.z*plane[2]+plane[3])*sign,dy=(y.p.x*plane[0]+y.p.y*plane[1]+y.p.z*plane[2]+plane[3])*sign;if(dx>=-1e-7)out.push(x);if((dx>=0)!==(dy>=0))out.push(interpolate(x,y,dx/(dx-dy)));}return out;};
  const emit=(poly,out)=>{for(let i=1;i<poly.length-1;i++)for(const v of[poly[0],poly[i],poly[i+1]])out.push(...v.values);};
  for(let i=0,n=g.index?.count||g.attributes.position.count;i<n;i+=3){
   let poly=[0,1,2].map(k=>read(g.index?g.index.getX(i+k):i+k));normal.crossVectors(a.subVectors(poly[1].p,poly[0].p),b.subVectors(poly[2].p,poly[0].p)).normalize();
   if(remove){if(!remove(poly))emit(poly,body);continue;}
   const region=regions(poly,normal);if(!region){emit(poly,body);continue;}
   for(const plane of region){emit(clip(poly,plane,-1),body);poly=clip(poly,plane,1);if(!poly.length)break;}
   emit(poly,glass);
  }
  const build=data=>{const out=new T.BufferGeometry();names.forEach((name,k)=>{const attr=attrs[k],array=new Float32Array(data.length/stride*attr.itemSize);for(let i=0;i<data.length/stride;i++)for(let j=0;j<attr.itemSize;j++)array[i*attr.itemSize+j]=data[i*stride+offsets[k]+j];out.setAttribute(name,new T.BufferAttribute(array,attr.itemSize));});out.computeBoundingBox();out.computeBoundingSphere();return out;};
  const result={body:build(body),glass:glass.length?build(glass):null};this.repairs.set(g,result);return result;
 },
 openWindows(v,mesh){
  if(!mesh?.isMesh)return;
  const front=[[1,0,0,.58],[-1,0,0,.58],[0,1,0,-1.13],[0,-1,0,1.48],[0,0,1,1.0],[0,0,-1,-.40]];
  const side=[[0,1,0,-1.14],[0,-1,0,1.46],[0,0,-1,.31],[0,-1,1,1.63]];
  const rear=[[1,0,0,.49],[-1,0,0,.49],[0,1,0,-1.17],[0,-1,0,1.44]];
  const result=this.geometryParts(v,mesh,(poly,n)=>{
   const center=target.copy(poly[0].p).add(poly[1].p).add(poly[2].p).divideScalar(3);
   if(center.z<-.38&&center.y>.96&&Math.abs(n.z)>.45)return front;
   if(Math.abs(center.x)>.56&&center.z<.42&&center.z>-.62&&Math.abs(n.x)>.65)return side;
   if(center.z>.48&&center.z<.55&&Math.abs(n.z)>.8)return rear;
   return null;
  });
  mesh.geometry=result.body;
  this.windowMaterial||=new T.MeshStandardMaterial({name:'차량 창유리',color:0x98b5bd,transparent:true,opacity:.12,roughness:.12,metalness:.10,depthWrite:false,side:T.DoubleSide,forceSinglePass:true});
  if(result.glass){const pane=new T.Mesh(result.glass,this.windowMaterial);pane.name='IZH 창유리';pane.castShadow=false;mesh.add(pane);}
 },
 removeWheel(v,mesh){
  const result=this.geometryParts(v,mesh,null,poly=>poly.every(({p})=>p.z>-1.78&&p.z< -1.32&&(p.x+.46)**2+((p.y-1.18)/.80)**2<.34**2));mesh.geometry=result.body;
 },
 template(key){
  if(this.templates.has(key))return this.templates.get(key);
  const s=profiles[key],parts=[],cg=G.cg,bx=(w,h,d,x,y,z,c)=>parts.push(G.bx(w,h,d,x,y,z,c));
  const cloth=key==='izh'?0x514c40:0x343a3a,trim=key==='porter'?0x414a4e:0x282e30;
  if(key!=='e2200'){
   bx(s.width,.055,s.back-s.front,0,s.floor,(s.back+s.front)/2,0x202626);
   bx(s.width,.18,.30,0,s.dash,s.front+.12,trim);
   bx(s.width,.12,.13,0,s.dash+.11,s.front+.04,0x1e2527);
   bx(s.width,s.dash-s.floor,.04,0,(s.dash+s.floor)/2,s.front+.25,trim);
   for(const side of[-1,1]){
    const x=side*s.width/2;bx(.045,.50,s.back-s.front,x,s.floor+.36,(s.back+s.front)/2,trim);
    bx(.07,.06,.30,x-side*.04,s.dash-.09,s.hip[2]-.12,0x484d4c);
    bx(.025,.025,.15,x-side*.06,s.dash+.04,s.hip[2]-.15,0x9b9f99);
    const seatX=side*Math.abs(s.hip[0]);bx(.49,.13,.49,seatX,s.hip[1]-.11,s.hip[2],cloth);
    const back=G.bx(.48,.57,.11,0,0,0,cloth);back.rotateX(-.10).translate(seatX,s.hip[1]+.20,s.hip[2]+.22);parts.push(back);
    bx(.28,.20,.11,seatX,s.hip[1]+.53,s.hip[2]+.24,cloth);
    for(let i=-2;i<=2;i++)bx(.012,.008,.36,seatX+i*.065,s.hip[1]-.04,s.hip[2]-.01,0x555b55);
   }
   bx(s.width,.46,.045,0,s.floor+.25,s.back-.015,trim);
  }
  const from=new V(s.hip[0],s.dash-.06,s.front+.29),to=new V().fromArray(s.wheel),shaft=new T.CylinderGeometry(.035,.045,from.distanceTo(to),10);
  shaft.applyQuaternion(new T.Quaternion().setFromUnitVectors(new V(0,1,0),to.clone().sub(from).normalize())).translate((from.x+to.x)/2,(from.y+to.y)/2,(from.z+to.z)/2);parts.push(cg(shaft,0x202727));
  // 환기구·계기판·페달은 하나의 정적 메시로 합친다. 텍스처와 조명은 추가하지 않는다.
  for(const x of[-s.width*.38,s.width*.20,s.width*.38]){
   bx(.15,.085,.018,x,s.dash+.045,s.front+.28,0x111719);
   for(let i=0;i<4;i++)bx(.13,.007,.022,x,s.dash+.016+i*.018,s.front+.292,0x626a6b);
  }
  for(const side of[-1,1])bx(.075,.035,.13,s.hip[0]+side*.10,s.floor+.07,s.wheel[2]-.12,0x1b2020);
  const gauge=new T.CylinderGeometry(.10,.10,.014,28).rotateX(Math.PI/2).translate(s.hip[0],s.dash+.05,s.front+.30);parts.push(cg(gauge,0x101c21));
  for(let i=0;i<17;i++){
   const angle=2.25-i*4.5/16,g=G.bx(.008,.022,.008,0,0,0,i>13?0xb4583b:0xc2cfbf);
   g.rotateZ(angle).translate(s.hip[0]+Math.sin(angle)*.078,s.dash+.05+Math.cos(angle)*.078,s.front+.313);parts.push(g);
  }
  const staticGeo=G.mergeGeo(parts);for(const g of parts)g.dispose();
  const wheelParts=[cg(new T.TorusGeometry(.205,.018,8,40),0x202727),cg(new T.CylinderGeometry(.056,.056,.05,16).rotateX(Math.PI/2),0x384143)];
  for(const angle of[.14,Math.PI-.14,-Math.PI/2]){const g=G.bx(.14,.036,.026,0,0,0,0x4a5455);g.rotateZ(angle).translate(Math.cos(angle)*.115,Math.sin(angle)*.115,0);wheelParts.push(g);}
  const wheelGeo=G.mergeGeo(wheelParts);for(const g of wheelParts)g.dispose();
  this.material||=new T.MeshStandardMaterial({name:'차량 실내',vertexColors:true,roughness:.78,metalness:.08});
  const needleGeo=G.bx(.009,.077,.009,0,.027,0,0xde7d55),out={staticGeo,wheelGeo,needleGeo};this.templates.set(key,out);return out;
 },
 ensure(v){
  if(v.cabin)return v.cabin;
  const key=v.cabinKind||v.kind,s=this.profile(v),t=this.template(key),root=new T.Group();root.name='차량 실내';
  const interior=new T.Mesh(t.staticGeo,this.material);interior.receiveShadow=true;root.add(interior);
  const column=new T.Group();column.position.fromArray(s.wheel);column.rotation.x=-.43;root.add(column);
  const wheel=new T.Mesh(t.wheelGeo,this.material);wheel.name='조향 핸들';wheel.castShadow=wheel.receiveShadow=true;column.add(wheel);
  const needle=new T.Mesh(t.needleGeo,this.material);needle.name='속도계 바늘';needle.position.set(s.hip[0],s.dash+.05,s.front+.323);root.add(needle);
  v.mesh.add(root);v.cabin={root,column,wheel,needle,profile:s,angle:0};G.RT?.invalidate();return v.cabin;
 },
 animate(v){const c=this.ensure(v);c.angle=-(v.steer||0)*.72;c.wheel.rotation.z=c.angle;c.needle.rotation.z=-2.25+U.clamp(Math.hypot(v.speed,v.lat||0)/28,0,1)*4.5;return c;},
 grip(v,i,out){const c=v.cabin,s=c.profile,angle=(i===0?Math.PI*.76:Math.PI*.24)+c.angle;return out.set(Math.cos(angle)*.219,Math.sin(angle)*.219,.015).applyEuler(euler.set(-.43,0,0)).add(p.fromArray(s.wheel));},
 pose(m,v,first){
  const c=this.animate(v),s=c.profile;G.HitResponse?.restore(m);G.Knives?.handTP(m,false);
  m.driving=v;m.motion=null;m.ikGun=null;m.setLOD(false);m.setGun(null);m.showChute(false);m.airGear.visible=false;
  m.hip.position.y=.95;m.spine.rotation.set(0,0,0);m.chest.rotation.set(0,0,0);m.head.rotation.set(0,0,0);
  m.legL.rotation.set(1.43,0,.035);m.legR.rotation.set(1.39,0,-.035);m.kneeL.rotation.set(-1.39,0,0);m.kneeR.rotation.set(-1.34,0,0);
  m.armL.rotation.set(1.1,0,.16);m.armR.rotation.set(1.1,0,-.16);m.elbowL.rotation.set(.6,0,0);m.elbowR.rotation.set(.6,0,0);
  if(m.soldier){G.Soldiers.drive(m.soldier,m);hip.copy(m.soldier.X[m.soldier.T.hipIdx||0]);}
  else {hip.set(0,.95,0);for(let i=0;i<2;i++)this.proceduralArm(m,i,this.grip(v,i,target).sub(p.fromArray(s.hip)).add(hip));}
  m.root.quaternion.copy(v.mesh.quaternion);m.root.position.fromArray(s.hip).sub(hip).applyMatrix4(v.mesh.matrixWorld);
  this.hideHead(m,first);m.root.updateMatrixWorld(true);
 },
 driverIK(sd,m){
  const v=m.driving,s=this.profile(v),origin=sd.X[sd.T.hipIdx||0],hands=this.handData(m,sd);
  for(let i=0;i<2;i++){
   this.grip(v,i,target).sub(p.fromArray(s.hip)).add(origin);const hand=hands[i];
   if(hand){
    const angle=(i===0?Math.PI*.76:Math.PI*.24)+v.cabin.angle;
    gripSide.set(-Math.sin(angle),Math.cos(angle),0).multiplyScalar(i===0?-1:1).applyEuler(euler.set(-.43,0,0));
    gripForward.set(0,0,-1).applyEuler(euler);gripNormal.crossVectors(gripSide,gripForward).normalize();
    hand.desired.setFromRotationMatrix(gripMatrix.makeBasis(gripSide,gripForward,gripNormal)).multiply(hand.inverseBasis);
    target.sub(gripOffset.copy(hand.palm).applyQuaternion(hand.desired));
   }
   G.Soldiers.ikArm(sd,i===0?sd.T.ik.L:sd.T.ik.R,target,pole.set(i===0?-.7:.7,-1,.15));
  }
  for(let i=0;i<(sd.T.feet||[]).length;i++){
   const foot=sd.T.feet[i];if(!foot)continue;
   target.set(s.hip[0]+(i===0?-.11:.11),s.floor+foot.sole+.025,s.wheel[2]-.05).sub(p.fromArray(s.hip)).add(origin);
   G.Soldiers.ikArm(sd,foot.pair,target,pole.set(0,0,-1));
  }
 },
 // 손목의 원점 대신 손바닥을 림에 맞추고, 두 손의 반대 방향 손가락 굽힘을 구분한다.
 handData(m,sd){
  if(m.driverGrip)return m.driverGrip;
  m.root.updateMatrixWorld(true);
  return m.driverGrip=[0,1].map(i=>{
   const side=i===0?'Left':'Right',bip=i===0?'L':'R',root=sd.root,wrist=root.getObjectByName(side+'Hand')||root.getObjectByName('Bip01_'+bip+'_Hand');if(!wrist)return null;
   const index=root.getObjectByName(side+'HandIndex1')||root.getObjectByName('Bip01_'+bip+'_Finger1'),little=root.getObjectByName(side+'HandPinky1')||root.getObjectByName('Bip01_'+bip+'_Finger4');if(!index||!little)return null;
   const inverse=wrist.matrixWorld.clone().invert(),ip=index.getWorldPosition(new V()).applyMatrix4(inverse),lp=little.getWorldPosition(new V()).applyMatrix4(inverse),x=ip.clone().sub(lp).normalize(),y=ip.clone().add(lp).normalize(),z=new V().crossVectors(x,y).normalize();y.crossVectors(z,x).normalize();
   const palmLocal=ip.clone().add(lp).multiplyScalar(.36),fingers=[],worldNormal=z.clone().transformDirection(wrist.matrixWorld),sign=i===0?-1:1;
   for(const name of['Thumb','Index','Middle','Ring','Pinky'])for(let j=1;j<=3;j++){
    const bone=root.getObjectByName(side+'Hand'+name+j),child=root.getObjectByName(side+'Hand'+name+(j+1));if(!bone||!child)continue;
    const direction=child.getWorldPosition(new V()).sub(bone.getWorldPosition(new V())).normalize(),axis=new V().crossVectors(direction,worldNormal).normalize().applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()).invert());
    fingers.push({bone,bind:bone.quaternion.clone(),axis,angle:sign*(name==='Thumb'?[.25,.6,.45]:[.80,1.15,.80])[j-1]});
   }
   return{wrist,bind:wrist.quaternion.clone(),parent:sd.bones.indexOf(wrist.parent),palmLocal,palm:palmLocal.clone().multiplyScalar(sd.T.unit),inverseBasis:new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)).invert(),desired:new T.Quaternion(),fingers};
  });
 },
 finishGrip(sd,m){
  for(const hand of m.driverGrip||[]){if(!hand)continue;if(hand.parent>=0)hand.wrist.quaternion.copy(gripQ.copy(sd.O[hand.parent]).invert()).multiply(hand.desired);for(const f of hand.fingers)f.bone.quaternion.copy(f.bind).multiply(gripQ.setFromAxisAngle(f.axis,f.angle));}
 },
 contact(m,i,out){const hand=m.driverGrip?.[i];if(hand)return out.copy(hand.palmLocal).applyMatrix4(hand.wrist.matrixWorld);return out.set(0,-.30,0).applyMatrix4((i===0?m.elbowL:m.elbowR).matrixWorld);},
 proceduralArm(m,i,end){
  const upper=i===0?m.armL:m.armR,lower=i===0?m.elbowL:m.elbowR;
  p.set(i===0?-.25:.25,m.hip.position.y+.51,0);direction.subVectors(end,p);let length=direction.length();direction.normalize();length=U.clamp(length,.02,.589);
  // 팔꿈치는 아래·바깥을 향하고 손목은 핸들 뒤쪽에 닿게 한다.
  bend.set(i===0?-.7:.7,-1,.15);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
  const along=(.29*.29+length*length-.30*.30)/(2*length);elbow.copy(direction).multiplyScalar(along).addScaledVector(bend,Math.sqrt(Math.max(0,.29*.29-along*along)));
  upper.quaternion.setFromUnitVectors(pole.set(0,-1,0),a.copy(elbow).normalize());
  q.setFromUnitVectors(pole,a.copy(direction).multiplyScalar(length).sub(elbow).normalize());lower.quaternion.copy(q2.copy(upper.quaternion).invert()).multiply(q);
 },
 hideHead(m,hide){
  let state=m.driverHead;
  if(!state){const bones=[m.head];if(m.soldier){const i=m.soldier.T.entries.findIndex(e=>e.key==='head');if(i>=0)bones.push(m.soldier.bones[i]);}state=m.driverHead={bones:bones.map(bone=>({bone,scale:bone.scale.clone()})),meshes:m.meshes.map(mesh=>({mesh,culled:mesh.frustumCulled})),hidden:false};}
  if(state.hidden===hide)return;
  for(const r of state.bones)if(hide)r.bone.scale.setScalar(.001);else r.bone.scale.copy(r.scale);
  // 원본의 바인드 자세 경계가 운전 자세를 포함하지 않아 팔까지 잘리는 것을 막는다.
  for(const r of state.meshes)r.mesh.frustumCulled=hide?false:r.culled;
  state.hidden=hide;
 },
 release(m){if(!m)return;this.hideHead(m,false);for(const hand of m.driverGrip||[]){if(!hand)continue;hand.wrist.quaternion.copy(hand.bind);for(const f of hand.fingers)f.bone.quaternion.copy(f.bind);}m.driving=null;m.motion=null;},
 enter(P,v){this.ensure(v);P.vehicleView||='third';P.vehicleLookYaw=0;P.vehicleLookPitch=-.12;P.vehicleNear=G.camera.near;},
 leave(P){if(!P)return;if(P.a?.model)this.release(P.a.model);if(P.vehicleNear!==undefined){G.camera.near=P.vehicleNear;G.camera.updateProjectionMatrix();delete P.vehicleNear;}},
 toggle(P){P.vehicleView=P.vehicleView==='first'?'third':'first';P.vehicleLookYaw=0;P.vehicleLookPitch=-.12;P.orbitYaw=P.vehicle.yaw;P.orbitPitch=-.22;},
 camera(P,dt){
  const v=P.vehicle,s=this.profile(v),cam=G.camera;P.vehicleLookYaw=U.clamp(P.vehicleLookYaw-G.Input.mdx*.0026*P.sens,-1.65,1.65);P.vehicleLookPitch=U.clamp(P.vehicleLookPitch-P.lookY()*.0026*P.sens,-.85,.65);
  cam.position.fromArray(s.eye).applyMatrix4(v.mesh.matrixWorld);cam.quaternion.copy(v.mesh.quaternion).multiply(q.setFromEuler(euler.set(P.vehicleLookPitch,P.vehicleLookYaw,0,'YXZ')));cam.near=.035;
  cam.fov=U.damp(cam.fov,78,10,dt);cam.updateProjectionMatrix();P.orbitYaw=v.yaw+P.vehicleLookYaw;
 }
};
})();
