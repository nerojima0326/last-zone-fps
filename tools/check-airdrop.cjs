// 실제 브라우저에서 수송기 이탈·강하 입력·전개·착지와 캐릭터 뼈대를 검증한다.
const assert = require('assert'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const fixture = require('./optimize/browser-fixture.cjs');
const baseline = process.env.AIR_BASELINE === '1';
const shots = path.resolve(process.env.AIR_SHOTS_DIR || path.join(require('os').tmpdir(), 'last-zone-airdrop'));
(async () => {
  const originals = {};
  if (baseline) for (const name of ['plane','character','player','game','bots','ui']) originals[name] = execFileSync('git', ['show', 'a3fe0d5:js/' + name + '.js'], { encoding: 'utf8' });
  const f = await fixture({ route: async page => {
    if (baseline) await page.route('**/js/*.js*', route => {
      const name = new URL(route.request().url()).pathname.split('/').pop().replace('.js','');
      return originals[name] ? route.fulfill({ contentType: 'application/javascript', body: originals[name] }) : route.continue();
    });
  }});
  const { page } = f, report = {};
  try {
    await page.evaluate(() => {
      window.requestAnimationFrame = () => 0; G.onLockChange = () => {}; G.Input.unlock(); G.Input.lock = () => {};
      G.UI.opts.renderResolution = '100';
      G.startGame({ ...G.UI.opts, quality: 'medium', players: 4, size: 2, loadout: 'all' }); G.paused = true;
      const p = G.Game.plane;
      p.start.set(0,0,0); p.dir.set(0,0,-1); p.t = 0; p.mesh.rotation.set(0,0,0); G.Game.updatePlane(0);
    });
    if (!baseline) {
      report.physics = await page.evaluate(() => {
        const { Game, Player: P, Input: I, World: W } = G, a = Game.player;
        const saved = { ground: W.ground, waterAt: W.waterAt };
        const check = (ok, msg) => { if (!ok) throw Error(msg); };
        const result = { rates: [], landings: [], templates: [] };
        W.ground = () => 0; W.waterAt = () => -100;
        function reset(y = 2000) {
          I.reset(); a.state = 'plane'; Game.jump(a); a.pos.set(0,y,0); a.vel.set(0,-48,0); P.dropT=2;
        }
        try {
          for (const hz of [30,60,144]) {
            const row={hz};
            for (const mode of ['freefall','chute']) for (const fast of [false,true]) {
              reset(); if(mode==='chute') { Game.openChute(a); a.air.deployT=2; a.air.open=1; a.vel.y=-5.2; }
              I.keys.ShiftLeft=fast;
              for(let i=0;i<6*hz;i++) P.updateDrop(1/hz);
              row[mode+(fast?'Fast':'Normal')]=-a.vel.y;
            }
            check(row.freefallFast>row.freefallNormal*1.65,'Shift 자유낙하가 빨라지지 않음');
            check(row.chuteFast>row.chuteNormal*2.6,'Shift 낙하산 하강이 빨라지지 않음');
            I.keys.ShiftLeft=false; for(let i=0;i<3*hz;i++)P.updateDrop(1/hz);
            check(Math.abs(a.vel.y+5.2)<.02,'Shift 해제 뒤 속도 복원 실패');
            result.rates.push(row);
            reset(110.1); a.vel.y=-82; a.air.dive=1; I.keys.ShiftLeft=true;
            let lowest=Infinity, opened=false, maxStep=0, prev=a.vel.y, frames=0;
            while(a.state!=='ground'&&frames<30*hz) {
              P.updateDrop(1/hz); frames++; lowest=Math.min(lowest,a.pos.y);
              if(a.state==='chute') { opened=true; maxStep=Math.max(maxStep,Math.abs(a.vel.y-prev)); }
              prev=a.vel.y;
            }
            check(opened&&a.state==='ground'&&a.hp===100&&lowest>-.5,'최대 급강하 자동 전개/착지 실패');
            check(!a.model.chute.visible&&!a.air,'착지 뒤 낙하산 상태가 남음');
            result.landings.push({hz,seconds:frames/hz,lowest,maxVelocityStep:maxStep});
          }
          for(const side of [-1,1]) {
            const p=Game.plane, prevId=a.id; a.id=side<0?1:0; a.state='plane';
            p.mesh.rotation.y=.73; Game.jump(a);
            const expected=p.mesh.userData.exits[side<0?0:1].clone().applyQuaternion(p.mesh.quaternion).add(p.pos);
            check(a.pos.distanceTo(expected)<1e-5,'실제 강하문과 이탈 위치가 다름');
            check(a.vel.dot(p.dir)>p.speed*.9,'기체 전진 속도 상속 실패'); a.id=prevId;
          }
          Game.plane.mesh.rotation.y=0;
          reset(230); I.hits.KeyF=true; P.updateDrop(1/60); I.endFrame();
          check(a.state==='chute'&&a.air.open<.01,'수동 전개/초기 팽창 단계 실패');
          let previous=0;
          for(let i=0;i<90;i++) { P.updateDrop(1/60); Game.syncModels(1/60); check(a.air.open>=previous,'낙하산 역팽창'); previous=a.air.open; }
          check(a.air.open===1&&a.model.chute.userData.canopy.scale.x===1,'완전 팽창 실패');
          const chute=a.model.chute;
          for(let i=0;i<20;i++)a.model.showChute(true);
          check(a.model.chute===chute,'프레임마다 낙하산을 재생성함');
          const actorView={state:'chute',air:a.air,groundY:200,distance2:25,speed:0,pitch:0,cur:'fists',onGround:false};
          for(let n=-1;n<G.Soldiers.templates.length;n++) {
            const old=Math.random; Math.random=()=>n<0?0:(n+.1)/G.Soldiers.templates.length;
            let m; try { m=new G.CharacterModel({soldier:n>=0}); } finally { Math.random=old; }
            try {
              G.scene.add(m.root); m.root.position.set(0,200,0);m.showChute(true);
              for(let i=0;i<60;i++)m.update(1/60,actorView);
              m.root.updateMatrixWorld(true);
              m.root.traverse(o=>check(o.matrixWorld.elements.every(Number.isFinite),'뼈대/천 행렬의 비정상 값'));
              check([...m.chute.userData.lines.geometry.attributes.position.array].every(Number.isFinite),'연결줄의 비정상 값');
              result.templates.push(m.soldier?.T.name||'절차적 대체 모델');
            } finally { m.dispose(); }
          }
          const glass=Game.plane.mesh.getObjectByName('수송기_glass')?.geometry;
          check(glass,'수송기 조종석 창 누락');
          const gp=glass.attributes.position,gn=glass.attributes.normal;
          for(let i=0;i<gp.count;i++)check(gp.getX(i)*gn.getX(i)+(gp.getY(i)-.25)*gn.getY(i)>0,'창의 면이 안쪽을 향함');
          result.outwardGlassVertices=gp.count;
          const prop=Game.props[0],z=prop.rotation.z;Game.updatePlane(.1);
          check(Math.abs(prop.rotation.z-z-4)<1e-6,'엔진 팬 축 애니메이션 실패');
          result.rotorMeshes=Game.props.reduce((sum,p)=>sum+p.children.filter(c=>c.isMesh).length,0);
          check(result.rotorMeshes===8,'엔진 팬 메시 병합 누락');
          const bot=Game.actors.find(b=>b.brain&&b.team!==a.team);
          bot.state='plane';Game.jump(bot);bot.pos.set(100,300,100);bot.brain.dropTarget.set(100,0,100);
          let botOpened=false;
          for(let i=0;i<3600&&bot.state!=='ground';i++) {bot.brain.updateDrop(1/60);if(bot.state==='chute')botOpened=true;}
          check(botOpened&&bot.state==='ground'&&!bot.air&&!bot.model.chute.visible,'봇 자동 강하/전개/착지 실패');
          result.botLanding=true;
        } finally { Object.assign(W,saved); I.reset(); }
        return result;
      });
      // 실제 키보드 이벤트와 키 재지정 경로를 통과시킨다.
      for (const key of ['ShiftLeft','ShiftRight','KeyP']) {
        await page.evaluate(key=>{
          const a=G.Game.player; a.state='plane';G.Game.jump(a);a.pos.set(0,2000,0);a.vel.set(0,-48,0);
          if(key==='KeyP')G.Settings.setBind('ShiftLeft','KeyP');
          G.Input.locked=true;G.paused=false;
        },key);
        await page.keyboard.down(key);
        const speed=await page.evaluate(()=>{for(let i=0;i<180;i++)G.Player.updateDrop(1/60);return -G.Game.player.vel.y});
        await page.keyboard.up(key); assert(speed>79,key+' 실제 입력 실패');
      }
      await page.evaluate(()=>{G.Settings.setBind('ShiftLeft','ShiftLeft');G.Input.locked=false;G.Input.reset();G.paused=true});
      report.keyboard='양쪽 Shift·재지정 P·해제 통과';
    }
    fs.mkdirSync(shots,{recursive:true});
    await page.addStyleTag({content:'#hud{visibility:hidden!important}'});
    const tag=baseline?'before':'after';
    const capture=async name=>{await page.evaluate(()=>{G.renderNow();G.Perf.gpuWait()});await page.screenshot({path:path.join(shots,tag+'-'+name+'.png'),timeout:60000})};
    await page.evaluate(()=>{
      const p=G.Game.plane;p.t=0;p.mesh.rotation.set(0,0,0);G.Game.updatePlane(0);G.Player.updatePlane(0);
      G.camera.position.copy(p.pos).add(new THREE.Vector3(37,15,-32));G.camera.lookAt(p.pos);G.camera.fov=62;G.camera.updateProjectionMatrix();
    });
    await capture('plane');
    if(!baseline) {
      await page.evaluate(()=>{
        const a=G.Game.player;a.state='plane';G.Player.updatePlane(0);G.Game.jump(a);
        for(let i=0;i<18;i++){G.Game.updatePlane(1/60);G.Player.updateDrop(1/60);G.Game.syncModels(1/60)}
      });
      await capture('exit');
    }
    await page.evaluate(()=>{
      const a=G.Game.player;a.state='plane';G.Game.jump(a);a.pos.set(0,250,0);a.vel.set(0,-48,0);G.Player.dropT=3;
      if(a.air)a.air.elapsed=3;
      for(let i=0;i<60;i++){G.Player.updateDrop(1/60);G.Game.syncModels(1/60)}
    });
    await capture('freefall');
    if(!baseline) {
      await page.evaluate(()=>{G.Input.keys.ShiftLeft=true;for(let i=0;i<45;i++){G.Player.updateDrop(1/60);G.Game.syncModels(1/60)}G.Input.reset()});
      await capture('dive');
    }
    await page.evaluate(()=>{G.Game.openChute(G.Game.player);for(let i=0;i<15;i++){G.Player.updateDrop(1/60);G.Game.syncModels(1/60)}});
    if(!baseline)await capture('opening');
    if(!baseline) {
      await page.evaluate(()=>{
        const m=G.Game.player.model,c=m.chute.userData.canopy;
        m.root.updateMatrixWorld(true);
        const p=c.localToWorld(new THREE.Vector3(0,.65,0)).project(G.camera);
        if(!Number.isFinite(p.y)||p.y>1||p.y< -1)throw Error('전개 중 낙하산이 카메라 화면 밖으로 잘림');
      });
    }
    await page.evaluate(()=>{for(let i=0;i<100;i++){G.Player.updateDrop(1/60);G.Game.syncModels(1/60)}});
    await capture('chute');
    if(!baseline) {
      await page.addStyleTag({content:'#hud{visibility:visible!important}#centerMsg{display:none!important}'});
      await page.evaluate(()=>G.UI.update(.016));
      await capture('hud');
    }
    assert.deepEqual(f.errors,[]);report.errors=f.errors;
    fs.writeFileSync(path.join(shots,tag+'-checks.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
    console.log('PASS '+(baseline?'v87 비교 화면':'강하·전개·Shift·착지·뼈대·브라우저 화면'));
  } finally { await f.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
