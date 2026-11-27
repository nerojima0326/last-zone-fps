// 차량별 운전석·실내·운전 자세. 기존 캐릭터와 차량 자원을 공유한다.
(function(){
'use strict';
const G=window.G,T=window.THREE,U=G.U,V=T.Vector3;
const p=new V(),hip=new V(),target=new V(),pole=new V(),direction=new V(),bend=new V(),elbow=new V();
const q=new T.Quaternion(),q2=new T.Quaternion(),euler=new T.Euler(),matrix=new T.Matrix4(),normal=new T.Vector3(),a=new V(),b=new V();
const gripSide=new V(),gripForward=new V(),gripNormal=new V(),gripOffset=new V(),gripMatrix=new T.Matrix4(),gripQ=new T.Quaternion();
const profiles={
 porter:{hip:[-.38,.69,-1.19],eye:[-.38,1.40,-1.03],wheel:[-.38,1.02,-1.40],floor:.31,roof:1.72,back:-.80,front:-2.12,width:1.38,dash:1.02},
 e2200:{hip:[-.43,.84,-1.07],eye:[-.43,1.55,-.91],wheel:[-.43,1.11,-1.33],floor:.41,roof:1.86,back:-.80,front:-1.96,width:1.34,dash:1.10},
 izh:{hip:[-.36,.60,.06],eye:[-.36,1.31,.22],wheel:[-.36,.93,-.19],floor:.20,roof:1.55,back:.47,front:-.77,width:1.22,dash:.91},
 fallback:{hip:[-.42,.73,.48],eye:[-.42,1.44,.64],wheel:[-.42,1.04,.23],floor:.36,roof:1.70,back:1.35,front:-.48,width:1.64,dash:1.02}
};
// v107 림 표면의 손바닥 접촉 반지름과 앞면 깊이를 모델·IK가 함께 사용한다.
const wheelSpecs={
 porter:{grip:.235,z:.008,tube:.014,bulge:0,segments:56,pad:[.142,.105],spokes:3},
 e2200:{grip:.219,z:.015,tube:.021,bulge:.10,segments:56,pad:[.158,.118],spokes:3},
 izh:{grip:.219,z:.006,tube:.011,bulge:0,segments:56,pad:[.073,.073],spokes:2},
 fallback:{grip:.219,z:.014,tube:.020,bulge:.08,segments:56,pad:[.155,.112],spokes:3}
};
function finish(g,roughness=.78,metalness=.08){const n=g.attributes.position.count,values=new Float32Array(n*2);for(let i=0;i<n;i++){values[i*2]=roughness;values[i*2+1]=metalness;}g.setAttribute('lzFinish',new T.BufferAttribute(values,2));return g;}
function cabinMaterial(){
 const mat=new T.MeshStandardMaterial({name:'차량 실내',vertexColors:true,roughness:.78,metalness:.08});
 // v107 고무·패드·크롬을 한 메시 안에서 구분해 재질별 그리기 호출을 늘리지 않는다.
 mat.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 lzFinish; varying vec2 vLzFinish;').replace('#include <begin_vertex>','#include <begin_vertex>\nvLzFinish = lzFinish;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vLzFinish;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = vLzFinish.x;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor = vLzFinish.y;');};
 mat.customProgramCacheKey=()=> '차량 실내 표면 v107';return mat;
}
function rounded(w,h,r){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function wheelGeometry(key){
 const s=wheelSpecs[key],parts=[],paint=(g,c,r,m)=>{const out=finish(G.cg(g,c),r,m);parts.push(out);return out;},thickness=s.tube*(1+s.bulge),radius=s.grip-Math.sqrt(thickness*thickness-s.z*s.z);
 const rim=new T.TorusGeometry(radius,s.tube,10,s.segments),pos=rim.attributes.position;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),angle=Math.atan2(y,x),distance=Math.hypot(x,y),gap=a=>Math.atan2(Math.sin(angle-a),Math.cos(angle-a)),scale=1+s.bulge*Math.max(...[.24,.76].map(a=>Math.exp(-((gap(Math.PI*a)/.19)**2))));const radial=radius+(distance-radius)*scale;pos.setXYZ(i,x*radial/distance,y*radial/distance,pos.getZ(i)*scale);}
 rim.computeVertexNormals();paint(rim,key==='izh'?0x302d27:0x242a2b,.88,.02);
 const depth=.032,pad=new T.ExtrudeGeometry(rounded(...s.pad,key==='izh'?.025:.030),{depth,bevelEnabled:true,bevelSize:.005,bevelThickness:.004,bevelSegments:1,curveSegments:3,steps:1}).translate(0,-.012,-depth/2+.016);
 for(const angle of s.spokes===2?[.08,Math.PI-.08]:[.08,Math.PI-.08,-Math.PI/2]){
  const shape=new T.Shape();shape.moveTo(.035,-.029);shape.lineTo(radius-.002,-.022);shape.lineTo(radius-.002,.022);shape.lineTo(.035,.040);shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:.024,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:1,curveSegments:1,steps:1}).translate(0,0,-.012).rotateZ(angle);paint(g,key==='izh'?0xbcc0b7:0x50595c,key==='izh'?.25:.52,key==='izh'?.85:.35);
 }
 paint(pad,key==='izh'?0x41413c:0x303739,.78,.03);
 if(key==='izh')paint(new T.TorusGeometry(.128,.0055,6,40).translate(0,0,.020),0xd4d8d1,.22,.9);
 const stripe=new T.TorusGeometry(radius,s.tube+.0007,6,4,.045).rotateZ(Math.PI/2-.0225);paint(stripe,key==='izh'?0xd8c99e:0xc8b59a,.73,.03);
 const geometry=G.mergeGeo(parts);for(const g of parts)g.dispose();return geometry;
}
const clusterSpecs={
 porter:{radius:.128,spacing:.140,up:.175,forward:.30,scale:.76},
 e2200:{radius:.124,spacing:.136,up:.210,forward:.40,scale:.75},
 izh:{radius:.128,spacing:.140,up:.195,forward:.20,scale:.76},
 fallback:{radius:.142,spacing:.154,up:.170,forward:.23,scale:.76}
};
const instrumentAtlases=new Map();
// v108 큰 속도계·보조 계기·고전 연료계를 차종별 배치로 만든다.
function gaugeLayout(key){
 const s=clusterSpecs[key],max=G.Vehicles?.tuning?.[key]?.dial||120;
 const g=(kind,dx,dy,r,cell)=>({kind,dx,dy,r,cell,font:['fuel','temp'].includes(kind)?132:key==='fallback'?116:108,labelRadius:['fuel','temp'].includes(kind)?158:168,max:kind==='speed'?max:kind==='rpm'?7000:1});
 if(key==='porter')return[g('speed',0,0,.15,[256,0,512]),g('fuel',-.237,-.012,.063,[0,128,256]),g('temp',.237,-.012,.063,[768,128,256])];
 if(key==='izh')return[g('speed',-.095,0,.145,[0,0,512]),g('fuel',.16,-.015,.093,[512,0,512])];
 return[g('speed',-s.spacing,0,s.radius,[0,0,512]),g('rpm',s.spacing,0,s.radius,[512,0,512])];
}
function instrumentAtlas(key,gauges){
 if(instrumentAtlases.has(key))return instrumentAtlases.get(key);
 const classic=key==='izh',canvas=document.createElement('canvas');canvas.width=G.TextureQuality?.imageLimit===512?512:1024;canvas.height=canvas.width/2;const c=canvas.getContext('2d'),ink=classic?'#f5e6c5':'#e9f6f6';c.scale(canvas.width/1024,canvas.height/512);c.fillStyle=classic?'#24201a':'#101b20';c.fillRect(0,0,1024,512);
 for(const gauge of gauges){
  const [x,y,size]=gauge.cell,aux=['fuel','temp'].includes(gauge.kind),major=aux?2:gauge.kind==='rpm'?7:gauge.max/20,divisions=major*5;c.save();c.translate(x,y);c.scale(size/512,size/512);c.textAlign='center';c.textBaseline='middle';
  for(let i=0;i<=divisions;i++){const a=Math.PI*.75-i/divisions*Math.PI*1.5,big=i%5===0;c.strokeStyle=gauge.kind==='rpm'&&i>=30||gauge.kind==='temp'&&i>8?'#ed8c6c':ink;c.lineWidth=big?6:3;c.beginPath();c.moveTo(256-Math.sin(a)*(big?203:222),256-Math.cos(a)*(big?203:222));c.lineTo(256-Math.sin(a)*239,256-Math.cos(a)*239);c.stroke();}
  c.font='bold '+gauge.font+'px '+(classic?'Georgia, serif':'Arial, sans-serif');c.fillStyle=ink;
  // v108 본체는 작게, 숫자는 세로 크기를 유지하고 가로 폭만 줄여 눈금 사이를 확보한다.
  for(let i=0;i<=major;i++){const a=Math.PI*.75-i/major*Math.PI*1.5,label=gauge.kind==='fuel'?['E','½','F'][i]:gauge.kind==='temp'?['C','90','H'][i]:String(gauge.kind==='rpm'?i:i*20);c.save();c.translate(256-Math.sin(a)*gauge.labelRadius,256-Math.cos(a)*gauge.labelRadius);c.scale(.80,1);c.fillText(label,0,0);c.restore();}
  c.font='bold 56px sans-serif';c.fillText({speed:'km/h',rpm:'×1000',fuel:'연료',temp:'수온'}[gauge.kind],256,316);
  c.font='bold 30px sans-serif';c.fillStyle=classic?'#b9a380':'#9bb5b8';if(gauge.kind==='speed')c.fillText('엔진 · 드리프트',256,447);c.restore();
 }
 const texture=new T.CanvasTexture(canvas);texture.name='차종별 계기판 '+key;texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.anisotropy=Math.min(16,G.renderer.capabilities.getMaxAnisotropy());texture.userData.canvasDraws=1;texture.userData.labelFont=gauges[0].font;instrumentAtlases.set(key,texture);return texture;
}
function luminousMaterial(name,intensity){
 const mat=new T.MeshStandardMaterial({name,vertexColors:true,roughness:.7,metalness:.05,emissive:0xffffff,emissiveIntensity:intensity});
 mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor;\n#endif');};mat.customProgramCacheKey=()=> '계기판 발광색 v108';return mat;
}
function clusterGeometry(key,parts){
 const s=profiles[key],spec=clusterSpecs[key],x=s.hip[0]+.02,y=s.dash+spec.up,z=s.front+spec.forward,gauges=gaugeLayout(key),faces=[];
 // v108 계기 하우징·차양·테·숫자·바늘을 같은 중심과 비율로 줄인다.
 const scale=spec.scale,resize=g=>g.translate(-x,-y,-z).scale(scale,scale,scale).translate(x,y,z);
 const add=(g,color,roughness,metalness)=>parts.push(finish(G.cg(resize(g),color),roughness,metalness));
 const width=key==='porter'?.65:key==='izh'?.565:spec.spacing*2+spec.radius*2+.045,height=.33;
 add(new T.ExtrudeGeometry(rounded(width,height,key==='porter'?.020:.10),{depth:.11,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1,curveSegments:4,steps:1}).translate(x,y,z-.13),key==='izh'?0x39362d:0x202a2d,.86,.02);
 add(new T.BoxGeometry(width+.025,.025,.16).translate(x,y+height/2+.008,z-.062),key==='izh'?0x514c40:0x293235,.85,.04);
 for(const gi of gauges){
  gi.x=x+gi.dx;gi.y=y+gi.dy;gi.z=z;
  add(new T.TorusGeometry(gi.r,.007,6,40).translate(gi.x,gi.y,z-.004),key==='izh'?0xd1c8b2:0x4a6068,key==='izh'?.22:.55,key==='izh'?.88:.25);
  const face=new T.CircleGeometry(gi.r-.004,48),uv=face.attributes.uv;for(let j=0;j<uv.count;j++){uv.setXY(j,(gi.cell[0]+uv.getX(j)*gi.cell[2])/1024,1-(gi.cell[1]+(1-uv.getY(j))*gi.cell[2])/512);}face.translate(gi.x,gi.y,z);faces.push(resize(face));gi.x=x+gi.dx*scale;gi.y=y+gi.dy*scale;gi.r*=scale;gi.faceRadius=(gi.r/scale-.004)*scale;
 }
 const faceGeo=T.mergeGeometries(faces,false);for(const g of faces)g.dispose();const r=gauges[0].r,shape=new T.Shape();shape.moveTo(-.004,-.019);shape.lineTo(.004,-.019);shape.lineTo(.005,.022);shape.lineTo(.001,r*.79);shape.lineTo(-.001,r*.79);shape.lineTo(-.005,.022);shape.closePath();
 const blade=G.cg(new T.ShapeGeometry(shape),key==='izh'?0xe5c99e:0xffa174),cap=G.cg(new T.CircleGeometry(.012,16).translate(0,0,.001),0x324650),needleGeo=G.mergeGeo([blade,cap]);blade.dispose();cap.dispose();
 const atlas=instrumentAtlas(key,gauges),dialMaterial=new T.MeshStandardMaterial({name:'차종별 숫자 '+key,map:atlas,emissiveMap:atlas,emissive:0xffffff,emissiveIntensity:.25,roughness:1,metalness:0});
 const lampX=key==='izh'?x+.16:x,lampY=key==='e2200'?y+.08:key==='izh'?y+.115:y-.060,lamps=[[-.018,0],[.018,0]].map(([dx,dy])=>[x+(lampX+dx-x)*scale,y+(lampY+dy-y)*scale,z+.009]);
 if(key==='e2200')add(new T.BoxGeometry(.075,.028,.012).translate(lampX,lampY,z+.002),0x101719,.85,.02);
 return{faceGeo,needleGeo,atlas,dialMaterial,gauges,lamps,cluster:{x,y,z,radius:r,scale,spacing:Math.abs(gauges[0].dx)*scale,maxKph:gauges[0].max,maxRpm:7000}};
}
const C=G.VehicleCabin={
 profiles,wheelSpecs,templates:new Map(),glass:null,repairs:new WeakMap(),
 profile(v){return profiles[v.cabinKind||v.kind]||profiles.fallback;},
 // 원본의 유리 재질만 바꾼다. 불투명한 차체는 그대로 둔다.
 glazing(v){
  const key=v.cabinKind||v.kind;
  v.mesh.updateMatrixWorld(true);
  if(key==='izh')this.openWindows(v,v.mesh.getObjectByName('body'));
  if(key==='e2200')v.mesh.getObjectByName('body')?.traverse(o=>{if(o.isMesh&&o.material.name==='Interior')this.removeWheel(v,o);});
  v.mesh.traverse(o=>{if(!o.isMesh)return;
   const swap=m=>{if(!(key==='porter'&&m.name==='Material_87'||key==='e2200'&&m.name==='Glass'))return m;
    this.glass||=new Map();if(!this.glass.has(key))this.glass.set(key,new T.MeshStandardMaterial({name:'차량 창유리',color:0x9eb9c2,transparent:true,opacity:.14,roughness:.12,metalness:.12,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,envMapIntensity:.8}));return this.glass.get(key);};
   o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material);
   if((Array.isArray(o.material)?o.material:[o.material]).some(m=>m.name==='차량 창유리'))o.castShadow=false;
  });
 },
 // 양자화 원본의 UV·법선·흙먼지 속성을 보존하며 창문 영역만 잘라 낸다. 결과는 차종 전체가 공유한다.
 geometryParts(v,mesh,regions,remove){
  const g=mesh.geometry;if(this.repairs.has(g))return this.repairs.get(g);
  matrix.copy(v.mesh.matrixWorld).invert().multiply(mesh.matrixWorld);
  const names=Object.keys(g.attributes),attrs=names.map(n=>g.attributes[n]),offsets=[],stride=attrs.reduce((n,a)=>{offsets.push(n);return n+a.itemSize;},0),body=[],glass=[];
  const read=index=>{const values=[];for(const attr of attrs)for(let k=0;k<attr.itemSize;k++)values.push(attr[['getX','getY','getZ','getW'][k]](index));return{values,p:new V().fromBufferAttribute(g.attributes.position,index).applyMatrix4(matrix)};};
  const interpolate=(x,y,t)=>({values:x.values.map((n,k)=>U.lerp(n,y.values[k],t)),p:x.p.clone().lerp(y.p,t)});
  const clip=(poly,plane,sign)=>{const out=[];for(let i=0;i<poly.length;i++){const x=poly[i],y=poly[(i+1)%poly.length],dx=(x.p.x*plane[0]+x.p.y*plane[1]+x.p.z*plane[2]+plane[3])*sign,dy=(y.p.x*plane[0]+y.p.y*plane[1]+y.p.z*plane[2]+plane[3])*sign;if(dx>=-1e-7)out.push(x);if((dx>=0)!==(dy>=0))out.push(interpolate(x,y,dx/(dx-dy)));}return out;};
  const emit=(poly,out)=>{for(let i=1;i<poly.length-1;i++)for(const v of[poly[0],poly[i],poly[i+1]])out.push(...v.values);};
  for(let i=0,n=g.index?.count||g.attributes.position.count;i<n;i+=3){
   let poly=[0,1,2].map(k=>read(g.index?g.index.getX(i+k):i+k));normal.crossVectors(a.subVectors(poly[1].p,poly[0].p),b.subVectors(poly[2].p,poly[0].p)).normalize();
   if(remove){if(!remove(poly))emit(poly,body);continue;}
   const region=regions(poly,normal);if(!region){emit(poly,body);continue;}
   for(const plane of region){emit(clip(poly,plane,-1),body);poly=clip(poly,plane,1);if(!poly.length)break;}
   emit(poly,glass);
  }
  const build=data=>{const out=new T.BufferGeometry();names.forEach((name,k)=>{const attr=attrs[k],array=new Float32Array(data.length/stride*attr.itemSize);for(let i=0;i<data.length/stride;i++)for(let j=0;j<attr.itemSize;j++)array[i*attr.itemSize+j]=data[i*stride+offsets[k]+j];out.setAttribute(name,new T.BufferAttribute(array,attr.itemSize));});out.computeBoundingBox();out.computeBoundingSphere();return out;};
  const result={body:build(body),glass:glass.length?build(glass):null};this.repairs.set(g,result);return result;
 },
 openWindows(v,mesh){
  if(!mesh?.isMesh)return;
  const front=[[1,0,0,.58],[-1,0,0,.58],[0,1,0,-1.13],[0,-1,0,1.48],[0,0,1,1.0],[0,0,-1,-.40]];
  const side=[[0,1,0,-1.14],[0,-1,0,1.46],[0,0,-1,.31],[0,-1,1,1.63]];
  const rear=[[1,0,0,.49],[-1,0,0,.49],[0,1,0,-1.17],[0,-1,0,1.44]];
  const result=this.geometryParts(v,mesh,(poly,n)=>{
   const center=target.copy(poly[0].p).add(poly[1].p).add(poly[2].p).divideScalar(3);
   if(center.z<-.38&&center.y>.96&&Math.abs(n.z)>.45)return front;
   if(Math.abs(center.x)>.56&&center.z<.42&&center.z>-.62&&Math.abs(n.x)>.65)return side;
   if(center.z>.48&&center.z<.55&&Math.abs(n.z)>.8)return rear;
   return null;
  });
  mesh.geometry=result.body;
  this.windowMaterial||=new T.MeshStandardMaterial({name:'차량 창유리',color:0x98b5bd,transparent:true,opacity:.12,roughness:.12,metalness:.10,depthWrite:false,side:T.DoubleSide,forceSinglePass:true});
  if(result.glass){const pane=new T.Mesh(result.glass,this.windowMaterial);pane.name='IZH 창유리';pane.castShadow=false;mesh.add(pane);}
 },
 removeWheel(v,mesh){
  const result=this.geometryParts(v,mesh,null,poly=>poly.every(({p})=>p.z>-1.78&&p.z< -1.32&&(p.x+.46)**2+((p.y-1.18)/.80)**2<.34**2));mesh.geometry=result.body;
 },
 template(key){
  if(this.templates.has(key))return this.templates.get(key);
  const s=profiles[key],parts=[],cg=G.cg,bx=(w,h,d,x,y,z,c)=>parts.push(G.bx(w,h,d,x,y,z,c));
  const cloth=key==='izh'?0x514c40:0x343a3a,trim=key==='porter'?0x414a4e:0x282e30;
  if(key!=='e2200'){
   bx(s.width,.055,s.back-s.front,0,s.floor,(s.back+s.front)/2,0x202626);
   bx(s.width,.18,.30,0,s.dash,s.front+.12,trim);
   bx(s.width,.12,.13,0,s.dash+.11,s.front+.04,0x1e2527);
   bx(s.width,s.dash-s.floor,.04,0,(s.dash+s.floor)/2,s.front+.25,trim);
   for(const side of[-1,1]){
    const x=side*s.width/2;bx(.045,.50,s.back-s.front,x,s.floor+.36,(s.back+s.front)/2,trim);
    bx(.07,.06,.30,x-side*.04,s.dash-.09,s.hip[2]-.12,0x484d4c);
    bx(.025,.025,.15,x-side*.06,s.dash+.04,s.hip[2]-.15,0x9b9f99);
    const seatX=side*Math.abs(s.hip[0]);bx(.49,.13,.49,seatX,s.hip[1]-.11,s.hip[2],cloth);
    const back=G.bx(.48,.57,.11,0,0,0,cloth);back.rotateX(-.10).translate(seatX,s.hip[1]+.20,s.hip[2]+.22);parts.push(back);
    bx(.28,.20,.11,seatX,s.hip[1]+.53,s.hip[2]+.24,cloth);
    for(let i=-2;i<=2;i++)bx(.012,.008,.36,seatX+i*.065,s.hip[1]-.04,s.hip[2]-.01,0x555b55);
   }
   bx(s.width,.46,.045,0,s.floor+.25,s.back-.015,trim);
  }
  const from=new V(s.hip[0],s.dash-.06,s.front+.29),to=new V().fromArray(s.wheel),shaft=new T.CylinderGeometry(.035,.045,from.distanceTo(to),10);
  shaft.applyQuaternion(new T.Quaternion().setFromUnitVectors(new V(0,1,0),to.clone().sub(from).normalize())).translate((from.x+to.x)/2,(from.y+to.y)/2,(from.z+to.z)/2);parts.push(cg(shaft,0x202727));
  // v107 환기구·차양·페달·계기판 테는 하나의 정적 메시로 합친다.
  for(const x of[-s.width*.38,s.width*.20,s.width*.38]){
   bx(.15,.085,.018,x,s.dash+.045,s.front+.28,0x111719);
   for(let i=0;i<4;i++)bx(.13,.007,.022,x,s.dash+.016+i*.018,s.front+.292,0x626a6b);
  }
  for(const side of[-1,1])bx(.075,.035,.13,s.hip[0]+side*.10,s.floor+.07,s.wheel[2]-.12,0x1b2020);
  const gauges=clusterGeometry(key,parts),staticGeo=G.mergeGeo(parts.map(g=>g.attributes.lzFinish?g:finish(g)));for(const g of parts)g.dispose();
  const wheelGeo=wheelGeometry(key);this.material||=cabinMaterial();
  this.needleMaterial||=luminousMaterial('계기판 바늘',.35);this.lampMaterial||=luminousMaterial('계기판 표시등',1);this.lampGeo||=G.cg(new T.CircleGeometry(.008,12),0xffffff);
  const out={staticGeo,wheelGeo,...gauges};this.templates.set(key,out);return out;
 },
 ensure(v){
  if(v.cabin)return v.cabin;
  const key=v.cabinKind||v.kind,s=this.profile(v),t=this.template(key),root=new T.Group();root.name='차량 실내';
  const interior=new T.Mesh(t.staticGeo,this.material);interior.receiveShadow=true;root.add(interior);
  const column=new T.Group();column.position.fromArray(s.wheel);column.rotation.x=-.43;root.add(column);
  const wheel=new T.Mesh(t.wheelGeo,this.material);wheel.name='조향 핸들';wheel.castShadow=wheel.receiveShadow=true;column.add(wheel);
  const cluster=t.cluster,faces=new T.Mesh(t.faceGeo,t.dialMaterial);faces.name='속도계·회전계 숫자';root.add(faces);
  const main=t.gauges[0],rpm=t.gauges.find(g=>g.kind==='rpm'),needle=new T.Mesh(t.needleGeo,this.needleMaterial),rpmNeedle=rpm?new T.Mesh(t.needleGeo,this.needleMaterial):new T.Object3D();needle.name='속도계 바늘';needle.position.set(main.x,main.y,main.z+.003);root.add(needle);
  if(rpm){rpmNeedle.name='회전계 바늘';rpmNeedle.position.set(rpm.x,rpm.y,rpm.z+.003);rpmNeedle.scale.setScalar(rpm.r/main.r);root.add(rpmNeedle);}
  const aux=t.gauges.filter(g=>['fuel','temp'].includes(g.kind)),auxNeedles=aux.length?new T.InstancedMesh(t.needleGeo,this.needleMaterial,aux.length):null;if(auxNeedles){auxNeedles.name='연료·수온 바늘';auxNeedles.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(auxNeedles);}
  const lamps=new T.InstancedMesh(this.lampGeo,this.lampMaterial,2);lamps.name='엔진 점검·드리프트 표시등';
  for(let i=0;i<2;i++){matrix.makeTranslation(...t.lamps[i]);lamps.setMatrixAt(i,matrix);lamps.setColorAt(i,new T.Color(0x111719));}lamps.computeBoundingSphere();root.add(lamps);
  v.mesh.add(root);v.cabin={root,column,wheel,needle,rpmNeedle,auxNeedles,aux,lamps,faces,template:t,cluster,profile:s,wheelSpec:wheelSpecs[key],angle:0,warning:-1,handbrake:-1};this.animate(v);G.RT?.invalidate();return v.cabin;
 },
 // v107 차량별 표시등 버퍼만 해제하고 공용 템플릿·텍스처는 다음 탑승에도 쓴다.
 disposeVehicle(v){if(!v.cabin)return;v.cabin.lamps.dispose();v.cabin.auxNeedles?.dispose();v.cabin.root.removeFromParent();v.cabin=null;},
 // v107 운전자를 향하는 +Z축: 왼쪽 입력은 핸들과 양손을 반시계 방향으로 돌린다.
 animate(v){
  const c=this.ensure(v),night=G.World.weather==='night';c.angle=(v.steer||0)*.72;c.wheel.rotation.z=c.angle;
  c.kph=Math.hypot(v.speed,v.lat||0)*3.6;c.rpm=v.driver&&!v.dead&&v.fuel!==0?(v.displayRpm||800):0;c.needle.rotation.z=Math.PI*.75-U.clamp(c.kph/c.cluster.maxKph,0,1)*Math.PI*1.5;c.rpmNeedle.rotation.z=Math.PI*.75-U.clamp(c.rpm/c.cluster.maxRpm,0,1)*Math.PI*1.5;
  if(c.auxNeedles){for(let i=0;i<c.aux.length;i++){const g=c.aux[i],value=g.kind==='fuel'?(v.fuel??1):(v.engineHeat??.35),angle=Math.PI*.75-U.clamp(value,0,1)*Math.PI*1.5;matrix.compose(p.set(g.x,g.y,g.z+.003),q.setFromAxisAngle(normal.set(0,0,1),angle),a.setScalar(g.r/c.template.gauges[0].r));c.auxNeedles.setMatrixAt(i,matrix);}c.auxNeedles.instanceMatrix.needsUpdate=true;c.auxNeedles.computeBoundingSphere();}
  c.faces.material.emissiveIntensity=night?.85:.25;this.needleMaterial.emissiveIntensity=night?.85:.35;
  const warning=v.dead||v.fuel<.08||v.hp<(v.maxHp||1600)*.3,handbrake=!!v.handbrake;
  if(c.warning!==warning||c.handbrake!==handbrake){c.lamps.setColorAt(0,new T.Color(warning?0xff4934:0x111719));c.lamps.setColorAt(1,new T.Color(handbrake?0xffc34b:0x111719));c.lamps.instanceColor.needsUpdate=true;c.warning=warning;c.handbrake=handbrake;}
  return c;
 },
 // v108 최대 약 41도 조향부터 생기던 팔 교차를 림 위의 연속적인 미끄럼 그립으로 푼다.
 gripAngle(v,i){return (i===0?Math.PI:0)+.12*Math.tanh(v.cabin.angle/.12);},
 grip(v,i,out){const c=v.cabin,s=c.profile,w=c.wheelSpec,angle=this.gripAngle(v,i),local=angle-c.angle,gap=a=>Math.atan2(Math.sin(local-a),Math.cos(local-a)),bulge=1+w.bulge*Math.max(...[.24,.76].map(a=>Math.exp(-((gap(Math.PI*a)/.19)**2)))),radius=w.grip-Math.sqrt((w.tube*(1+w.bulge))**2-w.z*w.z)+Math.sqrt((w.tube*bulge)**2-w.z*w.z);return out.set(Math.cos(angle)*radius,Math.sin(angle)*radius,w.z).applyEuler(euler.set(-.43,0,0)).add(p.fromArray(s.wheel));},
 pose(m,v,first){
  const c=this.animate(v),s=c.profile;G.HitResponse?.restore(m);G.Knives?.handTP(m,false);
  m.driving=v;m.motion=null;m.ikGun=null;m.setLOD(false);m.setGun(null);m.showChute(false);m.airGear.visible=false;
  m.hip.position.y=.95;m.spine.rotation.set(0,0,0);m.chest.rotation.set(0,0,0);m.head.rotation.set(0,0,0);
  m.legL.rotation.set(1.43,0,.035);m.legR.rotation.set(1.39,0,-.035);m.kneeL.rotation.set(-1.39,0,0);m.kneeR.rotation.set(-1.34,0,0);
  m.armL.rotation.set(1.1,0,.16);m.armR.rotation.set(1.1,0,-.16);m.elbowL.rotation.set(.6,0,0);m.elbowR.rotation.set(.6,0,0);
  if(m.soldier){G.Soldiers.drive(m.soldier,m);hip.copy(m.soldier.X[m.soldier.T.hipIdx||0]);}
  else {hip.set(0,.95,0);for(let i=0;i<2;i++)this.proceduralArm(m,i,this.grip(v,i,target).sub(p.fromArray(s.hip)).add(hip));}
  m.root.quaternion.copy(v.mesh.quaternion);m.root.position.fromArray(s.hip).sub(hip).applyMatrix4(v.mesh.matrixWorld);
  this.hideHead(m,first);this.hideBody(m,first);m.root.updateMatrixWorld(true);
 },
 driverIK(sd,m){
  const v=m.driving,s=this.profile(v),origin=sd.X[sd.T.hipIdx||0],hands=this.handData(m,sd);
  for(let i=0;i<2;i++){
   this.grip(v,i,target).sub(p.fromArray(s.hip)).add(origin);const hand=hands[i];
   if(hand){
    const angle=this.gripAngle(v,i);
    gripSide.set(-Math.sin(angle),Math.cos(angle),0).multiplyScalar(i===0?-1:1).applyEuler(euler.set(-.43,0,0));
    gripForward.set(0,0,-1).applyEuler(euler);gripNormal.crossVectors(gripSide,gripForward).normalize();
    hand.desired.setFromRotationMatrix(gripMatrix.makeBasis(gripSide,gripForward,gripNormal)).multiply(hand.inverseBasis);
    target.sub(gripOffset.copy(hand.palm).applyQuaternion(hand.desired));
   }
   G.Soldiers.ikArm(sd,i===0?sd.T.ik.L:sd.T.ik.R,target,pole.set(i===0?-.95:.95,-1.2,.32));
  }
  for(let i=0;i<(sd.T.feet||[]).length;i++){
   const foot=sd.T.feet[i];if(!foot)continue;
   target.set(s.hip[0]+(i===0?-.11:.11),s.floor+foot.sole+.025,s.wheel[2]-.05).sub(p.fromArray(s.hip)).add(origin);
   G.Soldiers.ikArm(sd,foot.pair,target,pole.set(0,0,-1));
  }
 },
 // 손목의 원점 대신 손바닥을 림에 맞추고, 두 손의 반대 방향 손가락 굽힘을 구분한다.
 handData(m,sd){
  if(m.driverGrip)return m.driverGrip;
  m.root.updateMatrixWorld(true);
  return m.driverGrip=[0,1].map(i=>{
   const side=i===0?'Left':'Right',bip=i===0?'L':'R',root=sd.root,wrist=root.getObjectByName(side+'Hand')||root.getObjectByName('Bip01_'+bip+'_Hand');if(!wrist)return null;
   const index=root.getObjectByName(side+'HandIndex1')||root.getObjectByName('Bip01_'+bip+'_Finger1'),little=root.getObjectByName(side+'HandPinky1')||root.getObjectByName('Bip01_'+bip+'_Finger4');if(!index||!little)return null;
   const inverse=wrist.matrixWorld.clone().invert(),ip=index.getWorldPosition(new V()).applyMatrix4(inverse),lp=little.getWorldPosition(new V()).applyMatrix4(inverse),x=ip.clone().sub(lp).normalize(),y=ip.clone().add(lp).normalize(),z=new V().crossVectors(x,y).normalize();y.crossVectors(z,x).normalize();
   const palmLocal=ip.clone().add(lp).multiplyScalar(.36),fingers=[],worldNormal=z.clone().transformDirection(wrist.matrixWorld),sign=i===0?-1:1;
   for(const name of['Thumb','Index','Middle','Ring','Pinky'])for(let j=1;j<=3;j++){
    const bone=root.getObjectByName(side+'Hand'+name+j),child=root.getObjectByName(side+'Hand'+name+(j+1));if(!bone||!child)continue;
    const direction=child.getWorldPosition(new V()).sub(bone.getWorldPosition(new V())).normalize(),axis=new V().crossVectors(direction,worldNormal).normalize().applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()).invert());
    fingers.push({bone,bind:bone.quaternion.clone(),axis,angle:sign*(name==='Thumb'?[.25,.6,.45]:[.80,1.15,.80])[j-1]});
   }
   return{wrist,bind:wrist.quaternion.clone(),parent:sd.bones.indexOf(wrist.parent),palmLocal,palm:palmLocal.clone().multiplyScalar(sd.T.unit),inverseBasis:new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)).invert(),desired:new T.Quaternion(),fingers};
  });
 },
 finishGrip(sd,m){
  for(const hand of m.driverGrip||[]){if(!hand)continue;if(hand.parent>=0)hand.wrist.quaternion.copy(gripQ.copy(sd.O[hand.parent]).invert()).multiply(hand.desired);for(const f of hand.fingers)f.bone.quaternion.copy(f.bind).multiply(gripQ.setFromAxisAngle(f.axis,f.angle));}
 },
 contact(m,i,out){const hand=m.driverGrip?.[i];if(hand)return out.copy(hand.palmLocal).applyMatrix4(hand.wrist.matrixWorld);return out.set(0,-.30,0).applyMatrix4((i===0?m.elbowL:m.elbowR).matrixWorld);},
 proceduralArm(m,i,end){
  const upper=i===0?m.armL:m.armR,lower=i===0?m.elbowL:m.elbowR;
  p.set(i===0?-.25:.25,m.hip.position.y+.51,0);direction.subVectors(end,p);let length=direction.length();direction.normalize();length=U.clamp(length,.02,.589);
  // 팔꿈치는 아래·바깥을 향하고 손목은 핸들 뒤쪽에 닿게 한다.
  bend.set(i===0?-.7:.7,-1,.15);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
  const along=(.29*.29+length*length-.30*.30)/(2*length);elbow.copy(direction).multiplyScalar(along).addScaledVector(bend,Math.sqrt(Math.max(0,.29*.29-along*along)));
  upper.quaternion.setFromUnitVectors(pole.set(0,-1,0),a.copy(elbow).normalize());
  q.setFromUnitVectors(pole,a.copy(direction).multiplyScalar(length).sub(elbow).normalize());lower.quaternion.copy(q2.copy(upper.quaternion).invert()).multiply(q);
 },
 hideHead(m,hide){
  let state=m.driverHead;
  if(!state){const bones=[m.head];if(m.soldier){const i=m.soldier.T.entries.findIndex(e=>e.key==='head');if(i>=0)bones.push(m.soldier.bones[i]);}state=m.driverHead={bones:bones.map(bone=>({bone,scale:bone.scale.clone()})),meshes:m.meshes.map(mesh=>({mesh,culled:mesh.frustumCulled})),hidden:false};}
  if(state.hidden===hide)return;
  for(const r of state.bones)if(hide)r.bone.scale.setScalar(.001);else r.bone.scale.copy(r.scale);
  // 원본의 바인드 자세 경계가 운전 자세를 포함하지 않아 팔까지 잘리는 것을 막는다.
  for(const r of state.meshes)r.mesh.frustumCulled=hide?false:r.culled;
  state.hidden=hide;
 },
 // v107 내부 시점은 팔 삼각형만 그린다. 몸통 뼈를 줄이면 자식인 팔도 찌그러진다.
 hideBody(m,hide){
  if(!m.driverBody&&hide){
   const sd=m.soldier,roots=sd?sd.T.entries.flatMap((e,i)=>['armL','armR'].includes(e.key)?[sd.bones[i]]:[]):[m.armL,m.armR],bones=new Set();
   for(const root of roots)root.traverse(b=>bones.add(b));
   m.driverBody=m.meshes.filter(mesh=>mesh.isSkinnedMesh).map(mesh=>{
    const original=mesh.geometry,g=original.clone(),si=g.attributes.skinIndex,sw=g.attributes.skinWeight,keep=[],groups=[];
    const arm=new Uint8Array(si.count);for(let i=0;i<si.count;i++){let weight=0;for(let k=0;k<4;k++)if(bones.has(mesh.skeleton.bones[si.getComponent(i,k)]))weight+=sw.getComponent(i,k);arm[i]=weight>=.5?1:0;}
    for(const group of g.groups.length?g.groups:[{start:0,count:g.index?.count||si.count,materialIndex:0}]){
     const start=keep.length;for(let i=group.start;i<group.start+group.count;i+=3){const tri=[0,1,2].map(k=>g.index?g.index.getX(i+k):i+k);if(tri.every(v=>arm[v]))keep.push(...tri);}groups.push({start,count:keep.length-start,materialIndex:group.materialIndex});
    }
    g.setIndex(keep);g.clearGroups();for(const group of groups)g.addGroup(group.start,group.count,group.materialIndex);
    return{mesh,original,arms:g};
   });
  }
  for(const row of m.driverBody||[])row.mesh.geometry=hide?row.arms:row.original;
 },
 dispose(m){for(const row of m.driverBody||[])row.arms.dispose();m.driverBody=null;},
 release(m){if(!m)return;this.hideHead(m,false);this.hideBody(m,false);for(const hand of m.driverGrip||[]){if(!hand)continue;hand.wrist.quaternion.copy(hand.bind);for(const f of hand.fingers)f.bone.quaternion.copy(f.bind);}m.driving=null;m.motion=null;},
 enter(P,v){this.ensure(v);P.vehicleView||='third';P.vehicleLookYaw=0;P.vehicleLookPitch=-.22;P.vehicleNear=G.camera.near;},
 leave(P){if(!P)return;if(P.a?.model)this.release(P.a.model);if(P.vehicleNear!==undefined){G.camera.near=P.vehicleNear;G.camera.updateProjectionMatrix();delete P.vehicleNear;}},
 toggle(P){P.vehicleView=P.vehicleView==='first'?'third':'first';P.vehicleLookYaw=0;P.vehicleLookPitch=-.22;P.orbitYaw=P.vehicle.yaw;P.orbitPitch=-.22;},
 camera(P,dt){
  const v=P.vehicle,s=this.profile(v),cam=G.camera;P.vehicleLookYaw=U.clamp(P.vehicleLookYaw-G.Input.mdx*.0026*P.sens,-1.65,1.65);P.vehicleLookPitch=U.clamp(P.vehicleLookPitch-P.lookY()*.0026*P.sens,-.85,.65);
  cam.position.fromArray(s.eye).applyMatrix4(v.mesh.matrixWorld);cam.quaternion.copy(v.mesh.quaternion).multiply(q.setFromEuler(euler.set(P.vehicleLookPitch,P.vehicleLookYaw,0,'YXZ')));cam.near=.035;
  cam.fov=U.damp(cam.fov,78,10,dt);cam.updateProjectionMatrix();P.orbitYaw=v.yaw+P.vehicleLookYaw;
 }
};
})();
