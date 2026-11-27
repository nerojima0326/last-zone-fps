
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 칼별 꺼내기·두 공격·검사를 실제 게임 리그로 렌더링한다.
const fs=require('fs'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
(async()=>{
 const f=await fixture({viewport:{width:960,height:600}}),out=process.env.KNIFE_SHOTS||'/tmp/lz-knife-capture';
 try{
  fs.mkdirSync(out,{recursive:true});const p=f.page;
  await p.evaluate(async ()=>{
   const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);
   G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};await G.startGame({...G.UI.opts,mode:'training',quality:'medium'});G.paused=true;G.UI.showPause(false);
   window.knifeCapture=(id,kind,t,dt=1/60,variant=0)=>{
    const P=G.Player,a=P.a,d=G.Knives.catalog[id];Object.assign(a,{cur:'melee',knife:id,state:'ground',alive:true,knocked:false,hspeed:0,crouch:false,prone:false});
    Object.assign(P,{sw:null,reload:null,heal:null,throwSt:null,revive:null,vehicle:null,sprinting:false,ads:0,scopeView:0,raise:1,landDip:0,knifeSeen:id});G.Input.reset();
    const duration=kind==='draw'?d.draw:kind==='slash'?d.duration:d.inspect,time=t*duration,previous=P.melee;
    if(kind==='idle')P.melee=null;else if(previous?.id===id&&previous.kind===kind&&previous.variant===variant&&time>=previous.t)previous.t=time;else P.melee={id,kind,variant,t:time,duration,hit:true};a.melee=P.melee;
    P.updateCamera(dt);G.vmScene.updateMatrixWorld(true);
   };
   window.knifeImage=()=>{G.renderer.setRenderTarget(null);G.renderer.setClearColor(0x293540,1);G.renderer.autoClear=true;G.renderer.render(G.vmScene,G.vmCamera);G.Perf.gpuWait();return G.renderer.domElement.toDataURL('image/png').split(',')[1]};
  });
  const save=async file=>fs.writeFileSync(file,Buffer.from(await p.evaluate(()=>knifeImage()),'base64'));
  const ids=process.env.KNIFE_IDS?.split(',')||await p.evaluate(()=>G.Knives.ids),actions=[['draw',0],['slash',0],['slash',1],['inspect',0]],timeline={};
  for(const id of ids)for(const [kind,variant]of actions){
   await p.evaluate(id=>{for(let i=0;i<90;i++)knifeCapture(id,'idle',0)},id);
   for(let i=0;i<=30;i++){
    await p.evaluate(({id,kind,variant,i})=>knifeCapture(id,kind,i/30,1/60,variant),{id,kind,variant,i});
    if(i%6===0)await save(path.join(out,id+'-'+kind+(variant?'-alt':'')+'-'+String(i).padStart(2,'0')+'.png'));
   }
  }
  if(process.env.KNIFE_VIDEO==='1')for(const id of ids){
   const dir=path.join(out,id+'-frames');fs.mkdirSync(dir,{recursive:true});let frame=0;timeline[id]=[];
   for(const [kind,variant]of actions){
    await p.evaluate(id=>{for(let i=0;i<90;i++)knifeCapture(id,'idle',0)},id);
    const info=await p.evaluate(({id,kind,variant})=>{const d=G.Knives.catalog[id],s=G.Knives.motionSets[id];return {duration:kind==='draw'?d.draw:kind==='slash'?d.duration:d.inspect,name:(kind==='slash'?s.slash[variant]:s[kind]).name}},{id,kind,variant});
    const n=Math.ceil(info.duration*30),start=frame;
    for(let i=0;i<=n;i++){await p.evaluate(({id,kind,variant,i,n,duration})=>knifeCapture(id,kind,i/n,duration/n,variant),{id,kind,variant,i,n,duration:info.duration});await save(path.join(dir,String(frame++).padStart(3,'0')+'.png'))}
    timeline[id].push({kind,variant,...info,startFrame:start,endFrame:frame-1});
   }
   const filename=id.replace('knife_','')+'.webm';require('child_process').execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(dir,'%03d.png'),'-c:v','libvpx-vp9','-crf','32','-b:v','0','-pix_fmt','yuv420p',path.join(out,filename)]);
   console.log('비교 영상',id,frame,'프레임');
  }
  fs.writeFileSync(path.join(out,'timeline.json'),JSON.stringify(timeline,null,2)+'\n');if(f.errors.length)throw Error(f.errors.join('\n'));console.log('PASS 칼별 꺼내기·공격 2종·검사 접사');
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
