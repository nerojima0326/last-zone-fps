// knives.js — 칼 6종, 가져온 손목 모션, 버터플라이 관절과 근접 타격
(function(){
'use strict';
const G=window.G,T=window.THREE,U=G.U,V=T.Vector3,Q=T.Quaternion;
const catalog={
 knife_butterfly:{file:'butterfly',name:'버터플라이 나이프',short:'발리송',dmg:40,reach:1.75,duration:.61,inspect:3.1,role:'접이식 손잡이를 돌려 여는 버터플라이 나이프'},
 knife_dagger:{file:'dagger',name:'양날 단검',short:'단검',dmg:52,reach:1.85,duration:.73,inspect:2.65,role:'곧은 양날 칼날과 가드가 있는 단검'},
 knife_combat:{file:'combat',name:'전투 나이프',short:'전투 나이프',dmg:46,reach:1.8,duration:.64,inspect:2.65,role:'튼튼한 손잡이와 가드를 갖춘 전투용 나이프'},
 knife_karambit:{file:'karambit',name:'카람빗',short:'카람빗',dmg:42,reach:1.65,duration:.56,inspect:2.65,role:'손가락 고리와 안쪽으로 휜 칼날을 갖춘 카람빗'},
 knife_kunai:{file:'kunai',name:'쿠나이',short:'쿠나이',dmg:38,reach:1.7,duration:.54,inspect:2.65,role:'고리 손잡이와 짧고 뾰족한 칼날을 갖춘 쿠나이'},
 knife_machete:{file:'machete',name:'마체테',short:'마체테',dmg:62,reach:2.05,duration:.88,inspect:2.65,role:'긴 칼날을 넓게 휘두르는 무거운 마체테'}
};
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
   for(const [name,x]of [['safeHandle',-.011],['biteHandle',.011]]){const p=new T.Group();p.name=name;p.position.set(x,.065,0);root.add(p);box(.018,.13,.018,grip,0,-.065,p);}
   const p=new T.Group();p.name='blade';p.position.y=.065;root.add(p);box(.023,.12,.005,steel,0,.06,p);
  }else{
   box(.027,.11,.025,grip,0,-.005);box(.055,.012,.018,steel,0,.052);
   const long=d.file==='machete'?.29:.15,shape=new T.Shape(),curve=d.file==='karambit';
   shape.moveTo(-.014,.055);shape.lineTo(curve?-.065:-.014,.055+long*.65);shape.lineTo(curve?-.07:0,.055+long);shape.lineTo(.016,.055+long*.72);shape.lineTo(.016,.055);shape.closePath();
   root.add(new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.005,bevelEnabled:false}),steel));
  }
  root.userData.imported=false;return root;
 },
 model(id){if(!this.templates[id])this.templates[id]=this.fallback(id);return this.templates[id].clone(true)},
 buildVM(id){
  const m=G.Guns.buildHands('fists');m.type='knife';m.id=id;m.cls='melee';m.knife=this.model(id);m.grip=new T.Group();m.grip.add(m.knife);m.root.add(m.grip);
  if(id==='knife_machete')m.knife.scale.setScalar(.82);
  m.parts.left.position.set(0,0,0);m.parts.right.position.set(0,0,0);m.baseHands={};
  for(const [side,r]of Object.entries(m.staticArms)){
   r.baseS.set(side==='R'?.20:-.24,side==='R'?-.25:-.29,side==='R'?-.08:-.05);r.S.copy(r.baseS);r.rest.set(side==='R'?.13:-.19,side==='R'?-.13:-.24,-.48);r.cur.copy(r.rest);r.tgt.copy(r.rest);r.contactMode='grip';r.motionWeight=.5;
   m.baseHands[side]=r.handQ.clone();
  }
  m.bladeOffset=m.baseHands.R.clone().invert().multiply(new Q().setFromEuler(new T.Euler(-.25,0,-.27)));
  m.hinges={blade:m.knife.getObjectByName('blade'),bite:m.knife.getObjectByName('biteHandle')};
  m.muzzle.set(0,.15,0);m.curve={r:new V(),l:new V(),q:new Q()};m.root.userData.knife=id;return m;
 },
 sample(kind,t,out){
  const clip=this.motion?.[kind],rows=clip?.samples;
  out.r.set(0,0,0);out.l.set(0,0,0);out.q.identity();
  if(!rows?.length)return out;
  const f=U.clamp(t,0,1)*(rows.length-1),i=Math.min(rows.length-1,Math.floor(f)),j=Math.min(rows.length-1,i+1),a=rows[i],b=rows[j],u=f-i;
  out.r.set(U.lerp(a[0],b[0],u),U.lerp(a[1],b[1],u),U.lerp(a[2],b[2],u));
  out.l.set(U.lerp(a[3],b[3],u),U.lerp(a[4],b[4],u),U.lerp(a[5],b[5],u));out.q.fromArray(a,6).slerp(_q2.fromArray(b,6),u).normalize();return out;
 },
 poseVM(vm,m,dt,s){
  const action=s.melee,kind=action?.kind||'idle',t=action?U.clamp(action.t/action.duration,0,1):0,d=catalog[m.id],c=this.sample(kind,t,m.curve);
  const envelope=kind==='inspect'?Math.sin(t*Math.PI):0,attack=kind==='slash'?Math.sin(t*Math.PI):0;
  const fade=kind==='slash'?Math.sin(Math.PI*t)**.5:1;
  if(kind==='slash'){c.r.multiplyScalar(fade);c.q.slerp(_q2.identity(),.65);}
  // 검사 동작은 칼을 가운데로 들어 올려 양면을 보여 준다.
  c.r.x-=envelope*.11;c.r.y+=envelope*.11;c.r.z-=envelope*.015;
  if(!this.motion&&kind==='draw')c.r.y-=.28*(1-U.smoothstep(0,1,t));
  if(kind==='slash'){c.r.x-=.10*attack;c.r.z-=.12*attack;}
  const R=m.staticArms.R,L=m.staticArms.L;
  _p.set(.13,-.13,-.48).add(c.r);_q.copy(m.baseHands.R).multiply(c.q);
  _q.multiply(_q2.setFromEuler(_e.set(-attack*.22,envelope*.40,-attack*.75+envelope*.55)));
  G.Guns.poseStaticArm(R,_p,_q,dt,.85,.75);
  _p.set(-.19,-.24,-.43).addScaledVector(c.l,.35);_q.copy(m.baseHands.L);
  G.Guns.poseStaticArm(L,_p,_q,dt,kind==='inspect'?.40:.70,.6);
  m.grip.position.copy(R.contact);m.grip.quaternion.copy(R.handQ).multiply(m.bladeOffset);
  this.poseHinges(m.hinges,kind,t);
  m.root.position.set(Math.sin(s.phase)*.008*s.moving,Math.sin(vm.t*1.7)*.002-s.landDip*.04-(1-s.raise)*.22,0);
  m.root.rotation.set(-(1-s.raise)*.55-vm.sprint*.12,vm.sway.x,vm.sway.y);
  // 달리는 자세에서는 칼과 팔을 함께 몸 쪽으로 낮춘다.
  m.root.position.y-=vm.sprint*.055;m.root.rotation.z+=vm.sprint*.12;
  vm.flashLight.intensity=0;vm.camRX=vm.camRY=vm.camRZ=0;
 },
 poseHinges(hinges,kind,t){
  if(hinges.blade&&hinges.bite){
   let blade=0,bite=0;
   if(kind==='draw'){blade=Math.PI*(1-U.smoothstep(.12,.82,t));bite=TAU*U.smoothstep(.05,.9,t);}
   if(kind==='inspect'){blade=Math.PI*Math.sin(t*Math.PI)**2;bite=-TAU*2*U.smoothstep(.08,.92,t);}
   hinges.blade.rotation.z=blade;hinges.bite.rotation.z=bite;
  }
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
  p.melee={id:a.knife,kind,t:0,duration:kind==='slash'?d.duration:kind==='draw'?.58:d.inspect,hit:false,sounds:0};a.melee=p.melee;
  if(kind==='slash'){p.nextFire=p.time+d.duration;G.Audio.click('punch');if(G.Training?.active)p.melee.shot=G.Training.onShot();}
  else G.Audio.click('switch');return true;
 },
 tick(p,dt){
  const a=p.a;
  if(a.cur!=='melee'||!a.alive||a.knocked||a.state!=='ground'||p.vehicle){p.melee=null;a.melee=null;p.knifeSeen=null;return;}
  if(p.knifeSeen!==a.knife){p.knifeSeen=a.knife;p.melee={id:a.knife,kind:'draw',t:0,duration:.58,hit:false,sounds:0};a.melee=p.melee;}
  if(p.heal||p.revive||p.throwSt||p.sprinting){p.melee=null;a.melee=null;return;}
  const I=G.Input;
  if((I.hit('KeyT')||I.rmbHit)&&!p.melee)this.start(p,'inspect');
  if(I.lmb&&!p.sw&&p.time>=p.nextFire&&(!p.melee||p.melee.kind==='inspect'))this.start(p,'slash');
  const action=p.melee;if(!action)return;
  action.t+=dt;
  if(action.kind==='slash'&&!action.hit&&action.t>=action.duration*.43){action.hit=true;this.hit(p,action);}
  if(a.knife==='knife_butterfly'&&action.kind!=='slash'){
   const event=Math.floor(action.t/action.duration*5);
   if(event>action.sounds&&event<5){action.sounds=event;G.Audio.click('close');}
  }
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
  const action=a.melee,c=m.knifeCurve||(m.knifeCurve={r:new V(),l:new V(),q:new Q()}),t=action?U.clamp(action.t/action.duration,0,1):0;
  this.sample(action?.kind||'idle',t,c);m.gunMount.position.set(.24+c.r.x*.6,-.14+c.r.y*.6,-.34+c.r.z*.6);
  m.armL.rotation.set(.75,0,.15);m.elbowL.rotation.x=.8;m.armR.rotation.set(1.2,0,-.2);m.elbowR.rotation.x=.6;m.ikGun='knife';
  const knife=m.guns[m.curGun];if(knife){
   knife.rotation.set(-.25,0,-.27-(action?.kind==='slash'?Math.sin(t*Math.PI)*1.0:0));
   const hinges=knife._hinges||(knife._hinges={blade:knife.getObjectByName('blade'),bite:knife.getObjectByName('biteHandle')});this.poseHinges(hinges,action?.kind||'idle',t);
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
  // 손목이 아니라 실제 손바닥 중심에 손잡이를 둔다. 칼날은 검지 쪽으로 향한다.
  const y=hand.worldY.copy(hand.y).transformDirection(hand.wrist.matrixWorld),z=hand.worldZ.copy(hand.n).transformDirection(hand.wrist.matrixWorld),x=hand.worldX.crossVectors(y,z).normalize();z.crossVectors(x,y).normalize();
  knife.position.copy(m.gunMount.worldToLocal(_p.copy(hand.palm).applyMatrix4(hand.wrist.matrixWorld)));
  knife.quaternion.copy(m.gunMount.getWorldQuaternion(_q).invert()).multiply(_q2.setFromRotationMatrix(hand.basis.makeBasis(x,y,z)));
 }
};
const TAU=Math.PI*2;
})();
