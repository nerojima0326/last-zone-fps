// v108 실제 병합 메시의 부품 몸체에서 뒤쪽 받침까지의 틈을 측정한다.
module.exports=function(){
 window.measureCabinMounts=v=>{
  const T=THREE,c=v.cabin,t=c.template,g=t.staticGeo,pos=g.attributes.position,body=c.root.children.find(o=>o.geometry===g),ray=new T.Raycaster(),meshes=[],sides=new Map(),rows=[];
  v.mesh.updateMatrixWorld(true);
  v.mesh.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;if([c.faces,c.needle,c.rpmNeedle,c.auxNeedles,c.lamps,c.wheel].includes(o))return;const materials=[].concat(o.material);if(materials.every(m=>m.transparent&&m.opacity<.9))return;meshes.push(o);for(const m of materials){if(!sides.has(m))sides.set(m,m.side);m.side=T.DoubleSide;}});
  try{for(const mount of t.mounts||[]){
   const bounds=new T.Box3(),point=new T.Vector3();for(let i=mount.core[0]*3;i<mount.core[1]*3;i++)bounds.expandByPoint(point.fromBufferAttribute(pos,g.index?g.index.getX(i):i));
   const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),samples=[];
   for(const ox of[-.28,0,.28])for(const oy of[-.28,0,.28]){
    const origin=new T.Vector3(center.x+size.x*ox,center.y+size.y*oy,bounds.max.z+.003).applyMatrix4(v.mesh.matrixWorld),back=origin.clone().add(new T.Vector3(0,0,-1).transformDirection(v.mesh.matrixWorld));ray.set(origin,back.sub(origin).normalize());
    const hits=ray.intersectObjects(meshes,false).filter(h=>h.object!==body||h.faceIndex<mount.range[0]||h.faceIndex>=mount.range[1]),hit=hits[0],gap=hit?hit.distance-.003-size.z:Infinity;
    samples.push({ox,oy,gapMm:Number.isFinite(gap)?gap*1000:null,supported:!!hit&&gap<=.002,receiver:hit?.object.material.name||null});
   }rows.push({name:mount.name,bounds:[bounds.min.toArray(),bounds.max.toArray()],samples});
  }}finally{for(const[m,side]of sides)m.side=side;}return rows;
 };
};
