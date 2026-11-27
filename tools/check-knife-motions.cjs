
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 실제 장갑·칼 삼각형, 칼끝 연속성, 칼별 궤적 차이를 검사한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs');
const installGeometry=require('./hand-geometry.cjs'),bvhDir=path.dirname(path.dirname(require.resolve('three-mesh-bvh')));
(async()=>{
 const out=process.env.KNIFE_SHOTS||'/tmp/lz-knife-motions',fallback=process.env.KNIFE_FALLBACK==='1',f=await fixture({viewport:{width:960,height:600},route:async p=>{
  await p.route('https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.8/**',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(bvhDir,r.request().url().split('/three-mesh-bvh@0.7.8/')[1]))}));
  if(fallback)await p.route('**/assets/models/knives/**',r=>r.fulfill({status:404,body:''}));
 }});
 try{
  fs.mkdirSync(out,{recursive:true});const p=f.page;
  await p.evaluate(()=>{
   const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.startGame({...G.UI.opts,mode:'training',quality:'medium'});G.paused=true;G.UI.showPause(false);
   window.knifeDuration=(id,kind)=>{const d=G.Knives.catalog[id];return kind==='draw'?d.draw:kind==='slash'?d.duration:d.inspect};
   window.knifePose=(id,kind,t,dt=1/60,variant=0)=>{
    const P=G.Player,a=P.a;Object.assign(a,{cur:'melee',knife:id,state:'ground',alive:true,knocked:false,hspeed:0,crouch:false,prone:false});Object.assign(P,{sw:null,reload:null,heal:null,throwSt:null,revive:null,vehicle:null,sprinting:false,ads:0,scopeView:0,raise:1,landDip:0,knifeSeen:id});G.Input.reset();
    const duration=knifeDuration(id,kind),time=t*duration,previous=P.melee;if(kind==='idle')P.melee=null;else if(previous?.id===id&&previous.kind===kind&&previous.variant===variant&&time>=previous.t)previous.t=time;else P.melee={id,kind,variant,t:time,duration,hit:true};a.melee=P.melee;P.updateCamera(dt);G.vmScene.updateMatrixWorld(true);
   };
   window.knifeShot=()=>{G.renderer.setRenderTarget(null);G.renderer.setClearColor(0x293540,1);G.renderer.autoClear=true;G.renderer.render(G.vmScene,G.vmCamera);G.Perf.gpuWait();return G.renderer.domElement.toDataURL('image/png').split(',')[1]};
  });
  await p.evaluate(installGeometry);
  const report={version:await p.evaluate(()=>LZ_BUILD),fallback,contactEnabled:!process.env.KNIFE_MOTION_ONLY,cases:[],signatures:[],errors:f.errors};
  report.clips=await p.evaluate(()=>Object.fromEntries(G.Knives.ids.map(id=>{const m=G.Knives.motionSets[id];return[id,{draw:m.draw.name,drawSeconds:m.drawSeconds,slash:m.slash.map(c=>c.name),inspect:m.inspect.name,inspectSeconds:m.inspectSeconds}]})));
  for(const id of await p.evaluate(()=>G.Knives.ids)){
   const row=await p.evaluate(id=>{for(let i=0;i<90;i++)knifePose(id,'idle',0);return HandGeometry.audit(id)},id);report.cases.push({id,kind:'idle',variant:0,phase:0,...row});
   fs.writeFileSync(path.join(out,id+'.png'),Buffer.from(await p.evaluate(()=>knifeShot()),'base64'));
   const poses=await p.evaluate(({id,contact})=>{
    const rows=[],signatures=[];
    for(const [kind,variant]of [['draw',0],['slash',0],['slash',1],['inspect',0]]){
     for(let i=0;i<90;i++)knifePose(id,'idle',0);const m=G.VM.models[id],R=m.staticArms.R,rest=R.contact.clone(),restQ=R.handQ.clone().invert(),node=m.hinges.blade||m.knife,relative=()=>m.grip.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(node.getWorldQuaternion(new THREE.Quaternion())),relativeRest=relative().invert(),signature={id,kind,variant,points:[]};
     const steps=(id==='knife_butterfly'||id==='knife_karambit')&&(kind==='draw'||kind==='inspect')?120:40,dt=knifeDuration(id,kind)/steps;
     for(let i=0;i<=steps;i++){
      knifePose(id,kind,i/steps,dt,variant);const h=m.hinges;
      if(id==='knife_butterfly'&&!h.tang)throw Error('발리송 경첩 없음');
      if(h.tang){const V=THREE.Vector3,safe=h.safe.getWorldPosition(new V()),bite=h.bite.getWorldPosition(new V()),blade=h.blade.getWorldPosition(new V()),pins=bite.clone().sub(safe);if(Math.abs(pins.length()-.022)>1e-5||blade.distanceTo(safe.clone().lerp(bite,.5))>1e-5||Math.abs(pins.normalize().dot(new V(0,1,0).transformDirection(h.blade.matrixWorld)))>1e-5)throw Error('발리송 칼날·경첩 연결 오류');if(kind==='slash'&&(Math.abs(h.tang.rotation.z)>1e-6||Math.abs(h.bite.rotation.z)>1e-6))throw Error('베는 중 발리송 관절이 접힘');if(kind==='draw'&&i===0&&(Math.abs(h.tang.rotation.z+Math.PI)>1e-6||Math.abs(h.bite.rotation.z-Math.PI)>1e-6))throw Error('발리송을 닫힌 상태로 꺼내지 않음');if(i===steps&&(Math.abs(h.tang.rotation.z)>1e-6||Math.abs(h.bite.rotation.z)>1e-6))throw Error('발리송 동작 뒤 전개 자세로 복귀하지 않음')}
      if(id==='knife_karambit'){
       const V=THREE.Vector3,index=G.RealArms.copy.visible?G.RealArms.S.R.b.fingers.Index:m.staticArms.R.fing[0],expected=index[2].getWorldPosition(new V()).addScaledVector(index[2].getWorldPosition(new V()).sub(index[1].getWorldPosition(new V())).normalize(),.003),actual=m.knife.localToWorld(new V(-.002165,-.026844,0));
       if(actual.distanceTo(expected)>.0001)throw Error('카람빗의 고리와 검지가 분리됨');
      }
      if(i*40%steps===0)signature.points.push([...R.contact.clone().sub(rest).toArray(),...R.handQ.clone().multiply(restQ).toArray(),...relativeRest.clone().multiply(relative()).toArray()]);
      const a=contact?HandGeometry.audit(id):{result:{},worst:[]};rows.push({id,kind,variant,phase:i/steps,result:a.result,worst:a.worst.slice(0,4)});
     }
     signatures.push(signature);
    }
    return {rows,signatures};
   },{id,contact:!process.env.KNIFE_MOTION_ONLY});report.cases.push(...poses.rows);report.signatures.push(...poses.signatures);console.log('검사 완료',id);
  }
  fs.writeFileSync(path.join(out,'contact.json'),JSON.stringify(report,null,2)+'\n');
  // 기본 자세를 제외한 손의 이동과 칼의 손에 대한 상대 회전을 실제 행렬로 비교한다.
  report.distinct=await p.evaluate(signatures=>{
   const pairs=[];
   for(let i=0;i<signatures.length;i++)for(let j=i+1;j<signatures.length;j++){
    const a=signatures[i],b=signatures[j];if(a.kind!==b.kind)continue;let position=0,angle=0,weapon=0;
    for(let k=0;k<a.points.length;k++){const x=a.points[k],y=b.points[k];for(let n=0;n<3;n++)position+=(x[n]-y[n])**2;angle+=new THREE.Quaternion(...x.slice(3,7)).angleTo(new THREE.Quaternion(...y.slice(3,7)))**2;weapon+=new THREE.Quaternion(...x.slice(7)).angleTo(new THREE.Quaternion(...y.slice(7)))**2}
    position=Math.sqrt(position/a.points.length);angle=Math.sqrt(angle/a.points.length);weapon=Math.sqrt(weapon/a.points.length);
    if(position<.020&&angle<.30&&weapon<.30)throw Error('구분하기 어려운 '+a.kind+' 궤적 '+a.id+'/'+a.variant+' ↔ '+b.id+'/'+b.variant+' '+position+'m '+angle+'rad');
    pairs.push({kind:a.kind,a:a.id+':'+a.variant,b:b.id+':'+b.variant,positionRms:position,angleRms:angle,weaponAngleRms:weapon});
   }
   return pairs;
  },report.signatures);
  report.motion=await p.evaluate(()=>{
   const T=THREE,V=T.Vector3,P=G.Player,rows=[],interrupts=[];
   // 회전하는 칼날 노드에서 칼끝을 잡아 손목과 경첩의 움직임을 함께 측정한다.
   const tipOf=id=>{const m=G.VM.models[id],node=m.hinges.blade||m.knife,inv=node.matrixWorld.clone().invert(),tip=new V(),point=new V();let top=-Infinity;
    for(const mesh of HandGeometry.selected(id).gun){let under=false;for(let p=mesh;p;p=p.parent)if(p===node)under=true;if(!under)continue;const B=HandGeometry.bake(mesh,inv),a=B.g.attributes.position;for(let i=0;i<a.count;i++){point.fromBufferAttribute(a,i);if(point.y>top){top=point.y;tip.copy(point)}}B.g.dispose()}return {node,point:tip}};
   const worldTip=tip=>tip.node.localToWorld(tip.point.clone());
   for(const hz of [30,60,144])for(const id of G.Knives.ids){
    for(let i=0;i<90;i++)knifePose(id,'idle',0);const tip=tipOf(id),m=G.VM.models[id];
    for(const [kind,variant]of [['draw',0],['slash',0],['slash',1],['inspect',0]]){
     for(let i=0;i<60;i++)knifePose(id,'idle',0);const duration=knifeDuration(id,kind),dt=1/hz,n=Math.ceil(duration*hz);let last=null,maxStep=0;
     for(let i=0;i<=n;i++){
      knifePose(id,kind,Math.min(1,i*dt/duration),dt,variant);const point=worldTip(tip);if(last)maxStep=Math.max(maxStep,point.distanceTo(last));last=point;
      if(!m.grip.matrixWorld.elements.every(Number.isFinite)||m.staticArms.R.wristAngle>1.65)throw Error(id+' 비정상 손목/변환');
     }
     knifePose(id,'idle',0,dt);const endStep=worldTip(tip).distanceTo(last),maxSpeed=maxStep/dt;
     if(maxSpeed>8||endStep>.001+dt)throw Error(id+' '+kind+'/'+variant+' '+hz+' FPS 칼끝 불연속: '+maxSpeed+'m/s, 복귀 '+endStep);
     rows.push({id,kind,variant,hz,maxStep,maxSpeed,endStep});
    }
   }
   for(const id of G.Knives.ids){
    for(let i=0;i<90;i++)knifePose(id,'inspect',.45);const m=G.VM.models[id],tip=tipOf(id),before=worldTip(tip);
    if(!G.Knives.start(P,'slash'))throw Error('검사 중 공격 시작 실패');P.updateCamera(1/60);G.vmScene.updateMatrixWorld(true);
    const jump=worldTip(tip).distanceTo(before);if(jump>.005)throw Error('검사→공격 전환의 칼끝 순간이동 '+id+' '+jump);interrupts.push({id,jump});
   }
   const ringInterrupts=[];
   for(const hz of [30,60,144])for(const phase of [.18,.35,.52,.70,.90]){
    const id='knife_karambit';for(let i=0;i<90;i++)knifePose(id,'inspect',phase);
    const tip=tipOf(id),before=worldTip(tip);if(!G.Knives.start(P,'slash'))throw Error('카람빗 검사 중 공격 시작 실패');
    const action=P.melee,dt=1/hz,n=Math.ceil(action.duration*.43*hz);let last=before,maxSpeed=0,maxPenetration=0,worst=null;
    for(let i=0;i<=n;i++){
     action.t=Math.min(action.duration*.43,i*dt);P.updateCamera(dt);G.vmScene.updateMatrixWorld(true);const point=worldTip(tip),step=point.distanceTo(last);
     if(i===0&&step>.005)throw Error('카람빗 검사 중단 때 칼끝이 튐');if(i>0)maxSpeed=Math.max(maxSpeed,step/dt);last=point;
     if(i%3===0||i===n){const a=HandGeometry.audit(id);for(const v of Object.values(a.result))if(v.max>maxPenetration){maxPenetration=v.max;worst={frame:i,hit:a.worst[0]};}}
    }
    if(maxSpeed>8||maxPenetration>.002||Math.abs(G.VM.models[id].curve.ring)>.00001)throw Error('카람빗 검사→공격의 회전·그립 오류 '+hz+' '+phase+' '+maxSpeed+' '+maxPenetration+' '+JSON.stringify(worst));
    ringInterrupts.push({hz,phase,maxSpeed,maxPenetrationMm:maxPenetration*1000,worst});
   }
   return {rates:[30,60,144],cases:rows,inspectToSlash:interrupts,ringInterrupts};
  });
  fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(report,null,2)+'\n');
  const summary=Object.fromEntries([...new Set(report.cases.map(c=>c.id))].map(id=>[id,Math.max(...report.cases.filter(c=>c.id===id).flatMap(c=>Object.values(c.result).map(v=>v.max)))*1000]));console.log(JSON.stringify(summary,null,2));assert.deepEqual(f.errors,[]);
  if(!process.env.KNIFE_DIAG)assert(Object.values(summary).every(mm=>mm<2),'장갑과 칼의 관통이 2mm를 넘음');
  if(!process.env.KNIFE_MOTION_ONLY)console.log('PASS 실제 칼·장갑 삼각형 검사',report.cases.length,'· 서로 다른 궤적',report.distinct.length,'쌍');
  console.log('PASS 30/60/144 FPS 동작',report.motion.cases.length,'종·검사 중 공격 전환 6종');
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
