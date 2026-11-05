// Recorded CC0 gun reports + physical foley. Sources and edits: assets/audio/weapons/CREDITS.md.
(function(){
'use strict';
const G=window.G,U=G.U;
// pack, mechanical speed, low-pass, magazine gain, body weight, shot gain
const P={
 ar7:['rifle',1.08,9800,.85,.75,.86],ka47:['rifle',.94,7600,1.02,1.05,.92],
 sc17:['rifle',1.02,10800,.92,.8,.9],mk14:['rifle',.88,6900,1.05,1.15,.96],
 kr98:['bolt',.79,7900,.9,1.2,1.0],s12:['pump',.87,6400,.9,1.05,.98],
 m1014:['semi',1.05,10500,.8,.85,.92],db2:['break',.72,5600,1.1,1.35,1.0],
 sa12:['rifle',.90,6800,1.07,1.1,.96],aa12:['drum',.76,6000,1.18,1.4,.95],
 p92:['pistol',1.14,11400,.7,.55,.78],g18:['pistol',1.25,13500,.62,.42,.72],
 m1911:['pistol',.98,8600,.83,.9,.85],de7:['pistol',.82,7000,1.04,1.3,.98],
 r45:['revolver',.91,9700,.78,.85,.9]
};
const base=new URL('assets/audio/weapons/',document.baseURI);
const W=G.WeaponAudio={
 profiles:P, manifest:null, buffers:{}, raw:{}, voices:[], sequence:{}, variation:.012,
 prepare(){
  if(this.preparing)return this.preparing;
  this.preparing=(async()=>{
   const res=await fetch(new URL('manifest.json?v='+window.LZ_BUILD,base));if(!res.ok)throw Error('audio manifest '+res.status);
   const m=await res.json();if(m.schema!==1)throw Error('audio schema');this.manifest=m;
   const entries=[...Object.values(m.shots),m.foley];
   await Promise.all(entries.map(async e=>{const r=await fetch(new URL(e.path+'?v='+e.sha256.slice(0,12),base));if(!r.ok)throw Error(e.path+' '+r.status);this.raw[e.path]=await r.arrayBuffer()}));
   return true;
  })().catch(e=>{console.info('[audio] recorded bank unavailable; using synthesis',e.message);return false});
  return this.preparing;
 },
 load(ctx){
  if(this.loading)return this.loading;
  this.loading=(async()=>{
   if(!await this.prepare())return false;
   await Promise.all(Object.entries(this.raw).map(async([name,data])=>{this.buffers[name]=await ctx.decodeAudioData(data.slice(0))}));
   return true;
  })().catch(e=>{console.info('[audio] decode fallback',e.message);return false});
  return this.loading;
 },
 play(a,bank,cue,sp,options={}){
  const buffer=this.buffers[bank.path];if(!buffer||!cue)return false;
  const c=a.ctx,t=c.currentTime+(options.delay||0),rate=(options.rate||1)*(1+(Math.random()-.5)*this.variation);
  const trim=Math.max(0,Math.min(cue.attackTrim||0,cue.duration-.005));
  const offset=cue.offset+trim,duration=Math.min(cue.duration-trim,buffer.duration-offset),seconds=duration/rate;
  if(!(duration>0))return false;
  // Bounded sample voices; remove every node when its source ends.
  if(this.voices.length>=64){
   const old=this.voices.find(v=>!v.own)||this.voices[0],now=old.ctx.currentTime;
   old.gain.gain.setTargetAtTime(0,now,.005);try{old.source.stop(now+.025)}catch(e){}
   const index=this.voices.indexOf(old);if(index>=0)this.voices.splice(index,1);
  }
  const source=c.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;
  const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=Math.min(sp.lp,options.cut||18000);filter.Q.value=.65;
  const gain=c.createGain(),level=(options.gain||1)*sp.g;
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level,t+.001);
  gain.gain.setValueAtTime(level,t+Math.max(.002,seconds-.025));gain.gain.linearRampToValueAtTime(0,t+seconds);
  source.connect(filter);filter.connect(gain);
  const nodes=[source,filter,gain];let last=gain;
  if(c.createStereoPanner){const pan=c.createStereoPanner();pan.pan.value=U.clamp(sp.pan,-1,1);last.connect(pan);last=pan;nodes.push(pan)}
  last.connect(a.master);
  const wet=c.createGain();wet.gain.value=sp.rev*(options.wet??.25);last.connect(wet);wet.connect(a.verb);nodes.push(wet);
  const voice={source,gain,ctx:c,own:!!options.own};this.voices.push(voice);
  source.onended=()=>{for(const n of nodes)n.disconnect();const i=this.voices.indexOf(voice);if(i>=0)this.voices.splice(i,1)};
  source.start(t,offset,duration);source.stop(t+seconds+.01);
  return true;
 },
 fire(a,id,pos,own,suppressed=false){
  const p=P[id],bank=this.manifest?.shots[id];if(!p||!bank||!this.buffers[bank.path])return false;
  const sp=a.spatial(own?null:pos,28);if(sp.g<.02||(!own&&!a._budget()))return true;
  const key=id+(own?':own':':world'),seq=this.sequence[key]||0;this.sequence[key]=seq+1;
  this.play(a,bank,bank.cues[seq%bank.cues.length],sp,{gain:p[5]*(own?1.9:1.3)*(suppressed?.45:1),cut:suppressed?4500:19000,wet:own?.16:.45,own});
  return true;
 },
 foley(a,id,cue,delay=0,volume=1,rate=1){
  const p=P[id],bank=this.manifest?.foley;if(!p||!bank)return false;
  return this.play(a,bank,bank.cues[cue],{g:1,pan:-.06,lp:20000,rev:.025},{gain:volume*.18,rate:p[1]*rate,cut:p[2],delay,wet:.12,own:true});
 },
 event(a,type,id){
  const p=P[id],bank=this.manifest?.foley;if(!p||!bank||!this.buffers[bank.path])return false;
  const [pack,rate,cut,mag,mass]=p;let used=true;
  switch(type){
   case 'magout':this.foley(a,id,pack==='pistol'?'pistol-out':'rifle-out',0,.66*mag);this.foley(a,id,'cloth',.035,.10*mass,.88);break;
   case 'magin':
    this.foley(a,id,pack==='pistol'?'pistol-in':'rifle-in',0,.92*mag);
    this.foley(a,id,'dry',.026,.22*mass,.88);
    if(pack==='drum')this.foley(a,id,'rifle-close',.052,.18,.73);
    break;
   case 'open':
    this.foley(a,id,'open',0,.57*mass,pack==='pistol'?1.15:1);
    if(pack==='bolt'||pack==='break'||pack==='revolver')this.foley(a,id,'dry',.025,.20*mass,.82);
    break;
   case 'close':
    this.foley(a,id,pack==='pistol'?'pistol-close':pack==='pump'?'close':'rifle-close',0,.65*mass);
    if(pack==='revolver')this.foley(a,id,'dry',.028,.23,1.13);
    break;
   case 'shell':
    this.foley(a,id,'shell',0,.48*mag);
    this.foley(a,id,'dry',.065,.17*mass,1.18);
    if(pack==='break'||pack==='revolver')this.foley(a,id,'shell',.047,.24,.91);
    break;
   case 'dry':this.foley(a,id,'dry',0,.34*mass,1.05);break;
   case 'bolt':this.foley(a,id,'open',0,.6*mass);this.foley(a,id,'rifle-close',.28,.65*mass);break;
   case 'pump':this.foley(a,id,'open',0,.65*mass);this.foley(a,id,'close',.29,.7*mass);break;
   default:used=false;
  }return used;
 }
};
if(location.protocol!=='file:')W.prepare();
})();
