
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 동일한 옵션으로 변경 전/후 미리보기와 실제 1인칭 화면을 저장한다.
const fs=require('fs'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
(async()=>{const f=await fixture({viewport:{width:1100,height:700},route:async p=>{if(process.env.BASELINE_DIR)await p.route('http://127.0.0.1:*/**',route=>{const url=new URL(route.request().url()),rel=url.pathname==='/'?'index.html':url.pathname.slice(1),file=path.join(process.env.BASELINE_DIR,rel);return fs.existsSync(file)?route.fulfill({contentType:rel.endsWith('.html')?'text/html':'application/javascript',body:fs.readFileSync(file)}):route.continue()})}});try{
 const p=f.page,out=process.env.SHOTS||'/tmp/attachments';fs.mkdirSync(out,{recursive:true});
 await p.evaluate(async()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='frame'?0:raf(cb);G.onLockChange=()=>{};G.Input.unlock();G.Input.lock=()=>{};for(const id of G.GUN_IDS)G.VM.ensure(id);await G.AssetVM.loadAll();G.startGame({...G.UI.opts,mode:'training',quality:'medium'});G.paused=true;G.UI.showPause(false)});
 for(const id of ['ar7','g18','ka47','kr98','mp9','lm86']){
  await p.evaluate(id=>{const a=G.Game.player,d=G.WEAPONS[id],options=G.Attachments.options(d),parts={};for(const k of ['muzzle','under','side','stock','magazine'])if(options[k][1])parts[k]=k==='under'?'angled':k==='magazine'?'extendedQuick':options[k][1][0];a.weapons[d.cls]={id,mag:d.mag,scope:d.scopes.includes('x4')?'x4':d.scopes[0],attachments:parts};a.cur=d.cls;Object.assign(G.Player,{raise:1,sw:null,reload:null,ads:0,scopeView:0,landDip:0,sprinting:false});for(let i=0;i<120;i++)G.Player.updateCamera(1/60);G.Attachments.viewSlot=d.cls;G.Attachments.open=true;G.Attachments.panel.hidden=false;G.Attachments.render()},id);
  await p.locator('#attachPreview').screenshot({path:path.join(out,id+'.png')});
 }
 if(!process.env.BASELINE_DIR)for(const id of ['ar7','g18','ka47','mp9','lm86'])for(const under of id==='g18'?['none']:['grip','angled']){
  await p.evaluate(({id,under})=>{G.Attachments.panel.hidden=true;const a=G.Game.player,d=G.WEAPONS[id];a.weapons[d.cls]={id,mag:d.mag,scope:'reddot',attachments:{muzzle:'suppressor',under:under==='none'?null:under,side:'laser',stock:d.cls==='rifle'?'tactical':null,magazine:'extendedQuick'}};a.cur=d.cls;Object.assign(G.Player,{raise:1,sw:null,reload:null,ads:0,scopeView:0,landDip:0,sprinting:false});for(let i=0;i<120;i++)G.Player.updateCamera(1/60);G.renderer.setRenderTarget(null);G.renderer.setClearColor(0x2a3641,1);G.renderer.autoClear=true;G.renderer.render(G.vmScene,G.vmCamera)}, {id,under});
  await p.locator('#app canvas').screenshot({path:path.join(out,id+'-'+under+'-hands.png')});
 }
 console.log('PASS: 화면 저장',f.errors);if(f.errors.length)throw Error(JSON.stringify(f.errors));
 }finally{await f.close()}})().catch(e=>{console.error(e);process.exitCode=1});
