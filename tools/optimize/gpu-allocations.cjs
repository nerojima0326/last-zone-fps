// 브라우저에 주입해 실제 GL 저장소 요청의 크기와 수명을 기록한다.
// 드라이버·OS 내부 메모리를 포함하지 않는 텍스처·렌더 버퍼 추정치다.
module.exports=function(){
 const textures=new Map(),buffers=new Map();let peak=0,contexts=0,lost=0;
 const raw={32856:4,35907:4,32849:3,35905:3,33321:1,33323:2,33325:2,33326:4,33327:4,33328:8,33329:1,33330:1,33331:2,33332:2,33333:4,33334:4,33335:2,33336:2,33337:4,33338:4,33339:8,33340:8,34842:8,34843:6,34836:16,34837:12,33189:2,33190:4,35056:4,36012:4,36013:8,32857:4,35898:4,35901:4};
 const block=format=>[33776,33777,35916,35917,36196,37492,37493,37494,37495,36283,36284].includes(format)?8:[33778,33779,35918,35919,37490,37491,37496,37497,36492,36493,36494,36495,36285,36286,37808,37840].includes(format)?16:0;
 const size=(format,w,h)=>block(format)?Math.ceil(w/4)*Math.ceil(h/4)*block(format):w*h*(raw[format]||4);
 const total=()=>[...textures.values(),...buffers.values()].reduce((s,x)=>s+x.bytes,0),touch=()=>{peak=Math.max(peak,total())};
 for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']){
  const p=window[name]?.prototype;if(!p)continue;
  const wrap=(method,fn)=>{const old=p[method];if(old)p[method]=function(...a){const result=old.apply(this,a);fn(this,a);return result}};
  wrap('texStorage2D',(gl,a)=>{const [target,levels,format,w,h]=a,tex=gl.getParameter(target===gl.TEXTURE_CUBE_MAP?gl.TEXTURE_BINDING_CUBE_MAP:gl.TEXTURE_BINDING_2D);if(!tex)return;let sum=0;for(let i=0;i<levels;i++)sum+=size(format,Math.max(1,w>>i),Math.max(1,h>>i));textures.set(tex,{kind:'texture',w,h,format,bytes:sum*(target===gl.TEXTURE_CUBE_MAP?6:1)});touch()});
  wrap('renderbufferStorage',(gl,a)=>{const [,format,w,h]=a,b=gl.getParameter(gl.RENDERBUFFER_BINDING);if(b)buffers.set(b,{kind:'renderbuffer',w,h,format,samples:1,bytes:size(format,w,h)});touch()});
  wrap('renderbufferStorageMultisample',(gl,a)=>{const [,requested,format,w,h]=a,b=gl.getParameter(gl.RENDERBUFFER_BINDING),samples=gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_SAMPLES);if(b)buffers.set(b,{kind:'renderbuffer',w,h,format,samples,requested,bytes:size(format,w,h)*Math.max(1,samples)});touch()});
  wrap('deleteTexture',(_,a)=>textures.delete(a[0]));wrap('deleteRenderbuffer',(_,a)=>buffers.delete(a[0]));
 }
 const get=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();
 HTMLCanvasElement.prototype.getContext=function(...a){const c=get.apply(this,a);if(c&&/^webgl/.test(a[0])&&!seen.has(c)){seen.add(c);contexts++;this.addEventListener('webglcontextlost',()=>{lost++;textures.clear();buffers.clear()})}return c};
 window.__lzGpuAlloc={snapshot(){const storage=[...textures.values(),...buffers.values()];return{contexts,lost,estimatedBytes:total(),peakEstimatedBytes:peak,unknownFormats:[...new Set(storage.filter(x=>!raw[x.format]&&!block(x.format)).map(x=>x.format))],storage}}};
};
