// 장전 종료·취소 때 기존 장전 곡선의 복귀 구간을 짧게 재생한다.
// 관절을 따로 섞지 않아 매 프레임 기존 손 접촉·총기 작동부 보정이 함께 적용된다.
(function () {
'use strict';
const G=window.G;
const R=G.PoseRecovery={
  id:null,wasReload:false,active:false,t:0,source:{},visual:{},frame:{},progress:0,
  reset(){this.id=null;this.wasReload=this.active=false;this.t=0},
  state(vm,s,dt){
    if(this.id!==vm.cur){this.reset();this.id=vm.cur}
    if(!vm.cur||s.hideVM||s.ads>=.999){this.wasReload=this.active=false;return s}
    if(s.reload){
      Object.assign(this.source,{p:0,pp:0,shellP:-1,phase:null},s.reload);
      this.wasReload=true;this.active=false;this.t=0;return s;
    }
    if(this.wasReload){
      this.wasReload=false;this.active=true;this.t=0;
      const r=this.source;this.progress=G.U.clamp((r.phase==='load'?r.shellP:r.phase?r.pp:r.p)||0,0,1);
    }
    if(!this.active)return s;
    this.t+=Math.max(0,dt);const k=G.U.smoothstep(0,.13,this.t);
    if(k>=1){this.active=false;return s}
    const r=Object.assign(this.visual,this.source),p=this.progress;
    if(r.type==='mag'||r.type==='revolver')r.p=G.U.lerp(p,p<.45?0:1,k);
    else if(r.phase==='end')r.pp=G.U.lerp(p,1,k);
    else if(r.phase==='start'&&p<.35)r.pp=G.U.lerp(p,0,k);
    else if(k<.45){if(r.phase==='load')r.shellP=G.U.lerp(p,1,k/.45);else r.pp=G.U.lerp(p,1,k/.45)}
    else{r.phase='end';r.pp=(k-.45)/.55;r.shellP=-1}
    const gap=.045*G.U.smoothstep(0,.15,k)*(1-G.U.smoothstep(.85,1,k));
    return Object.assign(this.frame,s,{reload:r,poseRecovery:true,recoveryGap:gap});
  },
  init(vm){
    const update=vm.update,fire=vm.fireKick;
    vm.update=function(dt,s){return update.call(this,dt,R.state(this,s,dt))};
    vm.fireKick=function(...args){R.reset();return fire.apply(this,args)};
  }
};
})();
