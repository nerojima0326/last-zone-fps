// 게임의 실제 장갑·칼을 렌더링해 동작별 접사와 발리송 영상을 저장한다.
const fs=require('fs'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
(async()=>{
 const f=await fixture({viewport:{width:960,height:600}}),out=process.env.KNIFE_SHOTS||'/tmp/lz-knife-capture';
 try{
  fs.mkdirSync(out,{recursive:true});const p=f.page;
  await p.evaluate(()=>{
   const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);
   G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.startGame({...G.UI.opts,mode:'training',quality:'medium'});G.paused=true;G.UI.showPause(false);
   window.knifeCapture=(id,kind,t,dt=1/60)=>{
    const P=G.Player,a=P.a,d=G.Knives.catalog[id];Object.assign(a,{cur:'melee',knife:id,state:'ground',alive:true,knocked:false,hspeed:0,crouch:false,prone:false});
    Object.assign(P,{sw:null,reload:null,heal:null,throwSt:null,revive:null,vehicle:null,sprinting:false,ads:0,scopeView:0,raise:1,landDip:0,knifeSeen:id});G.Input.reset();
    const duration=kind==='draw'?(d.draw||.58):kind==='slash'?d.duration:d.inspect;
    P.melee=kind==='idle'?null:{id,kind,t:t*duration,duration,hit:true};P.updateCamera(dt);G.vmScene.updateMatrixWorld(true);
   };
   window.knifeImage=()=>{G.renderer.setRenderTarget(null);G.renderer.setClearColor(0x293540,1);G.renderer.autoClear=true;G.renderer.render(G.vmScene,G.vmCamera);G.Perf.gpuWait();return G.renderer.domElement.toDataURL('image/png').split(',')[1]};
  });
  const save=async file=>fs.writeFileSync(file,Buffer.from(await p.evaluate(()=>knifeImage()),'base64'));
  const ids=await p.evaluate(()=>G.Knives.ids);
  for(const id of ids)for(const kind of ['draw','slash','inspect']){
   await p.evaluate(id=>{for(let i=0;i<90;i++)knifeCapture(id,'idle',0)},id);
   for(let i=0;i<=30;i++){
    await p.evaluate(({id,kind,i})=>knifeCapture(id,kind,i/30),{id,kind,i});
    if(i%6===0)await save(path.join(out,id+'-'+kind+'-'+String(i).padStart(2,'0')+'.png'));
   }
  }
  if(process.env.KNIFE_VIDEO==='1'){
   const dir=path.join(out,'frames');fs.mkdirSync(dir,{recursive:true});let frame=0;
   for(const kind of ['draw','slash','inspect']){
    await p.evaluate(()=>{for(let i=0;i<90;i++)knifeCapture('knife_butterfly','idle',0)});
    const duration=await p.evaluate(kind=>{const d=G.Knives.catalog.knife_butterfly;return kind==='draw'?d.draw||.58:kind==='slash'?d.duration:d.inspect},kind),n=Math.ceil(duration*30);
    for(let i=0;i<=n;i++){await p.evaluate(({kind,i,n,duration})=>knifeCapture('knife_butterfly',kind,i/n,duration/n),{kind,i,n,duration});await save(path.join(dir,String(frame++).padStart(3,'0')+'.png'))}
   }
   require('child_process').execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(dir,'%03d.png'),'-c:v','libvpx-vp9','-crf','32','-b:v','0','-pix_fmt','yuv420p',path.join(out,'butterfly.webm')]);
   console.log('발리송 비교 영상',frame,'프레임');
  }
  if(f.errors.length)throw Error(f.errors.join('\n'));console.log('PASS 칼 6종 꺼내기·공격·검사 접사');
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
