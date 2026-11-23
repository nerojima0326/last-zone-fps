// Directional, articulated hit reactions and supported death poses. Visual only:
// health, actor position, hit volumes, and bot aim are unchanged.
(function () {
'use strict';
const G=window.G,T=window.THREE,U=G.U,up=new T.Vector3(0,1,0),v=new T.Vector3(),p=new T.Vector3(),q=new T.Quaternion();
const probeDirections=[];
for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1])if(x||y||z)probeDirections.push([x,y,z]);
const H=G.HitResponse={
  enabled:true,stats:{fits:0,vertices:0},
  prepare(root){root.traverse(mesh=>{if(mesh.isMesh&&mesh.geometry?.attributes.position)this.probes(mesh.geometry)})},
  probes(geo){
    if(geo.userData.supportProbes)return geo.userData.supportProbes;
    const pos=geo.attributes.position,indices=new Set(),groups=new Map(),si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight;
    const stride=Math.max(1,Math.floor(pos.count/160));for(let i=0;i<pos.count;i+=stride)indices.add(i);
    for(let i=0;i<pos.count;i++){
      let bone=0;
      if(si&&sw){let weight=-1;for(let k=0;k<4;k++)if(sw.array[i*4+k]>weight){weight=sw.array[i*4+k];bone=si.array[i*4+k]}}
      let extremes=groups.get(bone);if(!extremes){extremes=Array(probeDirections.length).fill(null);groups.set(bone,extremes)}
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      for(let key=0;key<probeDirections.length;key++){
        const direction=probeDirections[key],value=x*direction[0]+y*direction[1]+z*direction[2];
        if(!extremes[key]||value>extremes[key].value)extremes[key]={value,index:i};
      }
    }
    for(const extremes of groups.values())for(const e of extremes)if(e)indices.add(e.index);
    return geo.userData.supportProbes=Array.from(indices);
  },
  state(m){return m.hitResponse||(m.hitResponse={events:[],applied:[],direction:new T.Vector3(),region:'torso',death:null})},
  receive(actor,point,direction,damage,head){
    if(!this.enabled||!actor.model)return false;
    const m=actor.model,s=this.state(m),yaw=actor.yaw||0,c=Math.cos(yaw),sn=Math.sin(yaw);
    v.copy(direction||actor.pos.clone().sub(actor.lastAttacker?.pos||actor.pos));
    if(v.lengthSq()<1e-6)v.set(-sn,0,-c);v.normalize();s.direction.copy(v);
    const x=point?c*(point.x-actor.pos.x)-sn*(point.z-actor.pos.z):0;
    const height=point?point.y-actor.pos.y:1.2;
    const along=point?-sn*(point.x-actor.pos.x)-c*(point.z-actor.pos.z):.3;
    const low=actor.prone||actor.knocked,relativeHeight=height/(actor.crouch?1.15:1.62);
    const leg=low?along<-.1:relativeHeight<.40,shoulder=low?along>.2:relativeHeight>.69;
    const region=head?'head':leg?'leg':Math.abs(x)>.13&&shoulder?'shoulder':'torso';s.region=region;
    const side=x<0?-1:1,strength=U.clamp(damage/45,.18,1.25);
    if(s.events.length===3)s.events.shift();
    s.events.push({time:0,strength,region,side,x:c*v.x-sn*v.z,z:sn*v.x+c*v.z});
    return true;
  },
  restore(m){
    const s=m.hitResponse;if(!s)return;
    for(const [object,key,value]of s.applied)object[key]-=value;s.applied.length=0;
  },
  add(s,object,key,value){if(!value)return;object[key]+=value;s.applied.push([object,key,value])},
  apply(m,a,dt){
    const s=m.hitResponse;if(!s||!this.enabled)return;
    if(!a.dead)s.death=null;
    let side=0,back=0,twist=0,head=0,left=0,right=0,legL=0,legR=0;
    for(let i=s.events.length-1;i>=0;i--){
      const e=s.events[i];e.time+=dt;
      if(e.time>.62){s.events.splice(i,1);continue}
      const t=e.time/.075,k=t*Math.exp(1-t)*e.strength*(a.dead?.25:1);
      side+=e.x*k*.13;back+=e.z*k*.15;twist+=e.side*k*(e.region==='shoulder'?.11:.035);
      if(e.region==='head')head+=k*.22;
      if(e.region==='shoulder'){if(e.side<0)left+=k*.21;else right+=k*.21}
      if(e.region==='leg'){if(e.side<0)legL+=k*.13;else legR+=k*.13}
    }
    const clamp=x=>U.clamp(x,-.28,.28);
    this.add(s,m.spine.rotation,'x',clamp(back*.55));this.add(s,m.spine.rotation,'z',clamp(-side));
    this.add(s,m.chest.rotation,'y',clamp(twist));this.add(s,m.chest.rotation,'x',clamp(back*.45));
    this.add(s,m.head.rotation,'x',clamp(head+back*.18));this.add(s,m.head.rotation,'z',clamp(-side*.3));
    this.add(s,m.armL.rotation,'x',clamp(left));this.add(s,m.armR.rotation,'x',clamp(right));
    this.add(s,m.legL.rotation,'x',clamp(legL));this.add(s,m.legR.rotation,'x',clamp(legR));
    if(a.dead&&s.death){
      const curl=s.death.localNormal.x*s.death.progress;
      this.add(s,m.spine.rotation,'z',curl*.14);this.add(s,m.head.rotation,'z',curl*.18);
    }
  },
  fall(m,a,progress){
    if(!this.enabled)return null;
    const s=this.state(m),W=G.World;
    if(!s.death){
      const yaw=m.root.rotation.y,base=a.groundY??m.root.position.y;
      v.copy(s.direction);v.y=0;
      if(v.lengthSq()<.01)v.set(Math.sin(yaw)*m.fallDir,0,Math.cos(yaw)*m.fallDir);v.normalize();
      const desired=v.clone();let clearance=1.75,chosen=desired.clone(),best=-1;
      const near=(a.distance2??0)<45*45&&W?.grid;
      if(near){
        p.copy(m.root.position);p.y=base+.45;
        for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI]){
          v.copy(desired).applyAxisAngle(up,angle);
          const t=G.SceneSense.ray(p,v,1.75),free=Math.min(1.75,t);
          if(free>best){best=free;chosen.copy(v);clearance=free}if(free>=1.7)break;
        }
      }
      const fold=U.clamp((1.5-clearance)/1.1,0,.85),length=1.45-fold*.6;
      let slope=0,lift=.15,slopeX=0,slopeZ=0,ground0=base;
      if(near){
        const ground=t=>W.ground(m.root.position.x+chosen.x*t,m.root.position.z+chosen.z*t,base+.35,.08,.55);
        const g0=ground(0),g1=ground(length/2),g2=ground(length);
        ground0=g0;
        slope=U.clamp((g2-g0)/length,-.35,.35);
        const left=W.ground(m.root.position.x-chosen.z*.4,m.root.position.z+chosen.x*.4,base+.35,.08,.55);
        const right=W.ground(m.root.position.x+chosen.z*.4,m.root.position.z-chosen.x*.4,base+.35,.08,.55);
        const cross=U.clamp((left-right)/.8,-.35,.35);
        slopeX=chosen.x*slope-chosen.z*cross;slopeZ=chosen.z*slope+chosen.x*cross;
        lift+=Math.max(0,g0-base,g1-base-slope*length/2,g2-base-slope*length);
      }
      const start=new T.Quaternion().setFromAxisAngle(up,yaw);
      v.copy(chosen);v.y=slope;v.normalize();
      const end=new T.Quaternion().setFromUnitVectors(up,v).multiply(start);
      s.death={start,end,offset:lift,fold,direction:chosen,clearance,near,base,ground0,slopeX,slopeZ,supportLift:0,fitTime:0,age:0,
        localNormal:up.clone().applyQuaternion(q.copy(end).invert()),contacts:Array.from({length:8},()=>({height:Infinity,point:new T.Vector3()}))};
    }
    const plan=s.death;
    plan.progress=progress;
    m.root.quaternion.slerpQuaternions(plan.start,plan.end,progress);
    return {offset:plan.offset*progress+plan.supportLift,fold:plan.fold*progress,front:plan.localNormal.z,progress};
  },
  support(m,a,dt){
    const plan=m.hitResponse?.death;if(!this.enabled||!a.dead||!plan?.near||plan.done)return;
    plan.age+=dt;plan.fitTime-=dt;if(plan.fitTime>0)return;plan.fitTime=.08;
    const W=G.World,contacts=plan.contacts;for(const c of contacts)c.height=Infinity;
    m.root.updateMatrixWorld(true);this.stats.fits++;
    const visit=mesh=>{
      if(!mesh.isMesh||!mesh.visible||!mesh.geometry?.attributes.position)return;
      for(const index of this.probes(mesh.geometry)){
        mesh.getVertexPosition(index,v);v.applyMatrix4(mesh.matrixWorld);this.stats.vertices++;
        const dx=v.x-m.root.position.x,dz=v.z-m.root.position.z;
        const plane=plan.ground0+plan.slopeX*dx+plan.slopeZ*dz,height=v.y-plane;
        const along=dx*plan.direction.x+dz*plan.direction.z,side=-dx*plan.direction.z+dz*plan.direction.x;
        const bucket=Math.floor(U.clamp((along+.15)/1.9,0,.999)*4)*2+(side>0?1:0),contact=contacts[bucket];
        if(height<contact.height){contact.height=height;contact.point.copy(v)}
      }
    };
    if(m.soldier)m.soldier.root.traverse(visit);else{visit(m.body);visit(m.helmetMesh)}
    let minimum=Infinity;
    for(const c of contacts)if(Number.isFinite(c.height))minimum=Math.min(minimum,c.point.y-W.ground(c.point.x,c.point.z,plan.base+.55,.025,.25));
    if(!Number.isFinite(minimum))return;
    const correction=.022-minimum,currentOffset=m.root.position.y-plan.base;
    plan.supportLift=Math.max(0,currentOffset+correction-plan.offset*plan.progress);
    if(correction>0){m.root.position.y+=correction;if(m.motion)m.motion.offset+=correction;m.root.updateMatrixWorld(true)}
    if(plan.age>2.5&&Math.abs(correction)<.003)plan.done=true;
  }
};
})();
