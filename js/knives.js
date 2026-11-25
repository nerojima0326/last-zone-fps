// knives.js — 칼 6종의 손잡이 접점, 꺼내기·베기·찌르기, 발리송 관절과 근접 타격
(function(){
'use strict';
const G=window.G,T=window.THREE,U=G.U,V=T.Vector3,Q=T.Quaternion;
const catalog={
 knife_butterfly:{file:'butterfly',name:'버터플라이 나이프',short:'발리송',dmg:40,reach:1.75,duration:.61,role:'손목 정렬과 빠른 좌우 연속 베기가 특징인 발리송'},
 knife_dagger:{file:'dagger',name:'양날 단검',short:'단검',dmg:52,reach:1.85,duration:.73,role:'깊은 직선 찌르기와 올려 찌르기에 맞춘 양날 단검'},
 knife_combat:{file:'combat',name:'전투 나이프',short:'전투 나이프',dmg:46,reach:1.8,duration:.64,role:'사선으로 꺼내 위아래 대각선으로 베는 전투 나이프'},
 knife_karambit:{file:'karambit',name:'카람빗',short:'카람빗',dmg:42,reach:1.65,duration:.56,role:'작은 원을 그려 꺼내고 안팎으로 걸어 베는 곡선 칼'},
 knife_kunai:{file:'kunai',name:'쿠나이',short:'쿠나이',dmg:38,reach:1.7,duration:.54,role:'빠르게 올려 잡고 좌우 사선으로 찌르는 쿠나이'},
 knife_machete:{file:'machete',name:'마체테',short:'마체테',dmg:62,reach:2.05,duration:.88,role:'긴 칼을 들어 무겁게 내려 베고 넓게 되받아 베는 마체테'}
};
// 장갑의 실제 스킨 메시로 맞춘 손잡이 접점과 엄지→새끼손가락의 마디별 굽힘.
const grips={
 knife_butterfly:{roll:-0.25,twist:0.6,at:[0,0.04,0],fingers:[[0.78,0.62,0.75],[0.07,0.4,1.4],[0.07,0.8,1.15],[0.42,0.58,1.55],[0.25,0.58,1]]},
 knife_dagger:{roll:-0.25,twist:0.6,at:[0.015,0.03,0],fingers:[[0.07,0.58,1.55],[0.43,0.98,1.55],[0.43,0.8,1.25],[0.78,0.8,1.25],[0.78,1.02,1.15]]},
 knife_combat:{roll:-0.25,twist:0,at:[0.015,0.02,0],turns:{0:[0,0,-.2]},fingers:[[0.25,0.4,1.55],[0.6,0.98,1.25],[0.78,0.8,1.25],[1,1,1],[1,0.8,1.25]]},
 knife_karambit:{roll:-0.65,twist:0,at:[0,0.03,0],fingers:[[1,0.98,0.85],[0.07,1.6,1],[0.07,0.22,1.55],[0.6,1.2,1.55],[0.43,0.8,1.15]]},
 knife_kunai:{roll:-0.25,twist:0,at:[0,0.02,0],fingers:[[0.43,1.2,1.55],[0.25,1.2,1.15],[1,0.8,1.4],[0.78,1.02,1.15],[0.43,1.02,1]]},
 knife_machete:{roll:-0.25,twist:0,at:[0.013,0.022,0],fingers:[[0.07,0.8,1.55],[0.6,0.98,1.25],[0.78,0.8,1.4],[0.78,1.02,1.15],[0.78,1.02,1.15]]}
};
// 네트워크에서 모델을 받지 못해도 기본 손잡이를 같은 자세로 쥔다.
const fallbackGrip={...grips.knife_dagger,fingers:[[.6,.22,1.55],[.43,.8,1.55],[.43,.8,1.25],[.82,.58,1.55],[.6,.8,1]]};
// 각 칼은 서로 다른 꺼내기·정방향/복귀 공격·검사 곡선을 갖는다.
// 준비→타격(.43)→회수의 리듬을 칼의 길이와 무게에 맞추고, 그립은 실제 손에 고정한다.
function curveSlopes(rows){
 const out=rows.map(r=>r.slice(1).map(()=>0));
 for(let i=1;i<rows.length-1;i++)for(let k=1;k<rows[i].length;k++){
  const a=rows[i][0]-rows[i-1][0],b=rows[i+1][0]-rows[i][0],u=(rows[i][k]-rows[i-1][k])/a,v=(rows[i+1][k]-rows[i][k])/b;
  if(u*v>0){const w=2*b+a,z=b+2*a;out[i][k-1]=(w+z)/(w/u+z/v);}
 }
 return out;
}
function clip(name,keys,support=[[0,0,0,0],[1,0,0,0]]){return {name,keys,support,slopes:curveSlopes(keys),supportSlopes:curveSlopes(support)}}
function curveAt(rows,slopes,t,out){
 t=U.clamp(t,0,1);let i=0;while(i<rows.length-2&&t>rows[i+1][0])i++;
 const a=rows[i],b=rows[i+1],span=b[0]-a[0],u=U.clamp((t-a[0])/span,0,1),u2=u*u,u3=u2*u;
 const h0=2*u3-3*u2+1,h1=u3-2*u2+u,h2=-2*u3+3*u2,h3=u3-u2;
 for(let k=1;k<a.length;k++)out[k-1]=h0*a[k]+h1*span*slopes[i][k-1]+h2*b[k]+h3*span*slopes[i+1][k-1];
}
const motionSets={
 knife_butterfly:{drawSeconds:.82,inspectSeconds:2.8,rest:[.14,-.13,-.47],ready:[-.36,2.12,-.28],
  draw:clip('손목 반회전 정렬',[[0,.065,-.235,.085,.45,-.3,-.65],[.24,.055,-.05,.025,-.1,-.65,-1.05],[.48,-.015,.055,-.015,-.35,.6,.65],[.70,.035,.005,.025,.18,.2,-.25],[1,0,0,0,0,0,0]],[[0,-.015,-.025,.025],[.4,-.025,.015,.02],[.75,-.01,0,0],[1,0,0,0]]),
  slash:[
   clip('빠른 수평 베기',[[0,0,0,0,0,0,0],[.17,.075,.045,.025,-.1,.3,-.55],[.43,-.11,.025,-.13,-.25,-.4,1.15],[.61,-.15,-.015,-.035,.1,-.55,1.35],[.82,-.045,-.025,.02,.15,-.15,.3],[1,0,0,0,0,0,0]],[[0,0,0,0],[.32,-.035,-.06,.065],[.72,-.025,-.045,.04],[1,0,0,0]]),
   clip('되돌려 긋기',[[0,0,0,0,0,0,0],[.16,-.045,.045,.035,-.15,-.25,.4],[.43,.095,.015,-.13,-.12,.55,-1],[.62,.12,-.025,-.035,.2,.65,-1.2],[.84,.035,-.025,.015,.1,.15,-.3],[1,0,0,0,0,0,0]],[[0,0,0,0],[.3,-.045,-.055,.07],[.7,-.025,-.035,.04],[1,0,0,0]])
  ],
  inspect:clip('날 양면과 잠금 확인',[[0,0,0,0,0,0,0],[.22,-.10,.075,-.025,-.15,-.8,.4],[.48,-.10,.09,-.015,.05,.85,.55],[.72,-.06,.055,.005,.1,-.45,-.1],[1,0,0,0,0,0,0]],[[0,0,0,0],[.3,-.02,-.015,.035],[.7,-.025,-.015,.03],[1,0,0,0]])
 },
 knife_dagger:{drawSeconds:.58,inspectSeconds:2.25,rest:[.115,-.145,-.48],ready:[-.42,2.15,-.12],
  draw:clip('중앙으로 뽑아 세우기',[[0,-.035,-.30,.135,.85,.15,.3],[.32,-.025,-.09,.055,.35,-.15,.15],[.60,-.015,.045,-.04,-.35,-.1,-.15],[.82,.005,.01,-.01,-.1,.05,.05],[1,0,0,0,0,0,0]],[[0,-.02,-.035,.03],[.48,-.01,.035,.025],[.78,-.005,.015,.01],[1,0,0,0]]),
  slash:[
   clip('깊은 직선 찌르기',[[0,0,0,0,0,0,0],[.22,.015,-.045,.075,.35,.05,-.1],[.43,-.025,.045,-.20,-.9,-.1,.1],[.58,-.025,.035,-.16,-.7,-.08,.15],[.79,.005,-.025,.035,.2,.1,.05],[1,0,0,0,0,0,0]],[[0,0,0,0],[.26,-.035,-.035,.07],[.66,-.025,-.025,.065],[1,0,0,0]]),
   clip('아래에서 올려 찌르기',[[0,0,0,0,0,0,0],[.22,.025,-.075,.045,.6,.15,-.45],[.43,.005,.085,-.17,-.7,.2,-.55],[.64,-.015,.105,-.085,-.4,.25,-.3],[.84,.005,.025,.015,.1,.05,.05],[1,0,0,0,0,0,0]],[[0,0,0,0],[.32,-.035,-.055,.065],[.72,-.015,-.04,.04],[1,0,0,0]])
  ],
  inspect:clip('양날과 가드 살피기',[[0,0,0,0,0,0,0],[.27,-.065,.105,-.045,-.25,-.35,.15],[.53,-.09,.09,-.035,.1,.7,-.25],[.76,-.035,.055,-.01,-.15,.3,.1],[1,0,0,0,0,0,0]],[[0,0,0,0],[.4,-.015,-.015,.025],[.7,-.02,-.02,.02],[1,0,0,0]])
 },
 knife_combat:{drawSeconds:.66,inspectSeconds:2.15,rest:[.14,-.15,-.47],ready:[-.34,1.95,-.35],
  draw:clip('옆 칼집에서 대각선 인출',[[0,.085,-.275,.055,.55,.65,-1],[.30,.075,-.11,.025,.35,.4,-.65],[.63,-.02,.025,-.035,-.2,-.2,.25],[.85,-.005,.005,-.005,-.05,-.05,.05],[1,0,0,0,0,0,0]],[[0,-.015,-.02,.035],[.32,-.025,.02,.02],[.67,-.03,.005,.02],[1,0,0,0]]),
  slash:[
   clip('오른쪽 위에서 내려베기',[[0,0,0,0,0,0,0],[.22,.075,.09,.035,-.35,.35,-.8],[.43,-.09,-.035,-.12,.35,-.4,1.25],[.66,-.13,-.135,-.02,.7,-.6,1.5],[.85,-.025,-.055,.025,.2,-.15,.35],[1,0,0,0,0,0,0]],[[0,0,0,0],[.3,-.025,-.075,.07],[.74,-.015,-.06,.055],[1,0,0,0]]),
   clip('왼쪽 아래에서 되받아 베기',[[0,0,0,0,0,0,0],[.20,-.07,-.055,.045,.35,-.25,.5],[.43,.055,.04,-.13,-.4,.3,-1],[.65,.10,.105,-.02,-.55,.4,-1.3],[.85,.025,.025,.02,-.1,.1,-.3],[1,0,0,0,0,0,0]],[[0,0,0,0],[.3,-.04,-.05,.065],[.74,-.025,-.035,.04],[1,0,0,0]])
  ],
  inspect:clip('손등 쪽으로 칼날 확인',[[0,0,0,0,0,0,0],[.25,-.06,.06,.005,.2,-.55,.65],[.5,-.08,.08,-.025,-.2,.35,.35],[.76,-.04,.04,.015,.1,.55,-.15],[1,0,0,0,0,0,0]],[[0,0,0,0],[.38,-.025,-.02,.02],[.75,-.015,-.025,.02],[1,0,0,0]])
 },
 knife_karambit:{drawSeconds:.74,inspectSeconds:2.5,rest:[.17,-.175,-.46],ready:[-.25,1.95,-.5],
  draw:clip('작은 원을 그려 갈고리 정렬',[[0,.055,-.175,.145,.2,-.65,1],[.22,.075,.015,.065,-.3,-.85,.65],[.48,-.035,.065,-.015,-.1,.6,-.9],[.72,.015,-.025,.01,.3,.25,-.35],[1,0,0,0,0,0,0]],[[0,-.02,0,.045],[.38,-.035,-.025,.05],[.75,-.015,-.015,.025],[1,0,0,0]]),
  slash:[
   clip('안쪽으로 짧게 걸어베기',[[0,0,0,0,0,0,0],[.18,.075,-.025,.045,.15,.55,-.4],[.43,-.10,-.035,-.075,.25,-.8,1.5],[.64,-.085,.035,-.025,-.25,-.6,1.15],[.84,-.025,.015,.02,-.15,-.15,.2],[1,0,0,0,0,0,0]],[[0,0,0,0],[.25,-.025,-.035,.075],[.65,-.015,-.025,.055],[1,0,0,0]]),
   clip('바깥쪽으로 감아 긋기',[[0,0,0,0,0,0,0],[.18,-.05,.015,.045,-.25,-.35,.55],[.43,.075,-.07,-.09,.55,.75,-1.35],[.63,.035,-.11,.005,.65,.5,-.85],[.84,-.005,-.035,.025,.2,.15,-.2],[1,0,0,0,0,0,0]],[[0,0,0,0],[.28,-.035,-.035,.065],[.7,-.025,-.025,.045],[1,0,0,0]])
  ],
  inspect:clip('곡선 날과 고리 돌려 보기',[[0,0,0,0,0,0,0],[.24,-.075,.065,.025,.35,-.65,-.75],[.49,-.11,.08,-.015,-.25,.7,.85],[.74,-.045,.055,.025,.15,-.3,.45],[1,0,0,0,0,0,0]],[[0,0,0,0],[.35,-.035,-.02,.035],[.7,-.025,-.025,.03],[1,0,0,0]])
 },
 knife_kunai:{drawSeconds:.50,inspectSeconds:2.05,rest:[.11,-.145,-.48],ready:[-.5,2.2,.05],
  draw:clip('아래에서 튕겨 올려 잡기',[[0,-.015,-.33,-.025,1,-.25,.75],[.28,-.035,-.09,-.075,.4,-.6,.5],[.52,.03,.075,-.045,-.4,.45,-.5],[.78,.015,.005,.015,.2,.15,-.15],[1,0,0,0,0,0,0]],[[0,-.01,-.015,.015],[.4,-.03,.04,-.005],[.72,-.015,.005,.02],[1,0,0,0]]),
  slash:[
   clip('오른쪽 사선으로 찌르기',[[0,0,0,0,0,0,0],[.16,-.015,-.065,.025,.4,-.2,.25],[.43,.065,.02,-.145,-.65,.5,-.6],[.59,.085,-.035,-.06,-.3,.65,-.45],[.80,.015,-.025,.035,.2,.1,-.1],[1,0,0,0,0,0,0]],[[0,0,0,0],[.23,-.03,-.045,.055],[.62,-.02,-.025,.035],[1,0,0,0]]),
   clip('왼쪽 낮은 사선으로 찌르기',[[0,0,0,0,0,0,0],[.17,.035,-.015,.045,.2,.25,-.35],[.43,-.075,-.02,-.14,-.55,-.4,.55],[.61,-.09,-.07,-.025,.2,-.5,.75],[.82,-.015,-.035,.02,.15,-.1,.15],[1,0,0,0,0,0,0]],[[0,0,0,0],[.24,-.035,-.055,.055],[.68,-.025,-.03,.03],[1,0,0,0]])
  ],
  inspect:clip('끝을 세워 균형 확인',[[0,0,0,0,0,0,0],[.24,-.035,.12,-.035,-.5,-.25,-.15],[.47,-.06,.075,-.055,-.15,.75,.6],[.74,-.02,.045,.015,.25,-.25,.25],[1,0,0,0,0,0,0]],[[0,0,0,0],[.3,-.02,-.005,.035],[.7,-.03,-.015,.03],[1,0,0,0]])
 },
 knife_machete:{drawSeconds:.94,inspectSeconds:2.95,rest:[.16,-.17,-.50],ready:[-.4,1.98,-.14],
  draw:clip('긴 칼을 크게 들어 올리기',[[0,.06,-.35,.14,.95,.4,-.25],[.30,.075,-.15,.07,.65,.35,-.35],[.62,.02,.065,-.015,-.35,-.25,.25],[.82,-.015,.015,-.01,-.12,-.1,.1],[1,0,0,0,0,0,0]],[[0,-.035,-.03,.065],[.32,-.04,.005,.035],[.65,-.03,-.015,.055],[1,0,0,0]]),
  slash:[
   clip('머리 위에서 무겁게 내려베기',[[0,0,0,0,0,0,0],[.24,.055,.115,.06,-.65,.15,-.25],[.43,-.015,-.06,-.115,.55,-.18,.45],[.67,-.035,-.175,.035,1,-.4,.95],[.86,-.025,-.07,.045,.35,-.1,.25],[1,0,0,0,0,0,0]],[[0,0,0,0],[.32,-.045,-.09,.10],[.78,-.025,-.065,.075],[1,0,0,0]]),
   clip('반대쪽 넓은 수평 베기',[[0,0,0,0,0,0,0],[.25,-.085,.06,.045,-.15,-.4,.7],[.43,.11,-.03,-.12,.15,.6,-1.15],[.68,.145,-.10,.005,.45,.8,-1.5],[.87,.04,-.055,.04,.25,.2,-.35],[1,0,0,0,0,0,0]],[[0,0,0,0],[.32,-.05,-.08,.09],[.78,-.03,-.055,.065],[1,0,0,0]])
  ],
  inspect:clip('넓은 날을 천천히 기울여 보기',[[0,0,0,0,0,0,0],[.28,-.07,.09,.015,.2,-.65,.3],[.54,-.10,.115,-.015,-.25,.45,-.3],[.78,-.045,.065,.025,.15,.75,.15],[1,0,0,0,0,0,0]],[[0,0,0,0],[.4,-.04,-.025,.065],[.75,-.035,-.03,.05],[1,0,0,0]])
 }
};
for(const [id,m]of Object.entries(motionSets)){catalog[id].draw=m.drawSeconds;catalog[id].inspect=m.inspectSeconds;}
for(const [id,d]of Object.entries(catalog)){d.id=id;G.WEAPONS[id]={key:id,name:d.name,short:d.short,dmg:d.dmg,rpm:60/d.duration,melee:true};}
const ids=Object.keys(catalog),_p=new V(),_d=new V(),_eye=new V(),_forward=new V(),_q=new Q(),_q2=new Q(),_e=new T.Euler();
const K=G.Knives={catalog,ids,motionSets,templates:{},motion:null,ready:false,loaded:0,
 is(id){return !!catalog[id]},
 async load(renderer){
  if(location.protocol==='file:'||!T.GLTFLoader)return;
  const loader=new T.GLTFLoader();if(T.MeshoptDecoder)loader.setMeshoptDecoder(T.MeshoptDecoder);
  const base='assets/models/knives/',tag='?v='+(window.LZ_BUILD||'');
  await Promise.allSettled([
   fetch(base+'motion.json'+tag).then(r=>{if(!r.ok)throw Error('모션 없음');return r.json()}).then(j=>{this.motion=j.clips}),
   ...ids.map(async id=>{
    try{
     const model=await loader.loadAsync(base+catalog[id].file+'.glb'+tag),root=model.scene;
     root.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;for(const mat of Array.isArray(o.material)?o.material:[o.material])for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(mat[key])mat[key].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());});
     root.userData.imported=true;this.templates[id]=root;this.loaded++;
    }catch(e){console.info('[칼] '+catalog[id].name+' 기본 모델 사용');}
   })
  ]);this.ready=this.loaded===ids.length&&!!this.motion;
 },
 fallback(id){
  const root=new T.Group(),d=catalog[id],steel=new T.MeshStandardMaterial({color:0x9caeb6,metalness:.85,roughness:.3}),grip=new T.MeshStandardMaterial({color:0x202b25,roughness:.8});
  const box=(w,h,z,mat,x,y,parent=root)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,z),mat);m.position.set(x,y,0);parent.add(m);return m};
  if(d.file==='butterfly'){
   for(const [name,x]of [['safeHandle',-.011],['biteHandle',.011]]){const p=new T.Group();p.name=name;p.position.set(x,.065,0);root.add(p);box(.012,.126,.010,grip,0,-.062,p);}
   const p=new T.Group();p.name='blade';p.position.y=.065;root.add(p);box(.023,.12,.0039,steel,0,.06,p);
  }else{
   box(.020,.11,.016,grip,0,-.005);box(.045,.010,.014,steel,0,.060);
   const long=d.file==='machete'?.29:.15,shape=new T.Shape(),curve=d.file==='karambit';
   shape.moveTo(-.014,.055);shape.lineTo(curve?-.065:-.014,.055+long*.65);shape.lineTo(curve?-.07:0,.055+long);shape.lineTo(.016,.055+long*.72);shape.lineTo(.016,.055);shape.closePath();
   root.add(new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.005,bevelEnabled:false}),steel));
  }
  root.userData.imported=false;return root;
 },
 model(id){if(!this.templates[id])this.templates[id]=this.fallback(id);return this.templates[id].clone(true)},
 buildVM(id){
  const m=G.Guns.buildHands('fists');m.type='knife';m.id=id;m.cls='melee';m.knife=this.model(id);m.grip=new T.Group();m.grip.add(m.knife);m.root.add(m.grip);
  if(id==='knife_machete'&&m.knife.userData.imported)m.knife.scale.setScalar(.82);
  // 칼의 길이 축을 손가락 진행 방향이 아닌 검지와 새끼손가락을 잇는 가로축에 맞춘다.
  const profile=m.knifeProfile=this.gripProfile(id,m.knife.userData.imported),turn=new Q().setFromAxisAngle(new V(0,0,1),profile.roll).multiply(new Q().setFromAxisAngle(new V(0,1,0),profile.twist));
  m.bladeOffset=new Q().setFromRotationMatrix(new T.Matrix4().makeBasis(new V(0,1,0),new V(1,0,0),new V(0,0,-1))).multiply(turn);
  m.neutral=new Q().setFromEuler(new T.Euler(...motionSets[id].ready)).multiply(turn);m.handOffset=m.bladeOffset.clone().invert();
  m.knife.position.copy(this.gripOffset(id,m.bladeOffset,m.knife.userData.imported));m.knifeRest=m.knife.position.clone();m.hinges=this.rig(m.knife);
  m.parts.left.position.set(0,0,0);m.parts.right.position.set(0,0,0);m.baseHands={};
  for(const [side,r]of Object.entries(m.staticArms)){
   r.baseS.set(side==='R'?.20:-.24,side==='R'?-.25:-.29,side==='R'?-.08:-.05);r.S.copy(r.baseS);if(side==='R')r.rest.set(...motionSets[id].rest);else r.rest.set(-.20,-.25,-.48);r.cur.copy(r.rest);r.tgt.copy(r.rest);r.contactMode='grip';r.motionWeight=.5;
   m.baseHands[side]=side==='R'?m.neutral.clone().multiply(m.handOffset):r.handQ.clone();
   const prefix=side==='R'?'Right':'Left';r.bW.name=prefix+'Hand';
   for(let f=0;f<4;f++)for(let i=0;i<3;i++)r.fing[f][i].name=prefix+'Hand'+['Index','Middle','Ring','Pinky'][f]+(i+1);
   for(let i=0;i<3;i++)r.thumbB[i].name=prefix+'HandThumb'+(i+1);
  }
  m.muzzle.set(0,.15,0);m.curve={r:new V(),l:new V(),q:new Q(),e:new T.Euler()};m.root.userData.knife=id;return m;
 },
 gripProfile(id,imported=true){return !imported&&id!=='knife_butterfly'?fallbackGrip:grips[id]},
 gripOffset(id,frame,imported=true){
  return new V(...this.gripProfile(id,imported).at).applyQuaternion(frame.clone().invert());
 },
 rig(root){
  if(root._knifeHinges)return root._knifeHinges;
  const safe=root.getObjectByName('safeHandle'),bite=root.getObjectByName('biteHandle'),blade=root.getObjectByName('blade');
  if(!safe||!bite||!blade)return {};
  // 두 번째 핀은 칼날 탱에 붙어 움직인다. 세 부품을 제자리에서 따로 돌리면 경첩이 분리된다.
  const tang=new T.Group();tang.name='knifeTang';tang.position.copy(safe.position);root.add(tang);
  blade.position.sub(safe.position);bite.position.sub(safe.position);tang.add(blade,bite);
  return root._knifeHinges={safe,tang,blade,bite};
 },
 sample(kind,t,out,id='knife_butterfly',variant=0){
  out.r.set(0,0,0);out.l.set(0,0,0);out.q.identity();out.curl=.9;out.thumb=.72;
  if(kind==='idle')return out;
  const set=motionSets[id],motion=kind==='slash'?set.slash[variant%set.slash.length]:set[kind];
  if(!motion)return out;
  const values=out.values||(out.values=new Float64Array(6));
  curveAt(motion.keys,motion.slopes,t,values);out.r.set(values[0],values[1],values[2]);out.q.setFromEuler(_e.set(values[3],values[4],values[5]));
  curveAt(motion.support,motion.supportSlopes,t,values);out.l.set(values[0],values[1],values[2]);return out;
 },
 fitRealGrip(m,r,S,unit){
  // IK 목표가 아니라 화면에 보이는 실제 손 뼈의 완전한 변환을 따른다.
  // 아래팔의 비균일 스케일도 보존해 팔을 비틀 때 손잡이가 장갑 안으로 미끄러지지 않는다.
  const f=m.realGrip||(m.realGrip={matrix:new T.Matrix4(),turn:new T.Matrix4(),at:new T.Matrix4(),scale:new T.Matrix4(),q:new Q(),p:new V()});
  S.b.hand.updateWorldMatrix(true,false);m.root.updateWorldMatrix(true,false);
  const ratio=S.palmLen*unit/(G.ARM_CONST.middleBase*G.ARM_CONST.handS);
  f.p.copy(r.anchorLocal).multiplyScalar(G.ARM_CONST.handS*ratio);
  f.matrix.copy(m.root.matrixWorld).invert().multiply(S.b.hand.matrixWorld).multiply(f.turn.makeRotationFromQuaternion(f.q.copy(S.handInv).invert())).multiply(f.scale.makeScale(1/unit,1/unit,1/unit)).multiply(f.at.makeTranslation(f.p.x,f.p.y,f.p.z)).multiply(f.turn.makeRotationFromQuaternion(m.bladeOffset));
  m.grip.matrixAutoUpdate=false;m.grip.matrix.copy(f.matrix);m.grip.matrix.decompose(m.grip.position,m.grip.quaternion,m.grip.scale);m.grip.updateMatrixWorld(true);
 },
 actionCurve(action,id,out){
  const t=action?U.clamp(action.t/action.duration,0,1):0,c=this.sample(action?.kind||'idle',t,out,id,action?.variant||0);
  if(action?.blendFrom){
   const f=action.blendFrom,w=1-U.smoothstep(0,.24,t);c.r.lerp(f.r,w);c.l.lerp(f.l,w);c.q.slerp(f.q,w);c.curl=U.lerp(c.curl,f.curl,w);c.thumb=U.lerp(c.thumb,f.thumb,w);
  }
  return c;
 },
 poseVM(vm,m,dt,s){
  const c=this.actionCurve(s.melee,m.id,m.curve),R=m.staticArms.R,L=m.staticArms.L,drawStart=s.melee?.kind==='draw'&&m.poseAction!==s.melee;
  m.poseAction=s.melee;
  // 칼을 바꿔 들 때도 해당 손잡이에 맞는 굽힘을 바로 적용해 장갑이 그립 안으로 지나가지 않게 한다.
  R.curl=R.trig=c.curl;R.thumb=c.thumb;
  _p.copy(R.rest).add(c.r);_q.copy(m.neutral).multiply(c.q).multiply(m.handOffset);
  // 꺼내기는 화면 아래의 시작 자세에서 들어 올린다. 이전 대기 위치로 먼저 내려가지 않는다.
  G.Guns.poseStaticArm(R,_p,_q,dt,c.curl,c.thumb,drawStart);
  _p.copy(L.rest).add(c.l);_q.copy(m.baseHands.L);G.Guns.poseStaticArm(L,_p,_q,dt,.7,.6,drawStart);
  m.grip.matrixAutoUpdate=true;m.grip.scale.setScalar(1);m.grip.position.copy(R.contact);m.grip.quaternion.copy(R.handQ).multiply(m.bladeOffset);
  this.poseHinges(m.hinges);
  m.knife.position.copy(m.knifeRest);m.knife.quaternion.identity();
  m.root.position.set(Math.sin(s.phase)*.008*s.moving,Math.sin(vm.t*1.7)*.002-s.landDip*.04-(1-s.raise)*.22,0);
  m.root.rotation.set(-(1-s.raise)*.55-vm.sprint*.12,vm.sway.x,vm.sway.y);
  m.root.position.y-=vm.sprint*.055;m.root.rotation.z+=vm.sprint*.12;
  vm.flashLight.intensity=0;vm.camRX=vm.camRY=vm.camRZ=0;
 },
 poseHinges(h){
  // 전개된 발리송의 두 손잡이와 칼날은 사용 중 잠긴 상태를 유지한다.
  if(h.tang){h.tang.rotation.z=0;h.bite.rotation.z=0;}
 },
 cycle(p){
  const a=p.a;if(a.state!=='ground'||a.knocked||p.vehicle||p.throwSt)return false;
  if(a.cur==='melee')a.knife=ids[(ids.indexOf(a.knife)+1)%ids.length];
  else p.switchTo('melee');return true;
 },
 start(p,kind){
  const a=p.a,d=catalog[a.knife];
  if(!d||a.cur!=='melee'||a.state!=='ground'||!a.alive||a.knocked||p.sw||p.throwSt||p.heal||p.revive||p.vehicle||p.sprinting)return false;
  if(kind==='inspect'&&p.melee&&p.melee.kind!=='inspect')return false;
  let blendFrom;
  if(kind==='slash'&&p.melee?.kind==='inspect'){
   blendFrom=this.sample('inspect',U.clamp(p.melee.t/p.melee.duration,0,1),{r:new V(),l:new V(),q:new Q(),e:new T.Euler()},a.knife);
  }
  let variant=0;
  if(kind==='slash'){
   const chain=p.knifeCombo;if(chain?.id===a.knife&&p.time-chain.at<=d.duration+.45)variant=1-chain.variant;
   p.knifeCombo={id:a.knife,variant,at:p.time};
  }else p.knifeCombo=null;
  p.melee={id:a.knife,kind,variant,t:0,duration:kind==='slash'?d.duration:kind==='draw'?d.draw:d.inspect,hit:false,sounds:0,blendFrom};a.melee=p.melee;
  if(kind==='slash'){p.nextFire=p.time+d.duration;G.Audio.click('punch');if(G.Training?.active)p.melee.shot=G.Training.onShot();}
  else G.Audio.click('switch');return true;
 },
 tick(p,dt){
  const a=p.a;
  if(a.cur!=='melee'||!a.alive||a.knocked||a.state!=='ground'||p.vehicle){p.melee=null;a.melee=null;p.knifeSeen=null;p.knifeCombo=null;return;}
  if(p.knifeSeen!==a.knife){p.knifeSeen=a.knife;p.knifeCombo=null;p.melee={id:a.knife,kind:'draw',t:0,duration:catalog[a.knife].draw||.58,hit:false,sounds:0};a.melee=p.melee;}
  if(p.heal||p.revive||p.throwSt||p.sprinting){p.melee=null;a.melee=null;p.knifeCombo=null;return;}
  const I=G.Input;
  if((I.hit('KeyT')||I.rmbHit)&&!p.melee)this.start(p,'inspect');
  if(I.lmb&&!p.sw&&p.time>=p.nextFire&&(!p.melee||p.melee.kind==='inspect'))this.start(p,'slash');
  const action=p.melee;if(!action)return;
  action.t+=dt;
  if(action.kind==='slash'&&!action.hit&&action.t>=action.duration*.43){action.hit=true;this.hit(p,action);}
  if(action.t>=action.duration){p.melee=null;a.melee=null;}
 },
 hit(p,action){
  const a=p.a,d=catalog[action.id];if(a.cur!=='melee'||a.knife!==action.id||!a.alive)return;
  a.eye(_eye);a.lookDir(_forward);let target=null,best=d.reach;
  for(const b of G.Game.actors){
   if(!b.alive||b.team===a.team||b.state!=='ground')continue;
   b.chest(_p);_d.copy(_p).sub(_eye);const dist=_d.length();
   if(dist>best||dist<.02||_d.divideScalar(dist).dot(_forward)<.76)continue;
   if(G.World.raycast(_eye,_d,Math.max(.01,dist-.06)))continue;
   target=b;best=dist;
  }
  if(target){
   target.chest(_p);_d.copy(_p).sub(_eye).normalize();G.Game.damage(target,d.dmg,a,action.id,false,_p,_d);G.FX.blood(_p,_d.x,_d.y,_d.z,5);G.Audio.impact(_p,'flesh');return;
  }
  if(G.Training?.active){
   const hit=G.Training.hitTest(_eye,_forward,d.reach);
   if(hit&&!G.World.raycast(_eye,_forward,Math.max(.01,hit.t-.03))){
    _p.copy(_eye).addScaledVector(_forward,hit.t);G.Training.onHit(hit,d.dmg,_p,_forward,action.shot||{hit:false});G.Audio.impact(_p,'metal');return;
   }
  }
  const wall=G.World.raycast(_eye,_forward,d.reach);
  if(wall){const mat=G.World.hit.mat||'concrete';_p.copy(G.World.hit.point);_d.copy(G.World.hit.normal);G.Audio.impact(_p,mat);G.FX.impact(_p,_d,mat);}
 },
 equip(p,id){
  if(!this.is(id)||!p.a?.alive||p.a.knocked||p.a.state!=='ground'||p.throwSt||p.vehicle)return false;p.a.knife=id;p.reload=p.autoReload=null;p.melee=null;p.knifeSeen=null;
  p.switchTo('melee');return true;
 },
 poseTP(m,a){
  const action=a.melee,c=m.knifeCurve||(m.knifeCurve={r:new V(),l:new V(),q:new Q(),e:new T.Euler()}),t=action?U.clamp(action.t/action.duration,0,1):0;
  this.actionCurve(action,a.knife||m.curGun,c);c.e.setFromQuaternion(c.q);m.gunMount.position.set(.24+c.r.x*.6,-.14+c.r.y*.6,-.34+c.r.z*.6);
  m.armL.rotation.set(.75+c.l.z,0,.15);m.elbowL.rotation.x=.8;
  m.armR.rotation.set(1.2-c.r.z*3.5+c.e.x*.25,c.r.x*3+c.e.y*.3,-.2+c.r.y*2+c.e.z*.45);m.elbowR.rotation.x=.6+c.r.z*2-c.e.x*.15;m.ikGun='knife';
  const knife=m.guns[m.curGun];if(knife){
   knife.rotation.set(-.25,0,-.27-(action?.kind==='slash'?Math.sin(t*Math.PI)*1.0:0));
   const hinges=knife._hinges||(knife._hinges=this.rig(knife));this.poseHinges(hinges);
  }
 },
 handTP(m,active,action){
  const root=m.soldier?.root;if(!root)return;
  let hand=m.knifeHand;
  if(!active){if(hand?.active){for(const f of hand.fingers)f.bone.quaternion.copy(f.bind);hand.active=false;}return;}
  if(m.lod)return;
  const knife=m.guns[m.curGun];if(!knife)return;
  m.root.updateMatrixWorld(true);
  if(!hand){
   const wrist=root.getObjectByName('RightHand'),index=root.getObjectByName('RightHandIndex1'),little=root.getObjectByName('RightHandPinky1');
   if(!wrist||!index||!little)return;
   const inv=wrist.matrixWorld.clone().invert(),ip=index.getWorldPosition(new V()).applyMatrix4(inv),lp=little.getWorldPosition(new V()).applyMatrix4(inv);
   const y=ip.clone().sub(lp).normalize(),n=new V().crossVectors(ip,lp).normalize(),palm=ip.clone().add(lp).multiplyScalar(.36).addScaledVector(n,.018),fingers=[];
   for(const name of ['Index','Middle','Ring','Pinky'])for(let i=1;i<=3;i++){
    const bone=root.getObjectByName('RightHand'+name+i),child=root.getObjectByName('RightHand'+name+(i+1));if(!bone||!child)continue;
    const dir=child.getWorldPosition(new V()).sub(bone.getWorldPosition(new V())).normalize(),normal=n.clone().transformDirection(wrist.matrixWorld);
    const axis=new V().crossVectors(dir,normal).normalize().applyQuaternion(bone.getWorldQuaternion(new Q()).invert());
    fingers.push({bone,bind:bone.quaternion.clone(),axis,angle:[.85,1.15,.8][i-1]});
   }
   hand=m.knifeHand={wrist,palm,y,n,fingers,active:false,worldY:new V(),worldZ:new V(),worldX:new V(),basis:new T.Matrix4()};
  }
  hand.active=true;
  for(const f of hand.fingers)f.bone.quaternion.copy(f.bind).multiply(_q.setFromAxisAngle(f.axis,f.angle));
  hand.wrist.updateMatrixWorld(true);
  // 원점 사이의 빈 공간이 아니라 고정 손잡이의 중심을 실제 손바닥에 맞춘다.
  const y=hand.worldY.copy(hand.y).transformDirection(hand.wrist.matrixWorld),z=hand.worldZ.copy(hand.n).transformDirection(hand.wrist.matrixWorld),x=hand.worldX.crossVectors(y,z).normalize();z.crossVectors(x,y).normalize();
  knife.position.copy(m.gunMount.worldToLocal(_p.copy(hand.palm).applyMatrix4(hand.wrist.matrixWorld)));
  knife.quaternion.copy(m.gunMount.getWorldQuaternion(_q).invert()).multiply(_q2.setFromRotationMatrix(hand.basis.makeBasis(x,y,z)));
  _p.set(m.curGun==='knife_butterfly'?-.011:0,-.02,0).multiply(knife.scale).applyQuaternion(knife.quaternion);knife.position.sub(_p);
 }
};
})();
