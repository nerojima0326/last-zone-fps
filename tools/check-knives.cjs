// 실제 게임의 칼 장착·모션·타격·가림·전환과 누락 에셋 복귀를 검사한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),fixture=require('./optimize/browser-fixture.cjs');
const out=path.resolve(process.env.KNIFE_SHOTS||'/tmp/lz-v90-knives'),fallback=process.env.KNIFE_FALLBACK==='1';
const assetRoot=path.resolve(__dirname,'../assets/models/knives'),manifest=JSON.parse(fs.readFileSync(path.join(assetRoot,'manifest.json')));
for(const asset of manifest.files)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(assetRoot,asset.file))).digest('hex'),asset.sha256,asset.file+' 체크섬');
(async()=>{
 const f=await fixture({viewport:{width:960,height:600},route:async page=>{if(fallback)await page.route('**/assets/models/knives/**',r=>r.fulfill({status:404,body:''}))}}),{page}=f,report={};
 try{
  await page.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.UI.opts.renderResolution='100';G.startGame({...G.UI.opts,mode:'training',quality:'medium',players:4,loadout:'all'});G.paused=true;G.UI.showPause(false)});
  report.assets=await page.evaluate(()=>({version:LZ_BUILD,loaded:G.Knives.loaded,motion:!!G.Knives.motion,ready:G.Knives.ready,guns:G.GUN_IDS.length,ids:G.Knives.ids,sourceClips:Object.values(G.Knives.motion||{}).map(c=>c.sourceClip)}));
  assert.equal(report.assets.guns,30);assert.equal(report.assets.ids.length,6);assert.equal(report.assets.loaded,fallback?0:6);assert.equal(report.assets.motion,!fallback);
  report.assets.maxNormalTangentDot=await page.evaluate(()=>{let max=0;for(const root of Object.values(G.Knives.templates))root.traverse(o=>{const n=o.geometry?.attributes.normal,t=o.geometry?.attributes.tangent;if(n&&t)for(let i=0;i<n.count;i++)max=Math.max(max,Math.abs(n.getX(i)*t.getX(i)+n.getY(i)*t.getY(i)+n.getZ(i)*t.getZ(i)))});return max});
  assert(report.assets.maxNormalTangentDot<.01,'노멀맵의 표면 방향이 메시와 일치하지 않음');
  report.gameplay=await page.evaluate(()=>{
   const K=G.Knives,P=G.Player,I=G.Input,Game=G.Game,W=G.World,a=P.a,T=THREE,check=(v,m)=>{if(!v)throw Error(m)},saved={actors:Game.actors,pos:a.pos.clone(),yaw:a.yaw,pitch:a.pitch,training:G.Training.active};
   const victim=new G.Actor({id:999,team:1,name:'근접 표적'}),friend=new G.Actor({id:998,team:a.team,name:'아군 표적'});
   for(const b of [victim,friend]){b.model=new G.CharacterModel();b.state='ground';b.alive=true;}
   const step=(hz,n)=>{for(let i=0;i<n;i++){P.time+=1/hz;K.tick(P,1/hz);I.endFrame()}};
   function ready(id){I.reset();a.cur='melee';a.knife=id;a.state='ground';a.alive=true;a.knocked=false;a.yaw=0;a.pitch=0;P.sw=P.heal=P.revive=P.throwSt=P.vehicle=P.melee=null;P.sprinting=false;P.knifeSeen=id;P.nextFire=-1;P.knifeCombo=null;}
   let wall;
   try{
    let arena=null;
    for(const dx of [0,6,-6,12])for(const dz of [-5,-15,-25]){const x=W.range.x+dx,z=W.range.line+dz,y=W.heightAt(x,z)+.08,eye=new T.Vector3(x,y+1.62,z),to=new T.Vector3(0,-.42,-1.2).normalize();if(!W.raycast(eye,to,1.5)){arena=new T.Vector3(x,y,z);break}}
    check(arena,'검사할 열린 근접 구역 없음');a.pos.copy(arena);victim.pos.copy(arena).add(new T.Vector3(0,0,-1.2));friend.pos.copy(arena).add(new T.Vector3(.1,0,-.8));Game.actors=[a,friend,victim];G.Training.active=false;
    const rows=[];
    for(const hz of [30,60,144])for(const id of K.ids){
     ready(id);victim.hp=1000;friend.hp=1000;check(K.start(P,'slash'),'공격 시작 실패');step(hz,Math.ceil(K.catalog[id].duration*hz)+3);
     check(victim.hp===1000-K.catalog[id].dmg,'공격당 피해가 중복되거나 누락됨 '+id+' '+hz);check(friend.hp===1000,'아군 피해');rows.push({hz,id,damage:1000-victim.hp});
    }
    const comboHits=[];
    for(const hz of [30,60,144])for(const id of K.ids){
     ready(id);victim.hp=1000;const variants=[];
     for(let hit=0;hit<2;hit++){check(K.start(P,'slash'),'연속 공격 시작');variants.push(P.melee.variant);step(hz,Math.ceil(K.catalog[id].duration*hz)+2);}
     check(variants[0]===0&&variants[1]===1,'정방향·복귀 공격 교대 '+id);check(victim.hp===1000-2*K.catalog[id].dmg,'두 공격의 타격 횟수 '+id);
     P.time+=K.catalog[id].duration+.5;K.start(P,'slash');check(P.melee.variant===0,'연속 공격 대기 뒤 첫 동작 복귀 '+id);step(hz,Math.ceil(K.catalog[id].duration*hz)+2);
     check(victim.hp===1000-3*K.catalog[id].dmg,'대기 뒤 공격 중복 피해 '+id);comboHits.push({id,hz,variants,totalDamage:1000-victim.hp});
    }
    ready('knife_combat');victim.hp=1000;wall=W.addCollider(arena.x-.65,arena.y,arena.z-.85,arena.x+.65,arena.y+2.4,arena.z-.55,'concrete',true);
    K.start(P,'slash');step(60,60);check(victim.hp===1000,'벽 너머에 칼 피해');W.removeCollider(wall);wall=null;
    victim.pos.z=arena.z-3;ready('knife_machete');K.start(P,'slash');step(60,80);check(victim.hp===1000,'사거리 밖에 칼 피해');victim.pos.z=arena.z-1.2;
    ready('knife_dagger');K.start(P,'slash');step(60,3);P.switchTo('rifle');for(let i=0;i<70;i++){P.time+=1/60;P.weaponsLogic(1/60,P.time);I.endFrame()}check(victim.hp===1000,'무기 전환 뒤 지연 타격');
    ready('knife_dagger');P.heal={};check(!K.start(P,'slash'),'치료 중 공격');P.heal=null;P.sprinting=true;check(!K.start(P,'inspect'),'달리는 중 검사');P.sprinting=false;
    K.start(P,'slash');step(60,2);a.alive=false;step(60,40);check(victim.hp===1000,'사망 뒤 지연 타격');a.alive=true;
    // 실제 훈련 표적에 가까이 다가가 타격한다.
    Game.actors=[a];G.Training.active=true;const target=G.Training.targets.find(t=>t.kind==='sil'),old=target.root.position.clone(),oldQ=target.root.quaternion.clone(),hits=G.Training.stats.hits;
    try{
     target.root.position.copy(arena).add(new T.Vector3(0,0,-1.1));target.root.rotation.y=0;target.root.updateMatrixWorld(true);a.pos.copy(arena);ready('knife_combat');a.pitch=-Math.atan2(.42,1.1);
     K.start(P,'slash');step(60,50);check(G.Training.stats.hits===hits+1,'훈련 표적에 근접 타격이 기록되지 않음');
    }finally{target.root.position.copy(old);target.root.quaternion.copy(oldQ);target.root.updateMatrixWorld(true)}
    return{singleHits:rows,comboHits,friendProtected:true,wallBlocked:true,rangeLimited:true,switchCancelled:true,deathCancelled:true,trainingHit:true};
   }finally{if(wall)W.removeCollider(wall);Game.actors=saved.actors;G.Training.active=saved.training;victim.model.dispose();friend.model.dispose();a.pos.copy(saved.pos);a.yaw=saved.yaw;a.pitch=saved.pitch;a.alive=true;a.knocked=false;I.reset();P.melee=P.sw=P.heal=P.revive=P.throwSt=P.vehicle=null;P.sprinting=false;P.knifeSeen=null;}
  });
  report.thirdPerson=await page.evaluate(()=>{
   const m=new G.CharacterModel(),rows=[],pose={speed:0,pitch:0,crouch:false,knocked:false,prone:false,dead:false,state:'ground',cur:'melee',onGround:true};G.scene.add(m.root);
   try{
    for(const id of G.Knives.ids){
     const d=G.Knives.catalog[id];for(let i=0;i<=20;i++)m.update(1/60,{...pose,gun:id,melee:{id,kind:'inspect',t:i/20*d.inspect,duration:d.inspect}});
     m.root.updateMatrixWorld(true);const hand=m.knifeHand;if(!hand?.active)throw Error('3인칭 손 그립 없음');
     const expected=hand.palm.clone().applyMatrix4(hand.wrist.matrixWorld),actual=m.guns[id].localToWorld(new THREE.Vector3(id==='knife_butterfly'?-.011:0,-.02,0)),gap=expected.distanceTo(actual);
     if(gap>.0001)throw Error('3인칭 손바닥과 칼이 분리됨');if(!hand.fingers.some(f=>f.bone.quaternion.angleTo(f.bind)>.5))throw Error('3인칭 손가락이 손잡이를 쥐지 않음');
     rows.push({id,palmGap:gap,fingers:hand.fingers.length});
    }
    m.update(1/60,{...pose,cur:'fists',gun:'fists',melee:null});if(m.knifeHand.active||m.knifeHand.fingers.some(f=>!f.bone.quaternion.equals(f.bind)))throw Error('칼을 내린 뒤 손 자세가 복귀하지 않음');
    return{poses:rows,restored:true};
   }finally{m.dispose()}
  });
  // 실제 키보드 이벤트로 슬롯·검사·재지정 경로를 확인한다.
  await page.evaluate(()=>{G.paused=false;G.Input.locked=true;G.Player.a.cur='rifle';G.Player.sw=null});
  await page.keyboard.press('5');
  await page.evaluate(()=>{for(let i=0;i<90;i++){G.Player.update(1/60);G.Input.endFrame()}});
  assert.equal(await page.evaluate(()=>G.Player.a.cur),'melee');
  await page.keyboard.press('t');await page.evaluate(()=>{G.Player.update(1/60);G.Input.endFrame()});
  assert.equal(await page.evaluate(()=>G.Player.melee?.kind),'inspect');
  await page.keyboard.press('5');await page.evaluate(()=>{for(let i=0;i<90;i++){G.Player.update(1/60);G.Input.endFrame()}});
  await page.evaluate(()=>G.Settings.setBind('KeyT','KeyY'));await page.keyboard.press('y');await page.evaluate(()=>{G.Player.update(1/60);G.Input.endFrame()});
  assert.equal(await page.evaluate(()=>G.Player.melee?.kind),'inspect');
  await page.evaluate(()=>{G.Settings.setBind('KeyT','KeyT');G.Input.reset();G.Input.locked=false;G.paused=true;G.Player.melee=null});
  report.keyboard={equip5:true,inspectT:true,remappedY:true};
  // 무기 도감에서 모든 칼의 설명·모델을 열고 훈련 무기로 선택한다.
  await page.evaluate(()=>{G.Armory.show();G.Armory.family='melee';G.Armory.list()});assert.equal(await page.locator('#armoryList [data-gun]').count(),6);
  for(const id of report.assets.ids){await page.click('[data-gun="'+id+'"]');assert((await page.locator('#armoryDetail').innerText()).includes('사거리'))}
  await page.click('#armoryEquip');assert.equal(await page.evaluate(()=>G.Player.a.knife),'knife_machete');await page.evaluate(()=>{G.paused=true;G.UI.showPause(false)});
  fs.mkdirSync(out,{recursive:true});await page.addStyleTag({content:'#centerMsg{display:none!important}'});
  report.poses=[];
  for(const id of report.assets.ids){
   const row=await page.evaluate(id=>{
    const P=G.Player;G.Input.reset();G.Knives.equip(P,id);for(let i=0;i<90;i++){P.update(1/60);G.Game.syncModels(1/60);G.UI.update(1/60)}
    const m=G.VM.models[id],metrics={id,imported:!!m.knife.userData.imported,maxGripError:0,maxWrist:0,maxScreenX:0,maxScreenY:0,source:m.knife.userData.imported?'가져온 모델':'대체 모델'};
    for(const [kind,variant]of [['draw',0],['slash',0],['slash',1],['inspect',0]]){
     const d=kind==='inspect'?G.Knives.catalog[id].inspect:kind==='draw'?(G.Knives.catalog[id].draw||.58):G.Knives.catalog[id].duration;
     P.melee={id,kind,variant,t:0,duration:d,hit:true};for(let i=0;i<=30;i++){
      P.melee.t=i/30*d;P.updateCamera(d/30);
      const r=m.staticArms.R;metrics.maxGripError=Math.max(metrics.maxGripError,r.contactError);metrics.maxWrist=Math.max(metrics.maxWrist,r.wristAngle);
      m.root.updateMatrixWorld(true);m.root.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))throw Error('모션의 비정상 행렬')});
      if(m.grip.position.distanceTo(r.contact)>.00001)throw Error('손과 손잡이가 분리됨');
      const screen=m.grip.getWorldPosition(new THREE.Vector3()).project(G.vmCamera);metrics.maxScreenX=Math.max(metrics.maxScreenX,Math.abs(screen.x));metrics.maxScreenY=Math.max(metrics.maxScreenY,Math.abs(screen.y));
     }
    }
    P.melee=null;for(let i=0;i<40;i++)P.updateCamera(1/60);G.UI.update(.016);G.renderNow();G.Perf.gpuWait();return metrics;
   },id);
   assert(row.maxGripError<.06,id+' 손잡이 도달 오차 '+row.maxGripError);assert(row.maxWrist<1.65,id+' 손목 각도 '+row.maxWrist);assert(row.maxScreenX<.9,id+' 손잡이가 화면 밖으로 나감');report.poses.push(row);
   await page.screenshot({path:path.join(out,id+'.png'),timeout:60000});
  }
  if(process.env.KNIFE_VIDEO==='1'){
   const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
   await page.evaluate(()=>{const P=G.Player;G.Input.reset();G.Knives.equip(P,'knife_butterfly');P.sw=null;P.raise=1;P.knifeSeen=P.a.knife;P.melee=null;for(let i=0;i<60;i++)P.updateCamera(1/60);G.Knives.start(P,'draw')});
   for(let frame=0;frame<46;frame++){
    await page.evaluate(frame=>{
     const P=G.Player;if(frame===7)G.Knives.start(P,'inspect');if(frame===34)G.Knives.start(P,'slash');
     for(let i=0;i<8;i++){P.time+=1/60;G.Knives.tick(P,1/60);P.updateCamera(1/60);G.Input.endFrame()}
     G.UI.update(8/60);G.renderNow();G.Perf.gpuWait();
    },frame);
    await page.screenshot({path:path.join(frames,String(frame).padStart(3,'0')+'.png'),timeout:60000});
   }
   require('child_process').execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','7.5','-i',path.join(frames,'%03d.png'),'-c:v','libvpx-vp9','-crf','31','-b:v','0','-pix_fmt','yuv420p',path.join(out,'knife-motions.webm')]);
   report.video={file:'knife-motions.webm',frames:46,simulatedSeconds:46*8/60};
  }
  for(const [name,kind,phase]of [['butterfly-draw','draw',.4],['butterfly-inspect','inspect',.45],['butterfly-slash','slash',.43]]){
   await page.evaluate(({kind,phase})=>{
    const id='knife_butterfly',P=G.Player;G.Knives.equip(P,id);for(let i=0;i<70;i++){P.update(1/60);G.Input.endFrame()}
    const d=G.Knives.catalog[id],duration=kind==='draw'?d.draw:kind==='inspect'?d.inspect:d.duration;
    P.melee={id,kind,t:0,duration,hit:true};for(let i=0;i<=Math.ceil(phase*60);i++){P.melee.t=i/60*duration;P.updateCamera(duration/60)}
    G.UI.update(.016);G.renderNow();G.Perf.gpuWait();
   },{kind,phase});
   await page.screenshot({path:path.join(out,name+'.png'),timeout:60000});
  }
  assert.deepEqual(f.errors,[]);report.errors=f.errors;fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));console.log('PASS 칼 6종·모션·타격·가림·전환·검사·키 재지정'+(fallback?' · 누락 복귀':''));
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
