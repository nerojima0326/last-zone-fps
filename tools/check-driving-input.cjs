
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 실제 키보드와 모바일 다중 터치로 운전 조작을 확인한다.
const fs=require('fs'),assert=require('assert'),fixture=require('./vehicle-physics-fixture.cjs');
const mobile=process.env.DRIVE_MOBILE==='1',output=process.env.REPORT||'/tmp/lz-driving-input.json';
(async()=>{
 const f=await fixture(null,mobile?{viewport:{width:915,height:412},contextOptions:{hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'}}:{}),p=f.page,report={mobile};
 const step=frames=>p.evaluate(frames=>{for(let i=0;i<frames;i++){G.Player.update(1/60);G.VehicleSkids.update(1/60);G.Input.endFrame();}},frames);
 const state=()=>p.evaluate(()=>({speed:G.Player.vehicle.speed,boosting:!!G.Player.vehicle.boosting,drift:!!G.Player.vehicle.drift,space:G.Input.down('Space'),shift:G.Input.down('ShiftLeft')||G.Input.down('ShiftRight'),marks:G.VehicleSkids.total,prompt:G.Player.prompt}));
 try{
  await p.evaluate(()=>{const W=G.World,V=G.Vehicles,P=G.Player;window.driveInputTest={height:W.heightAt,water:W.waterAt,saved:P.a.pos.clone()};W.heightAt=()=>300;W.waterAt=()=>-100;const v=driveInputTest.v=V.newVehicle(0,300,0,0,{kind:'izh'});V.enter(P,v);G.Input.reset();G.Input.locked=true;G.paused=false;document.activeElement?.blur?.();});
  if(!mobile){
   await p.keyboard.down('w');await p.keyboard.down('a');await p.evaluate(()=>G.Player.vehicle.speed=16);await step(60);report.steering=await state();assert(!report.steering.drift&&report.steering.marks===0);
   await p.keyboard.down('Space');await step(45);report.space=await state();assert(report.space.space&&report.space.drift&&report.space.marks>0);
   await p.keyboard.up('Space');await step(1);report.release=await state();assert(!report.release.drift);await p.keyboard.up('a');await p.keyboard.up('w');
   await p.evaluate(()=>{const v=G.Player.vehicle;Object.assign(v,{speed:0,lat:0,yaw:0,steer:0,yawRate:0,driftBlend:0});G.VehicleSkids.reset();});
   await p.keyboard.down('w');await p.keyboard.down('ShiftLeft');await step(420);report.boost=await state();assert(report.boost.speed>27.5&&report.boost.boosting&&report.boost.prompt.includes('가속 중'));
   await p.keyboard.up('ShiftLeft');await step(1);report.boostRelease=await state();assert(!report.boostRelease.boosting&&report.boostRelease.speed>27.5);
   await p.keyboard.down('ShiftRight');await step(1);report.rightShift=await state();assert(report.rightShift.boosting);
   await p.keyboard.down('Space');await p.keyboard.down('a');await step(30);report.priority=await state();assert(report.priority.space&&!report.priority.boosting);
   for(const key of ['w','a','Space','ShiftRight'])await p.keyboard.up(key);
  }else{
   await p.waitForSelector('#touchUI.show [data-id="reload"][data-key="ShiftLeft"]');
   const box=async id=>{const b=await p.locator('#touchUI [data-id="'+id+'"]').boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2,r:b.width/2};};
   const stick=await box('stick'),boost=await box('reload'),space=await box('jump'),cdp=await p.context().newCDPSession(p);
   const point=(id,x,y)=>({id,x,y,radiusX:2,radiusY:2,force:1}),send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
   // CDP 응답 뒤 브라우저에 터치가 전달될 때까지 기다린 뒤 고정 시간 물리를 진행한다.
   const delivered=keys=>p.waitForFunction(keys=>Object.entries(keys).every(([key,value])=>!!G.Input.keys[key]===value),keys,{timeout:10000});
   let joy=point(1,stick.x,stick.y-stick.r*.9);await send('touchStart',[point(1,stick.x,stick.y)]);await send('touchMove',[joy]);await delivered({KeyW:true});await step(180);report.joystick=await state();assert(!report.joystick.boosting&&!report.joystick.shift&&!report.joystick.drift);
   const gas=point(2,boost.x,boost.y);await send('touchStart',[joy,gas]);await delivered({ShiftLeft:true});await step(180);report.boost=await state();assert(report.boost.shift&&report.boost.boosting&&report.boost.speed>24);
   const hand=point(3,space.x,space.y);await send('touchStart',[joy,gas,hand]);joy=point(1,stick.x-stick.r*.65,stick.y-stick.r*.7);await send('touchMove',[joy,gas,hand]);await delivered({Space:true,KeyA:true});await step(30);report.priority=await state();assert(report.priority.space&&!report.priority.boosting&&report.priority.drift);
   // CDP의 touchEnd에는 떼는 손가락만 보낸다. 나머지는 계속 누른 상태로 남는다.
   await send('touchEnd',[hand]);await delivered({Space:false});await step(1);report.release=await state();assert(!report.release.drift&&!report.release.space&&report.release.shift);
   await send('touchEnd',[gas]);await delivered({ShiftLeft:false});await step(1);report.gasRelease=await state();assert(!report.gasRelease.shift&&!report.gasRelease.boosting);
   await send('touchStart',[joy,gas]);await delivered({ShiftLeft:true});await step(1);assert((await state()).boosting);
   await send('touchCancel',[]);await delivered({Space:false,ShiftLeft:false,KeyW:false,KeyA:false});await step(1);report.cancel=await state();assert(!report.cancel.shift&&!report.cancel.space&&!report.cancel.boosting,JSON.stringify(report.cancel));
   report.labels=await p.evaluate(()=>({gas:document.querySelector('#touchUI [data-id="reload"] span').textContent,space:document.querySelector('#touchUI [data-id="jump"] span').textContent}));assert.deepEqual(report.labels,{gas:'가속',space:'드리프트'});
  }
  await p.evaluate(()=>{const P=G.Player,V=G.Vehicles,W=G.World,c=driveInputTest;V.exit(P,true);V.unblock(c.v);G.scene.remove(c.v.mesh);V.list.splice(V.list.indexOf(c.v),1);G.VehicleWheels.dispose(c.v);W.heightAt=c.height;W.waterAt=c.water;P.a.pos.copy(c.saved);P.a.vel.set(0,0,0);G.Input.reset();G.VehicleSkids.reset();});
  if(mobile){await p.waitForFunction(()=>document.querySelector('#touchUI [data-id="reload"]').dataset.key==='KeyR');assert.equal(await p.locator('#touchUI [data-id="reload"] span').textContent(),'장전');}
  report.errors=f.errors;fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');assert.deepEqual(f.errors,[]);console.log('PASS 실제 운전 입력',mobile?'모바일 다중 터치':'키보드 Space·좌우 Shift',JSON.stringify(report));
 }finally{if(!report.errors)fs.writeFileSync(output,JSON.stringify({...report,errors:f.errors},null,2)+'\n');await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
