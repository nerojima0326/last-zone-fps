// v108 GPU 준비는 시작 화면·메뉴·일시정지에서만 실행한다.
(function () {
'use strict';
const G=window.G;
const P=G.RenderPrep={
  jobs:[],scheduled:false,uploads:0,compiled:0,
  safe(){return !!G.preparing||G.paused||(G.Game?.state!=='playing'&&!G.Game?.spectating)}, // v108 관전도 진행 중인 경기로 취급한다
  turn(ms=0){return new Promise(resolve=>setTimeout(resolve,ms))},
  async waitSafe(){while(!this.safe()){if(G.GraphicsRecovery?.lost)throw Error('그래픽 연결이 끊겼습니다');await this.turn(100)}if(G.GraphicsRecovery?.lost)throw Error('그래픽 연결이 끊겼습니다')},
  async gpuIdle(){
    const gl=G.renderer.getContext(),epoch=G.GraphicsRecovery.epoch;if(G.GraphicsRecovery.lost)throw Error('그래픽 연결이 끊겼습니다');if(!gl.fenceSync){await this.turn();return}
    const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)return;
    gl.flush();const started=performance.now();
    try{
      for(;;){
        if(G.GraphicsRecovery.lost||epoch!==G.GraphicsRecovery.epoch)throw Error('그래픽 연결이 끊겼습니다');
        const state=gl.clientWaitSync(sync,0,0);
        if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return;
        if(state===gl.WAIT_FAILED||performance.now()-started>60000)throw Error('그래픽 준비를 완료하지 못했습니다');
        await this.turn(8);
      }
    }finally{if(!G.GraphicsRecovery.lost&&epoch===G.GraphicsRecovery.epoch)gl.deleteSync(sync)}
  },
  run(task){return new Promise((resolve,reject)=>{this.jobs.push({task,resolve,reject});this.schedule()})},
  textures(list){return this.run(()=>G.GraphicsRecovery.prepare(async()=>{for(const t of list){await this.waitSafe();if(!G.renderer.properties.get(t).__webglInit){G.renderer.initTexture(t);this.uploads++;await this.gpuIdle();await this.turn()}}}))},
  prepare(root){
    return this.run(()=>G.GraphicsRecovery.prepare(async()=>{
      G.TextureQuality?.scan(root,true);
      const textures=new Set();root.traverse(o=>{for(const m of [].concat(o.material||[]))for(const key in m){const t=m[key];if(t?.isTexture&&!t.isRenderTargetTexture&&!G.renderer.properties.get(t).__webglInit)textures.add(t)}});
      for(const t of textures){await this.waitSafe();G.renderer.initTexture(t);this.uploads++;await this.gpuIdle();await this.turn()}
      await this.waitSafe();await G.prepareViewmodel(root);this.compiled++;
    }));
  },
  schedule(){if(this.scheduled||this.running||!this.jobs.length)return;this.scheduled=true;setTimeout(()=>this.step(),this.safe()&&!G.GraphicsRecovery.lost?0:250)},
  step(){
    this.scheduled=false;const job=this.jobs[0];if(!job)return;
    // v108 아직 시작하지 않은 자산은 복구를 기다려 실패 캐시에 남기지 않는다.
    if(!this.safe()||G.GraphicsRecovery.lost){this.schedule();return}
    this.running=true;
    Promise.resolve().then(async()=>{await G.GraphicsRecovery.prepare(async()=>{await this.gpuIdle();await this.waitSafe()});return job.task()}).then(job.resolve,job.reject).finally(()=>{this.jobs.shift();this.running=false;this.schedule()});
  }
};
})();
