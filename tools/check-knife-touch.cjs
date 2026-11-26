// 모바일 터치로 칼 장착·검사·검사 중 공격·종류 변경을 실제 입력 경로에서 확인한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./optimize/browser-fixture.cjs');
(async()=>{
 const f=await fixture({viewport:{width:960,height:540},query:'touch=1',contextOptions:{isMobile:true,hasTouch:true}});
 try{
  const p=f.page;
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0;G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};G.startGame({...G.UI.opts,mode:'training',quality:'low',players:4,loadout:'all'});G.paused=false;G.UI.showPause(false);G.Input.locked=true});
  const touch=(id,frames)=>p.evaluate(({id,frames})=>{
   const el=document.querySelector('#touchUI [data-id="'+id+'"]');if(!el)throw Error('터치 버튼 없음 '+id);
   const r=el.getBoundingClientRect(),t=new Touch({identifier:11,target:el,clientX:r.x+r.width/2,clientY:r.y+r.height/2});
   el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,changedTouches:[t],touches:[t]}));
   for(let i=0;i<frames;i++){G.Player.update(1/60);G.Input.endFrame()}
   el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,changedTouches:[t],touches:[]}));
   return {slot:G.Player.a.cur,kind:G.Player.melee?.kind,knife:G.Player.a.knife};
  },{id,frames});
  const equip=await touch('knife',100);assert.equal(equip.slot,'melee');
  const inspect=await touch('ads',2);assert.equal(inspect.kind,'inspect');
  const slash=await touch('fire',2);assert.equal(slash.kind,'slash');
  await p.evaluate(()=>{for(let i=0;i<80;i++){G.Player.update(1/60);G.Input.endFrame()}});
  const next=await touch('knife',100);assert.notEqual(next.knife,equip.knife);assert.deepEqual(f.errors,[]);
  const out=process.env.KNIFE_SHOTS||'/tmp/lz-knife-touch';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'touch.json'),JSON.stringify({equip,inspect,slash,next,errors:f.errors},null,2)+'\n');
  console.log('PASS 모바일 터치 칼 장착·검사·공격 전환·종류 변경');
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
