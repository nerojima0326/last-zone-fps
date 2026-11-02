// gunlib.js — 절차적 총기 15종 + 조준경 5종 모델 (실제 크기, m 단위)
// 총 공간: 원점 = 방아쇠, 총구 -Z, 위 +Y. 실사 모델(gunmodels.js)이 있는 총은 그 모델이 우선한다.
// 각 총은 부품(body, mag, slide, pump, charge, bolt, barrel, cyl, rearsight)별·재질별 지오메트리와
// 손·조준선·레일 같은 기준점을 함께 돌려준다 → 1인칭 뷰모델 / 3인칭 / 전리품 모델이 같은 데이터를 쓴다.
(function () {
'use strict';
const THREE = window.THREE, G = window.G;
const V3 = THREE.Vector3;

// 재질 색 (1인칭은 재질별 메시, 3인칭·전리품은 정점 색으로 병합)
const COL = {
  metal: 0x2b2d31, dark: 0x17181b, poly: 0x202124, wood: 0x6a3a1c, woodL: 0x8e5a2c, tan: 0x9c8762, olive: 0x4c5530,
  steel: 0x8f949b, chrome: 0xc3c8ce, brass: 0xc9a040, shell: 0xa82222, bake: 0x7a3414, lens: 0x2c4a5e, dot: 0xff3020, fiber: 0x50ff60
};

class Builder {
  constructor() { this.parts = {}; this.pivots = {}; }
  add(part, mat, g) {
    if (g.index) g = g.toNonIndexed();
    const p = this.parts[part] || (this.parts[part] = {});
    (p[mat] || (p[mat] = [])).push(g);
    return this;
  }
  rot(g, rx, ry, rz) { if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0))); return g; }
  box(part, mat, w, h, d, x, y, z, rx, ry, rz) { return this.add(part, mat, this.rot(new THREE.BoxGeometry(w, h, d), rx, ry, rz).translate(x, y, z)); }
  // z 축 원기둥: zA 에서 반지름 rA, zB 에서 rB
  cyl(part, mat, rA, rB, zA, zB, x, y, seg, open) {
    const len = Math.abs(zB - zA) || 0.001;
    const top = zB > zA ? rB : rA, bot = zB > zA ? rA : rB;
    const g = new THREE.CylinderGeometry(top, bot, len, seg || 14, 1, !!open);
    g.rotateX(Math.PI / 2).translate(x || 0, y || 0, (zA + zB) / 2);
    return this.add(part, mat, g);
  }
  cylX(part, mat, r, len, x, y, z, seg) { return this.add(part, mat, new THREE.CylinderGeometry(r, r, len, seg || 16).rotateZ(Math.PI / 2).translate(x, y, z)); }
  cylY(part, mat, r, len, x, y, z, seg, r1, rx) { return this.add(part, mat, this.rot(new THREE.CylinderGeometry(r1 !== undefined ? r1 : r, r, len, seg || 12), rx || 0).translate(x, y, z)); }
  sphere(part, mat, r, x, y, z) { return this.add(part, mat, new THREE.SphereGeometry(r, 10, 8).translate(x, y, z)); }
  disc(part, mat, r, x, y, z) { return this.add(part, mat, new THREE.CircleGeometry(r, 20).translate(x, y, z)); }
  // 레일 이빨
  rail(part, mat, y, z0, z1, w) {
    const n = Math.max(2, Math.round(Math.abs(z1 - z0) / 0.01));
    for (let i = 0; i < n; i++) this.box(part, mat, (w || 0.024) + 0.004, 0.004, 0.005, 0, y, z0 + (z1 - z0) * (i + 0.5) / n);
    return this;
  }
  // 뒤 가늠자: 가운데가 파인 U 홈 (위끝 = 조준선 높이 top)
  notch(top, z, w, h, d) {
    w = w || 0.022; h = h || 0.014; d = d || 0.01;
    const ear = w * 0.36;
    for (const sx of [-1, 1]) this.box('rearsight', 'dark', ear, h, d, sx * (w / 2 - ear / 2), top - h / 2, z);
    this.box('rearsight', 'dark', w, h * 0.45, d, 0, top - h + h * 0.225, z);
    return this;
  }
  // 공통 방아쇠·방아쇠울
  trigger(mat, y, z, len) {
    this.box('body', mat || 'metal', 0.006, 0.005, len || 0.06, 0, (y || -0.022), (z || -0.005));
    this.box('body', mat || 'metal', 0.006, 0.022, 0.006, 0, (y || -0.022) + 0.009, (z || -0.005) - (len || 0.06) / 2 + 0.003);
    this.box('body', 'dark', 0.004, 0.018, 0.005, 0, -0.008, 0, 0.25);
    return this;
  }
  // 경사진 손잡이 + 탄창(손잡이 안) 배치 계산
  grip(mat, w, h, d, x, y, z, rx) { return this.box('body', mat, w, h, d, x, y, z, rx); }
  done(meta) {
    const parts = {};
    for (const k in this.parts) {
      parts[k] = {};
      for (const m in this.parts[k]) {
        const list = this.parts[k][m];
        const g = list.length === 1 ? list[0] : THREE.mergeGeometries(list, false);
        g.computeBoundingBox();
        parts[k][m] = g;
      }
    }
    const v = (a) => a ? new V3(a[0], a[1], a[2]) : null;
    const piv = {};
    for (const k in this.pivots) piv[k] = v(this.pivots[k]);
    return {
      parts, pivots: piv, trigger: new V3(0, 0, 0), muzzle: v(meta.muzzle),
      sight: meta.sight ? { y: meta.sight[0], z: meta.sight[1] } : null,
      rail: meta.rail ? { y: meta.rail[0], z: meta.rail[1], on: meta.rail[2] || 'body' } : null,
      fore: v(meta.fore), port: v(meta.port), charge: v(meta.charge), slideTop: v(meta.slideTop),
      magDir: v(meta.magDir || [0, -1, 0]).normalize(), extra: meta.extra || {}
    };
  }
}

// 손잡이 각도 rx 로 기울어진 탄창: 손잡이 아랫면 중심 bottom 에서 위로 len 만큼
function gripAxis(rx) { return new V3(0, Math.cos(rx), Math.sin(rx)); }   // 손잡이 위쪽 방향
function addPistolMag(B, bottom, rx, len, w, d, protrude, matBody, matBase) {
  const up = gripAxis(rx);
  const c = bottom.clone().addScaledVector(up, len / 2 - protrude);
  B.box('mag', matBody || 'dark', w, len, d, c.x, c.y, c.z, rx);
  const b = bottom.clone().addScaledVector(up, -protrude - 0.005);
  B.box('mag', matBase || 'poly', w + 0.006, 0.01, d + 0.014, b.x, b.y, b.z + 0.004, rx);
  B.pivots.mag = [bottom.x, bottom.y - protrude, bottom.z];
  return up.clone().negate(); // 탄창이 빠지는 방향
}
function gripBottom(cx, cy, cz, h, rx) { return new V3(cx, cy, cz).addScaledVector(gripAxis(rx), -h / 2); }

/* ------------------------------------------------------------------ */
/* 총기 설계 (m)                                                        */
/* ------------------------------------------------------------------ */
const DESIGNS = {
  // ---------------- 소총 ----------------
  ar7(B) { // M4 계열
    B.box('body', 'metal', 0.04, 0.045, 0.2, 0, 0.01, -0.03);
    B.box('body', 'metal', 0.038, 0.035, 0.22, 0, 0.05, -0.05);
    B.box('body', 'dark', 0.026, 0.008, 0.22, 0, 0.071, -0.07); B.rail('body', 'dark', 0.077, -0.17, 0.03);
    B.box('body', 'tan', 0.046, 0.046, 0.2, 0, 0.045, -0.26);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) B.box('body', 'dark', 0.003, 0.016, 0.04, s * 0.024, 0.045, -0.2 - i * 0.055);
    B.cyl('body', 'metal', 0.008, 0.008, -0.36, -0.53, 0, 0.05);
    B.box('body', 'metal', 0.02, 0.03, 0.02, 0, 0.066, -0.37); B.box('body', 'dark', 0.004, 0.022, 0.004, 0, 0.09, -0.37);
    B.cyl('body', 'dark', 0.011, 0.011, -0.53, -0.57, 0, 0.05, 8);
    B.box('body', 'poly', 0.026, 0.08, 0.036, 0, -0.045, 0.045, -0.3);
    B.trigger('metal');
    B.cyl('body', 'metal', 0.011, 0.011, 0.08, 0.2, 0, 0.03);
    B.box('body', 'tan', 0.036, 0.07, 0.11, 0, 0.005, 0.2); B.box('body', 'poly', 0.038, 0.078, 0.014, 0, 0.0, 0.26);
    B.box('body', 'metal', 0.032, 0.032, 0.062, 0, -0.016, -0.065);
    B.box('body', 'dark', 0.002, 0.016, 0.04, 0.02, 0.05, -0.03);
    B.box('mag', 'dark', 0.024, 0.08, 0.055, 0, -0.05, -0.066, 0.1); B.box('mag', 'dark', 0.024, 0.06, 0.052, 0, -0.112, -0.056, 0.3); B.box('mag', 'poly', 0.027, 0.008, 0.058, 0, -0.144, -0.046, 0.3);
    B.pivots.mag = [0, -0.012, -0.066];
    B.box('charge', 'dark', 0.03, 0.008, 0.016, 0, 0.064, 0.06); B.pivots.charge = [0, 0.064, 0.06];
    return { muzzle: [0, 0.05, -0.57], sight: null, rail: [0.079, -0.06], fore: [-0.006, 0.014, -0.26], charge: [0, 0.07, 0.07] };
  },
  ka47(B) { // AK-47 계열 (나무 개머리판)
    B.box('body', 'metal', 0.042, 0.06, 0.29, 0, 0.04, -0.07);
    B.box('body', 'metal', 0.04, 0.016, 0.25, 0, 0.074, -0.075);
    B.cyl('body', 'metal', 0.019, 0.019, 0.05, -0.19, 0, 0.074, 12);
    B.box('body', 'dark', 0.026, 0.022, 0.035, 0, 0.084, -0.215);
    B.notch(0.106, -0.21, 0.022, 0.014, 0.01);
    B.box('body', 'wood', 0.05, 0.05, 0.2, 0, 0.032, -0.33);
    B.box('body', 'wood', 0.034, 0.026, 0.17, 0, 0.078, -0.32);
    B.box('body', 'metal', 0.026, 0.04, 0.03, 0, 0.066, -0.44);
    B.cyl('body', 'metal', 0.0095, 0.0095, -0.43, -0.6, 0, 0.048);
    B.cyl('body', 'metal', 0.006, 0.006, -0.42, -0.53, 0, 0.074, 8);
    B.box('body', 'metal', 0.022, 0.036, 0.025, 0, 0.068, -0.565); B.box('body', 'dark', 0.004, 0.022, 0.004, 0, 0.095, -0.565);
    B.cyl('body', 'dark', 0.013, 0.013, -0.6, -0.635, 0, 0.048, 10);
    B.cyl('body', 'steel', 0.003, 0.003, -0.44, -0.6, 0, 0.028, 6);
    B.box('body', 'wood', 0.03, 0.1, 0.042, 0, -0.05, 0.055, -0.3);
    B.trigger('metal', -0.022, -0.005, 0.07);
    B.box('body', 'wood', 0.04, 0.085, 0.24, 0, -0.005, 0.2, 0.12); B.box('body', 'dark', 0.042, 0.1, 0.012, 0, -0.02, 0.32, 0.12);
    B.box('mag', 'bake', 0.028, 0.085, 0.07, 0, -0.035, -0.1, 0.12); B.box('mag', 'bake', 0.028, 0.08, 0.068, 0, -0.108, -0.086, 0.35); B.box('mag', 'bake', 0.028, 0.06, 0.064, 0, -0.165, -0.062, 0.62);
    B.pivots.mag = [0, 0.005, -0.1];
    B.box('charge', 'steel', 0.022, 0.012, 0.012, 0.031, 0.058, -0.05); B.pivots.charge = [0.031, 0.058, -0.05];
    return { muzzle: [0, 0.048, -0.635], sight: [0.106, -0.21], rail: [0.092, -0.1], fore: [-0.006, -0.002, -0.33], charge: [0.04, 0.058, -0.05] };
  },
  sc17(B) { // SCAR-H 계열
    B.box('body', 'tan', 0.05, 0.055, 0.42, 0, 0.055, -0.13);
    B.box('body', 'dark', 0.026, 0.01, 0.4, 0, 0.087, -0.13); B.rail('body', 'dark', 0.094, -0.32, 0.06);
    for (const s of [-1, 1]) B.box('body', 'dark', 0.006, 0.014, 0.16, s * 0.028, 0.05, -0.24);
    B.box('body', 'poly', 0.046, 0.045, 0.19, 0, 0.008, -0.03);
    B.box('body', 'poly', 0.034, 0.03, 0.08, 0, -0.02, -0.085);
    B.cyl('body', 'metal', 0.011, 0.011, -0.34, -0.52, 0, 0.05);
    B.cyl('body', 'dark', 0.014, 0.014, -0.52, -0.57, 0, 0.05, 8);
    B.box('body', 'dark', 0.006, 0.03, 0.01, 0, 0.105, -0.32);
    B.notch(0.12, 0.04, 0.026, 0.026, 0.012);
    B.box('body', 'poly', 0.03, 0.1, 0.042, 0, -0.048, 0.055, -0.3);
    B.trigger('poly');
    B.box('body', 'tan', 0.04, 0.06, 0.2, 0, 0.045, 0.2); B.box('body', 'tan', 0.03, 0.02, 0.12, 0, 0.0, 0.22); B.box('body', 'poly', 0.042, 0.09, 0.018, 0, 0.03, 0.31);
    B.box('body', 'tan', 0.032, 0.02, 0.1, 0, 0.083, 0.2);
    B.box('mag', 'dark', 0.028, 0.12, 0.07, 0, -0.095, -0.08, 0.06); B.box('mag', 'poly', 0.031, 0.01, 0.074, 0, -0.157, -0.076, 0.06);
    B.pivots.mag = [0, -0.035, -0.085];
    B.box('charge', 'dark', 0.024, 0.012, 0.016, -0.037, 0.06, -0.2); B.pivots.charge = [-0.037, 0.06, -0.2];
    return { muzzle: [0, 0.05, -0.57], sight: [0.12, 0.04], rail: [0.096, -0.07], fore: [-0.006, 0.01, -0.25], charge: [-0.045, 0.06, -0.2] };
  },
  mk14(B) { // EBR 지정사수소총
    B.box('body', 'dark', 0.056, 0.06, 0.46, 0, 0.035, -0.13);
    B.box('body', 'metal', 0.026, 0.01, 0.5, 0, 0.07, -0.15); B.rail('body', 'metal', 0.077, -0.39, 0.09);
    for (const s of [-1, 1]) B.box('body', 'metal', 0.005, 0.014, 0.2, s * 0.03, 0.035, -0.26);
    B.box('body', 'metal', 0.03, 0.03, 0.2, 0, 0.055, -0.02);
    B.cyl('body', 'metal', 0.012, 0.0095, -0.36, -0.72, 0, 0.05);
    B.box('body', 'metal', 0.022, 0.03, 0.03, 0, 0.042, -0.4);
    B.cyl('body', 'dark', 0.014, 0.014, -0.72, -0.77, 0, 0.05, 8);
    B.box('body', 'poly', 0.032, 0.1, 0.044, 0, -0.05, 0.06, -0.3);
    B.trigger('dark');
    B.cyl('body', 'dark', 0.013, 0.013, 0.1, 0.27, 0, 0.03);
    B.box('body', 'poly', 0.042, 0.08, 0.13, 0, 0.015, 0.25); B.box('body', 'poly', 0.03, 0.02, 0.1, 0, 0.062, 0.24); B.box('body', 'dark', 0.045, 0.1, 0.02, 0, 0.005, 0.325);
    B.box('body', 'dark', 0.006, 0.03, 0.01, 0, 0.09, -0.38);
    B.notch(0.105, 0.07, 0.026, 0.03, 0.012);
    B.box('mag', 'dark', 0.03, 0.12, 0.075, 0, -0.058, -0.068, 0.08); B.box('mag', 'poly', 0.033, 0.01, 0.078, 0, -0.118, -0.063, 0.08);
    B.pivots.mag = [0, 0.002, -0.07];
    B.box('charge', 'steel', 0.012, 0.012, 0.03, 0.032, 0.05, -0.12); B.pivots.charge = [0.032, 0.05, -0.12];
    return { muzzle: [0, 0.05, -0.77], sight: [0.105, 0.07], rail: [0.079, -0.08], fore: [-0.006, 0.002, -0.27], charge: [0.04, 0.05, -0.12] };
  },
  kr98(B) { // 볼트액션 저격소총 (나무 개머리판)
    B.box('body', 'wood', 0.044, 0.11, 0.24, 0, -0.03, 0.2, 0.08); B.box('body', 'steel', 0.046, 0.12, 0.01, 0, -0.035, 0.32, 0.08);
    B.box('body', 'wood', 0.034, 0.05, 0.12, 0, 0.005, 0.06);
    B.box('body', 'wood', 0.044, 0.05, 0.22, 0, 0.03, -0.08);
    B.box('body', 'wood', 0.04, 0.042, 0.36, 0, 0.035, -0.35);
    B.cyl('body', 'metal', 0.016, 0.016, 0.05, -0.16, 0, 0.06);
    B.cyl('body', 'metal', 0.012, 0.009, -0.16, -0.76, 0, 0.06);
    B.cyl('body', 'metal', 0.011, 0.011, -0.74, -0.76, 0, 0.068);
    B.box('body', 'dark', 0.003, 0.02, 0.004, 0, 0.079, -0.745);
    B.box('body', 'dark', 0.022, 0.006, 0.03, 0, 0.077, -0.22); B.notch(0.089, -0.21, 0.022, 0.012, 0.008);
    for (const z of [-0.12, 0.02]) B.box('body', 'dark', 0.02, 0.012, 0.03, 0, 0.078, z);
    B.trigger('steel', -0.024, -0.01, 0.07);
    B.box('mag', 'dark', 0.03, 0.05, 0.08, 0, 0.01, -0.06); B.box('mag', 'steel', 0.033, 0.014, 0.086, 0, -0.022, -0.06);
    B.pivots.mag = [0, -0.015, -0.06];
    // 볼트 (총열 축을 따라 회전·후퇴)
    B.cyl('bolt', 'steel', 0.0085, 0.0085, 0.0, 0.075, 0, 0.06, 10);
    B.box('bolt', 'steel', 0.042, 0.006, 0.006, 0.028, 0.055, 0.035, 0, 0, -0.35);
    B.sphere('bolt', 'steel', 0.009, 0.05, 0.046, 0.035);
    B.pivots.bolt = [0, 0.06, 0.035];
    return { muzzle: [0, 0.06, -0.76], sight: [0.089, -0.22], rail: [0.084, -0.05], fore: [-0.006, 0.01, -0.32], charge: [0.05, 0.046, 0.035] };
  },
  // ---------------- 산탄총 ----------------
  s12(B) { // 펌프액션 (레밍턴 870 계열)
    B.box('body', 'metal', 0.046, 0.065, 0.2, 0, 0.03, -0.04);
    B.cyl('body', 'metal', 0.012, 0.012, -0.14, -0.64, 0, 0.048);
    B.box('body', 'dark', 0.008, 0.005, 0.5, 0, 0.062, -0.39);
    B.sphere('body', 'brass', 0.0032, 0, 0.0665, -0.635);
    B.cyl('body', 'metal', 0.012, 0.012, -0.14, -0.52, 0, 0.012);
    B.cyl('pump', 'wood', 0.024, 0.024, -0.38, -0.22, 0, 0.016);
    for (let i = 0; i < 6; i++) B.cyl('pump', 'dark', 0.0245, 0.0245, -0.36 + i * 0.024, -0.356 + i * 0.024, 0, 0.016);
    B.pivots.pump = [0, 0.016, -0.3];
    B.box('body', 'wood', 0.034, 0.055, 0.08, 0, 0.0, 0.08, 0.25);
    B.box('body', 'wood', 0.042, 0.1, 0.28, 0, -0.03, 0.22, 0.12); B.box('body', 'poly', 0.045, 0.115, 0.022, 0, -0.05, 0.37, 0.12);
    B.trigger('metal');
    return { muzzle: [0, 0.048, -0.64], sight: [0.069, -0.1], rail: [0.0625, -0.04], fore: [-0.004, -0.004, -0.3], port: [0, -0.003, -0.08] };
  },
  m1014(B) { // 반자동 (튜브 탄창)
    B.box('body', 'dark', 0.048, 0.068, 0.24, 0, 0.03, -0.05);
    B.box('body', 'dark', 0.024, 0.008, 0.2, 0, 0.068, -0.05); B.rail('body', 'dark', 0.074, -0.14, 0.04);
    B.cyl('body', 'metal', 0.012, 0.012, -0.17, -0.62, 0, 0.05);
    B.cyl('body', 'metal', 0.013, 0.013, -0.17, -0.52, 0, 0.012);
    B.box('body', 'dark', 0.03, 0.06, 0.02, 0, 0.03, -0.5);
    B.box('body', 'poly', 0.05, 0.045, 0.22, 0, 0.02, -0.3);
    for (let i = 0; i < 5; i++) B.box('body', 'dark', 0.051, 0.004, 0.012, 0, 0.002, -0.22 - i * 0.035);
    B.notch(0.094, 0.04, 0.03, 0.022, 0.014);
    B.box('body', 'dark', 0.02, 0.02, 0.02, 0, 0.064, -0.6); B.box('body', 'dark', 0.004, 0.02, 0.006, 0, 0.084, -0.6);
    B.box('body', 'poly', 0.032, 0.1, 0.044, 0, -0.048, 0.06, -0.3);
    B.trigger('dark');
    B.cyl('body', 'metal', 0.012, 0.012, 0.07, 0.26, 0, 0.03);
    B.box('body', 'poly', 0.04, 0.09, 0.12, 0, 0.01, 0.24); B.box('body', 'dark', 0.044, 0.1, 0.02, 0, 0.005, 0.31);
    B.box('charge', 'steel', 0.02, 0.012, 0.014, 0.032, 0.035, -0.06); B.pivots.charge = [0.032, 0.035, -0.06];
    return { muzzle: [0, 0.05, -0.62], sight: [0.094, 0.04], rail: [0.076, -0.05], fore: [-0.004, -0.004, -0.3], port: [0, -0.004, -0.09], charge: [0.04, 0.035, -0.06] };
  },
  db2(B) { // 수평 쌍대 (중절식)
    B.box('body', 'steel', 0.05, 0.06, 0.1, 0, 0.025, -0.01);
    B.box('body', 'dark', 0.01, 0.006, 0.03, 0, 0.058, 0.03);
    B.trigger('steel', -0.02, -0.0, 0.06);
    B.box('body', 'dark', 0.004, 0.018, 0.005, 0, -0.008, 0.015, 0.25);
    B.box('body', 'wood', 0.034, 0.05, 0.1, 0, 0.01, 0.09, 0.15);
    B.box('body', 'wood', 0.042, 0.1, 0.25, 0, -0.02, 0.24, 0.12); B.box('body', 'dark', 0.044, 0.112, 0.015, 0, -0.035, 0.37, 0.12);
    for (const s of [-1, 1]) B.cyl('barrel', 'metal', 0.0135, 0.0135, -0.06, -0.72, s * 0.0135, 0.03);
    B.box('barrel', 'dark', 0.01, 0.006, 0.64, 0, 0.047, -0.39);
    B.sphere('barrel', 'brass', 0.003, 0, 0.0515, -0.715);
    B.box('barrel', 'wood', 0.05, 0.028, 0.18, 0, 0.008, -0.2);
    B.pivots.barrel = [0, 0.0, -0.06];
    return { muzzle: [0, 0.03, -0.72], sight: [0.0545, -0.05], rail: [0.058, -0.015], fore: [-0.004, -0.012, -0.2], port: [0, 0.03, -0.06] };
  },
  sa12(B) { // 탄창식 반자동 (사이가 계열)
    B.box('body', 'dark', 0.044, 0.065, 0.3, 0, 0.04, -0.07);
    B.box('body', 'dark', 0.042, 0.02, 0.26, 0, 0.08, -0.075);
    B.box('body', 'metal', 0.024, 0.008, 0.2, 0, 0.094, -0.08); B.rail('body', 'metal', 0.1, -0.17, 0.01);
    B.box('body', 'poly', 0.054, 0.055, 0.2, 0, 0.035, -0.32);
    for (const s of [-1, 1]) B.box('body', 'dark', 0.004, 0.012, 0.16, s * 0.029, 0.035, -0.32);
    B.cyl('body', 'metal', 0.013, 0.013, -0.42, -0.6, 0, 0.05);
    B.cyl('body', 'dark', 0.017, 0.017, -0.6, -0.64, 0, 0.05, 10);
    B.box('body', 'metal', 0.026, 0.04, 0.03, 0, 0.068, -0.44);
    B.box('body', 'metal', 0.022, 0.034, 0.024, 0, 0.07, -0.55); B.box('body', 'dark', 0.004, 0.02, 0.004, 0, 0.096, -0.55);
    B.notch(0.106, -0.21, 0.022, 0.014, 0.01);
    B.box('body', 'poly', 0.03, 0.1, 0.042, 0, -0.05, 0.055, -0.3);
    B.trigger('metal', -0.022, -0.005, 0.07);
    B.box('body', 'poly', 0.036, 0.075, 0.23, 0, 0.0, 0.2, 0.08); B.box('body', 'dark', 0.04, 0.09, 0.014, 0, -0.01, 0.32, 0.08);
    B.box('mag', 'dark', 0.04, 0.13, 0.095, 0, -0.06, -0.095, 0.08); B.box('mag', 'poly', 0.043, 0.012, 0.098, 0, -0.128, -0.09, 0.08);
    B.pivots.mag = [0, 0.005, -0.1];
    B.box('charge', 'steel', 0.022, 0.012, 0.012, 0.031, 0.058, -0.05); B.pivots.charge = [0.031, 0.058, -0.05];
    return { muzzle: [0, 0.05, -0.64], sight: [0.106, -0.21], rail: [0.102, -0.08], fore: [-0.006, -0.002, -0.32], charge: [0.04, 0.058, -0.05] };
  },
  aa12(B) { // 자동 산탄총 (드럼 탄창)
    B.box('body', 'dark', 0.064, 0.1, 0.56, 0, 0.035, -0.12);
    B.box('body', 'poly', 0.06, 0.04, 0.2, 0, -0.03, 0.07);
    B.box('body', 'dark', 0.05, 0.07, 0.12, 0, 0.05, -0.42);
    B.box('body', 'dark', 0.03, 0.012, 0.3, 0, 0.115, -0.1); B.rail('body', 'dark', 0.123, -0.24, 0.04);
    B.box('body', 'dark', 0.02, 0.03, 0.02, 0, 0.098, 0.04); B.box('body', 'dark', 0.02, 0.03, 0.02, 0, 0.098, -0.24);
    B.notch(0.137, 0.03, 0.024, 0.016, 0.012);
    B.box('body', 'dark', 0.005, 0.02, 0.006, 0, 0.128, -0.24);
    B.cyl('body', 'metal', 0.013, 0.013, -0.46, -0.58, 0, 0.05);
    B.cyl('body', 'dark', 0.018, 0.018, -0.56, -0.6, 0, 0.05, 10);
    for (let i = 0; i < 4; i++) B.box('body', 'poly', 0.066, 0.008, 0.012, 0, 0.0, -0.22 - i * 0.04);
    B.box('body', 'poly', 0.032, 0.1, 0.044, 0, -0.05, 0.05, -0.3);
    B.trigger('poly');
    B.box('mag', 'poly', 0.04, 0.04, 0.08, 0, -0.035, -0.1);
    B.cylX('mag', 'poly', 0.068, 0.06, 0, -0.11, -0.08, 20); B.cylX('mag', 'dark', 0.03, 0.062, 0, -0.11, -0.08, 12);
    B.pivots.mag = [0, -0.015, -0.1];
    B.box('charge', 'dark', 0.02, 0.014, 0.02, -0.035, 0.085, -0.22); B.pivots.charge = [-0.035, 0.085, -0.22];
    return { muzzle: [0, 0.05, -0.6], sight: [0.137, 0.03], rail: [0.125, -0.1], fore: [-0.006, -0.008, -0.33], charge: [-0.045, 0.085, -0.22] };
  },
  // ---------------- 권총 ----------------
  p92(B) { // 베레타 92 계열
    B.box('slide', 'metal', 0.028, 0.03, 0.2, 0, 0.042, -0.075);
    for (let i = 0; i < 6; i++) B.box('slide', 'dark', 0.029, 0.024, 0.003, 0, 0.042, 0.005 + i * 0.0035);
    for (const sx of [-1, 1]) B.box('slide', 'dark', 0.006, 0.008, 0.006, sx * 0.006, 0.061, 0.015); B.box('slide', 'dark', 0.004, 0.008, 0.005, 0, 0.061, -0.168);
    B.pivots.slide = [0, 0, 0];
    B.cyl('body', 'metal', 0.0062, 0.0062, -0.17, -0.18, 0, 0.042, 10);
    B.box('body', 'metal', 0.026, 0.02, 0.16, 0, 0.017, -0.065);
    B.box('body', 'poly', 0.03, 0.1, 0.048, 0, -0.042, 0.012, -0.22);
    B.trigger('metal', -0.012, -0.03, 0.055);
    B.box('body', 'dark', 0.008, 0.014, 0.008, 0, 0.04, 0.03);
    const md = addPistolMag(B, gripBottom(0, -0.042, 0.012, 0.1, -0.22), -0.22, 0.11, 0.024, 0.034, 0.0);
    return { muzzle: [0, 0.042, -0.18], sight: [0.065, 0.015], rail: [0.057, -0.01, 'slide'], fore: [-0.023, -0.052, 0.048], slideTop: [0, 0.05, 0.0], magDir: md.toArray() };
  },
  g18(B) { // 글록 18 계열 (자동, 연장 탄창)
    B.box('slide', 'dark', 0.026, 0.03, 0.186, 0, 0.043, -0.068);
    for (let i = 0; i < 6; i++) B.box('slide', 'poly', 0.027, 0.022, 0.003, 0, 0.043, 0.0 + i * 0.0035);
    for (const sx of [-1, 1]) B.box('slide', 'dark', 0.006, 0.008, 0.006, sx * 0.006, 0.062, 0.018); B.box('slide', 'dark', 0.004, 0.008, 0.005, 0, 0.062, -0.155);
    B.pivots.slide = [0, 0, 0];
    B.box('body', 'poly', 0.027, 0.02, 0.15, 0, 0.018, -0.06); B.box('body', 'poly', 0.02, 0.008, 0.04, 0, 0.005, -0.12);
    B.box('body', 'poly', 0.03, 0.1, 0.05, 0, -0.042, 0.012, -0.3);
    B.box('body', 'steel', 0.004, 0.008, 0.012, 0.015, 0.03, 0.01);
    B.trigger('poly', -0.012, -0.03, 0.055);
    const md = addPistolMag(B, gripBottom(0, -0.042, 0.012, 0.1, -0.3), -0.3, 0.15, 0.024, 0.034, 0.05, 'dark', 'dark');
    return { muzzle: [0, 0.043, -0.162], sight: [0.066, 0.018], rail: [0.058, 0.0, 'slide'], fore: [-0.023, -0.052, 0.048], slideTop: [0, 0.05, 0.005], magDir: md.toArray() };
  },
  m1911(B) { // M1911 (스테인리스, 나무 손잡이)
    B.box('slide', 'steel', 0.024, 0.032, 0.21, 0, 0.044, -0.085);
    for (let i = 0; i < 7; i++) B.box('slide', 'metal', 0.025, 0.026, 0.0025, 0, 0.044, 0.0 + i * 0.003);
    for (const sx of [-1, 1]) B.box('slide', 'dark', 0.0055, 0.007, 0.006, sx * 0.0055, 0.0635, 0.012); B.box('slide', 'dark', 0.004, 0.007, 0.005, 0, 0.0635, -0.18);
    B.pivots.slide = [0, 0, 0];
    B.cyl('body', 'steel', 0.007, 0.007, -0.19, -0.195, 0, 0.044, 10);
    B.box('body', 'steel', 0.024, 0.02, 0.17, 0, 0.017, -0.075);
    B.box('body', 'woodL', 0.03, 0.095, 0.045, 0, -0.04, 0.012, -0.2); B.box('body', 'steel', 0.022, 0.095, 0.01, 0, -0.038, 0.036, -0.2);
    B.box('body', 'dark', 0.008, 0.014, 0.008, 0, 0.042, 0.03, 0.3);
    B.trigger('steel', -0.012, -0.03, 0.05);
    const md = addPistolMag(B, gripBottom(0, -0.04, 0.012, 0.095, -0.2), -0.2, 0.1, 0.022, 0.033, 0.0, 'dark', 'steel');
    return { muzzle: [0, 0.044, -0.195], sight: [0.0665, 0.012], rail: [0.06, -0.02, 'slide'], fore: [-0.023, -0.052, 0.048], slideTop: [0, 0.052, 0.0], magDir: md.toArray() };
  },
  de7(B) { // 데저트 이글 계열 (대형)
    B.box('slide', 'chrome', 0.033, 0.045, 0.26, 0, 0.05, -0.1);
    B.box('slide', 'chrome', 0.022, 0.012, 0.22, 0, 0.077, -0.11);
    for (let i = 0; i < 5; i++) B.box('slide', 'steel', 0.034, 0.034, 0.003, 0, 0.05, 0.005 + i * 0.004);
    for (const sx of [-1, 1]) B.box('slide', 'dark', 0.007, 0.009, 0.008, sx * 0.0068, 0.087, 0.02); B.box('slide', 'dark', 0.005, 0.01, 0.006, 0, 0.087, -0.215);
    B.cyl('slide', 'dark', 0.008, 0.008, -0.229, -0.232, 0, 0.05, 10);
    B.pivots.slide = [0, 0, 0];
    B.box('body', 'dark', 0.03, 0.025, 0.2, 0, 0.016, -0.08);
    B.box('body', 'poly', 0.034, 0.11, 0.055, 0, -0.048, 0.018, -0.2);
    B.box('body', 'dark', 0.01, 0.016, 0.01, 0, 0.044, 0.035, 0.3);
    B.trigger('dark', -0.014, -0.032, 0.065);
    const md = addPistolMag(B, gripBottom(0, -0.048, 0.018, 0.11, -0.2), -0.2, 0.115, 0.026, 0.04, 0.0, 'dark', 'dark');
    return { muzzle: [0, 0.05, -0.232], sight: [0.0915, 0.02], rail: [0.083, -0.03, 'slide'], fore: [-0.025, -0.058, 0.052], slideTop: [0, 0.07, 0.0], magDir: md.toArray() };
  },
  r45(B) { // 스윙아웃 리볼버
    B.box('body', 'steel', 0.03, 0.065, 0.1, 0, 0.03, -0.03);
    B.box('body', 'steel', 0.022, 0.01, 0.1, 0, 0.065, -0.035);
    B.cyl('body', 'steel', 0.009, 0.009, -0.08, -0.22, 0, 0.045);
    B.box('body', 'steel', 0.016, 0.018, 0.14, 0, 0.032, -0.15);
    B.box('body', 'steel', 0.012, 0.008, 0.14, 0, 0.057, -0.15);
    B.box('body', 'dark', 0.004, 0.012, 0.012, 0, 0.065, -0.21);
    for (const sx of [-1, 1]) B.box('body', 'dark', 0.005, 0.006, 0.008, sx * 0.0055, 0.068, 0.0);
    B.box('body', 'dark', 0.008, 0.02, 0.012, 0, 0.06, 0.025, 0.4);
    B.box('body', 'woodL', 0.032, 0.09, 0.04, 0, -0.035, 0.035, -0.35);
    B.trigger('steel', -0.012, -0.015, 0.045);
    // 실린더 (crane 축을 중심으로 왼쪽으로 열림)
    B.cyl('cyl', 'steel', 0.02, 0.02, -0.052, -0.01, 0, 0.035, 18);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; B.box('cyl', 'dark', 0.004, 0.004, 0.03, Math.cos(a) * 0.0195, 0.035 + Math.sin(a) * 0.0195, -0.031); }
    B.cyl('cyl', 'steel', 0.004, 0.004, -0.06, -0.01, 0, 0.012, 8);
    B.pivots.cyl = [0, 0.012, -0.031];
    // 탄 6발 (실린더 약실 위치) — 재장전 때 빠졌다 들어간다
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B.cyl('mag', 'brass', 0.0048, 0.0048, -0.012, -0.004, Math.cos(a) * 0.012, 0.035 + Math.sin(a) * 0.012, 8); }
    B.cyl('mag', 'dark', 0.016, 0.016, -0.004, 0.006, 0, 0.035, 14);
    B.pivots.mag = [0, 0.035, -0.008];
    return { muzzle: [0, 0.045, -0.22], sight: [0.071, 0.0], rail: null, fore: [-0.023, -0.05, 0.05], extra: { cylAxis: [0, 0.035, -0.031] } };
  }
};

/* ------------------------------------------------------------------ */
/* 조준경 (레일 윗면 y=0, 장착 중심 z=0)                                 */
/* ------------------------------------------------------------------ */
const SCOPES = {
  reddot(B) {
    B.box('body', 'dark', 0.024, 0.012, 0.042, 0, 0.006, 0);
    B.box('body', 'dark', 0.016, 0.012, 0.03, 0, 0.016, 0);
    B.cyl('body', 'darkDS', 0.0175, 0.0175, 0.022, -0.022, 0, 0.032, 22, true);
    B.box('body', 'dark', 0.01, 0.01, 0.014, 0.02, 0.03, 0.005);
    B.disc('lens', 'lens', 0.0172, 0, 0.032, -0.02);
    B.add('dot', 'dot', new THREE.SphereGeometry(0.0009, 8, 6).translate(0, 0.032, -0.019));
    return { eye: 0.032, rear: 0.022 };
  },
  holo(B) {
    B.box('body', 'dark', 0.034, 0.012, 0.075, 0, 0.006, 0);
    B.box('body', 'dark', 0.03, 0.02, 0.04, 0, 0.022, 0.02);
    for (const s of [-1, 1]) B.box('body', 'dark', 0.004, 0.034, 0.032, s * 0.017, 0.037, -0.02);
    B.box('body', 'dark', 0.038, 0.005, 0.032, 0, 0.056, -0.02);
    B.box('body', 'dark', 0.008, 0.008, 0.012, 0.016, 0.026, 0.026);
    B.add('lens', 'lens', new THREE.PlaneGeometry(0.03, 0.03).translate(0, 0.038, -0.034));
    B.add('dot', 'dot', new THREE.TorusGeometry(0.0034, 0.00028, 4, 24).translate(0, 0.038, -0.035));
    B.add('dot', 'dot', new THREE.SphereGeometry(0.0006, 6, 4).translate(0, 0.038, -0.035));
    return { eye: 0.038, rear: 0.035 };
  },
  x2(B) {
    B.box('body', 'dark', 0.026, 0.012, 0.05, 0, 0.006, 0);
    B.box('body', 'dark', 0.02, 0.018, 0.03, 0, 0.018, 0);
    B.cyl('body', 'dark', 0.016, 0.016, 0.03, -0.04, 0, 0.036, 18);
    B.cyl('body', 'dark', 0.016, 0.019, -0.04, -0.055, 0, 0.036, 18);
    B.cyl('body', 'dark', 0.017, 0.017, 0.03, 0.045, 0, 0.036, 18);
    B.cylY('body', 'dark', 0.006, 0.012, 0, 0.055, 0.0, 10);
    B.disc('lens', 'lensDark', 0.0175, 0, 0.036, -0.0555); B.add('lens', 'lensDark', new THREE.CircleGeometry(0.016, 20).rotateY(Math.PI).translate(0, 0.036, 0.0455));
    return { eye: 0.036, rear: 0.045 };
  },
  x4(B) {
    B.box('body', 'dark', 0.03, 0.014, 0.07, 0, 0.007, 0);
    B.box('body', 'dark', 0.03, 0.02, 0.07, 0, 0.022, 0);
    B.cyl('body', 'dark', 0.016, 0.016, 0.04, -0.05, 0, 0.042, 18);
    B.cyl('body', 'dark', 0.016, 0.021, -0.05, -0.058, 0, 0.042, 18);
    B.cyl('body', 'dark', 0.021, 0.021, -0.058, -0.072, 0, 0.042, 18);
    B.cyl('body', 'dark', 0.015, 0.015, 0.04, 0.062, 0, 0.042, 18);
    B.box('body', 'fiber', 0.006, 0.006, 0.05, 0, 0.061, 0.0);
    B.disc('lens', 'lensDark', 0.0195, 0, 0.042, -0.0725); B.add('lens', 'lensDark', new THREE.CircleGeometry(0.014, 20).rotateY(Math.PI).translate(0, 0.042, 0.0625));
    return { eye: 0.042, rear: 0.062 };
  },
  x8(B) {
    for (const z of [-0.06, 0.06]) { B.box('body', 'dark', 0.024, 0.024, 0.022, 0, 0.012, z); B.cyl('body', 'dark', 0.016, 0.016, z - 0.011, z + 0.011, 0, 0.046, 16); }
    B.cyl('body', 'dark', 0.0127, 0.0127, 0.1, -0.1, 0, 0.046, 18);
    B.cyl('body', 'dark', 0.0127, 0.024, -0.1, -0.14, 0, 0.046, 20);
    B.cyl('body', 'dark', 0.024, 0.024, -0.14, -0.19, 0, 0.046, 20);
    B.cyl('body', 'dark', 0.0127, 0.019, 0.1, 0.13, 0, 0.046, 18);
    B.cyl('body', 'dark', 0.019, 0.019, 0.13, 0.17, 0, 0.046, 18);
    B.cylY('body', 'dark', 0.009, 0.02, 0, 0.066, 0.0, 14);
    B.cylX('body', 'dark', 0.009, 0.02, 0.02, 0.046, 0.0, 14);
    B.disc('lens', 'lensDark', 0.0225, 0, 0.046, -0.1905); B.add('lens', 'lensDark', new THREE.CircleGeometry(0.0175, 20).rotateY(Math.PI).translate(0, 0.046, 0.1705));
    return { eye: 0.046, rear: 0.17 };
  }
};

const cache = {}, scopeCache = {};
const GL = G.GunLib = {
  COL, DESIGNS, SCOPES, Builder,
  has(id) { return !!DESIGNS[id]; },
  // 절차적 총 데이터 (캐시)
  data(id) {
    if (cache[id]) return cache[id];
    const B = new Builder();
    const meta = DESIGNS[id](B);
    const D = B.done(meta);
    D.id = id; D.real = false;
    return (cache[id] = D);
  },
  scope(type) {
    if (scopeCache[type]) return scopeCache[type];
    const B = new Builder();
    const meta = SCOPES[type](B);
    const D = B.done({});
    D.eye = meta.eye; D.rear = meta.rear;
    return (scopeCache[type] = D);
  },
  // 부품별 지오메트리를 정점 색 하나로 병합 (3인칭·전리품용)
  mergeColored(D, partFilter, offset) {
    const list = [];
    for (const k in D.parts) {
      if (partFilter && !partFilter(k)) continue;
      for (const m in D.parts[k]) {
        const g = D.parts[k][m].clone();
        for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
        const n = g.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(COL[m] !== undefined ? COL[m] : 0x333333);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        list.push(g);
      }
    }
    const g = THREE.mergeGeometries(list, false);
    if (offset) g.translate(offset.x, offset.y, offset.z);
    g.computeBoundingSphere();
    return g;
  },
  tpMat() {
    return G.GunTPMat || (G.GunTPMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35, envMapIntensity: 0.6 }));
  },
  _tp: {},
  // 3인칭 손에 든 총: 방아쇠를 at 으로
  tpGeo(id, at) {
    const key = id + '|' + at.toArray().join(',');
    if (this._tp[key]) return this._tp[key];
    const D = this.data(id);
    return (this._tp[key] = this.mergeColored(D, k => k !== 'lens' && k !== 'dot', at.clone().sub(D.trigger)));
  },
  scopeItemGeo(type) {
    const key = 'scope_' + type;
    if (this._tp[key]) return this._tp[key];
    const D = this.scope(type);
    const g = this.mergeColored(D, k => k !== 'dot');
    return (this._tp[key] = g);
  }
};

})();
