// 부착물 좌표는 미터·전방 -Z로 통일한다. 총 표면 측정은 장착 프로필을 만들 때만 수행한다.
(function(){
'use strict';
const G=window.G,T=window.THREE,V=T.Vector3,M=T.Matrix4;
const metal=new T.MeshStandardMaterial({name:'부착 레일',color:0x333c3f,metalness:.6,roughness:.46});
const opticMetal=new T.MeshStandardMaterial({name:'스코프 체결부',color:0x151b1e,metalness:.6,roughness:.5});
const rayMat=new T.MeshBasicMaterial({side:T.DoubleSide}),reticleMat=new T.MeshBasicMaterial({color:0xff3423,depthWrite:false,toneMapped:false});
const dotGeo=new T.CircleGeometry(.00065,16),ringGeo=new T.RingGeometry(.0037,.00395,32),railCache=new Map();
const vec=p=>p?.isVector3?p.clone():new V(...(p||[0,0,0]));
function median(a,fallback){a.sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:fallback}
function rail(w,h,l,material=metal){
 const key=[w,h,l].map(v=>v.toFixed(4)).join(',');if(!railCache.has(key)){
  const gs=[new T.BoxGeometry(w,h,l).translate(0,h/2,0)];
  for(let z=-l/2+.004;z<l/2;z+=.01)gs.push(new T.BoxGeometry(w+.003,.0015,.003).translate(0,h-.0005,z));
  const g=T.mergeGeometries(gs,false);for(const x of gs)x.dispose();railCache.set(key,g);
 }
 return new T.Mesh(railCache.get(key),material);
}
function place(obj,matrix){obj.applyMatrix4(matrix);return obj}
function visible(mesh,root){for(let p=mesh;p;p=p.parent){if(!p.visible)return false;if(p===root)break}return true}
const F=G.AttachmentMounts={
 nativeFrame:new M().makeRotationY(Math.PI).scale(new V(.01,.01,.01)),
 measure(roots,fromWorld,hints,def){
  const meshes=[],seen=new Set(),p=new V(),bounds=new T.Box3();
  for(const root of roots)if(root)root.traverse(o=>{
   if(!o.isMesh||seen.has(o)||!visible(o,root)||o.userData.lzAttachment||/flash|sight|magazine|^Mag\d|bullet|cartridge/i.test(o.name))return;seen.add(o);
   for(let p=o;p;p=p.parent){if(p.userData.lzFoldSight)return;if(p===root)break}
   o.updateWorldMatrix(true,false);if(o.skeleton)o.skeleton.update();
   const a=o.geometry.attributes.position,positions=new Float32Array(a.count*3),xform=fromWorld.clone().multiply(o.matrixWorld);
   for(let i=0;i<a.count;i++){o.getVertexPosition(i,p).applyMatrix4(xform);p.toArray(positions,i*3);bounds.expandByPoint(p)}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));if(o.geometry.index)g.setIndex(o.geometry.index.clone());g.computeBoundingSphere();
   const mesh=new T.Mesh(g,rayMat);mesh.updateMatrixWorld();meshes.push(mesh);
  });
  const cast=(origin,direction)=>{const r=new T.Raycaster(origin,direction,0,3);return r.intersectObjects(meshes,false).map(h=>h.point)};
  const muzzle=vec(hints.muzzle),center=muzzle.x,railHint=vec(hints.rail),fore=vec(hints.under),sideHint=vec(hints.side||hints.under);
  const topAt=(z,x=center)=>cast(new V(x,Math.max(bounds.max.y+.1,railHint.y+.1),z),new V(0,-1,0)).filter(p=>p.y<railHint.y+.035)[0];
  const tops=[];for(const z of [-.025,-.012,0,.012,.025]){const p=topAt(railHint.z+z);if(p)tops.push(p.y)}
  const railPoint=new V(center,median(tops,railHint.y),railHint.z);
  // 3개 이상의 접점을 확보하고, 짧은 권총 슬라이드에서는 받침 길이를 제한한다.
  const railHeights=[];for(let i=-15;i<=15;i++){const z=railPoint.z+i*.008,p=topAt(z);if(p&&Math.abs(p.y-railPoint.y)<.012)railHeights.push({z,y:p.y})}
  const topSamples=railHeights.map(p=>p.z),railSpan=topSamples.length?[Math.min(...topSamples),Math.max(...topSamples)]:[railPoint.z-.03,railPoint.z+.03];
  const opticFits={};for(const [id,spec]of Object.entries(G.AttachmentModels.specs))if(spec.kind==='optic'){
   const l=Math.min(spec.foot[1],Math.max(.03,railSpan[1]-railSpan[0])),z=T.MathUtils.clamp(railPoint.z,railSpan[0]+l/2,Math.max(railSpan[0]+l/2,railSpan[1]-l/2)),contacts=[];
   for(const dz of [-l*.34,l*.34]){
    const half=Math.min(.010,spec.foot[0]*.32),hits=[center,center-half,center+half].map(x=>topAt(z+dz,x)).filter(Boolean).sort((a,b)=>b.y-a.y);
    contacts.push(hits[0]?.clone()||new V(center,railPoint.y,z+dz));
   }
   // 레일 홈의 중앙은 비어 있을 수 있다. 클램프 폭 안의 양쪽 접점을 실제 삼각형에서 읽는다.
   const top=Math.max(topAt(z)?.y??railPoint.y,...contacts.map(p=>p.y));opticFits[id]={l,z,top,contacts:contacts.map(p=>p.toArray())};
  }
  const underHits=cast(new V(center,bounds.min.y-.1,fore.z),new V(0,1,0));
  const under=new V(center,underHits[0]?.y??fore.y,fore.z);
  const sideZ=def.cls==='pistol'?muzzle.z+.04:fore.z,localTop=topAt(sideZ);
  const sideY=localTop?(under.y+localTop.y)/2:muzzle.y-.015;
  let sideHits=def.cls==='pistol'?cast(new V(center,bounds.min.y-.1,sideZ),new V(0,1,0)):
   cast(new V(bounds.max.x+.1,sideY,sideZ),new V(-1,0,0));
  if(!sideHits.length&&def.cls!=='pistol')for(const dy of [-.01,.01,-.02,.02]){sideHits=cast(new V(bounds.max.x+.1,sideY+dy,sideZ),new V(-1,0,0));if(sideHits.length)break}
  const side=sideHits[0]?.clone()||new V(Math.max(sideHint.x,center+.025),sideY,sideZ);
  const nearTip=[];let front=Infinity;
  for(const mesh of meshes){const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){
   const x=a.getX(i),y=a.getY(i),z=a.getZ(i);if(Math.abs(x-center)<.035&&Math.abs(y-muzzle.y)<.08&&Math.abs(z-muzzle.z)<.095){nearTip.push([x,y,z]);front=Math.min(front,z)}
  }}
  const tipRays=()=>{const hits=[];for(const radius of [.0015,.003,.006,.009,.012,.0135,.016,.018])for(let i=0;i<8;i++){
   const a=i*Math.PI/4,h=cast(new V(muzzle.x+Math.sin(a)*radius,muzzle.y+Math.cos(a)*radius,Math.min(muzzle.z-.1,front-.02)),new V(0,0,1)).find(p=>p.z<=front+.014);if(h)hits.push(h.z)
  }return hits};
  let tips=tipRays(),muzzleProbe=null;
  if(!tips.length&&nearTip.length){
   // 원본 팩의 총구 표식이 가늠쇠에 찍힌 경우, 맨 앞 단면의 넓은 총열 띠로 중심을 다시 구한다.
   const bands=new Map();for(const [x,y,z]of nearTip)if(z<front+.012){const k=Math.round(y/.003),b=bands.get(k)||{min:Infinity,max:-Infinity};b.min=Math.min(b.min,x);b.max=Math.max(b.max,x);bands.set(k,b)}
   const ranked=[...bands].map(([k,b])=>({y:k*.003,x:(b.min+b.max)/2,score:(b.max-b.min)*(1-Math.min(.8,Math.abs(k*.003-muzzle.y)/.12))})).sort((a,b)=>b.score-a.score);
   if(ranked.length){muzzle.x=ranked[0].x;muzzle.y=ranked[0].y;tips=tipRays()}
   if(!tips.length)muzzleProbe={front,hint:vec(hints.muzzle).toArray(),ranked:ranked.slice(0,8),tip:nearTip.filter(p=>p[2]<front+.02)};
  }
  muzzle.z=(tips.length?Math.min(...tips):muzzle.z)+.002;
  const stockZ=Math.min(bounds.max.z-.045,railPoint.z+.23),stockHits=[];
  for(const z of [stockZ,stockZ-.025,stockZ+.025])for(const x of [center,center-.012,center+.012,center-.026,center+.026,center-.035,center+.035]){
   const h=cast(new V(x,bounds.max.y+.1,z),new V(0,-1,0))[0];if(h)stockHits.push(h)
  }
  if(!stockHits.length&&def.cls==='rifle')for(const z of [stockZ,stockZ-.02,stockZ+.02])for(let i=-10;i<=10;i++){
   const h=cast(new V(center+i*.003,bounds.max.y+.1,z),new V(0,-1,0))[0];if(h)stockHits.push(h)
  }
  const stock=stockHits.length?new V(center,median(stockHits.map(p=>p.y),railPoint.y-.04),median(stockHits.map(p=>p.z),stockZ)):new V(center,railPoint.y-.04,stockZ);
  const profile={id:def.key,rail:railPoint,railSpan,railHeights,opticFits,under,side,muzzle,stock,bounds,muzzleProbe,contacts:{rail:tops.length,under:underHits.length,side:sideHits.length,muzzle:tips.length,stock:stockHits.length}};
  for(const mesh of meshes)mesh.geometry.dispose();return profile;
 },
 optic(profile,scope,def){
  const id=scope==='reddot'&&def.cls==='pistol'?'micro':scope,asset=G.Attachments.make(id,1);if(!asset)return null;
  const root=new T.Group();root.name='조준경_'+id;root.userData.keep=true;root.userData.lzAttachment=true;
  const specs=G.AttachmentModels.specs[id],foot=specs.foot,base=profile.rail.clone();
  const fit=profile.opticFits[id],l=fit?.l??Math.min(foot[1],Math.max(.03,profile.railSpan[1]-profile.railSpan[0]));
  base.z=T.MathUtils.clamp(base.z,profile.railSpan[0]+l/2,Math.max(profile.railSpan[0]+l/2,profile.railSpan[1]-l/2));
  const heights=profile.railHeights||[],height=z=>heights.reduce((best,p)=>Math.abs(p.z-z)<Math.abs(best.z-z)?p:best,{z:Infinity,y:profile.rail.y}).y;
  if(fit)base.z=fit.z;
  const top=fit?.top??Math.max(profile.rail.y,...heights.filter(p=>Math.abs(p.z-base.z)<=l/2).map(p=>p.y));base.y=top+.003;
  const saddle=rail(foot[0]-.003,.004,l,opticMetal);saddle.position.copy(base).add(new V(0,-.004,0));root.add(saddle);
  const contacts=fit?.contacts||[-l*.34,l*.34].map(dz=>[base.x,height(base.z+dz),base.z+dz]);for(const [,y,z] of contacts){
   const h=Math.max(.001,top-y),p=new V(base.x,y-.001,z);
   if(h>.002){const leg=rail(foot[0]-.005,h,.009,opticMetal);leg.position.copy(p);root.add(leg)}
  }
  asset.position.copy(base);root.add(asset);
  const eye=vec(specs.eye).add(base),dot=new T.Mesh(dotGeo,reticleMat);dot.name='조준경_광축';dot.userData.lzReticle=true;dot.position.copy(eye);dot.renderOrder=20;
  // 배율 조준경의 중앙 표식은 기존 스코프 HUD가 담당한다.
  if(scope==='reddot'||scope==='holo'||scope==='x2')root.add(dot);
  if(scope==='holo'){const ring=new T.Mesh(ringGeo,reticleMat);ring.position.copy(eye);ring.renderOrder=20;root.add(ring)}
  root.userData.eye=eye.toArray();root.userData.seat=base.toArray();root.userData.contacts=contacts;root.userData.asset=id;return{root,eye};
 },
 accessories(profile,parts,def){
  const root=new T.Group();root.name='총기_부착물';root.userData.keep=true;root.userData.lzAttachment=true;
  const add=(id,pos,rotation)=>{const o=G.Attachments.make(id,1);if(!o)return null;o.position.copy(pos);if(rotation)o.rotation.set(...rotation);root.add(o);return o};
  if(parts.muzzle)add(parts.muzzle==='suppressor'&&def.cls==='pistol'?'suppressor_pistol':parts.muzzle,profile.muzzle);
  let support=null;
  if(['grip','angled','light','half'].includes(parts.under)&&def.cls==='rifle'){
   const seat=profile.under.clone(),r=rail(.023,.003,parts.under==='angled'?.069:.036);r.rotation.z=Math.PI;r.position.copy(seat).add(new V(0,.001,0));root.add(r);
   seat.y-=.002;add(parts.under,seat);
   support=seat.clone().add(new V(-.014,parts.under==='angled'?-.020:parts.under==='half'?-.025:-.037,parts.under==='angled'?.005:0));
  }
  if(parts.side==='laser'){
   const pistol=def.cls==='pistol',seat=profile.side.clone(),r=rail(.023,.003,.038);r.position.copy(seat);r.rotation.z=pistol?Math.PI:-Math.PI/2;root.add(r);
   seat.add(pistol?new V(0,-.003,0):new V(.003,0,0));add('laser',seat,[0,0,pistol?Math.PI:-Math.PI/2]);
  }
  if(parts.stock&&def.cls==='rifle'){
   const o=add(parts.stock,profile.stock.clone().add(new V(0,-.001,0)));if(o){const width=profile.bounds.max.x-profile.bounds.min.x;o.scale.x=T.MathUtils.clamp(width/.041,.8,1.25)}
  }
  root.userData.support=support?.toArray();return{root,support};
 },
 magazine(contact,type){
  if(!contact||!type)return null;const b=contact.targetBox||contact.box;if(b.isEmpty())return null;
  if(contact.toCanonical){
   const box=b.clone().applyMatrix4(contact.toCanonical),size=box.getSize(new V()),center=box.getCenter(new V()),o=G.Attachments.make('mag_'+type,1);if(!o)return null;
   o.scale.set(T.MathUtils.clamp(size.x/.032,.65,2.5),1,T.MathUtils.clamp(size.z/.055,.6,1.6));o.position.set(center.x,box.min.y+.001,center.z);
   o.applyMatrix4(contact.toCanonical.clone().invert());o.userData.lzAttachment=true;contact.bone.add(o);return o;
  }
  const bone=contact.bone;bone.updateWorldMatrix(true,false);const scale=bone.getWorldScale(new V());
  const o=G.Attachments.make('mag_'+type,1);if(!o)return null;
  const size=b.getSize(new V()),center=b.getCenter(new V());
  o.scale.set(Math.max(.45,size.x/.032),1/Math.max(.0001,Math.abs(scale.y)),Math.max(.45,size.z/.055));
  o.position.set(center.x,b.min.y+.001/Math.max(.0001,Math.abs(scale.y)),center.z);o.userData.lzAttachment=true;bone.add(o);return o;
 },
 attach(parent,obj,matrix){parent.add(place(obj,matrix));return obj},
 clear(owner,key='attachmentExtras'){for(const o of owner[key]||[])o.removeFromParent();owner[key]=[]},
 // 미리보기에는 보이는 총 메시만 굽는다. 숨겨진 예비 탄창이 화면 크기를 바꾸지 않는다.
 snapshot(roots,fromWorld){
  const root=new T.Group(),seen=new Set(),p=new V();root.userData.ownedGeometry=true;
  for(const source of roots)if(source)source.traverse(o=>{
   if(!o.isMesh||seen.has(o)||!visible(o,source)||/flash/i.test(o.name))return;seen.add(o);o.updateWorldMatrix(true,false);if(o.skeleton)o.skeleton.update();
   const g=o.geometry.clone(),count=g.attributes.position.count,xform=fromWorld.clone().multiply(o.matrixWorld);
   // 양자화된 정수 속성에 월드 좌표·법선을 쓰면 절삭된다. 미리보기 변형은 실수 버퍼에 굽는다.
   g.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));g.deleteAttribute('normal');g.deleteAttribute('tangent');g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');
   for(let i=0;i<count;i++){o.getVertexPosition(i,p);g.attributes.position.setXYZ(i,p.x,p.y,p.z)}
   g.applyMatrix4(xform);g.computeVertexNormals();const m=new T.Mesh(g,o.material);m.name=o.name;root.add(m);
  });return root;
 },
 nativeSnapshot(model){
  const name=model.name,part=model.actions[name],time=model.mixer.time,start=part?.start||0,duration=part?.duration||((part?.end||1)-start);
  model.sample('Idle',0);model.pivot.updateWorldMatrix(true,true);const meshes=[],spareBone=model.spare&&model.model.getObjectByName(model.spare.name+'_j');
  model.model.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh)return;for(let p=o;p&&p!==model.model;p=p.parent)if(!p.visible||p===model.spare||p===spareBone)return;meshes.push(o)});
  const result=this.snapshot(meshes,model.pivot.matrixWorld.clone().invert());if(part)model.sample(name,(time-start)/duration);return result;
 },
 disposeSnapshot(root){if(root?.userData.ownedGeometry)root.traverse(o=>o.geometry?.dispose())}
};
})();
