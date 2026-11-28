// v109 좀비 미션은 일반 경기와 분리해 시작·정리한다.
const G=window.G,T=window.THREE;
export const Mode={
  active:false,
  async mount(){
    const box=document.createElement('div');box.id='zombieMenu';box.innerHTML='<b>정전된 도시 탈출</b><p>무전을 따라 보급소·발전기·다리·무전탑을 통과하고 항구에서 탈출하세요.</p><label>미션 난이도 <select id="zDifficulty"><option value="survivor">생존자 · 쉬움</option><option value="infected" selected>감염 구역 · 보통</option><option value="nightmare">악몽 · 어려움</option><option value="doomsday">최후의 날 · 최고</option></select></label><p>예상 12~18분 · 체크포인트 저장 · 1인 협동 부대 미션</p>';
    document.querySelector('.menu-body').appendChild(box);document.getElementById('zDifficulty').onchange=e=>{G.UI.opts.zDifficulty=e.target.value};this.menu(G.UI.opts.mode==='zombie');
  },
  menu(on){document.getElementById('menu').classList.toggle('zombie-menu',on);document.getElementById('startBtn').textContent=on?'미션 시작':'게임 시작';},
  async prepare(o){this.options=o;},
  start(o){
    const game=G.Game;game.zombie=true;this.active=true;game.diff='normal';game.teamSize=1;game.time=0;game.ended=false;game.zone=null;game.training=false;
    const a=new G.Actor({id:0,name:o.name||'생존 부대원',team:0,isPlayer:true});a.model=new G.CharacterModel({helmet:false});G.scene.add(a.model.root);a.model.root.visible=false;
    game.giveLoadout(a,'rifle',true);a.state='ground';a.onGround=true;a.pos.set(120,G.World.ground(120,-130,100, .3,.6),-130);game.player=a;game.actors=[a];game.teams=[{id:0,members:[a],eliminated:false,kills:0},{id:1,members:[],eliminated:false,kills:0}];G.Player.init(a);G.Player.onLand();game.state='playing';G.UI.startMatch();document.getElementById('hud').classList.add('zombie-hud');this.resetClock();
  },
  async ready(){},
  resetClock(){this.last=performance.now()},
  update(dt){G.Game.time+=dt;G.Player.update(dt);G.Game.syncModels(dt);G.Ballistics.update(dt);G.Throwables.update(dt);G.Game.updateLoot(dt);G.Extras.update(dt);},
  stop(){this.active=false;G.Game.zombie=false;document.getElementById('hud').classList.remove('zombie-hud');}
};
