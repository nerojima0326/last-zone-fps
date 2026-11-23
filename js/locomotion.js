// Distance-driven contacts, eased poses and nearby planted feet. Physics stays
// authoritative; stationary actors pushing a wall don't advance their gait.
(function(){
'use strict';
const G=window.G,T=window.THREE,U=G.U,TAU=Math.PI*2;
const down=new T.Vector3(0,-1,0),direction=new T.Vector3(),bend=new T.Vector3(),knee=new T.Vector3(),shin=new T.Vector3(),hip=new T.Vector3();
const thighQ=new T.Quaternion(),shinQ=new T.Quaternion(),inverseQ=new T.Quaternion(),aim=new T.Vector3();
const L=G.Locomotion={
  stride(a,sprint,speed=a.gait?.speed||a.hspeed||4){
    return a.prone||a.knocked ? .55 : a.crouch ? .75 : sprint ? U.clamp(.95+speed*.12,1.2,1.9) : U.clamp(.6+speed*.16,.65,1.35);
  },
  tick(a,dt,sprint=false){
    let s=a.gait;
    if(!s)s=a.gait={last:a.pos.clone(),distance:0,phase:0,side:0,speed:0,forward:0,right:0,direction:new T.Vector3(),contacts:0};
    const dx=a.pos.x-s.last.x,dz=a.pos.z-s.last.z,moved=Math.hypot(dx,dz);s.last.copy(a.pos);
    const active=a.onGround&&a.alive&&!a.inVehicle&&a.state==='ground'&&moved<Math.max(1,dt*16);
    const distance=active?moved:0,rate=distance/Math.max(.001,dt);
    s.speed=U.damp(s.speed,rate,16,dt);
    if(!active||rate<.08)return s;
    s.direction.set(dx,0,dz).normalize();
    s.forward=U.damp(s.forward,(-Math.sin(a.yaw)*dx-Math.cos(a.yaw)*dz)/moved,12,dt);
    s.right=U.damp(s.right,(Math.cos(a.yaw)*dx-Math.sin(a.yaw)*dz)/moved,12,dt);
    const stride=this.stride(a,sprint,rate);s.stride=stride;s.sprint=sprint;const previous=Math.floor(s.phase/Math.PI);s.phase+=distance*Math.PI/stride;s.distance+=distance;
    if(s.phase>TAU*1000)s.phase-=TAU*1000;
    if(Math.floor(s.phase/Math.PI)!==previous){
      s.contacts++;s.side=previous%2;
      const surface=G.Footsteps?G.Footsteps.surface(a):a.groundMat;
      const volume=(a.prone||a.knocked) ? .10 : a.crouch ? .18 : sprint ? .5 : .32;
      G.Audio.footstep(a.isPlayer?null:a.pos,surface,volume,s.side);s.side=1-s.side;
    }
    return s;
  },
  pose(m,a,dt){
    const refs=m.poseRefs||(m.poseRefs=[m.root.rotation,m.spine.rotation,m.chest.rotation,m.head.rotation,m.legL.rotation,m.kneeL.rotation,m.legR.rotation,m.kneeR.rotation,m.armL.rotation,m.elbowL.rotation,m.armR.rotation,m.elbowR.rotation]);
    let state=m.motion;
    if(!state)state=m.motion={angles:refs.map(r=>[r.x,r.z]),hip:m.hip.position.y,offset:0,feet:[],ik:0,clock:0,mountY:m.gunMount.position.y};
    state.clock+=dt;
    state.mountY=U.damp(state.mountY,m.gunMount.position.y,12,dt);m.gunMount.position.y=state.mountY;
    for(let i=0;i<refs.length;i++){
      const rate=i===0?9:i<4?13:17,r=refs[i],prev=state.angles[i];
      r.x=prev[0]=U.damp(prev[0],r.x,rate,dt);r.z=prev[1]=U.damp(prev[1],r.z,rate,dt);
    }
    state.hip=U.damp(state.hip,m.hip.position.y,13,dt);
    const reach=m.soldier?.T.feet?.[0]?.pair?.reduce((sum,i)=>sum+(m.soldier.T.entries[i].len||0),0)||.88;
    const moving=Math.min(1,(a.gait?.speed??a.speed)*2);
    const correction=!a.crouch&&!a.prone&&!a.dead ? Math.max(0,.88-reach)*moving : 0;
    state.retarget=U.damp(state.retarget||0,correction,12,dt);
    m.hip.position.y=state.hip-state.retarget;
    const offset=U.damp(state.offset,m.poseTargetY||0,10,dt);
    if(Number.isFinite(a.groundY))m.root.position.y=a.groundY+offset;
    else m.root.position.y+=offset-state.offset;
    state.offset=offset;
    const upright=a.onGround&&!a.dead&&!a.knocked&&!a.prone&&a.state==='ground'&&Math.abs(m.root.rotation.x)<.22&&!m.lod&&a.distance2<30*30;
    state.ik=U.damp(state.ik,upright?1:0,18,dt);
    if(!upright){for(const f of state.feet)f.initialized=false;return}
    this.feet(m,a,dt,state);
  },
  feet(m,a,dt,state){
    const phase=a.gait?.phase??m.phase,speed=a.gait?.speed??a.speed;
    const forward=a.gait?.direction,cy=Math.cos(m.root.rotation.y),sy=Math.sin(m.root.rotation.y);
    for(let i=0;i<2;i++){
      const x=i===0?-.1:.1,leg=i===0?m.legL:m.legR,lower=i===0?m.kneeL:m.kneeR;
      const f=state.feet[i]||(state.feet[i]={plant:new T.Vector3(),from:new T.Vector3(),target:new T.Vector3(),initialized:false,swing:false,ground:0,sampleT:0,actualTarget:new T.Vector3(),normal:new T.Vector3(0,1,0)});
      const duty=a.crouch ? .58 : a.gait?.sprint ? .24 : U.lerp(.5,.28,U.smoothstep(1,4,speed));
      const cycle=((phase/TAU+(i===0?.5:0))%1+1)%1,stance=cycle<duty||speed<.15;
      const lead=speed<.15 ? 0 : Math.min(.44,(a.gait?.stride||this.stride(a,false,speed))*duty);
      const tx=m.root.position.x+cy*x+(forward?.x??-sy)*lead;
      const tz=m.root.position.z-sy*x+(forward?.z??-cy)*lead;
      if(!f.initialized){f.plant.set(tx,m.root.position.y,tz);f.from.copy(f.plant);f.target.copy(f.plant);f.swing=!stance;f.initialized=true;f.sampleT=0}
      if(stance){
        if(f.swing){f.plant.copy(f.target);f.swing=false;f.sampleT=0}
        // Reset an unreachable anchor after teleports or sharp turns.
        if(Math.hypot(f.plant.x-m.root.position.x,f.plant.z-m.root.position.z)>.68){f.plant.set(tx,f.plant.y,tz);f.sampleT=0}
        if(speed<.15){f.plant.x=U.damp(f.plant.x,tx,8,dt);f.plant.z=U.damp(f.plant.z,tz,8,dt)}
        f.target.copy(f.plant);
      }else{
        if(!f.swing){f.from.copy(f.plant);f.swing=true}
        const u=U.clamp((cycle-duty)/(1-duty),0,1),k=u*u*(3-2*u);
        f.target.set(U.lerp(f.from.x,tx,k),0,U.lerp(f.from.z,tz,k));
      }
      f.sampleT-=dt;
      if(f.sampleT<=0){
        const base=a.groundY??m.root.position.y;
        const g=G.World.ground(f.target.x,f.target.z,base+.4,.04,0);
        f.ground=base+U.clamp(g-base,-.3,.3);f.sampleT=1/12;
        if(a.groundMat==='terrain'&&G.World._gmat==='terrain')G.World.normalAt(f.target.x,f.target.z,f.normal);
        else f.normal.set(0,1,0);
        f.normal.applyQuaternion(inverseQ.copy(m.root.quaternion).invert());
      }
      const lift=stance?0:Math.sin(Math.PI*U.clamp((cycle-duty)/(1-duty),0,1))*(a.crouch?.07:speed>4?.13:.10);
      const base=a.groundY??m.root.position.y;
      const wx=f.target.x-m.root.position.x,wz=f.target.z-m.root.position.z;
      const localX=cy*wx-sy*wz,localZ=sy*wx+cy*wz;
      hip.set(x,m.hip.position.y-.04,0);
      direction.set(localX-hip.x,f.ground+.05+lift-m.root.position.y-hip.y,localZ);
      let distance=direction.length();if(distance<.01)continue;direction.divideScalar(distance);
      distance=U.clamp(distance,.12,.879);
      const along=distance*.5,height=Math.sqrt(Math.max(0,.44*.44-along*along));
      bend.set(0,0,-1).addScaledVector(direction,direction.z);if(bend.lengthSq()<.001)bend.set(1,0,0);bend.normalize();
      knee.copy(direction).multiplyScalar(along).addScaledVector(bend,height);
      thighQ.setFromUnitVectors(down,aim.copy(knee).normalize());
      shin.copy(direction).multiplyScalar(distance).sub(knee).normalize();shinQ.setFromUnitVectors(down,shin);
      shinQ.premultiply(inverseQ.copy(thighQ).invert());
      leg.quaternion.slerp(thighQ,state.ik);lower.quaternion.slerp(shinQ,state.ik);
      f.actualTarget.copy(direction).multiplyScalar(distance).add(hip);f.actualTarget.y+=m.root.position.y;
    }
  }
};
})();
