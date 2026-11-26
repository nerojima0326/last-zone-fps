// 실제 탄도·연기 입자·착지 분사·벽/천장·품질별 예산을 브라우저에서 확인한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./throwable-fixture.cjs');
const output=path.resolve(process.env.REPORT||'/tmp/lz-smoke-trail.json');
(async()=>{
 const f=await fixture(process.env.SMOKE_BASE||null),p=f.page;
 try{
  const report=await p.evaluate(()=>{
   const T=G.Throwables,W=G.World,FX=G.FX,V=THREE.Vector3,owner=G.Game.player,rows=[],stress=[],surfaces=[],contacts=[];
   const original=T.smokeTrail,random=Math.random,quality=G.quality;
   let records=[],recording=null;
   if(original)T.smokeTrail=function(o,dt){
    const start=o.pos.clone(),from=o.trail.pos.clone(),before=FX.norm.list.length,done=!!o.done;original.call(this,o,dt);
    if(recording)for(const particle of FX.norm.list.slice(before)){
     const born=new V(particle.x,particle.y-.025,particle.z),segment=start.clone().sub(from),length=segment.lengthSq(),u=length?G.U.clamp(born.clone().sub(from).dot(segment)/length,0,1):0;
     records.push({at:recording.t,point:born,segmentGap:born.distanceTo(from.addScaledVector(segment,u)),done,vy:o.vel.y});
    }
   };
   const floor=W.addCollider(-90,299.8,-90,90,300,90,'hard',true);
   G.camera.position.set(10,308,22);G.camera.updateMatrixWorld(true);
   const reset=()=>{T.reset();FX.reset();records=[];recording={t:0};Math.random=G.U.mulberry32(101726);};
   const tick=dt=>{recording.t+=dt;T.update(dt);FX.update(dt);};
   const run=(label,base,fps,velocity,fuse)=>{
    reset();T.throw(owner,'smoke',new V(0,base+1.7,0),new V(...velocity),fuse);const o=T.list[0];let first=null,airMain=false,airBlock=false,peak=0,after=0;
    for(let i=0;i<Math.ceil(fps*6);i++){
     const before=records.length;tick(1/fps);peak=Math.max(peak,o.pos.y-base);
     if(!first&&T.smokes.length)first={time:recording.t,height:T.smokes[0].pos.y-base,count:T.smokes.length};
     if(!first){airMain=airMain||T.smokes.length>0;airBlock=airBlock||T.inSmoke(o.pos)||T.smokeBlocks(o.pos.clone().add(new V(-2,0,0)),o.pos.clone().add(new V(2,0,0)));}
     else if(o.t>first.time+1/fps)after+=records.length-before;
    }
    const positions=records.map(r=>r.point.y-base),gaps=records.slice(1).map((r,i)=>r.point.distanceTo(records[i].point));
    const s=T.smokes[0],row={label,quality:G.quality,fps,first,peak,trail:records.length,rising:records.filter(r=>r.vy>.3).length,falling:records.filter(r=>r.vy<-.3).length,
     minTrailHeight:positions.length?Math.min(...positions):null,maxTrailHeight:positions.length?Math.max(...positions):null,maxGap:Math.max(0,...gaps),segmentError:Math.max(0,...records.map(r=>r.segmentGap)),
     afterLanding:after,airMain,airBlock,clouds:T.smokes.length,cloudFollows:s?s.pos.distanceTo(o.pos):null,groundBlocked:s?T.inSmoke(s.pos.clone().add(new V(0,1.5,0))):false,belowBlocked:s?T.inSmoke(s.pos.clone().add(new V(0,-3,0))):false};
    return row;
   };
   try{
    for(const q of ['potato','low','medium','high']){G.quality=q;for(const fps of [30,60,144])for(const [label,vel]of [['위 투척',[10,18,-4]],['짧은 투척',[3,-3,0]]])rows.push(run(label,300,fps,vel));}
    G.quality='medium';
    const roof=W.addCollider(-90,307.8,-90,90,308,90,'hard',true);try{surfaces.push(run('지붕',308,60,[10,18,-4]));}finally{W.removeCollider(roof);}
    const water=W.waterAt;try{W.waterAt=()=>302;surfaces.push(run('수면',302,60,[10,18,-4]));}finally{W.waterAt=water;}
    surfaces.push(run('짧은 투척 · 긴 퓨즈',300,60,[3,-3,0],30));
    for(const type of ['벽','천장']){
     const obstacle=type==='벽'?W.addCollider(5.8,300,-90,6,340,90,'hard',true):W.addCollider(-90,312,-90,90,312.2,90,'hard',true);
     try{
      reset();T.throw(owner,'smoke',new V(0,301.7,0),new V(...(type==='벽'?[12,16,0]:[0,20,0])));const o=T.list[0];let touch=null,early=false,first=null;
      for(let i=0;i<360;i++){const v=o.vel.clone();tick(1/60);if(!touch&&(type==='벽'?v.x>0&&o.vel.x<0:v.y>0&&o.vel.y<0&&o.pos.y>311))touch={time:recording.t,height:o.pos.y-300};if(touch&&Math.abs(recording.t-touch.time)<1e-6)early=T.smokes.length>0;if(!first&&T.smokes.length)first={time:recording.t,height:T.smokes[0].pos.y-300};}
      contacts.push({type,touch,early,first});
     }finally{W.removeCollider(obstacle);}
    }
    for(const q of ['potato','low','medium','high']){
     G.quality=q;reset();for(let i=0;i<24;i++)T.throw(owner,'smoke',new V(i*.03,301.7,0),new V(6,25,-2));
     const geometry=FX.norm.geo,texture=FX.norm.mat.uniforms.map.value;
     for(let i=0;i<75;i++)tick(1/60);
     const born=records.length,active=FX.norm.list.length;recording=null;T.reset();for(let i=0;i<120;i++)FX.update(1/60);
     stress.push({quality:q,seconds:1.25,canisters:24,born,active,cleared:FX.norm.list.length===0,reusedGeometry:geometry===FX.norm.geo,reusedTexture:texture===FX.norm.mat.uniforms.map.value,credit:T.trailCredit});
    }
    G.quality='medium';reset();T.throw(owner,'smoke',new V(0,301.7,0),new V(10,18,-4));for(let i=0;i<1900;i++)tick(1/60);
    const cleared={projectiles:T.list.length,clouds:T.smokes.length,particles:FX.norm.list.length};
    return {rows,surfaces,contacts,stress,cleared};
   }finally{T.smokeTrail=original;Math.random=random;G.quality=quality;recording=null;T.reset();FX.reset();W.removeCollider(floor);}
  });
  report.errors=f.errors;fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  assert.deepEqual(f.errors,[]);
  for(const r of [...report.rows,...report.surfaces]){
   assert(r.trail>0&&r.segmentError<1e-6,r.label+' 궤적 입자');
   assert(r.first&&r.first.height>=0&&r.first.height<.18,r.label+' 착지 분사');
   assert(!r.airMain&&!r.airBlock&&r.afterLanding===0,r.label+' 공중 꼬리와 지면 연막 분리');
   assert(r.clouds===1&&r.cloudFollows<1e-8&&r.groundBlocked&&!r.belowBlocked,r.label+' 연막 위치·차폐');
   if(r.label==='위 투척'||r.label==='지붕'||r.label==='수면')assert(r.rising>0&&r.falling>0&&r.maxTrailHeight>8&&r.maxGap<.61,r.label+' 상승·하강 포물선');
   if(r.label.startsWith('짧은 투척'))assert(r.first.time<.7,r.label+' 퓨즈 대기 없이 착지 전환');
  }
  for(const q of ['potato','low','medium','high']){
   const n=report.rows.filter(r=>r.quality===q&&r.label==='위 투척').map(r=>r.trail);assert(Math.max(...n)-Math.min(...n)<=5,q+' FPS별 꼬리 밀도');
  }
  for(const r of report.contacts)assert(r.touch&&!r.early&&r.first&&r.first.time>r.touch.time&&r.first.height<.18,r.type+' 충돌은 착지가 아님');
  const budgets={potato:96,low:128,medium:192,high:240};
  for(const r of report.stress)assert(r.born>0&&r.born<=Math.ceil(budgets[r.quality]*r.seconds)&&r.active<=r.born&&r.cleared&&r.reusedGeometry&&r.reusedTexture&&r.credit===0,r.quality+' 풀·예산·정리');
  assert.deepEqual(report.cleared,{projectiles:0,clouds:0,particles:0});
  console.log(JSON.stringify({flightCases:report.rows.length,surfaces:report.surfaces.length,contacts:report.contacts,stress:report.stress,cleared:report.cleared,errors:f.errors},null,2));
  console.log('PASS 비행 궤적 연기·첫 착지 분사·지붕/수면·벽/천장·30/60/144FPS·품질 예산');
 }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
