// 바퀴 접지·중력 낙하·착지 충격. 수직 적분은 최대 1/120초 간격으로 나눈다.
(function(){
'use strict';
const G=window.G,U=G.U,GRAVITY=9.81;
G.VehicleSuspension={
  reset(v){v.grounded=true;v.flight=false;v.contactFresh=true;v.settleT=0;v.vy=0;v.springOffset=0;v.springVelocity=0;v.pitchRate=0;v.rollRate=0;v.yawRate=0},
  step(v,floor,dt){
    if(!Number.isFinite(v.vy))this.reset(v);const y=v.pos.y,parts=Math.max(1,Math.ceil(dt*120)),h=dt/parts;v.settleT=Math.max(0,(v.settleT||0)-dt);
    let falling=!v.grounded;
    if(v.grounded){
      if(v.contactFresh){const tangent=(floor-y)/Math.max(.001,dt);if(Math.abs(tangent)<8)v.vy=tangent;v.contactFresh=false}
      const predicted=y+U.clamp(v.vy,-8,8)*dt-GRAVITY*.5*dt*dt;
      if(floor<predicted-.002)falling=true;
      else{
        v.pos.y=floor;
        // 상판·연석의 위치 보정을 발사 속도로 바꾸지 않는다. 지상 수직 속도는 제한하고 감쇠한다.
        v.vy=U.damp(v.vy,U.clamp((floor-y)/Math.max(.001,dt),-8,8),14,dt);
      }
    }
    if(falling){
      for(let i=0;i<parts;i++){v.vy-=GRAVITY*h;v.pos.y+=v.vy*h}
      if(v.pos.y<=floor){
        const impact=Math.max(0,-v.vy);v.pos.y=floor;v.vy=0;v.grounded=true;
        if(v.flight){
          v.lastLandingSpeed=impact;v.landings=(v.landings||0)+1;v.springVelocity=-Math.min(2.8,impact*.15);v.settleT=.65;
          if(impact>2.5&&v.pos.distanceTo(G.camera.position)<100){G.Audio.impact(v.pos,'rubber');G.FX.dust(v.pos,5,0,.6,0,.45,.41,.34,.9);if(v.driver?.isPlayer)G.FX.shake(Math.min(.25,impact*.012))}
          if(impact>16&&!v.dead)G.Vehicles.damage(v,(impact-16)*8,null,'crash');
        }v.flight=false;
      }else{
        // 짧은 높이 차는 서스펜션 이동 범위에서 흡수한다. 바퀴까지 떨어진 경우에만 공중 상태가 된다.
        if(v.pos.y-floor>.18)v.flight=true;v.grounded=!v.flight;
      }
    }
    // v108 질량에 따라 차체의 복귀 속도만 바꾼다. 자유낙하 중력·접지 기준은 공통이다.
    const mass=(G.Vehicles.spec(v).mass||1.7)/1.7;
    for(let i=0;i<parts;i++){v.springVelocity+=(-160/mass*v.springOffset-22/Math.sqrt(mass)*v.springVelocity)*h;v.springOffset=U.clamp(v.springOffset+v.springVelocity*h,-.16,.05)}
    if(Math.abs(v.springOffset)<.0001&&Math.abs(v.springVelocity)<.001)v.springOffset=v.springVelocity=0;
  }
};
})();
