// One parent transform for the complete gun, imported animations and both hands.
// Real muzzle positions set the reach for every weapon; no per-ID exceptions.
(function () {
'use strict';
const G=window.G,T=window.THREE,U=G.U,right=new T.Vector3(),up=new T.Vector3(),muzzle=new T.Vector3(),origin=new T.Vector3(),d=new T.Vector3();
const savedQ=new T.Quaternion(),savedP=new T.Vector3(),turn=new T.Quaternion(),euler=new T.Euler();
const anchor=new T.Vector3();
const O=G.WeaponObstruction={
  postures:{long:{pivot:[.15,-.10,-.30],pitch:1.05,pull:.075,roll:-.18},pistol:{pivot:[.10,-.09,-.25],pitch:.95,pull:.055,roll:-.12}},
  enabled:true,id:null,amount:0,target:0,blocked:false,reach:.6,local:new T.Vector3(),applied:false,stats:{rays:0},
  restore(vm){if(this.applied&&vm.root){vm.root.position.copy(savedP);vm.root.quaternion.copy(savedQ);vm.root.updateWorldMatrix(true,false)}this.applied=false},
  reset(vm){this.restore(vm);this.id=null;this.amount=this.target=0;this.blocked=false},
  measure(){
    const cam=G.camera,W=G.World,a=G.Player?.a,def=G.WEAPONS[this.id];
    if(!this.enabled||!cam||!W?.grid||!def||!a||a.state!=='ground'||G.Player.camMode!=='fp'||G.Player.vehicle){this.blocked=false;this.target=0;return}
    right.set(1,0,0).applyQuaternion(cam.quaternion);up.set(0,1,0).applyQuaternion(cam.quaternion);
    d.copy(this.local).applyQuaternion(cam.quaternion).normalize();
    let nearest=Infinity;
    for(const [x,y]of [[0,0],[-.035,-.07],[.035,-.07]]){
      origin.copy(cam.position).addScaledVector(right,x).addScaledVector(up,y);
      this.stats.rays++;nearest=Math.min(nearest,W.rayBoxes(origin.x,origin.y,origin.z,d.x,d.y,d.z,this.reach+.13,null));
    }
    const margin=this.blocked?.11:.055;
    this.blocked=nearest<this.reach+margin;
    this.target=Number.isFinite(nearest)?U.clamp((this.reach+.13-nearest)/Math.max(.22,this.reach*.6),0,1):0;
  },
  canFire(id){if(this.id!==id)return true;this.measure();return !this.blocked&&this.amount<.25},
  update(vm,dt){
    const cam=G.camera,a=G.Player?.a;
    if(!vm.root||!cam)return;
    if(this.id!==vm.cur){this.amount=0;this.blocked=false;this.id=vm.cur}
    if(!G.WEAPONS[this.id]||!a){this.target=0;this.blocked=false;return}
    // Called after native importers finish, before applying the tuck itself.
    vm.muzzleWorld(cam,muzzle);
    this.local.copy(muzzle).sub(cam.position).applyQuaternion(turn.copy(cam.quaternion).invert());
    this.reach=U.clamp(this.local.length(),.22,2.4);
    if(a.weapons[a.cur]?.attachments?.muzzle==='suppressor')this.reach+=.18;
    if(this.local.lengthSq()<.01)this.local.set(0,-.1,-this.reach);
    this.measure();
    this.amount=U.damp(this.amount,this.enabled?this.target:0,this.target>this.amount?24:12,dt);
    if(this.amount<.00001){this.amount=0;return}
    savedQ.copy(vm.root.quaternion);savedP.copy(vm.root.position);
    const k=this.amount,pose=this.postures[G.WEAPONS[this.id].cls==='pistol'?'pistol':'long'];
    // Fold up around the hands instead of rotating about the eye and pulling
    // the entire rig behind the near plane. Both hands remain visible/attached.
    anchor.fromArray(pose.pivot);euler.set(k*pose.pitch,-k*.06,k*pose.roll);turn.setFromEuler(euler);
    vm.root.quaternion.premultiply(turn);
    vm.root.position.sub(anchor).applyQuaternion(turn).add(anchor).add(muzzle.set(-.015*k,-.005*k,pose.pull*k));
    vm.root.updateWorldMatrix(true,false);this.applied=true;
  }
};
})();
