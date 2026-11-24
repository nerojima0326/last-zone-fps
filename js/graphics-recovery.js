// 그래픽 컨텍스트가 끊기면 게임을 멈추고, 복구된 뒤 일시정지 화면으로 돌아간다.
(function(){
'use strict';
const G=window.G,$=id=>document.getElementById(id);
G.GraphicsRecovery={
 lost:false,booted:false,recoveries:0,
 init(renderer){
  renderer.domElement.addEventListener('webglcontextlost',event=>{
   event.preventDefault();this.lost=true;G.Perf?.contextLost();G.paused=true;G.Input?.reset();G.Input?.unlock();G.Footsteps?.stop();
   $('loading').classList.remove('hidden');$('loadText').textContent='그래픽 연결을 복구하는 중...';
  });
  renderer.domElement.addEventListener('webglcontextrestored',()=>{
   this.lost=false;this.recoveries++;G.Perf?.contextRestored();
   if(G.quality){G.__apply(G.quality);G.refreshVisuals();renderer.shadowMap.needsUpdate=true;}
   if(!this.booted){$('loadText').textContent='그래픽 연결 복구 완료 · 게임 준비 중...';return;}
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
