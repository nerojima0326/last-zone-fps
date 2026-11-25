// 실제 장갑·칼의 삼각형과 경첩을 검사한다. IK 목표점만 맞는지는 합격 기준으로 쓰지 않는다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs');
const installGeometry=require('./hand-geometry.cjs'),bvhDir=path.dirname(path.dirname(require.resolve('three-mesh-bvh')));
(async()=>{
 const out=process.env.KNIFE_SHOTS||'/tmp/lz-v95-motions',fallback=process.env.KNIFE_FALLBACK==='1',f=await fixture({viewport:{width:960,height:600},route:async p=>{
  await p.route('https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.8/**',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(bvhDir,r.request().url().split('/three-mesh-bvh@0.7.8/')[1]))}));
  if(fallback)await p.route('**/assets/models/knives/**',r=>r.fulfill({status:404,body:''}));
 }});
 try{
  fs.mkdirSync(out,{recursive:true});const p=f.page;
  await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.startGame({...G.UI.opts,mode:'training',quality:'medium'});G.paused=true;G.UI.showPause(false);
   window.knifePose=(id,kind,t,dt=1/60)=>{const P=G.Player,a=P.a,d=G.Knives.catalog[id];Object.assign(a,{cur:'melee',knife:id,state:'ground',alive:true,knocked:false,hspeed:0,crouch:false,prone:false});Object.assign(P,{sw:null,reload:null,heal:null,throwSt:null,revive:null,vehicle:null,sprinting:false,ads:0,scopeView:0,raise:1,landDip:0,knifeSeen:id});G.Input.reset();const duration=kind==='draw'?(d.draw||.58):kind==='slash'?d.duration:d.inspect;P.melee=kind==='idle'?null:{id,kind,t:t*duration,duration,hit:true};P.updateCamera(dt);G.vmScene.updateMatrixWorld(true)};
   window.knifeShot=()=>{G.renderer.setRenderTarget(null);G.renderer.setClearColor(0x293540,1);G.renderer.autoClear=true;G.renderer.render(G.vmScene,G.vmCamera);G.Perf.gpuWait();return G.renderer.domElement.toDataURL('image/png').split(',')[1]};
  });
  await p.evaluate(installGeometry);
  const report={version:await p.evaluate(()=>LZ_BUILD),fallback,cases:[],errors:f.errors};
  for(const id of process.env.KNIFE_MOTION_ONLY?[]:await p.evaluate(()=>G.Knives.ids)){
   const row=await p.evaluate(id=>{for(let i=0;i<90;i++)knifePose(id,'idle',0);return HandGeometry.audit(id)},id);
   report.cases.push({id,kind:'idle',phase:0,...row});
   fs.writeFileSync(path.join(out,id+'.png'),Buffer.from(await p.evaluate(()=>knifeShot()),'base64'));
   const poses=await p.evaluate(id=>{const rows=[];for(const kind of ['draw','slash','inspect']){
    for(let i=0;i<90;i++)knifePose(id,'idle',0);
    const steps=id==='knife_butterfly'&&kind==='draw'?120:40;for(let i=0;i<=steps;i++){knifePose(id,kind,i/steps);const m=G.VM.models[id],h=m.hinges;
     if(h.tang){const V=THREE.Vector3,safe=h.safe.getWorldPosition(new V()),bite=h.bite.getWorldPosition(new V()),blade=h.blade.getWorldPosition(new V()),pins=bite.clone().sub(safe);if(Math.abs(pins.length()-.022)>1e-5)throw Error('두 경첩 사이의 거리가 달라짐');if(blade.distanceTo(safe.clone().lerp(bite,.5))>1e-5)throw Error('칼날 탱이 핀 사이에서 분리됨');if(Math.abs(pins.normalize().dot(new V(0,1,0).transformDirection(h.blade.matrixWorld)))>1e-5)throw Error('칼날과 경첩 축이 맞지 않음');if(Math.abs(h.tang.rotation.z)>1e-6||Math.abs(h.bite.rotation.z)>1e-6)throw Error('쥔 발리송의 잠금이 풀림')}
     const a=HandGeometry.audit(id);rows.push({id,kind,phase:i/steps,result:a.result,worst:a.worst.slice(0,4)});
    }
   }return rows},id);report.cases.push(...poses);console.log('검사 완료',id);
  }
  // 실제 시간 간격으로 칼끝을 추적해 꺼내기·공격·검사와 대기 복귀의 순간이동을 검사한다.
  report.motion=await p.evaluate(()=>{
   const T=THREE,V=T.Vector3,P=G.Player,rows=[],interrupts=[];
   const tipOf=id=>{const m=G.VM.models[id],inv=m.knife.matrixWorld.clone().invert(),tip=new V(),point=new V();let top=-Infinity;
    for(const mesh of HandGeometry.selected(id).gun){const B=HandGeometry.bake(mesh,inv),a=B.g.attributes.position;for(let i=0;i<a.count;i++){point.fromBufferAttribute(a,i);if(point.y>top){top=point.y;tip.copy(point)}}B.g.dispose()}return tip};
   for(const hz of [30,60,144])for(const id of G.Knives.ids){
    for(let i=0;i<90;i++)knifePose(id,'idle',0);const tip=tipOf(id),m=G.VM.models[id],d=G.Knives.catalog[id];
    for(const kind of ['draw','slash','inspect']){
     for(let i=0;i<60;i++)knifePose(id,'idle',0);const duration=kind==='draw'?d.draw||.58:kind==='slash'?d.duration:d.inspect,dt=1/hz,n=Math.ceil(duration*hz);let last=null,maxStep=0;
     for(let i=0;i<=n;i++){
      knifePose(id,kind,Math.min(1,i*dt/duration),dt);const point=m.knife.localToWorld(tip.clone());
      if(last)maxStep=Math.max(maxStep,point.distanceTo(last));last=point;
      if(!m.grip.matrixWorld.elements.every(Number.isFinite)||m.staticArms.R.wristAngle>1.65)throw Error(id+' 비정상 손목/변환');
     }
     knifePose(id,'idle',0,dt);const endStep=m.knife.localToWorld(tip.clone()).distanceTo(last);
     if(maxStep>.16||endStep>.04)throw Error(id+' '+kind+' '+hz+' FPS 칼끝 불연속: '+maxStep+', '+endStep);
     rows.push({id,kind,hz,maxStep,endStep});
    }
   }
   for(const id of G.Knives.ids){
    for(let i=0;i<90;i++)knifePose(id,'inspect',.45);const m=G.VM.models[id],tip=tipOf(id),before=m.knife.localToWorld(tip.clone());
    if(!G.Knives.start(P,'slash'))throw Error('검사 중 공격 시작 실패');P.updateCamera(1/60);G.vmScene.updateMatrixWorld(true);
    const jump=m.knife.localToWorld(tip.clone()).distanceTo(before);if(jump>.005)throw Error('검사→공격 전환의 칼끝 순간이동 '+id+' '+jump);interrupts.push({id,jump});
   }
   return {rates:[30,60,144],cases:rows,inspectToSlash:interrupts};
  });
  fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(report,null,2)+'\n');
  const summary=Object.fromEntries([...new Set(report.cases.map(c=>c.id))].map(id=>[id,Math.max(...report.cases.filter(c=>c.id===id).flatMap(c=>Object.values(c.result).map(v=>v.max)))*1000]));
  console.log(JSON.stringify(summary,null,2));assert.deepEqual(f.errors,[]);
  if(!process.env.KNIFE_DIAG)assert(Object.values(summary).every(mm=>mm<2),'장갑과 칼의 관통이 2mm를 넘음');
  if(!process.env.KNIFE_MOTION_ONLY)console.log((process.env.KNIFE_DIAG?'진단 완료':'PASS 실제 칼·장갑 삼각형 검사'),report.cases.length);console.log('PASS 30/60/144 FPS 동작 54종·검사 중 공격 전환 6종');
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
