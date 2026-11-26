// 신규 총기는 기존 M4 장갑·소매와 원본 애니메이션 곡선을 함께 쓴다.
(function(){
'use strict';
const G=window.G,T=window.THREE,V=T.Vector3,Q=T.Quaternion,U=G.U;
const profiles={
 mp9:{empty:'smgEmpty',tactical:'smgTactical',mechanism:'mp5',mass:.82,travel:.82,aim:.72,name:'9mm · 손잡이 고정과 해제'},
 cx9:{empty:'smgEmpty',tactical:'smgTactical',mechanism:'mp5',mass:.90,travel:.94,aim:.80,name:'긴 탄창 · 손잡이 고정과 해제'},
 v45:{empty:'vector',tactical:'vector',mechanism:'catch',mass:.95,travel:.88,aim:.72,name:'수직 탄창 · 볼트 멈치'},
 sm45:{empty:'smgEmpty',tactical:'smgTactical',mechanism:'catch',mass:.96,travel:.92,aim:.86,name:'직선 탄창 · 볼트 멈치'},
 ar416:{empty:'arEmpty',tactical:'arTactical',mechanism:'catch',mass:1.08,travel:1,aim:.94,name:'AR · 탄창 확인과 볼트 멈치'},
 sg56:{empty:'arEmpty',tactical:'arTactical',mechanism:'catch',mass:1.14,travel:1.06,aim:1.06,magPalm:.018,name:'SIG 계열 · 볼트 멈치'},
 ms56:{empty:'arEmpty',tactical:'arTactical',mechanism:'catch',mass:1.02,travel:.94,aim:.88,name:'짧은 SIG 계열 · 볼트 멈치'},
 lm86:{empty:'arEmpty',tactical:'arTactical',mechanism:'catch',mass:1.48,travel:1.10,aim:1.18,name:'AR 드럼 · 들어 올려 밀기'},
 rk762:{empty:'akEmpty',tactical:'akTactical',raise:'akRaise',mechanism:'rock',mass:1.42,travel:1.08,aim:1.16,name:'AK · 앞턱 걸기와 오른손 장전'},
 mg60:{empty:'beltEmpty',tactical:'beltTactical',mechanism:'belt',mass:1.85,travel:.94,aim:1.30,name:'급탄 덮개 · 탄통과 탄띠'},
 sr25:{empty:'arEmpty',tactical:'arTactical',mechanism:'catch',mass:1.32,travel:1.06,aim:1.12,name:'AR 지정사수 · 짧은 탄창과 멈치'},
 dm56:{empty:'scar',tactical:'scar',raise:'scarRaise',mechanism:'side',mass:1.28,travel:1.02,aim:1.10,name:'SCAR 계열 · 옆 장전 손잡이'},
 m24:{empty:'bolt',tactical:'bolt',mechanism:'bolt',mass:1.35,travel:.92,aim:1.20,name:'교체식 탄창 · 오른손 볼트'},
 sp12:{empty:'shellLoad',tactical:'shellLoad',mechanism:'shell',mass:1.30,travel:.82,aim:1.10,name:'배출구 한 발 · 튜브 장전과 펌프'},
 p226:{empty:'pistolEmpty',tactical:'pistolTactical',raise:'pistolRaise',mechanism:'pistol',mass:.84,travel:.88,aim:.64,name:'권총 탄창 · 빈 총의 슬라이드 해제'}
};
const A=new Float64Array(22),B=new Float64Array(22),C=new Float64Array(22),_a=new V(),_b=new V(),_c=new V(),_q=new Q();
const _x=new V(),_y=new V(),_z=new V(),_frame=new T.Matrix4(),_want=new Q(),_turn=new Q(),identity=new Q();
const smooth=x=>U.smoothstep(0,1,x),mix=(a,b,t)=>a+(b-a)*t;
function sample(clip,t,out){const f=U.clamp(t,0,1)*(clip.samples.length-1),i=Math.floor(f),a=clip.samples[i],b=clip.samples[Math.min(i+1,clip.samples.length-1)];for(let k=0;k<22;k++)out[k]=mix(a[k],b[k],f-i);return out;}
function track(keys,t,out){let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;const a=keys[i],b=keys[i+1],u=smooth((t-a[0])/Math.max(1e-6,b[0]-a[0]));return out.copy(a[1]).lerp(b[1],u);}
function orientation(normal,fingers,out){_y.fromArray(fingers).normalize();_z.fromArray(normal).addScaledVector(_y,-_z.dot(_y)).normalize();_x.crossVectors(_y,_z);return out.setFromRotationMatrix(_frame.makeBasis(_x,_y,_z));}
const M=G.ExpandedMotion={
 profiles,data:null,
 has(id){return !!profiles[id]},
 feel(id){const p=profiles[id];return p?{name:p.name,mass:p.mass,reach:0,lift:0,cant:0,wrist:0,finish:.025/p.mass}:null;},
 async load(){
  this.data=null;try{
   const r=await fetch('assets/animations/reloads/expanded-motion.json?v='+encodeURIComponent(window.LZ_BUILD||''),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();
   if(d.version!==1||d.fps!==60)throw Error('지원하지 않는 모션 데이터');
   const required=new Set(['raise','shellStart','shellLoad','shellEnd',...Object.values(profiles).flatMap(p=>[p.empty,p.tactical,p.raise||'raise'])]);
   for(const key of required){const c=d.clips?.[key];if(!(c?.duration>0)||c.samples.length<2||c.samples.length>1200||!c.samples.every(r=>r.length===22&&r.every(Number.isFinite)))throw Error('모션 데이터 오류: '+key);for(let i=0;i<c.samples.length;i++)for(const offset of [12,16]){const r=c.samples[i];if(Math.abs(Math.hypot(...r.slice(offset,offset+4))-1)>.002||(i&&r.slice(offset,offset+4).reduce((sum,v,j)=>sum+v*c.samples[i-1][offset+j],0)<0))throw Error('손목 회전 오류: '+key);}}
   this.data=d;
  }catch(e){console.info('[motion] 신규 총기 접촉 기반 동작 사용:',e.message);}
 },
 // 원본의 가속 곡선으로 총을 어깨·눈 높이에 가져온다. 양 끝은 정확히 기존 광축에 둔다.
 aim(m,s,position,rotation){
  const d=profiles[m.id],clip=this.data?.clips[d?.raise||'raise'],a=U.clamp(s.ads||0,0,1);if(!d||!clip||s.reload||a<=0||a>=1)return;
  sample(clip,a,A);sample(clip,0,B);sample(clip,1,C);const w=16*a*a*(1-a)*(1-a)*d.aim;
  position.x+=U.clamp(A[6]-mix(B[6],C[6],a),-.028,.028)*w*.4;
  position.y+=U.clamp(A[7]-mix(B[7],C[7],a),-.045,.045)*w*.5;
  position.z+=U.clamp(A[8]-mix(B[8],C[8],a),-.05,.05)*w*.55;
  rotation.x+=U.clamp(A[9]-mix(B[9],C[9],a),-.18,.18)*w*.45;
  rotation.y+=U.clamp(A[10]-mix(B[10],C[10],a),-.12,.12)*w*.4;
  rotation.z+=U.clamp(A[11]-mix(B[11],C[11],a),-.18,.18)*w*.4;
 },
 keys(m){
  const d=profiles[m.id];if(!d||!m.keys.E)return;
  if(d.mechanism==='mp5')this.mp5Keys(m);
  const K=m.keys;
  if(m.id==='mg60')K.coverPrep={mag:orientation([1,0,0],[0,0,-1],new Q()),closed:orientation([0,-1,0],[1,0,-.2],new Q()),open:orientation(new V(0,-1,0).applyAxisAngle(new V(1,0,0),-1.35).toArray(),new V(1,0,-.2).applyAxisAngle(new V(1,0,0),-1.35).toArray(),new Q())};
  // 총기별 접촉 시각과 원본 시각을 잇는다. 실제 부품을 잡는 지점은 그대로 보존한다.
  for(const [mode,S]of [['empty',K.E],['tactical',K.Tac]]){
   if(!S)continue;const t=S.T,clip=d[mode],out=t.grab??t.drop??t.knock??.12,release=t.release??out+.07;
   let source=clip==='arEmpty'?[.10,.225,.34,.40,.55,.695,.94]:clip==='arTactical'?[.12,.225,.32,.41,.595,.80,.96]
    :clip.startsWith('ak')?[.10,.343,.39,.17,.543,.75,.96]:clip==='vector'?[.12,.28,.35,.42,.61,.79,.95]
    :clip==='scar'?[.13,.303,.36,.40,.497,.78,.96]:clip.startsWith('pistol')?[.11,.224,.32,.40,.545,.824,.96]
    :clip.startsWith('belt')?[.20,.29,.34,.40,.57,.83,.98]:clip==='bolt'?[.10,.12,.20,.35,.47,.87,.97]
    :[.10,.22,.31,.40,.60,.82,.97];
   const targets=[[0,0],[out,source[1]],[release,source[2]],[t.newMag,source[3]],[t.seat,source[4]],[t.chRel??t.slap??t.slide??t.unlock??t.boltB??.86,source[5]],[t.endE??t.endT??.99,source[6]],[1,1]];
   // AK 쳐내기는 새 탄창을 먼저 꺼낸다. 분류 이름순이 아닌 실제 사건 순서로 정렬한다.
   targets.sort((a,b)=>a[0]-b[0]);S.motionMap=[];for(const pair of targets){const last=S.motionMap.at(-1);if(pair.every(Number.isFinite)&&pair[0]>=0&&pair[0]<=1&&(!last||pair[0]>last[0]+.001&&pair[1]>=last[1]))S.motionMap.push(pair);}
   if(S.motionMap.at(-1)?.[0]!==1)S.motionMap.push([1,1]);
   S.motionKnots=[0,.04,t.grab,t.grab===undefined?undefined:t.grab-.025,t.out,t.release,t.knock,t.drop,t.newMag,t.newMag-.025,t.hook,t.seat,t.seat+(K.st.magHold||.055),t.lockA,t.lockA===undefined?undefined:t.lockA-.045,t.lockB,t.lockHold,t.lockHold===undefined?undefined:t.lockHold+.005,t.unlock,t.unlock===undefined?undefined:t.unlock-.065,t.unlock===undefined?undefined:t.unlock+.025,t.coverA,t.coverB,t.coverCloseA,t.coverCloseB,t.chA,t.chA===undefined?undefined:t.chA-(K.st.handleLead||.095),t.chB,t.chRel,t.chRel===undefined?undefined:t.chRel+.02,t.slap,t.slide,t.slideA,t.slideRel,t.boltA,t.boltB,t.endE,t.endT,1].filter(v=>Number.isFinite(v)&&v>=0&&v<=1).sort((a,b)=>a-b).filter((v,i,a)=>!i||v>a[i-1]+.001);
  }
 },
 mp5Keys(m){
  const K=m.keys,F=m.fore,H=m.rest.mag.clone().add(K.grab),D=m.magDir,ch=m.charge;if(!ch)return;
  const v=(p,x,y,z)=>p.clone().add(new V(x,y,z)),out=H.clone().addScaledVector(D,.17),pouch=v(H,-.15,-.42,.18),approach=H.clone().addScaledVector(D,.10);K.chGrab=v(ch,-.012,.004,0);K.chMode='left';
  K.E={k:[[0,F],[.05,v(ch,-.11,-.025,.03)],[.10,K.chGrab],[.18,v(K.chGrab,0,0,.065)],[.22,v(K.chGrab,0,.017,.065)],[.26,v(ch,-.13,.025,.08)],[.30,H],[.38,out],[.42,v(out,-.08,-.08,.02)],[.48,pouch],[.55,v(pouch,-.02,.055,-.06)],[.64,approach],[.72,H],[.77,v(ch,-.12,.07,.07)],[.82,v(K.chGrab,0,.02,.065)],[.85,v(K.chGrab,0,0,.065)],[.89,v(ch,-.14,.03,.06)],[.94,F],[1,F]],T:{grab:.30,out:.38,release:.42,toss:true,newMag:.48,seat:.72,lockA:.10,lockB:.18,lockHold:.22,unlock:.85,endE:1}};
  K.Tac={k:[[0,F],[.06,v(H,-.025,-.04,.03)],[.12,H],[.23,out],[.29,v(out,-.04,-.08,.03)],[.39,pouch],[.46,v(pouch,-.02,.055,-.06)],[.56,approach],[.65,H],[.69,v(H,0,.012,0)],[.72,H],[.84,v(F,-.06,-.045,.03)],[.98,F],[1,F]],T:{grab:.12,out:.23,release:.29,toss:true,newMag:.39,seat:.65,endT:.98}};
 },
 mechanics(m,s){
  const r=s.reload,t=m.keys.E?.T,p=r?.p;if(!r?.empty||r.type!=='mag'||t?.lockA===undefined||!m.parts.charge)return;
  const pull=smooth((p-t.lockA)/(t.lockB-t.lockA)),release=1-smooth((p-t.unlock)/.035),z=.065*pull*release,turn=smooth((p-t.lockB)/(t.lockHold-t.lockB))*release;
  m.parts.charge.position.z=m.rest.charge.z+z;m.parts.charge.rotation.z=-.45*turn;
  if(p>=t.lockA&&p<t.lockHold)m.armL.tgt.copy(m.keys.chGrab).add(_a.set(0,.017*turn,z));
 },
 contact(m,r){
  if(m.id==='mg60'&&r.type==='mag'){
   const K=m.keys,t=(r.empty?K.E:K.Tac).T,p=r.p,start=t.seat+(K.st.magHold||.055),early=p<t.coverA,late=p>=start&&p<t.coverCloseA;
   if(early||late){const w=smooth(early?p/t.coverA:(p-start)/(t.coverCloseA-start)),L=m.armL;if(early)orientation(m.supportN,m.supportF,_q);else _q.copy(K.coverPrep.mag);_q.slerp(early?K.coverPrep.closed:K.coverPrep.open,w);L.palmRef=L.palmTarget.set(0,0,1).applyQuaternion(_q);L.fingerRef=L.fingerTarget.set(0,1,0).applyQuaternion(_q);L.contactMode='coverReach';L.coverBlend=w;L.contactLock=w;L.curlT=mix(early?.76:.66,.5,w);L.thumbT=mix(early?.45:.65,.55,w);L.trigT=mix(early?.7:.58,.45,w);}
   return;
  }
  const t=m.keys.E?.T,p=r.p;if(!r.empty||r.type!=='mag'||t?.lockA===undefined)return;
  const L=m.armL,locking=p>t.lockA-.045&&p<t.lockHold+.005,slapping=p>t.unlock-.065&&p<t.unlock+.025;
  if(!locking&&!slapping)return;
  L.contactMode=locking?'handle':'press';L.palmRef=L.palmTarget.set(1,0,0);L.fingerRef=L.fingerTarget.set(0,.5,-1);L.curlT=L.trigT=locking?.76:.12;L.thumbT=locking?.6:.2;L.contactLock=locking?1:0;L.reachRef=locking?m.keys.chGrab:null;
 },
 time(S,p){const keys=S.motionMap;let i=0;while(i<keys.length-2&&p>keys[i+1][0])i++;const a=keys[i],b=keys[i+1];return mix(a[1],b[1],U.clamp((p-a[0])/Math.max(1e-6,b[0]-a[0]),0,1));},
 carried(m,s){
  const object=m.holdObj,L=m.armL;if(!profiles[m.id]||object!==m.mag2||L.contactMode!=='magazine')return;
  const r=s.reload,S=r?.empty?m.keys.E:m.keys.Tac;if(!r||!S)return;const p=r.p,t=S.T,contact=t.hook??t.seat,w=smooth((p-t.newMag)/.04)*(1-smooth((p-contact+.08)/.065));if(w<=0)return;
  // 실제로 푼 손목이 회전하면 손에 든 탄창도 함께 돈다. 손목만 꺾고 탄창은 X축에 두지 않는다.
  _y.copy(L.fingerRef).normalize();_z.copy(L.palmRef).addScaledVector(_y,-L.palmRef.dot(_y));if(_z.lengthSq()<1e-8)_z.set(1,0,0).addScaledVector(_y,-_y.x);_z.normalize();_x.crossVectors(_y,_z);
  _want.setFromRotationMatrix(_frame.makeBasis(_x,_y,_z));_turn.copy(L.handQ).multiply(_want.invert());_q.copy(identity).slerp(_turn,w);object.quaternion.premultiply(_q);
  object.position.copy(L.contact).sub(_a.copy(m.keys.grab).applyQuaternion(object.quaternion));
 },
 apply(m,r,pose,state){
  const d=profiles[m.id],data=this.data;if(!d||!data)return false;
  const magazine=r.type==='mag',S=magazine?(r.empty?m.keys.E:m.keys.Tac):null;
  const key=magazine?d[r.empty?'empty':'tactical']:r.phase==='start'?'shellStart':r.phase==='end'?'shellEnd':'shellLoad',clip=data.clips[key];if(!clip||magazine&&!S)return false;
  const p=U.clamp(magazine?r.p:r.phase==='load'?r.shellP:r.pp,0,1),t=magazine?this.time(S,p):p;
  sample(clip,t,A);sample(clip,0,B);sample(clip,1,C);
  const recovery=!!state?.poseRecovery,weight=(magazine?smooth(p/.10)*smooth((1-p)/.12):r.phase==='start'?smooth(p/.18):r.phase==='end'?smooth((1-p)/.20):1)*(recovery?1-smooth((G.PoseRecovery?.t||0)/.13):1);
  // 총몸은 원본 전체 곡선을 사용한다. 시작·끝의 좌표 차이는 제거해 자세가 누적되지 않게 한다.
  for(const[k,i,limit]of [['x',6,.075],['y',7,.075],['z',8,.10],['rx',9,.48],['ry',10,.42],['rz',11,.65]]){
   const value=A[i]-mix(B[i],C[i],t),blend=.82*weight;pose[k]=mix(pose[k],U.clamp(value,-limit,limit)*d.travel,blend);
  }
  const L=m.armL,free=['reach','shellReach'].includes(L.contactMode)||(m.holdObj&&L.contactMode==='magazine'&&L.contactLock<.8);
  let displacement=0,turn=0,flight=1;
  if(magazine){const knots=S.motionKnots;let i=0;while(i<knots.length-2&&p>knots[i+1])i++;flight=Math.sin(Math.PI*U.clamp((p-knots[i])/Math.max(1e-6,knots[i+1]-knots[i]),0,1))**2;}
  if(free&&magazine&&!recovery){
   const knots=S.motionKnots;let i=0;while(i<knots.length-2&&p>knots[i+1])i++;const lo=knots[i],hi=knots[i+1],u=U.clamp((p-lo)/Math.max(1e-6,hi-lo),0,1),a=this.time(S,lo),b=this.time(S,hi);
   sample(clip,a,B);sample(clip,b,C);track(S.k,lo,_a);track(S.k,hi,_b);_c.copy(_a).lerp(_b,smooth(u));
   // 실제 자유 비행의 곡률을 두 접촉점 사이로 옮긴다. 탄창·손잡이에 닿는 끝점은 정확히 고정한다.
   const w=d.travel;
   _c.x-=Math.abs(U.clamp(A[0]-mix(B[0],C[0],u),-.12,.12))*w;
   _c.y+=U.clamp(A[1]-mix(B[1],C[1],u),-.15,.08)*w;
   _c.z+=U.clamp(A[2]-mix(B[2],C[2],u),-.12,.12)*w;
   const blend=.86*flight*(1-L.contactLock);displacement=_c.distanceTo(L.tgt)*blend;L.tgt.lerp(_c,blend);
  }
  if(free&&!magazine&&!recovery){
   const knots=r.phase==='load'?[0,.22,.40,.62,.77,1]:r.phase==='start'?[0,.14,.24,.5,.65,.82,1]:[0,.3,.7,1];let i=0;while(i<knots.length-2&&p>knots[i+1])i++;
   const lo=knots[i],hi=knots[i+1],u=U.clamp((p-lo)/Math.max(1e-6,hi-lo),0,1),w=Math.sin(Math.PI*u)**2*d.travel*(1-L.contactLock);sample(clip,lo,B);sample(clip,hi,C);
   _a.set(-Math.abs(U.clamp(A[0]-mix(B[0],C[0],u),-.08,.08)),U.clamp(A[1]-mix(B[1],C[1],u),-.10,.04),U.clamp(A[2]-mix(B[2],C[2],u),-.08,.08)).multiplyScalar(w);L.tgt.add(_a);displacement=_a.length();
  }
  // 탄창을 쥔 동안은 탄창 면에 맞는 손목을 유지하고, 자유 손에 원본 회전을 옮긴다.
  if(!recovery&&(L.contactMode==='reach'||L.contactMode==='shellReach')){
   // 180도를 넘는 원본 회전도 손바닥·손가락 방향으로 옮겨 짧은 회전축이 뒤집히지 않게 한다.
   _q.fromArray(A,12).normalize();const blend=.38*weight*flight*(1-L.contactLock);_c.copy(L.palmTarget).normalize();_a.copy(L.palmTarget).applyQuaternion(_q);_b.copy(L.fingerTarget).applyQuaternion(_q);
   L.palmRef=L.palmTarget.lerp(_a,blend).normalize();L.fingerRef=L.fingerTarget.lerp(_b,blend).normalize();turn=Math.acos(U.clamp(_c.dot(L.palmTarget),-1,1));
   if(L.contactMode==='reach'||L.contactMode==='shellReach'){const grip=U.clamp(A[20],0,1);L.curlT=mix(.20,.78,grip);L.trigT=mix(.14,.65,grip);L.thumbT=mix(.22,.62,grip);}
  }
  m.reloadMotion={sourceClip:clip.sourceClip,source:data.sources[clip.source].author,time:t,weight,handDisplacement:displacement,wristTurn:turn,mechanism:d.mechanism};return true;
 }
};
})();
