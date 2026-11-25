// 실제 플레이어 입력·투척 상태와 렌더링을 같은 시간 간격으로 촬영한다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),fixture=require('./optimize/browser-fixture.cjs');
module.exports=async function throwableFixture(base,options={}){
 const cache=new Map(),root=path.resolve(__dirname,'..');
 const f=await fixture({viewport:{width:720,height:405},initialOptions:{quality:'low'},route:async p=>{
  await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);});
  if(options.fallbackModels)await p.route('**/assets/models/throwables/*.glb*',r=>r.fulfill({status:404,body:''}));
  if(base)await p.route('**/*',r=>{const u=new URL(r.request().url()),file=u.pathname==='/'?'index.html':u.pathname.slice(1);if(u.hostname!=='127.0.0.1'||!(file==='index.html'||file==='version.txt'||/^js\/.*\.js$/.test(file)))return r.fallback();if(!cache.has(file))try{cache.set(file,cp.execFileSync('git',['show',base+':'+file],{cwd:root,stdio:['ignore','pipe','ignore']}))}catch(e){cache.set(file,null)}return cache.get(file)?r.fulfill({body:cache.get(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'text/plain'}):r.fallback();});
 }});
 if(options.proceduralArms)await f.page.evaluate(()=>G.RealArms.dispose());
 await f.page.evaluate(()=>{
  G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.startGame({...G.UI.opts,mode:'training',quality:'low'});G.paused=true;G.UI.showPause(false);G.Input.locked=true;
  const P=G.Player,a=P.a;window.throwVideo={t:0,kind:'frag',under:false,rows:[],initial:a.pos.clone()};
  throwVideo.start=(kind,under=false)=>{
   P.abortThrow();G.Throwables.reset();G.FX.reset();G.Input.reset();Object.assign(P,{sw:null,reload:null,heal:null,revive:null,melee:null,vehicle:null,ads:0,scopeView:0,sprinting:false,raise:1,landDip:0,flashAmt:0,throwKind:kind});Object.assign(a,{cur:'pistol',state:'ground',alive:true,knocked:false,crouch:false,prone:false,hp:100});a.pos.copy(throwVideo.initial);a.vel.set(0,0,0);for(const k of G.THROW_ORDER)a.throwables[k]=9;
   P.switchTo('throw');throwVideo.t=0;throwVideo.kind=kind;throwVideo.under=under;throwVideo.rows=[];
  };
  throwVideo.step=dt=>{
   const t=throwVideo.t,next=t+dt,I=G.Input;I.locked=true;I.lmb=!throwVideo.under&&next>=.50&&next<1.45;I.rmb=throwVideo.under&&next>=.50&&next<1.45;I.lmbHit=!throwVideo.under&&t<.50&&next>=.50;I.rmbHit=throwVideo.under&&t<.50&&next>=.50;
   if(t<.85&&next>=.85)P.pullPin();P.update(dt);I.endFrame();throwVideo.t=next;
   const m=G.VM.models.throw;throwVideo.rows.push({t:next,phase:P.throwSt?.phase,released:!!P.throwSt?.released,held:Object.values(m.items).some(o=>o.visible),projectiles:G.Throwables.list.length,ammo:a.throwables[throwVideo.kind]});
  };
  throwVideo.advance=t=>{while(throwVideo.t<t-1e-7)throwVideo.step(Math.min(1/60,t-throwVideo.t));};
  throwVideo.image=()=>{
   const R=G.renderer;R.setRenderTarget(null);R.setClearColor(0x293540,1);R.autoClear=true;R.toneMappingExposure=1.0;G.VM.dir.intensity=3;G.VM.hemi.intensity=1.6;G.VM.fill.intensity=.25;G.VM.dir.position.set(-1,1,2);G.VM.dir.color.set(0xffffff);R.render(G.vmScene,G.vmCamera);G.Perf.gpuWait();return R.domElement.toDataURL('image/png').split(',')[1];
  };
 });
 return f;
};
