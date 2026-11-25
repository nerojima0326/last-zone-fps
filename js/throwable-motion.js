// 투척 전용 손 그립·안전핀·상체 궤적. 물체는 IK 목표가 아니라 실제 장갑을 따른다.
(function(){
'use strict';
const G=window.G,T=window.THREE,V=T.Vector3,Q=T.Quaternion,U=G.U;
const _p=new V(),_q=new Q(),_e=new T.Euler(),_ring=new V(),_target=new V(),_world=new V();
const profiles={
 frag:{at:[.14,-.10,-.50],center:[0,-0.006,0.036],shift:0.006,wind:.36,recover:.50,arc:1,fingers:[[0.65,0.58,0.7],[0.55,0.72,0.85],[0.59,0.72,0.85],[0.63,0.74,0.85],[0.65,0.76,0.85]]},
 smoke:{at:[.15,-.075,-.52],center:[0,-0.005,0.043],shift:-0.018,wind:.40,recover:.52,arc:.86,fingers:[[0.65,0.58,0.7],[0.47,0.64,0.76],[0.51,0.64,0.76],[0.55,0.66,0.76],[0.57,0.68,0.76]]},
 flash:{at:[.14,-.085,-.50],center:[-0.006,-0.006,0.014],shift:-0.021,wind:.33,recover:.48,arc:.92,fingers:[[0.65,0.9,0.7],[0.68,0.83,0.95],[0.72,0.83,0.95],[0.76,0.85,0.95],[0.62,0.87,0.95]]},
 molotov:{at:[.14,-.03,-.53],center:[0.004,-0.01,0.007],shift:-0.135,wind:.44,recover:.56,arc:.72,fingers:[[0.65,0.58,0.7],[0.88,0.92,1],[0.92,0.92,1],[0.96,0.94,1],[0.82,0.96,1]]}
};
const fallbackGrips={"frag":{"center":[0,-0.006,0.049],"shift":0.006,"fingers":[[0.65,0.58,0.7],[0.55,0.72,0.85],[0.59,0.72,0.85],[0.63,0.74,0.85],[0.65,0.76,0.85]]},"smoke":{"center":[0,-0.005,0.056],"shift":-0.018,"fingers":[[0.65,0.58,0.7],[0.47,0.64,0.76],[0.51,0.64,0.76],[0.55,0.66,0.76],[0.57,0.68,0.76]]},"molotov":{"center":[0,-0.008,0.007],"shift":-0.115,"fingers":[[0.65,0.9,0.86],[0.88,0.6,1.32],[0.92,0.92,1],[0.8,0.62,1],[0.82,0.8,1]]},"flash":{"center":[-0.006,-0.006,0.033],"shift":-0.027,"fingers":[[0.33,0.9,0.7],[0.68,0.83,0.95],[0.56,0.83,0.95],[0.44,0.85,0.95],[0.46,0.87,0.95]]}};
const align=new Q().setFromRotationMatrix(new T.Matrix4().makeBasis(new V(0,1,0),new V(1,0,0),new V(0,0,-1)));
const neutral=new Q().setFromRotationMatrix(new T.Matrix4().makeBasis(new V(0,1,0),new V(0,0,-1),new V(-1,0,0)));
const leftNeutral=new Q().setFromEuler(new T.Euler(.25,-.25,-.55));
const M=G.ThrowMotion={
 profiles,
 profile(kind){const d=profiles[kind]||profiles.frag;if(G.ThrowModels.has(kind))return d;if(!G.RealArms?.ready)return {...d,...fallbackGrips[kind]};const center=d.center.slice();center[2]+=kind==='frag'?.007:kind==='flash'?.006:0;return {...d,center,shift:kind==='molotov'?-.08:d.shift};},
 skin(arms,on){
  if(arms.throwSkinActive===on)return;
  if(on&&!arms.throwSkins){arms.throwSkins=[];arms.copy.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;const original=mesh.geometry,geometry=original.clone(),indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight,bones=mesh.skeleton.bones;let changed=0;
   const hands=['LeftHand','RightHand'].map(name=>({index:bones.findIndex(b=>b.name===name),members:bones.map(b=>b.name.startsWith(name))}));
   for(let i=0;i<indices.count;i++)for(const hand of hands){if(hand.index<0)continue;let sum=0;for(let j=0;j<4;j++)if(hand.members[indices.getComponent(i,j)])sum+=weights.getComponent(i,j);if(sum<.7)continue;for(let j=0;j<4;j++)if(weights.getComponent(i,j)>0&&!hand.members[indices.getComponent(i,j)]){indices.setComponent(i,j,hand.index);changed++;}}
   indices.needsUpdate=true;arms.throwSkins.push({mesh,original,geometry,changed});
  });}
  for(const s of arms.throwSkins||[])s.mesh.geometry=on?s.geometry:s.original;arms.throwSkinActive=on;
 },
 disposeSkin(arms){this.skin(arms,false);for(const s of arms.throwSkins||[])s.geometry.dispose();arms.throwSkins=null;arms.throwSkinActive=false;const m=G.VM?.models?.throw;if(m){m.pinSource=null;m.pinPads=null;m.pinMeshes=null;}},
 ringGripPoint(pin){
  const g=pin.geometry,p=g.attributes.position,index=g.index,vertices=[],parents=[],ids=[],keys=new Map(),root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i]}return i;};
  for(let i=0;i<p.count;i++){const v=new V().fromBufferAttribute(p,i),key=v.toArray().map(x=>Math.round(x*1e5)).join(',');if(!keys.has(key)){keys.set(key,vertices.length);parents.push(vertices.length);vertices.push(v)}ids.push(keys.get(key));}
  for(let i=0;i<(index?index.count:p.count);i+=3){const a=root(ids[index?index.getX(i):i]);parents[root(ids[index?index.getX(i+1):i+1])]=a;parents[root(ids[index?index.getX(i+2):i+2])]=a;}
  const groups=new Map();vertices.forEach((v,i)=>{const id=root(i),group=groups.get(id)||{n:0,box:new T.Box3()};group.n++;group.box.expandByPoint(v);groups.set(id,group)});const box=[...groups.values()].sort((a,b)=>b.n-a.n)[0].box,grip=box.getCenter(new V());grip.y=box.max.y+(box.max.y-box.min.y)*.03;return grip;
 },
 timing(kind,under=false){const d=profiles[kind]||profiles.frag;return {release:under?d.wind*.85:d.wind,duration:(under?d.wind*.85:d.wind)+d.recover};},
 setup(m){
  m.type='throw';m.grip=m.parts.hand;m.grip.position.set(0,0,0);m.grip.rotation.set(0,0,0);m.grip.userData.keep=true;m.pinCarry=new T.Group();m.pinCarry.userData.keep=true;m.root.add(m.pinCarry);m.pins={};
  if(m.pinFree)m.pinFree.removeFromParent();m.pinFree=null;
  for(const [side,r]of Object.entries(m.staticArms)){
   m.root.add(r.grp);r.grp.position.set(0,0,0);r.grp.quaternion.identity();r.baseS.set(side==='R'?.23:-.24,-.28,side==='R'?-.09:-.06);r.S.copy(r.baseS);r.motionWeight=.65;r.contactMode=side==='R'?'grip':'palm';
   r.rest.set(side==='R'?.14:-.23,side==='R'?-.18:-.35,-.50);r.cur.copy(r.rest);r.tgt.copy(r.rest);r.handReady=false;
   const prefix=side==='R'?'Right':'Left';r.bW.name=prefix+'Hand';for(let f=0;f<4;f++)for(let i=0;i<3;i++)r.fing[f][i].name=prefix+'Hand'+['Index','Middle','Ring','Pinky'][f]+(i+1);for(let i=0;i<3;i++)r.thumbB[i].name=prefix+'HandThumb'+(i+1);
  }
  for(const [kind,item]of Object.entries(m.items)){
   const pin=item.userData.pin;if(!pin)continue;
   // 고리는 보조 손 쪽으로 드러내고, 실제 고리의 윗부분을 집는다.
   const turn=new Q().setFromAxisAngle(new V(0,1,0),Math.PI);pin.position.applyQuaternion(turn);pin.quaternion.premultiply(turn);pin.updateMatrix();
   const ringLocal=this.ringGripPoint(pin),copy=pin.clone();copy.visible=false;copy.userData.keep=true;copy.position.copy(ringLocal).multiply(copy.scale).applyQuaternion(copy.quaternion).negate();m.pinCarry.add(copy);m.pins[kind]=copy;
   item.updateWorldMatrix(true,true);item.userData.ring=item.worldToLocal(pin.localToWorld(ringLocal.clone()));
  }
  m.throwFrame={pin:0,open:0,hold:0,release:false};this.select(m,'frag');
 },
 select(m,kind){
  m.throwKind=kind;m.throwProfile=this.profile(kind);m.drawT=0;m.snap=true;
  for(const [k,item]of Object.entries(m.items)){item.visible=k===kind;const d=this.profile(k);item.position.copy(new V(...d.center).applyQuaternion(align.clone().invert()));item.position.y+=d.shift;if(item.userData.pin)item.userData.pin.visible=true;}
  for(const pin of Object.values(m.pins))pin.visible=false;
 },
 // 인접 키의 기울기로 위치·회전 속도를 이어 가속과 후속 동작이 끊기지 않게 한다.
 sample(keys,t,out){
  let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;const a=keys[i],b=keys[i+1],prev=keys[Math.max(0,i-1)],next=keys[Math.min(keys.length-1,i+2)],h=b[0]-a[0],u=U.clamp((t-a[0])/h,0,1),u2=u*u,u3=u2*u;
  for(let k=1;k<=6;k++){const ma=i===0?0:(b[k]-prev[k])/(b[0]-prev[0]),mb=i===keys.length-2?0:(next[k]-a[k])/(next[0]-a[0]);out[k-1]=(2*u3-3*u2+1)*a[k]+(u3-2*u2+u)*h*ma+(-2*u3+3*u2)*b[k]+(u3-u2)*h*mb;}return out;
 },
 poseVM(vm,m,dt,s){
  const A=m.staticArms,R=A.R,d=m.throwProfile,F=m.throwFrame,state=s.throwState;m.drawT+=dt;F.pin=s.pinP||0;F.hold=state?.phase==='hold'?U.smoothstep(0,.20,state.holdT):state?1:0;F.release=!!state?.released;F.open=0;
  const xyz=m.throwSample||(m.throwSample=new Float64Array(6));xyz.fill(0);
  if(state?.phase==='throw'){
   const t=Math.max(0,state.t-(state.prep||0)),release=state.releaseAt-(state.prep||0),end=state.duration-(state.prep||0),u=U.clamp(t/release,0,1),tail=U.clamp((t-release)/(end-release),0,1);
   const keys=state.under?[[0,0,0,0,0,0,0],[.58,.04,-.10,.045,-.35,0,.12],[1,-.025,.005,-.13,.35,-.08,-.12],[1.5,-.07,.055,-.15,.70,-.12,-.18],[2.5,.04,-.34,.04,0,0,0],[3,.04,-.34,.04,0,0,0]]:[[0,0,0,0,0,0,0],[.48,.075,.12,.10,.55,.16,.12],[.78,.095,.18,.095,.82,.20,.04],[1,-.01,.05,-.14,-.65,-.13,-.22],[1.5,-.09,-.08,-.17,-.95,-.22,-.40],[2.5,.04,-.34,.04,0,0,0],[3,.04,-.34,.04,0,0,0]];
   this.sample(keys,t<=release?u:1+tail*2,xyz);for(let k=3;k<6;k++)xyz[k]*=d.arc;
   F.open=state.released?U.smoothstep(release,release+.10,t):0;if(state.t<(state.prep||0)){xyz.fill(0);F.open=0;}
  }else if(!state){const draw=U.smoothstep(0,.32,m.drawT);xyz[0]=.04*(1-draw);xyz[1]=-.34*(1-draw);xyz[2]=.04*(1-draw);}
  F.open=U.clamp(F.open,0,1);R.throwJoint=d.fingers;R.throwOpen=F.open;R.contactMode='grip';R.curl=R.trig=.9*(1-F.open);R.thumb=.72*(1-F.open);
  _p.set(...d.at).add(_target.set(xyz[0],xyz[1],xyz[2]));_q.copy(neutral).premultiply(new Q().setFromEuler(_e.set(xyz[3],xyz[4],xyz[5])));
  if(m.snap){R.cur.copy(_p);R.handReady=false;R.framesReady=false;R.bendReady=false;}
  G.Guns.poseStaticArm(R,_p,_q,dt,R.curl,R.thumb);m.grip.matrixAutoUpdate=true;m.grip.scale.setScalar(1);m.grip.position.copy(R.contact);m.grip.quaternion.copy(R.handQ).multiply(align);m.grip.updateWorldMatrix(true,true);
  const item=m.items[m.throwKind];item.visible=!F.release;const pin=item.userData.pin;if(pin)pin.visible=F.pin<.55;
  if(!G.RealArms?.ready)this.poseLeft(m,dt);
  m.root.position.set(Math.sin(s.phase)*.006*s.moving,Math.sin(vm.t*1.6)*.0015-s.landDip*.035-(1-s.raise)*.18,0);m.root.rotation.set(-(1-s.raise)*.40-vm.sprint*.12,vm.sway.x,vm.sway.y);m.root.position.y-=vm.sprint*.04;
  const flame=m.items.molotov.userData.flame;if(flame)flame.scale.set(1+Math.sin(vm.t*25)*.12,1.7+Math.sin(vm.t*31)*.2,1);vm.flashLight.intensity=0;vm.flashT=0;vm.camRX=vm.camRY=vm.camRZ=0;m.snap=false;
 },
 poseLeft(m,dt){
  const L=m.staticArms.L,F=m.throwFrame,item=m.items[m.throwKind],pp=F.pin;let pinch=0;_target.set(-.23,-.35,-.42);_q.copy(leftNeutral);
  if(m.throwKind!=='molotov'&&pp>0&&pp<1&&item.userData.ring){
   m.root.updateWorldMatrix(true,true);_ring.copy(item.userData.ring);item.localToWorld(_ring);m.root.worldToLocal(_ring);
   const reach=U.smoothstep(0,.30,pp)*(1-U.smoothstep(.83,1,pp)),pull=U.smoothstep(.55,.80,pp);_ring.add(_p.set(-.15*pull,.025*pull,.065*pull));_target.lerp(_ring,reach);pinch=reach;
   _q.slerp(new Q().setFromEuler(new T.Euler(...(m.throwProfile.pinTurn||[-.12,.7,-1.15]))),reach);
  }else if(m.throwKind==='molotov')_target.lerp(_p.set(-.16,-.23,-.43),F.hold*(1-F.open)*.45);
  L.contactMode=pinch>.35?'button':'palm';L.throwOpen=0;L.throwJoint=[[.45,.55,.65],[.18,.50,1.35],[1.15,1.3,1.2],[1.2,1.3,1.25],[1.25,1.3,1.25]];
  G.Guns.poseStaticArm(L,_target,_q,dt,.55,.6);this.pin(m,L.contact,L.handQ);
 },
 pin(m,point,rotation){
  m.pinCarry.position.copy(point);m.pinCarry.quaternion.copy(rotation);for(const [kind,pin]of Object.entries(m.pins)){pin.visible=kind===m.throwKind&&m.throwFrame.pin>=.55&&m.throwFrame.pin<.91;}
 },
 fitRealPin(m,r,S,arms){
  const F=m.throwFrame,pp=F.pin,weight=U.smoothstep(.12,.32,pp)*(1-U.smoothstep(.82,.98,pp)),item=m.items[m.throwKind];
  if(!item.userData.ring||weight<=0)return;
  // 실제 검지 끝 장갑 표면으로 고리 윗부분을 건다. 뼈 끝이나 두 손가락의 가상 중점은 쓰지 않는다.
  if(m.pinSource!==S.b.hand){m.pinSource=S.b.hand;m.pinPads=[];const tip=S.b.fingers.Index.at(-1);arms.copy.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const bone=mesh.skeleton.bones.indexOf(tip),g=mesh.geometry;if(bone<0)return;for(let i=0;i<g.attributes.position.count;i+=2)for(let j=0;j<4;j++)if(g.attributes.skinIndex.getComponent(i,j)===bone&&g.attributes.skinWeight.getComponent(i,j)>.98){m.pinPads.push({mesh,i});break;}});m.pinMeshes=[...new Set(m.pinPads.map(p=>p.mesh))];}
  _world.copy(item.userData.ring);item.localToWorld(_world);m.root.worldToLocal(_world);_world.add(_p.set(-.15,.025,.065).multiplyScalar(U.smoothstep(.55,.8,pp)));
  const inv=m.root.matrixWorld.clone().invert();let closest=null,distance=Infinity;
  for(const mesh of m.pinMeshes)mesh.skeleton.update();for(const ref of m.pinPads){ref.mesh.getVertexPosition(ref.i,_target).applyMatrix4(ref.mesh.matrixWorld).applyMatrix4(inv);const d=_target.distanceToSquared(_world);if(d<distance){distance=d;closest=ref;}}
  if(!closest)return;closest.mesh.getVertexPosition(closest.i,_target).applyMatrix4(closest.mesh.matrixWorld).applyMatrix4(inv);r.contact.add(_world.sub(_target).multiplyScalar(weight));arms.drive(m,r,S,false);
  closest.mesh.skeleton.update();closest.mesh.getVertexPosition(closest.i,_target).applyMatrix4(closest.mesh.matrixWorld).applyMatrix4(inv);this.pin(m,_target,r.handQ);
 },
 fitRealGrip(m,r,S,unit){
  const f=m.realThrowGrip||(m.realThrowGrip={matrix:new T.Matrix4(),turn:new T.Matrix4(),at:new T.Matrix4(),scale:new T.Matrix4(),q:new Q(),p:new V()});S.b.hand.updateWorldMatrix(true,false);m.root.updateWorldMatrix(true,false);
  const ratio=S.palmLen*unit/(G.ARM_CONST.middleBase*G.ARM_CONST.handS);f.p.copy(r.anchorLocal).multiplyScalar(G.ARM_CONST.handS*ratio);
  f.matrix.copy(m.root.matrixWorld).invert().multiply(S.b.hand.matrixWorld).multiply(f.turn.makeRotationFromQuaternion(f.q.copy(S.handInv).invert())).multiply(f.scale.makeScale(1/unit,1/unit,1/unit)).multiply(f.at.makeTranslation(f.p.x,f.p.y,f.p.z)).multiply(f.turn.makeRotationFromQuaternion(align));
  m.grip.matrixAutoUpdate=false;m.grip.matrix.copy(f.matrix);m.grip.matrix.decompose(m.grip.position,m.grip.quaternion,m.grip.scale);m.grip.updateMatrixWorld(true);
 },
 launchPoint(vm,cam,out){
  const m=vm.models.throw,item=m.items[m.throwKind];item.updateWorldMatrix(true,false);out.set(0,0,0).applyMatrix4(item.matrixWorld);const k=Math.tan(T.MathUtils.degToRad(cam.fov/2))/Math.tan(T.MathUtils.degToRad(G.vmCamera.fov/2));out.x*=k;out.y*=k;return out.applyMatrix4(cam.matrixWorld);
 }
};
})();
