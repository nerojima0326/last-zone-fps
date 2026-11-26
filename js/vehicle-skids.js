// 타이어 자국: 이음새를 공유하는 띠·옅은 가장자리·시간 감쇠. 고정 버퍼 하나를 재사용한다.
(function(){
'use strict';
const G=window.G,T=window.THREE,V=T.Vector3,U=G.U;
const direction=new V(),across=new V(),joint=new V(),left=new V(),right=new V(),endLeft=new V(),endRight=new V(),tip=new V();
const S=G.VehicleSkids={
 capacity:4096,total:0,clock:0,lastBirth:0,epoch:0,mesh:null,
 init(){
  if(this.mesh)return;
  const count=this.capacity*4,geo=this.geometry=new T.BufferGeometry();
  this.position=new T.BufferAttribute(new Float32Array(count*3),3).setUsage(T.DynamicDrawUsage);
  this.uv=new T.BufferAttribute(new Float32Array(count*2),2).setUsage(T.DynamicDrawUsage);
  this.trace=new T.BufferAttribute(new Float32Array(count*2),2).setUsage(T.DynamicDrawUsage);
  geo.setAttribute('position',this.position);geo.setAttribute('uv',this.uv);geo.setAttribute('trace',this.trace);
  const indices=new Uint16Array(this.capacity*6);for(let i=0;i<this.capacity;i++){const p=i*4;indices.set([p,p+2,p+1,p+2,p+3,p+1],i*6);}geo.setIndex(new T.BufferAttribute(indices,1));geo.setDrawRange(0,0);this.ids=new Uint32Array(this.capacity);
  const mat=this.material=new T.ShaderMaterial({
   uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{clock:{value:0}}]),fog:true,transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
   vertexShader:`attribute vec2 trace;varying vec2 vTrailUv;varying vec2 vTrace;
    #include <fog_pars_vertex>
    void main(){vTrailUv=uv;vTrace=trace;vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
   fragmentShader:`uniform float clock;varying vec2 vTrailUv;varying vec2 vTrace;
    #include <fog_pars_fragment>
    void main(){float edge=1.0-smoothstep(.24,.5,abs(vTrailUv.x-.5));float fade=1.0-smoothstep(8.0,12.0,max(0.0,clock-vTrace.x));float rubber=.9+.1*sin(vTrailUv.y*3.1+vTrailUv.x*8.0);float alpha=edge*fade*vTrace.y*rubber;if(alpha<.003)discard;gl_FragColor=vec4(.035,.038,.032,alpha);
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`
  });
  const mesh=this.mesh=new T.Mesh(geo,mat);mesh.name='부드러운 타이어 자국';mesh.frustumCulled=false;mesh.renderOrder=1;mesh.count=0;G.scene.add(mesh);G.Vehicles.skids=mesh;G.RT?.invalidate();
 },
 ground(point){point.y=G.Vehicles.groundAt(point.x,point.z,point.y)+.018;return point;},
 dirty(attribute,start,count){attribute.addUpdateRange(start,count);attribute.needsUpdate=true;},
 add(v,i,point,width,opacity){
  v.skid||=[null,null];let track=v.skid[i];
  if(track&&(track.epoch!==this.epoch||point.distanceToSquared(track.p)>6.25||this.clock-track.birth>.3)){this.stopTrack(v,i);track=null;}
  if(!track){v.skid[i]={p:point.clone(),normal:null,width,birth:this.clock,opacity:0,distance:0,slot:-1,id:0,epoch:this.epoch};return;}
  if(point.distanceToSquared(track.p)<.0196)return;
  this.segment(track,point,width,opacity,false);
 },
 segment(track,point,width,opacity,cap){
  this.init();direction.subVectors(point,track.p);direction.y=0;const length=direction.length();if(length<.001)return;direction.divideScalar(length);across.set(-direction.z,0,direction.x);
  if(track.normal){joint.copy(track.normal).add(across);if(joint.lengthSq()<.1)joint.copy(across);else joint.normalize();joint.multiplyScalar(track.width*.5/Math.max(.7,joint.dot(across)));}
  else joint.copy(across).multiplyScalar(width*.5);
  this.ground(left.copy(track.p).add(joint));this.ground(right.copy(track.p).sub(joint));
  // 이전 띠의 끝점과 새 띠의 시작점을 함께 갱신해 꺾인 부분에도 틈·겹침이 생기지 않게 한다.
  if(track.slot>=0&&this.ids[track.slot]===track.id){const vertex=track.slot*4+2;this.position.setXYZ(vertex,left.x,left.y,left.z);this.position.setXYZ(vertex+1,right.x,right.y,right.z);this.dirty(this.position,vertex*3,6);}
  this.ground(endLeft.copy(point).addScaledVector(across,width*.5));this.ground(endRight.copy(point).addScaledVector(across,-width*.5));
  const slot=this.total%this.capacity,offset=slot*4,birth=cap?track.birth:this.clock,id=++this.total;
  [left,right,endLeft,endRight].forEach((p,k)=>{this.position.setXYZ(offset+k,p.x,p.y,p.z);this.uv.setXY(offset+k,k%2,track.distance+(k<2?0:length));this.trace.setXY(offset+k,k<2?track.birth:birth,k<2?track.opacity:opacity);});
  this.ids[slot]=id;this.lastBirth=this.clock;for(const [a,n]of [[this.position,3],[this.uv,2],[this.trace,2]])this.dirty(a,offset*n,4*n);
  this.mesh.count=Math.min(this.capacity,this.total);this.geometry.setDrawRange(0,this.mesh.count*6);G.Vehicles.skidN=this.total;
  track.p.copy(point);track.normal||=new V();track.normal.copy(across);track.width=width;track.birth=birth;track.opacity=opacity;track.distance+=length;track.slot=slot;track.id=id;
 },
 stopTrack(v,i){const track=v.skid?.[i];if(!track)return;if(track.epoch===this.epoch&&track.normal&&this.clock-track.birth<.3){tip.copy(track.p);tip.x+=track.normal.z*.12;tip.z-=track.normal.x*.12;this.segment(track,tip,track.width,0,true);}v.skid[i]=null;},
 stop(v){for(let i=0;i<(v.skid?.length||0);i++)this.stopTrack(v,i);},
 update(dt){this.clock+=dt;if(this.material)this.material.uniforms.clock.value=this.clock;if(this.total&&this.clock-this.lastBirth>12)this.clear();},
 clear(){this.total=0;this.epoch++;this.ids?.fill(0);for(const a of [this.position,this.uv,this.trace])a?.clearUpdateRanges();if(this.mesh){this.mesh.count=0;this.geometry.setDrawRange(0,0);}if(G.Vehicles)G.Vehicles.skidN=0;},
 reset(){this.clear();this.clock=this.lastBirth=0;if(this.material)this.material.uniforms.clock.value=0;}
};
})();
