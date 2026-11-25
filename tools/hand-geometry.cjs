// Independent measurements of the actual skinned hands against visible weapon triangles.
module.exports = async function installHandGeometry() {
 const {MeshBVH}=await import('three-mesh-bvh');
 const T=THREE,V=T.Vector3;
 const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true};
 const hands = mesh => {
  const bones=mesh.skeleton.bones,set=new Set(bones),size=new Map();
  const count=b=>{if(size.has(b))return size.get(b);let n=0;for(const c of b.children)if(set.has(c))n+=1+count(c);size.set(b,n);return n};
  const named=bones.filter(b=>/^(?:LeftHand|RightHand|Hand_[LR]|[LR]_wrist|DEF-hand[LR])(?:_\d+)?$/i.test(b.name));const candidates=named.length?named:bones.filter(b=>/hand|wrist/i.test(b.name)&&b.children.filter(c=>set.has(c)&&count(c)>=2).length>=4);
  const below=(a,b)=>{for(let p=b.parent;p;p=p.parent)if(p===a)return true;return false};
  const roots=candidates.filter(r=>!candidates.some(x=>x!==r&&below(r,x)));
  const map=new Map();
  for(const root of roots){const side=/left|_L(?:_|$)|^L_|L(?:_\d+)?$/i.test(root.name)?'L':/right|_R(?:_|$)|^R_/i.test(root.name)?'R':root.getWorldPosition(new V()).x<0?'L':'R';root.traverse(b=>{if(b.isBone)map.set(b,{side,kind:b===root||/palm/i.test(b.name)?'palm':'finger',root})})}
  return {roots,map};
 };
 const selected = id => {
  if(G.Knives?.is(id)) {
   const root=G.VM.models[id].root,knife=G.VM.models[id].knife,gun=[],arms=[];
   root.traverse(o=>{if(!o.isMesh||!visible(o))return;let under=false;for(let p=o;p;p=p.parent)if(p===knife)under=true;if(under)gun.push(o);else if(o.isSkinnedMesh)arms.push(o)});
   return {root,gun,arms};
  }
  const P=G.AssetVM.pack(id),native=id==='ar7'?G.M4Viewmodel:id==='g18'?G.G17Pilot:null;
  const root=P?.pivot||(native?.ready?native.pivot:G.VM.models[id].root),gun=[],arms=[];
  const original=new Set(P?.gunMeshes||[]),swap=P?.swaps[id];
  root.traverse(o=>{if(!o.isMesh||!visible(o))return;
   if(P){let isGun=original.has(o);for(let p=o;p&&!isGun;p=p.parent)if(swap?.groups.includes(p))isGun=true;if(isGun)gun.push(o);else if(o.isSkinnedMesh)arms.push(o)}
   else if(native?.ready){if(o.isSkinnedMesh&&[].concat(o.material).some(m=>/hand|arm|sleeve|glove/i.test(m.name)))arms.push(o);else if(!/flash|light|optic|scope/i.test(o.name)&&o!==native.flash)gun.push(o)}
   else {let under=false;for(let p=o;p;p=p.parent)if(p===G.VM.models[id].gun)under=true;if(under)gun.push(o);else if(o.isSkinnedMesh)arms.push(o)}
  });
  return {root,gun,arms};
 };
 // BVHs contain deformed triangles in metres. Surface intersections work on
 // open asset meshes; ray-parity "inside" tests do not (trigger guards, cuffs).
 const bake=(mesh,space=new T.Matrix4())=>{const g=mesh.geometry.clone(),a=g.attributes.position,p=new V(),matrix=space.clone().multiply(mesh.matrixWorld);mesh.skeleton?.update();for(let i=0;i<a.count;i++){mesh.getVertexPosition(i,p);p.applyMatrix4(matrix);a.setXYZ(i,p.x,p.y,p.z)};for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);g.clearGroups();g.computeBoundingBox();return {mesh,g,bvh:new MeshBVH(g,{maxLeafTris:8,indirect:true}),box:g.boundingBox}};
 // Cancel the shared rigid transform before float32 storage, so edge-contact
 // tolerances cannot change when the camera or recoil parent turns.
 const audit = id => {
  G.vmScene.updateMatrixWorld(true);const S=selected(id),frame=G.Knives?.is(id)?G.VM.models[id].grip:S.root,space=new T.Matrix4().compose(frame.getWorldPosition(new V()),frame.getWorldQuaternion(new T.Quaternion()),new V(1,1,1)).invert(),solids=S.gun.map(mesh=>bake(mesh,space)),result={},worst=[];
  const identity=new T.Matrix4(),line=new T.Line3(),plane=new T.Plane(),projection=new V();
  for(const mesh of S.arms){const {map}=hands(mesh),g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,pos=g.attributes.position;if(!si||!sw)continue;
   const labels=[];
   for(let i=0;i<pos.count;i++){let bw=0,h=null,hw=0,b=null;for(let j=0;j<4;j++){const bone=mesh.skeleton.bones[si.getComponent(i,j)],w=sw.getComponent(i,j),hand=map.get(bone);if(hand)hw+=w;if(w>bw){bw=w;h=hand;b=bone}}
    const cut=g.attributes.restZ?.getX(i)||0,uniform=G.AssetVM.pack(id)?.armCut?.value??99;
    if(!h||hw<.7||cut>uniform)continue;
    const key=h.side+':'+h.kind;labels[i]={key,bone:b.name};
    (result[key]||(result[key]={samples:0,count:0,max:0,span:0,sum:0})).samples++;
   }
   const A=bake(mesh,space),ix=A.g.index;
   for(const B of solids) {
    if(!A.box.intersectsBox(B.box))continue;
    A.bvh.bvhcast(B.bvh,identity,{intersectsTriangles(hand,gun,face){
     const v=[0,1,2].map(j=>labels[ix?ix.getX(A.bvh.resolveTriangleIndex(face)*3+j):A.bvh.resolveTriangleIndex(face)*3+j]);
     if(v.some(x=>!x)||!hand.intersectsTriangle(gun,line,true)||line.distance()<=.0005)return false;
     // Only count material crossing a gun face. Coplanar contact and a glove
     // wrapped around a hollow trigger guard are not solid penetration.
     gun.getPlane(plane);let depth=0;
     for(const p of [hand.a,hand.b,hand.c]){const d=plane.distanceToPoint(p);plane.projectPoint(p,projection);if(d<-.0005&&gun.containsPoint(projection)){const nearest=B.bvh.closestPointToPoint(p,{},0,.1);if(nearest)depth=Math.max(depth,Math.min(-d,nearest.distance))}}
     if(depth>.0005){const label=v[0],row=result[label.key];row.count++;row.sum+=depth*depth;row.span=Math.max(row.span,line.distance());row.max=Math.max(row.max,depth);worst.push({region:label.key,bone:label.bone,depth,span:line.distance(),gun:B.mesh.name,point:line.getCenter(new V()).toArray()})}
     return false;
    }});
   }
   A.g.dispose();
  }
  for(const B of solids)B.g.dispose();worst.sort((a,b)=>b.depth-a.depth);
  return {id,gunMeshes:S.gun.length,armMeshes:S.arms.length,result,worst:worst.slice(0,20)};
 };
 const skinSample = id => {
  G.vmScene.updateMatrixWorld(true);
  const S=selected(id),P=G.AssetVM.pack(id),native=id==='ar7'?G.M4Viewmodel:id==='g18'?G.G17Pilot:null;
  const gun=P?.gunBone||(native?.ready?native.main:G.VM.models[id].gun),inv=gun.matrixWorld.clone().invert(),scale=gun.getWorldScale(new V());
  const result={};
  for(const mesh of S.arms){const {map}=hands(mesh),g=mesh.geometry,ix=g.attributes.skinIndex,w=g.attributes.skinWeight;if(!ix||!w)continue;mesh.skeleton.update();
   for(let i=0;i<g.attributes.position.count;i+=17){let handWeight=0;for(let j=0;j<4;j++){const b=mesh.skeleton.bones[ix.getComponent(i,j)];if(map.has(b))handWeight+=w.getComponent(i,j);}
    if(handWeight<.999)continue;
    result[mesh.uuid+':'+i]=mesh.getVertexPosition(i,new V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv).multiply(scale).toArray();
   }
  }return result;
 };
 window.HandGeometry={audit,selected,hands,bake,skinSample};return 'Hand geometry ready';
};
