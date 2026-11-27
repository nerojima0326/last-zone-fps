
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// v81: 실제 브라우저에서 네이티브 출력, 고정 해상도, MSAA, 후처리·텍스처 계약을 확인한다.
const assert=require('assert'),fs=require('fs'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.env.REPORT||'/tmp/lz-v81-render-check.json';
(async()=>{
 const report={devices:[]};
 for(const dpr of [1,1.25,1.5]){
  const f=await fixture({deviceScaleFactor:dpr,liveDRS:true,preserveOptions:true});
  try{
   const p=f.page;
   await p.evaluate(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>fn.name==='frame'?0:raf(fn);G.qualityMode='manual'});
   await p.waitForTimeout(100);
   const rows=await p.evaluate(()=>{
    const rows=[],R=G.renderer,D=G.DRS;
    for(const tier of ['potato','low','medium','high']){
     G.setRenderResolution('auto');G.__apply(tier);G.Game.state='playing';G.paused=false;D.refresh=1000/60;
     let time=performance.now()+20000;D.checkT=0;
     for(let i=0;i<24;i++)D.frame(time+=501,50);
     const rt=G.composerRT();
     rows.push({tier,scale:D.scale,floor:D.minScale,canvas:[R.domElement.width,R.domElement.height],css:[innerWidth,innerHeight],scene:[rt.width,rt.height],pixelRatio:R.getPixelRatio(),samples:rt.samples,fxaa:G.fxaaPass.enabled});
     G.paused=true;G.Game.state='menu';
    }return rows;
   });
   for(const r of rows){
    assert.equal(r.pixelRatio,dpr);assert.deepEqual(r.canvas,r.css.map(x=>Math.floor(x*dpr)));
    assert.equal(r.scale,{potato:.35,low:.55,medium:.85,high:.85}[r.tier]);
    assert(Math.abs(r.scene[0]/r.canvas[0]-r.scale)<.002);assert.equal(r.fxaa,r.samples===0);
    if(r.tier==='low'||r.tier==='medium')assert.equal(r.samples,2);
   }
   const fixed=await p.evaluate(()=>{
    const rows=[],D=G.DRS;
    for(const mode of ['67','75','85','100'])for(const tier of ['potato','high']){
     G.setRenderResolution(mode);G.__apply(tier);G.paused=false;G.Game.state='playing';D.checkT=0;
     for(let i=0,t=performance.now()+50000;i<30;i++)D.frame(t+=501,i%2?50:5);
     G.paused=true;G.Game.state='menu';const rt=G.composerRT();
     rows.push({mode,tier,scale:D.scale,size:[rt.width,rt.height],info:G.renderResolutionInfo()});
    }
    G.setRenderResolution('invalid');return rows;
   });
   for(const r of fixed){assert.equal(r.scale,Number(r.mode)/100);assert.equal(r.info.mode,'고정');assert.equal(r.info.percent,Number(r.mode));}
   const governed=await p.evaluate(()=>{
    G.setRenderResolution('75');G.__apply('high');G.qualityMode='auto';G.Game.state='playing';G.paused=false;
    let time=performance.now()+100000;G.DRS.checkT=0;
    for(let i=0;i<30;i++)G.DRS.frame(time+=501,40);
    const down=G.quality;
    // v108 15초 무렵 한 단계 복귀, 27초 무렵 다음 단계 복귀를 각각 확인한다.
    let firstUp;for(let i=0;i<55;i++){G.DRS.frame(time+=501,1000/60);if(i===29)firstUp=G.quality;}
    const up=G.quality;G.paused=true;G.Game.state='menu';G.qualityMode='manual';
    return{down,firstUp,up,scale:G.DRS.scale};
   });
   assert.equal(governed.down,'potato');assert.equal(governed.firstUp,'low');assert.equal(governed.up,'medium');assert.equal(governed.scale,.75);
   // 메뉴·모달 양쪽 설정과 저장값이 같은 해상도를 사용한다.
   await p.click('[data-tab="gfx"]');await p.click('[data-opt="renderResolution"] [data-v="75"]');
   await p.click('#settingsBtn');await p.selectOption('#setRenderResolution','67');
   const ui=await p.evaluate(()=>{
    G.Game.state='playing';G.UI.fps(60,G.DRS.scale,1000/60);G.Game.state='menu';
    return{stored:JSON.parse(localStorage.lastzone_opts).renderResolution,button:document.querySelector('[data-opt="renderResolution"] .on').dataset.v,fps:document.getElementById('fpsBox').textContent};
   });
   assert.equal(ui.stored,'67');assert.equal(ui.button,'67');assert.match(ui.fps,/해상도 67% \(고정\)/);
   await p.click('#setClose');await p.setViewportSize({width:801,height:451});
   await p.waitForFunction(dpr=>G.renderer.domElement.width===Math.floor(801*dpr)&&G.renderer.domElement.height===Math.floor(451*dpr),dpr);
   const resized=await p.evaluate(()=>({canvas:[G.renderer.domElement.width,G.renderer.domElement.height],scale:G.DRS.scale,scene:[G.composerRT().width,G.composerRT().height]}));
   assert.deepEqual(resized.canvas,[Math.floor(801*dpr),Math.floor(451*dpr)]);assert.equal(resized.scale,.67);
   const post=await p.evaluate(()=>{
    const R=G.renderer,T=THREE;
    G.__apply('low');G.setRenderResolution('67');G.renderNow();
    const rt=G.composerRT(),gl=R.getContext(),old=gl.getParameter(gl.RENDERBUFFER_BINDING),rb=R.properties.get(rt).__webglColorRenderbuffer?.[0];
    let actualSamples=null;if(rb){gl.bindRenderbuffer(gl.RENDERBUFFER,rb);actualSamples=gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_SAMPLES);gl.bindRenderbuffer(gl.RENDERBUFFER,old)}
    const native=[R.domElement.width,R.domElement.height],target=G.presentationRT();
    const size=[target.width,target.height];G.Settings.data.visual.sharpen=0;G.Settings.apply();G.renderNow();
    const off={size:[target.width,target.height],strength:G.sharpenPass.uniforms.uStrength.value,legacy:G.upAA.uniforms.uSharp.value};
    G.Settings.data.visual.sharpen=.35;G.Settings.apply();G.renderNow();
    // RT용 화면 복사도 실제 GL에서 실행해 색·프레임버퍼 오류를 검사한다.
    G.sharpenRT(R);
    const oldMax=R.capabilities.maxSamples;R.capabilities.maxSamples=0;G.__apply('medium');G.renderNow();
    const fallback={samples:G.composerRT().samples,fxaa:G.fxaaPass.enabled};R.capabilities.maxSamples=oldMax;G.__apply('low');
    return{native,size,off,requestedSamples:rt.samples,actualSamples,fallback};
   });
   assert.deepEqual(post.size,post.native);assert.deepEqual(post.off,{size:[1,1],strength:0,legacy:0});
   assert(post.actualSamples>=2);assert.deepEqual(post.fallback,{samples:0,fxaa:true});
   const textures=await p.evaluate(()=>{
    const T=THREE,R=G.renderer,Q=G.TextureQuality;
    const image=document.createElement('canvas');image.width=image.height=8;
    const late=new T.CanvasTexture(image);late.anisotropy=1;late.minFilter=T.LinearFilter;late.generateMipmaps=false;
    R.initTexture(late);
    const uploaded={aniso:late.anisotropy,min:late.minFilter,mips:late.generateMipmaps};
    late.anisotropy=1;late.minFilter=T.NearestFilter;
    const m=new T.MeshBasicMaterial({map:late,alphaTest:.5}),mesh=new T.Mesh(new T.PlaneGeometry(1,1),m);G.scene.add(mesh);
    Q.scan(G.scene,true);const corrected={aniso:late.anisotropy,min:late.minFilter,coverage:m.alphaToCoverage};
    const data=new T.DataTexture(new Uint8Array(4),2,2,T.RedIntegerFormat);data.minFilter=T.NearestFilter;data.generateMipmaps=false;
    Q.texture(data);const excluded={min:data.minFilter,mips:data.generateMipmaps,aniso:data.anisotropy};
    G.renderNow();const count=Q.changed;for(let i=0;i<4;i++)Q.scan(G.scene,true);const stable=Q.changed===count;
    G.__apply('potato');const noMSAA=m.alphaToCoverage;
    G.scene.remove(mesh);mesh.geometry.dispose();m.dispose();late.dispose();data.dispose();
    return{max:Q.maxAnisotropy,uploaded,corrected,excluded,stable,noMSAA};
   });
   assert.equal(textures.uploaded.aniso,textures.max);assert.equal(textures.uploaded.min,1008);assert(textures.uploaded.mips);
   assert.equal(textures.corrected.aniso,textures.max);assert.equal(textures.corrected.min,1008);assert(textures.corrected.coverage);
   assert.deepEqual(textures.excluded,{min:1003,mips:false,aniso:1});assert(textures.stable);assert.equal(textures.noMSAA,false);
   const rt=await p.evaluate(()=>{
    // ThreeRT 실제 모듈은 소프트웨어 GPU에서 지원되지 않는다. 공개 API의 크기 계약만 대역으로 확인한다.
    const wrapper=G.RT,original={rt:wrapper.rt,wanted:wrapper.wanted,state:wrapper.state,dirty:wrapper.dirty,syncLights:wrapper.syncLights,drawBackground:wrapper.drawBackground,tag:wrapper.tag,depthMat:wrapper.depthMat};
    const calls=[],fake={fog:{color:new THREE.Color()},adaptiveQuality:true,renderScale:.375,setSize:(w,h)=>calls.push([w,h]),render:()=>{},updateDynamic:()=>{}};
    Object.assign(wrapper,{rt:fake,wanted:true,state:'on',dirty:false,syncLights:()=>{},drawBackground:()=>{},tag:()=>{},depthMat:new THREE.MeshBasicMaterial({colorWrite:false})});
    G.setRenderResolution('75');wrapper.last.set(-1,-1);const snapshot={scale:fake.renderScale,adaptive:fake.adaptiveQuality};
    const rendering=G.renderer.render;G.renderer.render=()=>{};
    try{wrapper.render(G.renderer,G.scene,G.camera,G.vmScene,G.vmCamera)}finally{G.renderer.render=rendering}
    const result={calls,sceneScale:wrapper.sceneScale,snapshot,after:{scale:fake.renderScale,adaptive:fake.adaptiveQuality},native:[G.renderer.domElement.width,G.renderer.domElement.height]};
    wrapper.depthMat.dispose();Object.assign(wrapper,original);G.DRS.apply(true);return result;
   });
   assert.equal(rt.sceneScale,.75);assert.deepEqual(rt.calls,[rt.native.map(v=>Math.floor(v*.75))]);assert.deepEqual(rt.after,rt.snapshot);
   await p.reload();await p.waitForFunction(()=>document.querySelector('#menu:not(.hidden)'),null,{timeout:240000});
   const restored=await p.evaluate(()=>({mode:G.UI.opts.renderResolution,strength:G.Settings.data.visual.sharpen}));assert.equal(restored.mode,'75');assert.equal(restored.strength,.35);
   assert.deepEqual(f.errors,[]);report.devices.push({dpr,rows,fixed,governed,ui,resized,post,textures,rt,restored});
   console.log('PASS v81 DPR',dpr,'네이티브 출력·85% 하한·고정 설정·MSAA·선명화·텍스처·RT 크기');
  }finally{await f.close()}
 }
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
