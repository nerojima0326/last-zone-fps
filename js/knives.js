// knives.js — 칼 6종의 손잡이 접점, 꺼내기·베기·찌르기, 발리송 관절과 근접 타격
(function(){
'use strict';
const G=window.G,T=window.THREE,U=G.U,V=T.Vector3,Q=T.Quaternion;
const catalog={
 knife_butterfly:{file:'butterfly',name:'버터플라이 나이프',short:'발리송',dmg:40,reach:1.75,duration:.61,draw:.68,inspect:3.1,role:'접이식 손잡이와 가벼운 베기가 특징인 버터플라이 나이프'},
 knife_dagger:{file:'dagger',name:'양날 단검',short:'단검',dmg:52,reach:1.85,duration:.73,inspect:2.65,role:'곧은 양날 칼날과 가드가 있는 단검'},
 knife_combat:{file:'combat',name:'전투 나이프',short:'전투 나이프',dmg:46,reach:1.8,duration:.64,inspect:2.65,role:'튼튼한 손잡이와 가드를 갖춘 전투용 나이프'},
 knife_karambit:{file:'karambit',name:'카람빗',short:'카람빗',dmg:42,reach:1.65,duration:.56,inspect:2.65,role:'손가락 고리와 안쪽으로 휜 칼날을 갖춘 카람빗'},
 knife_kunai:{file:'kunai',name:'쿠나이',short:'쿠나이',dmg:38,reach:1.7,duration:.54,inspect:2.65,role:'고리 손잡이와 짧고 뾰족한 칼날을 갖춘 쿠나이'},
 knife_machete:{file:'machete',name:'마체테',short:'마체테',dmg:62,reach:2.05,duration:.88,inspect:2.65,role:'긴 칼날을 넓게 휘두르는 무거운 마체테'}
};
// 장갑의 실제 스킨 메시로 맞춘 손잡이 접점과 엄지→새끼손가락의 마디별 굽힘.
const grips={
 knife_butterfly:{roll:-0.25,twist:0.6,at:[0,0.04,0],fingers:[[0.78,0.62,0.75],[0.07,0.4,1.4],[0.07,0.8,1.15],[0.42,0.58,1.55],[0.25,0.58,1]]},
 knife_dagger:{roll:-0.25,twist:0.6,at:[0.015,0.03,0],fingers:[[0.07,0.58,1.55],[0.43,0.98,1.55],[0.43,0.8,1.25],[0.78,0.8,1.25],[0.78,1.02,1.15]]},
 knife_combat:{roll:-0.25,twist:0,at:[0.015,0.02,0],turns:{0:[0,0,-.2]},fingers:[[0.25,0.4,1.55],[0.6,0.98,1.25],[0.78,0.8,1.25],[1,1,1],[1,0.8,1.25]]},
 knife_karambit:{roll:-0.65,twist:0,at:[0,0.03,0],fingers:[[1,0.98,0.85],[0.07,1.6,1],[0.07,0.22,1.55],[0.6,1.2,1.55],[0.43,0.8,1.15]]},
 knife_kunai:{roll:-0.25,twist:0,at:[0,0.02,0],fingers:[[0.43,1.2,1.55],[0.25,1.2,1.15],[1,0.8,1.4],[0.78,1.02,1.15],[0.43,1.02,1]]},
 knife_machete:{roll:-0.25,twist:0,at:[0.013,0.022,0],fingers:[[0.07,0.8,1.55],[0.6,0.98,1.25],[0.78,0.8,1.4],[0.78,1.02,1.15],[0.78,1.02,1.15]]}
};
// 네트워크에서 모델을 받지 못해도 기본 손잡이를 같은 자세로 쥔다.
const fallbackGrip={...grips.knife_dagger,fingers:[[.6,.22,1.55],[.43,.8,1.55],[.43,.8,1.25],[.82,.58,1.55],[.6,.8,1]]};
for(const [id,d]of Object.entries(catalog)){d.id=id;G.WEAPONS[id]={key:id,name:d.name,short:d.short,dmg:d.dmg,rpm:60/d.duration,melee:true};}
const ids=Object.keys(catalog),_p=new V(),_d=new V(),_eye=new V(),_forward=new V(),_q=new Q(),_q2=new Q(),_e=new T.Euler();
const K=G.Knives={catalog,ids,templates:{},motion:null,ready:false,loaded:0,
 is(id){return !!catalog[id]},
 async load(renderer){
  if(location.protocol==='file:'||!T.GLTFLoader)return;
  const loader=new T.GLTFLoader();if(T.MeshoptDecoder)loader.setMeshoptDecoder(T.MeshoptDecoder);
  const base='assets/models/knives/',tag='?v='+(window.LZ_BUILD||'');
  await Promise.allSettled([
   fetch(base+'motion.json'+tag).then(r=>{if(!r.ok)throw Error('모션 없음');return r.json()}).then(j=>{this.motion=j.clips}),
   ...ids.map(async id=>{
    try{
     const model=await loader.loadAsync(base+catalog[id].file+'.glb'+tag),root=model.scene;
     root.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;for(const mat of Array.isArray(o.material)?o.material:[o.material])for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(mat[key])mat[key].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());});
     root.userData.imported=true;this.templates[id]=root;this.loaded++;
    }catch(e){console.info('[칼] '+catalog[id].name+' 기본 모델 사용');}
   })
  ]);this.ready=this.loaded===ids.length&&!!this.motion;
 },
 fallback(id){
  const root=new T.Group(),d=catalog[id],steel=new T.MeshStandardMaterial({color:0x9caeb6,metalness:.85,roughness:.3}),grip=new T.MeshStandardMaterial({color:0x202b25,roughness:.8});
  const box=(w,h,z,mat,x,y,parent=root)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,z),mat);m.position.set(x,y,0);parent.add(m);return m};
  if(d.file==='butterfly'){
   for(const [name,x]of [['safeHandle',-.011],['biteHandle',.011]]){const p=new T.Group();p.name=name;p.position.set(x,.065,0);root.add(p);box(.012,.126,.010,grip,0,-.062,p);}
   const p=new T.Group();p.name='blade';p.position.y=.065;root.add(p);box(.023,.12,.0039,steel,0,.06,p);
  }else{
   box(.020,.11,.016,grip,0,-.005);box(.045,.010,.014,steel,0,.060);
   const long=d.file==='machete'?.29:.15,shape=new T.Shape(),curve=d.file==='karambit';
   shape.moveTo(-.014,.055);shape.lineTo(curve?-.065:-.014,.055+long*.65);shape.lineTo(curve?-.07:0,.055+long);shape.lineTo(.016,.055+long*.72);shape.lineTo(.016,.055);shape.closePath();
   root.add(new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.005,bevelEnabled:false}),steel));
  }
  root.userData.imported=false;return root;
 },
 model(id){if(!this.templates[id])this.templates[id]=this.fallback(id);return this.templates[id].clone(true)},
 buildVM(id){
  const m=G.Guns.buildHands('fists');m.type='knife';m.id=id;m.cls='melee';m.knife=this.model(id);m.grip=new T.Group();m.grip.add(m.knife);m.root.add(m.grip);
  if(id==='knife_machete'&&m.knife.userData.imported)m.knife.scale.setScalar(.82);
  // 칼의 길이 축을 손가락 진행 방향이 아닌 검지와 새끼손가락을 잇는 가로축에 맞춘다.
  const profile=m.knifeProfile=this.gripProfile(id,m.knife.userData.imported),turn=new Q().setFromAxisAngle(new V(0,0,1),profile.roll).multiply(new Q().setFromAxisAngle(new V(0,1,0),profile.twist));
  m.bladeOffset=new Q().setFromRotationMatrix(new T.Matrix4().makeBasis(new V(0,1,0),new V(1,0,0),new V(0,0,-1))).multiply(turn);
  m.neutral=new Q().setFromEuler(new T.Euler(-.42,2,-.24)).multiply(turn);m.handOffset=m.bladeOffset.clone().invert();
  m.knife.position.copy(this.gripOffset(id,m.bladeOffset,m.knife.userData.imported));m.knifeRest=m.knife.position.clone();m.hinges=this.rig(m.knife);
  m.parts.left.position.set(0,0,0);m.parts.right.position.set(0,0,0);m.baseHands={};
  for(const [side,r]of Object.entries(m.staticArms)){
   r.baseS.set(side==='R'?.20:-.24,side==='R'?-.25:-.29,side==='R'?-.08:-.05);r.S.copy(r.baseS);r.rest.set(side==='R'?.13:-.20,side==='R'?-.13:-.25,-.48);r.cur.copy(r.rest);r.tgt.copy(r.rest);r.contactMode='grip';r.motionWeight=.5;
   m.baseHands[side]=side==='R'?m.neutral.clone().multiply(m.handOffset):r.handQ.clone();
   const prefix=side==='R'?'Right':'Left';r.bW.name=prefix+'Hand';
   for(let f=0;f<4;f++)for(let i=0;i<3;i++)r.fing[f][i].name=prefix+'Hand'+['Index','Middle','Ring','Pinky'][f]+(i+1);
   for(let i=0;i<3;i++)r.thumbB[i].name=prefix+'HandThumb'+(i+1);
  }
  m.muzzle.set(0,.15,0);m.curve={r:new V(),l:new V(),q:new Q(),e:new T.Euler()};m.root.userData.knife=id;return m;
 },
 gripProfile(id,imported=true){return !imported&&id!=='knife_butterfly'?fallbackGrip:grips[id]},
 gripOffset(id,frame,imported=true){
  return new V(...this.gripProfile(id,imported).at).applyQuaternion(frame.clone().invert());
 },
 rig(root){
  if(root._knifeHinges)return root._knifeHinges;
  const safe=root.getObjectByName('safeHandle'),bite=root.getObjectByName('biteHandle'),blade=root.getObjectByName('blade');
  if(!safe||!bite||!blade)return {};
  // 두 번째 핀은 칼날 탱에 붙어 움직인다. 세 부품을 제자리에서 따로 돌리면 경첩이 분리된다.
  const tang=new T.Group();tang.name='knifeTang';tang.position.copy(safe.position);root.add(tang);
  blade.position.sub(safe.position);bite.position.sub(safe.position);tang.add(blade,bite);
  return root._knifeHinges={safe,tang,blade,bite};
 },
 sample(kind,t,out,id='knife_butterfly'){
  out.r.set(0,0,0);out.l.set(0,0,0);out.q.identity();out.curl=.9;out.thumb=.72;
  if(kind==='idle')return out;
  const butterfly=id==='knife_butterfly',heavy=id==='knife_machete',thrust=id==='knife_dagger'||id==='knife_kunai',hook=id==='knife_karambit';
  // [진행률, 손의 x/y/z, 칼의 피치/요/롤]. 타격 판정(.43)에 칼의 전진이 맞는다.
  let keys;
  if(kind==='draw')keys=butterfly?
   [[0,.07,-.22,.10,.35,0,-.5],[.20,.035,-.055,.015,-.12,-.18,-.35],[.48,-.015,.025,-.025,-.3,.25,.25],[.76,.015,.015,0,.10,-.12,-.12],[1,0,0,0,0,0,0]]:
   [[0,.08,-.26,.12,.7,.12,-.55],[.65,.012,.02,-.02,-.12,-.12,.10],[1,0,0,0,0,0,0]];
  else if(kind==='slash')keys=thrust?
   [[0,0,0,0,0,0,0],[.20,.035,-.035,.065,.32,.12,-.18],[.43,-.045,.025,-.19,-.8,-.15,.10],[.62,-.055,.015,-.13,-.55,-.12,.18],[1,0,0,0,0,0,0]]:
   [[0,0,0,0,0,0,0],[.20,.075,.065,.045,-.20,.3,-.60],[.43,-.085,-.005,-.15,-.55,-.24,hook?1.2:.92],[.65,heavy?-.19:-.135,-.095,-.055,.15,-.4,heavy?1.45:1.12],[1,0,0,0,0,0,0]];
  else keys=[[0,0,0,0,0,0,0],[.22,-.10,.075,-.015,-.10,-.65,.35],[.50,-.12,.085,-.015,.05,.85,.55],[.78,-.075,.06,0,.12,-.45,.2],[1,0,0,0,0,0,0]];
  let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
  const a=keys[i],b=keys[i+1],u=U.smoothstep(a[0],b[0],t);
  out.r.set(U.lerp(a[1],b[1],u),U.lerp(a[2],b[2],u),U.lerp(a[3],b[3],u));
  out.q.setFromEuler(_e.set(a[4],a[5],a[6])).slerp(_q2.setFromEuler(out.e.set(b[4],b[5],b[6])),u);
  // 펼친 칼을 허리 아래에서 들어 올린다. 꺼내기·검사 중에도 손잡이를 놓지 않는다.
  // 공격하는 칼과 왼손이 교차하지 않도록 왼손을 몸 쪽으로 거둔다.
  if(kind==='slash')out.l.set(-.025,-.065,.055).multiplyScalar(Math.sin(t*Math.PI)**2);
  return out;
 },
 fitRealGrip(m,r,S,unit){
  // IK 목표가 아니라 화면에 보이는 실제 손 뼈의 완전한 변환을 따른다.
  // 아래팔의 비균일 스케일도 보존해 팔을 비틀 때 손잡이가 장갑 안으로 미끄러지지 않는다.
  const f=m.realGrip||(m.realGrip={matrix:new T.Matrix4(),turn:new T.Matrix4(),at:new T.Matrix4(),scale:new T.Matrix4(),q:new Q(),p:new V()});
  S.b.hand.updateWorldMatrix(true,false);m.root.updateWorldMatrix(true,false);
  const ratio=S.palmLen*unit/(G.ARM_CONST.middleBase*G.ARM_CONST.handS);
  f.p.copy(r.anchorLocal).multiplyScalar(G.ARM_CONST.handS*ratio);
  f.matrix.copy(m.root.matrixWorld).invert().multiply(S.b.hand.matrixWorld).multiply(f.turn.makeRotationFromQuaternion(f.q.copy(S.handInv).invert())).multiply(f.scale.makeScale(1/unit,1/unit,1/unit)).multiply(f.at.makeTranslation(f.p.x,f.p.y,f.p.z)).multiply(f.turn.makeRotationFromQuaternion(m.bladeOffset));
  m.grip.matrixAutoUpdate=false;m.grip.matrix.copy(f.matrix);m.grip.matrix.decompose(m.grip.position,m.grip.quaternion,m.grip.scale);m.grip.updateMatrixWorld(true);
 },
 actionCurve(action,id,out){
  const t=action?U.clamp(action.t/action.duration,0,1):0,c=this.sample(action?.kind||'idle',t,out,id);
  if(action?.blendFrom){
   const f=action.blendFrom,w=1-U.smoothstep(0,.24,t);c.r.lerp(f.r,w);c.l.lerp(f.l,w);c.q.slerp(f.q,w);c.curl=U.lerp(c.curl,f.curl,w);c.thumb=U.lerp(c.thumb,f.thumb,w);
  }
  return c;
 },
 poseVM(vm,m,dt,s){
  const c=this.actionCurve(s.melee,m.id,m.curve),R=m.staticArms.R,L=m.staticArms.L;
  // 칼을 바꿔 들 때도 해당 손잡이에 맞는 굽힘을 바로 적용해 장갑이 그립 안으로 지나가지 않게 한다.
  R.curl=R.trig=c.curl;R.thumb=c.thumb;
  _p.copy(R.rest).add(c.r);_q.copy(m.neutral).multiply(c.q).multiply(m.handOffset);
  G.Guns.poseStaticArm(R,_p,_q,dt,c.curl,c.thumb);
  _p.copy(L.rest).add(c.l);_q.copy(m.baseHands.L);G.Guns.poseStaticArm(L,_p,_q,dt,.7,.6);
  m.grip.matrixAutoUpdate=true;m.grip.scale.setScalar(1);m.grip.position.copy(R.contact);m.grip.quaternion.copy(R.handQ).multiply(m.bladeOffset);
  this.poseHinges(m.hinges);
  m.knife.position.copy(m.knifeRest);m.knife.quaternion.identity();
  m.root.position.set(Math.sin(s.phase)*.008*s.moving,Math.sin(vm.t*1.7)*.002-s.landDip*.04-(1-s.raise)*.22,0);
  m.root.rotation.set(-(1-s.raise)*.55-vm.sprint*.12,vm.sway.x,vm.sway.y);
  m.root.position.y-=vm.sprint*.055;m.root.rotation.z+=vm.sprint*.12;
  vm.flashLight.intensity=0;vm.camRX=vm.camRY=vm.camRZ=0;
 },
 poseHinges(h){
  // 전개된 발리송의 두 손잡이와 칼날은 사용 중 잠긴 상태를 유지한다.
  if(h.tang){h.tang.rotation.z=0;h.bite.rotation.z=0;}
 },
 cycle(p){
  const a=p.a;if(a.state!=='ground'||a.knocked||p.vehicle||p.throwSt)return false;
  if(a.cur==='melee')a.knife=ids[(ids.indexOf(a.knife)+1)%ids.length];
  else p.switchTo('melee');return true;
 },
 start(p,kind){
  const a=p.a,d=catalog[a.knife];
  if(!d||a.cur!=='melee'||a.state!=='ground'||!a.alive||a.knocked||p.sw||p.throwSt||p.heal||p.revive||p.vehicle||p.sprinting)return false;
  if(kind==='inspect'&&p.melee&&p.melee.kind!=='inspect')return false;
  let blendFrom;
  if(kind==='slash'&&p.melee?.kind==='inspect'){
   blendFrom=this.sample('inspect',U.clamp(p.melee.t/p.melee.duration,0,1),{r:new V(),l:new V(),q:new Q(),e:new T.Euler()},a.knife);
  }
  p.melee={id:a.knife,kind,t:0,duration:kind==='slash'?d.duration:kind==='draw'?(d.draw||.58):d.inspect,hit:false,sounds:0,blendFrom};a.melee=p.melee;
  if(kind==='slash'){p.nextFire=p.time+d.duration;G.Audio.click('punch');if(G.Training?.active)p.melee.shot=G.Training.onShot();}
  else G.Audio.click('switch');return true;
 },
 tick(p,dt){
  const a=p.a;
  if(a.cur!=='melee'||!a.alive||a.knocked||a.state!=='ground'||p.vehicle){p.melee=null;a.melee=null;p.knifeSeen=null;return;}
  if(p.knifeSeen!==a.knife){p.knifeSeen=a.knife;p.melee={id:a.knife,kind:'draw',t:0,duration:catalog[a.knife].draw||.58,hit:false,sounds:0};a.melee=p.melee;}
  if(p.heal||p.revive||p.throwSt||p.sprinting){p.melee=null;a.melee=null;return;}
  const I=G.Input;
  if((I.hit('KeyT')||I.rmbHit)&&!p.melee)this.start(p,'inspect');
  if(I.lmb&&!p.sw&&p.time>=p.nextFire&&(!p.melee||p.melee.kind==='inspect'))this.start(p,'slash');
  const action=p.melee;if(!action)return;
  action.t+=dt;
  if(action.kind==='slash'&&!action.hit&&action.t>=action.duration*.43){action.hit=true;this.hit(p,action);}
  if(action.t>=action.duration){p.melee=null;a.melee=null;}
 },
 hit(p,action){
  const a=p.a,d=catalog[action.id];if(a.cur!=='melee'||a.knife!==action.id||!a.alive)return;
  a.eye(_eye);a.lookDir(_forward);let target=null,best=d.reach;
  for(const b of G.Game.actors){
   if(!b.alive||b.team===a.team||b.state!=='ground')continue;
   b.chest(_p);_d.copy(_p).sub(_eye);const dist=_d.length();
   if(dist>best||dist<.02||_d.divideScalar(dist).dot(_forward)<.76)continue;
   if(G.World.raycast(_eye,_d,Math.max(.01,dist-.06)))continue;
   target=b;best=dist;
  }
  if(target){
   target.chest(_p);_d.copy(_p).sub(_eye).normalize();G.Game.damage(target,d.dmg,a,action.id,false,_p,_d);G.FX.blood(_p,_d.x,_d.y,_d.z,5);G.Audio.impact(_p,'flesh');return;
  }
  if(G.Training?.active){
   const hit=G.Training.hitTest(_eye,_forward,d.reach);
   if(hit&&!G.World.raycast(_eye,_forward,Math.max(.01,hit.t-.03))){
    _p.copy(_eye).addScaledVector(_forward,hit.t);G.Training.onHit(hit,d.dmg,_p,_forward,action.shot||{hit:false});G.Audio.impact(_p,'metal');return;
   }
  }
  const wall=G.World.raycast(_eye,_forward,d.reach);
  if(wall){const mat=G.World.hit.mat||'concrete';_p.copy(G.World.hit.point);_d.copy(G.World.hit.normal);G.Audio.impact(_p,mat);G.FX.impact(_p,_d,mat);}
 },
 equip(p,id){
  if(!this.is(id)||!p.a?.alive||p.a.knocked||p.a.state!=='ground'||p.throwSt||p.vehicle)return false;p.a.knife=id;p.reload=p.autoReload=null;p.melee=null;p.knifeSeen=null;
  p.switchTo('melee');return true;
 },
 poseTP(m,a){
  const action=a.melee,c=m.knifeCurve||(m.knifeCurve={r:new V(),l:new V(),q:new Q(),e:new T.Euler()}),t=action?U.clamp(action.t/action.duration,0,1):0;
  this.actionCurve(action,a.knife||m.curGun,c);c.e.setFromQuaternion(c.q);m.gunMount.position.set(.24+c.r.x*.6,-.14+c.r.y*.6,-.34+c.r.z*.6);
  m.armL.rotation.set(.75+c.l.z,0,.15);m.elbowL.rotation.x=.8;
  m.armR.rotation.set(1.2-c.r.z*3.5+c.e.x*.25,c.r.x*3+c.e.y*.3,-.2+c.r.y*2+c.e.z*.45);m.elbowR.rotation.x=.6+c.r.z*2-c.e.x*.15;m.ikGun='knife';
  const knife=m.guns[m.curGun];if(knife){
   knife.rotation.set(-.25,0,-.27-(action?.kind==='slash'?Math.sin(t*Math.PI)*1.0:0));
   const hinges=knife._hinges||(knife._hinges=this.rig(knife));this.poseHinges(hinges);
  }
 },
 handTP(m,active,action){
  const root=m.soldier?.root;if(!root)return;
  let hand=m.knifeHand;
  if(!active){if(hand?.active){for(const f of hand.fingers)f.bone.quaternion.copy(f.bind);hand.active=false;}return;}
  if(m.lod)return;
  const knife=m.guns[m.curGun];if(!knife)return;
  m.root.updateMatrixWorld(true);
  if(!hand){
   const wrist=root.getObjectByName('RightHand'),index=root.getObjectByName('RightHandIndex1'),little=root.getObjectByName('RightHandPinky1');
   if(!wrist||!index||!little)return;
   const inv=wrist.matrixWorld.clone().invert(),ip=index.getWorldPosition(new V()).applyMatrix4(inv),lp=little.getWorldPosition(new V()).applyMatrix4(inv);
   const y=ip.clone().sub(lp).normalize(),n=new V().crossVectors(ip,lp).normalize(),palm=ip.clone().add(lp).multiplyScalar(.36).addScaledVector(n,.018),fingers=[];
   for(const name of ['Index','Middle','Ring','Pinky'])for(let i=1;i<=3;i++){
    const bone=root.getObjectByName('RightHand'+name+i),child=root.getObjectByName('RightHand'+name+(i+1));if(!bone||!child)continue;
    const dir=child.getWorldPosition(new V()).sub(bone.getWorldPosition(new V())).normalize(),normal=n.clone().transformDirection(wrist.matrixWorld);
    const axis=new V().crossVectors(dir,normal).normalize().applyQuaternion(bone.getWorldQuaternion(new Q()).invert());
    fingers.push({bone,bind:bone.quaternion.clone(),axis,angle:[.85,1.15,.8][i-1]});
   }
   hand=m.knifeHand={wrist,palm,y,n,fingers,active:false,worldY:new V(),worldZ:new V(),worldX:new V(),basis:new T.Matrix4()};
  }
  hand.active=true;
  for(const f of hand.fingers)f.bone.quaternion.copy(f.bind).multiply(_q.setFromAxisAngle(f.axis,f.angle));
  hand.wrist.updateMatrixWorld(true);
  // 원점 사이의 빈 공간이 아니라 고정 손잡이의 중심을 실제 손바닥에 맞춘다.
  const y=hand.worldY.copy(hand.y).transformDirection(hand.wrist.matrixWorld),z=hand.worldZ.copy(hand.n).transformDirection(hand.wrist.matrixWorld),x=hand.worldX.crossVectors(y,z).normalize();z.crossVectors(x,y).normalize();
  knife.position.copy(m.gunMount.worldToLocal(_p.copy(hand.palm).applyMatrix4(hand.wrist.matrixWorld)));
  knife.quaternion.copy(m.gunMount.getWorldQuaternion(_q).invert()).multiply(_q2.setFromRotationMatrix(hand.basis.makeBasis(x,y,z)));
  _p.set(m.curGun==='knife_butterfly'?-.011:0,-.02,0).multiply(knife.scale).applyQuaternion(knife.quaternion);knife.position.sub(_p);
 }
};
const TAU=Math.PI*2;
})();
