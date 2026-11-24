// 늦게 도착한 총기 텍스처와 HDR 셰이더를 사격·조준 중이 아닌 틈에 준비한다.
(function () {
'use strict';
const G=window.G;
const P=G.RenderPrep={
  jobs:[],scheduled:false,uploads:0,compiled:0,
  prepare(root){
    return new Promise((resolve,reject)=>{
      G.TextureQuality?.scan(root,true);
      const textures=new Set();root.traverse(o=>{for(const m of [].concat(o.material||[]))for(const key in m){const t=m[key];if(t?.isTexture&&!t.isRenderTargetTexture&&!G.renderer.properties.get(t).__webglInit)textures.add(t)}});
      this.jobs.push({root,textures:[...textures],resolve,reject});this.schedule();
    });
  },
  schedule(){if(this.scheduled||!this.jobs.length)return;this.scheduled=true;setTimeout(()=>this.step(),24)},
  step(){
    this.scheduled=false;const job=this.jobs[0];if(!job)return;
    if(G.GraphicsRecovery?.lost){this.schedule();return}
    const busy=!G.paused&&G.Game?.state==='playing'&&(G.Input.lmb||G.Player.ads>.1||G.Player.reload||G.Player.time-G.Player.lastShot<.3);
    if(busy){this.schedule();return}
    try{
      if(job.textures.length){G.renderer.initTexture(job.textures.pop());this.uploads++;this.schedule();return}
      this.jobs.shift();this.compiled++;
      Promise.resolve(G.prepareViewmodel(job.root)).then(job.resolve,job.reject);
    }catch(e){if(this.jobs[0]===job)this.jobs.shift();job.reject(e)}
    this.schedule();
  }
};
})();
