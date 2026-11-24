// 지형에 맞는 마을 필지·숲 간격과 배치 검색용 격자. 렌더 품질과 별개로 같은 맵을 만든다.
(function(){
'use strict';
const G=window.G,U=G.U;
const cellKey=(x,z)=>x>=-32768&&x<=32767&&z>=-32768&&z<=32767?(z+32768)*65536+x+32768:x+','+z;
class Grid{
  constructor(size){this.size=size;this.cells=new Map();this.count=0;this.stamp=0}
  add(item,x0,z0,x1=x0,z1=z0){const s=this.size;for(let z=Math.floor(z0/s);z<=Math.floor(z1/s);z++)for(let x=Math.floor(x0/s);x<=Math.floor(x1/s);x++){const k=cellKey(x,z);let a=this.cells.get(k);if(!a)this.cells.set(k,a=[]);a.push(item)}this.count++}
  some(x0,z0,x1,z1,test){const s=this.size,stamp=++this.stamp;for(let z=Math.floor(z0/s);z<=Math.floor(z1/s);z++)for(let x=Math.floor(x0/s);x<=Math.floor(x1/s);x++)for(const e of this.cells.get(cellKey(x,z))||[]){if(e.stamp===stamp)continue;e.stamp=stamp;if(test(e))return true}return false}
}
const L=G.MapLayout={
  Grid,key:cellKey,
  footprints(W){let g=W.footprintIndex;if(!g||g.count>W.footprints.length)g=W.footprintIndex=new Grid(32);while(g.count<W.footprints.length){const f=W.footprints[g.count];g.add({f},f.minX,f.minZ,f.maxX,f.maxZ)}return g},
  blocked(W,x0,z0,x1,z1){return this.footprints(W).some(x0,z0,x1,z1,({f})=>x0<f.maxX&&x1>f.minX&&z0<f.maxZ&&z1>f.minZ)},
  roads(W){W.roadClearance=null;const g=W.roadIndex=new Grid(48);for(const r of W.roads)g.add({r},Math.min(r.ax,r.bx)-4,Math.min(r.az,r.bz)-4,Math.max(r.ax,r.bx)+4,Math.max(r.az,r.bz)+4)},
  roadDist(W,x,z,limit){let best=limit;W.roadIndex.some(x-limit,z-limit,x+limit,z+limit,({r})=>{best=Math.min(best,U.segDist2D(x,z,r.ax,r.az,r.bx,r.bz)-(r.w-7)*.5);return false});return best},
  streets(W){
    W.layoutStats={streetLots:0,randomLots:0,treesRejectedSpacing:0};
    for(const t of W.towns){
      if(t.type==='range')continue;t.streets=[];
      const add=(ax,az,bx,bz,w=6)=>{const r={ax,az,bx,bz,w,town:t.name,local:true};W.roads.push(r);t.streets.push(r)};
      if(t.type==='city'){
        for(const dz of[-58,4,64])add(t.x-t.r-4,t.z+dz,t.x+t.r+4,t.z+dz);
        for(const dx of[-52,-2,52])add(t.x+dx,t.z-t.r-4,t.x+dx,t.z+t.r+4);
      }else{
        add(t.x-t.r-4,t.z,t.x+t.r+4,t.z,5.6);
        if(['town','military','plant','depot'].includes(t.type))add(t.x,t.z-t.r-4,t.x,t.z+t.r+4,5.6);
      }
      // 찬 필지를 무작위로 재시도하지 않도록 도로 양쪽의 앞·뒷줄 후보를 한 번씩 검사한다.
      t.plots=[];
      for(const road of t.streets){const span=Math.hypot(road.bx-road.ax,road.bz-road.az),slots=Math.max(1,Math.floor((span-22)/26));for(let i=0;i<slots;i++)for(const side of[-1,1])for(const row of[0,1])t.plots.push({road,side,row,along:(i+.5)/slots})}
      const random=U.mulberry32(8703+Math.round((t.x+800)*31+(t.z+800)*17));
      for(let i=t.plots.length-1;i>0;i--){const j=Math.floor(random()*(i+1)),a=t.plots[i];t.plots[i]=t.plots[j];t.plots[j]=a}
    }
  },
  lot(W,t,kind,fp,r){
    const plot=kind==='car'?null:t.plots.pop();if(kind!=='car'&&!plot)return null;
    const road=plot?.road||t.streets[Math.floor(r()*t.streets.length)],horizontal=Math.abs(road.bx-road.ax)>Math.abs(road.bz-road.az),side=plot?.side||(r()<.5?-1:1);
    const rot=horizontal?(side<0?0:2):(side<0?1:3),half=(rot&1?fp[0]:fp[1])*.5;
    const span=horizontal?Math.abs(road.bx-road.ax):Math.abs(road.bz-road.az),slots=Math.max(1,Math.floor((span-22)/26)),along=plot?.along||(Math.floor(r()*slots)+.5)/slots;
    const offset=kind==='car'?road.w*.5+2.2:Math.max(half,Math.max(fp[0],fp[1])*.5)+road.w*.5+6.5+r()*2+(plot?.row||0)*16;
    return{x:U.lerp(road.ax,road.bx,along)+(horizontal?0:side*offset),z:U.lerp(road.az,road.bz,along)+(horizontal?side*offset:0),rot};
  },
  spacing(size){const g=new Grid(size);return(x,z,gap)=>{if(g.some(x-gap,z-gap,x+gap,z+gap,p=>(p.x-x)**2+(p.z-z)**2<gap*gap))return false;g.add({x,z},x,z);return true}},
  // 기존 원판 대신 높이 격자와 같은 삼각형을 해안선에서 잘라 물이 육지에 걸리지 않게 한다.
  waterGeometry(W,T){
    const pos=[],uv=[],depth=[],idx=[],N=W.RES+1,cell=W.SIZE/W.RES,half=W.HALF,H=W.heights,A=W.waterH,E=W.waterEdge;
    const vertex=(ix,iz)=>{const k=iz*N+ix;return{x:ix*cell-half,y:A[k],z:iz*cell-half,d:A[k]-H[k],e:E[k]}};
    const clip=(input,key)=>{
      const out=[];for(let i=0;i<input.length;i++){const p=input[i],q=input[(i+1)%input.length];if(p[key]>=0)out.push(p);if((p[key]>=0)!==(q[key]>=0)){const t=p[key]/(p[key]-q[key]);out.push({x:U.lerp(p.x,q.x,t),y:U.lerp(p.y,q.y,t),z:U.lerp(p.z,q.z,t),d:U.lerp(p.d,q.d,t),e:U.lerp(p.e,q.e,t)})}}return out;
    };
    const triangle=(a,b,c)=>{
      if(Math.max(a.d,b.d,c.d)<=0||Math.max(a.e,b.e,c.e)<=0)return;
      const out=clip(clip([a,b,c],'d'),'e');
      const start=pos.length/3;for(const p of out){pos.push(p.x,p.y+.008,p.z);uv.push((p.x+3000)/6000,1-(p.z+3000)/6000);depth.push(Math.max(0,p.d))}for(let i=1;i<out.length-1;i++)idx.push(start,start+i,start+i+1);
    };
    for(let z=0;z<W.RES;z++)for(let x=0;x<W.RES;x++){const k=z*N+x;if(Math.max(A[k],A[k+1],A[k+N],A[k+N+1])<=.03)continue;const a=vertex(x,z),b=vertex(x,z+1),c=vertex(x+1,z+1),d=vertex(x+1,z);triangle(a,b,d);triangle(b,c,d)}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('waterDepth',new T.Float32BufferAttribute(depth,1));geo.setIndex(idx);geo.computeVertexNormals();geo.computeBoundingSphere();return geo;
  }
};
})();
