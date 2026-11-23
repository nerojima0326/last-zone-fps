// 같은 총기·거리의 30초 사격 기록만 비교한다. 중단한 측정은 저장하지 않는다.
(function () {
'use strict';
const G=window.G,T=window.THREE,KEY='lastzone_training_records_v1',DIST=[10,25,50,100];
const pct=(n,d)=>d?100*n/d:0,number=n=>Number.isFinite(n)&&n>=0;
const R=G.TrainingRecords={
  history:[],run:null,serial:0,open:false,notice:'',
  valid(r){return r&&G.GUN_IDS.includes(r.weapon)&&DIST.includes(r.distance)&&r.duration===30&&number(r.at)&&r.at<8.64e15&&Number.isInteger(r.shots)&&r.shots>0&&r.shots<=6000&&Number.isInteger(r.hits)&&r.hits>=0&&r.hits<=r.shots&&Number.isInteger(r.heads)&&r.heads>=0&&r.heads<=r.hits&&Number.isInteger(r.downs)&&r.downs>=0&&r.downs<=r.hits&&(r.ttk===null||number(r.ttk)&&r.ttk<=30)},
  load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'null');this.history=d?.version===1&&Array.isArray(d.history)?d.history.filter(r=>this.valid(r)).slice(-60):[]}catch(e){this.history=[]}},
  save(){try{localStorage.setItem(KEY,JSON.stringify({version:1,history:this.history}));return true}catch(e){return false}},
  key(r){return r.weapon+':'+r.distance},
  comparable(r){return this.history.filter(x=>this.key(x)===this.key(r))},
  best(rows){return rows.slice().sort((a,b)=>b.downs-a.downs||pct(b.hits,b.shots)-pct(a.hits,a.shots)||(a.ttk??31)-(b.ttk??31))[0]||null},
  start(distance){
    const a=G.Game.player,inst=a?.weapons[a.cur];distance=Number(distance);
    const target=G.Training.targets.find(t=>t.kind==='sil'&&t.d===distance&&!t.move&&!t.kh&&!t.zone);
    if(!G.Training.active||!inst||!G.GUN_IDS.includes(inst.id)||!DIST.includes(distance)||!target){this.notice='훈련장에서 총기를 든 뒤 측정할 수 있습니다.';this.render();return false}
    if(G.Player.throwSt){this.notice='투척 동작을 끝낸 뒤 시작하세요.';this.render();return false}
    const ground=G.World.ground(target.root.position.x,target.root.position.z+distance,G.World.range.y+5,.3,.6);
    a.pos.set(target.root.position.x,ground,target.root.position.z+distance);a.vel.set(0,0,0);a.yaw=0;a.pitch=0;
    a.crouch=a.prone=false;a.onGround=true;a.hspeed=0;G.Player.reload=null;G.Player.autoReload=null;G.Player.sw=null;G.Player.raise=1;G.Player.ads=0;
    G.Player.sprinting=false;G.Player.camKick=G.Player.bloom=G.Player.recoilAcc=0;G.Player.cycleT=G.Player.pumpT=-1;G.Player.nextFire=G.Player.time;
    G.VM.sprint=G.VM.kick=G.VM.kickV=0;G.VM.sway.x=G.VM.sway.y=0;G.PoseRecovery?.reset();G.WeaponMotion?.reset(G.VM);G.Ballistics.reset();
    inst.mag=G.Attachments?.capacity(inst,G.WEAPONS[inst.id])||G.WEAPONS[inst.id].mag;
    target.hp=100;target.down=target.fall=target.fd=0;target.fh=false;target.pivot.rotation.x=0;target.root.updateMatrixWorld(true);
    this.run={id:++this.serial,weapon:inst.id,distance,target,origin:a.pos.clone(),elapsed:0,shots:0,hits:0,heads:0,downs:0,ttks:[],firstHit:null};
    this.notice='';G.Input.lmb=G.Input.lmbHit=false;this.close(false);G.paused=false;G.UI.showPause(false);G.Input.lock();
    G.UI.toast('30초 측정 시작 · 정면 표적을 조준하세요 · 이동·총기 변경 시 중단');return true;
  },
  abort(message='측정을 중단했습니다. 기록은 저장하지 않습니다.'){
    if(!this.run)return;this.run=null;this.notice=message;G.UI.toast(message);G.Training.dirty=true;
  },
  onShot(shot){if(this.run&&this.run.elapsed<30){this.run.shots++;shot.drill=this.run.id}},
  onHit(hit,shot){
    const r=this.run;if(!r||r.elapsed>=30||hit.target!==r.target||shot?.drill!==r.id)return;
    if(!shot.drillHit){shot.drillHit=true;r.hits++}
    if(hit.head&&!shot.drillHead){shot.drillHead=true;r.heads++}
    if(r.firstHit===null)r.firstHit=r.elapsed;
  },
  onDown(target){const r=this.run;if(!r||r.elapsed>=30||r.target!==target||r.firstHit===null)return;r.downs++;r.ttks.push(Math.max(0,r.elapsed-r.firstHit));r.firstHit=null},
  tickClock(now,active){const r=this.run;if(!r)return;if(!active){r.clock=null;return}if(r.clock!=null)r.elapsed=Math.min(30,r.elapsed+Math.max(0,(now-r.clock)/1000));r.clock=now},
  update(dt){
    const r=this.run;if(!r)return;
    const a=G.Game.player,inst=a?.weapons[a.cur];
    if(!G.Training.active||!a?.alive||inst?.id!==r.weapon||Math.hypot(a.pos.x-r.origin.x,a.pos.z-r.origin.z)>1.5||G.Player.vehicle||G.Player.throwSt){this.abort('위치·총기가 바뀌어 측정을 중단했습니다.');return}
    if(Math.floor(r.elapsed*5)!==this.tick){this.tick=Math.floor(r.elapsed*5);G.Training.dirty=true}
    if(r.elapsed>=30)this.finish();
  },
  finish(){
    const r=this.run;if(!r)return null;this.run=null;
    if(!r.shots){this.notice='발사 기록이 없어 저장하지 않았습니다.';G.UI.toast(this.notice);return null}
    const row={weapon:r.weapon,distance:r.distance,duration:30,at:Date.now(),shots:r.shots,hits:r.hits,heads:r.heads,downs:r.downs,ttk:r.ttks.length?r.ttks.reduce((a,b)=>a+b,0)/r.ttks.length:null};
    if(!this.valid(row)){this.notice='측정 기록을 저장하지 못했습니다.';return null}
    const previous=this.comparable(row).at(-1),oldBest=this.best(this.comparable(row));
    this.history.push(row);this.history=this.history.slice(-60);const saved=this.save();this.last=row;
    this.notice=saved?'30초 측정 완료 · 같은 총·거리의 이전 기록과 비교합니다.':'브라우저에 저장할 수 없어 이번 실행에서만 기록을 보관합니다.';
    this.comparison={previous,best:oldBest};this.show();G.Training.dirty=true;return row;
  },
  metric(row){return row?`${row.downs}개 처치 · 명중 ${pct(row.hits,row.shots).toFixed(1)}% · 헤드샷 ${pct(row.heads,row.hits).toFixed(1)}% · 평균 처치 ${row.ttk===null?'-':row.ttk.toFixed(2)+'초'}`:'아직 기록이 없습니다.'},
  render(){
    if(!this.panel)return;
    const weapon=document.getElementById('recordGun').value||'ar7',distance=Number(document.getElementById('recordDistance').value)||25;
    const rows=this.comparable({weapon,distance}),latest=rows.at(-1),previous=rows.at(-2),best=this.best(rows);
    document.getElementById('recordWeapon').textContent=G.WEAPONS[weapon]?.name||'총기를 선택하세요';
    document.getElementById('recordNotice').textContent=this.notice;
    document.getElementById('recordStart').disabled=!G.Training.active||weapon!==G.Game.player?.weapons[G.Game.player.cur]?.id;
    document.getElementById('recordStop').hidden=!this.run;
    const fmt=row=>row?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(row.at):'';
    let html=`<div class="record-cards"><article><b>최근 기록</b><p>${this.metric(latest)}</p></article><article><b>이전 기록</b><p>${this.metric(previous)}</p></article><article><b>최고 기록</b><p>${this.metric(best)}</p></article></div>`;
    if(latest&&previous){const delta=pct(latest.hits,latest.shots)-pct(previous.hits,previous.shots),ttk=latest.ttk!==null&&previous.ttk!==null?` · 처치 시간 ${(latest.ttk-previous.ttk).toFixed(2)}초`:'';html+=`<p class="record-delta">이전 대비 명중률 ${delta>=0?'+':''}${delta.toFixed(1)}%p · 처치 ${latest.downs-previous.downs>=0?'+':''}${latest.downs-previous.downs}개${ttk}</p>`}
    html+='<p class="record-help">처치 시간은 첫 명중부터 쓰러뜨릴 때까지입니다. 최고 기록은 처치 수 → 명중률 → 처치 시간 순입니다.</p><ol class="record-history">';
    for(const row of rows.slice(-10).reverse())html+=`<li><time>${fmt(row)}</time><span>${this.metric(row)}</span></li>`;
    document.getElementById('recordBody').innerHTML=html+'</ol>';
  },
  show(){
    if(this.open)return;this.open=true;this.wasPaused=G.paused;G.paused=G.Game.state==='playing'?true:G.paused;G.Input.unlock();G.UI.showPause(false);
    this.panel.classList.remove('hidden');document.getElementById('recordGun').value=G.Game.player?.weapons[G.Game.player.cur]?.id||this.last?.weapon||'ar7';if(this.last)document.getElementById('recordDistance').value=String(this.last.distance);this.render();this.panel.querySelector('.panel').scrollTop=0;document.getElementById('recordGun').focus({preventScroll:true});
  },
  close(resume=true){
    if(!this.open)return;this.open=false;this.panel.classList.add('hidden');
    if(G.Game.state==='playing'){if(resume&&!this.wasPaused)G.resume();else G.UI.showPause(true)}
  },
  initUI(){
    this.load();const panel=this.panel=document.createElement('div');panel.id='trainingRecordPanel';panel.className='hidden';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','recordTitle');
    panel.innerHTML='<div class="panel"><h2 id="recordTitle">훈련 기록 · 30초 사격</h2><p id="recordWeapon"></p><p class="record-help">선택한 거리의 사격선으로 이동합니다. 정면 표적만 집계하며 이동·총기 변경·투척 시 측정을 중단합니다.</p><label>측정 거리 <select id="recordDistance"><option value="10">10m</option><option value="25" selected>25m</option><option value="50">50m</option><option value="100">100m</option></select></label><div id="recordBody"></div><p id="recordNotice" role="status"></p><div class="res-btns"><button id="recordStart">30초 측정 시작</button><button id="recordStop" class="ghost" hidden>측정 중단</button><button id="recordClose" class="ghost">닫기</button></div></div>';
    document.body.appendChild(panel);
    const select=document.createElement('select');select.id='recordGun';select.setAttribute('aria-label','기록을 비교할 총기');
    for(const id of G.GUN_IDS){const option=document.createElement('option');option.value=id;option.textContent=G.WEAPONS[id].name;select.appendChild(option)}
    document.getElementById('recordWeapon').after(select);select.addEventListener('change',()=>this.render());
    document.getElementById('recordDistance').addEventListener('change',()=>this.render());
    document.getElementById('recordStart').addEventListener('click',()=>this.start(document.getElementById('recordDistance').value));
    document.getElementById('recordStop').addEventListener('click',()=>{this.abort();this.render()});document.getElementById('recordClose').addEventListener('click',()=>this.close());
    document.getElementById('trainRecordBtn').addEventListener('click',()=>this.show());document.getElementById('trainingHistoryBtn').addEventListener('click',()=>this.show());
    addEventListener('keydown',e=>{if(this.open&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close()}},true);
    document.addEventListener('visibilitychange',()=>{if(this.run)this.run.clock=null});
  }
};
})();
