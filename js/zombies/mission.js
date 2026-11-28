// v109 난이도·대사·목표 좌표는 일반 경기 설정과 별도로 보관한다.
const T=window.THREE;
export const DIFFICULTIES={
 survivor:{name:'생존자',speed:.78,hp:.8,damage:.55,cap:40,ammo:1.65,spawn:4.2,heal:true,revive:true,checkpoints:[0,1,2,3,4,5],evac:100},
 infected:{name:'감염 구역',speed:1,hp:1,damage:1,cap:44,ammo:1,spawn:3.4,heal:true,revive:false,checkpoints:[0,1,2,3,4,5],evac:120},
 nightmare:{name:'악몽',speed:1.16,hp:1.15,damage:1.2,cap:50,ammo:.78,spawn:2.5,heal:true,revive:false,checkpoints:[0,2,4,5],evac:135},
 doomsday:{name:'최후의 날',speed:1.25,hp:1.28,damage:1.4,cap:56,ammo:.62,spawn:2.1,heal:false,revive:false,checkpoints:[0,2,4],evac:150}
};
export const STAGES=[
 {id:'street',title:'프롤로그 · 검역 정문',radio:'여기는 대피 통제소. 백야 검역단지가 봉쇄됐다. 정문 제염소를 지나 의무 보급동으로 이동하라. 이동은 W A S D, 사격은 마우스. 머리를 노려라.',goal:'무전 확인 후 정찰 지점까지 이동',kills:8},
 {id:'supply',title:'목표 1 · 보급소 확보',radio:'의무 보급동에 예비 탄약이 있다. 문을 열면 소리가 난다. 주변을 확보하고 상자를 열어라.',goal:'보급소 문을 열고 감염자 제거',kills:18},
 {id:'generator',title:'목표 2 · 발전기 재가동',radio:'다리 전원이 끊겼다. 연료통 두 개를 회수해 발전기에 넣어라. 운반 중에는 권총이나 칼을 써라. 가동 후 90초 동안 지켜야 한다.',goal:'연료통 2개 회수 · 발전기 방어',kills:0},
 {id:'bridge',title:'목표 3 · 다리 돌파',radio:'전력이 돌아왔다. 차량으로 차단문을 돌파하거나, 옆 보행 통로의 잠금을 풀어라. 배수로에 내려갔다면 양 끝 정비 경사로로 복귀하라.',goal:'차량 돌파 / 보행 통로 중 선택',kills:12},
 {id:'tower',title:'목표 4 · 무전탑 신호',radio:'통신 중정의 송신탑으로 올라가 구조 신호를 보내라. 거대한 감염자가 접근한다. 등에 빛나는 감염 조직이 약점이다.',goal:'무전탑에 올라 신호 송출 · 차단자 처치',kills:0},
 {id:'harbor',title:'최종 목표 · 비상 헬기장',radio:'구조 헬기가 남측 비상 헬기장으로 향한다. 착륙장을 확보하라. 도착 후 제한 시간 안에 탑승해야 한다.',goal:'착륙장 방어 · 구조 헬기 탑승',kills:0}
];
// v110 섬 좌표를 쓰지 않고 전용 단지 배치에서 목표를 읽는다.
export function layout(nav){
 const G=window.G,p=G.World.missionMap?.data.points;if(!p)throw Error('좀비 전용 맵이 준비되지 않았습니다');
 const safe=(x,z,r=24)=>nav.nearest(x,z,r),point=(v)=>safe(v[0],v[1]),bridge=G.World.bridges[0],axis=new T.Vector3(bridge.ux,0,bridge.uz),side=new T.Vector3(-axis.z,0,axis.x),center=new T.Vector3(bridge.x,bridge.y,bridge.z),near=center.clone().addScaledVector(axis,-bridge.half-15),far=center.clone().addScaledVector(axis,bridge.half+18),tower=point(p.tower);
 return{start:point(p.start),rally:point(p.rally),supply:point(p.supply),generator:point(p.generator),bridge,axis,side,near:safe(near.x,near.z),far:safe(far.x,far.z),tower,harbor:point(p.harbor),fuel:p.fuel.map(point),towerTop:tower.clone().add(new T.Vector3(0,7.2,0)),gate:center.clone().addScaledVector(axis,-bridge.half+3),foot:center.clone().addScaledVector(axis,-bridge.half-8).addScaledVector(side,2.4),car:safe(near.x-axis.x*13,near.z-axis.z*13)};
}
