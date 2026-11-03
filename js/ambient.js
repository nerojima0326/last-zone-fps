// ambient.js — 분위기 효과: 하늘을 도는 새 떼, 햇빛에 반짝이는 꽃가루·먼지
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const Amb = G.Ambient = {
  ready: false, t: 0, flocks: [],
  init(world) {
    this.ready = true;
    const scene = world.scene;
    this.time = { value: 0 };
    /* ---------------- 새 떼 ---------------- */
    // 새 한 마리: 몸통 + 날개 두 장 (aWing: 날개 끝일수록 1 → 셰이더에서 날갯짓)
    const pos = [], wing = [];
    const tri = (a, b, c, wa, wb, wc) => { pos.push(...a, ...b, ...c); wing.push(wa, wb, wc); };
    tri([0, 0, -0.45], [-0.09, 0, 0.3], [0.09, 0, 0.3], 0, 0, 0);                // 몸통
    tri([0, 0, -0.12], [0, 0, 0.18], [-0.75, 0.05, 0.08], 0, 0, 1);              // 왼 날개
    tri([0, 0, -0.12], [-0.75, 0.05, 0.08], [-1.15, 0.02, 0.3], 0, 1, 1.6);
    tri([0, 0, -0.12], [0.75, 0.05, 0.08], [0, 0, 0.18], 0, 1, 0);               // 오른 날개
    tri([0, 0, -0.12], [1.15, 0.02, 0.3], [0.75, 0.05, 0.08], 0, 1.6, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
    g.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0x1b1d20, side: THREE.DoubleSide, fog: true });
    const tU = this.time;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = tU;
      sh.vertexShader = 'uniform float uTime;\nattribute float aWing;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = float(gl_InstanceID) * 1.37;
        float flap = sin(uTime * (7.0 + mod(ph, 2.0)) + ph);
        float glide = smoothstep(-0.2, 0.6, sin(uTime * 0.35 + ph * 0.5));   // 가끔 날개를 펴고 활공
        transformed.y += aWing * flap * 0.55 * (1.0 - glide * 0.85);`);
    };
    const NF = 4, NB = 9;
    const im = this.birds = new THREE.InstancedMesh(g, mat, NF * NB);
    im.frustumCulled = false;
    scene.add(im);
    const r = U.mulberry32(4242);
    for (let f = 0; f < NF; f++) {
      const birds = [];
      for (let b = 0; b < NB; b++) birds.push({ ox: (r() - 0.5) * 14, oy: (r() - 0.5) * 5, oz: (r() - 0.5) * 14, ph: r() * 6.28, s: 0.8 + r() * 0.4 });
      this.flocks.push({
        cx: (r() - 0.5) * 900, cz: (r() - 0.5) * 900, R: 60 + r() * 90, y: 70 + r() * 60,
        sp: (0.07 + r() * 0.06) * (r() < 0.5 ? 1 : -1), a: r() * 6.28, drift: r() * 6.28, birds
      });
    }
    /* ---------------- 꽃가루·먼지 ---------------- */
    const N = 420, P = new Float32Array(N * 3), S = new Float32Array(N);
    for (let i = 0; i < N; i++) { P[i * 3] = Math.random(); P[i * 3 + 1] = Math.random(); P[i * 3 + 2] = Math.random(); S[i] = Math.random(); }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));
    this.moteU = { uTime: this.time, uCam: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uBox: { value: 22 }, uScale: { value: 1 } };
    const pm = new THREE.ShaderMaterial({
      uniforms: this.moteU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime; uniform vec3 uCam; uniform float uBox; uniform float uScale; uniform vec3 uSun;
        attribute float aSeed; varying float vA; varying float vBack;
        void main() {
          // 카메라 주변 상자 안을 천천히 떠다닌다 (상자 밖으로 나가면 반대편에서 다시)
          vec3 drift = vec3(sin(uTime * 0.13 + aSeed * 40.0) * 2.0 + uTime * 0.35, sin(uTime * 0.21 + aSeed * 17.0) * 1.2 + uTime * 0.05, cos(uTime * 0.11 + aSeed * 23.0) * 2.0 + uTime * 0.18);
          vec3 base = uCam - uBox * 0.5;
          vec3 p = base + mod(position * uBox + drift - base, uBox);
          p.y = uCam.y - 3.0 + mod(position.y * 9.0 + drift.y, 9.0);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          gl_PointSize = uScale * (1.2 + aSeed * 1.6) * 60.0 / max(d, 0.5);
          vA = (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(p - uCam))) * smoothstep(0.6, 2.0, d) * (0.4 + 0.6 * fract(aSeed * 7.3 + uTime * 0.05));
          vBack = pow(max(dot(normalize(p - uCam), uSun), 0.0), 4.0);
        }`,
      fragmentShader: `
        uniform vec3 uSunCol; varying float vA; varying float vBack;
        void main() {
          vec2 q = gl_PointCoord - 0.5; float r = dot(q, q);
          if (r > 0.25) discard;
          float a = (1.0 - r * 4.0) * vA * (0.12 + vBack * 1.1);
          gl_FragColor = vec4(uSunCol * a, 1.0);
        }`
    });
    const pts = this.motes = new THREE.Points(pg, pm);
    pts.frustumCulled = false;
    scene.add(pts);
  },
  update(dt, camPos, world) {
    if (!this.ready) this.init(world);
    this.t += dt; this.time.value = this.t;
    // 새 떼: 큰 원을 그리며 천천히 이동
    const m = _m, q = _q, e = _e, p = _p, s = _s;
    let i = 0;
    for (const F of this.flocks) {
      F.a += F.sp * dt;
      F.drift += dt * 0.01;
      const cx = F.cx + Math.cos(F.drift) * 120, cz = F.cz + Math.sin(F.drift * 1.3) * 120;
      const x = cx + Math.cos(F.a) * F.R, z = cz + Math.sin(F.a) * F.R;
      const sg = Math.sign(F.sp), head = Math.atan2(Math.sin(F.a) * sg, -Math.cos(F.a) * sg);
      for (const b of F.birds) {
        const wob = Math.sin(this.t * 0.7 + b.ph);
        p.set(x + b.ox + wob * 1.5, F.y + b.oy + Math.sin(this.t * 0.9 + b.ph) * 1.2, z + b.oz + Math.cos(this.t * 0.6 + b.ph) * 1.5);
        e.set(0, head + wob * 0.08, -sg * 0.25 + wob * 0.05, 'YXZ');
        q.setFromEuler(e); s.setScalar(b.s);
        m.compose(p, q, s);
        this.birds.setMatrixAt(i++, m);
      }
    }
    this.birds.instanceMatrix.needsUpdate = true;
    // 먼지: 해 방향·색 맞추기, 높은 곳(수송기)에서는 숨김
    const U2 = this.moteU;
    U2.uCam.value.copy(camPos);
    U2.uSun.value.copy(world.sunDir);
    U2.uSunCol.value.copy(world.sun.color).multiplyScalar(0.9);
    U2.uScale.value = innerHeight / 720;
    this.motes.visible = G.quality !== 'low' && camPos.y - world.heightAt(camPos.x, camPos.z) < 30;
  }
};
})();
