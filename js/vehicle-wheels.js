// 바퀴별 굴림·애커먼 조향·타이어 피격. 모델 원본과 공용 재질은 변경하지 않는다.
(function(){
'use strict';
const G=window.G,T=window.THREE,U=G.U,V=T.Vector3,X=new V(1,0,0),Y=new V(0,1,0),p=new V(),d=new V(),f=new V(),c=new V(),n=new V(),prev=new V(),inv=new T.Matrix4(),matrix=new T.Matrix4(),q=new T.Quaternion(),ray=new T.Ray(),box=new T.Box3(),caster=new T.Raycaster(),hits=[];
const W=G.VehicleWheels={
  hp:36,
  setup(v){
    v.ownedGeometries=[];v.wheelDamage=0;v.tirePull=0;
    if(!v.wheels)return;
    for(const w of v.wheels){
      const model=w.o,parent=model.parent,mount=new T.Group(),spin=new T.Group();mount.name=model.name;model.name+='_모델';mount.position.copy(model.position);parent.add(mount);mount.add(spin);spin.add(model);model.position.set(0,0,0);
      w.o=mount;w.model=model;w.spin=spin;w.rest=mount.position.clone();w.r=w.r||v.dim.r;w.radius=w.r;w.width=w.width||.28;w.hp=this.hp;w.flat=false;w.angle=0;w.steer=0;w.last=new V();w.forward=new V();w.valid=false;
    }
    v.mesh.updateMatrixWorld(true);this.sync(v);
    const front=v.dim.wheelPts.filter(a=>a[1]<0),rear=v.dim.wheelPts.filter(a=>a[1]>=0);
    v.wheelbase=front.length&&rear.length?rear.reduce((s,a)=>s+a[1],0)/rear.length-front.reduce((s,a)=>s+a[1],0)/front.length:2.6;
    v.bodyMeshes=[];v.mesh.getObjectByName('body')?.traverse(o=>{if(o.isMesh)v.bodyMeshes.push(o)});
  },
  sync(v){
    if(!v.wheels)return;v.mesh.updateMatrixWorld(true);
    for(const w of v.wheels){w.o.getWorldPosition(w.last);w.o.getWorldQuaternion(q);w.forward.set(0,0,-1).applyQuaternion(q);w.valid=true}
  },
  steer(v){
    if(!v.wheels)return;const angle=v.steerAngle||0,wb=v.wheelbase||2.6,turn=Math.abs(angle)>.0001?wb/Math.tan(Math.abs(angle)):Infinity;
    for(let i=0;i<v.wheels.length;i++){
      const w=v.wheels[i],x=v.dim.wheelPts[i][0];w.steer=w.front?Math.sign(angle)*Math.atan(wb/Math.max(.5,turn+Math.sign(angle)*x)):0;w.o.quaternion.setFromAxisAngle(Y,w.steer);
    }
  },
  update(v,dt){
    if(!v.wheels)return;this.steer(v);v.mesh.updateMatrixWorld(true);
    for(const w of v.wheels){
      w.o.getWorldPosition(p);w.o.getWorldQuaternion(q);f.set(0,0,-1).applyQuaternion(q);prev.copy(w.forward).add(f).normalize();
      const travel=w.valid?d.copy(p).sub(w.last).dot(prev):0;
      // 뒷바퀴가 잠겼을 때도 접점을 갱신해 브레이크를 놓을 때 회전이 튀지 않게 한다.
      if(!(v.handbrake&&!w.front)){
        const grounded=v.grounded!==false&&w.grounded!==false;
        const rotation=grounded?travel/Math.max(.12,w.radius):(w.spinRate||0)*(dt||0);
        w.angle=(w.angle+rotation)%(Math.PI*2);if(grounded&&dt>0)w.spinRate=rotation/dt;
      }
      w.spin.quaternion.setFromAxisAngle(X,-w.angle);w.last.copy(p);w.forward.copy(f);w.valid=true;
    }v.mesh.updateMatrixWorld(true);
  },
  drops(v){
    const out=v.wheelDrops||(v.wheelDrops={front:0,rear:0,left:0,right:0,n:0});out.front=out.rear=out.left=out.right=out.n=0;if(!v.wheels)return out;
    for(let i=0;i<v.wheels.length;i++){const w=v.wheels[i],drop=w.r-w.radius;out[w.front?'front':'rear']+=drop*.5;out[v.dim.wheelPts[i][0]<0?'left':'right']+=drop*.5;if(w.flat)out.n++}return out;
  },
  // 조향된 유한 원통으로 차체 기울기와 바퀴별 폭까지 판정한다.
  ray(v,o,dir,maxT){
    if(!v.wheels)return null;let best=null;
    for(const w of v.wheels){
      if(!w.o.visible)continue;inv.copy(w.o.matrixWorld).invert();ray.set(o,dir).applyMatrix4(inv);const a=ray.origin,b=ray.direction,r=w.radius,h=w.width*.5+.012,A=b.y*b.y+b.z*b.z,B=2*(a.y*b.y+a.z*b.z),C=a.y*a.y+a.z*a.z-r*r;let t=Infinity;
      if(Math.abs(a.x)<=h&&C<=0)t=0;
      if(A>1e-10){const disc=B*B-4*A*C;if(disc>=0)for(const k of[(-B-Math.sqrt(disc))/(2*A),(-B+Math.sqrt(disc))/(2*A)])if(k>=0&&Math.abs(a.x+b.x*k)<=h)t=Math.min(t,k)}
      if(Math.abs(b.x)>1e-10)for(const side of[-h,h]){const k=(side-a.x)/b.x;if(k>=0&&(a.y+b.y*k)**2+(a.z+b.z*k)**2<=r*r)t=Math.min(t,k)}
      if(t>=maxT||best&&t>=best.t)continue;
      p.copy(b).multiplyScalar(t).add(a);if(Math.abs(Math.abs(p.x)-h)<.001)n.set(Math.sign(p.x),0,0);else n.set(0,p.y,p.z).normalize();if(n.lengthSq()<1e-9)n.copy(b).negate();w.o.getWorldQuaternion(q);n.applyQuaternion(q);
      best={v,wheel:w,t,normal:n.clone()};
    }return best;
  },
  occluder(v,o,dir,t){
    if(!v.bodyMeshes?.length)return Infinity;caster.set(o,dir);caster.near=0;caster.far=t;hits.length=0;caster.intersectObjects(v.bodyMeshes,false,hits);return hits[0]?.distance??Infinity;
  },
  well(v,point,rootInv){
    // 짧은 탄도 구간이 바퀴 앞에서 끝나도 빈 휠하우스를 차체로 오인하지 않는다.
    for(const w of v.wheels||[]){w.o.getWorldPosition(c).applyMatrix4(rootInv);if(Math.abs(point.x)>Math.abs(c.x)-w.width-.06&&Math.hypot(point.y-c.y,point.z-c.z)<w.r*1.22)return true}return false;
  },
  flatten(v,w){
    w.spin.updateWorldMatrix(true,true);inv.copy(w.spin.matrixWorld).invert();
    w.model.traverse(o=>{
      if(!o.isMesh)return;const geo=o.geometry.clone(),a=geo.attributes.position;matrix.multiplyMatrices(inv,o.matrixWorld);const back=matrix.clone().invert();
      for(let i=0;i<a.count;i++){
        p.fromBufferAttribute(a,i).applyMatrix4(matrix);const radial=Math.hypot(p.y,p.z),rim=w.r*.56;
        if(radial>rim){const scale=(rim+(radial-rim)*.40)/radial;p.y*=scale;p.z*=scale;p.x*=1+.10*U.clamp((radial-rim)/(w.r-rim),0,1)}
        p.applyMatrix4(back);a.setXYZ(i,p.x,p.y,p.z);
      }
      a.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();o.geometry=geo;v.ownedGeometries.push(geo);
    });w.radius=w.r*.736;G.RT?.invalidate();
  },
  damage(v,w,amount,by,point,normal){
    if(v.dead||w.flat||!(amount>0))return false;w.hp=Math.max(0,w.hp-amount);if(w.hp)return false;
    w.flat=true;v.wheelDamage++;if(by)v.lastHit=by;this.flatten(v,w);
    const left=v.wheels.filter(a=>a.flat&&v.dim.wheelPts[v.wheels.indexOf(a)][0]<0).length,right=v.wheelDamage-left;v.tirePull=(left-right)*.035;
    G.Audio.tireBurst?.(point);if(point.distanceTo(G.camera.position)<120){G.FX.debris(point,7,normal.x*.8,1.5,normal.z*.8,.035,.032,.029);G.FX.dust(point,5,normal.x*.7,.5,normal.z*.7,.22,.21,.19,.5)}
    const driver=v.driver;if(driver?.isPlayer)G.UI.toast('타이어 파손! 속도와 접지력이 감소합니다.');
    if(!v.driver&&v.grounded!==false){const parked=!!v.box;if(parked)G.Vehicles.unblock(v);G.Vehicles.place(v,1);this.sync(v);if(parked)G.Vehicles.block(v)}return true;
  },
  dispose(v){for(const g of v.ownedGeometries||[])g.dispose();for(const m of v.ownedMaterials||[])m.dispose();v.ownedGeometries=[];v.ownedMaterials=[]}
};
})();
