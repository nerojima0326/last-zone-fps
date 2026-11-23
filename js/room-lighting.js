// Local exposure adaptation and a fixed pool of window-light patches.
// Window positions come from the real wall openings, not decorative guesses.
(function () {
'use strict';
const G=window.G,T=window.THREE,U=G.U,p=new T.Vector3(),d=new T.Vector3(),across=new T.Vector3(),along=new T.Vector3();
const hit={normal:new T.Vector3()},obj=new T.Object3D(),zero=new T.Matrix4().makeScale(0,0,0),color=new T.Color();
const R=G.RoomLighting={
  enabled:true,base:.6,adaptation:1,profile:null,next:0,last:new T.Vector3(1e9,0,0),patches:[],stats:{rays:0,patches:0},
  register(W,b,axis,coord,o){
    if(W.cur?.tag!=='b')return;
    const a=(o.a+o.b)/2,local=axis==='x'?[a,coord]:[coord,a],xz=W.tf(b,...local);
    const normal=new T.Vector3(axis==='z'?Math.sign(coord):0,0,axis==='x'?Math.sign(coord):0).transformDirection(b.m);
    (W.windows||(W.windows=[])).push({position:new T.Vector3(xz[0],b.y+(o.y0+o.y1)/2,xz[1]),normal,width:o.b-o.a,height:o.y1-o.y0});
  },
  init(scene){
    const tex=G.Tex.canvas(128,128,(c,w)=>{
      const image=c.createImageData(w,w);
      for(let y=0;y<w;y++)for(let x=0;x<w;x++){
        const edge=Math.min(x,y,w-1-x,w-1-y)/w,k=U.smoothstep(0,.12,edge),i=(y*w+x)*4;
        image.data[i]=image.data[i+1]=image.data[i+2]=255;image.data[i+3]=Math.round(k*210);
      }c.putImageData(image,0,0);
    },{clamp:true});
    const material=new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.23,depthWrite:false,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    this.mesh=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),material,6);
    this.mesh.name='Window light pool';this.mesh.frustumCulled=false;this.mesh.renderOrder=1;
    for(let i=0;i<6;i++){this.mesh.setMatrixAt(i,zero);this.mesh.setColorAt(i,new T.Color(0,0,0));this.patches.push({weight:0,target:0})}
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(this.mesh);
  },
  setTime(exposure){this.base=exposure;this.adaptation=1;this.next=0;if(G.renderer)G.renderer.toneMappingExposure=exposure},
  refresh(cam){
    const W=G.World,windows=W.windows||[],candidates=[];
    for(const w of windows){const distance=w.position.distanceToSquared(cam);if(distance<32*32&&w.normal.dot(W.sunDir)>.12)candidates.push({w,distance})}
    candidates.sort((a,b)=>a.distance-b.distance);
    let n=0,queries=0;d.copy(W.sunDir).negate();
    const available=this.enabled&&W.weather!=='rain'&&W.weather!=='fog'&&d.y<-.12;
    if(available)for(const {w}of candidates.slice(0,18)){
      if(n===6||queries>=26)break;
      p.copy(w.position).addScaledVector(d,.035);this.stats.rays++;queries++;
      const t=W.rayBoxes(p.x,p.y,p.z,d.x,d.y,d.z,18,hit);
      if(!Number.isFinite(t)||hit.normal.y<.9||!hit.box||t<.12)continue;
      p.addScaledVector(d,t);const box=hit.box;
      let width=Math.min(2.5,w.width*.9),length=Math.min(4.5,w.height*Math.hypot(d.x,d.z)/-d.y+.2);
      along.set(d.x,0,d.z).normalize();across.set(-along.z,0,along.x);
      // Keep patches inside the receiving floor and the surrounding walls.
      const margin=Math.min(p.x-box.minX,box.maxX-p.x,p.z-box.minZ,box.maxZ-p.z)-.035;
      width=Math.min(width,margin*1.4);length=Math.min(length,margin*1.4);
      for(const axis of [along,across])for(const sign of [-1,1]){
        const max=(axis===along?length:width)/2;
        this.stats.rays++;queries++;const wall=W.rayBoxes(p.x,p.y+.06,p.z,axis.x*sign,0,axis.z*sign,max,null);
        if(Number.isFinite(wall)){if(axis===along)length=Math.min(length,Math.max(0,wall-.025)*2);else width=Math.min(width,Math.max(0,wall-.025)*2)}
      }
      if(width<.12||length<.15)continue;
      obj.position.copy(p);obj.position.y+=.003;obj.rotation.set(0,Math.atan2(along.x,along.z),0);obj.scale.set(width,1,length);obj.updateMatrix();this.mesh.setMatrixAt(n,obj.matrix);
      this.patches[n].target=W.weather==='night'?.14:.60*w.normal.dot(W.sunDir);n++;
    }
    for(let i=n;i<6;i++)this.patches[i].target=0;
    this.stats.patches=n;this.mesh.instanceMatrix.needsUpdate=true;
  },
  update(dt,cam){
    if(!G.World?.grid||!this.mesh)return;
    const playing=G.Game?.state!=='menu';
    const profile=this.profile=G.SceneSense.sample(cam);
    const target=this.enabled&&playing?1+profile.enclosure*(G.World.weather==='night'?.10:.16):1;
    // Bounded, geometry-driven adaptation cannot pump after a muzzle flash.
    this.adaptation=U.damp(this.adaptation,target,target>this.adaptation?1.7:3.2,dt);
    G.renderer.toneMappingExposure=this.base*this.adaptation;
    this.next-=dt;
    if(this.next<=0||this.last.distanceToSquared(cam)>2.25){this.next=.28;this.last.copy(cam);this.refresh(cam)}
    for(let i=0;i<6;i++){
      const s=this.patches[i];s.weight=U.damp(s.weight,this.enabled&&playing?s.target:0,8,dt);
      color.copy(G.World.sun.color).multiplyScalar(s.weight);this.mesh.setColorAt(i,color);
    }
    this.mesh.instanceColor.needsUpdate=true;
  }
};
})();
