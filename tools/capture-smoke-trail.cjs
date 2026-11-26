// 변경 전·후의 같은 실제 궤적을 렌더링한다. 영상은 1배속이며 성능 측정용은 아니다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),fixture=require('./throwable-fixture.cjs');
const mode=process.argv[2]||'after',out=path.resolve(process.env.SMOKE_SHOTS||'/tmp/lz-v101-smoke-video'),base=process.env.SMOKE_BASE||'23341e70be77f0fb0eee902cbd88f98b7140befc',fps=15;
(async()=>{
 if(mode==='encode'){
  const destination=path.resolve(process.env.SMOKE_DELIVERY||'/workspace/artifacts/v101-smoke-trail-comparison.mp4'),font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';fs.mkdirSync(path.dirname(destination),{recursive:true});
  const labels=['변경 전 v100 · 비행 중 연기 없음','변경 후 v101 · 궤적 연기 → 착지 연막'];
  const filter=labels.map((text,i)=>`[${i}:v]pad=iw:450:0:45:color=0x111820,drawtext=fontfile=${font}:text='${text}':x=18:y=12:fontsize=19:fontcolor=white[v${i}]`).join(';')+';[v0][v1]vstack=inputs=2[v]';
  cp.execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(fps),'-i',path.join(out,'before','%04d.png'),'-framerate',String(fps),'-i',path.join(out,'after','%04d.png'),'-filter_complex',filter,'-map','[v]','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',destination],{stdio:'inherit'});
  cp.execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','1.4','-i',destination,'-frames:v','1',destination.replace(/\.mp4$/,'.jpg')],{stdio:'inherit'});
  console.log('PASS 비교 영상',destination);return;
 }
 if(!['before','after'].includes(mode))throw Error('before / after / encode 중 하나를 지정하세요');
 const f=await fixture(mode==='before'?base:null),p=f.page,dir=path.join(out,mode),rows=[];fs.mkdirSync(dir,{recursive:true});
 try{
  await p.evaluate(()=>{
   G.Player.abortThrow();G.Throwables.reset();G.FX.reset();G.VM.set(null);G.renderer.toneMappingExposure=.7;G.setRenderResolution('100');
   const W=G.World,r=W.range,x=r.x+6,z=r.line-17,y=W.ground(x,z,r.y+2,.2,3);
   window.smokeCapture={p:new THREE.Vector3(x,y,z),t:0,first:null,puffs:0};const s=smokeCapture;
   G.camera.position.copy(s.p).add(new THREE.Vector3(16,11,24));G.camera.lookAt(x+6,y+5,z-2);G.camera.fov=45;G.camera.updateProjectionMatrix();G.camera.updateMatrixWorld(true);W.update(0,G.camera.position,G.camera);
   Math.random=G.U.mulberry32(101726);
   const trail=G.Throwables.smokeTrail;if(trail)G.Throwables.smokeTrail=function(o,dt){const count=G.FX.norm.list.length;trail.call(this,o,dt);s.puffs+=G.FX.norm.list.length-count;};
   G.Throwables.throw(G.Game.player,'smoke',s.p.clone().add(new THREE.Vector3(0,1.7,0)),new THREE.Vector3(9,19,-3));
  });
  for(let frame=0;frame<fps*6;frame++){
   const data=await p.evaluate(t=>{
    const s=smokeCapture;while(s.t<t-1e-7){const dt=Math.min(1/60,t-s.t);G.Throwables.update(dt);G.FX.update(dt);s.t+=dt;if(!s.first&&G.Throwables.smokes.length)s.first={time:s.t,pos:G.Throwables.smokes[0].pos.clone().sub(s.p).toArray()};}
    G.renderNow();G.Perf.gpuWait();return {image:G.renderer.domElement.toDataURL('image/png').split(',')[1],row:{time:s.t,pos:G.Throwables.list[0]?.pos.clone().sub(s.p).toArray(),puffs:s.puffs,clouds:G.Throwables.smokes.length,particles:G.FX.norm.list.length}};
   },frame/fps);
   fs.writeFileSync(path.join(dir,String(frame).padStart(4,'0')+'.png'),Buffer.from(data.image,'base64'));rows.push(data.row);
  }
  const first=await p.evaluate(()=>smokeCapture.first);const report={mode,base,fps,frames:rows.length,seconds:rows.length/fps,first,rows,errors:f.errors};
  fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify(report,null,2)+'\n');if(f.errors.length)throw Error(f.errors.join('\n'));
  console.log('PASS 실제 궤적 렌더',mode,first,'연기 입자',rows.at(-1).puffs);
 }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
