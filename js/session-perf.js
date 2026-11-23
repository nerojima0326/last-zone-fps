// 실제 사용자의 렌더러에서 최대 60초의 프레임 간격과 가까운 게임 동작을 기록한다.
(function () {
'use strict';
const G=window.G;
const P=G.SessionPerf={
  recording:false,samples:new Float32Array(18000),n:0,events:[],spikes:[],result:null,wasActive:false,
  start(){this.recording=true;this.n=0;this.activeMs=0;this.events=[];this.spikes=[];this.result=null;this.started=performance.now();this.wasActive=false;this.cell='';this.renderUI()},
  mark(name){if(this.recording){this.events.push({name,at:performance.now()-this.started});if(this.events.length>120)this.events.shift()}},
  frame(ms,updateMs,renderMs){
    if(!this.recording)return;
    const now=performance.now(),active=G.Game?.state==='playing'&&!G.paused&&!document.hidden;
    if(active&&this.wasActive&&Number.isFinite(ms)&&ms>0){
      if(this.n<this.samples.length)this.samples[this.n++]=ms;
      this.activeMs+=ms;
      const cell=Math.floor(G.camera.position.x/125)+','+Math.floor(G.camera.position.z/125);
      if(this.cell&&cell!==this.cell)this.mark('지역 진입');this.cell=cell;
      if(ms>50){const event=this.events.at(-1);this.spikes.push({at:now-this.started,ms,updateMs,renderMs,action:event&&now-this.started-event.at<500?event.name:'이동'});if(this.spikes.length>80)this.spikes.shift()}
    }
    this.wasActive=active;if(this.activeMs>=60000||this.n===this.samples.length)this.stop();
  },
  stop(){
    if(!this.recording)return this.result;this.recording=false;
    const a=Array.from(this.samples.subarray(0,this.n)),total=a.reduce((s,x)=>s+x,0),slow=a.slice().sort((x,y)=>y-x),worst=slow.slice(0,Math.max(1,Math.ceil(a.length*.01)));
    const renderer=G.renderer,gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    this.result={version:window.LZ_BUILD,at:Date.now(),frames:a.length,fps:total?1000*a.length/total:0,low1:worst.length?1000/(worst.reduce((s,x)=>s+x,0)/worst.length):0,maxMs:slow[0]||0,quality:G.quality,resolution:G.renderResolutionInfo(),gpu:String(gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)),spikes:this.spikes.slice(),events:this.events.slice(),frameMs:a};
    this.renderUI();return this.result;
  },
  renderUI(){
    const button=document.getElementById('setPerfCapture'),save=document.getElementById('setPerfSave'),status=document.getElementById('setPerfStatus');if(!button)return;
    button.textContent=this.recording?'기록 종료':'성능 기록 시작';save.disabled=!this.result?.frames;
    status.textContent=this.recording?'설정을 닫고 플레이하세요 · 최대 60초 · 일시정지·탭 전환 제외':this.result?`평균 ${this.result.fps.toFixed(0)} FPS · 1% 하위 ${this.result.low1.toFixed(0)} FPS · 최장 ${this.result.maxMs.toFixed(1)}ms (${this.result.frames}프레임)`:'현재 PC에서 이동·사격·폭발 시의 프레임을 측정합니다.';
  },
  init(){
    document.addEventListener('visibilitychange',()=>{this.wasActive=false});
    document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement)this.wasActive=false});
    document.getElementById('setPerfCapture').addEventListener('click',()=>this.recording?this.stop():this.start());
    document.getElementById('setPerfSave').addEventListener('click',()=>{if(!this.result?.frames)return;const url=URL.createObjectURL(new Blob([JSON.stringify(this.result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='last-zone-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});this.renderUI();
  }
};
})();
