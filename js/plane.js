// plane.js — LZ-89 대형 군용 수송기: 후퇴익·4발 터보팬·T자 꼬리날개
(function () {
'use strict';
const THREE = window.THREE, G = window.G, V3 = THREE.Vector3;
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const Z0 = -18.4, Z1 = 18.8, DOOR = [6.1, 7.6, 90, 135];

// 기수·조종석 어깨·화물실·들린 꼬리를 각각의 단면으로 잡는다.
const STATIONS = [
  [-18.4,.035,-.65,-.57],[-18.1,.65,-1.12,.05],[-17.3,1.55,-1.82,1.15],
  [-16.0,2.34,-2.30,2.16],[-14.6,2.86,-2.63,3.05],[-12.6,3.07,-2.82,3.36],
  [-8.5,3.15,-2.95,3.46],[2,3.15,-2.95,3.46],[7.6,3.10,-2.92,3.43],
  [10,2.76,-2.16,3.37],[13.1,2.06,-.48,3.29],[16.2,1.12,1.15,3.18],
  [18.2,.28,2.53,3.03],[18.8,.035,2.77,2.84]
];
// 단조 에르미트 보간으로 단면 사이의 돌기와 음수 폭을 막는다.
const slopes = [1,2,3].map(k => STATIONS.map((p,i) => {
  const prev = STATIONS[Math.max(0,i-1)], next = STATIONS[Math.min(STATIONS.length-1,i+1)];
  if (!i) return (next[k]-p[k])/(next[0]-p[0]);
  if (i===STATIONS.length-1) return (p[k]-prev[k])/(p[0]-prev[0]);
  const h0=p[0]-prev[0],h1=next[0]-p[0],d0=(p[k]-prev[k])/h0,d1=(next[k]-p[k])/h1;
  return d0*d1<=0 ? 0 : 3*(h0+h1)/((2*h1+h0)/d0+(h1+2*h0)/d1);
}));
function section(z) {
  let i=0;
  while(i<STATIONS.length-2&&z>STATIONS[i+1][0])i++;
  const a=STATIONS[i],b=STATIONS[i+1],h=b[0]-a[0],t=THREE.MathUtils.clamp((z-a[0])/h,0,1);
  const sample=k=>(2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*h*slopes[k-1][i]+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*h*slopes[k-1][i+1];
  const bottom=sample(2),top=sample(3);
  return { w:sample(1),h:(top-bottom)*.5,c:(top+bottom)*.5 };
}
const signed = (v,e) => Math.sign(v)*Math.abs(v)**e;
function surface(z,theta,offset=0,out=new V3()) {
  const s=section(z),sn=Math.sin(theta),cs=Math.cos(theta),x=signed(sn,.78),y=signed(cs,cs<0 ? .62 : .83);
  return out.set(s.w*x+sn*offset,s.c+s.h*y+cs*offset,z);
}
function geometry(pos,idx,uv) {
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeVertexNormals();return g;
}
function hull() {
  const zs=[Z0,Z1,DOOR[0],DOOR[1],...STATIONS.map(s=>s[0])];
  for(let z=-18;z<18.8;z+=.5)zs.push(z);
  zs.sort((a,b)=>a-b);
  const rows=zs.filter((z,i)=>!i||z-zs[i-1]>1e-5),nt=80,pos=[],uv=[],idx=[],p=new V3();
  for(const z of rows)for(let j=0;j<=nt;j++){
    surface(z,j/nt*TAU,0,p);pos.push(p.x,p.y,p.z);uv.push(j/nt,(z-Z0)/(Z1-Z0));
  }
  for(let i=0;i<rows.length-1;i++)for(let j=0;j<nt;j++){
    const inDoor=rows[i]>=DOOR[0]-1e-5&&rows[i+1]<=DOOR[1]+1e-5&&((j>=20&&j<30)||(j>=50&&j<60));
    if(inDoor)continue;
    const a=i*(nt+1)+j,b=a+nt+1;idx.push(a,b,a+1,a+1,b,b+1);
  }
  for(const [row,front] of [[0,true],[rows.length-1,false]]){
    const ci=pos.length/3,s=section(rows[row]);pos.push(0,s.c,rows[row]);uv.push(.5,front?0:1);
    for(let j=0;j<nt;j++){
      const a=row*(nt+1)+j;
      if(front)idx.push(ci,a,a+1);else idx.push(ci,a+1,a);
    }
  }
  const g=geometry(pos,idx,uv),n=g.attributes.normal;
  for(let i=0;i<rows.length;i++){
    const a=i*(nt+1),b=a+nt;p.fromBufferAttribute(n,a).add(new V3().fromBufferAttribute(n,b)).normalize();
    n.setXYZ(a,p.x,p.y,p.z);n.setXYZ(b,p.x,p.y,p.z);
  }
  return g;
}
function panel(z0,z1,t0,t1,offset=.035,nz=4,nt=6) {
  const pos=[],idx=[],p=new V3();
  for(let i=0;i<=nz;i++)for(let j=0;j<=nt;j++){
    surface(z0+(z1-z0)*i/nz,(t0+(t1-t0)*j/nt)*DEG,offset,p);pos.push(p.x,p.y,p.z);
  }
  for(let i=0;i<nz;i++)for(let j=0;j<nt;j++){
    const a=i*(nt+1)+j,b=a+nt+1;
    if(t1>t0)idx.push(a,b,a+1,a+1,b,b+1);else idx.push(a,a+1,b,a+1,b+1,b);
  }
  return geometry(pos,idx);
}

// 입체 형상을 유지하는 닫힌 익형. 좌우 윙렛의 면 방향도 맞춘다.
function foil(sections) {
  const f=[],n=18;
  const height=t=>5*(.2969*Math.sqrt(t)-.126*t-.3516*t*t+.2843*t**3-.1036*t**4);
  for(let i=n;i>=0;i--){const t=(1-Math.cos(i/n*Math.PI))*.5;f.push([t,height(t)]);}
  for(let i=1;i<n;i++){const t=(1-Math.cos(i/n*Math.PI))*.5;f.push([t,-height(t)]);}
  const pos=[],idx=[],count=f.length;
  for(const s of sections)for(const [t,y] of f){
    const p=s.p.clone().addScaledVector(s.cd,t*s.chord).addScaledVector(s.up,y*s.thick);pos.push(p.x,p.y,p.z);
  }
  const flip=new V3().subVectors(sections[1].p,sections[0].p).cross(sections[0].cd).dot(sections[0].up)>0;
  const tri=(a,b,c)=>flip?idx.push(a,c,b):idx.push(a,b,c);
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<count;j++){
    const a=i*count+j,b=i*count+(j+1)%count,c=a+count,d=b+count;tri(a,c,b);tri(b,c,d);
  }
  for(const [i,front] of [[0,true],[sections.length-1,false]]){
    const s=sections[i],p=s.p.clone().addScaledVector(s.cd,s.chord*.4),ci=pos.length/3;pos.push(p.x,p.y,p.z);
    for(let j=0;j<count;j++){const a=i*count+j,b=i*count+(j+1)%count;if(front)tri(a,b,ci);else tri(b,a,ci);}
  }
  return geometry(pos,idx);
}
const wingSection = x => ({p:new V3(x,3.28-Math.abs(x)*.055,-4.7+Math.abs(x)*.32),chord:9.2-Math.abs(x)*.255,thick:(9.2-Math.abs(x)*.255)*.13,cd:new V3(0,0,1),up:new V3(0,1,0)});
const finSection = y => {const t=(y-2.4)/8.95;return {p:new V3(0,y,9.8+t*4.1),chord:8.3-t*3.7,thick:.85-t*.38,cd:new V3(0,0,1),up:new V3(-1,0,0)};};

/* ---------------- 도장·재질 ---------------- */
function skinTexture() {
  const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');
  x.fillStyle='#71818a';x.fillRect(0,0,1024,1024);
  const belly=x.createLinearGradient(0,0,1024,0);
  belly.addColorStop(0,'rgba(20,30,38,0)');belly.addColorStop(.32,'rgba(20,30,38,0)');belly.addColorStop(.5,'rgba(20,30,38,.38)');belly.addColorStop(.68,'rgba(20,30,38,0)');belly.addColorStop(1,'rgba(20,30,38,0)');
  x.fillStyle=belly;x.fillRect(0,0,1024,1024);
  // 패널·정비 덮개와 짧은 오염을 도장에 넣는다.
  x.strokeStyle='rgba(20,30,38,.24)';x.lineWidth=1.1;
  for(let y=52;y<1024;y+=64){x.beginPath();x.moveTo(0,y);x.lineTo(1024,y);x.stroke();}
  for(const u of [.12,.24,.36,.64,.76,.88]){x.beginPath();x.moveTo(u*1024,0);x.lineTo(u*1024,1024);x.stroke();}
  for(let y=48;y<1024;y+=64)for(let u=0;u<1024;u+=12){x.fillStyle='rgba(215,225,228,.2)';x.fillRect(u,y,1,1);}
  let seed=89;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<260;i++){x.fillStyle='rgba(24,32,38,'+(.015+rnd()*.025)+')';x.fillRect(rnd()*1024,rnd()*1024,3+rnd()*28,4+rnd()*44);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,G.renderer?.capabilities.getMaxAnisotropy()||4);return t;
}
function stencil(text,width,height,size) {
  const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');
  x.fillStyle='#e2e6df';x.font='bold '+size+'px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,width*.5,height*.53);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,G.renderer?.capabilities.getMaxAnisotropy()||4);return t;
}
let MAT;
function materials() {
  if(MAT)return MAT;
  const std=(color,roughness=.7,metalness=.25)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const decal=map=>new THREE.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:.9,polygonOffset:true,polygonOffsetFactor:-1});
  MAT={hull:new THREE.MeshStandardMaterial({map:skinTexture(),roughness:.76,metalness:.22}),
    paint:std(0x71818a),dark:std(0x26343f,.8,.15),seam:std(0x35444c),metal:std(0x9aa6ac,.37,.72),
    intake:std(0x172027,.9,.12),fan:std(0x6e818a,.38,.7),exhaust:std(0x45464a,.78,.7),orange:std(0xcd672c,.78,.12),
    glass:std(0x101f2b,.16,.64),mark:decal(stencil('LZ-89   AIRLIFT',1024,128,76)),tailMark:decal(stencil('LZ',256,256,154)),
    red:new THREE.MeshBasicMaterial({color:new THREE.Color(4,.1,.05)}),green:new THREE.MeshBasicMaterial({color:new THREE.Color(.1,3,.4)}),white:new THREE.MeshBasicMaterial({color:new THREE.Color(3,3,3)})};
  return MAT;
}
function reversed(g) {
  const p=g.index.array;for(let i=0;i<p.length;i+=3){const t=p[i+1];p[i+1]=p[i+2];p[i+2]=t;}g.computeVertexNormals();return g;
}
function lathe(points,reverse=false) {
  const g=new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(p[0],p[1])),48).rotateX(Math.PI*.5);
  return reverse?reversed(g):g;
}
function fanGeometry() {
  const pos=[],idx=[],blades=28,steps=5;
  for(let b=0;b<blades;b++){
    const start=pos.length/3;
    for(let j=0;j<=steps;j++)for(const side of [-1,1]){
      const t=j/steps,r=.21+t*.65,theta=b/blades*TAU+t*.42+side*(.025+t*.058);
      pos.push(Math.cos(theta)*r,Math.sin(theta)*r,t*.09);
    }
    for(let j=0;j<steps;j++){const a=start+j*2,c=a+2;idx.push(a,a+1,c,a+1,c+1,c);}
  }
  return geometry(pos,idx);
}

G.disposePlane=function(plane){
  plane.removeFromParent();const geometries=new Set();plane.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
  for(const g of geometries)g.dispose();
};

G.buildPlane=function(){
  const M=materials(),root=new THREE.Group(),batches=new Map(),props=[],jumpLights=[];
  root.name='LZ-89';
  // 같은 재질의 고정 부품을 합쳐 정비 디테일의 제출 횟수를 줄인다.
  function add(g,key,x=0,y=0,z=0){g.translate(x,y,z);let list=batches.get(key);if(!list)batches.set(key,list=[]);list.push(g);}
  const box=(w,h,d,x,y,z,key)=>add(new THREE.BoxGeometry(w,h,d),key,x,y,z);
  function tube(points,r,key){
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dir=new V3().subVectors(b,a),g=new THREE.CylinderGeometry(r,r,dir.length(),6);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),dir.normalize())).translate((a.x+b.x)*.5,(a.y+b.y)*.5,(a.z+b.z)*.5);add(g,key);
    }
  }
  function border(z0,z1,t0,t1,r,key){
    const points=[];
    for(let i=0;i<=8;i++)points.push(surface(z0+(z1-z0)*i/8,t0*DEG,.075));
    for(let i=1;i<=6;i++)points.push(surface(z1,(t0+(t1-t0)*i/6)*DEG,.075));
    for(let i=1;i<=8;i++)points.push(surface(z1-(z1-z0)*i/8,t1*DEG,.075));
    for(let i=1;i<=6;i++)points.push(surface(z0,(t1-(t1-t0)*i/6)*DEG,.075));
    tube(points,r,key);
  }
  function light(x,y,z,key,r=.1){
    const m=new THREE.Mesh(new THREE.SphereGeometry(r,8,6),M[key]);m.position.set(x,y,z);root.add(m);return m;
  }

  add(hull(),'hull');
  // 앞유리를 넓게 기울이고 객실에는 작은 관측창을 배치한다.
  for(const [a,b] of [[-59,-31],[-28,-3],[3,28],[31,59]]){
    add(panel(-15.92,-13.95,a,b,.055,7,6),'glass');border(-15.92,-13.95,a,b,.036,'paint');
  }
  for(const side of [-1,1]){
    add(panel(-13.85,-11.75,side*63,side*80,.055,6,4),'glass');border(-13.85,-11.75,side*63,side*80,.036,'paint');
    for(const z of [-9.4,-7.1,3.8]){
      add(panel(z,z+.36,side*79,side*88,.045,2,4),'glass');border(z,z+.36,side*79,side*88,.018,'metal');
    }
    // 강하문은 동체를 뚫고 안쪽 벽·문틀·발판을 별도로 만든다.
    border(DOOR[0],DOOR[1],side*90,side*135,.065,'metal');
    const inside=new THREE.PlaneGeometry(1.7,2.7).rotateY(side*Math.PI*.5);add(inside,'intake',side*2.65,-.85,6.85);
    box(1.05,.12,1.7,side*2.95,-2.2,6.85,'metal');
    box(.04,.38,.035,side*3.11,-.65,6.2,'metal');
    jumpLights.push(light(side*3.17,.55,6.85,'green',.095));
    const fairing=new THREE.SphereGeometry(1,24,12).scale(.68,.91,4.8);add(fairing,'paint',side*2.88,-1.97,1.1);
    box(.67,.035,5.8,side*2.92,-2.84,1.2,'seam');
    const id=new THREE.PlaneGeometry(4.5,.57).rotateY(side*Math.PI*.5);add(id,'mark',side*3.19,.38,-4.4);
    add(panel(-11.45,-10.25,side*92,side*128,.025,3,4),'seam');
    border(-11.45,-10.25,side*92,side*128,.024,'metal');
    for(let i=0;i<5;i++)add(panel(11+i*.19,11.09+i*.19,side*76,side*103,.035,1,3),'intake');
  }
  add(panel(-18.35,-16.4,75,285,.012,7,20),'dark');
  add(panel(-15,-12.4,169,191,.025,3,3),'seam');
  border(8.3,16.1,137,223,.035,'seam');
  for(const z of [8.4,9.1,9.8])box(1.55,.09,.10,0,-2.55+(z-8.4)*.3,z,'metal');

  /* ---------------- 후퇴익·윙렛·조종면 ---------------- */
  const xs=[-20.3,-18,-15,-12,-9,-6,-3,0,3,6,9,12,15,18,20.3];
  add(foil(xs.map(wingSection)),'paint');
  add(new THREE.SphereGeometry(1,24,12).scale(1.92,.66,6.2),'paint',0,3.12,-.05);
  for(const side of [-1,1]){
    const tip=wingSection(side*20.3);
    add(foil([0,.6,1.35,2.1].map(y=>({p:tip.p.clone().add(new V3(side*y*.32,y,y*.42)),chord:tip.chord-y*.72,thick:.24-y*.055,cd:new V3(0,0,1),up:new V3(-side,0,0)}))),'paint');
    const flap=[],leading=[];
    for(const ax of [3.5,6,9,12,15,18.8]){
      const s=wingSection(side*ax),t=.77,h=5*(.2969*Math.sqrt(t)-.126*t-.3516*t*t+.2843*t**3-.1036*t**4);
      flap.push(s.p.clone().add(new V3(0,h*s.thick+.025,t*s.chord)));
      leading.push(s.p.clone().add(new V3(0,.025,.025)));
    }
    tube(flap,.022,'seam');tube(leading,.035,'metal');
    for(const ax of [5.1,10.2,15.5]){
      const s=wingSection(side*ax);
      tube([s.p.clone().add(new V3(0,.12,s.chord*.68)),s.p.clone().add(new V3(0,.07,s.chord*.94))],.02,'seam');
      add(new THREE.SphereGeometry(1,12,8).scale(.16,.16,.9),'paint',side*ax,s.p.y-.12,s.p.z+s.chord*.88);
    }
    light(side*20.97,4.24,4.3,side<0?'red':'green');
  }
  add(foil([2.4,3.4,5,6.8,8.5].map(finSection)),'paint');
  add(foil([8.5,9].map(finSection)),'orange');
  add(foil([9,10.8,11.35].map(finSection)),'dark');
  add(foil([-8.2,-6,-3,0,3,6,8.2].map(x=>({p:new V3(x,11.18+Math.abs(x)*.025,13.4+Math.abs(x)*.23),chord:4.9-Math.abs(x)*.33,thick:.56-Math.abs(x)*.034,cd:new V3(0,0,1),up:new V3(0,1,0)}))),'paint');
  const rudder=[3.2,5,7,8.5,10.5].map(y=>{const s=finSection(y);return new V3(.19,y,s.p.z+s.chord*.81);});
  for(const side of [-1,1]){
    tube(rudder.map(p=>new V3(p.x*side,p.y,p.z)),.024,'seam');
    add(new THREE.PlaneGeometry(2.3,1.55).rotateY(side*Math.PI*.5),'tailMark',side*.33,7.25,15.62);
  }
  light(0,11.47,18.1,'white',.12);
  box(.065,.8,.33,0,3.7,-7.8,'dark');box(.06,.48,.35,.5,3.65,3.2,'dark');

  /* ---------------- 깊은 흡입구·회전 팬·배기 코어 ---------------- */
  const fan=fanGeometry(),spinner=lathe([[.02,-.26],[.12,-.2],[.21,-.05],[.22,.12]]);
  for(const x of [-12.6,-6.3,6.3,12.6]){
    const w=wingSection(x),cx=x,cy=w.p.y-1.8,cz=w.p.z+.8;
    add(new THREE.BoxGeometry(.34,1.2,2.25),'paint',cx,cy+1.4,cz+.65);
    add(lathe([[1.02,-2.65],[1.12,-2.5],[1.20,-1.7],[1.17,-.6],[1.08,.7],[.91,1.7],[.65,2.45]]),'paint',cx,cy,cz);
    add(new THREE.TorusGeometry(1.025,.095,10,48),'metal',cx,cy,cz-2.62);
    add(lathe([[.94,-2.64],[.90,-2.25],[.85,-1.6],[.81,-1.32]],true),'intake',cx,cy,cz);
    const rotor=new THREE.Group();rotor.name='엔진팬';rotor.position.set(cx,cy,cz-1.62);root.add(rotor);props.push(rotor);
    const blades=new THREE.Mesh(fan,M.fan),hub=new THREE.Mesh(spinner,M.metal);rotor.add(blades,hub);
    add(lathe([[.62,1.2],[.57,1.9],[.52,2.7],[.49,2.9]]),'exhaust',cx,cy,cz);
    add(lathe([[.38,1.9],[.43,2.55],[.47,2.9]],true),'intake',cx,cy,cz);
    add(lathe([[.24,1.95],[.22,2.75],[.025,3.3]]),'exhaust',cx,cy,cz);
    tube([new V3(cx,cy+1.13,cz-1.9),new V3(cx,cy+1.12,cz+.8)],.018,'seam');
  }

  // 정적 부품은 재질별로 병합하며 기체마다 지오메트리 소유권을 갖는다.
  for(const [key,list] of batches){
    const parts=list.map(g=>{
      const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();
      if(key!=='hull'&&key!=='mark'&&key!=='tailMark'&&n.attributes.uv)n.deleteAttribute('uv');
      return n;
    });
    const g=parts.length===1?parts[0]:THREE.mergeGeometries(parts,false);
    if(parts.length>1)for(const p of parts)p.dispose();
    const mesh=new THREE.Mesh(g,M[key]);mesh.name='수송기_'+key;mesh.castShadow=!['glass','mark','tailMark'].includes(key);mesh.receiveShadow=true;root.add(mesh);
  }
  const topBeacon=light(0,3.56,.6,'red',.12),bottomBeacon=light(0,-3.02,-.6,'red',.11);
  let clock=0;
  root.userData.update=(dt,canJump)=>{
    clock+=dt;topBeacon.visible=bottomBeacon.visible=(clock%1.1)<.12;
    for(const lamp of jumpLights)lamp.material=canJump?M.green:M.red;
  };
  root.userData.props=props;
  root.userData.exits=[new V3(-3.65,-2.2,6.85),new V3(3.65,-2.2,6.85)];
  root.userData.model='LZ-89';root.userData.aircraftType='jet-transport';
  return root;
};
})();
