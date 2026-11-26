// 같은 카메라와 실제 플레이어 장전 상태로 전후 동작을 촬영·검사한다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),fixture=require('./optimize/browser-fixture.cjs');
module.exports=async function expandedFixture(options={}){
 const cache=new Map(),root=path.resolve(__dirname,'..');
 const f=await fixture({viewport:options.viewport||{width:960,height:540},initialOptions:{quality:'low'},route:async p=>{
  await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);});
  if(options.fallback)await p.route('**/assets/animations/reloads/expanded-motion.json*',r=>r.fulfill({status:404,body:''}));
  if(options.base)await p.route('**/*',r=>{const u=new URL(r.request().url()),file=u.pathname==='/'?'index.html':u.pathname.slice(1);if(u.hostname!=='127.0.0.1'||!(file==='index.html'||file==='version.txt'||/^js\/.*\.js$/.test(file)))return r.fallback();if(!cache.has(file))try{cache.set(file,cp.execFileSync('git',['show',options.base+':'+file],{cwd:root,stdio:['ignore','pipe','ignore']}))}catch(e){cache.set(file,null)}return cache.get(file)?r.fulfill({body:cache.get(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'text/plain'}):r.fallback();});
 }});
 await f.page.evaluate(async()=>{
  G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.startGame({...G.UI.opts,mode:'training',quality:'low'});G.paused=true;G.UI.showPause(false);G.Input.locked=true;
  for(const id of Object.keys(G.WeaponCatalog))G.VM.ensure(id);
  const P=G.Player,a=P.a;window.gunStudio={t:0,rows:[]};
  gunStudio.select=(id,empty=true)=>{
   P.abortThrow();G.Input.reset();Object.assign(P,{sw:null,reload:null,heal:null,revive:null,melee:null,vehicle:null,ads:0,scopeView:0,sprinting:false,raise:1,landDip:0,flashAmt:0});a.cur=G.WEAPONS[id].cls;a.weapons[a.cur]={id,mag:empty?0:Math.max(1,G.WEAPONS[id].mag-2),scope:null,iron:true,attachments:{}};a.ammo[G.WEAPONS[id].ammo]=999;a.vel.set(0,0,0);a.alive=true;a.hp=100;a.crouch=a.prone=false;
   G.VM.set(null);G.VM.set(id);Object.assign(G.VM,{kick:0,kickV:0,slideT:0,sprint:0,kickRoll:0});G.WeaponMotion.reset(G.VM);G.PoseRecovery.reset();for(let i=0;i<90;i++)P.updateCamera(1/60);gunStudio.t=0;gunStudio.rows=[];gunStudio.id=id;gunStudio.empty=empty;
  };
  gunStudio.step=dt=>{
   const next=gunStudio.t+dt;if(gunStudio.t<1.3&&next>=1.3)P.startReload();
   P.ads=next<.2?0:next<.55?(next-.2)/.35:next<.85?1:next<1.15?1-(next-.85)/.3:0;if(P.reload)P.reloadLogic(dt);P.updateCamera(dt);gunStudio.t=next;
   gunStudio.rows.push({t:next,ads:P.ads,phase:P.reload?.phase,reload:P.reload?.kind,progress:G.VM.models[gunStudio.id].reloadMotion?.time,ammo:a.weapons[a.cur].mag});
  };
  gunStudio.advance=t=>{while(gunStudio.t<t-1e-7)gunStudio.step(Math.min(1/60,t-gunStudio.t));};
  gunStudio.image=()=>{const R=G.renderer;R.setRenderTarget(null);R.setClearColor(0x293540,1);R.autoClear=true;R.toneMappingExposure=1;G.VM.dir.intensity=3;G.VM.hemi.intensity=1.6;G.VM.fill.intensity=.25;G.VM.dir.position.set(-1,1,2);G.VM.dir.color.set(0xffffff);R.render(G.vmScene,G.vmCamera);G.Perf.gpuWait();return R.domElement.toDataURL('image/png').split(',')[1];};
 });
 return f;
};
