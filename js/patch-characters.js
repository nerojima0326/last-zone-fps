// CC0 MakeHuman assets prepared by Patch. See assets/patch/people/CREDITS.md.
// The existing game remains the animation driver: the imported meshes share its IK.
(function () {
'use strict';
const T=window.THREE, G=window.G, V=T.Vector3, Q=T.Quaternion, M=T.Matrix4;
const BASE='assets/patch/people/';
const MAP={spine_01:'spine',spine_02:'spine1',spine_03:'chest',neck_01:'neck',head:'head',
  upperarm_l:'armL',lowerarm_l:'elbowL',upperarm_r:'armR',lowerarm_r:'elbowR',
  thigh_l:'legL',calf_l:'kneeL',thigh_r:'legR',calf_r:'kneeR'};
const CHILD={upperarm_l:'lowerarm_l',lowerarm_l:'hand_l',upperarm_r:'lowerarm_r',lowerarm_r:'hand_r',
  thigh_l:'calf_l',calf_l:'foot_l',thigh_r:'calf_r',calf_r:'foot_r'};
const GRIP={rifle:{r:[.02,-.075,.11],l:[-.035,-.07,-.24]},shotgun:{r:[.02,-.07,.12],l:[-.035,-.065,-.27]},pistol:{r:[.02,-.06,.06],l:[-.045,-.075,.05]}};
const FINGERS=['index','middle','ring','pinky'];
const LENGTHS=[[.035,.025,.020],[.039,.027,.021],[.037,.025,.020],[.029,.020,.017],[.029,.025,.021]];
const down=new V(0,-1,0),q=new Q(),q2=new Q(),v=new V(),w=new V(),p=new V(),e=new T.Euler();
const S=new V(),D=new V(),E=new V(),A=new V(),B=new V();

function loader() {const l=new T.GLTFLoader();if(T.MeshoptDecoder)l.setMeshoptDecoder(T.MeshoptDecoder);return l;}
function prep(scene,renderer) {
  const textures=new Set();
  scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      for(const t of Object.values(m))if(t?.isTexture){t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.add(t);}
    }
  });
  textures.forEach(t=>renderer.initTexture(t));scene.updateMatrixWorld(true);
}
function boneMap(root) {const b={};root.traverse(o=>{if(o.isBone)b[o.name]=o;});return b;}
function template(name,model) {
  const root=new T.Group();root.name='patch-survivor-'+name;root.add(model);
  model.rotation.y=Math.PI;root.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(model), unit=1.8/box.getSize(new V()).y;
  model.scale.setScalar(unit);model.position.y=-box.min.y*unit;root.updateMatrixWorld(true);
  const byName=boneMap(root),entries=[],names=[];
  root.traverse(b=>{if(!b.isBone)return;
    const P=b.parent, wp=b.getWorldPosition(new V()),W=b.getWorldQuaternion(new Q());
    const entry={name:b.name,key:MAP[b.name],W,L:b.quaternion.clone(),local:b.position.clone(),
      lp:b.position.clone().multiply(P.getWorldScale(new V())),parent:names.indexOf(P.name),
      parentQ:P.getWorldQuaternion(new Q()),parentP:P.getWorldPosition(new V()),C:new Q()};
    const child=byName[CHILD[b.name]];
    if(child){const dir=child.getWorldPosition(new V()).sub(wp);entry.len=dir.length();entry.C.setFromUnitVectors(dir.clone().normalize(),down);entry.dl=dir.normalize().applyQuaternion(W.clone().invert());}
    names.push(b.name);entries.push(entry);
  });
  const idx=n=>names.indexOf(n),meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
  if(!meshes.length||['pelvis',...Object.keys(MAP),...Object.values(CHILD)].some(n=>!byName[n]))throw Error('Incomplete Patch humanoid rig');
  return {name,root,entries,unit,meshes,hip:byName.pelvis.position.clone(),hipParentQ:byName.pelvis.parent.getWorldQuaternion(new Q()),
    ik:{L:[idx('upperarm_l'),idx('lowerarm_l')],R:[idx('upperarm_r'),idx('lowerarm_r')]}};
}
function frame(pos,y,z) {
  const Y=y.clone().normalize(),Z=z.clone().addScaledVector(Y,-z.dot(Y)).normalize(),X=new V().crossVectors(Y,Z).normalize();
  return new M().makeBasis(X,Y,Z).setPosition(pos);
}
function armSource(root) {
  root.updateMatrixWorld(true);const bones=boneMap(root),out={};
  for(const side of ['l','r']) {
    const pos=n=>bones[n+'_'+side].getWorldPosition(new V()),hand=pos('hand');
    const across=pos('index_01').sub(pos('pinky_01')).multiplyScalar(side==='r'?1:-1);
    const palm=pos('middle_01').sub(hand),z=new V().crossVectors(across,palm).normalize(),frames={};
    for(const name of ['upperarm','lowerarm','hand',...FINGERS.flatMap(f=>[f+'_01',f+'_02',f+'_03']),'thumb_01','thumb_02','thumb_03']) {
      const start=pos(name);let end;
      if(name==='upperarm')end=pos('lowerarm');else if(name==='lowerarm')end=hand;else if(name==='hand')end=pos('middle_01');
      else if(name.endsWith('_03'))end=start.clone().add(start.clone().sub(pos(name.replace('_03','_02'))).multiplyScalar(.8));
      else end=pos(name.slice(0,-2)+String(Number(name.slice(-2))+1).padStart(2,'0'));
      const dir=end.sub(start);frames[name+'_'+side]={inverse:frame(start,dir,z).invert(),len:dir.length()};
    }
    const meshes=[];root.traverse(o=>{if(o.isSkinnedMesh&&o.userData.armSide===side)meshes.push(o);});
    if(meshes.length!==2)throw Error('Missing Patch arm skin or sleeve: '+side);
    out[side]={frames,meshes,width:pos('index_01').distanceTo(pos('pinky_01')),palm:palm.length()};
  }
  return out;
}

const C=G.PatchCharacters={ready:false,armsReady:false,templates:[],
  async loadArms(renderer) {
    if(location.protocol==='file:'||!T.GLTFLoader)return false;
    if(!this.armPromise)this.armPromise=(async()=>{
      try{const gltf=await loader().loadAsync(BASE+'fps-arms.glb');prep(gltf.scene,renderer);this.arms=armSource(gltf.scene);this.armsReady=true;}
      catch(error){console.info('[Patch arms] Using built-in arms:',error.message);}return this.armsReady;
    })();return this.armPromise;
  },
  async load(renderer) {
    if(location.protocol==='file:'||!T.GLTFLoader)return false;
    if(!this.peoplePromise)this.peoplePromise=(async()=>{
      await Promise.all([this.loadArms(renderer),...['sweater','cargo'].map(async name=>{
        try{const gltf=await loader().loadAsync(BASE+'survivor-'+name+'.glb');prep(gltf.scene,renderer);this.templates.push(template(name,gltf.scene));}
        catch(error){console.info('[Patch people] '+name+':',error.message);}
      })]);
      this.templates.sort((a,b)=>a.name.localeCompare(b.name));this.ready=this.templates.length>0;return this.ready;
    })();return this.peoplePromise;
  },
  create(rnd) {
    const t=this.templates[Math.floor((rnd?rnd():Math.random())*this.templates.length)],root=T.SkeletonUtils.clone(t.root),byName=boneMap(root),meshes=[];
    root.traverse(o=>{if(o.isSkinnedMesh){o.frustumCulled=false;meshes.push(o);}});
    return {patch:true,T:t,root,meshes,body:meshes[0],helmet:null,bones:t.entries.map(x=>byName[x.name]),hip:byName.pelvis,
      O:t.entries.map(()=>new Q()),X:t.entries.map(()=>new V()),pose:{}};
  },
  drive(s,m) {
    const t=s.T,P=s.pose,rot=(r,out)=>out.setFromEuler(e.set(r.x,r.y,r.z,r.order)),get=k=>P[k]||(P[k]=new Q());
    rot(m.spine.rotation,get('spine'));get('chest').copy(P.spine).multiply(rot(m.chest.rotation,q));get('spine1').copy(P.spine).slerp(P.chest,.5);
    get('head').copy(P.chest).multiply(rot(m.head.rotation,q));get('neck').copy(P.chest).slerp(P.head,.5);
    for(const side of ['L','R']){
      get('arm'+side).copy(P.chest).multiply(rot(m['arm'+side].rotation,q));get('elbow'+side).copy(P['arm'+side]).multiply(rot(m['elbow'+side].rotation,q));
      rot(m['leg'+side].rotation,get('leg'+side));get('knee'+side).copy(P['leg'+side]).multiply(rot(m['knee'+side].rotation,q));
    }
    s.hip.position.copy(t.hip).add(v.set(0,m.hip.position.y-.95,0).applyQuaternion(q.copy(t.hipParentQ).invert()).divideScalar(t.unit));
    const entries=t.entries,O=s.O,X=s.X;
    for(let i=0;i<entries.length;i++){
      const b=entries[i],parentQ=b.parent>=0?O[b.parent]:b.parentQ;
      if(b.key)O[i].copy(P[b.key]).multiply(b.C).multiply(b.W);else O[i].copy(parentQ).multiply(b.L);
      const lp=b.name==='pelvis'?v.copy(s.hip.position).multiplyScalar(t.unit):b.lp;
      X[i].copy(lp).applyQuaternion(parentQ).add(b.parent>=0?X[b.parent]:b.parentP);
    }
    const grip=GRIP[m.ikGun];
    if(grip)for(const side of ['R','L']){
      p.set(0,m.hip.position.y+.06,0).add(v.set(0,.42,0).applyQuaternion(P.spine)).add(w.set(.05,-.1,-.3).applyQuaternion(P.chest));
      this.ik(s,t.ik[side],v.fromArray(grip[side.toLowerCase()]).applyQuaternion(P.chest).add(p),w.set(side==='R'?.7:-.8,-1,.2).applyQuaternion(P.chest));
    }
    for(let i=0;i<entries.length;i++){
      const b=entries[i],parentQ=b.parent>=0?O[b.parent]:b.parentQ;
      s.bones[i].quaternion.copy(q.copy(parentQ).invert().multiply(O[i]));
      if(grip&&/^(index|middle|ring|pinky|thumb)_/.test(b.name))s.bones[i].quaternion.multiply(q2.setFromAxisAngle(A.set(1,0,0),b.name.startsWith('thumb')?.3:.65));
    }
  },
  ik(s,pair,target,pole) {
    const [iu,il]=pair,a=s.T.entries[iu],b=s.T.entries[il],O=s.O;
    S.copy(s.X[iu]);D.subVectors(target,S);const distance=D.length();if(distance<1e-5)return;D.divideScalar(distance);
    const len=G.U.clamp(distance,Math.abs(a.len-b.len)+.001,a.len+b.len-.001),cos=(a.len*a.len+len*len-b.len*b.len)/(2*a.len*len);
    pole.addScaledVector(D,-pole.dot(D)).normalize();E.copy(S).addScaledVector(D,a.len*cos).addScaledVector(pole,a.len*Math.sqrt(Math.max(0,1-cos*cos)));
    A.copy(a.dl).applyQuaternion(O[iu]);B.subVectors(E,S).normalize();q2.setFromUnitVectors(A,B);O[iu].premultiply(q2);O[il].premultiply(q2);
    A.copy(b.dl).applyQuaternion(O[il]);B.copy(S).addScaledVector(D,len).sub(E).normalize();O[il].premultiply(q2.setFromUnitVectors(A,B));
  },
  replaceArm(rig,oldMeshes,skeleton) {
    if(!this.armsReady)return false;
    const side=rig.side>0?'r':'l',src=this.arms[side],bones=skeleton.bones,bindings={},matrices={},normalMatrices={};
    rig.grp.updateMatrixWorld(true);const inv=new M().copy(rig.grp.matrixWorld).invert();
    const add=(name,bone,len,width)=>{
      const source=src.frames[name+'_'+side],index=bones.indexOf(bone);
      bindings[name+'_'+side]=index;
      matrices[name+'_'+side]=new M().multiplyMatrices(inv,bone.matrixWorld).multiply(new M().makeScale(width,len/source.len,width)).multiply(source.inverse);
      normalMatrices[name+'_'+side]=new T.Matrix3().getNormalMatrix(matrices[name+'_'+side]);
    };
    add('upperarm',rig.bS,rig.a,1);add('lowerarm',rig.bE,rig.bw,1);
    const handWidth=.054/src.width;add('hand',rig.bW,.089,handWidth);
    [...FINGERS,'thumb'].forEach((name,f)=>{const chain=f===4?rig.thumbB:rig.fing[f];chain.forEach((bone,i)=>add(name+'_'+String(i+1).padStart(2,'0'),bone,LENGTHS[f][i],handWidth));});
    const replacements=[];
    try{
      for(const source of src.meshes){
        const geo=source.geometry.clone(),pos=geo.attributes.position,nor=geo.attributes.normal,si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight;
        const indices=new Uint16Array(pos.count*4),weights=new Float32Array(pos.count*4),base=new V(),normal=new V(),result=new V(),normalResult=new V(),tmp=new V();
        for(let i=0;i<pos.count;i++){
          base.fromBufferAttribute(pos,i).applyMatrix4(source.matrixWorld);normal.fromBufferAttribute(nor,i).transformDirection(source.matrixWorld);result.set(0,0,0);normalResult.set(0,0,0);
          const influences=new Map();let total=0;
          for(let k=0;k<4;k++){
            const name=source.skeleton.bones[si.array[i*4+k]].name,weight=sw.array[i*4+k],matrix=matrices[name];if(!matrix||!weight)continue;
            result.addScaledVector(tmp.copy(base).applyMatrix4(matrix),weight);normalResult.addScaledVector(tmp.copy(normal).applyMatrix3(normalMatrices[name]).normalize(),weight);total+=weight;
            const record=(ix,w)=>influences.set(ix,(influences.get(ix)||0)+w);
            if(name.startsWith('lowerarm')){
              const t=G.U.clamp(tmp.copy(base).applyMatrix4(src.frames[name].inverse).y/src.frames[name].len,0,1),distal=t>.55;
              const blend=G.U.smoothstep(distal?.55:.14,distal?.96:.55,t);
              record(bones.indexOf(distal?rig.bT:rig.bE),weight*(1-blend));record(bones.indexOf(distal?rig.bD:rig.bT),weight*blend);
            }else record(bindings[name],weight);
          }
          if(total<.5)throw Error('Unmapped Patch arm vertex');
          result.divideScalar(total);normalResult.normalize();pos.setXYZ(i,result.x,result.y,result.z);nor.setXYZ(i,normalResult.x,normalResult.y,normalResult.z);
          const top=Array.from(influences).filter(([,weight])=>weight>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((n,x)=>n+x[1],0);
          top.forEach(([index,weight],k)=>{indices[i*4+k]=index;weights[i*4+k]=weight/sum;});
        }
        geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geo.computeBoundingSphere();
        const mesh=new T.SkinnedMesh(geo,source.material);mesh.name='patch-fps-'+side+'-'+source.userData.armPart;mesh.frustumCulled=false;mesh.userData.keep=true;mesh.userData.patchArm=true;
        replacements.push(mesh);
      }
    }catch(error){replacements.forEach(m=>m.geometry.dispose());console.info('[Patch arms] Using built-in arm:',error.message);return false;}
    for(const mesh of replacements){rig.grp.add(mesh);mesh.bind(skeleton,new M());}
    for(const mesh of oldMeshes){mesh.removeFromParent();mesh.geometry.dispose();}
    rig.skinSource='patch:mpfb:human-0408';rig.meshes=replacements;return true;
  }
};
})();
