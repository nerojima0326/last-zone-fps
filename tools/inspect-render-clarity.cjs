// 실제 브라우저의 출력 크기·DRS 하한·MSAA·텍스처 설정을 변경 전후에 기록한다.
const fs=require('fs'),path=require('path'),fixture=require('./optimize/browser-fixture.cjs');
const out=process.argv[2]||'/tmp/lz-render-clarity-before.json';
(async()=>{
 const report={view:[960,540],devices:[]};
 for(const dpr of [1,1.25,1.5]){
  const f=await fixture({liveDRS:true,deviceScaleFactor:dpr});
  try{
   await f.page.evaluate(()=>{window.requestAnimationFrame=()=>0;G.qualityMode='manual'});await f.page.waitForTimeout(80);
   const device=await f.page.evaluate(()=>{
    const R=G.renderer,D=G.DRS,gl=R.getContext(),rows=[];const read=()=>{
     const rt=G.composerRT(),canvas=R.domElement,css=canvas.getBoundingClientRect();
     return{dpr:devicePixelRatio,canvas:[canvas.width,canvas.height],css:[css.width,css.height],rendererPixelRatio:R.getPixelRatio(),composerPixelRatio:G.renderResolutionInfo?.().composerPixelRatio??rt.width/innerWidth,scene:[rt.width,rt.height],sceneOfNative:rt.width/(innerWidth*devicePixelRatio),scale:D.scale,minScale:D.minScale,base:D.base,applied:D.applied,samples:rt.samples,fxaa:G.fxaaPass.enabled};
    };
    for(const tier of ['potato','low','medium','high']){
     G.__apply(tier);const initial=read();G.Game.state='playing';G.paused=false;D.refresh=1000/60;D.target=120;
     let now=performance.now()+10000;D.checkT=0;
     for(let i=0;i<22;i++){now+=501;D.frame(now,50)}
     const floor=read();G.paused=true;G.Game.state='menu';rows.push({tier,initial,floor});
    }
    const seen=new Set(),textures=[];
    for(const root of [G.scene,G.vmScene])root.traverse(o=>{for(const m of [].concat(o.material||[]))for(const key in m){const t=m[key];if(!t?.isTexture||seen.has(t))continue;seen.add(t);textures.push({name:t.name||key,aniso:t.anisotropy,min:t.minFilter,generateMipmaps:t.generateMipmaps,mips:t.mipmaps?.length||0,compressed:!!t.isCompressedTexture,renderTarget:!!t.isRenderTargetTexture,data:!!t.isDataTexture})}});
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return{dpr:devicePixelRatio,rows,gpu:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),maxAniso:R.capabilities.getMaxAnisotropy(),maxSamples:R.capabilities.maxSamples,halfFloatSamples:Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)),textures};
   });
   device.errors=f.errors;report.devices.push(device);
   console.log(JSON.stringify({dpr:device.dpr,gpu:device.gpu,maxAniso:device.maxAniso,samples:device.halfFloatSamples,tiers:device.rows.map(r=>({tier:r.tier,initial:r.initial.scene,canvas:r.initial.canvas,floor:r.floor.scene,scale:r.floor.scale,nativePercent:100*r.floor.sceneOfNative}))}));
  }finally{await f.close()}
 }
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log('검사 기록:',out);
})().catch(e=>{console.error(e);process.exitCode=1});
