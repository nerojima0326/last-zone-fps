// v109 목표·체크포인트·전투는 일반 경기 수명과 분리한다.
const G=window.G,T=window.THREE,up=new T.Vector3(0,1,0),temp=new T.Vector3(),aim=new T.Vector3(),SAVE='lz_zombie_save_v109',RECORDS='lz_zombie_records_v109';
const copy=value=>JSON.parse(JSON.stringify(value));
function read(key){try{const v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(e){return{}}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){G.UI.toast('브라우저 저장소가 가득 찼습니다 · 이번 판은 계속할 수 있어요')}}
export const Mode={
 active:false,finished:false,pool:[],
 async mount(){
  const box=document.createElement('div');box.id='zombieMenu';box.innerHTML='<b>정전된 도시 탈출</b><p>보급소 → 연료 운반과 발전기 → 다리 → 무전탑 → 항구. 무전을 따라 이동하며 탈출하는 1인 미션입니다.</p><label>미션 난이도 <select id="zDifficulty"></select></label><p id="zDiffNote"></p><label><input type="checkbox" id="zContinue"> 마지막 체크포인트에서 계속</label><p id="zBest"></p><small>첫 플레이 목표 12~18분 · 진행 상황 자동 저장</small>';
  document.querySelector('.menu-body').appendChild(box);const select=document.getElementById('zDifficulty');for(const[id,d]of Object.entries(this.modules.DIFFICULTIES))select.add(new Option(d.name,id));select.value=G.UI.opts.zDifficulty||'infected';select.onchange=()=>{G.UI.opts.zDifficulty=select.value;this.refreshMenu()};document.getElementById('zContinue').onchange=e=>{G.UI.opts.zContinue=e.target.checked};this.refreshMenu();this.modules.HUD.mount(this);this.menu(G.UI.opts.mode==='zombie');
 },
 refreshMenu(){const id=document.getElementById('zDifficulty').value,descriptions={survivor:'느린 감염자 · 넉넉한 탄약 · 잦은 체크포인트 · 자동 부활',infected:'기본 전투와 보급 균형 · 목표마다 체크포인트',nightmare:'빠른 무리 · 잦은 특수 감염자 · 제한된 탄약',doomsday:'체크포인트 3개 · 자동 회복 없음 · 특수 동시 출현 · 전용 업적'};document.getElementById('zDiffNote').textContent=descriptions[id];const save=read(SAVE)[id],record=read(RECORDS)[id],c=document.getElementById('zContinue');c.disabled=!save;c.checked=!!save&&!!G.UI.opts.zContinue;G.UI.opts.zContinue=c.checked;document.getElementById('zBest').textContent=(save?'저장: '+this.modules.STAGES[save.phase]?.title+' · ':'')+(record?'최고 기록 '+Math.floor(record.time/60)+'분 '+Math.round(record.time%60)+'초':'아직 탈출 기록이 없습니다');},
 menu(on){document.getElementById('menu').classList.toggle('zombie-menu',on);document.getElementById('startBtn').textContent=on?'미션 시작':'게임 시작';if(on)this.refreshMenu()},
 async prepare(o){
  this.options=o;await this.modules.Models.load();await this.modules.Nav.build();await this.modules.Scene.load();await this.modules.Sound.load();this.route=this.modules.layout(this.modules.Nav);
  document.getElementById('loadText').textContent='총기·칼·손을 나누어 준비하는 중...';
  for(const id of [...G.GUN_IDS,...G.Knives.ids]){const model=G.VM.ensure(id);if(model)await G.RenderPrep.prepare(model.root);await G.RenderPrep.turn()}
 },
 start(o){
  const game=G.Game;game.zombie=true;
  this.nativeOriginal=G.AssetVM.request;const request=this.nativeOriginal;G.AssetVM.request=function(id){if(G.Game.zombie&&!G.RenderPrep.safe()&&!this.pack(id))return Promise.resolve();return request.call(this,id)};this.active=true;this.finished=false;this.difficultyId=this.modules.DIFFICULTIES[o.zDifficulty]?o.zDifficulty:'infected';this.difficulty=this.modules.DIFFICULTIES[this.difficultyId];game.diff='normal';game.teamSize=1;game.time=0;game.ended=false;game.zone=null;game.training=false;
  this.time=0;this.phase=-1;this.phaseStart=0;this.phaseKills=0;this.history=[];this.flags={fuel:[false,false],delivered:0};this.uses={};G.Weather.lightOn=true;this.stats={kills:0,heads:0,shots:0,hits:0,combo:0,bestCombo:0,retries:0,weapons:[],phaseTimes:[],route:null};this.hitShots=new Set();this.carry=null;this.grabbed=null;this.hold=null;this.hurtAt=-99;this.deadAt=null;this.spawnT=3;this.cinematic=null;this.checkpoint=null;
  const a=new G.Actor({id:0,name:o.name||'생존 부대원',team:0,isPlayer:true});a.model=new G.CharacterModel({helmet:false});G.scene.add(a.model.root);a.model.root.visible=false;
  a.give('ar7',Math.round(90*this.difficulty.ammo),'reddot');a.give('p92',Math.round(45*this.difficulty.ammo));a.cur='rifle';a.meds={bandage:5,medkit:2};a.throwables={frag:3,smoke:2,molotov:2,flash:2};a.bag=2;a.vest=0;a.helmet=0;
  for(const id of Object.keys(a.scopes))a.scopes[id]=1;for(const id of Object.keys(G.Attachments.catalog()))a.attachmentBag[id]=1;
  a.state='ground';a.onGround=true;a.pos.copy(this.route.start);a.yaw=Math.atan2(a.pos.x-this.route.rally.x,a.pos.z-this.route.rally.z);game.player=a;game.actors=[a];game.teams=[{id:0,members:[a],eliminated:false,kills:0},{id:1,members:[],eliminated:false,kills:0}];G.Player.init(a);G.Player.onLand();game.state='playing';G.UI.startMatch();document.getElementById('hud').classList.add('zombie-hud');
  this.pool=[];this.modules.Models.attach();for(let i=0;i<72;i++){const enemy=new G.Actor({id:i+1,name:'감염자',team:1});enemy.zombie=true;enemy.alive=false;enemy.state='ground';this.pool.push(enemy);game.actors.push(enemy);game.teams[1].members.push(enemy)}
  this.scene=this.modules.Scene;this.scene.configure(this);this.audio=this.modules.Sound;this.audio.start(this);this.modules.HUD.start();const saved=o.zContinue?read(SAVE)[this.difficultyId]:null;
  if(saved&&this.validSave(saved)){this.restore(saved,true)}else{this.enter(0);for(let i=0;i<10;i++)this.spawnNear('walker');this.cinematic={t:0,duration:6,kind:'intro'};}
  this.resetClock();
 },
 async ready(){await this.modules.Models.ready();await this.scene.ready();this.modules.Models.update(this.pool,this.time);},
 resetClock(){this.last=performance.now()},
 enter(n,restored=false){
  if(this.phase>=0&&!restored){const item={phase:this.phase,name:this.modules.STAGES[this.phase].title,seconds:this.time-this.phaseStart,kills:this.phaseKills};this.stats.phaseTimes.push(item);this.history.push({event:'complete',...item,time:this.time});}
  this.phase=n;this.phaseStart=this.time;this.phaseKills=0;this.hold=null;this.scene.activate(n);this.scene.activate(n+1);this.scene.prefetch(n+2);this.spawnT=2;this.history.push({event:'enter',phase:n,time:this.time});this.radio(this.modules.STAGES[n].radio,'통제소',12);this.modules.HUD.objective(this.modules.STAGES[n].title);
  if(this.difficulty.checkpoints.includes(n)&&!restored)this.saveCheckpoint();
 },
 snapshot(){const a=G.Game.player,inventory={};for(const key of ['weapons','ammo','meds','throwables','scopes','attachmentBag','cur','knife','vest','helmet','bag','hp'])inventory[key]=copy(a[key]);return{schema:109,mission:'blackout',difficulty:this.difficultyId,phase:this.phase,phaseStart:this.phaseStart,time:this.time,flags:copy(this.flags),uses:copy(this.uses),inventory,position:a.pos.toArray(),yaw:a.yaw,stats:copy(this.stats),history:copy(this.history)}} ,
 validSave(s){return s?.schema===109&&s.mission==='blackout'&&Number.isInteger(s.phase)&&s.phase>=0&&s.phase<6&&Number.isFinite(s.time)&&s.time>=0&&s.time<20000&&s.position?.length===3&&s.position.every(Number.isFinite)&&s.inventory?.weapons&&s.flags?.fuel?.length===2&&s.stats?.phaseTimes&&s.difficulty===this.difficultyId},
 saveCheckpoint(){this.checkpoint=this.snapshot();const saves=read(SAVE);saves[this.difficultyId]=this.checkpoint;write(SAVE,saves);this.modules.HUD.checkpoint('체크포인트 저장 · '+this.modules.STAGES[this.phase].title)},
 restore(saved,continuing=false){
  if(!this.validSave(saved))return false;const total=this.stats?.retries||0,elapsed=this.time;this.checkpoint=copy(saved);this.time=continuing?saved.time:Math.max(elapsed,saved.time);this.phase=saved.phase;this.phaseStart=this.time;this.phaseKills=0;this.flags=copy(saved.flags);this.uses=copy(saved.uses);this.stats=copy(saved.stats);this.stats.retries=Math.max(total,this.stats.retries)+(continuing?1:1);this.history=copy(saved.history||[]);this.history.push({event:'retry',time:this.time,phase:this.phase});this.carry=null;this.grabbed=null;this.hold=null;this.deadAt=null;this.finished=false;this.hitShots.clear();
  const a=G.Game.player;if(G.Player.vehicle)G.Vehicles.exit(G.Player,true);for(const[key,value]of Object.entries(saved.inventory))a[key]=copy(value);a.hp=Math.max(1,a.hp);a.alive=true;a.knocked=false;a.prone=false;a.crouch=false;a.vel.set(0,0,0);a.pos.fromArray(saved.position);a.yaw=saved.yaw;a.state='ground';a.onGround=true;this.hurtAt=this.time;
  for(const z of this.pool){z.alive=false;if(z.z)z.z.visible=false}G.Ballistics.reset();G.Throwables.reset();G.Player.init(a);G.Player.onLand();G.Game.state='playing';G.Game.time=this.time;G.Game.ended=false;G.paused=false;this.scene.openDoor();if(this.phase===0||this.phase===1&&!this.flags.door){this.scene.doorOpen=false;this.scene.doorItem.hidden=false;this.scene.batches.get('barrier').changed=true;G.World.removeCollider(this.scene.doorBox);this.scene.doorBox=this.scene.box(this.scene.doorPos,3.2,.7,1)}
  this.flags.fuel.forEach((v,i)=>{this.scene.batches.get('fuel').items.find(x=>x.id==='fuel'+i).hidden=v});this.scene.batches.get('fuel').changed=true;if(this.flags.bridgeRoute)this.scene.openGate();this.scene.setPower(!!this.flags.power);this.scene.activate(this.phase);this.scene.flush();this.modules.HUD.closeResult();this.modules.HUD.start();this.modules.HUD.objective(this.modules.STAGES[this.phase].title);this.modules.HUD.checkpoint('체크포인트에서 재시작 · 탄약과 체력 복구');this.resetClock();return true;
 },
 update(){
  const now=performance.now();if(document.hidden){this.last=now;return}const elapsed=Math.min(1,Math.max(.001,(now-this.last)/1000));this.last=now;let left=elapsed,first=true;const I=G.Input,hits=I.hits,dx=I.mdx,dy=I.mdy,lmb=I.lmbHit,rmb=I.rmbHit,wheel=I.wheel;
  while(left>.0001&&this.active&&!this.finished){const dt=Math.min(.05,left);this.time+=dt;G.Game.time=this.time;
   if(this.deadAt!==null){if(this.time-this.deadAt>=2)this.restore(this.checkpoint);left-=dt;continue}
   if(!first){I.mdx=I.mdy=0;I.hits={};I.lmbHit=I.rmbHit=false;I.wheel=0}this.step(dt);first=false;left-=dt;
  }
  I.hits=hits;I.mdx=dx;I.mdy=dy;I.lmbHit=lmb;I.rmbHit=rmb;I.wheel=wheel;this.modules.Models.update(this.pool,this.time);this.scene?.update(elapsed);this.audio?.update(elapsed);this.modules.HUD.update(elapsed);
 },
 step(dt){
  const a=G.Game.player;if(this.cinematic){this.cinematic.t+=dt;if(G.Input.hit('Space')||G.Input.hit('KeyF')||this.cinematic.t>=this.cinematic.duration){this.cinematic=null;if(this.flags.escaped){this.finish(true);return}}}
  if(G.Input.hit('KeyX')||this.grabbed&&(G.Input.hit('KeyF')||G.Input.lmb))this.shove();
  if(this.grabbed){this.grabbed.time-=dt;if(this.grabbed.time<=0)this.grabbed=null;}
  this.scene.checkBreach();G.Player.update(dt);this.cameraSequence(dt);this.modules.Nav.refresh(a.pos,dt);for(const z of this.pool)z.brain?.update(dt);G.Game.syncModels(dt);this.modules.Models.syncContacts(this.pool,this.time);G.Ballistics.update(dt);G.Throwables.update(dt);G.Game.updateLoot(dt);G.Extras.update(dt);
  if(this.difficulty.heal&&a.hp<100&&this.time-a.lastHurtT>9&&this.time-this.hurtAt>9)a.hp=Math.min(100,a.hp+dt*1.7);
  this.director(dt);this.objectives(dt);
 },
 // v109 카메라 연출은 짧게 재생하고 언제든 건너뛴다.
 cameraSequence(dt){const c=this.cinematic;if(!c)return;const a=G.Game.player,cam=G.camera;if(c.kind==='intro'){const t=c.t/c.duration,position=a.pos.clone().add(new T.Vector3(Math.cos(a.yaw)*(.4*(1-t)),1.68,Math.sin(a.yaw)*(.4*(1-t))));cam.position.lerp(position,1-Math.exp(-dt*6));temp.copy(this.route.rally).sub(a.pos).normalize().multiplyScalar(20).add(a.pos);temp.y=a.pos.y+1.6;cam.lookAt(temp);}else{const h=this.scene.heliPosition||this.route.harbor;a.pos.copy(h).add(new T.Vector3(.4,.8,0));G.Player.camMode='extract';cam.position.copy(h).add(new T.Vector3(7,4,8));temp.copy(h).add(new T.Vector3(0,1.5,0));cam.lookAt(temp);G.VM.set(null);}},
 director(dt){
  this.spawnT-=dt;if(this.spawnT>0)return;const a=G.Game.player,combat=this.phase===1&&this.flags.door||this.phase===2&&this.flags.defend||this.phase===4&&this.flags.signal||this.phase===5&&this.flags.evacStarted;
  const max=combat?this.difficulty.cap:Math.min(18,this.difficulty.cap),alive=this.pool.filter(z=>z.alive).length;this.spawnT=this.difficulty.spawn*(combat?1:1.5);const choices=['walker','walker','walker','runner'];if(this.phase>=2){choices.push('screamer','exploder');if(this.phase>=3||this.difficultyId==='nightmare'||this.difficultyId==='doomsday')choices.push('tank')}
  for(let i=0;i<(combat?3:1)&&alive+i<max;i++)this.spawnNear(choices[Math.floor(Math.random()*choices.length)]);
  // v109 이동 경로 뒤에 남은 적은 보이지 않는 먼 거리에서만 회수한다.
  for(const z of this.pool)if(z.alive&&z.pos.distanceTo(a.pos)>150){z.alive=false;z.z.visible=false;}
 },
 spawn(kind,pos){const alive=this.pool.reduce((n,a)=>n+(a.alive?1:0),0);if(alive>=this.difficulty.cap)return null;let a=this.pool.find(a=>!a.alive&&(!a.z?.visible||this.time-a.deathTime>7));if(!a)return null;const d=this.modules.TYPES[kind];a.alive=true;a.hp=d.hp*this.difficulty.hp;a.pos.copy(pos);a.vel.set(0,0,0);a.knocked=false;a.prone=false;a.deathTime=-99;a.name=d.name;a.z={kind,variant:a.id%2,scale:d.scale,typeIndex:d.index,visible:true,contacts:[],pattern:0,clip:null};a.brain=new this.modules.Brain(a,this,this.modules.Nav,this.modules.Models);this.modules.Models.animate(a,'idle',this.time);this.modules.Models.contacts(a,a.z.contacts);return a},
 spawnNear(kind){const a=G.Game.player;for(let i=0;i<5;i++){const angle=Math.random()*Math.PI*2,d=32+Math.random()*26;try{const p=this.modules.Nav.nearest(a.pos.x+Math.sin(angle)*d,a.pos.z+Math.cos(angle)*d,12);if(p.distanceTo(a.pos)<23||Math.abs(p.y-a.pos.y)>17)continue;return this.spawn(kind,p)}catch(e){}}return null},
 target(){const r=this.route,a=G.Game.player;if(this.phase===0)return{p:r.rally,label:'정찰 무전기',action:'relay',hold:1.5};if(this.phase===1)return!this.flags.door?{p:this.scene.doorPos,label:'보급소 개방',action:'door',hold:3}:{p:r.supply,label:this.phaseKills>=18?'보급품 확보':'감염자 '+this.phaseKills+'/18',action:this.phaseKills>=18?'supply':null,hold:2};
  if(this.phase===2){if(this.carry!==null)return{p:r.generator,label:'연료 투입',action:'deliver',hold:2};if(this.flags.delivered<2){let i=this.flags.fuel[0]?1:0;if(!this.flags.fuel[0]&&!this.flags.fuel[1])i=a.pos.distanceTo(r.fuel[0])<a.pos.distanceTo(r.fuel[1])?0:1;return{p:r.fuel[i],label:'연료통 '+(i+1)+' 회수',action:'fuel'+i,hold:1.3}}return{p:r.generator,label:this.flags.defend?'발전기 방어 '+Math.ceil(90-this.flags.defenseTime)+'초':'발전기 가동',action:this.flags.defend?null:'startGenerator',hold:3};}
  if(this.phase===3)return this.flags.bridgeRoute?{p:r.far,label:'다리 건너기 · 감염자 '+this.phaseKills+'/12',action:null,hold:0}:{p:r.foot,label:'보행 통로 잠금 해제 / 차량으로 돌파',action:'foot',hold:5};
  if(this.phase===4)return!this.flags.signal?{p:r.towerTop,label:'무전탑 구조 신호 송출',action:'signal',hold:4}:{p:this.boss?.pos||r.tower,label:'차단자 제거 · 등의 약점',action:null,hold:0};
  if(this.phase===5){if(!this.flags.evacStarted)return{p:r.harbor,label:'착륙장 구조 요청',action:'evac',hold:3};const left=this.difficulty.evac-(this.time-this.flags.evacStarted);return{p:r.harbor,label:left>0?'헬기 도착 '+Math.ceil(left)+'초':'구조 헬기 탑승',action:left<=0?'board':null,hold:3}}
  return null;
 },
 interact(dt){
  if(!this.active||this.finished)return false;const a=G.Game.player,target=this.target();this.interactionLabel='';let nearest=null;
  const actions=[];if(target?.action)actions.push(target);if(this.phase>=2||this.phase===1&&this.flags.door&&this.phaseKills>=18)for(const[key,p]of [['cache',this.route.supply],['gen-cache',this.route.generator.clone().add(new T.Vector3(4,0,1))],['tower-cache',this.route.tower.clone().add(new T.Vector3(6,0,0))],['harbor-cache',this.route.harbor.clone().add(new T.Vector3(-8,0,0))]])if((this.uses[key]||0)<2)actions.push({p,label:'탄약·치료 보급 / 장비 선택',action:'cache:'+key,hold:2});
  if(this.phase===2&&this.scene.barricadeHp<100)actions.push({p:this.scene.repairPos,label:'바리케이드 보강 '+Math.ceil(this.scene.barricadeHp)+'%',action:'repair',hold:3});
  let best=3.2;for(const action of actions){const d=a.pos.distanceTo(action.p);if(d<best){best=d;nearest=action}}
  if(!nearest){this.hold=null;return false}this.interactionLabel=nearest.label;G.Player.prompt='<kbd>'+G.Settings.label('KeyF')+'</kbd> 길게 · '+nearest.label;
  if(G.Input.down('KeyF')&&!G.Player.vehicle){if(!this.hold||this.hold.action!==nearest.action)this.hold={action:nearest.action,t:0,duration:nearest.hold};this.hold.t+=dt;if(this.hold.t>=this.hold.duration){const action=this.hold.action;this.hold=null;this.act(action)}}else this.hold=null;return true;
 },
 act(action){const a=G.Game.player,r=this.route;
  if(action==='relay'){this.flags.relay=true;this.radio('접수했다. 주변 감염자를 정리하고 보급소로 이동하라.');}
  else if(action==='door'){this.flags.door=true;this.scene.openDoor();this.radio('문 개방. 소리에 몰려온다. 보급소 주변을 확보하라.');for(let i=0;i<12;i++)this.spawnNear(i%4===0?'runner':'walker')}
  else if(action==='supply'){this.resupply('cache');this.enter(2)}
  else if(action.startsWith('fuel')){const i=Number(action.slice(4));if(this.flags.fuel[i])return;this.flags.fuel[i]=true;this.carry=i;this.scene.hide(this.scene.batches.get('fuel').items.find(x=>x.id==='fuel'+i));G.Player.switchTo('pistol');this.radio('연료통 확보. 발전기로 운반하라. 주무기는 사용할 수 없다.')}
  else if(action==='deliver'){if(this.carry===null)return;this.flags.delivered++;this.carry=null;G.Player.switchTo('rifle');this.radio('연료 투입 '+this.flags.delivered+'/2');}
  else if(action==='startGenerator'){this.flags.defend=true;this.flags.defenseTime=0;this.flags.generatorHp=100;this.radio('시동 절차 90초. 발전기 주변을 지켜라. 바리케이드를 보강할 수 있다.');for(let i=0;i<32;i++)this.spawnNear(i%5===0?'exploder':'walker')}
  else if(action==='foot'){this.flags.bridgeRoute='foot';this.stats.route='foot';this.scene.openFoot();this.radio('옆 통로 개방. 난간 안쪽으로 걸어서 건너라.')}
  else if(action==='signal'){this.flags.signal=true;const p=this.modules.Nav.nearest(r.tower.x-12,r.tower.z-12);this.boss=this.spawn('boss',p);if(!this.boss){const z=this.pool.find(z=>z.alive);if(z){z.alive=false;z.z.visible=false}this.boss=this.spawn('boss',p)}this.radio('구조 신호 수신. 큰 감염자가 탑을 부순다! 등에 빛나는 조직을 노려!');}
  else if(action==='evac'){this.flags.evacStarted=this.time;this.radio('구조 헬기 출발. 착륙장을 지키고, 도착하면 기체 옆에서 탑승하라.');for(let i=0;i<18;i++)this.spawnNear(i%6===0?'tank':i%4===0?'screamer':'walker')}
  else if(action==='board'){this.flags.escaped=true;this.cinematic={t:0,duration:6,kind:'extract'};this.radio('전원 탑승 확인. 감염 구역에서 이탈한다!','조종사',6)}
  else if(action==='repair'){this.scene.barricadeHp=100;if(this.scene.repairItem.hidden){this.scene.repairItem.hidden=false;this.scene.repairBox=this.scene.box(this.scene.repairPos,3.2,.7,1);this.scene.batches.get('barrier').changed=true}this.audio?.ui('repair')}
  else if(action.startsWith('cache:'))this.resupply(action.slice(6));
  this.history.push({event:'action',action,phase:this.phase,time:this.time});
 },
 objectives(dt){const p=G.Game.player.pos,r=this.route;if(this.phase===0&&this.flags.relay&&this.phaseKills>=8&&p.distanceTo(r.rally)<12)this.enter(1);
  else if(this.phase===2&&this.flags.defend){if(p.distanceTo(r.generator)<48)this.flags.defenseTime+=dt;else this.modules.HUD.warning='발전기로 돌아가세요 · 방어 진행 일시 정지';const near=this.pool.filter(z=>z.alive&&z.pos.distanceTo(r.generator)<3.5).length;if(near&&p.distanceTo(r.generator)>18)this.flags.generatorHp=Math.max(0,this.flags.generatorHp-dt*near*.55);if(this.flags.generatorHp<=0)this.finish(false,'발전기가 파괴됐습니다');else if(this.flags.defenseTime>=90){this.flags.power=true;this.scene.setPower(true);this.enter(3)}}
  else if(this.phase===3&&this.flags.bridgeRoute&&this.phaseKills>=12&&p.distanceTo(r.far)<20){this.stats.route=this.flags.bridgeRoute;this.enter(4)}
  else if(this.phase===4&&this.flags.signal&&this.boss&&!this.boss.alive)this.enter(5);
  else if(this.phase===5&&this.flags.evacStarted&&this.time-this.flags.evacStarted>this.difficulty.evac+55&&!this.flags.escaped)this.finish(false,'헬기가 대기 시간을 초과했습니다');
 },
 resupply(id){if((this.uses[id]||0)>=2)return;this.uses[id]=(this.uses[id]||0)+1;const a=G.Game.player,choice=this.modules.HUD.loadout();if(G.WEAPONS[choice.gun]?.cls)a.give(choice.gun,0,choice.scope);if(G.Knives.ids.includes(choice.knife))a.knife=choice.knife;
  for(const w of Object.values(a.weapons)){if(!w)continue;const d=G.WEAPONS[w.id];a.ammo[d.ammo]=Math.min(a.ammoMax(d.ammo),a.ammo[d.ammo]+Math.round(d.mag*4*this.difficulty.ammo));w.mag=d.mag}a.meds.bandage=Math.min(a.bandageMax(),a.meds.bandage+3);a.meds.medkit=Math.min(a.medkitMax(),a.meds.medkit+1);a.throwables.frag=Math.min(a.throwMax(),a.throwables.frag+2);this.modules.HUD.checkpoint('보급 완료 · 상자 잔여 '+(2-this.uses[id])+'회');this.audio?.ui('supply');},
 recordShot(id){this.stats.shots++;if(!this.stats.weapons.includes(id))this.stats.weapons.push(id);return this.stats.shots},
 damage(t,amount,attacker,weapon,head,point,dir,shot){
  if(!t.alive||this.finished||this.flags.escaped)return;const from=attacker===G.Game.player;if(t.zombie){if(attacker?.zombie&&weapon!=='폭발')return;const region=this.modules.Combat.region(t,point,head);if(region==='head')amount*=1.8;if(region==='leg'){t.z.legDamage=(t.z.legDamage||0)+amount;if(t.z.legDamage>32){t.z.crawl=true;t.prone=true}}if(region==='arm')t.z.armHit=true;if(t.z.kind==='boss'){const back=dir&&(dir.x*Math.sin(t.yaw)+dir.z*Math.cos(t.yaw))<-.25,h=point?(point.y-t.pos.y)/t.z.scale:0,side=point?Math.abs((point.x-t.pos.x)*Math.cos(t.yaw)-(point.z-t.pos.z)*Math.sin(t.yaw))/t.z.scale:99,weak=back&&h>1.05&&h<1.58&&side<.31;amount*=weak?3.8:head?.9:.6;if(weak)t.z.weakAt=this.time;}
   if(from){if(shot&&!this.hitShots.has(shot)){this.hitShots.add(shot);this.stats.hits++;}if(!this.stats.weapons.includes(weapon))this.stats.weapons.push(weapon);G.UI.hitmarker(head,amount>=t.hp);G.Audio.hit(head,amount>=t.hp,false);}t.hp-=amount;t.lastHurtT=this.time;if(this.time>=(t.z.staggerAt||0)){t.z.hurtUntil=this.time+(t.z.kind==='boss'||t.z.kind==='tank'?.07:.22);t.z.staggerAt=this.time+(t.z.kind==='boss'?1.3:.7);}if(t.hp<=0)this.kill(t,attacker,weapon,head);else t.brain.onHurt(attacker||G.Game.player);
  }else{if(this.time-this.hurtAt<.25)return;this.hurtAt=this.time;t.hp=Math.max(0,t.hp-amount*this.difficulty.damage);t.lastHurtT=this.time;G.UI.hurt(amount,attacker?.pos);G.Audio.hurt();G.Player.cancelHeal();if(!t.hp)this.kill(t,attacker,weapon,head);}
 },
 kill(t,attacker,weapon,head){if(!t.alive)return;t.alive=false;t.hp=0;t.deathTime=this.time;t.vel.set(0,0,0);if(t.zombie){this.modules.Models.animate(t,'death',this.time);if(attacker===G.Game.player){attacker.kills++;G.Game.teams[0].kills++;this.stats.kills++;if(head)this.stats.heads++;this.stats.combo=this.time-(this.lastKill||-99)<4?this.stats.combo+1:1;this.stats.bestCombo=Math.max(this.stats.bestCombo,this.stats.combo);this.lastKill=this.time;this.phaseKills++;}const corpses=this.pool.filter(a=>!a.alive&&a.z?.visible).sort((a,b)=>a.deathTime-b.deathTime);while(corpses.length>10){const a=corpses.shift();a.z.visible=false;}}
  else if(this.difficulty.revive){this.deadAt=this.time;this.modules.HUD.checkpoint('2초 후 체크포인트에서 자동 부활')}else this.finish(false,'감염자에게 쓰러졌습니다');
 },
 attack(a,amount,knock){const p=G.Game.player;this.damage(p,amount,a,'감염자',false,p.pos);this.audio?.voice(a,'attack');if(knock){p.vel.x+=Math.sin(a.yaw)*-4;p.vel.z+=Math.cos(a.yaw)*-4;G.FX.shake(.2)}if(!this.grabbed&&a.z.kind==='walker'&&!a.z.crawl&&Math.random()<.12){this.grabbed={a,time:3,push:0};this.modules.HUD.checkpoint('붙잡혔습니다 · '+G.Settings.label('KeyX')+' 밀쳐내기 / 근접 공격 · '+G.Settings.label('KeyF')+' 연타')}},
 shove(){if(this.time-(this.shoveAt||-99)<.35)return;this.shoveAt=this.time;if(this.grabbed){this.grabbed.push++;if(this.grabbed.push>=2)this.grabbed=null;}const p=G.Game.player;for(const a of this.pool){if(!a.alive||a.pos.distanceTo(p.pos)>2.6)continue;temp.copy(a.pos).sub(p.pos).setY(0).normalize();a.vel.copy(temp).multiplyScalar(7);G.Physics.move(a,.13);a.z.hurtUntil=this.time+.9;this.modules.Models.animate(a,'hurt',this.time);this.damage(a,14,p,a.knife||'knife_combat',false,a.pos);}G.VM.bump(-.12,.05,-.22,.03);G.Player.camKick+=.012;G.Audio.click('land');},
 summon(a){for(const z of this.pool)if(z.alive)z.brain.hear(a.pos);for(let i=0;i<(this.difficultyId==='doomsday'?5:3);i++)this.spawnNear('runner')},
 explode(a){if(!a.alive)return;const p=a.pos.clone();this.kill(a,null,'폭발',false);G.FX.explosion(p);this.audio?.voice(a,'attack');const player=G.Game.player,d=player.pos.distanceTo(p);if(d<6)this.damage(player,34*(1-d/7),a,'폭발',false,p);for(const z of this.pool)if(z.alive&&z.pos.distanceTo(p)<6)this.damage(z,110*(1-z.pos.distanceTo(p)/7),player,'폭발',false,z.pos);},
 bossPulse(a,r){G.FX.shake(.22);G.FX.dust(a.pos,12,0,1.8,0,.3,.28,.24,1.3);if(a.pos.distanceTo(G.Game.player.pos)<r)this.attack(a,25,true)},
 radio(text,speaker='통제소',duration=8){this.modules.HUD.radio(text,speaker,duration);this.audio?.ui('radio')},
 finish(win,reason=''){if(this.finished)return;this.finished=true;this.carry=null;this.grabbed=null;G.Game.state='ended';G.Game.ended=true;G.Input.unlock();G.VM.set(null);const current={phase:this.phase,name:this.modules.STAGES[this.phase].title,seconds:this.time-this.phaseStart,kills:this.phaseKills};this.stats.phaseTimes.push(current);this.result={win,reason,time:this.time,difficulty:this.difficultyId,stats:copy(this.stats)};
  if(win){const all=read(RECORDS),old=all[this.difficultyId];if(!old||old.time>this.time)all[this.difficultyId]={time:this.time,kills:this.stats.kills,date:new Date().toISOString()};write(RECORDS,all);const saves=read(SAVE);delete saves[this.difficultyId];write(SAVE,saves);const achievements=read('lz_zombie_achievements');achievements.escape=true;if(this.stats.weapons.length===1)achievements.oneWeapon=true;if(!this.stats.retries)achievements.noRetry=true;if(this.difficultyId==='doomsday')achievements.doomsday=true;write('lz_zombie_achievements',achievements);this.result.achievements=achievements;}this.history.push({event:win?'escape':'fail',time:this.time,phase:this.phase});this.modules.HUD.result(this.result);this.audio?.finish(win);},
 stop(){if(this.nativeOriginal){G.AssetVM.request=this.nativeOriginal;this.nativeOriginal=null}this.modules.Models.detach();this.scene?.stop();this.modules.Nav.clear();this.audio?.stop();this.modules.HUD?.stop();this.pool=[];this.active=false;this.finished=false;G.Game.zombie=false;document.getElementById('hud').classList.remove('zombie-hud');}
};
