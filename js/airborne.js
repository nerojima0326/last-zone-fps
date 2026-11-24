// airborne.js — 수송기 이탈·강하 자세·낙하산 팽창과 항력을 공유한다.
(function () {
'use strict';
const G = window.G, T = window.THREE, U = G.U;
const _v = new T.Vector3();
G.Airborne = {
  deployDuration: 1.15,
  begin(a, p) {
    const side = a.id % 2 ? -1 : 1;
    const exit = p.mesh.userData.exits?.[side < 0 ? 0 : 1];
    a.pos.copy(exit || _v.set(side * 3.05, -1.9, 6.6)).applyQuaternion(p.mesh.quaternion).add(p.pos);
    // 기체의 전진 속도를 물려받고 문 바깥으로 밀려난 뒤 공기 저항으로 감속한다.
    a.vel.copy(p.dir).multiplyScalar(p.speed).add(_v.set(side * 5, -3.4, 0).applyQuaternion(p.mesh.quaternion));
    a.air = { elapsed: 0, deployT: -1, open: 0, openV: -48, dive: 0, forward: 0, steer: 0, side };
    a.onGround = false;
  },
  open(a) {
    const s = a.air || (a.air = { elapsed: 1, dive: 0, forward: 0, steer: 0, side: 1 });
    s.deployT = 0; s.open = 0; s.openV = Math.min(-5.2, a.vel.y);
  },
  tick(a, dt, dive, forward, steer) {
    const s = a.air;
    if (!s) return;
    s.elapsed += dt;
    s.dive = U.damp(s.dive, dive ? 1 : 0, 5, dt);
    s.forward = U.damp(s.forward, forward, 6, dt);
    s.steer = U.damp(s.steer, steer, 5, dt);
    if (a.state === 'chute') {
      s.deployT = Math.min(3, s.deployT + dt);
      s.open = U.smoothstep(.12, this.deployDuration, s.deployT);
    }
  },
  velocity(a, dt, x, z, y) {
    const s = a.air, chute = a.state === 'chute', open = chute ? (s?.open ?? 1) : 0;
    const k = U.lerp(1.6, 2.5, open);
    a.vel.x = U.damp(a.vel.x, x, k, dt); a.vel.z = U.damp(a.vel.z, z, k, dt);
    // 천이 부풀기 전부터 완성된 낙하산의 제동력을 적용하지 않는다.
    const target = chute && s ? U.lerp(s.openV, y, open) : y;
    a.vel.y = U.damp(a.vel.y, target, U.lerp(1.2, 5, open), dt);
  },
  pose(m, a) {
    const s = a.air, t = s?.elapsed || 0, dive = s?.dive || 0;
    const exit = U.smoothstep(.08, .85, t), flutter = Math.sin(t * 7 + m.phase);
    const opening = a.state === 'chute' ? U.smoothstep(.04, 1, s?.deployT ?? 2) : 0;
    const tilt = U.lerp(-1.28, -2.85, dive);
    m.root.rotation.x = U.lerp(U.lerp(-.18, tilt, exit), .04 + dive * .17, opening);
    m.root.rotation.z = U.lerp((1 - exit) * (s?.side || 1) * .25 + (s?.steer || 0) * .12, -(s?.steer || 0) * .12, opening);
    m.poseTargetY = U.lerp(.35 + exit * .5, 0, opening);
    m.spine.rotation.x = U.lerp(.08, -.04, opening);
    m.chest.rotation.x = U.lerp(.2 - dive * .14, .04, opening);
    m.head.rotation.x = U.lerp(.42 - dive * .25, .06, opening);
    for (const side of [-1, 1]) {
      const left = side < 0, arm = left ? m.armL : m.armR, elbow = left ? m.elbowL : m.elbowR;
      const leg = left ? m.legL : m.legR, knee = left ? m.kneeL : m.kneeR;
      const wave = flutter * (left ? 1 : -1);
      arm.rotation.set(U.lerp(U.lerp(.65, .32 + wave * .035, exit), 2.82 - dive * .25, opening), 0,
        side * U.lerp(U.lerp(.4, U.lerp(1.2, .22, dive), exit), .25 + Math.abs(s?.steer || 0) * .08, opening));
      elbow.rotation.x = U.lerp(.65 - dive * .42, .28 + dive * .15, opening);
      leg.rotation.set(U.lerp(U.lerp(left ? -.25 : .65, .20 + wave * .045 - dive * .2, exit), .12 + wave * .045, opening), 0,
        side * U.lerp(.18 - dive * .13, .04, opening));
      knee.rotation.x = U.lerp(U.lerp(left ? -.3 : -.95, -.55 + dive * .43, exit), -.25 - dive * .12, opening);
    }
    // 펼치기 초반에는 오른손으로 가슴의 손잡이를 당긴다.
    if (a.state === 'chute' && (s?.deployT ?? 2) < .28) {
      const pull = Math.sin(Math.PI * U.clamp(s.deployT / .28, 0, 1));
      m.armR.rotation.x = U.lerp(m.armR.rotation.x, 1.25, pull);
      m.armR.rotation.z = U.lerp(m.armR.rotation.z, -.2, pull);
      m.elbowR.rotation.x = U.lerp(m.elbowR.rotation.x, 1.7, pull);
    }
    m.ikGun = null; m.setGun(null);
  }
};
})();
