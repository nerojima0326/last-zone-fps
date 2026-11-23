// Original atlas and bounded, solid fragments. Reuses the existing 200-decal
// draw; one extra instanced draw for all nearby wood/concrete fragments.
(function () {
'use strict';
const G=window.G,T=window.THREE,U=G.U,obj=new T.Object3D(),normal=new T.Vector3(),tangent=new T.Vector3(),bitangent=new T.Vector3(),matrix=new T.Matrix4();
const I=G.ImpactDetail={
  enabled:true,marks:[],chunks:[],index:0,chunkIndex:0,clock:0,frame:0,budgetFrame:-1,bursts:0,stats:{marks:0,fragments:0},
  atlas(){
    return G.Tex.canvas(512,512,(c)=>{
      const rnd=U.mulberry32(804181);
      for(let tile=0;tile<16;tile++){
        c.save();c.translate((tile%4)*128+64,Math.floor(tile/4)*128+64);
        const kind=Math.floor(tile/4);
        if(kind===0){
          c.beginPath();for(let j=0;j<18;j++){const a=j*Math.PI/9,r=15+rnd()*13;c.lineTo(Math.cos(a)*r,Math.sin(a)*r)}c.closePath();c.fillStyle='rgba(170,163,148,.65)';c.fill();
          for(let j=0;j<11;j++){const a=rnd()*Math.PI*2,len=20+rnd()*33;c.beginPath();c.moveTo(Math.cos(a)*8,Math.sin(a)*8);c.lineTo(Math.cos(a+.08)*len*.6,Math.sin(a+.08)*len*.6);c.lineTo(Math.cos(a)*len,Math.sin(a)*len);c.strokeStyle='rgba(34,30,26,.72)';c.lineWidth=.6+rnd();c.stroke()}
        }else if(kind===1){
          for(let j=0;j<19;j++){
            const x=(rnd()-.5)*28,y=(rnd()-.5)*35,len=10+rnd()*36;c.beginPath();c.moveTo(x-2,y-len/2);c.lineTo(x+3,y+len/2);c.lineTo(x+5,y-len*.1);c.closePath();c.fillStyle=j%2?'rgba(189,146,87,.75)':'rgba(66,43,24,.7)';c.fill();
          }
        }else if(kind===2){
          const g=c.createRadialGradient(-3,-4,3,0,0,23);g.addColorStop(0,'rgba(225,219,201,.95)');g.addColorStop(.45,'rgba(129,128,120,.7)');g.addColorStop(.7,'rgba(54,53,47,.65)');g.addColorStop(1,'rgba(80,77,68,0)');c.fillStyle=g;c.fillRect(-26,-26,52,52);
          c.strokeStyle='rgba(195,189,167,.8)';c.lineWidth=1.2;
          for(let j=0;j<6;j++){const a=rnd()*6.28;c.beginPath();c.moveTo(Math.cos(a)*15,Math.sin(a)*15);c.lineTo(Math.cos(a)*30,Math.sin(a)*30);c.stroke()}
        }else{
          const g=c.createRadialGradient(0,0,2,0,0,43);g.addColorStop(0,'rgba(45,32,20,.65)');g.addColorStop(1,'rgba(67,49,29,0)');c.fillStyle=g;c.fillRect(-48,-48,96,96);
        }
        const hole=c.createRadialGradient(-1,-1,2,0,0,kind===2?10:13);
        hole.addColorStop(0,'rgba(8,7,6,.98)');hole.addColorStop(.5,'rgba(22,18,14,.95)');hole.addColorStop(1,'rgba(44,36,27,0)');c.fillStyle=hole;c.fillRect(-16,-16,32,32);c.restore();
      }
    },{clamp:true});
  },
  init(fx){
    this.fx=fx;const mesh=fx.decalIM,n=mesh.count;
    this.tiles=new T.InstancedBufferAttribute(new Float32Array(n),1);this.fades=new T.InstancedBufferAttribute(new Float32Array(n),1);
    this.tiles.setUsage(T.DynamicDrawUsage);this.fades.setUsage(T.DynamicDrawUsage);
    mesh.geometry.setAttribute('decalTile',this.tiles);mesh.geometry.setAttribute('decalFade',this.fades);
    mesh.material.map.dispose();mesh.material.map=this.atlas();
    mesh.material.onBeforeCompile=sh=>{
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float decalTile;attribute float decalFade;varying float vDecalFade;')
        .replace('#include <uv_vertex>',`#include <uv_vertex>
          vDecalFade=decalFade;
          #ifdef USE_MAP
            vMapUv=(vMapUv*.94+vec2(.03)+vec2(mod(decalTile,4.0),3.0-floor(decalTile/4.0)))*.25;
          #endif`);
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vDecalFade;')
        .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vDecalFade;');
    };
    mesh.material.customProgramCacheKey=()=> 'material-impact-atlas-v80';mesh.material.needsUpdate=true;
    this.fragmentMesh=new T.InstancedMesh(new T.TetrahedronGeometry(.5),new T.MeshStandardMaterial({color:0xffffff,roughness:.92}),48);
    this.fragmentMesh.name='Impact fragment pool';this.fragmentMesh.frustumCulled=false;this.fragmentMesh.count=0;
    this.fragmentMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);fx.scene.add(this.fragmentMesh);
    for(let i=0;i<48;i++){this.fragmentMesh.setColorAt(i,new T.Color(1,1,1));this.chunks.push({active:false,p:new T.Vector3(),v:new T.Vector3(),rotation:new T.Euler(),spin:new T.Vector3(),scale:new T.Vector3(),color:new T.Color()})}
    this.reset();
  },
  decal(point,nrm,mat='hard',context={}){
    if(!this.enabled||!this.fx)return false;
    if(context.dynamic||mat==='soft')return true;
    const camera=G.camera;if(camera&&point.distanceToSquared(camera.position)>70*70)return true;
    const type=mat==='metal'?2:mat==='wood'?1:mat==='terrain'?3:0;
    let size=(type===2?.055:type===1?.115:.10)*(context.weapon?.ammo==='12g'?.64:1);
    const box=context.box;
    if(box){
      const axes=Math.abs(nrm.y)>.8?['x','z']:Math.abs(nrm.x)>.8?['y','z']:['x','y'];
      let margin=Infinity;
      for(const a of axes){const k=a.toUpperCase();margin=Math.min(margin,point[a]-box['min'+k],box['max'+k]-point[a])}
      if(margin<.004)return true;size=Math.min(size,margin*1.35);
    }
    normal.copy(nrm).normalize();const travel=context.direction;
    let graze=1;
    if(travel){tangent.copy(travel).addScaledVector(normal,-travel.dot(normal));graze=1+2*(1-Math.abs(travel.dot(normal)))}
    else tangent.set(0,0,0);
    if(tangent.lengthSq()<.001){tangent.set(Math.abs(normal.y)>.8?1:0,Math.abs(normal.y)>.8?0:1,0);tangent.cross(normal)}
    tangent.normalize();bitangent.crossVectors(normal,tangent).normalize();matrix.makeBasis(tangent,bitangent,normal);
    obj.quaternion.setFromRotationMatrix(matrix);obj.position.copy(point).addScaledVector(normal,.0018);
    // Preserve a conservative edge radius even for a stretched grazing mark.
    obj.scale.set(size*graze/.14,size/.14,1);if(box)obj.scale.multiplyScalar(1/graze);
    obj.updateMatrix();const index=this.index++%this.fx.decalIM.count;
    this.fx.decalIM.setMatrixAt(index,obj.matrix);this.fx.decalIM.instanceMatrix.needsUpdate=true;
    this.tiles.setX(index,type*4+(this.index%4));this.tiles.needsUpdate=true;this.fades.setX(index,1);this.fades.needsUpdate=true;
    this.marks[index]={age:0,life:24+this.index%8};this.stats.marks++;return true;
  },
  fragments(point,nrm,mat,count){
    if(G.camera&&point.distanceToSquared(G.camera.position)>24*24)return;
    for(let i=0;i<count;i++){
      const s=this.chunks[this.chunkIndex++%48],wood=mat==='wood';s.active=true;s.age=0;s.life=1.1+Math.random()*.55;s.p.copy(point).addScaledVector(nrm,.015);
      s.v.set((nrm.x+(Math.random()-.5))*2,Math.max(.4,nrm.y*1.2)+Math.random()*1.6,(nrm.z+(Math.random()-.5))*2);
      s.rotation.set(Math.random()*6,Math.random()*6,0);s.spin.set(Math.random()*8,Math.random()*8,Math.random()*8);
      s.scale.set(wood?.009:.018,wood?.045:.022,.011).multiplyScalar(.6+Math.random()*.8);
      s.color.setHex(wood?0x9b7045:0x9d9685);s.floor=G.World.ground(point.x,point.z,point.y+.05,.02,.15);this.stats.fragments++;
    }
  },
  dust(fx,p,n,count,r,g,b,scale){
    const first=fx.norm.list.length;fx.dust(p,count,n.x,n.y,n.z,r,g,b,scale);
    for(let i=first;i<fx.norm.list.length;i++){
      const particle=fx.norm.list[i];particle.a*=.55;particle.s0*=.8;particle.s1*=.65;particle.life*=.72;particle.fo=1.4;
    }
  },
  impact(fx,p,n,mat,context={}){
    if(!this.enabled)return false;
    const distance=G.camera?p.distanceToSquared(G.camera.position):0,frame=Math.floor(performance.now()/16.667);
    if(frame!==this.budgetFrame){this.budgetFrame=frame;this.bursts=0}
    const detailed=distance<40*40&&this.bursts++<12;
    this.decal(p,n,mat,context);
    if(!detailed){if(distance<85*85)this.dust(fx,p,n,1,.62,.59,.53,.35);return true}
    const pellet=context.weapon?.pellets>1,k=pellet?.7:1;
    if(mat==='metal'){
      const incidence=context.direction?Math.abs(context.direction.dot(n)):1;
      fx.spark(p,pellet?3:Math.round(3+(1-incidence)*5),n.x,n.y,n.z,5);this.dust(fx,p,n,1,.48,.47,.43,.35*k);
    }else if(mat==='wood'){
      this.dust(fx,p,n,2,.59,.46,.30,.45*k);this.fragments(p,n,mat,pellet?1:3);
    }else if(mat==='soft')this.dust(fx,p,n,2,.6,.54,.4,.55*k);
    else if(mat==='terrain'){
      const surface=G.World.surfaceAt(p.x,p.z),sand=surface==='sand',grass=surface==='grass';
      this.dust(fx,p,n,3,sand?.69:grass?.39:.46,sand?.61:grass?.43:.40,sand?.43:grass?.28:.32,.6*k);
      if(surface==='gravel'||surface==='concrete'||surface==='asphalt')this.fragments(p,n,'hard',pellet?1:2);
    }else{this.dust(fx,p,n,3,.65,.62,.57,.55*k);this.fragments(p,n,'hard',pellet?1:3)}
    return true;
  },
  update(dt){
    if(!this.fx)return;
    this.clock+=dt;this.frame++;let n=0,queries=0;
    for(let index=0;index<this.chunks.length;index++){
      const s=this.chunks[index];
      if(!s.active)continue;s.age+=dt;if(s.age>=s.life){s.active=false;continue}
      s.v.y-=9.8*dt;s.p.addScaledVector(s.v,dt);
      if(queries<4&&((index+this.frame)%12===0)){s.floor=G.World.ground(s.p.x,s.p.z,s.p.y+.06,.02,.12);queries++}
      if(s.p.y<s.floor+.004){s.p.y=s.floor+.004;s.v.y=Math.max(0,-s.v.y*.22);s.v.x*=.65;s.v.z*=.65;s.spin.multiplyScalar(.7)}
      s.rotation.x+=s.spin.x*dt;s.rotation.y+=s.spin.y*dt;s.rotation.z+=s.spin.z*dt;
      obj.position.copy(s.p);obj.rotation.copy(s.rotation);obj.scale.copy(s.scale).multiplyScalar(Math.min(1,(s.life-s.age)/.25));obj.updateMatrix();
      this.fragmentMesh.setMatrixAt(n,obj.matrix);this.fragmentMesh.setColorAt(n,s.color);n++;
    }
    this.fragmentMesh.count=n;if(n){this.fragmentMesh.instanceMatrix.needsUpdate=true;this.fragmentMesh.instanceColor.needsUpdate=true}
    if(this.clock<.1)return;const elapsed=this.clock;this.clock=0;let dirty=false;
    for(let i=0;i<this.marks.length;i++){
      const m=this.marks[i];if(!m)continue;m.age+=elapsed;
      const fade=this.enabled?U.clamp((m.life-m.age)/4,0,1):0;this.fades.setX(i,fade);dirty=true;
      if(m.age>=m.life)this.marks[i]=null;
    }
    if(dirty)this.fades.needsUpdate=true;
  },
  reset(){
    this.marks.length=0;this.index=this.chunkIndex=0;this.clock=0;
    for(const s of this.chunks)s.active=false;if(this.fragmentMesh)this.fragmentMesh.count=0;
    if(this.fades){this.fades.array.fill(0);this.fades.needsUpdate=true}
  }
};
})();
