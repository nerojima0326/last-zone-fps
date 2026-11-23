// Licensed CC0 contact samples; bounded voices and a synthetic missing-file path.
(function () {
'use strict';
const G=window.G, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const F=G.Footsteps={
  groups:['grass','concrete','snow','wood','metal'],buffers:{},raw:{},voices:[],counters:{},
  async prefetch(){
    if(location.protocol==='file:')return;
    if(this.prefetching)return this.prefetching;
    return this.prefetching=Promise.all(this.groups.flatMap(group=>Array.from({length:5},(_,i)=>{
      const file=(group==='metal'?'impact_metal_light':'footstep_'+group)+'_00'+i+'.ogg';
      return fetch('assets/audio/footsteps/'+file+'?v='+(window.LZ_BUILD||'')).then(r=>r.ok?r.arrayBuffer():null).then(b=>{if(b)this.raw[group+i]=b}).catch(()=>{});
    })));
  },
  async load(ctx){
    if(this.loading)return this.loading;
    return this.loading=(async()=>{
      await this.prefetch();
      await Promise.all(Object.entries(this.raw).map(async([key,bytes])=>{
        try{
          const b=await ctx.decodeAudioData(bytes.slice(0));let peak=0;
          for(let c=0;c<b.numberOfChannels;c++)for(const x of b.getChannelData(c))peak=Math.max(peak,Math.abs(x));
          const gain=peak>.001?Math.min(8,.72/peak):1;
          for(let c=0;c<b.numberOfChannels;c++){const data=b.getChannelData(c);for(let i=0;i<data.length;i++)data[i]*=gain}
          this.buffers[key]=b;
        }catch(e){/* use the existing synthetic footstep */}
      }));
      this.raw={};this.ready=Object.keys(this.buffers).length>0;
    })();
  },
  stop(){for(const v of this.voices.splice(0)){try{v.source.stop()}catch(e){}}},
  surface(actor){
    if(actor.inWater)return 'water';
    const kind=actor.groundMat;
    if(kind==='terrain')return G.World.surfaceAt(actor.pos.x,actor.pos.z);
    return ({hard:'concrete',soft:'sand',stone:'gravel'})[kind]||kind||'grass';
  },
  play(a,pos,surface,volume,side=0){
    if(surface==='water'||!this.ready)return false;
    const profile={grass:['grass',11000,1],dirt:['snow',4400,.94],sand:['snow',2800,.85],gravel:['concrete',6500,.84],asphalt:['concrete',9000,.95],concrete:['concrete',15000,1],wood:['wood',12000,1],metal:['concrete',13000,1]}[surface]||['grass',10000,1];
    const n=this.counters[surface]||0;this.counters[surface]=n+1;
    const index=(n*2+side)%5,buffer=this.buffers[profile[0]+index];if(!buffer)return false;
    const sp=a.spatial(pos,4),ambient=a.vol?.ambient??1;
    if(sp.g<.09||sp.d>40||ambient===0)return true;
    const c=a.ctx,now=c.currentTime;
    this.voices=this.voices.filter(v=>!v.ended);
    const play=(buf,level,cut,rate,maxDuration)=>{
      if(this.voices.length>=20){const index=this.voices.findIndex(v=>!v.own),v=this.voices.splice(index<0?0:index,1)[0];v.gain.gain.setTargetAtTime(0,now,.008);try{v.source.stop(now+.04)}catch(e){}}
      const source=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter();source.buffer=buf;
      source.playbackRate.value=rate*(.985+Math.random()*.03);filter.type='lowpass';filter.frequency.value=Math.min(cut,sp.lp);
      const seconds=Math.min(maxDuration,buf.duration/source.playbackRate.value);
      gain.gain.setValueAtTime(clamp(volume??.32,0,1)*sp.g*ambient*level,now);
      gain.gain.setTargetAtTime(0,now+Math.max(.025,seconds-.035),.012);
      source.connect(filter);filter.connect(gain);let last=gain;const nodes=[source,filter,gain];
      if(c.createStereoPanner){const pan=c.createStereoPanner();pan.pan.value=clamp(sp.pan+(pos?0:side? .035:-.035),-1,1);gain.connect(pan);last=pan;nodes.push(pan)}
      last.connect(a.master);const voice={source,gain,own:!pos,ended:false};this.voices.push(voice);
      source.onended=()=>{voice.ended=true;for(const node of nodes)node.disconnect();const i=this.voices.indexOf(voice);if(i>=0)this.voices.splice(i,1)};
      source.start(now);source.stop(now+seconds+.025);
    };
    play(buffer,.9,profile[1],profile[2],.4);
    if(surface==='metal'&&this.buffers['metal'+index])play(this.buffers['metal'+index],.2,6000,1,.22);
    return true;
  }
};
})();
