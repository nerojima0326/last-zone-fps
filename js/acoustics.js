// Shared, bounded room probes. Uses collision boxes, so doors/windows/floors
// agree with gameplay; smoke never acts as an acoustic wall.
(function () {
'use strict';
const G=window.G,T=window.THREE,U=G.U,dir=new T.Vector3(),source=new T.Vector3();
const hit={normal:new T.Vector3()},open={kind:'outdoor',covered:false,openness:1,enclosure:0,roof:Infinity,width:20,length:20};
const clock=()=>performance.now()/1000;
const S=G.SceneSense={
  cache:new Map(),stats:{rays:0,hits:0},
  ray(p,d,length,out){
    const W=G.World;if(!W?.grid)return Infinity;
    this.stats.rays++;return W.rayBoxes(p.x,p.y,p.z,d.x,d.y,d.z,length,out);
  },
  sample(p,force=false){
    if(!G.World?.grid)return open;
    const key=[Math.floor(p.x),Math.floor(p.y*2),Math.floor(p.z)].join(','),now=clock(),old=this.cache.get(key);
    if(!force&&old&&now-old.time<.6){this.stats.hits++;return old.value}
    const roof=this.ray(p,dir.set(0,1,0),12),dist=[];
    for(const [x,z]of [[1,0],[-1,0],[0,1],[0,-1]])dist.push(Math.min(10,this.ray(p,dir.set(x,0,z),10)));
    const covered=Number.isFinite(roof),width=Math.min(dist[0]+dist[1],dist[2]+dist[3]),length=Math.max(dist[0]+dist[1],dist[2]+dist[3]);
    const openness=dist.filter(d=>d>=9.99).length/4;
    const enclosure=covered?U.clamp((1-openness)*(.55+.45*(1-Math.min(roof,8)/8)),0,1):0;
    const kind=!covered?'outdoor':openness>=.75?'shelter':length>width*2.3&&width<5?'corridor':width>7?'large':'room';
    const value={kind,covered,openness,enclosure,roof,width,length};
    if(this.cache.size>=96)this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key,{time:now,value});return value;
  },
  reset(){this.cache.clear();this.stats.rays=this.stats.hits=0}
};
const A=G.Acoustics={
  enabled:true,listener:open,listenerPos:new T.Vector3(1e9,1e9,1e9),next:0,links:new Map(),buses:null,
  stats:{probes:0,cached:0,deferred:0},window:-1,used:0,
  update(p){
    if(!this.enabled||!p)return;
    const now=clock();
    if(now<this.next&&this.listenerPos.distanceToSquared(p)<.64)return;
    this.next=now+.16;this.listenerPos.copy(p);this.listener=S.sample(p);
  },
  init(a){
    if(a.acousticBuses?.ctx===a.ctx||!a.ctx)return;
    const nodes={};a.acousticBuses={ctx:a.ctx,nodes};
    for(const [kind,seconds,decay,delay]of [['room',.48,4,.008],['corridor',1.15,2.8,.022],['large',1.7,2.5,.014]]){
      const c=a.ctx,buf=c.createBuffer(2,Math.ceil(c.sampleRate*seconds),c.sampleRate),rnd=U.mulberry32(90210+Math.round(seconds*100));
      for(let ch=0;ch<2;ch++){
        const data=buf.getChannelData(ch),start=Math.floor((delay+ch*.0017)*c.sampleRate);
        for(let i=start;i<data.length;i++)data[i]=(rnd()*2-1)*Math.pow(1-i/data.length,decay)*Math.min(1,(i-start)/80);
      }
      const bus=c.createConvolver();bus.buffer=buf;bus.connect(a.verbOut);nodes[kind]=bus;
    }
  },
  bus(a,sp){return this.enabled&&a.acousticBuses?.ctx===a.ctx?(a.acousticBuses.nodes[sp.room||this.listener.kind]||a.verb):a.verb},
  filter(sp,pos,listener){
    if(!this.enabled||!G.World?.grid)return sp;
    const L=listener||G.Audio.listener;source.set(L.x,L.y,L.z);this.update(source);
    const room=this.listener;
    sp.room=room.kind;sp.enclosure=room.enclosure;sp.blocked=false;
    sp.rev=U.clamp(sp.rev*(room.covered?.8:.35)+room.enclosure*.34,.015,.6);
    if(!pos||sp.d<.3)return sp;
    const now=clock(),tick=Math.floor(now*60);
    if(tick!==this.window){this.window=tick;this.used=0}
    const key=[Math.round(pos.x*2),Math.round(pos.y*2),Math.round(pos.z*2),Math.round(L.x*2),Math.round(L.y*2),Math.round(L.z*2)].join(',');
    let link=this.links.get(key);
    if(link&&now-link.time<.18)this.stats.cached++;
    else if(this.used<12){
      this.used++;this.stats.probes++;
      dir.subVectors(pos,source);const distance=dir.length();dir.divideScalar(distance);
      source.addScaledVector(dir,.035);
      const distanceToWall=S.ray(source,dir,Math.max(0,distance-.10),hit);
      let gain=1,cut=20000,blocked=Number.isFinite(distanceToWall);
      if(blocked){
        const box=hit.box,glass=hit.mat==='glass',wood=hit.mat==='wood';
        // The slab's thickness matters, including ceilings between floors.
        let exit=Infinity;
        for(const axis of ['x','y','z'])if(Math.abs(dir[axis])>1e-6){
          const k=axis.toUpperCase(),edge=dir[axis]>0?box['max'+k]:box['min'+k];
          exit=Math.min(exit,(edge-source[axis])/dir[axis]);
        }
        const thickness=U.clamp(exit-distanceToWall,.03,2);
        gain=(glass?.70:wood?.48:.33)*Math.exp(-thickness*.22);
        cut=glass?5200:wood?1550:1050;
        source.addScaledVector(dir,Math.min(distance-.06,exit+.025));
        const remaining=distance-Math.min(distance-.06,exit+.025);
        if(remaining>.08&&S.ray(source,dir,remaining-.06)<Infinity){gain*=.55;cut*=.72}
      }
      link={time:now,gain,cut,blocked};
      if(this.links.size>=96)this.links.delete(this.links.keys().next().value);
      this.links.set(key,link);
    }else{this.stats.deferred++;link={gain:.65,cut:6500,blocked:false}}
    sp.g*=link.gain;sp.lp=Math.min(sp.lp,link.cut);sp.blocked=link.blocked;
    return sp;
  },
  reset(){this.links.clear();this.next=0;this.listener=open;this.listenerPos.set(1e9,1e9,1e9);S.reset()}
};
})();
