// Original generated firing reports + CC0 recorded handling.
// The same original generator supplies reports if downloaded banks are absent.
(function(){
'use strict';
const G=window.G,U=G.U;
// 조작음 크기 (사격음 대비) · 같은 종류 안의 무게감
const LEVEL={magout:.15,magin:.20,open:.17,close:.20,shell:.14,port:.16,dry:.11,up:.12,down:.14,switch:.10};
const MASS={ar7:1,ka47:1.08,sc17:1,mk14:1.1,kr98:1.05,s12:1.05,m1014:1,db2:1.05,sa12:1.08,aa12:1.12,p92:.9,g18:.86,m1911:.95,de7:.85,r45:.95};
const base=new URL('assets/audio/weapons/',document.baseURI);
const W=G.WeaponAudio={
 manifest:null, buffers:{}, raw:{}, voices:[], own:[], sequence:{}, generated:{},
 prepare(){
  if(this.preparing)return this.preparing;
  this.preparing=(async()=>{
   const res=await fetch(new URL('manifest.json?v='+window.LZ_BUILD,base));if(!res.ok)throw Error('audio manifest '+res.status);
   const m=await res.json();if(m.schema!==2)throw Error('audio schema');this.manifest=m;
   const banks=[...new Map([m.switch,...Object.values(m.weapons).flatMap(w=>[w.shot,w.fx])].map(b=>[b.path,b])).values()];
   await Promise.all(banks.map(async b=>{const r=await fetch(new URL(b.path+'?v='+b.sha,base));if(!r.ok)throw Error(b.path+' '+r.status);this.raw[b.path]=await r.arrayBuffer()}));
   return true;
  })().catch(e=>{console.info('[audio] bank unavailable; using original report generator',e.message);return false});
  return this.preparing;
 },
 load(ctx){
  if(this.loading)return this.loading;
  this.loading=(async()=>{
   if(!await this.prepare())return false;
   const m=this.manifest,banks=[...new Map([m.switch,...Object.values(m.weapons).flatMap(w=>[w.shot,w.fx])].map(b=>[b.path,b])).values()];
   await Promise.all(banks.map(async b=>{this.buffers[b.path]=await ctx.decodeAudioData(this.raw[b.path].slice(0))}));
   // Handling banks can be shared, while cue alignment belongs to each entry.
   this.align(this.buffers[m.switch.path],m.switch.cues);
   for(const w of Object.values(m.weapons))for(const b of [w.shot,w.fx])this.align(this.buffers[b.path],b.cues);
   this.raw={};
   return true;
  })().catch(e=>{console.info('[audio] decode fallback',e.message);return false});
  return this.loading;
 },
 // MP3 디코더마다 앞쪽 지연이 달라서, 디코딩한 파형에서 각 소리의 실제 시작점을 다시 찾는다
 align(buf,cues){
  const channels=Array.from({length:buf.numberOfChannels},(_,i)=>buf.getChannelData(i)),sr=buf.sampleRate;
  const amplitude=i=>{let v=0;for(const d of channels)v=Math.max(v,Math.abs(d[i]));return v};
  for(const c of Object.values(cues)){
   const a=Math.max(0,Math.floor((c.offset-.025)*sr)),b=Math.min(buf.length,Math.floor((c.offset+c.duration)*sr));
   let peak=0;for(let i=a;i<b;i++)peak=Math.max(peak,amplitude(i));
   let i=a;while(i<b&&amplitude(i)<peak*.14)i++;
   // Either stereo channel can contain the initial crack. Keep its attack,
   // and keep the cue's original end when decoder padding shifts the start.
   c.start=Math.max(0,c.offset-.004,i/sr-.002);
   let e=0;const n=Math.min(b,i+Math.floor(.12*sr));for(let j=i;j<n;j++)for(const d of channels)e+=d[j]*d[j];
   c.loud=Math.sqrt(e/Math.max(1,(n-i)*channels.length));
  }
 },
 bank(id){return this.manifest?.weapons[id]},
 play(a,bank,name,sp,o={}){
  const buffer=o.buffer||this.buffers[bank?.path],cue=bank?.cues[name];if(!buffer||!cue)return null;
  const c=a.ctx,t=c.currentTime+(o.delay||0),rate=(o.rate||1)*(1+(Math.random()-.5)*(o.vary??.03));
  const offset=cue.start??cue.offset,duration=Math.min(cue.offset+cue.duration-offset,buffer.duration-offset),seconds=duration/rate;
  if(!(duration>0))return null;
  if(this.voices.length>=48)this.kill(this.voices.find(v=>!v.own)||this.voices[0]);
  const source=c.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;
  const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=Math.min(sp.lp,o.cut||20000);filter.Q.value=.6;
  const gain=c.createGain();gain.gain.value=0;
  const level=(o.gain??1)*sp.g*(a.volOf?a.volOf('weapons'):1);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level,t+.001);
  gain.gain.setValueAtTime(level,t+Math.max(.002,seconds-.04));gain.gain.linearRampToValueAtTime(0,t+seconds);
  source.connect(filter);filter.connect(gain);
  const nodes=[source,filter,gain];let last=gain;
  if(c.createStereoPanner&&sp.pan){const pan=c.createStereoPanner();pan.pan.value=U.clamp(sp.pan,-1,1);last.connect(pan);last=pan;nodes.push(pan)}
  last.connect(a.master);
  const wet=c.createGain();wet.gain.value=sp.rev*(o.wet??.3);last.connect(wet);wet.connect(a.verb);nodes.push(wet);
  const voice={source,gain,ctx:c,own:!!o.own,role:o.role||'handling',level,t};this.voices.push(voice);
  source.onended=()=>{for(const n of nodes)n.disconnect();const i=this.voices.indexOf(voice);if(i>=0)this.voices.splice(i,1);const j=this.own.indexOf(voice);if(j>=0)this.own.splice(j,1)};
  source.start(t,offset,duration);source.stop(t+seconds+.01);
  return voice;
 },
 kill(v){
  if(!v)return;const now=v.ctx.currentTime;
  v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(0,now,.01);try{v.source.stop(now+.06)}catch(e){}
  let i=this.voices.indexOf(v);if(i>=0)this.voices.splice(i,1);i=this.own.indexOf(v);if(i>=0)this.own.splice(i,1);
 },
 report(a,id,w,name,sp,options){
  if(w&&this.buffers[w.shot.path])return this.play(a,w.shot,name,sp,options);
  const D=G.WeaponSound,sr=a.ctx.sampleRate||44100,key=id+':'+name+':'+sr;
  let sound=this.generated[key];
  if(!sound){
   const own=name.startsWith('own'),take=own?Number(name.slice(3)):0;
   const pcm=D.generate(id,take,own?'own':name,sr),buffer=a.ctx.createBuffer(2,pcm.left.length,sr);
   buffer.copyToChannel(pcm.left,0);buffer.copyToChannel(pcm.right,1);
   sound=this.generated[key]={buffer,bank:{path:key,cues:{[name]:{offset:0,duration:pcm.duration}}}};
  }
  return this.play(a,sound.bank,name,sp,{...options,buffer:sound.buffer});
 },
 fire(a,id,pos,own,suppressed=false){
  const D=G.WeaponSound;if(!D?.profiles[id])return false;
  // An old cached manifest must not silently bring back the retired shots.
  let w=this.bank(id);if(this.manifest?.edition!==D.edition||w?.shot?.source!=='original-pressure-noise-v1')w=null;
  const cut=suppressed?3100:18000,sg=suppressed?.30:1;
  if(own){
   // 연사: 앞 발의 잔향은 줄이고(겹쳐 쌓이지 않게) 최대 4발까지만 남긴다
   const now=a.ctx.currentTime;
   for(const v of this.own){if(now-v.t<.02)continue;v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(v.level*.22,now,.025)}
   while(this.own.length>=4)this.kill(this.own[0]);
   const seq=this.sequence[id]||0;this.sequence[id]=seq+1;
   const C=w?.shot.cues,names=C?Object.keys(C).filter(n=>/^own\d+$/.test(n)):Array.from({length:D.variants},(_,i)=>'own'+i),name=names[seq%names.length];
   const mean=C?names.reduce((v,n)=>v+(C[n].loud||0),0)/names.length:0,even=mean&&C[name].loud?U.clamp(mean/C[name].loud,.85,1.18):1;
   const v=this.report(a,id,w,name,{g:1,pan:0,lp:20000,rev:.03},{gain:(w?.mix?.shot??.86)*even*sg,cut,rate:w?.rate||1,vary:.008,wet:.18,own:true,role:'shot'});
   if(v)this.own.push(v);
   // A small, real bolt/slide contact makes self-loaders tactile, especially
   // with a suppressor. Manual bolts and pumps keep their animation events.
   if(w?.mix?.action&&this.buffers[w.fx.path])this.play(a,w.fx,'close',{g:1,pan:.025,lp:8500,rev:0},
    {gain:suppressed?.12:.045,delay:w.mix.action,rate:1,vary:.015,wet:0,own:true,role:'action'});
   return true;
  }
  const sp=a.spatial(pos,30);if(sp.g<.015||!a._budget())return true;
  // 거리에 따라 가까운 녹음 → 먼 녹음으로 넘어간다. 소리는 음속으로 늦게 도착한다.
  const d=sp.d,far=U.clamp((d-45)/90,0,1),delay=Math.min(3,d/343);
  const o={rate:w?.rate||1,cut,delay,wet:.5,role:'shot'};
  if(far<1)this.report(a,id,w,'near',{...sp,lp:Math.max(sp.lp,1800)},{...o,gain:1.0*sg*(1-far)});
  if(far>0)this.report(a,id,w,'far',{...sp,g:sp.g,lp:Math.min(sp.lp,5400)},{...o,gain:.8*sg*far});
  return true;
 },
 handle(a,id,name,delay=0,k=1){
  const w=this.bank(id);if(!w)return false;
  const cue=w.fx.cues[name]?name:null;if(!cue)return false;
  const pan=/mag|shell|port/.test(name)?-.12:id==='s12'?-.06:.08;
  return !!this.play(a,w.fx,cue,{g:1,pan,lp:20000,rev:.018},{gain:(LEVEL[name]||.2)*(MASS[id]||1)*(w.mix?.handling??1)*k,rate:w.handleRate||1,delay,wet:.08,vary:.025,own:true});
 },
 // 다른 사람의 조작음 (위치 기반): 가까이 있는 적의 재장전을 들을 수 있다
 eventAt(a,type,id,pos){
  if(type==='coveropen')type='open';else if(type==='coverclose')type='close';
  const w=this.bank(id);if(!w||!this.buffers[w.fx.path])return false;
  const sp=a.spatial(pos,5);if(sp.g<.05||!a._budget())return false;
  const name=w.fx.cues[type]?type:type==='magin'&&w.fx.cues.shell?'shell':w.fx.cues.close?'close':null;if(!name)return false;
  return !!this.play(a,w.fx,name,sp,{gain:(LEVEL[name]||.15)*(MASS[id]||1)*(w.mix?.handling??1)*2.4,wet:.3,vary:.035});
 },
 event(a,type,id){
  if(type==='switch'){const b=this.manifest?.switch;return !!(b&&this.play(a,b,'switch',{g:1,pan:.08,lp:20000,rev:.03},{gain:LEVEL.switch,wet:.1,vary:.06,own:true}))}
  const w=this.bank(id);if(!w||!this.buffers[w.fx.path])return false;
  const c=w.fx.cues;
  switch(type){
   // 볼트액션: 손잡이 들기 → 뒤로 / 앞으로 → 내리기
   case 'coveropen':return this.handle(a,id,'open');
   case 'coverclose':return this.handle(a,id,'close');
   case 'open':if(c.up){this.handle(a,id,'up',0,.75);return this.handle(a,id,'open',.09)}return this.handle(a,id,'open');
   case 'close':if(c.down){this.handle(a,id,'close');return this.handle(a,id,'down',.09,.75)}return this.handle(a,id,'close');
   case 'bolt':case 'pump':this.event(a,'open',id);this.handle(a,id,'close',.26);return true;
   case 'port':return this.handle(a,id,c.port?'port':'shell');
   case 'shell':return this.handle(a,id,'shell')||this.handle(a,id,'magin',0,.7);
   case 'magout':case 'magin':case 'dry':return this.handle(a,id,type);
  }
  return false;
 }
};
if(location.protocol!=='file:')W.prepare();
})();
