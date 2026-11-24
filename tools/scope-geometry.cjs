// 레일 높이 표식과 무관하게 실제 삼각형의 연결성과 광학 통로를 검사한다.
module.exports=function scopeGeometry(T,model,eye,magnified=false){
 const V=T.Vector3,cell=.001,triangles=[],opaque=[],bounds=new T.Box3(),v=new V();model.updateMatrixWorld(true);
 model.traverse(o=>{if(!o.isMesh||o.userData.lzReticle||/glass/i.test(o.material?.name||'')||o.material?.transparent)return;
  const g=o.geometry,a=g.attributes.position,ix=g.index,mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.name=o.name;mesh.matrixAutoUpdate=false;mesh.matrix.copy(o.matrixWorld);mesh.matrixWorld.copy(o.matrixWorld);opaque.push(mesh);
  for(let i=0;i<(ix?.count||a.count);i+=3){const p=[];for(let k=0;k<3;k++){o.getVertexPosition(ix?ix.getX(i+k):i+k,v).applyMatrix4(o.matrixWorld);p.push(v.clone());bounds.expandByPoint(v)}triangles.push(new T.Triangle(...p))}
 });
 const ray=new T.Raycaster(new V(eye[0],eye[1],bounds.max.z+.02),new V(0,0,-1),0,magnified?bounds.max.z+.02-(eye[2]-.02):bounds.max.z-bounds.min.z+.04),hits=ray.intersectObjects(opaque,false),blockers=hits.map(h=>({name:h.object.name,z:h.point.z,normal:h.face.normal.toArray(),face:h.faceIndex}));
 for(const mesh of opaque)mesh.material.dispose();
 const origin=bounds.min.clone().addScalar(-cell),size=bounds.getSize(new V()).addScalar(2*cell),nx=Math.ceil(size.x/cell),ny=Math.ceil(size.y/cell),nz=Math.ceil(size.z/cell),stride=nx*ny,n=nx*ny*nz,grid=new Uint8Array(n),visited=new Uint8Array(n),queue=new Int32Array(n),cube=new T.Box3(),lo=new V(),hi=new V();
 for(const tri of triangles){lo.copy(tri.a).min(tri.b).min(tri.c).sub(origin).divideScalar(cell).floor();hi.copy(tri.a).max(tri.b).max(tri.c).sub(origin).divideScalar(cell).floor();
  for(let z=Math.max(0,lo.z);z<=Math.min(nz-1,hi.z);z++)for(let y=Math.max(0,lo.y);y<=Math.min(ny-1,hi.y);y++)for(let x=Math.max(0,lo.x);x<=Math.min(nx-1,hi.x);x++){
   const i=x+y*nx+z*stride;if(grid[i])continue;cube.min.set(x,y,z).multiplyScalar(cell).add(origin);cube.max.copy(cube.min).addScalar(cell);if(cube.intersectsTriangle(tri))grid[i]=1;
  }
 }
 let head=0,tail=0,total=0,reached=0;const roof=eye[1]-.014;
 for(let z=0;z<nz;z++)for(let y=0;y<Math.min(ny,4);y++)for(let x=0;x<nx;x++){const i=x+y*nx+z*stride;if(grid[i]&&!visited[i]){visited[i]=1;queue[tail++]=i}}
 while(head<tail){const i=queue[head++],z=Math.floor(i/stride),rem=i-z*stride,y=Math.floor(rem/nx),x=rem-y*nx;
  for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const a=x+dx,b=y+dy,c=z+dz;if(a<0||a>=nx||b<0||b>=ny||c<0||c>=nz)continue;const j=a+b*nx+c*stride;if(grid[j]&&!visited[j]){visited[j]=1;queue[tail++]=j}
  }
 }
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)if(origin.y+(y+.5)*cell>roof)for(let x=0;x<nx;x++){const i=x+y*nx+z*stride;if(grid[i]){total++;if(visited[i])reached++}}
 return{opticalCheck:magnified?'접안부 20mm':'전방 투과',cellMM:cell*1000,triangles:triangles.length,housingVoxels:total,connectedVoxels:reached,connectedRatio:total?reached/total:0,blockers};
};
