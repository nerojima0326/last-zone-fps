// v109 목표 순서·상호작용·저장 복구와 성공·실패를 실제 게임에서 검사한다.
require('./artifact-paths.cjs');const assert=require('assert'),fs=require('fs'),path=require('path'),fixture=require('./zombies/fixture.cjs');
(async()=>{const f=await fixture();const rows=[];try{const p=f.page;async function test(name,fn){const value=await p.evaluate(fn);assert(value,name);rows.push({name,status:'통과'})}
 await test('난이도 4종과 이름',()=>Object.values(G.ZombieMode.modules.DIFFICULTIES).map(d=>d.name).join(',')==='생존자,감염 구역,악몽,최후의 날');
 await test('일반 초기 요청에 좀비 없음',()=>!!G.Game.zombie&&G.Game.actors[0].isPlayer);
 await test('모든 목표 사이 지형 경로 존재',()=>{const m=G.ZombieMode,r=m.route,N=m.modules.Nav;window.zPaths=[];for(const[a,b]of [[r.start,r.rally],[r.rally,r.supply],[r.supply,r.generator],[r.generator,r.fuel[0]],[r.generator,r.fuel[1]],[r.generator,r.near],[r.far,r.tower],[r.tower,r.harbor]]){const path=N.path(a,b);zPaths.push({from:a.toArray(),to:b.toArray(),nodes:path?.length});if(!path)return false}return true});
 console.log('경로',await p.evaluate(()=>zPaths));
 for(let phase=0;phase<6;phase++){
  await p.evaluate(n=>{const m=G.ZombieMode;if(m.phase!==n)m.enter(n);const t=m.target();G.Game.player.pos.copy(t.p);G.Player.update(0);G.Game.syncModels(0);m.modules.HUD.update(1);},phase);
  await p.screenshot({path:path.join(f.out,`phase-${phase}-start.jpg`),quality:75});
  await test('목표 '+phase+' 조건',()=>{const m=G.ZombieMode;if(m.phase===0){m.act('relay');m.phaseKills=8;m.objectives(0);return m.phase===1}if(m.phase===1){m.act('door');m.phaseKills=18;m.act('supply');return m.phase===2}if(m.phase===2){m.act('fuel0');const block=m.carry===0;G.Player.switchTo('rifle');if(G.Player.sw?.to==='rifle')return false;m.act('deliver');m.act('fuel1');m.act('deliver');m.act('startGenerator');m.flags.defenseTime=89;G.Game.player.pos.copy(m.route.generator);m.objectives(1);return block&&m.phase===3&&m.flags.power}if(m.phase===3){m.act('foot');m.phaseKills=12;G.Game.player.pos.copy(m.route.far);m.objectives(0);return m.phase===4&&m.scene.footOpen}if(m.phase===4){m.act('signal');if(!m.boss)return false;m.kill(m.boss,G.Game.player,'ar7',true);m.objectives(0);return m.phase===5}m.act('evac');m.time+=m.difficulty.evac+1;m.scene.flyHeli(1,0);m.act('board');m.cinematic=null;m.finish(true);return m.result.win});
  await p.screenshot({path:path.join(f.out,`phase-${phase}-end.jpg`),quality:75});
 }
 await test('최종 탈출 기록 저장',()=>JSON.parse(localStorage.getItem('lz_zombie_records_v109')).infected.time>0);
 await test('체크포인트 체력·탄약 정확 복구',()=>{const m=G.ZombieMode;m.restore(m.checkpoint);const a=G.Game.player;a.hp=37;a.ammo['556']=17;m.saveCheckpoint();a.hp=2;a.ammo['556']=0;m.restore(m.checkpoint);return a.hp===37&&a.ammo['556']===17&&a.alive&&!m.finished});
 await test('사망 실패와 재시작',()=>{const m=G.ZombieMode;m.hurtAt=-99;m.damage(G.Game.player,10000,null,'fall');if(m.result.win||!m.finished)return false;return m.restore(m.checkpoint)&&!m.finished});
 await test('시간 초과 실패',()=>{const m=G.ZombieMode;m.phase=5;m.flags.escaped=false;m.flags.evacStarted=m.time-1000;m.objectives(0);return m.finished&&!m.result.win&&m.result.reason.includes('대기')});
 await p.screenshot({path:path.join(f.out,'failure.jpg'),quality:75});
 await p.evaluate(()=>G.toMenu());await p.click('[data-family=battle]');assert(await p.locator('.modes').isVisible(),'일반 모드 선택 복귀');assert.deepStrictEqual(f.errors,[]);
 const report={rows,errors:f.errors,paths:await p.evaluate(()=>zPaths),out:f.out};fs.writeFileSync(process.env.REPORT||path.join(f.out,'mode.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(rows));
}finally{await f.close()}})().catch(e=>{console.error(e);process.exitCode=1});
