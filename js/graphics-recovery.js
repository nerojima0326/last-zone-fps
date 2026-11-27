// 그래픽 컨텍스트가 끊기면 게임을 멈추고, 복구된 뒤 일시정지 화면으로 돌아간다.
(function(){
'use strict';
const G=window.G,$=id=>document.getElementById(id);
G.GraphicsRecovery={
 lost:false,booted:false,recoveries:0,epoch:0,waiters:[],
 // v108 초기화는 유지하고 끊긴 GPU 준비만 복구 뒤 다시 수행한다.
 wait(){return this.lost?new Promise(resolve=>this.waiters.push(resolve)):Promise.resolve();},
 async prepare(task){
  for(;;){
   await this.wait();const epoch=this.epoch;
   try{const result=await task();if(!this.lost&&epoch===this.epoch)return result;}
   catch(e){if(!this.lost&&epoch===this.epoch)throw e;}
  }
 },
 init(renderer){
  renderer.domElement.addEventListener('webglcontextlost',event=>{
   event.preventDefault();this.lost=true;this.epoch++;G.Perf?.contextLost();G.paused=true;G.Input?.reset();G.Input?.unlock();G.Footsteps?.stop();
   if(G.World.envRT){G.World.envRT.dispose();G.World.envRT=null;} // v108 이전 컨텍스트의 삭제 핸들을 복구 뒤 사용하지 않는다
   $('loading').classList.remove('hidden');$('loadText').textContent='그래픽 연결을 복구하는 중...';
  });
  renderer.domElement.addEventListener('webglcontextrestored',()=>{
   this.lost=false;this.recoveries++;G.Perf?.contextRestored();
   if(G.quality){G.__apply(G.quality);G.World.setTimeOfDay(G.World.weather||G.UI.opts.tod,true);G.refreshVisuals();renderer.shadowMap.needsUpdate=true;}
   for(const resolve of this.waiters.splice(0))resolve();
   if(!this.booted){$('loadText').textContent='그래픽 연결 복구 완료 · 게임 준비 중...';return;}
   if(G.preparing){$('loadText').textContent='그래픽 연결 복구 완료 · 게임을 다시 준비하는 중...';return;}
   $('loading').classList.add('hidden');
   if(G.Game.state==='playing'){G.paused=true;G.UI.showPause(true);G.UI.toast('그래픽 연결을 복구했습니다');}
   else if(G.Game.state==='menu'){G.paused=false;G.UI.showMenu();}
  });
 },
 bootComplete(){
  this.booted=true;
  if(this.lost){$('loadText').textContent='그래픽 연결을 복구하는 중...';return;}
  $('loading').classList.add('hidden');G.paused=false;G.UI.showMenu();
 }
};
})();
