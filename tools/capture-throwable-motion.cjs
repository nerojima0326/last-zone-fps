
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 수정 전 커밋과 작업 트리를 각각 실행해 손 동작·공중 연막을 비교할 원본 프레임을 만든다.
const fs=require('fs'),path=require('path'),fixture=require('./throwable-fixture.cjs');
const mode=process.argv[2]||'after',out=path.resolve(process.env.THROW_SHOTS||'/tmp/lz-v98-video'),base=process.env.THROW_BASE||'4a5a0136569f10a6807eb24d2059efed6e79897f',fps=30;
(async()=>{
 const f=await fixture(mode==='before'?base:null),p=f.page,prior=fs.existsSync(path.join(out,mode+'.json'))?JSON.parse(fs.readFileSync(path.join(out,mode+'.json'))):{},report={mode,base,frames:0,events:process.env.THROW_SKIP_HANDS==='1'?(prior.events||[]):[],smoke:process.env.THROW_SKIP_SMOKE==='1'?prior.smoke:null,errors:f.errors};fs.mkdirSync(out,{recursive:true});
 const save=async(file,image)=>fs.writeFileSync(file,Buffer.from(image,'base64'));
 try{
  if(process.env.THROW_SKIP_HANDS!=='1')for(const kind of ['frag','molotov','smoke','flash']){
   const dir=path.join(out,mode+'-'+kind);fs.mkdirSync(dir,{recursive:true});await p.evaluate(kind=>throwVideo.start(kind),kind);
   for(let i=0;i<90;i++){await p.evaluate(t=>throwVideo.advance(t),i/fps);await save(path.join(dir,String(i).padStart(4,'0')+'.png'),await p.evaluate(()=>throwVideo.image()));report.frames++;}
   report.events.push(await p.evaluate(()=>({kind:throwVideo.kind,rows:throwVideo.rows})));console.log('촬영',mode,kind);
  }
  if(process.env.THROW_SKIP_SMOKE!=='1'){
   const dir=path.join(out,mode+'-air-smoke');fs.mkdirSync(dir,{recursive:true});
   await p.evaluate(()=>{
    G.Player.abortThrow();G.Throwables.reset();G.FX.reset();G.VM.set(null);G.renderer.toneMappingExposure=.6;G.setRenderResolution('75');const W=G.World,r=W.range,x=r.x+23,z=r.line-17,y=W.ground(x,z,r.y+2,.2,3);window.smokeVideo={p:new THREE.Vector3(x,y,z),t:0,first:null};
    const s=smokeVideo;G.camera.position.copy(s.p).add(new THREE.Vector3(13,10,21));G.camera.lookAt(x,y+8,z);G.camera.updateMatrixWorld(true);W.update(0,G.camera.position,G.camera);Math.random=G.U.mulberry32(980725);G.Throwables.throw(G.Game.player,'smoke',s.p.clone().add(new THREE.Vector3(0,1.7,0)),new THREE.Vector3(0,23.6,0));
   });
   for(let i=0;i<120;i++){
    const png=await p.evaluate(t=>{const s=smokeVideo;while(s.t<t-1e-7){const dt=Math.min(1/60,t-s.t);G.Throwables.update(dt);G.FX.update(dt);s.t+=dt;if(!s.first&&G.Throwables.smokes.length)s.first={time:s.t,height:G.Throwables.smokes[0].pos.y-s.p.y};}G.renderNow();G.Perf.gpuWait();return G.renderer.domElement.toDataURL('image/png').split(',')[1];},i/15);await save(path.join(dir,String(i).padStart(4,'0')+'.png'),png);report.frames++;
   }
   report.smoke=await p.evaluate(()=>({first:smokeVideo.first,canister:G.Throwables.list[0]?.pos.y-smokeVideo.p.y,cloud:G.Throwables.smokes[0]?.pos.y-smokeVideo.p.y}));console.log('촬영',mode,'공중 연막',report.smoke);
  }
  if(f.errors.length)throw Error(f.errors.join('\n'));report.frames=report.events.length*90+(report.smoke?120:0);fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS 투척 실제 렌더 프레임',mode,report.frames);
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
