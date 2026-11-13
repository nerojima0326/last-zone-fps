// 실총 녹음(CC0, The Free Firearm Sound Library) 사격음·조작음. 출처·편집: assets/audio/weapons/CREDITS.md
//  <id>-shot.mp3 : 내 총 (사수 뒤 스테레오 녹음 2테이크, 번갈아 재생)
//  <id>-fx.mp3   : 남의 총 near/far + 장전 조작음 (magout·magin·open·close·shell·port·dry·up·down)
(function(){
'use strict';
const G=window.G,U=G.U;
// 조작음 크기 (사격음 대비) · 같은 종류 안의 무게감
const LEVEL={magout:.15,magin:.19,open:.18,close:.2,shell:.14,port:.16,dry:.13,up:.13,down:.15,switch:.12};
const MASS={ar7:1,ka47:1.08,sc17:1,mk14:1.1,kr98:1.05,s12:1.05,m1014:1,db2:1.05,sa12:1.08,aa12:1.12,p92:.9,g18:.86,m1911:.95,de7:1,r45:.95};
const base=new URL('assets/audio/weapons/',document.baseURI);
const W=G.WeaponAudio={
 manifest:null, buffers:{}, raw:{}, voices:[], own:[], sequence:{},
 prepare(){
  if(this.preparing)return this.preparing;
  this.preparing=(async()=>{
   const res=await fetch(new URL('manifest.json?v='+window.LZ_BUILD,base));if(!res.ok)throw Error('audio manifest '+res.status);
   const m=await res.json();if(m.schema!==2)throw Error('audio schema');this.manifest=m;
   const banks=[m.switch];for(const w of Object.values(m.weapons))banks.push(w.shot,w.fx);
   await Promise.all(banks.map(async b=>{const r=await fetch(new URL(b.path+'?v='+b.sha,base));if(!r.ok)throw Error(b.path+' '+r.status);this.raw[b.path]=await r.arrayBuffer()}));
   return true;
  })().catch(e=>{console.info('[audio] recorded bank unavailable; using synthesis',e.message);return false});
  return this.preparing;
 },
 load(ctx){
  if(this.loading)return this.loading;
  this.loading=(async()=>{
   if(!await this.prepare())return false;
   const m=this.manifest,banks=[m.switch];for(const w of Object.values(m.weapons))banks.push(w.shot,w.fx);
   await Promise.all(banks.map(async b=>{const buf=await ctx.decodeAudioData(this.raw[b.path].slice(0));this.buffers[b.path]=buf;this.align(buf,b.cues)}));
   this.raw={};
   return true;
  })().catch(e=>{console.info('[audio] decode fallback',e.message);return false});
  return this.loading;
 },
 // MP3 디코더마다 앞쪽 지연이 달라서, 디코딩한 파형에서 각 소리의 실제 시작점을 다시 찾는다
 align(buf,cues){
  const d=buf.getChannelData(0),sr=buf.sampleRate;
  for(const c of Object.values(cues)){
   const a=Math.max(0,Math.floor((c.offset-.08)*sr)),b=Math.min(d.length,Math.floor((c.offset+c.duration)*sr));
   let peak=0;for(let i=a;i<b;i++){const v=Math.abs(d[i]);if(v>peak)peak=v}
   let i=a;while(i<b&&Math.abs(d[i])<peak*.2)i++;
   c.start=Math.max(0,i/sr-.006);
   let e=0;const n=Math.min(b,i+Math.floor(.25*sr));for(let j=i;j<n;j++)e+=d[j]*d[j];c.loud=Math.sqrt(e/Math.max(1,n-i));
  }
 },
 bank(id){return this.manifest?.weapons[id]},
 play(a,bank,name,sp,o={}){
  const buffer=this.buffers[bank?.path],cue=bank?.cues[name];if(!buffer||!cue)return null;
  const c=a.ctx,t=c.currentTime+(o.delay||0),rate=(o.rate||1)*(1+(Math.random()-.5)*(o.vary??.03));
  const offset=cue.start??cue.offset,duration=Math.min(cue.duration,buffer.duration-offset),seconds=duration/rate;
  if(!(duration>0))return null;
  if(this.voices.length>=48)this.kill(this.voices.find(v=>!v.own)||this.voices[0]);
  const source=c.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;
  const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=Math.min(sp.lp,o.cut||20000);filter.Q.value=.6;
  const gain=c.createGain(),level=(o.gain||1)*sp.g*(a.volOf?a.volOf('weapons'):1);
  gain.gain.setValueAtTime(level,t);
  gain.gain.setValueAtTime(level,t+Math.max(.002,seconds-.04));gain.gain.linearRampToValueAtTime(0,t+seconds);
  source.connect(filter);filter.connect(gain);
  const nodes=[source,filter,gain];let last=gain;
  if(c.createStereoPanner&&sp.pan){const pan=c.createStereoPanner();pan.pan.value=U.clamp(sp.pan,-1,1);last.connect(pan);last=pan;nodes.push(pan)}
  last.connect(a.master);
  const wet=c.createGain();wet.gain.value=sp.rev*(o.wet??.3);last.connect(wet);wet.connect(a.verb);nodes.push(wet);
  const voice={source,gain,ctx:c,own:!!o.own,level,t};this.voices.push(voice);
  source.onended=()=>{for(const n of nodes)n.disconnect();const i=this.voices.indexOf(voice);if(i>=0)this.voices.splice(i,1);const j=this.own.indexOf(voice);if(j>=0)this.own.splice(j,1)};
  source.start(t,offset,duration);source.stop(t+seconds+.01);
  return voice;
 },
 kill(v){
  if(!v)return;const now=v.ctx.currentTime;
  v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(0,now,.01);try{v.source.stop(now+.06)}catch(e){}
  let i=this.voices.indexOf(v);if(i>=0)this.voices.splice(i,1);i=this.own.indexOf(v);if(i>=0)this.own.splice(i,1);
 },
 fire(a,id,pos,own,suppressed=false){
  const w=this.bank(id);if(!w||!this.buffers[w.shot.path]||!this.buffers[w.fx.path])return false;
  const cut=suppressed?3200:20000,sg=suppressed?.4:1;
  if(own){
   // 연사: 앞 발의 잔향은 줄이고(겹쳐 쌓이지 않게) 최대 4발까지만 남긴다
   const now=a.ctx.currentTime;
   for(const v of this.own){if(now-v.t<.02)continue;v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(v.level*.35,now,.03)}
   while(this.own.length>=4)this.kill(this.own[0]);
   const seq=this.sequence[id]||0;this.sequence[id]=seq+1;
   // 두 테이크의 크기를 맞춘다
   const C=w.shot.cues,name=seq%2?'own1':'own0',even=C.own0.loud&&C.own1.loud?U.clamp((C.own0.loud+C.own1.loud)/2/C[name].loud,.7,1.3):1;
   const v=this.play(a,w.shot,name,{g:1,pan:0,lp:20000,rev:.12},{gain:.9*even*sg,cut,rate:w.rate,vary:.02,wet:.35,own:true});
   if(v)this.own.push(v);
   return true;
  }
  const sp=a.spatial(pos,30);if(sp.g<.015||!a._budget())return true;
  // 거리에 따라 가까운 녹음 → 먼 녹음으로 넘어간다. 소리는 음속으로 늦게 도착한다.
  const d=sp.d,far=U.clamp((d-45)/90,0,1),delay=Math.min(1.2,d/343);
  const o={rate:w.rate,cut,delay,wet:.5};
  if(far<1)this.play(a,w.fx,'near',{...sp,lp:Math.max(sp.lp,1800)},{...o,gain:1.15*sg*(1-far)});
  if(far>0)this.play(a,w.fx,'far',{...sp,g:Math.min(1,sp.g*2.2),lp:20000},{...o,gain:1.0*sg*far});
  return true;
 },
 handle(a,id,name,delay=0,k=1){
  const w=this.bank(id);if(!w)return false;
  const cue=w.fx.cues[name]?name:null;if(!cue)return false;
  return !!this.play(a,w.fx,cue,{g:1,pan:.08,lp:20000,rev:.04},{gain:(LEVEL[name]||.35)*(MASS[id]||1)*k,delay,wet:.15,vary:.05,own:true});
 },
 // 다른 사람의 조작음 (위치 기반): 가까이 있는 적의 재장전을 들을 수 있다
 eventAt(a,type,id,pos){
  const w=this.bank(id);if(!w||!this.buffers[w.fx.path])return false;
  const sp=a.spatial(pos,5);if(sp.g<.05||!a._budget())return false;
  const name=w.fx.cues[type]?type:type==='magin'&&w.fx.cues.shell?'shell':w.fx.cues.close?'close':null;if(!name)return false;
  return !!this.play(a,w.fx,name,sp,{gain:(LEVEL[name]||.15)*2.4,wet:.3,vary:.06});
 },
 event(a,type,id){
  if(type==='switch'){const b=this.manifest?.switch;return !!(b&&this.play(a,b,'switch',{g:1,pan:.08,lp:20000,rev:.03},{gain:LEVEL.switch,wet:.1,vary:.06,own:true}))}
  const w=this.bank(id);if(!w||!this.buffers[w.fx.path])return false;
  const c=w.fx.cues;
  switch(type){
   // 볼트액션: 손잡이 들기 → 뒤로 / 앞으로 → 내리기
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
