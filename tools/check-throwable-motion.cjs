// 실제 장갑 관통·손 고정·투척 이벤트·연막의 바닥/지붕/수면 동작을 검사한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./throwable-fixture.cjs'),geometry=require('./hand-geometry.cjs');
const out=path.resolve(process.env.THROW_CHECKS||'/tmp/lz-v98-checks');
(async()=>{
 const fallback=process.env.THROW_FALLBACK==='1',f=await fixture(null,{fallbackModels:fallback,proceduralArms:fallback}),p=f.page,report={fallback};fs.mkdirSync(out,{recursive:true});
 try{
  await p.evaluate(geometry);
  report.smoke=await p.evaluate(()=>{
   const T=G.Throwables,W=G.World,owner=G.Game.player,V=THREE.Vector3,rows=[],floor=W.addCollider(-15,299.8,-15,15,300,15,'hard',true);
   const run=(label,base)=>{T.reset();G.FX.reset();T.throw(owner,'smoke',new V(0,base+1.7,0),new V(0,23.6,0));let first=null,air=false;for(let i=0;i<480;i++){T.update(1/60);if(i<96&&T.smokes.length)air=true;if(!first&&T.smokes.length)first={time:(i+1)/60,height:T.smokes[0].pos.y-base};}const o=T.list[0],s=T.smokes[0];o.pos.x+=.25;T.update(1/60);const follows=s.pos.distanceTo(o.pos),below=T.inSmoke(new V(.25,base-3,0)),inside=T.inSmoke(new V(.25,base+1.5,0));for(let i=0;i<1600;i++)T.update(1/60);rows.push({label,first,air,follows,below,inside,cleared:T.list.length===0&&T.smokes.length===0});};
   try{run('바닥',300);const roof=W.addCollider(-10,307.8,-10,10,308,10,'hard',true);try{run('지붕',308)}finally{W.removeCollider(roof)}const water=W.waterAt;try{W.waterAt=()=>302;run('수면',302)}finally{W.waterAt=water}}finally{T.reset();G.FX.reset();W.removeCollider(floor)}return rows;
  });
  for(const r of report.smoke){assert(!r.air);assert(r.first&&r.first.height>=0&&r.first.height<.18,r.label);assert(r.follows<1e-8);assert(!r.below&&r.inside);assert(r.cleared)}
  report.actions=await p.evaluate(()=>{
   const P=G.Player,a=P.a,M=G.VM,m=M.models.throw,V=THREE.Vector3,rows=[],geometry=[];
   const reset=kind=>{P.abortThrow();G.Throwables.reset();G.FX.reset();G.Input.reset();Object.assign(P,{sw:null,reload:null,throwSt:null,heal:null,melee:null,raise:1,ads:0,scopeView:0,throwKind:kind});Object.assign(a,{cur:'throw',alive:true,knocked:false,state:'ground',hp:100});a.vel.set(0,0,0);for(const k of G.THROW_ORDER)a.throwables[k]=9;M.set('throw');M.setThrowKind(kind);for(let i=0;i<45;i++)P.updateCamera(1/60);};
   const matrixError=(x,y)=>Math.max(...x.map((v,i)=>Math.abs(v-y[i])));
   for(const hz of [30,60,144])for(const kind of G.THROW_ORDER)for(const under of [false,true])for(const manual of [false,true]){
    reset(kind);const dt=1/hz;G.Input.lmb=true;P.startThrow(under,false,'lmb');if(manual)P.pullPin();let maxAttach=0,maxStep=0,last=null,reference=null,release=null,geometryCount=0;
    for(let i=0;i<Math.ceil(hz*2.8);i++){
     G.Input.lmb=i<hz*.7;P.throwLogic(dt);P.updateCamera(dt);G.vmScene.updateMatrixWorld(true);const state=P.throwSt,item=m.items[kind],hand=G.RealArms.ready?G.RealArms.S.R.b.hand:m.staticArms.R.bW;
     if(!m.grip.matrixWorld.elements.every(Number.isFinite)||m.staticArms.R.wristAngle>1.66)throw Error('투척 손목/변환 오류 '+kind);
     if(state&&!state.released){const current=m.grip.matrixWorld.clone().invert().multiply(hand.matrixWorld).elements;if(reference)maxAttach=Math.max(maxAttach,matrixError(current,reference));reference=current.slice();}
     const point=hand.getWorldPosition(new V());if(last)maxStep=Math.max(maxStep,point.distanceTo(last));last=point;
     if(state?.released&&item.visible)throw Error('실제 방출 뒤 손에 물체가 남음 '+kind);
     if(G.Throwables.list.length&&!release)release={time:i*dt,kind:G.Throwables.list[0].kind,speed:G.Throwables.list[0].vel.length()};
     if(hz===60&&manual&&state&&!state.released&&[8,20,45,55,62].includes(i)){geometry.push({kind,under,phase:state.phase,t:state.t,pin:state.pinT,...HandGeometry.audit('throw')});geometryCount++;}
     if(!state)break;
    }
    if(!release||G.Throwables.list.length!==1||a.throwables[kind]!==8||P.throwSt)throw Error('투척 수량/완료 오류 '+kind+' '+hz);
    if(maxAttach>1e-5)throw Error('실제 장갑과 투척물 분리 '+kind+' '+maxAttach);if(maxStep>.17)throw Error('투척 손 순간이동 '+kind+' '+maxStep);
    rows.push({hz,kind,under,manual,maxAttach,maxStep,release,geometryCount});
   }
   reset('smoke');G.Input.lmb=true;P.startThrow(false,false,'lmb');P.pullPin();for(let i=0;i<240;i++){P.throwLogic(1/60);P.updateCamera(1/60);}G.UI.drawCook(a,P);const heldSmoke={phase:P.throwSt?.phase,count:G.Throwables.list.length,ammo:a.throwables.smoke,text:document.querySelector('#cookTimer b')?.textContent};P.abortThrow();const droppedSmoke=G.Throwables.list.length;
   reset('frag');G.Input.lmb=true;P.startThrow(false,false,'lmb');P.pullPin();for(let i=0;i<230;i++){if(P.throwSt)P.throwLogic(1/60);P.updateCamera(1/60);}const cooked={count:G.Throwables.list.length,ammo:a.throwables.frag};
   reset('smoke');G.Input.lmb=true;P.startThrow(false,false,'lmb');P.abortThrow();const safeCancel={count:G.Throwables.list.length,ammo:a.throwables.smoke};
   reset('flash');G.Input.lmb=true;P.startThrow(false,true,'lmb');P.throwSt.prev='pistol';for(let i=0;i<240&&P.throwSt;i++){G.Input.lmb=i<30;P.throwLogic(1/60);P.updateCamera(1/60);}const quick=a.cur;
   P.abortThrow();G.Throwables.reset();return {rows,geometry,heldSmoke,droppedSmoke,cooked,safeCancel,quick};
  });
  const a=report.actions;assert.equal(a.rows.length,48);assert.deepEqual(a.heldSmoke,{phase:'hold',count:0,ammo:9,text:'준비'});assert.equal(a.droppedSmoke,1);assert.deepEqual(a.cooked,{count:1,ammo:8});assert.deepEqual(a.safeCancel,{count:0,ammo:9});assert.equal(a.quick,'pistol');
  report.maxPenetration=Math.max(0,...a.geometry.flatMap(r=>Object.values(r.result).map(x=>x.max)));fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n');assert(report.maxPenetration<.0025,'장갑·투척물 관통 '+report.maxPenetration);
  report.errors=f.errors;assert.deepEqual(f.errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS 바닥·지붕·수면 연막 / 48가지 투척 / 쿠킹·취소·복귀 / 실제 장갑 관통',report.maxPenetration);
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
