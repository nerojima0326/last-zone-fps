// v109 좀비 미션은 일반 경기와 분리해 시작·정리한다.
const G=window.G,T=window.THREE;
export const Mode={
  active:false,
  async mount(){
    const box=document.createElement('div');box.id='zombieMenu';box.innerHTML='<b>정전된 도시 탈출</b><p>무전을 따라 보급소·발전기·다리·무전탑을 통과하고 항구에서 탈출하세요.</p><label>미션 난이도 <select id="zDifficulty"><option value="survivor">생존자 · 쉬움</option><option value="infected" selected>감염 구역 · 보통</option><option value="nightmare">악몽 · 어려움</option><option value="doomsday">최후의 날 · 최고</option></select></label><p>예상 12~18분 · 체크포인트 저장 · 1인 협동 부대 미션</p>';
    document.querySelector('.menu-body').appendChild(box);document.getElementById('zDifficulty').onchange=e=>{G.UI.opts.zDifficulty=e.target.value};this.menu(G.UI.opts.mode==='zombie');
  },
  menu(on){document.getElementById('menu').classList.toggle('zombie-menu',on);document.getElementById('startBtn').textContent=on?'미션 시작':'게임 시작';},
  async prepare(o){this.options=o;await this.modules.Models.load();await this.modules.Nav.build();},
  start(o){
    const game=G.Game;game.zombie=true;this.active=true;game.diff='normal';game.teamSize=1;game.time=0;game.ended=false;game.zone=null;game.training=false;
    const a=new G.Actor({id:0,name:o.name||'생존 부대원',team:0,isPlayer:true});a.model=new G.CharacterModel({helmet:false});G.scene.add(a.model.root);a.model.root.visible=false;
    game.giveLoadout(a,'rifle',true);a.state='ground';a.onGround=true;a.pos.set(120,G.World.ground(120,-130,100, .3,.6),-130);game.player=a;game.actors=[a];game.teams=[{id:0,members:[a],eliminated:false,kills:0},{id:1,members:[],eliminated:false,kills:0}];G.Player.init(a);G.Player.onLand();game.state='playing';G.UI.startMatch();document.getElementById('hud').classList.add('zombie-hud');this.time=0;this.pool=[];this.difficulty={speed:1,hp:1,damage:1,cap:42};this.modules.Models.attach();for(let i=0;i<64;i++){const enemy=new G.Actor({id:i+1,name:'감염자',team:1});enemy.zombie=true;enemy.alive=false;enemy.state='ground';this.pool.push(enemy);game.actors.push(enemy);game.teams[1].members.push(enemy)}for(let i=0;i<10;i++)this.spawn('walker',this.modules.Nav.nearest(a.pos.x+12+Math.random()*10,a.pos.z-12-Math.random()*12));this.resetClock();
  },
  async ready(){await this.modules.Models.ready();},
  resetClock(){this.last=performance.now()},
  update(dt){this.time+=dt;G.Game.time=this.time;G.Player.update(dt);this.modules.Nav.refresh(G.Game.player.pos,dt);for(const a of this.pool)a.brain?.update(dt);G.Game.syncModels(dt);G.Ballistics.update(dt);G.Throwables.update(dt);G.Game.updateLoot(dt);G.Extras.update(dt);this.modules.Models.update(this.pool,this.time);},
  spawn(kind,pos){const a=this.pool.find(a=>!a.alive&&(!a.z?.visible||this.time-a.deathTime>7));if(!a)return null;const def=this.modules.TYPES[kind];a.alive=true;a.hp=def.hp*this.difficulty.hp;a.pos.copy(pos);a.vel.set(0,0,0);a.knocked=false;a.prone=false;a.deathTime=-99;a.z={kind,variant:a.id%2,scale:def.scale,typeIndex:def.index,visible:true,contacts:[],pattern:0,clip:null};a.brain=new this.modules.Brain(a,this,this.modules.Nav,this.modules.Models);this.modules.Models.animate(a,'idle',this.time);return a;},
  damage(t,amount,attacker,weapon,head,point,dir,shot){if(!t.alive||this.finished)return;const from=attacker===G.Game.player;if(t.zombie){if(attacker?.zombie&&weapon!=='폭발')return;const region=this.modules.Combat.region(t,point,head);if(region==='head')amount*=1.8;if(region==='leg'){t.z.legDamage=(t.z.legDamage||0)+amount;if(t.z.legDamage>32)t.z.crawl=true}if(region==='arm')t.z.armHit=true;if(t.z.kind==='boss'){const back=dir&&(dir.x*Math.sin(t.yaw)+dir.z*Math.cos(t.yaw))<-.25;amount*=back?3:.6;}if(from){G.UI.hitmarker(head,amount>=t.hp);G.Audio.hit(head,amount>=t.hp,false);}t.hp-=amount;t.lastHurtT=this.time;t.z.hurtUntil=this.time+.16;if(t.hp<=0)this.kill(t,attacker,weapon,head);else t.brain.onHurt(attacker||G.Game.player);}else{if(this.time-(this.hurtAt||-99)<.25)return;this.hurtAt=this.time;t.hp=Math.max(0,t.hp-amount*this.difficulty.damage);t.lastHurtT=this.time;G.UI.hurt(amount,attacker?.pos);G.Audio.hurt();G.Player.cancelHeal();if(!t.hp)this.kill(t,attacker,weapon,head);}},
  kill(t,attacker,weapon,head){t.alive=false;t.hp=0;t.deathTime=this.time;t.vel.set(0,0,0);if(t.zombie){this.modules.Models.animate(t,'death',this.time);if(attacker===G.Game.player){attacker.kills++;G.Game.teams[0].kills++;}}else{G.paused=true;G.UI.showPause(true)}},
  attack(a,amount,knock){const p=G.Game.player;this.damage(p,amount,a,'감염자',false,p.pos);if(knock){p.vel.x+=Math.sin(a.yaw)*-4;p.vel.z+=Math.cos(a.yaw)*-4;G.FX.shake(.2)}},
  radio(text,speaker='무전',duration=4){G.UI.toast(speaker+' · '+text)},
  summon(){},explode(a){this.kill(a,null,'폭발',false);G.FX.explosion(a.pos);if(a.pos.distanceTo(G.Game.player.pos)<5)this.attack(a,28,false)},bossPulse(a,r){if(a.pos.distanceTo(G.Game.player.pos)<r)this.attack(a,25,true)},
  stop(){this.modules.Models.detach();this.modules.Nav.clear();this.pool=[];this.active=false;G.Game.zombie=false;document.getElementById('hud').classList.remove('zombie-hud');}
};
