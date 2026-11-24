// 부착물 원형: 미터 단위, 총구 방향 -Z, 레일 접면 Y=0, 총구 체결면 Z=0.
// 스코프 누락 시 같은 광축·체결면을 갖는 대체 형상으로 복귀한다.
(function(factory){
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else window.G.AttachmentModels=factory(window.THREE,window.THREE.mergeGeometries,window.G.ScopeProfiles);
})(function(T,merge,profiles){
'use strict';
const specs={
 micro:{kind:'optic',eye:[0,.023,.014],foot:[.026,.035],label:'소형 개방형 도트'},
 reddot:{kind:'optic',eye:[0,.036,.032],foot:[.027,.050],label:'밀폐형 레드닷'},
 holo:{kind:'optic',eye:[0,.038,.025],foot:[.034,.060],label:'홀로그램 조준경'},
 x2:{kind:'optic',eye:[0,.043,.045],foot:[.032,.064],label:'2배율 프리즘 조준경'},
 x4:{kind:'optic',eye:[0,.041,.086],foot:[.030,.090],label:'4배율 소형 조준경'},
 x8:{kind:'optic',eye:[0,.049,.132],foot:[.032,.106],label:'8배율 장거리 조준경'},
 suppressor:{kind:'muzzle',label:'소총 소음기'},suppressor_pistol:{kind:'muzzle',label:'권총 소음기'},
 compensator:{kind:'muzzle',label:'이중 포트 보정기'},flash:{kind:'muzzle',label:'삼지 소염기'},choke:{kind:'muzzle',label:'연장 초크'},
 grip:{kind:'under',label:'수직 손잡이'},angled:{kind:'under',label:'앵글 손잡이'},light:{kind:'under',label:'경량 손잡이'},half:{kind:'under',label:'하프 손잡이'},
 laser:{kind:'side',label:'소형 레이저 모듈'},tactical:{kind:'stock',foot:[.038,.085],label:'전술 패드'},cheek:{kind:'stock',foot:[.038,.075],label:'뺨 받침대'},
 mag_extended:{kind:'magazine',foot:[.032,.055],label:'대용량 바닥판'},mag_quick:{kind:'magazine',foot:[.032,.055],label:'퀵드로우 고리'},mag_extendedQuick:{kind:'magazine',foot:[.032,.055],label:'대용량 퀵드로우 바닥판'}
};
Object.assign(specs,profiles||{});
const mats={
 body:new T.MeshStandardMaterial({name:'LZ anodized',color:0x3c4447,metalness:.52,roughness:.43}),
 edge:new T.MeshStandardMaterial({name:'LZ machined',color:0x636d70,metalness:.7,roughness:.32}),
 rubber:new T.MeshStandardMaterial({name:'LZ polymer',color:0x222728,metalness:.08,roughness:.78}),
 dark:new T.MeshStandardMaterial({name:'LZ recess',color:0x101516,metalness:.2,roughness:.62}),
 glass:new T.MeshStandardMaterial({name:'LZ glass',color:0x769ca5,metalness:.12,roughness:.13,transparent:true,opacity:.20,depthWrite:false,side:T.DoubleSide})
};
const templates={};
function rounded(w,h,r){
 const s=new T.Shape(),x=-w/2,y=-h/2;r=Math.min(r,w/2,h/2);
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
function box(w,h,d,b=.0006){
 b=Math.min(b,w/5,h/5,d/5);return new T.ExtrudeGeometry(rounded(w-2*b,h-2*b,b),{depth:d-2*b,steps:1,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:1,curveSegments:2}).translate(0,0,-d/2+b);
}
function tube(r,inside,length){
 const b=Math.min(.0008,(r-inside)*.4),z=length/2,p=[[inside,-z],[r-b,-z],[r,-z+b],[r,z-b],[r-b,z],[inside,z],[inside,-z]].map(([x,y])=>new T.Vector2(x,y));
 return new T.LatheGeometry(p,24).rotateX(Math.PI/2);
}
function frame(w,h,d,thick){
 const s=rounded(w-0.0008,h-0.0008,.0025),hole=rounded(w-thick*2,h-thick*2,.002);s.holes.push(new T.Path(hole.getPoints(16)));
 return new T.ExtrudeGeometry(s,{depth:d-.0008,steps:1,bevelEnabled:true,bevelSize:.0004,bevelThickness:.0004,bevelSegments:1,curveSegments:2}).translate(0,0,-d/2+.0004);
}
function make(id){
 if(templates[id])return templates[id].clone(true);if(!specs[id])return null;
 const pieces={},put=(geo,material,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{geo.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x,y,z);(pieces[material]||(pieces[material]=[])).push(geo);return geo};
 const block=(w,h,d,x,y,z,mat='body',b)=>put(box(w,h,d,b),mat,x,y,z);
 const cyl=(r,h,x,y,z,mat='body',axis='y',segments=16)=>put(new T.CylinderGeometry(r,r,h,segments),mat,x,y,z,axis==='z'?Math.PI/2:0,0,axis==='x'?Math.PI/2:0);
 const bolt=(x,y,z,axis='x')=>{cyl(.0022,.0013,x,y,z,'edge',axis,12);const g=box(.0028,.0005,.0005,.0001);if(axis==='x')g.rotateZ(Math.PI/2);else if(axis==='z')g.rotateX(Math.PI/2);put(g,'dark',x+(axis==='x'?.0008:0),y+(axis==='y'?.0008:0),z+(axis==='z'?.0008:0));};
 const foot=(w,l)=>{
  block(w,.004,l,0,.002,0,'body');
  for(const side of [-1,1]){block(.0035,.0045,l*.8,side*(w/2-.0013),.002,0,'rubber');bolt(side*(w/2+.0006),.003,-l*.22);bolt(side*(w/2+.0006),.003,l*.22)}
  block(w*.66,.002,l*.22,0,.001,0,'edge');
 };
 const ring=(r,z,axisY)=>{
  put(tube(r+.002,r-.0004,.009),'body',0,axisY,z);block(r*2+.007,.004,.010,0,axisY-r-.001,z,'body');
  for(const x of [-r-.001,r+.001])bolt(x,axisY+.004,z,'y');
 };
 const turret=(y,z)=>{
  cyl(.0065,.006,0,y-.003,z,'body');cyl(.005,.014,.009,y-.006,z,'body','x');cyl(.0085,.008,0,y,z,'body');cyl(.0088,.0016,0,y+.0042,z,'edge');
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;put(box(.001,.0045,.0018,.00015),'rubber',Math.sin(a)*.0087,y,Math.cos(a)*.0087+z,0,a,0)}
  block(.009,.0005,.0007,0,y+.0052,z,'edge');cyl(.007,.007,.014,y-.006,z,'body','x');bolt(.018,y-.006,z);
 };
 const lens=(r,y,z)=>put(new T.CircleGeometry(r,24),'glass',0,y,z);
 const eye=specs[id].eye?.[1];
 if(id==='micro'){
  foot(.026,.040);block(.028,eye-.010,.035,0,(eye-.010)/2,0,'body');put(frame(.030,.025,.010,.0028),'body',0,eye+.001,-.007);
  put(new T.PlaneGeometry(.023,.017),'glass',0,eye,-.008,-.12);bolt(.015,eye-.006,.003);block(.012,.002,.008,0,eye-.010,.012,'rubber');
 }else if(id==='reddot'){
  foot(.029,.044);block(.023,eye-.012,.038,0,(eye-.012)/2,0,'body');
  const z=specs[id].eye[2]-.036;put(tube(.0175,.014,.074),'body',0,eye,z);for(const dz of [-.037,.037])put(tube(.018,.0137,.005),'rubber',0,eye,z+dz);
  lens(.0135,eye,z+.037);lens(.0135,eye,z-.037);turret(eye+.021,z-.006);cyl(.008,.009,.018,eye,z-.004,'body','x');bolt(.023,eye,z-.004);
 }else if(id==='holo'){
  foot(.035,.063);block(.036,eye-.013,.055,0,(eye-.013)/2,0,'body');
  const z=specs[id].eye[2]-.007;put(frame(.043,.033,.020,.004),'body',0,eye-.001,z);put(new T.PlaneGeometry(.030,.022),'glass',0,eye,z+.006,-.10);
  block(.024,.008,.022,0,eye-.018,-.020,'rubber');for(const x of [-.006,.006])cyl(.0026,.002,x,eye-.013,-.025,'edge');bolt(.023,eye-.008,z);
 }else if(id==='x2'||id==='x4'){
  const big=id==='x4',L=big?.152:.126,z=specs[id].eye[2]-L*.48;
  foot(big?.035:.031,big?.087:.073);block(.023,eye-.014,big?.070:.057,0,(eye-.014)/2,.007,'body');
  put(tube(.019,.012,L*.84),'body',0,eye,z);put(tube(.021,.0125,.025),'rubber',0,eye,z+L*.38);put(tube(.024,.015,.025),'body',0,eye,z-L*.38);
  lens(.012,eye,z+L*.48);lens(.0148,eye,z-L*.48);turret(eye+.024,z-.006);
  for(const x of [-.015,.015])block(.009,.023,L*.55,x,eye-.002,z-.005,'body');
 }else if(id==='x8'){
  const y=eye,L=.246,z=specs[id].eye[2]-L*.49,r=.023;
  foot(.032,.106);for(const dz of [-.035,.039]){block(.020,y-.012,.015,0,(y-.012)/2,z+dz,'body');ring(.014,z+dz,y)}
  put(tube(.014,.0105,L*.70),'body',0,y,z);
  const bell=[[.0105,-L*.27],[.014,-L*.27],[r,-L*.39],[r,-L*.49],[.018,-L*.49],[.018,-L*.40],[.0105,-L*.27]].map(p=>new T.Vector2(...p));
  put(new T.LatheGeometry(bell,24).rotateX(Math.PI/2),'body',0,y,z);put(tube(.018,.0135,L*.20),'rubber',0,y,z+L*.39);
  lens(.0138,y,z+L*.49);lens(.0178,y,z-L*.49);turret(y+.019,z);
 }else if(id==='suppressor'||id==='suppressor_pistol'){
  const pistol=id.endsWith('pistol'),r=pistol?.0145:.0195,L=pistol?.145:.182;
  put(tube(r,.0045,L-.012),'body',0,0,-L/2-.003);put(tube(r+.0008,.0045,.009),'edge',0,0,-L+.001);
  put(tube(r*.8,.0045,.014),'rubber',0,0,-.005);for(const z of [-.026,-L+.021])put(tube(r+.0005,r-.001,.003),'edge',0,0,z);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;put(box(.001,.001,.022,.0002),'rubber',Math.sin(a)*r,Math.cos(a)*r,-.026,0,0,-a)}
 }else if(id==='compensator'){
  put(tube(.0105,.0045,.016),'body',0,0,-.004);
  for(const z of [-.019,-.032]){put(tube(.012,.005,.004),'edge',0,0,z);for(const x of [-.009,.009])block(.003,.017,.010,x,0,z-.006,'body');block(.016,.003,.010,0,-.009,z-.006,'body')}
  put(tube(.0115,.0045,.003),'body',0,0,-.044);
 }else if(id==='flash'){
  put(tube(.0108,.0045,.014),'body',0,0,-.004);
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2;put(box(.005,.003,.023,.0006),'body',Math.sin(a)*.008,Math.cos(a)*.008,-.022,0,0,-a)}
  put(tube(.011,.0045,.003),'edge',0,0,-.010);
 }else if(id==='choke'){
  put(tube(.0114,.0091,.049),'edge',0,0,-.021);put(tube(.0125,.0091,.012),'body',0,0,-.038);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;put(box(.0011,.001,.010,.0002),'rubber',Math.sin(a)*.0124,Math.cos(a)*.0124,-.038,0,0,-a)}
 }else if(['grip','light','half'].includes(id)){
  const L=id==='grip'?.085:id==='light'?.060:.044;block(.026,.009,.042,0,-.0045,0,'body');
  for(const x of [-.013,.013])bolt(x,-.005,.007);
  const sh=new T.Shape([[-.010,-.009],[.010,-.009],[.009,-L+.008],[.005,-L],[-.005,-L],[-.010,-L+.008]].map(v=>new T.Vector2(...v)));
  put(new T.ExtrudeGeometry(sh,{depth:.028,bevelEnabled:true,bevelSize:.0012,bevelThickness:.0012,bevelSegments:1,steps:1}).translate(0,0,-.014),'rubber',0,0,0);
  for(let i=0;i<(id==='half'?3:5);i++)block(.021,.002,.027,0,-.018-i*(L-.025)/5,0,'body',.0003);
 }else if(id==='angled'){
  block(.027,.009,.076,0,-.0045,0,'body');
  const s=new T.Shape([[-.034,-.008],[.032,-.008],[.018,-.041],[-.017,-.021],[-.034,-.020]].map(v=>new T.Vector2(...v)));
  put(new T.ExtrudeGeometry(s,{depth:.021,bevelEnabled:true,bevelSize:.001,bevelThickness:.001,bevelSegments:1,steps:1}).rotateY(Math.PI/2).translate(-.0105,0,0),'rubber');
  for(let i=0;i<5;i++)block(.023,.002,.003,0,-.017-i*.003,-.019+i*.007,'body',.0003);bolt(.014,-.005,.024);bolt(-.014,-.005,-.024);
 }else if(id==='laser'){
  foot(.025,.041);block(.034,.019,.050,0,.014,0,'body');block(.030,.004,.043,0,.025,0,'rubber');
  for(const x of [-.008,.008]){put(tube(.004,.0025,.004),'edge',x,.015,-.026);put(new T.CircleGeometry(.0024,12),'glass',x,.015,-.028,0,Math.PI,0)}
  bolt(.018,.015,.010);cyl(.0033,.002,0,.028,.012,'edge');block(.010,.001,.015,-.007,.028,-.008,'edge',.0002);
 }else if(id==='tactical'||id==='cheek'){
  const l=id==='tactical'?.085:.075;block(.038,.004,l,0,.002,0,'body');block(.041,.015,l-.005,0,.009,0,'rubber',.002);
  for(const z of [-l*.34,l*.34]){block(.045,.003,.008,0,.003,z,'edge');for(const x of [-.021,.021])bolt(x,.006,z)}
  if(id==='tactical')for(let i=0;i<5;i++)block(.039,.0015,.002,0,.017,-.025+i*.012,'body',.0002);
 }else if(id.startsWith('mag_')){
  const ext=id!=='mag_quick',h=ext?.026:.005;block(.032,h,.055,0,-h/2,0,'rubber',.0015);block(.034,.004,.057,0,-.001,0,'body');
  if(ext)for(let i=0;i<3;i++)block(.033,.0014,.052,0,-.009-i*.006,0,'body',.0003);
  if(id!=='mag_extended')put(frame(.028,.023,.012,.004),'rubber',0,-h-.007,0);
 }
 const root=new T.Group();root.name='LZ_'+id;root.userData={...specs[id],eye:specs[id].eye?.[1],eyePoint:specs[id].eye,seat:[0,0,0],forward:[0,0,-1],authored:true};
 for(const [name,list]of Object.entries(pieces)){
  const geometry=merge(list.map(g=>g.index?g.toNonIndexed():g),false),mesh=new T.Mesh(geometry,mats[name]);mesh.name='LZ_'+id+'_'+name;mesh.frustumCulled=false;root.add(mesh);
  for(const g of list)g.dispose();
 }
 templates[id]=root;return root.clone(true);
}
return{specs,ids:Object.keys(specs),build:make};
});
