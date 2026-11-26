// knives.js — 칼 6종의 손잡이 접점, 꺼내기·베기·찌르기, 발리송 관절과 근접 타격
(function(){
'use strict';
const G=window.G,T=window.THREE,U=G.U,V=T.Vector3,Q=T.Quaternion;
const catalog={
 knife_butterfly:{file:'butterfly',name:'버터플라이 나이프',short:'발리송',dmg:40,reach:1.75,duration:.61,role:'접힌 칼을 펴서 잡고 짧고 빠르게 베는 발리송'},
 knife_dagger:{file:'dagger',name:'양날 단검',short:'단검',dmg:52,reach:1.85,duration:.73,role:'깊은 직선 찌르기와 올려 찌르기에 맞춘 양날 단검'},
 knife_combat:{file:'combat',name:'전투 나이프',short:'전투 나이프',dmg:46,reach:1.8,duration:.64,role:'사선으로 꺼내 위아래 대각선으로 베는 전투 나이프'},
 knife_karambit:{file:'karambit',name:'카람빗',short:'카람빗',dmg:42,reach:1.65,duration:.56,role:'검지 고리를 지지해 돌려 잡고 갈고리 날을 확장해 베는 카람빗'},
 knife_kunai:{file:'kunai',name:'쿠나이',short:'쿠나이',dmg:38,reach:1.7,duration:.54,role:'안쪽으로 당겨 쥐고 칼끝을 곧게 뻗거나 올려 긋는 쿠나이'},
 knife_machete:{file:'machete',name:'마체테',short:'마체테',dmg:62,reach:2.05,duration:.88,role:'긴 칼을 들어 무겁게 내려 베고 넓게 되받아 베는 마체테'}
};
// 장갑의 실제 스킨 메시로 맞춘 손잡이 접점과 엄지→새끼손가락의 마디별 굽힘.
const grips={
 knife_butterfly:{roll:-0.25,twist:0.6,at:[0,0.04,0],fingers:[[.5,.5,.6],[.05,.2,.3],[.0385,.44,.6325],[.231,.319,.8525],[.1375,.319,.55]]},
 knife_dagger:{roll:-0.25,twist:0.6,at:[0.015,0.03,0],fingers:[[0.07,0.58,1.55],[0.43,0.98,1.55],[0.43,0.8,1.25],[0.78,0.8,1.25],[0.78,1.02,1.15]]},
 knife_combat:{roll:-0.25,twist:0,at:[0.015,0.02,0],turns:{0:[0,0,-.2]},fingers:[[0.25,0.4,1.55],[0.6,0.98,1.25],[0.78,0.8,1.25],[1,1,1],[1,0.8,1.25]]},
 knife_karambit:{roll:-0.65,twist:0,at:[0,0.03,0],fingers:[[1.4,1.4,1.4],[.02,.08,.1],[1,1,1],[1,1,1],[1,1,1]]},
 knife_kunai:{roll:-0.25,twist:0,at:[0,0.02,0],fingers:[[0.43,1.2,1.55],[0.25,1.2,1.15],[1,0.8,1.4],[0.78,1.02,1.15],[0.43,1.02,1]]},
 knife_machete:{roll:-0.25,twist:0,at:[0.013,0.022,0],fingers:[[0.07,0.8,1.55],[0.6,0.98,1.25],[0.78,0.8,1.4],[0.78,1.02,1.15],[0.78,1.02,1.15]]}
};
// 네트워크에서 모델을 받지 못해도 기본 손잡이를 같은 자세로 쥔다.
const fallbackGrip={...grips.knife_dagger,fingers:[[.6,.22,1.55],[.43,.8,1.55],[.43,.8,1.25],[.82,.58,1.55],[.6,.8,1]]};
// 각 칼은 서로 다른 꺼내기·정방향/복귀 공격·검사 곡선을 갖는다.
// 준비→타격(.43)→감속→회수의 리듬을 칼의 길이와 무게에 맞춘다.
// 발리송 관절은 칼날·자유 손잡이 각도(도), 중지~새끼손가락의 벌림을 따로 기록한다.
function curveSlopes(rows){
 const out=rows.map(r=>r.slice(1).map(()=>0));
 for(let i=1;i<rows.length-1;i++)for(let k=1;k<rows[i].length;k++){
  const a=rows[i][0]-rows[i-1][0],b=rows[i+1][0]-rows[i][0],u=(rows[i][k]-rows[i-1][k])/a,v=(rows[i+1][k]-rows[i][k])/b;
  if(u*v>0){const w=2*b+a,z=b+2*a;out[i][k-1]=(w+z)/(w/u+z/v);}
 }
 return out;
}
function clip(name,keys,support=[[0,0,0,0],[1,0,0,0]],joints=null,handling=null){return {name,keys,support,joints,handling,slopes:curveSlopes(keys),supportSlopes:curveSlopes(support),jointSlopes:joints?curveSlopes(joints):null,handlingSlopes:handling?curveSlopes(handling):null}}
function curveAt(rows,slopes,t,out){
 t=U.clamp(t,0,1);let i=0;while(i<rows.length-2&&t>rows[i+1][0])i++;
 const a=rows[i],b=rows[i+1],span=b[0]-a[0],u=U.clamp((t-a[0])/span,0,1),u2=u*u,u3=u2*u;
 const h0=2*u3-3*u2+1,h1=u3-2*u2+u,h2=-2*u3+3*u2,h3=u3-u2;
 for(let k=1;k<a.length;k++)out[k-1]=h0*a[k]+h1*span*slopes[i][k-1]+h2*b[k]+h3*span*slopes[i+1][k-1];
}
const motionSets={
 knife_butterfly:{drawSeconds:1.16,inspectSeconds:3.15,rest:[.135,-.13,-.47],ready:[-.36,2.12,-.28],
  draw:clip('닫힌 그립에서 바깥 전개 후 재그립',[[0,.035,-.24,.08,.32,-.25,-.40],[.18,.025,-.045,.02,.08,-.25,-.22],[.35,.035,.015,-.01,-.12,.16,.26],[.53,.015,.03,-.02,-.18,-.20,-.24],[.70,-.015,.015,-.01,.06,.12,.16],[.84,.005,-.005,.005,.04,-.04,-.08],[1,0,0,0,0,0,0]],[[0,-.015,-.025,.02],[.27,-.015,.015,.005],[.65,-.035,-.015,.035],[1,0,0,0]],[[0,-180,180,1],[.19,-180,180,1],[.42,-8,177,1],[.54,0,155,1],[.72,0,0,1],[.84,0,0,0],[1,0,0,0]]),
  slash:[
   clip('팔을 뻗어 짧게 가로 베기',[[0,0,0,0,0,0,0],[.23,.055,.045,.04,-.10,.22,-.34],[.43,-.10,.005,-.14,-.16,-.32,.82],[.59,-.145,-.045,-.065,.06,-.44,1.05],[.76,-.06,-.025,.005,.13,-.16,.34],[1,0,0,0,0,0,0]],[[0,0,0,0],[.24,-.02,.015,.025],[.50,-.035,-.04,.07],[.78,-.01,-.025,.025],[1,0,0,0]]),
   clip('손등을 돌려 되받아 베기',[[0,0,0,0,0,0,0],[.21,-.065,.025,.03,-.09,-.30,.32],[.43,.095,-.015,-.13,-.08,.42,-.78],[.61,.125,-.045,-.04,.13,.48,-.96],[.80,.025,-.02,.015,.08,.12,-.18],[1,0,0,0,0,0,0]],[[0,0,0,0],[.26,-.035,-.005,.025],[.55,-.04,-.045,.06],[1,0,0,0]])
  ],
  inspect:clip('자유 손잡이 접기와 재전개 확인',[[0,0,0,0,0,0,0],[.16,-.055,.065,-.015,-.10,-.40,.18],[.35,-.06,.07,-.025,-.12,-.32,.08],[.48,-.045,.065,-.02,.04,-.12,-.16],[.65,-.055,.075,-.03,-.08,-.40,.18],[.80,-.05,.055,-.015,.08,.30,.12],[1,0,0,0,0,0,0]],[[0,0,0,0],[.26,-.03,-.015,.035],[.66,-.035,-.025,.05],[1,0,0,0]],[[0,0,0,0],[.18,0,0,1],[.28,0,178,1],[.42,-180,180,1],[.50,-180,180,1],[.64,-5,178,1],[.72,0,145,1],[.82,0,0,1],[.90,0,0,0],[1,0,0,0]])
 },
 knife_dagger:{drawSeconds:.68,inspectSeconds:2.35,rest:[.105,-.145,-.48],ready:[-.42,2.15,-.12],
  draw:clip('가슴 아래 칼집에서 직선 인출',[[0,-.045,-.27,.12,.65,-.05,.16],[.30,-.035,-.075,.025,.26,-.12,.12],[.55,-.015,.045,-.045,-.22,-.10,-.08],[.76,.008,.015,-.015,-.06,.03,.04],[1,0,0,0,0,0,0]],[[0,-.01,-.035,.02],[.25,.015,.04,-.015],[.55,.015,.025,.005],[1,0,0,0]]),
  slash:[
   clip('겨드랑이로 당겼다가 정면 찌르기',[[0,0,0,0,0,0,0],[.24,.025,-.035,.09,.28,.08,-.12],[.43,-.035,.015,-.23,-.76,-.12,.06],[.51,-.04,.015,-.225,-.76,-.12,.06],[.67,-.015,-.005,-.11,-.30,-.04,.10],[.84,.01,-.015,.025,.12,.06,.03],[1,0,0,0,0,0,0]],[[0,0,0,0],[.20,-.025,.02,.02],[.43,-.04,-.055,.08],[.68,-.025,-.04,.05],[1,0,0,0]]),
   clip('낮게 당겨 올려 찌르고 회수',[[0,0,0,0,0,0,0],[.24,.03,-.08,.065,.48,.12,-.34],[.43,-.005,.07,-.175,-.63,.10,-.38],[.57,-.025,.11,-.14,-.48,.14,-.26],[.76,-.005,.035,-.015,-.10,.06,.02],[1,0,0,0,0,0,0]],[[0,0,0,0],[.24,-.03,.005,.04],[.50,-.04,-.05,.075],[.80,-.015,-.025,.03],[1,0,0,0]])
  ],
  inspect:clip('날을 세우고 양날과 가드 확인',[[0,0,0,0,0,0,0],[.22,-.075,.09,-.035,-.28,-.42,.15],[.40,-.075,.09,-.035,-.28,-.42,.15],[.59,-.08,.09,-.035,-.12,.56,-.15],[.76,-.07,.075,-.025,-.10,.52,-.12],[1,0,0,0,0,0,0]],[[0,0,0,0],[.32,-.015,-.005,.025],[.70,-.02,-.02,.02],[1,0,0,0]])
 },
 knife_combat:{drawSeconds:.74,inspectSeconds:2.4,rest:[.14,-.15,-.47],ready:[-.34,1.95,-.35],
  draw:clip('오른쪽 칼집에서 뽑아 방어 자세',[[0,.10,-.24,.065,.48,.45,-.62],[.30,.08,-.08,.025,.27,.25,-.32],[.58,-.025,.035,-.035,-.17,-.15,.18],[.79,-.008,.015,-.008,-.07,-.05,.05],[1,0,0,0,0,0,0]],[[0,-.025,-.02,.04],[.22,-.015,.025,-.01],[.57,-.035,.01,.015],[1,0,0,0]]),
  slash:[
   clip('어깨를 열어 대각선 내려베기',[[0,0,0,0,0,0,0],[.24,.085,.10,.045,-.32,.32,-.62],[.43,-.08,-.025,-.145,.22,-.30,.94],[.62,-.14,-.12,-.045,.57,-.48,1.18],[.79,-.055,-.065,.01,.27,-.18,.40],[1,0,0,0,0,0,0]],[[0,0,0,0],[.23,-.015,.015,.03],[.44,-.03,-.065,.075],[.72,-.02,-.04,.055],[1,0,0,0]]),
   clip('팔꿈치를 접어 반대 사선 올려베기',[[0,0,0,0,0,0,0],[.23,-.065,-.07,.055,.32,-.22,.43],[.43,.055,.045,-.145,-.33,.25,-.84],[.63,.105,.105,-.05,-.45,.32,-1.05],[.82,.02,.035,.01,-.12,.08,-.22],[1,0,0,0,0,0,0]],[[0,0,0,0],[.25,-.025,.01,.04],[.50,-.045,-.03,.07],[.77,-.025,-.02,.03],[1,0,0,0]])
  ],
  inspect:clip('날등과 손잡이를 기울여 확인',[[0,0,0,0,0,0,0],[.23,-.055,.065,-.005,.15,-.55,.48],[.42,-.055,.065,-.005,.15,-.55,.48],[.64,-.075,.07,-.025,-.15,.38,.22],[.80,-.045,.045,-.01,-.08,.30,.12],[1,0,0,0,0,0,0]],[[0,0,0,0],[.31,-.025,-.025,.025],[.71,-.02,-.03,.025],[1,0,0,0]])
 },
 knife_karambit:{drawSeconds:1.02,inspectSeconds:2.90,rest:[.12,-.05,-.53],ready:[-.25,1.95,-.5],
  draw:clip('검지 고리에 걸어 반회전으로 꺼내기',[[0,.055,-.20,.08,.30,-.30,.35],[.23,.035,-.045,.025,.48,-.01,.36],[.48,-.045,.025,-.035,.56,-.01,.42],[.74,-.015,.015,-.02,.20,.02,.15],[.89,.005,-.01,.005,.04,-.03,.03],[1,0,0,0,0,0,0]],[[0,-.015,-.025,.025],[.24,-.035,.015,.005],[.55,-.04,-.025,.05],[1,0,0,0]],null,[[0,180],[.20,180],[.70,0],[1,0]]),
  slash:[
   clip('확장 그립에서 바깥을 감아 당겨 베기',[[0,0,0,0,0,0,0],[.23,.075,.035,.055,.14,.42,-.42],[.43,-.11,-.035,-.13,-.08,-.55,.98],[.61,-.135,-.075,-.045,.22,-.65,1.18],[.81,-.035,-.025,.015,.10,-.17,.27],[1,0,0,0,0,0,0]],[[0,0,0,0],[.25,-.035,.005,.015],[.48,-.055,-.045,.085],[.77,-.02,-.035,.04],[1,0,0,0]]),
   clip('아래에서 고리 날을 걸어 올려 베기',[[0,0,0,0,0,0,0],[.23,-.065,-.075,.045,.35,-.32,.58],[.43,.055,.055,-.125,-.38,.37,-.85],[.62,.08,.11,-.025,-.55,.48,-1.03],[.82,.015,.03,.015,-.15,.12,-.22],[1,0,0,0,0,0,0]],[[0,0,0,0],[.23,-.045,.015,.035],[.47,-.06,-.025,.075],[.76,-.025,-.025,.035],[1,0,0,0]])
  ],
  inspect:clip('검지 끝마디로 반회전하고 되돌려 잡기',[[0,0,0,0,0,0,0],[.18,-.045,.035,-.015,.56,-.01,.42],[.42,-.055,.045,-.02,.56,-.01,.42],[.62,-.06,.04,-.025,.56,-.01,.42],[.82,-.025,.025,-.01,.35,.02,.26],[1,0,0,0,0,0,0]],[[0,0,0,0],[.26,-.04,-.015,.045],[.63,-.045,-.025,.055],[1,0,0,0]],null,[[0,0],[.18,0],[.48,180],[.60,180],[.86,0],[1,0]])
 },
 knife_kunai:{drawSeconds:.86,inspectSeconds:2.75,rest:[.095,-.13,-.50],ready:[-.58,2.12,.18],
  draw:clip('안쪽으로 당겨 받아 쥐고 전방 정렬',[[0,.065,-.25,.10,.78,.26,-.30],[.20,-.065,.035,-.025,-.28,-.46,.50],[.38,-.075,.085,-.055,-.48,-.25,.65],[.57,-.035,.045,-.035,-.30,.12,.22],[.79,.012,-.015,.018,.10,.08,-.12],[1,0,0,0,0,0,0]],[[0,-.015,-.03,.025],[.22,.035,.055,-.045],[.42,.025,.07,-.055],[.66,-.015,.015,.015],[1,0,0,0]]),
  slash:[
   clip('어깨를 당겼다가 칼끝을 곧게 뻗기',[[0,0,0,0,0,0,0],[.25,.055,.075,.085,.38,.15,-.12],[.43,-.045,.015,-.215,-.95,-.13,.12],[.55,-.055,.005,-.175,-.80,-.12,.16],[.75,-.005,-.035,.025,.10,.05,.08],[1,0,0,0,0,0,0]],[[0,0,0,0],[.20,.02,.055,-.045],[.43,-.045,.015,.035],[.64,-.035,-.015,.06],[1,0,0,0]]),
   clip('낮은 바깥 준비에서 올려 긋고 회수',[[0,0,0,0,0,0,0],[.23,.06,-.09,.065,.56,.22,-.48],[.43,-.08,.065,-.13,-.42,-.52,.86],[.61,-.105,.12,-.045,-.62,-.60,1.05],[.81,-.03,.035,.025,-.13,-.20,.25],[1,0,0,0,0,0,0]],[[0,0,0,0],[.22,-.035,.07,-.035],[.46,-.055,.02,.05],[.71,-.025,-.025,.055],[1,0,0,0]])
  ],
  inspect:clip('손등으로 뒤집어 삼각 날과 고리 확인',[[0,0,0,0,0,0,0],[.18,-.065,.10,-.02,-.42,-.10,.95],[.34,-.065,.10,-.02,-.42,-.10,.95],[.52,-.09,.065,-.045,.16,-.80,-.30],[.69,-.09,.065,-.045,.16,-.80,-.30],[.84,-.025,.025,-.01,-.08,.20,-.10],[1,0,0,0,0,0,0]],[[0,0,0,0],[.24,.025,.06,-.03],[.49,.025,.035,-.025],[.75,-.015,-.015,.025],[1,0,0,0]])
 },
 knife_machete:{drawSeconds:1.02,inspectSeconds:3.05,rest:[.16,-.17,-.50],ready:[-.4,1.98,-.14],
  draw:clip('긴 칼집에서 당겨 무게를 받쳐 세우기',[[0,.07,-.32,.13,.82,.75,-.50],[.30,.08,-.14,.065,.55,.65,-.42],[.56,.025,.055,-.025,-.27,-.30,.28],[.72,-.015,.025,-.01,-.12,-.08,.08],[.88,-.005,-.015,.01,.04,.02,-.04],[1,0,0,0,0,0,0]],[[0,-.03,-.015,.04],[.26,.005,.04,-.02],[.52,.01,.025,-.01],[.76,-.03,-.025,.04],[1,0,0,0]]),
  slash:[
   clip('팔꿈치부터 들어 무겁게 수직 내려베기',[[0,0,0,0,0,0,0],[.26,.06,.12,.065,-.58,.12,-.22],[.43,-.025,-.055,-.135,.43,-.15,.35],[.64,-.055,-.17,-.02,.82,-.32,.76],[.81,-.035,-.105,.045,.48,-.18,.38],[1,0,0,0,0,0,0]],[[0,0,0,0],[.26,-.02,.025,.025],[.43,-.055,-.085,.12],[.68,-.04,-.075,.09],[.84,-.02,-.025,.04],[1,0,0,0]]),
   clip('몸 옆에서 넓게 돌려 수평 되받기',[[0,0,0,0,0,0,0],[.27,-.095,.055,.065,-.12,-.36,.55],[.43,.10,-.025,-.145,.12,.48,-.92],[.66,.15,-.095,-.035,.36,.65,-1.17],[.84,.055,-.055,.025,.23,.24,-.37],[1,0,0,0,0,0,0]],[[0,0,0,0],[.26,-.03,.005,.04],[.46,-.055,-.075,.105],[.73,-.035,-.06,.075],[1,0,0,0]])
  ],
  inspect:clip('넓은 날을 들어 세우고 천천히 뒤집어 확인',[[0,0,0,0,0,0,0],[.25,-.115,.11,-.015,.38,-.55,.22],[.43,-.115,.11,-.015,.38,-.55,.22],[.64,-.14,.105,-.035,-.35,.38,-.45],[.81,-.085,.07,-.015,-.15,.35,-.23],[1,0,0,0,0,0,0]],[[0,0,0,0],[.30,-.025,-.005,.045],[.68,-.04,-.03,.06],[1,0,0,0]])
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
   // 대체 모델도 모서리와 손가락이 닿는 홈을 남겨 접기 중 장갑을 관통하지 않게 한다.
   const rounded=(x,y,w,h,r)=>{const s=new T.Shape();s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s};
   const shape=rounded(-.0077,-.125,.0154,.135,.0045);
   for(const y of [-.040,-.070,-.100])shape.holes.push(rounded(-.0036,y,.0072,.020,.003));
   const panel=new T.ExtrudeGeometry(shape,{depth:.0027,bevelEnabled:false,steps:1,curveSegments:4});
   for(const [name,x]of [['safeHandle',-.011],['biteHandle',.011]]){
    const p=new T.Group();p.name=name;p.position.set(x,.065,0);root.add(p);
    for(const z of [-.0085,.0058]){const rail=new T.Mesh(panel,grip);rail.position.z=z;p.add(rail);}
    box(.012,.005,.012,grip,0,-.1215,p);
   }
   const p=new T.Group();p.name='blade';p.position.y=.065;root.add(p);box(.017,.108,.0025,steel,0,.054,p);
  }else if(d.file==='karambit'){
   // 고리 중심은 가져온 모델과 같게 두어 대체 모델도 검지 회전을 따른다.
   const ring=new T.Mesh(new T.TorusGeometry(.0185,.0025,8,24),steel);ring.position.set(-.002165,-.026844,0);root.add(ring);
   const handle=new T.Shape();handle.moveTo(-.009,-.01);handle.lineTo(.015,-.01);handle.quadraticCurveTo(.029,.015,.027,.05);handle.lineTo(.015,.07);handle.lineTo(-.012,.068);handle.quadraticCurveTo(-.002,.035,-.009,-.01);
   const body=new T.Mesh(new T.ExtrudeGeometry(handle,{depth:.009,bevelEnabled:false,curveSegments:5}),grip);body.position.z=-.0045;root.add(body);
   const blade=new T.Shape();blade.moveTo(-.012,.062);blade.lineTo(.022,.07);blade.quadraticCurveTo(.009,.15,-.060,.180);blade.quadraticCurveTo(-.016,.145,-.012,.062);
   const edge=new T.Mesh(new T.ExtrudeGeometry(blade,{depth:.0035,bevelEnabled:false,curveSegments:8}),steel);edge.position.z=-.00175;root.add(edge);
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
  const source=this.gripProfile(id,m.knife.userData.imported),profile=m.knifeProfile={...source,fingers:source.fingers.map(f=>f.slice())},turn=new Q().setFromAxisAngle(new V(0,0,1),profile.roll).multiply(new Q().setFromAxisAngle(new V(0,1,0),profile.twist));
  m.fingerRest=source.fingers;
  m.bladeOffset=new Q().setFromRotationMatrix(new T.Matrix4().makeBasis(new V(0,1,0),new V(1,0,0),new V(0,0,-1))).multiply(turn);
  m.neutral=new Q().setFromEuler(new T.Euler(...motionSets[id].ready)).multiply(turn);m.handOffset=m.bladeOffset.clone().invert();
  m.knife.position.copy(this.gripOffset(id,m.bladeOffset,m.knife.userData.imported));
  // 발리송은 두 손잡이 사이가 아니라 움직이지 않는 안전 손잡이를 엄지·검지로 지지한다.
  if(id==='knife_butterfly')m.knife.position.x+=.028;
  m.knifeRest=m.knife.position.clone();m.hinges=this.rig(m.knife);
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
 gripProfile(id,imported=true){return !imported&&id!=='knife_butterfly'&&id!=='knife_karambit'?fallbackGrip:grips[id]},
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
  return root._knifeHinges={safe,tang,blade,bite,latch:root.getObjectByName('knifeLatch')};
 },
 sample(kind,t,out,id='knife_butterfly',variant=0){
  out.r.set(0,0,0);out.l.set(0,0,0);out.q.identity();out.curl=.9;out.thumb=.72;out.blade=out.bite=out.release=out.ring=0;
  if(kind==='idle')return out;
  const set=motionSets[id],motion=kind==='slash'?set.slash[variant%set.slash.length]:set[kind];
  if(!motion)return out;
  const values=out.values||(out.values=new Float64Array(6));
  curveAt(motion.keys,motion.slopes,t,values);out.r.set(values[0],values[1],values[2]);out.q.setFromEuler(_e.set(values[3],values[4],values[5]));
  curveAt(motion.support,motion.supportSlopes,t,values);out.l.set(values[0],values[1],values[2]);
  if(motion.joints){curveAt(motion.joints,motion.jointSlopes,t,values);out.blade=values[0]*Math.PI/180;out.bite=values[1]*Math.PI/180;out.release=values[2];}
  if(motion.handling){curveAt(motion.handling,motion.handlingSlopes,t,values);out.ring=values[0]*Math.PI/180;}
  return out;
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
  if(m.id==='knife_karambit')this.fitRing(m.knife,S.b.fingers.Index,S.b.fingers.Pinky[0],m.curve.ring);
 },
 fitRing(knife,index,pinky,angle){
  // 모델에서 측정한 고리 중심을 검지 끝마디에 고정한다. 손목과 별개로 칼 자체가 회전한다.
  // 검지를 편 채 다른 손가락을 접고, 손바닥을 통과하지 않는 반회전 구간을 사용한다.
  const f=knife._ringFit||(knife._ringFit={a:new V(),b:new V(),p:new V(),x:new V(),y:new V(),z:new V(),world:new T.Matrix4(),basis:new T.Matrix4(),turn:new T.Matrix4(),tilt:new T.Matrix4().makeRotationY(-.65),size:new T.Matrix4().makeScale(1.18,1.18,1.18),offset:new T.Matrix4().makeTranslation(.002165,.026844,0)});
  index[1].getWorldPosition(f.a);index[2].getWorldPosition(f.b);f.z.copy(f.b).sub(f.a).normalize();
  pinky.getWorldPosition(f.y);f.y.sub(f.a);f.y.addScaledVector(f.z,-f.y.dot(f.z));
  if(f.y.lengthSq()<1e-8)return;f.y.normalize();f.x.crossVectors(f.y,f.z).normalize();f.y.crossVectors(f.z,f.x).normalize();
  f.p.copy(f.b).addScaledVector(f.z,.003);
  f.world.makeTranslation(f.p.x,f.p.y,f.p.z).multiply(f.basis.makeBasis(f.x,f.y,f.z)).multiply(f.turn.makeRotationZ(1.2+(angle||0))).multiply(f.tilt).multiply(f.size).multiply(f.offset);
  knife.parent.updateWorldMatrix(true,false);knife.matrixAutoUpdate=false;knife.matrix.copy(knife.parent.matrixWorld).invert().multiply(f.world);knife.matrix.decompose(knife.position,knife.quaternion,knife.scale);knife.updateWorldMatrix(false,true);
 },
 actionCurve(action,id,out){
  const t=action?U.clamp(action.t/action.duration,0,1):0,c=this.sample(action?.kind||'idle',t,out,id,action?.variant||0);
  if(action?.blendFrom){
   const f=action.blendFrom,w=1-U.smoothstep(0,action.blendEnd||.24,t);c.r.lerp(f.r,w);c.l.lerp(f.l,w);c.q.slerp(f.q,w);c.curl=U.lerp(c.curl,f.curl,w);c.thumb=U.lerp(c.thumb,f.thumb,w);
   // 검사 중 공격도 같은 자세에서 시작하며, 칼날→자유 손잡이→손가락 순서로 회수한다.
   c.blade=U.lerp(c.blade,f.blade,w);c.bite=U.lerp(c.bite,f.bite,w);c.release=U.lerp(c.release,f.release,w);
   c.ring=U.lerp(c.ring,f.ring,w);
   if(id==='knife_butterfly'&&(Math.abs(f.blade)>.001||Math.abs(f.bite)>.001)){
    const u=U.clamp(t/(action.blendEnd||.24),0,1);
    c.blade=f.blade*(1-U.smoothstep(0,.52,u));c.bite=f.bite*(1-U.smoothstep(.50,.90,u));c.release=U.lerp(f.release,0,U.smoothstep(.90,1,u));
   }
  }
  return c;
 },
 poseVM(vm,m,dt,s){
  const c=this.actionCurve(s.melee,m.id,m.curve),R=m.staticArms.R,L=m.staticArms.L,drawStart=s.melee?.kind==='draw'&&m.poseAction!==s.melee;
  m.poseAction=s.melee;
  // 칼을 바꿔 들 때도 해당 손잡이에 맞는 굽힘을 바로 적용해 장갑이 그립 안으로 지나가지 않게 한다.
  R.curl=R.trig=c.curl;R.thumb=c.thumb;
  if(m.id==='knife_butterfly')for(let f=2;f<5;f++)for(let i=0;i<3;i++)m.knifeProfile.fingers[f][i]=m.fingerRest[f][i]*U.lerp(1,.18/.55,c.release);
  _p.copy(R.rest).add(c.r);_q.copy(m.neutral).multiply(c.q).multiply(m.handOffset);
  // 꺼내기는 화면 아래의 시작 자세에서 들어 올린다. 이전 대기 위치로 먼저 내려가지 않는다.
  G.Guns.poseStaticArm(R,_p,_q,dt,c.curl,c.thumb,drawStart);
  _p.copy(L.rest).add(c.l);_q.copy(m.baseHands.L);G.Guns.poseStaticArm(L,_p,_q,dt,.7,.6,drawStart);
  m.grip.matrixAutoUpdate=true;m.grip.scale.setScalar(1);m.grip.position.copy(R.contact);m.grip.quaternion.copy(R.handQ).multiply(m.bladeOffset);
  this.poseHinges(m.hinges,c);
  m.knife.matrixAutoUpdate=true;m.knife.position.copy(m.knifeRest);m.knife.quaternion.identity();
  m.root.position.set(Math.sin(s.phase)*.008*s.moving,Math.sin(vm.t*1.7)*.002-s.landDip*.04-(1-s.raise)*.22,0);
  m.root.rotation.set(-(1-s.raise)*.55-vm.sprint*.12,vm.sway.x,vm.sway.y);
  m.root.position.y-=vm.sprint*.055;m.root.rotation.z+=vm.sprint*.12;
  if(m.id==='knife_karambit'){m.root.updateMatrixWorld(true);this.fitRing(m.knife,R.fing[0],R.fing[3][0],c.ring);}
  vm.flashLight.intensity=0;vm.camRX=vm.camRY=vm.camRZ=0;
 },
 poseHinges(h,c){
  // 안전 핀은 손에 고정하고 두 번째 핀은 탱을 따른다. 공격 중에는 완전히 펼친다.
  if(h.tang){h.tang.rotation.z=c?.blade||0;h.bite.rotation.z=c?.bite||0;}
  if(h.latch)h.latch.rotation.z=U.lerp(-Math.PI/2,0,c?.release||0);
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
  let blendFrom,blendEnd;
  if(kind==='slash'&&p.melee?.kind==='inspect'){
   blendFrom=this.actionCurve(p.melee,a.knife,{r:new V(),l:new V(),q:new Q(),e:new T.Euler()});
   if(a.knife==='knife_butterfly'||a.knife==='knife_karambit')blendEnd=.40;
  }
  let variant=0;
  if(kind==='slash'){
   const chain=p.knifeCombo;if(chain?.id===a.knife&&p.time-chain.at<=d.duration+.45)variant=1-chain.variant;
   p.knifeCombo={id:a.knife,variant,at:p.time};
  }else p.knifeCombo=null;
  p.melee={id:a.knife,kind,variant,t:0,duration:kind==='slash'?d.duration:kind==='draw'?d.draw:d.inspect,hit:false,sounds:0,blendFrom,blendEnd};a.melee=p.melee;
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
   knife.matrixAutoUpdate=true;
   knife.rotation.set(-.25,0,-.27-(action?.kind==='slash'?Math.sin(t*Math.PI)*1.0:0));
   const hinges=knife._hinges||(knife._hinges=this.rig(knife));this.poseHinges(hinges,c);
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
  const release=m.curGun==='knife_butterfly'?(m.knifeCurve?.release||0):0;
  for(const f of hand.fingers){const loose=m.curGun==='knife_karambit'?(/Index/.test(f.bone.name)?.10:1.2):!/Index/.test(f.bone.name)?U.lerp(1,.28,release):1;f.bone.quaternion.copy(f.bind).multiply(_q.setFromAxisAngle(f.axis,f.angle*loose));}
  hand.wrist.updateMatrixWorld(true);
  if(m.curGun==='knife_karambit'){
   const index=hand.index||(hand.index=[root.getObjectByName('RightHandIndex1'),root.getObjectByName('RightHandIndex2'),root.getObjectByName('RightHandIndex3')]),pinky=hand.pinky||(hand.pinky=root.getObjectByName('RightHandPinky1'));
   if(index.every(Boolean)&&pinky){this.fitRing(knife,index,pinky,m.knifeCurve?.ring);return;}
  }
  // 원점 사이의 빈 공간이 아니라 고정 손잡이의 중심을 실제 손바닥에 맞춘다.
  const y=hand.worldY.copy(hand.y).transformDirection(hand.wrist.matrixWorld),z=hand.worldZ.copy(hand.n).transformDirection(hand.wrist.matrixWorld),x=hand.worldX.crossVectors(y,z).normalize();z.crossVectors(x,y).normalize();
  knife.position.copy(m.gunMount.worldToLocal(_p.copy(hand.palm).applyMatrix4(hand.wrist.matrixWorld)));
  knife.quaternion.copy(m.gunMount.getWorldQuaternion(_q).invert()).multiply(_q2.setFromRotationMatrix(hand.basis.makeBasis(x,y,z)));
  _p.set(m.curGun==='knife_butterfly'?-.011:0,-.02,0).multiply(knife.scale).applyQuaternion(knife.quaternion);knife.position.sub(_p);
 }
};
})();
