// world.js — 지형, 하늘, 물, 건물, 식생, 충돌/레이캐스트
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;

// 맵: 1.6km 섬 (예전 1km). 높이맵 512칸 (3.1m 간격)
const SIZE = 1600, HALF = 800, RES = 512, N = RES + 1, CELL = SIZE / RES;
const GCELL = 10, GN = Math.ceil(SIZE / GCELL);
const TS = 1536; // 지형 색상 텍스처 해상도
const MK = HALF / 500; // 예전 맵 대비 배율
const NC = { nc: true };
// 건물 LOD: 청크 크기와 종류별 단계 (b: 가까이 상세 + 멀리 대역, n: 가까이만, 그 외: 항상)
const LOD_CH = 125;
const LOD_KIND = { house1: 'b', house2: 'b', apt: 'b', shop: 'b', warehouse: 'b', barracks: 'b', barn: 'b', cabin: 'b', shed: 'b', car: 'n', sandbags: 'n' };
const LOD_NEAR = 190, LOD_CAR = 320, LOD_IN = 75;
const LOD_N = Math.ceil(SIZE / LOD_CH);
const LOD_CODE = { b: 1, i: 2, n: 3, f: 4 };

const TOWN_DEFS = [
  { name: '중앙 시가지', x: 0, z: 20, r: 100, type: 'city' },
  { name: '항구', x: -470, z: 470, r: 62, type: 'harbor' },
  { name: '군사 기지', x: 560, z: 40, r: 72, type: 'military' },
  { name: '농장', x: -330, z: -250, r: 64, type: 'farm' },
  { name: '발전소', x: 400, z: 430, r: 66, type: 'plant' },
  { name: '북부 전초기지', x: -15, z: -300, r: 55, type: 'military' },
  { name: '산장 마을', x: 120, z: -400, r: 46, type: 'village' },
  { name: '해변 마을', x: 60, z: 560, r: 52, type: 'village' },
  { name: '서쪽 마을', x: -560, z: 40, r: 50, type: 'village' },
  { name: '강변 마을', x: 300, z: 250, r: 54, type: 'town' },
  { name: '북쪽 마을', x: -120, z: -560, r: 46, type: 'village' },
  { name: '물류 창고', x: -560, z: -380, r: 58, type: 'depot' },
  { name: '동쪽 마을', x: 600, z: -170, r: 44, type: 'village' },
  { name: '호숫가 마을', x: -170, z: -205, r: 46, type: 'village' },
  { name: '숲속 마을', x: -280, z: 200, r: 46, type: 'village' },
  { name: '어촌', x: 270, z: 620, r: 42, type: 'harbor' },
  { name: '목장', x: 120, z: 260, r: 56, type: 'farm' },
  { name: '채석장', x: 470, z: -230, r: 50, type: 'quarry' },
  { name: '남서 마을', x: -560, z: 300, r: 44, type: 'village' },
  // 훈련장 (평평하게 고른 사격장, 사격 방향 -z)
  { name: '사격장', x: -70, z: 380, r: 72, type: 'range' }
];
// 큰 산 (중심, 반지름, 높이)
const MOUNTAINS = [
  { name: '북동 산맥', x: 400, z: -470, r: 300, h: 115 },
  { name: '남서 봉우리', x: -290, z: 390, r: 160, h: 58 },
  { name: '북서 능선', x: -400, z: -560, r: 170, h: 52 }
];
// 호수: 원 여러 개를 합친 모양 [x, z, 반지름]
const LAKE_DEFS = [
  { name: '청람호', blobs: [[400, 120, 62], [450, 160, 46], [355, 165, 38]], depth: 4.5 },
  { name: '천지', blobs: [[285, -470, 40], [315, -445, 28]], depth: 3.5 },
  { name: '서호', blobs: [[-240, -100, 50], [-200, -70, 36], [-270, -60, 30]], depth: 4 }
];
// 강: 제어점(시작 → 끝). from/to 는 호수 번호, 끝이 바다면 섬 밖까지
const RIVER_DEFS = [
  { name: '청류강', from: 1, to: 0, pts: [[300, -440], [300, -330], [330, -200], [380, -60], [400, 70]], w0: 4.5, w1: 7 },
  { name: '청류강', from: 0, pts: [[400, 160], [360, 260], [240, 330], [200, 430], [180, 560], [170, 760]], w0: 8, w1: 12 },
  { name: '서천', from: 2, pts: [[-260, -80], [-360, -40], [-460, -70], [-580, -110], [-760, -100]], w0: 6, w1: 10 }
];
const TOWN_CONTENT = {
  city: [['apt', 6], ['house2', 10], ['house1', 8], ['shop', 7], ['warehouse', 2], ['car', 14]],
  town: [['house2', 5], ['house1', 6], ['shop', 3], ['shed', 2], ['car', 6]],
  harbor: [['warehouse', 4], ['containers', 7], ['house1', 5], ['shop', 1], ['shed', 2], ['car', 4]],
  military: [['warehouse', 3], ['barracks', 4], ['tower', 4], ['containers', 6], ['sandbags', 9], ['car', 3]],
  farm: [['barn', 3], ['house1', 3], ['house2', 1], ['silo', 2], ['hay', 7], ['shed', 2], ['car', 2]],
  plant: [['warehouse', 3], ['tank', 5], ['chimney', 2], ['containers', 4], ['house1', 2], ['car', 3]],
  depot: [['warehouse', 5], ['containers', 8], ['shed', 2], ['car', 4]],
  quarry: [['warehouse', 1], ['containers', 3], ['shed', 3], ['ruins', 3], ['tower', 1], ['car', 2]],
  village: [['house1', 6], ['house2', 3], ['shed', 3], ['cabin', 1], ['car', 3]],
  range: []
};
const FOOT = {
  house1: [10, 8], house2: [12, 10], apt: [14, 12], shop: [10, 9], warehouse: [24, 14], barracks: [16, 7],
  barn: [16, 12], tower: [4.6, 11, 3], containers: [9, 9], sandbags: [4, 4], silo: [6, 6], hay: [5, 5],
  tank: [9, 9], chimney: [6, 6], shed: [5, 4], car: [5, 2.4], ruins: [10, 6, 2.5], cabin: [8, 7]
};
const TILE = { plaster: 2.5, brick: 2.0, wood: 2.0, floor: 2.0, roof: 2.5, concrete: 3.0, metal: 2.5, crate: 1.3, dark: 1.0, sandbag: 1.6, hay: 1.2, paint: 2.0, glass: 1.0 };
const MATKIND = { plaster: 'hard', brick: 'hard', concrete: 'hard', roof: 'hard', wood: 'wood', floor: 'wood', crate: 'wood', hay: 'wood', metal: 'metal', paint: 'metal', glass: 'metal', dark: 'metal', sandbag: 'soft' };
const PLASTER = [0xe8dcc6, 0xd9cbb0, 0xc9c2b5, 0xe6e1d6, 0xb8c4c9, 0xd8b9a0, 0xa9b89a, 0xe0d0a8, 0xcfd6d9];
const ROOFC = [0x7a3b2e, 0x4a4f57, 0x5b3a29, 0x3d4a3f, 0x6b2f2a, 0x2f3b4d];
const CONT = [0xa83a2c, 0x2e5a8a, 0x3d7a4a, 0xc7782a, 0x6d7378, 0x8a2f5a, 0xb59a3a];
const CARC = [0xb02a2a, 0x1f4f8f, 0xd8d8d8, 0x2a2a2a, 0x5f6f3a, 0xc9a227, 0x6e7378, 0x8a4a22];

const _col = new THREE.Color();
function C(hex) { return new THREE.Color(hex); }

const W = G.World = {
  SIZE, HALF, RES, WATER: 0,
  heights: null, noise: null, rnd: null,
  towns: [], roads: [], footprints: [], boxes: [], grid: null, stamp: 1,
  lootSpots: [], parts: {}, proxyParts: [], lod: [], cur: null, inFurn: false, mats: {}, hit: null,
  splatCanvas: null, maskCanvas: null, mapCanvas: null,
  grass: null, time: 0,

  async init(scene, renderer, progress) {
    this.scene = scene; this.renderer = renderer;
    this.rnd = U.mulberry32(20261028);
    this.noise = G.Noise.make(1337);
    this.grid = new Array(GN * GN);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = [];
    this.hit = { t: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), mat: 'hard', box: null };

    if (G.Assets) await G.Assets.load(renderer, progress);
    if (G.RangeProps) { progress(0.31, '훈련장 시설 불러오는 중...'); await G.RangeProps.load(renderer); }
    if (G.Soldiers) { progress(0.31, '군인 모델 불러오는 중...'); await G.Soldiers.load(renderer); }
    if (G.GunModels) { progress(0.315, '총기 모델 불러오는 중...'); await G.GunModels.load(renderer); }
    if (G.Attachments) await G.Attachments.load();
    progress(0.32, '지형 생성 중...');
    await tick();
    this.genHeights();
    progress(0.42, '도시 건설 중...');
    await tick();
    this.makeMaterials();
    this.genTowns();
    this.genBridges();
    this.genWild();
    this.genPaths();
    progress(0.55, '지형 텍스처 칠하는 중...');
    await tick();
    this.paintTerrain();
    this.buildTerrainMesh();
    progress(0.68, '하늘과 바다 만드는 중...');
    await tick();
    this.buildSkyWater();
    progress(0.75, '숲 가꾸는 중...');
    await tick();
    await this.genVegetation(progress);
    progress(0.86, '메시 최적화 중...');
    await tick();
    this.finalizeParts();
    // 풀 셰이더용 높이 텍스처: half-float + 하드웨어 선형 보간 (정점당 1회 샘플)
    const hf = new Uint16Array(N * N);
    for (let i = 0; i < hf.length; i++) hf[i] = THREE.DataUtils.toHalfFloat(this.heights[i]);
    this.heightTex = new THREE.DataTexture(hf, N, N, THREE.RedFormat, THREE.HalfFloatType);
    this.heightTex.magFilter = this.heightTex.minFilter = THREE.LinearFilter;
    this.heightTex.needsUpdate = true;
  },

  /* -------------------------------------------------------------- */
  /* 높이맵                                                          */
  /* -------------------------------------------------------------- */
  rawHeight(x, z) {
    const nz = this.noise;
    const r0 = Math.hypot(x, z) / HALF, ang = Math.atan2(z, x);
    const r = r0 + nz.fbm(x * 0.0019 + 11.3, z * 0.0019 - 7.1, 3) * 0.13;
    // 해안 절벽 구간: 바다 쪽으로 깎아지른 고원
    const cliff = U.smoothstep(0.05, 0.28, nz.fbm(Math.cos(ang) * 1.4 + 7.7, Math.sin(ang) * 1.4 - 3.3, 2));
    const edge = 0.86;
    const island = U.lerp(U.smoothstep(0.97, 0.74, r), U.smoothstep(edge + 0.012, edge - 0.006, r), cliff);
    const base = nz.fbm(x * 0.0014, z * 0.0014, 5);
    const hills = nz.fbm(x * 0.004 + 50, z * 0.004 + 50, 4);
    const ridge = 1 - Math.abs(nz.fbm(x * 0.0025 - 30, z * 0.0025 + 80, 4));
    const mtn = U.smoothstep(0.05, 0.45, nz.fbm(x * 0.001 + 200, z * 0.001, 2) * 0.5 + 0.5);
    let h = 9 + base * 14 + Math.max(0, hills) * 9 + Math.pow(ridge, 3) * 20 * mtn;
    h += cliff * 15 * U.smoothstep(edge - 0.32, edge - 0.14, r0) * U.smoothstep(edge + 0.01, edge - 0.1, r);
    // 큰 산 (능선이 있는 봉우리)
    for (const M of MOUNTAINS) {
      const d = Math.hypot(x - M.x, z - M.z) / M.r;
      if (d < 1.25) {
        const k = Math.pow(U.smoothstep(1.25, 0, d), 1.7);
        const rg = 1 - Math.abs(nz.fbm(x * 0.006 + M.x * 0.01, z * 0.006 + M.z * 0.01, 4));
        h += k * M.h * (0.5 + 0.5 * rg * rg);
      }
    }
    // 계단식 절벽 (높은 곳 일부)
    const tm = U.smoothstep(0.12, 0.38, nz.fbm(x * 0.0022 - 77, z * 0.0022 + 33, 2)) * U.smoothstep(24, 42, h);
    if (tm > 0) {
      const st = 11, t = h / st, f = t - Math.floor(t);
      h = U.lerp(h, (Math.floor(t) + U.smoothstep(0.5, 0.78, f)) * st, tm * 0.92);
    }
    return h * island + (-14) * (1 - island);
  },
  genHeights() {
    const H = this.heights = new Float32Array(N * N);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) H[iz * N + ix] = this.rawHeight(ix * CELL - HALF, iz * CELL - HALF);
    // 마을 평탄화
    this.towns = TOWN_DEFS.map(d => {
      const t = Object.assign({}, d);
      t.h = Math.max(3.5, this.rawHeight(t.x, t.z));
      return t;
    });
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const x = ix * CELL - HALF, z = iz * CELL - HALF;
      let h = H[iz * N + ix];
      for (const t of this.towns) {
        const d = Math.hypot(x - t.x, z - t.z);
        if (d < t.r + 40) h = U.lerp(h, t.h, U.smoothstep(t.r + 40, t.r + 4, d));
      }
      H[iz * N + ix] = h;
    }
    this.labels = MOUNTAINS.map(M => ({ name: M.name, x: M.x, z: M.z }));
    // 호수 (수면 높이 결정)
    this.lakes = LAKE_DEFS.map(L => this.makeLake(L));
    // 도로 (호수·바다·높은 산을 지나지 않는 마을 연결망)
    this.genRoadNet();
    // 도로를 따라 살짝 매끄럽게
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const x = ix * CELL - HALF, z = iz * CELL - HALF;
      const d = this.roadDist(x, z);
      if (d < 10) {
        const i = iz * N + ix;
        const avg = (H[i] + H[Math.max(0, i - 1)] + H[Math.min(N * N - 1, i + 1)] + H[Math.max(0, i - N)] + H[Math.min(N * N - 1, i + N)]) / 5;
        H[i] = U.lerp(H[i], Math.max(avg, H[i] > 0.5 ? 0.6 : H[i]), U.smoothstep(10, 3, d) * 0.8);
      }
    }
    // 강 경로와 수위
    this.rivers = RIVER_DEFS.map(R => this.makeRiver(R));
    // 물 높이 격자 (바다 0, 호수·강은 각자의 수면)
    this.waterH = new Float32Array(N * N);
    for (const L of this.lakes) this.carveLake(L);
    for (const R of this.rivers) this.carveRiver(R);
    // 강을 건너는 다리 (다리 앞뒤 도로를 다리 높이에 맞춘다)
    this.bridges = this.findBridges();
    for (const b of this.bridges) this.shapeBridgeRamps(b);
  },
  // 호수 하나: 모양(원 합집합)과 수면 높이
  makeLake(def) {
    const blobs = def.blobs.map(b => ({ x: b[0], z: b[1], r: b[2] }));
    let cx = 0, cz = 0, ext = 0;
    for (const b of blobs) { cx += b.x; cz += b.z; }
    cx /= blobs.length; cz /= blobs.length;
    for (const b of blobs) ext = Math.max(ext, Math.hypot(b.x - cx, b.z - cz) + b.r);
    const L = { name: def.name, blobs, cx, cz, ext, depth: def.depth };
    // 물가 높이의 하위 25% - 1m
    const hs = [];
    for (let a = 0; a < 64; a++) {
      const th = a / 64 * Math.PI * 2;
      for (let rr = 0; rr < ext + 20; rr += 2) {
        const x = cx + Math.cos(th) * rr, z = cz + Math.sin(th) * rr;
        const sd = this.lakeSD(L, x, z);
        if (sd > 0 && sd < 12) { hs.push(this.heightAt(x, z)); break; }
      }
    }
    hs.sort((a, b) => a - b);
    L.level = Math.max(1.5, (hs[Math.floor(hs.length * 0.25)] || 6) - 1);
    this.labels.push({ name: def.name, x: cx, z: cz, water: true });
    return L;
  },
  // 호숫가까지의 거리 (안쪽 음수)
  lakeSD(L, x, z) { let m = 1e9; for (const b of L.blobs) m = Math.min(m, Math.hypot(x - b.x, z - b.z) - b.r); return m; },
  carveLake(L) {
    const H = this.heights, R = L.ext + 70;
    const i0 = Math.max(0, Math.floor((L.cx - R + HALF) / CELL)), i1 = Math.min(RES, Math.ceil((L.cx + R + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((L.cz - R + HALF) / CELL)), j1 = Math.min(RES, Math.ceil((L.cz + R + HALF) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i * CELL - HALF, z = j * CELL - HALF, k = j * N + i;
      const sd = this.lakeSD(L, x, z);
      if (sd > 70) continue;
      let h = H[k];
      if (sd < 0) h = Math.min(h, L.level - 0.4 - L.depth * U.smoothstep(0, 28, -sd));
      else {
        const bank = L.level + 0.35 + sd * (0.3 + 0.12 * this.noise.noise2(x * 0.02, z * 0.02));
        h = U.lerp(Math.min(h, bank), h, U.smoothstep(40, 70, sd));      // 멀어질수록 원래 지형으로
        if (sd < 9) h = Math.max(h, L.level + 0.3 + sd * 0.05);   // 낮은 쪽은 둑을 쌓아 물이 넘치지 않게
      }
      H[k] = h;
      if (sd < 14) this.waterH[k] = Math.max(this.waterH[k], L.level);
    }
  },
  // 강: 제어점 → 곡선(굽이침 포함) → 4m 간격 표본, 표본마다 폭과 수위
  makeRiver(def) {
    const ctrl = def.pts.map(p => new THREE.Vector2(p[0], p[1]));
    if (def.from !== undefined) { const L = this.lakes[def.from]; ctrl.unshift(new THREE.Vector2(L.cx, L.cz)); }
    if (def.to !== undefined) { const L = this.lakes[def.to]; ctrl.push(new THREE.Vector2(L.cx, L.cz)); }
    const curve = new THREE.SplineCurve(ctrl);
    const len = curve.getLength(), n = Math.max(8, Math.round(len / 4));
    const raw = curve.getSpacedPoints(n);
    const pts = [], nz = this.noise;
    for (let i = 0; i <= n; i++) {
      const p = raw[i], q = raw[Math.min(n, i + 1)], o = raw[Math.max(0, i - 1)];
      const dx = q.x - o.x, dz = q.y - o.y, dl = Math.hypot(dx, dz) || 1;
      const s = i / n, mea = nz.noise2(i * 4 / 160 + def.w0, 7.3) * 22 * Math.sin(Math.PI * s) + nz.noise2(i * 4 / 55, 2.1) * 6;
      pts.push({ x: p.x - dz / dl * mea, z: p.y + dx / dl * mea, s });
    }
    const R = { name: def.name, pts, from: def.from, to: def.to };
    // 폭과 기준 지형 높이
    for (const p of pts) {
      p.w = U.lerp(def.w0, def.w1, p.s) * (0.85 + 0.3 * (nz.noise2(p.x * 0.01, p.z * 0.01) * 0.5 + 0.5));
      p.bank = 0.2 + 0.55 * (nz.noise2(p.x * 0.006 + 9, p.z * 0.006) * 0.5 + 0.5);   // 둑 경사 (높을수록 협곡)
      if (nz.noise2(p.x * 0.004 - 40, p.z * 0.004) > 0.45) p.bank = 1.3;               // 협곡 구간
      let m = this.heightAt(p.x, p.z);
      for (const k of [-1, 1]) m = Math.min(m, this.heightAt(p.x + k * p.w, p.z), this.heightAt(p.x, p.z + k * p.w));
      p.h0 = m;
    }
    // 수위: 상류에서 하류로 단조 감소, 항상 주변 지형보다 2.5m 아래
    const src = def.from !== undefined ? this.lakes[def.from].level : pts[0].h0 - 2.5;
    let lv = src;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const inSrc = def.from !== undefined && this.lakeSD(this.lakes[def.from], p.x, p.z) < 0;
      lv = inSrc ? src : Math.min(lv - 0.004 * 4, p.h0 - 2.5);
      p.level = Math.max(0, lv);
    }
    if (def.to !== undefined) {
      const L = this.lakes[def.to];
      for (const p of pts) if (this.lakeSD(L, p.x, p.z) < 0) p.level = Math.min(p.level, L.level);
      // 하류 호수가 강보다 높으면 호수 수위를 낮춘다
      const last = pts.find(p => this.lakeSD(L, p.x, p.z) < 6);
      if (last && last.level < L.level) L.level = last.level;
    }
    this.labels.push({ name: def.name, x: pts[Math.floor(pts.length * 0.45)].x, z: pts[Math.floor(pts.length * 0.45)].z, water: true });
    return R;
  },
  carveRiver(R) {
    const H = this.heights, n = H.length;
    const best = new Float32Array(n).fill(1e9), bi = new Int32Array(n).fill(-1);
    // 각 정점에서 가장 가까운 강 표본
    R.pts.forEach((p, idx) => {
      const rad = p.w + 70;
      const i0 = Math.max(0, Math.floor((p.x - rad + HALF) / CELL)), i1 = Math.min(RES, Math.ceil((p.x + rad + HALF) / CELL));
      const j0 = Math.max(0, Math.floor((p.z - rad + HALF) / CELL)), j1 = Math.min(RES, Math.ceil((p.z + rad + HALF) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = i * CELL - HALF, z = j * CELL - HALF, d = Math.hypot(x - p.x, z - p.z), k = j * N + i;
        if (d < best[k]) { best[k] = d; bi[k] = idx; }
      }
    });
    for (let k = 0; k < n; k++) {
      if (bi[k] < 0) continue;
      const p = R.pts[bi[k]], d = best[k];
      if (p.level <= 0.05 && H[k] < 0) continue;   // 바다
      let h = H[k];
      if (d < p.w) h = Math.min(h, p.level - 0.5 - (p.level > 0.3 ? 1.8 : 1.2) * (1 - (d / p.w) * (d / p.w)));
      else {
        h = U.lerp(Math.min(h, p.level + 0.4 + (d - p.w) * p.bank), h, U.smoothstep(p.w + 45, p.w + 70, d));
        if (d < p.w + 6 && p.level > 0.3) h = Math.max(h, p.level + 0.3 + (d - p.w) * 0.04);
      }
      H[k] = h;
      if (d < p.w + 10 && p.level > 0.05) this.waterH[k] = Math.max(this.waterH[k], p.level);
    }
  },
  // 도로 연결망: 최소 신장 트리 + 가까운 이웃, 호수/바다/고산을 지나는 길은 뺀다
  genRoadNet() {
    const T = this.towns.filter(t => t.type !== 'range'), n = T.length;
    const dist = (a, b) => Math.hypot(T[a].x - T[b].x, T[a].z - T[b].z);
    const ok = (a, b) => {
      const A = T[a], B = T[b], L = dist(a, b);
      if (L > 760) return false;
      for (let t = 0.04; t < 0.96; t += 12 / L) {
        const x = U.lerp(A.x, B.x, t), z = U.lerp(A.z, B.z, t);
        const h = this.heightAt(x, z);
        if (h < 1.2 || h > 62) return false;
        for (const lk of this.lakes) if (this.lakeSD(lk, x, z) < 16) return false;
      }
      return true;
    };
    const edges = [], has = new Set();
    const add = (a, b) => { const k = Math.min(a, b) + '-' + Math.max(a, b); if (!has.has(k)) { has.add(k); edges.push([a, b]); } };
    // Prim (통과 가능한 간선만)
    const inT = new Set([0]);
    while (inT.size < n) {
      let bd = 1e9, be = null;
      for (const a of inT) for (let b = 0; b < n; b++) if (!inT.has(b) && ok(a, b)) { const d = dist(a, b); if (d < bd) { bd = d; be = [a, b]; } }
      if (!be) break;
      add(be[0], be[1]); inT.add(be[1]);
    }
    // 각 마을의 가까운 이웃 2곳
    for (let a = 0; a < n; a++) {
      const near = [...Array(n).keys()].filter(b => b !== a).sort((p, q) => dist(a, p) - dist(a, q)).slice(0, 2);
      for (const b of near) if (ok(a, b)) add(a, b);
    }
    this.roads = edges.map(([a, b]) => ({ ax: T[a].x, az: T[a].z, bx: T[b].x, bz: T[b].z, w: 7 }));
    // 큰 마을 안 십자 도로
    for (const t of T) {
      if (t.type !== 'city' && t.type !== 'town') continue;
      this.roads.push({ ax: t.x - t.r - 10, az: t.z + 4, bx: t.x + t.r + 10, bz: t.z + 4, w: 6 });
      this.roads.push({ ax: t.x - 2, az: t.z - t.r - 10, bx: t.x - 2, bz: t.z + t.r + 10, w: 6 });
    }
  },
  // 도로와 강이 만나는 곳마다 다리
  findBridges() {
    const out = [];
    for (const rd of this.roads) {
      for (const R of this.rivers) {
        const P = R.pts;
        for (let i = 0; i < P.length - 1; i++) {
          const a = P[i], b = P[i + 1];
          const hit = segIntersect(rd.ax, rd.az, rd.bx, rd.bz, a.x, a.z, b.x, b.z);
          if (!hit || a.level <= 0.3) continue;
          if (out.some(o => Math.hypot(o.x - hit.x, o.z - hit.z) < 40)) continue;
          const dx = rd.bx - rd.ax, dz = rd.bz - rd.az, dl = Math.hypot(dx, dz);
          const ux = dx / dl, uz = dz / dl, rx = b.x - a.x, rz = b.z - a.z, rl = Math.hypot(rx, rz) || 1;
          const sinA = Math.max(0.35, Math.abs(ux * rz / rl - uz * rx / rl));
          const half = Math.min(45, (a.w + 9) / sinA);
          out.push({ x: hit.x, z: hit.z, ux, uz, half, w: rd.w + 1.2, y: a.level + 3.2, level: a.level });
        }
      }
    }
    return out;
  },
  shapeBridgeRamps(b) {
    const H = this.heights, R = b.half + 40;
    const i0 = Math.max(0, Math.floor((b.x - R + HALF) / CELL)), i1 = Math.min(RES, Math.ceil((b.x + R + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((b.z - R + HALF) / CELL)), j1 = Math.min(RES, Math.ceil((b.z + R + HALF) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i * CELL - HALF, z = j * CELL - HALF, k = j * N + i;
      const along = (x - b.x) * b.ux + (z - b.z) * b.uz, side = Math.abs((x - b.x) * -b.uz + (z - b.z) * b.ux);
      const da = Math.abs(along) - (b.half - 1);
      if (da < 0 || side > b.w * 0.5 + 8) continue;
      const target = b.y - 0.05, grade = 0.2;
      const wgt = U.smoothstep(b.w * 0.5 + 8, b.w * 0.5 + 1, side) * U.smoothstep(36, 20, da);
      const lo = target - da * grade, hi = target + da * grade;
      H[k] = U.lerp(H[k], U.clamp(H[k], lo, hi), wgt);
    }
  },
  roadDist(x, z) {
    let m = 1e9;
    for (const r of this.roads) { const d = U.segDist2D(x, z, r.ax, r.az, r.bx, r.bz) - (r.w - 7) * 0.5; if (d < m) m = d; }
    return m;
  },
  heightAt(x, z) {
    let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    if (fx < 0) fx = 0; else if (fx > RES - 0.0001) fx = RES - 0.0001;
    if (fz < 0) fz = 0; else if (fz > RES - 0.0001) fz = RES - 0.0001;
    const ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz;
    const H = this.heights, i = iz * N + ix;
    const ha = H[i], hb = H[i + N], hc = H[i + N + 1], hd = H[i + 1];
    if (u + v <= 1) return ha + (hd - ha) * u + (hb - ha) * v;
    return hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
  },
  // 물 높이 (바다 0, 호수·강은 각자의 수면) — 물이 없는 곳은 0
  waterAt(x, z) {
    const Wh = this.waterH;
    if (!Wh) return this.WATER;
    let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    if (fx < 0) fx = 0; else if (fx > RES - 0.0001) fx = RES - 0.0001;
    if (fz < 0) fz = 0; else if (fz > RES - 0.0001) fz = RES - 0.0001;
    const ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz, i = iz * N + ix;
    const a = Wh[i], b = Wh[i + 1], c = Wh[i + N], d = Wh[i + N + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  },
  normalAt(x, z, out) {
    const e = 1.0;
    const hl = this.heightAt(x - e, z), hr = this.heightAt(x + e, z), hd = this.heightAt(x, z - e), hu = this.heightAt(x, z + e);
    out.set(hl - hr, 2 * e, hd - hu).normalize();
    return out;
  },

  /* -------------------------------------------------------------- */
  /* 재질 (절차적 텍스처)                                             */
  /* -------------------------------------------------------------- */
  makeMaterials() {
    const T = G.Tex;
    const speck = (ctx, w, h, amt, alpha) => {
      const img = ctx.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; if (alpha) d[i + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    };
    const stains = (ctx, w, h, n, col) => {
      for (let i = 0; i < n; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = 10 + Math.random() * 40;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    };
    const tex = {};
    tex.plaster = T.canvas(256, 256, (c, w, h) => { c.fillStyle = '#e4e4e4'; c.fillRect(0, 0, w, h); stains(c, w, h, 14, 'rgba(120,110,100,0.07)'); speck(c, w, h, 22); });
    tex.brick = T.canvas(256, 256, (c, w, h) => {
      c.fillStyle = '#b8b1a6'; c.fillRect(0, 0, w, h);
      const rows = 8, bh = h / rows;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * 32;
        for (let x = -64; x < w + 64; x += 64) {
          const v = 120 + Math.random() * 50;
          c.fillStyle = `rgb(${v + 40},${v * 0.55},${v * 0.42})`;
          c.fillRect(x + off + 2, r * bh + 2, 60, bh - 4);
        }
      }
      speck(c, w, h, 25);
    });
    tex.wood = T.canvas(256, 256, (c, w, h) => {
      for (let i = 0; i < 8; i++) {
        const v = 150 + Math.random() * 40;
        c.fillStyle = `rgb(${v},${v * 0.8},${v * 0.62})`; c.fillRect(i * 32, 0, 32, h);
        c.strokeStyle = 'rgba(60,40,25,0.25)';
        for (let k = 0; k < 6; k++) { c.beginPath(); const x = i * 32 + 4 + Math.random() * 24; c.moveTo(x, 0); c.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.6, x + 2, h); c.stroke(); }
        c.fillStyle = 'rgba(30,20,10,0.6)'; c.fillRect(i * 32, 0, 2, h);
      }
      speck(c, w, h, 14);
    });
    tex.floor = T.canvas(256, 256, (c, w, h) => {
      for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
        const v = 120 + Math.random() * 45;
        c.fillStyle = `rgb(${v},${v * 0.74},${v * 0.52})`; c.fillRect(j * 128 + (i % 2) * 64, i * 32, 128, 32);
        c.fillStyle = 'rgba(25,15,8,0.55)'; c.fillRect(0, i * 32, w, 2); c.fillRect(j * 128 + (i % 2) * 64, i * 32, 2, 32);
      }
      speck(c, w, h, 12);
    });
    tex.roof = T.canvas(256, 256, (c, w, h) => {
      c.fillStyle = '#d0d0d0'; c.fillRect(0, 0, w, h);
      for (let r = 0; r < 10; r++) {
        const g = c.createLinearGradient(0, r * 25.6, 0, r * 25.6 + 25.6);
        g.addColorStop(0, '#f0f0f0'); g.addColorStop(1, '#8a8a8a');
        c.fillStyle = g; c.fillRect(0, r * 25.6, w, 25.6);
        for (let x = (r % 2) * 16; x < w; x += 32) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, r * 25.6, 2, 25.6); }
      }
      speck(c, w, h, 18);
    });
    tex.concrete = T.canvas(256, 256, (c, w, h) => {
      c.fillStyle = '#c4c4c2'; c.fillRect(0, 0, w, h);
      stains(c, w, h, 22, 'rgba(70,70,65,0.08)');
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h);
      speck(c, w, h, 30);
    });
    tex.metal = T.canvas(256, 256, (c, w, h) => {
      for (let x = 0; x < w; x++) { const v = 170 + Math.sin(x / w * Math.PI * 2 * 12) * 45; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(x, 0, 1, h); }
      stains(c, w, h, 16, 'rgba(110,60,30,0.12)');
      speck(c, w, h, 16);
    });
    tex.crate = T.canvas(128, 128, (c, w, h) => {
      c.fillStyle = '#b08850'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(60,35,15,0.35)'; c.fillRect(0, i * 21, w, 2); }
      c.strokeStyle = '#6e4b25'; c.lineWidth = 12; c.strokeRect(6, 6, w - 12, h - 12);
      c.lineWidth = 9; c.beginPath(); c.moveTo(10, 10); c.lineTo(w - 10, h - 10); c.stroke();
      speck(c, w, h, 20);
    });
    tex.sandbag = T.canvas(128, 128, (c, w, h) => {
      c.fillStyle = '#a89870'; c.fillRect(0, 0, w, h);
      for (let r = 0; r < 4; r++) for (let x = -1; x < 3; x++) {
        const ox = x * 64 + (r % 2) * 32, oy = r * 32;
        const g = c.createRadialGradient(ox + 32, oy + 14, 4, ox + 32, oy + 16, 34);
        g.addColorStop(0, '#c9b98d'); g.addColorStop(1, '#6f6248');
        c.fillStyle = g; c.beginPath(); c.ellipse(ox + 32, oy + 16, 31, 14, 0, 0, Math.PI * 2); c.fill();
      }
      speck(c, w, h, 25);
    });
    tex.hay = T.canvas(128, 128, (c, w, h) => {
      c.fillStyle = '#c9a85a'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) { c.strokeStyle = Math.random() < 0.5 ? 'rgba(120,90,30,0.5)' : 'rgba(240,215,140,0.5)'; c.beginPath(); const x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 6); c.stroke(); }
    });
    const M = this.mats;
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.9, metalness: 0 }, o));
    M.plaster = std({ map: tex.plaster, bumpMap: tex.plaster, bumpScale: 1.5 });
    M.brick = std({ map: tex.brick, bumpMap: tex.brick, bumpScale: 2.5 });
    M.wood = std({ map: tex.wood, bumpMap: tex.wood, bumpScale: 1.5, roughness: 0.85 });
    M.floor = std({ map: tex.floor, roughness: 0.7 });
    M.roof = std({ map: tex.roof, bumpMap: tex.roof, bumpScale: 2, roughness: 0.8, flatShading: true });
    M.concrete = std({ map: tex.concrete, bumpMap: tex.concrete, bumpScale: 1.5, roughness: 0.95 });
    M.metal = std({ map: tex.metal, bumpMap: tex.metal, bumpScale: 2, roughness: 0.55, metalness: 0.35 });
    M.crate = std({ map: tex.crate, bumpMap: tex.crate, bumpScale: 1.5 });
    M.sandbag = std({ map: tex.sandbag, bumpMap: tex.sandbag, bumpScale: 3 });
    M.hay = std({ map: tex.hay, bumpMap: tex.hay, bumpScale: 2 });
    M.dark = std({ roughness: 0.6, metalness: 0.4 });
    M.paint = std({ roughness: 0.32, metalness: 0.45 });
    M.glass = std({ roughness: 0.08, metalness: 0.6 });
    M.proxy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    // 거리별 표시 단계: 청크 상태 텍스처 (0 가구까지, 1 상세, 2 상세 아님·자동차 보임, 3 대역만)
    this.lodData = new Uint8Array(LOD_N * LOD_N);
    this.lodTex = new THREE.DataTexture(this.lodData, LOD_N, LOD_N, THREE.RedIntegerFormat, THREE.UnsignedByteType);
    this.lodTex.internalFormat = 'R8UI';
    this.lodTex.needsUpdate = true;
    const lodU = { value: this.lodTex };
    for (const k in M) {
      const m = M[k];
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uLodTex = lodU;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nattribute vec3 lodk;\nuniform highp usampler2D uLodTex;')
          .replace('#include <project_vertex>', `#include <project_vertex>
            if (lodk.z > 0.5) {
              uint st = texelFetch(uLodTex, ivec2(lodk.xy), 0).r;
              bool vis = lodk.z < 1.5 ? st <= 1u : lodk.z < 2.5 ? st == 0u : lodk.z < 3.5 ? st <= 2u : st >= 2u;
              if (!vis) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            }`);
      };
      m.customProgramCacheKey = () => 'lod';
    }
    // 실사 텍스처 (있으면): 원래 절차적 텍스처의 평균색 쪽으로 일부 보정해 기존 색 배합(정점 색)을 살린다
    const A = G.Assets;
    if (A && A.enabled) {
      const fit = { plaster: 0.85, brick: 0.25, wood: 0.55, floor: 0.35, roof: 0.75, concrete: 0.5, metal: 0.8, crate: 0.45 };
      for (const k in fit) if (A.applyTo(M[k], k, A.meanColor(tex[k].image), fit[k])) { M[k].metalness = k === 'metal' ? 0.3 : 0; }
      M.roof.flatShading = false;
    }
  },

  /* -------------------------------------------------------------- */
  /* 지오메트리 빌더                                                  */
  /* -------------------------------------------------------------- */
  addGeo(geo, mat, color, wx, wz) {
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (geo.attributes.uv1) geo.deleteAttribute('uv1');
    // 거리별 표시 단계(LOD): 정점마다 [건물 청크 x, z, 종류] — 셰이더가 청크 상태를 보고 숨긴다
    const B = this.cur, lk = new Float32Array(n * 3);
    if (B) {
      const tag = this.inFurn ? 'i' : B.tag, cx = Math.floor((B.x + HALF) / LOD_CH), cz = Math.floor((B.z + HALF) / LOD_CH), kd = LOD_CODE[tag];
      for (let i = 0; i < n; i++) { lk[i * 3] = cx; lk[i * 3 + 1] = cz; lk[i * 3 + 2] = kd; }
      if (B.tag === 'b' && !this.inFurn) B.geos.push({ geo, mat, color });
    }
    geo.setAttribute('lodk', new THREE.BufferAttribute(lk, 3));
    // 건물 조각은 따로 묶어 멀리 있는 청크는 통째로 숨긴다 (보이지 않는 정점 처리 비용 절약)
    const key = Math.floor((wx + HALF) / 250) + ',' + Math.floor((wz + HALF) / 250) + '|' + mat + (B ? '|d' : '');
    (this.parts[key] || (this.parts[key] = [])).push(geo);
  },
  addCollider(x0, y0, z0, x1, y1, z1, mat) {
    const b = { minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1, mat: mat || 'hard', stamp: 0 };
    const id = this.boxes.length;
    this.boxes.push(b);
    const gx0 = U.clamp(Math.floor((x0 + HALF) / GCELL), 0, GN - 1), gx1 = U.clamp(Math.floor((x1 + HALF) / GCELL), 0, GN - 1);
    const gz0 = U.clamp(Math.floor((z0 + HALF) / GCELL), 0, GN - 1), gz1 = U.clamp(Math.floor((z1 + HALF) / GCELL), 0, GN - 1);
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) this.grid[gz * GN + gx].push(id);
    return b;
  },
  finalizeParts() {
    this.bChunks = {};
    for (const key in this.parts) {
      const ks = key.split('|'), mat = ks[1];
      const geo = THREE.mergeGeometries(this.parts[key], false);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, this.mats[mat]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      if (ks[2] === 'd') {
        const [ix, iz] = ks[0].split(',').map(Number);
        const c = this.bChunks[ks[0]] || (this.bChunks[ks[0]] = { x0: ix * 250 - HALF, z0: iz * 250 - HALF, x1: (ix + 1) * 250 - HALF, z1: (iz + 1) * 250 - HALF, meshes: [], vis: true });
        c.meshes.push(mesh);
      }
    }
    this.bChunks = Object.values(this.bChunks);
    this.parts = {};
    // 멀리서 보이는 건물 대역: 재질 평균색 × 정점 색, 섬 전체를 한 번에 그린다
    const mean = {};
    const meanOf = (m) => {
      if (mean[m]) return mean[m];
      const M = this.mats[m], c = new THREE.Color(1, 1, 1);
      try { if (M.map && M.map.image && G.Assets) c.copy(G.Assets.meanColor(M.map.image)); } catch (e) { /* 무시 */ }
      if (M.color) c.multiply(M.color);
      return (mean[m] = c);
    };
    const geos = [];
    for (const e of this.proxyParts) {
      const g = e.geo;
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
      const n = g.attributes.position.count, col = new Float32Array(n * 3), lk = new Float32Array(n * 3), mc = meanOf(e.mat);
      const r = e.color.r * mc.r, gg = e.color.g * mc.g, b = e.color.b * mc.b;
      for (let i = 0; i < n; i++) { col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b; lk[i * 3] = e.cx; lk[i * 3 + 1] = e.cz; lk[i * 3 + 2] = LOD_CODE.f; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('lodk', new THREE.BufferAttribute(lk, 3));
      geos.push(g);
    }
    this.proxyParts = [];
    const pg = geos.length && THREE.mergeGeometries(geos, false);
    if (pg) {
      const mesh = new THREE.Mesh(pg, this.mats.proxy);
      mesh.matrixAutoUpdate = false; mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    // 청크 목록 (상태는 lodTex 에 기록)
    this.lod = [];
    for (let iz = 0; iz < LOD_N; iz++) for (let ix = 0; ix < LOD_N; ix++)
      this.lod.push({ i: iz * LOD_N + ix, x0: ix * LOD_CH - HALF, z0: iz * LOD_CH - HALF, x1: (ix + 1) * LOD_CH - HALF, z1: (iz + 1) * LOD_CH - HALF, st: -1 });
    this.lodT = 0;
  },
  updateTerrainLOD(camPos) {
    if (!this.terrainChunks) return;
    const D = this.terrainLodDist, k = this.terrDist || 1, hy = Math.max(0, camPos.y - this.heightAt(camPos.x, camPos.z) - 20);
    for (const c of this.terrainChunks) {
      const dx = Math.max(c.x0 - camPos.x, 0, camPos.x - c.x1), dz = Math.max(c.z0 - camPos.z, 0, camPos.z - c.z1);
      const d = Math.sqrt(dx * dx + dz * dz + hy * hy) / k;
      let l = 0;
      while (l < 4 && d > D[l] + (l < c.lod ? -10 : 10)) l++;
      if (l !== c.lod) { c.lod = l; c.mesh.geometry = c.lods[l]; }
    }
  },
  // 카메라 거리에 따라 청크별로 상세/대역/가구/자동차 표시를 바꾼다
  updateLOD(camPos, force) {
    let changed = false;
    const hy = Math.max(0, camPos.y - this.heightAt(camPos.x, camPos.z) - 30);
    for (const c of this.lod) {
      const dx = Math.max(c.x0 - camPos.x, 0, camPos.x - c.x1), dz = Math.max(c.z0 - camPos.z, 0, camPos.z - c.z1);
      const d = Math.sqrt(dx * dx + dz * dz + hy * hy) / ((this.lodZoom || 1) * (this.lodDist || 1));
      // 단계: 0 가구까지, 1 상세, 2 상세(자동차 숨김), 3 대역 (경계에서 깜빡이지 않게 여유를 둔다)
      const pad = c.st < 0 ? 0 : 12;
      let st = 3;
      if (d < LOD_IN + (c.st <= 0 ? pad : -pad)) st = 0;
      else if (d < LOD_NEAR + (c.st <= 1 ? pad : -pad)) st = 1;
      else if (d < LOD_CAR + (c.st <= 2 ? pad : -pad)) st = 2;
      if (st === c.st && !force) continue;
      c.st = st;
      this.lodData[c.i] = st;
      changed = true;
    }
    if (changed) this.lodTex.needsUpdate = true;
    // 상세 건물이 하나도 보이지 않을 만큼 먼 250m 청크는 메시째 끈다
    // 저사양(상세 거리 배율 < 1)은 상세 거리 밖 자동차도 생략해 그리기 호출을 줄인다
    const far = ((this.lodDist || 1) < 1 ? LOD_NEAR : LOD_CAR) * (this.lodDist || 1) * (this.lodZoom || 1) + 20;
    for (const c of this.bChunks || []) {
      const dx = Math.max(c.x0 - camPos.x, 0, camPos.x - c.x1), dz = Math.max(c.z0 - camPos.z, 0, camPos.z - c.z1);
      const vis = Math.sqrt(dx * dx + dz * dz + hy * hy) < far;
      if (vis !== c.vis) { c.vis = vis; for (const m of c.meshes) m.visible = vis; }
    }
  },
  boxGeom(w, h, d, tile) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 6; v++) {
      const i = f * 6 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
    }
    return g;
  },
  ctx(x, y, z, rot) {
    const m = new THREE.Matrix4().makeRotationY(rot * Math.PI / 2);
    m.setPosition(x, y, z);
    return { x, y, z, rot: rot & 3, m };
  },
  sub(b, lx, ly, lz, r) { const p = this.tf(b, lx, lz); return this.ctx(p[0], b.y + ly, p[1], (b.rot + r) & 3); },
  tf(b, lx, lz) {
    switch (b.rot) {
      case 0: return [b.x + lx, b.z + lz];
      case 1: return [b.x + lz, b.z - lx];
      case 2: return [b.x - lx, b.z - lz];
      default: return [b.x - lz, b.z + lx];
    }
  },
  box(b, cx, cy, cz, w, h, d, mat, color, opts) {
    if (w <= 0.005 || h <= 0.005 || d <= 0.005) return;
    const g = this.boxGeom(w, h, d, TILE[mat] || 2);
    g.translate(cx, cy, cz);
    g.applyMatrix4(b.m);
    const p = this.tf(b, cx, cz);
    this.addGeo(g, mat, color, p[0], p[1]);
    if (!opts || !opts.nc) {
      const odd = b.rot & 1, ww = odd ? d : w, dd = odd ? w : d;
      this.addCollider(p[0] - ww / 2, b.y + cy - h / 2, p[1] - dd / 2, p[0] + ww / 2, b.y + cy + h / 2, p[1] + dd / 2, MATKIND[mat]);
    }
  },
  boxMM(b, x0, y0, z0, x1, y1, z1, mat, col, opts) {
    this.box(b, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, mat, col, opts);
  },
  geo(b, g, mat, color, lx, lz) {
    g.applyMatrix4(b.m);
    const p = this.tf(b, lx || 0, lz || 0);
    this.addGeo(g, mat, color, p[0], p[1]);
  },
  // X축 방향 벽 (z 위치), 개구부 목록 {a,b,y0,y1,win}
  wallX(b, x0, x1, z, t, y0, y1, ops, mat, col) {
    ops = (ops || []).slice().sort((p, q) => p.a - q.a);
    let cur = x0;
    for (const o of ops) {
      if (o.a > cur) this.boxMM(b, cur, y0, z - t / 2, o.a, y1, z + t / 2, mat, col);
      if (o.y0 > y0) this.boxMM(b, o.a, y0, z - t / 2, o.b, o.y0, z + t / 2, mat, col);
      if (o.y1 < y1) this.boxMM(b, o.a, o.y1, z - t / 2, o.b, y1, z + t / 2, mat, col);
      if (o.win) {
        this.boxMM(b, o.a - 0.06, o.y0 - 0.02, z - t / 2 - 0.07, o.b + 0.06, o.y0 + 0.05, z + t / 2 + 0.07, 'concrete', C(0xdedad2), NC);
        this.boxMM(b, o.a - 0.06, o.y1 - 0.04, z - t / 2 - 0.04, o.b + 0.06, o.y1 + 0.08, z + t / 2 + 0.04, 'concrete', C(0xdedad2), NC);
      }
      cur = o.b;
    }
    if (cur < x1) this.boxMM(b, cur, y0, z - t / 2, x1, y1, z + t / 2, mat, col);
  },
  wallZ(b, z0, z1, x, t, y0, y1, ops, mat, col) {
    ops = (ops || []).slice().sort((p, q) => p.a - q.a);
    let cur = z0;
    for (const o of ops) {
      if (o.a > cur) this.boxMM(b, x - t / 2, y0, cur, x + t / 2, y1, o.a, mat, col);
      if (o.y0 > y0) this.boxMM(b, x - t / 2, y0, o.a, x + t / 2, o.y0, o.b, mat, col);
      if (o.y1 < y1) this.boxMM(b, x - t / 2, o.y1, o.a, x + t / 2, y1, o.b, mat, col);
      if (o.win) {
        this.boxMM(b, x - t / 2 - 0.07, o.y0 - 0.02, o.a - 0.06, x + t / 2 + 0.07, o.y0 + 0.05, o.b + 0.06, 'concrete', C(0xdedad2), NC);
        this.boxMM(b, x - t / 2 - 0.04, o.y1 - 0.04, o.a - 0.06, x + t / 2 + 0.04, o.y1 + 0.08, o.b + 0.06, 'concrete', C(0xdedad2), NC);
      }
      cur = o.b;
    }
    if (cur < z1) this.boxMM(b, x - t / 2, y0, cur, x + t / 2, y1, z1, mat, col);
  },
  slabHole(b, x0, x1, z0, z1, y0, y1, h, mat, col) {
    this.boxMM(b, x0, y0, z0, h.x0, y1, z1, mat, col);
    this.boxMM(b, h.x1, y0, z0, x1, y1, z1, mat, col);
    this.boxMM(b, h.x0, y0, h.z1, h.x1, y1, z1, mat, col);
    this.boxMM(b, h.x0, y0, z0, h.x1, y1, h.z0, mat, col);
  },
  hipRoof(b, Wd, D, y, col, hgt) {
    const g = new THREE.ConeGeometry(1, 1, 4, 1).toNonIndexed();
    g.rotateY(Math.PI / 4);
    g.scale((Wd / 2 + 0.6) / Math.SQRT1_2, hgt || 2, (D / 2 + 0.6) / Math.SQRT1_2);
    g.translate(0, y + (hgt || 2) / 2, 0);
    this.geo(b, g, 'roof', col);
  },
  cyl(b, lx, ly, lz, rTop, rBot, h, seg, mat, col, collide) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg).toNonIndexed();
    g.translate(lx, ly + h / 2, lz);
    this.geo(b, g, mat, col, lx, lz);
    if (collide) {
      const p = this.tf(b, lx, lz), r = Math.max(rTop, rBot) * 0.8;
      this.addCollider(p[0] - r, b.y + ly, p[1] - r, p[0] + r, b.y + ly + h, p[1] + r, MATKIND[mat]);
    }
  },
  loot(b, lx, ly, lz) {
    const p = this.tf(b, lx, lz);
    this.lootSpots.push({ x: p[0], y: b.y + ly, z: p[1] });
  },

  /* -------------------------------------------------------------- */
  /* 건물 종류                                                        */
  /* -------------------------------------------------------------- */
  door(c, w) { w = w || 1.3; return { a: c - w / 2, b: c + w / 2, y0: 0, y1: 2.3 }; },
  win(c, w, y0, y1) { w = w || 1.4; return { a: c - w / 2, b: c + w / 2, y0: y0 === undefined ? 1.0 : y0, y1: y1 || 2.2, win: true }; },
  furniture(b, x0, z0, x1, z1, y) {
    this.inFurn = true;
    this.furnitureBody(b, x0, z0, x1, z1, y);
    this.inFurn = false;
  },
  furnitureBody(b, x0, z0, x1, z1, y) {
    const r = this.rnd, wood = C(U.pick([0x8a6a4a, 0x6b4f35, 0xa08060, 0x5a4636]));
    const k = Math.floor(r() * 4);
    if (k === 0) { // 테이블
      const cx = (x0 + x1) / 2 + (r() - 0.5), cz = (z0 + z1) / 2 + (r() - 0.5);
      this.boxMM(b, cx - 0.7, y + 0.7, cz - 0.45, cx + 0.7, y + 0.78, cz + 0.45, 'wood', wood);
      for (const [dx, dz] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) this.boxMM(b, cx + dx - 0.04, y, cz + dz - 0.04, cx + dx + 0.04, y + 0.7, cz + dz + 0.04, 'wood', wood, NC);
    } else if (k === 1) { // 책장
      this.boxMM(b, x0 + 0.05, y, z0 + 0.05, x0 + 1.4, y + 1.9, z0 + 0.45, 'wood', wood);
    } else if (k === 2) { // 소파
      const sc = C(U.pick([0x6a3a3a, 0x3a4a6a, 0x4a5a3a, 0x777066]));
      this.boxMM(b, x1 - 2.0, y, z0 + 0.05, x1 - 0.05, y + 0.45, z0 + 0.9, 'plaster', sc);
      this.boxMM(b, x1 - 2.0, y + 0.45, z0 + 0.05, x1 - 0.05, y + 0.9, z0 + 0.3, 'plaster', sc, NC);
    } else { // 침대
      this.boxMM(b, x1 - 1.05, y, z1 - 2.05, x1 - 0.05, y + 0.5, z1 - 0.05, 'plaster', C(0xe8e8f0));
      this.boxMM(b, x1 - 1.05, y + 0.5, z1 - 0.5, x1 - 0.05, y + 0.62, z1 - 0.1, 'plaster', C(0xffffff), NC);
    }
  },
  house1(b, Wd, D, small) {
    const H = 3.0, T = 0.25;
    const wc = C(U.pick(PLASTER)), ic = C(0xeae6dc), rc = C(U.pick(ROOFC));
    const brick = this.rnd() < 0.3;
    const wm = brick ? 'brick' : 'plaster', wcol = brick ? C(0xffffff) : wc;
    this.boxMM(b, -Wd / 2 + T, 0, -D / 2 + T, Wd / 2 - T, 0.03, D / 2 - T, 'floor', C(0xffffff), NC);
    this.wallX(b, -Wd / 2, Wd / 2, D / 2 - T / 2, T, 0, H, [this.door(-Wd / 4), this.win(Wd / 4)], wm, wcol);
    this.wallX(b, -Wd / 2, Wd / 2, -D / 2 + T / 2, T, 0, H, small ? [this.win(0)] : [this.win(-Wd / 4), this.win(Wd / 4)], wm, wcol);
    this.wallZ(b, -D / 2 + T, D / 2 - T, -Wd / 2 + T / 2, T, 0, H, [this.win(0, 1.2)], wm, wcol);
    this.wallZ(b, -D / 2 + T, D / 2 - T, Wd / 2 - T / 2, T, 0, H, small ? [] : [this.door(D / 6, 1.2)], wm, wcol);
    if (!small) {
      const px = Wd * 0.1;
      this.wallZ(b, -D / 2 + T, D / 2 - T, px, 0.14, 0, H, [this.door(-D / 2 + T + 1.0, 1.1)], 'plaster', ic);
      this.furniture(b, -Wd / 2 + T, -D / 2 + T, px - 0.07, D / 2 - T, 0);
      this.furniture(b, px + 0.07, -D / 2 + T, Wd / 2 - T, D / 2 - T, 0);
      this.loot(b, -Wd / 4, 0.05, 0.3); this.loot(b, Wd / 4 + 0.6, 0.05, -0.4);
      this.loot(b, -Wd / 4 - 1.2, 0.05, -D / 4); this.loot(b, Wd / 4 + 0.4, 0.05, D / 4);
    } else {
      this.loot(b, 0, 0.05, 0);
    }
    this.boxMM(b, -Wd / 2, H, -D / 2, Wd / 2, H + 0.25, D / 2, 'concrete', C(0xcfcac2));
    this.hipRoof(b, Wd, D, H + 0.25, rc, small ? 1.5 : 2.1);
    this.steps(b, -Wd / 4, D / 2);
  },
  steps(b, lx, lz) {
    const p = this.tf(b, lx, lz + 0.8);
    const g = this.heightAt(p[0], p[1]);
    const diff = b.y - g;
    if (diff > 0.3) {
      this.boxMM(b, lx - 0.9, -diff - 0.3, lz, lx + 0.9, -diff / 2, lz + 0.7, 'concrete', C(0xbdbab2));
      this.boxMM(b, lx - 0.9, -diff - 0.3, lz, lx + 0.9, -0.02, lz + 0.35, 'concrete', C(0xbdbab2));
    }
  },
  multiStory(b, Wd, D, floors) {
    const H = 3.2, T = 0.25, SL = 0.2;
    const nSteps = 11, run = 0.3, rise = H / nSteps;
    const zF = nSteps * run / 2, zB = -zF;
    const sw = 1.15, sx0 = -Wd / 2 + T + 0.02;
    const strips = [[sx0, sx0 + sw], [sx0 + sw + 0.05, sx0 + 2 * sw + 0.05]];
    const brick = this.rnd() < 0.45;
    const wm = brick ? 'brick' : 'plaster', wcol = brick ? C(0xffffff) : C(U.pick(PLASTER));
    const stairC = C(0xb5b0a8), slabC = C(0xd8d0c0), railC = C(0x333333), trim = C(0xd2cdc4);
    this.boxMM(b, -Wd / 2 + T, 0, -D / 2 + T, Wd / 2 - T, 0.03, D / 2 - T, 'floor', C(0xffffff), NC);
    for (let f = 0; f < floors; f++) {
      const y0 = f * H, wTop = y0 + H - SL;
      const front = f === 0 ? [this.door(Wd / 4, 1.4), this.win(-Wd / 4 + 0.6, 1.4, y0 + 1, y0 + 2.2)] : [this.win(Wd / 4, 1.6, y0 + 0.9, y0 + 2.3), this.win(-Wd / 4 + 0.6, 1.6, y0 + 0.9, y0 + 2.3)];
      for (const o of front) { if (!o.win) { o.y0 = y0; o.y1 = y0 + 2.3; } }
      this.wallX(b, -Wd / 2, Wd / 2, D / 2 - T / 2, T, y0, wTop, front, wm, wcol);
      const back = [this.win(-Wd / 4 + 0.5, 1.4, y0 + 1, y0 + 2.2), this.win(Wd / 4, 1.4, y0 + 1, y0 + 2.2)];
      if (f === 0) back.push({ a: 0.2, b: 1.4, y0: y0, y1: y0 + 2.3 });
      this.wallX(b, -Wd / 2, Wd / 2, -D / 2 + T / 2, T, y0, wTop, back, wm, wcol);
      this.wallZ(b, -D / 2 + T, D / 2 - T, -Wd / 2 + T / 2, T, y0, wTop, [this.win(D / 2 - 1.4, 1.2, y0 + 1, y0 + 2.2), this.win(-D / 2 + 1.4, 1.2, y0 + 1, y0 + 2.2)], wm, wcol);
      this.wallZ(b, -D / 2 + T, D / 2 - T, Wd / 2 - T / 2, T, y0, wTop, [this.win(-D / 4, 1.4, y0 + 1, y0 + 2.2), this.win(D / 4, 1.4, y0 + 1, y0 + 2.2)], wm, wcol);
      // 층 사이 띠
      if (f > 0) {
        this.boxMM(b, -Wd / 2 - 0.06, y0 - 0.25, D / 2 - 0.02, Wd / 2 + 0.06, y0 + 0.05, D / 2 + 0.08, 'concrete', trim, NC);
        this.boxMM(b, -Wd / 2 - 0.06, y0 - 0.25, -D / 2 - 0.08, Wd / 2 + 0.06, y0 + 0.05, -D / 2 + 0.02, 'concrete', trim, NC);
      }
      // 계단
      const sIdx = f % 2, s = strips[sIdx], dir = sIdx === 0 ? -1 : 1;
      if (f < floors - 1) {
        for (let k = 0; k < nSteps; k++) {
          const top = y0 + (k + 1) * rise;
          let za, zb;
          if (dir < 0) { zb = zF - k * run; za = zb - run; } else { za = zB + k * run; zb = za + run; }
          this.boxMM(b, s[0], y0, za, s[1], top, zb, 'concrete', stairC);
        }
        const hole = dir < 0 ? { x0: s[0] - 0.02, x1: s[1] + 0.02, z0: zB, z1: zF + 0.35 } : { x0: s[0] - 0.02, x1: s[1] + 0.02, z0: zB - 0.35, z1: zF };
        this.slabHole(b, -Wd / 2, Wd / 2, -D / 2, D / 2, wTop, y0 + H, hole, 'floor', slabC);
        const ry0 = y0 + H, ry1 = ry0 + 1.0;
        this.boxMM(b, hole.x1, ry0, hole.z0, hole.x1 + 0.07, ry1, hole.z1, 'dark', railC);
        if (sIdx === 1) this.boxMM(b, hole.x0 - 0.07, ry0, hole.z0, hole.x0, ry1, hole.z1, 'dark', railC);
        if (dir < 0) this.boxMM(b, hole.x0, ry0, hole.z1 - 0.07, hole.x1, ry1, hole.z1, 'dark', railC);
        else this.boxMM(b, hole.x0, ry0, hole.z0, hole.x1, ry1, hole.z0 + 0.07, 'dark', railC);
      } else {
        this.boxMM(b, -Wd / 2, wTop, -D / 2, Wd / 2, y0 + H, D / 2, 'concrete', C(0xa9a59d));
        const pc = C(0xbab5ab), py0 = y0 + H, py1 = py0 + 0.8;
        this.boxMM(b, -Wd / 2, py0, D / 2 - 0.2, Wd / 2, py1, D / 2, 'concrete', pc);
        this.boxMM(b, -Wd / 2, py0, -D / 2, Wd / 2, py1, -D / 2 + 0.2, 'concrete', pc);
        this.boxMM(b, -Wd / 2, py0, -D / 2 + 0.2, -Wd / 2 + 0.2, py1, D / 2 - 0.2, 'concrete', pc);
        this.boxMM(b, Wd / 2 - 0.2, py0, -D / 2 + 0.2, Wd / 2, py1, D / 2 - 0.2, 'concrete', pc);
        // 옥상 설비
        this.boxMM(b, Wd / 4 - 0.8, py0, -D / 4 - 0.6, Wd / 4 + 0.8, py0 + 1.1, -D / 4 + 0.6, 'metal', C(0x9aa0a6), NC);
      }
      // 가구 & 전리품
      const rx0 = strips[1][1] + 0.3;
      this.furniture(b, rx0, -D / 2 + T, Wd / 2 - T, D / 2 - T, y0);
      this.loot(b, Wd / 4, y0 + 0.05, -D / 4 + 0.3);
      this.loot(b, (rx0 + Wd / 2) / 2 - 1, y0 + 0.05, D / 4);
      if (f > 0) this.loot(b, -Wd / 2 + 1.0, y0 + 0.05, -D / 2 + 1.0);
      this.loot(b, Wd / 2 - 1.2, y0 + 0.05, D / 2 - 1.3);
    }
    this.steps(b, Wd / 4, D / 2);
  },
  shop(b, Wd, D) {
    const H = 3.6, T = 0.25;
    const wc = C(U.pick(PLASTER)), signs = [0xc0392b, 0x2471a3, 0x1e8449, 0xd68910, 0x7d3c98];
    this.boxMM(b, -Wd / 2 + T, 0, -D / 2 + T, Wd / 2 - T, 0.03, D / 2 - T, 'concrete', C(0xe0dcd6), NC);
    this.wallX(b, -Wd / 2, Wd / 2, D / 2 - T / 2, T, 0, H, [{ a: -Wd / 2 + 0.6, b: -1.0, y0: 0.6, y1: 2.9, win: true }, { a: -0.8, b: 0.8, y0: 0, y1: 2.5 }, { a: 1.0, b: Wd / 2 - 0.6, y0: 0.6, y1: 2.9, win: true }], 'plaster', wc);
    this.wallX(b, -Wd / 2, Wd / 2, -D / 2 + T / 2, T, 0, H, [{ a: Wd / 2 - 2.2, b: Wd / 2 - 1.0, y0: 0, y1: 2.3 }], 'plaster', wc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, -Wd / 2 + T / 2, T, 0, H, [this.win(0, 1.6)], 'plaster', wc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, Wd / 2 - T / 2, T, 0, H, [], 'plaster', wc);
    this.boxMM(b, -Wd / 2, H, -D / 2, Wd / 2, H + 0.25, D / 2, 'concrete', C(0xb5b0a8));
    this.boxMM(b, -Wd / 2, H + 0.25, D / 2 - 0.2, Wd / 2, H + 0.75, D / 2, 'concrete', C(0xb5b0a8), NC);
    this.boxMM(b, -Wd / 2 + 0.6, H - 0.3, D / 2, Wd / 2 - 0.6, H + 0.6, D / 2 + 0.15, 'paint', C(U.pick(signs)), NC);
    this.boxMM(b, -Wd / 2 + 0.8, 0, -1.3, 1.0, 1.0, -0.6, 'wood', C(0x7a5a3a));
    this.boxMM(b, -Wd / 2 + T + 0.05, 0, -D / 2 + T + 0.05, Wd / 2 - 2.5, 1.9, -D / 2 + T + 0.5, 'wood', C(0x8a6a4a));
    this.loot(b, -1, 0.05, 1.5); this.loot(b, 2.5, 0.05, -2.5); this.loot(b, -3, 0.05, -2.6);
  },
  warehouse(b, Wd, D) {
    const H = 7, T = 0.3;
    const mc = C(U.pick([0x8f9aa3, 0xa3a08f, 0x7f8f86, 0x9c8a7a, 0x6f7f95, 0xa08070]));
    this.boxMM(b, -Wd / 2 + T, 0, -D / 2 + T, Wd / 2 - T, 0.03, D / 2 - T, 'concrete', C(0xa0a0a0), NC);
    const hw = c => ({ a: c - 1.0, b: c + 1.0, y0: 4.6, y1: 5.8 });
    this.wallX(b, -Wd / 2, Wd / 2, D / 2 - T / 2, T, 0, H, [{ a: -Wd / 4 - 0.8, b: -Wd / 4 + 0.8, y0: 0, y1: 2.5 }, hw(1), hw(Wd / 4 + 2)], 'metal', mc);
    this.wallX(b, -Wd / 2, Wd / 2, -D / 2 + T / 2, T, 0, H, [hw(-Wd / 4), hw(0), hw(Wd / 4)], 'metal', mc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, -Wd / 2 + T / 2, T, 0, H, [{ a: -2.5, b: 2.5, y0: 0, y1: 5 }], 'metal', mc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, Wd / 2 - T / 2, T, 0, H, [{ a: -2.5, b: 2.5, y0: 0, y1: 5 }], 'metal', mc);
    this.boxMM(b, -Wd / 2 - 0.3, H, -D / 2 - 0.3, Wd / 2 + 0.3, H + 0.3, D / 2 + 0.3, 'metal', C(0x6a6e72));
    const g = new THREE.CylinderGeometry(D / 2 + 0.3, D / 2 + 0.3, Wd + 0.6, 16, 1, false, 0, Math.PI).toNonIndexed();
    g.rotateZ(Math.PI / 2); g.scale(1, 0.18, 1); g.translate(0, H + 0.3, 0);
    this.geo(b, g, 'metal', C(0x7a7e82));
    // 내부 상자
    const r = this.rnd;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x = -Wd / 2 + 3 + i * (Wd - 6) / 3 + (r() - 0.5) * 1.5, z = side * (D / 2 - 2.2 - r() * 1.2);
        const s = 1.2 + r() * 0.4;
        this.box(b, x, s / 2, z, s, s, s, 'crate', C(0xffffff));
        if (r() < 0.5) { const s2 = 1.0 + r() * 0.3; this.box(b, x + (r() - 0.5) * 0.2, s + s2 / 2, z, s2, s2, s2, 'crate', C(0xe8e0d0)); }
        if (i % 2 === 0) this.loot(b, x + 1.4, 0.05, z - side * 0.6);
      }
    }
    this.loot(b, 0, 0.05, 0); this.loot(b, -Wd / 4, 0.05, 0.6); this.loot(b, Wd / 4, 0.05, -0.6);
  },
  barracks(b, Wd, D) {
    const H = 3.0, T = 0.25, wc = C(U.pick([0x8a9078, 0x9a9a88, 0x7d8670]));
    this.boxMM(b, -Wd / 2 + T, 0, -D / 2 + T, Wd / 2 - T, 0.03, D / 2 - T, 'floor', C(0xc8c8c8), NC);
    this.wallX(b, -Wd / 2, Wd / 2, D / 2 - T / 2, T, 0, H, [this.door(-Wd / 4), this.door(Wd / 4), this.win(0, 1.6), this.win(-Wd / 2 + 1.5, 1.2), this.win(Wd / 2 - 1.5, 1.2)], 'plaster', wc);
    this.wallX(b, -Wd / 2, Wd / 2, -D / 2 + T / 2, T, 0, H, [this.win(-Wd / 4, 1.4), this.win(0, 1.4), this.win(Wd / 4, 1.4)], 'plaster', wc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, -Wd / 2 + T / 2, T, 0, H, [], 'plaster', wc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, Wd / 2 - T / 2, T, 0, H, [this.win(0, 1.2)], 'plaster', wc);
    for (let i = 0; i < 4; i++) {
      const x = -Wd / 2 + 1.6 + i * (Wd - 3.2) / 3;
      this.boxMM(b, x - 0.5, 0, -D / 2 + T + 0.05, x + 0.5, 0.55, -D / 2 + T + 2.0, 'plaster', C(0x5a6a4a));
    }
    this.boxMM(b, -Wd / 2, H, -D / 2, Wd / 2, H + 0.25, D / 2, 'concrete', C(0x9a9a90));
    this.boxMM(b, -Wd / 2 - 0.2, H + 0.25, -D / 2 - 0.2, Wd / 2 + 0.2, H + 0.35, D / 2 + 0.2, 'metal', C(0x5a6050), NC);
    this.loot(b, -Wd / 4, 0.05, 0.5); this.loot(b, Wd / 4, 0.05, 0.5); this.loot(b, 0, 0.05, -0.3);
  },
  barn(b, Wd, D) {
    const H = 5.5, T = 0.25, wc = C(U.pick([0xa8442e, 0x8a3a28, 0x8a6a4a]));
    this.boxMM(b, -Wd / 2 + T, 0, -D / 2 + T, Wd / 2 - T, 0.03, D / 2 - T, 'wood', C(0x7a6040), NC);
    this.wallX(b, -Wd / 2, Wd / 2, D / 2 - T / 2, T, 0, H, [{ a: -2.1, b: 2.1, y0: 0, y1: 4.4 }, this.win(Wd / 2 - 2, 1.2, 2.8, 3.8)], 'wood', wc);
    this.wallX(b, -Wd / 2, Wd / 2, -D / 2 + T / 2, T, 0, H, [this.door(Wd / 4, 1.4)], 'wood', wc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, -Wd / 2 + T / 2, T, 0, H, [this.win(-2, 1.4, 1.2, 2.4), this.win(2, 1.4, 1.2, 2.4)], 'wood', wc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, Wd / 2 - T / 2, T, 0, H, [this.win(0, 1.4, 1.2, 2.4)], 'wood', wc);
    this.boxMM(b, -Wd / 2, H, -D / 2, Wd / 2, H + 0.2, D / 2, 'wood', C(0x5a4030));
    this.hipRoof(b, Wd, D, H + 0.2, C(0x4a4a50), 3.6);
    const r = this.rnd;
    for (let i = 0; i < 7; i++) {
      const x = (r() - 0.5) * (Wd - 4), z = (r() < 0.5 ? -1 : 1) * (D / 2 - 1.5 - r());
      this.box(b, x, 0.45, z, 1.3, 0.9, 0.9, 'hay', C(0xffffff));
      if (r() < 0.4) this.box(b, x + 0.1, 1.35, z, 1.3, 0.9, 0.9, 'hay', C(0xf0f0e0));
    }
    this.loot(b, 0, 0.05, 0); this.loot(b, -Wd / 4, 0.05, 1); this.loot(b, Wd / 4, 0.05, -1);
  },
  tower(b) {
    const P = 5.4, S = 4, wood = C(0x8a6a48), post = C(0x6b5038);
    for (const [x, z] of [[-1.85, -1.85], [1.85, -1.85], [-1.85, 1.85], [1.85, 1.85]]) {
      this.boxMM(b, x - 0.15, -0.5, z - 0.15, x + 0.15, P, z + 0.15, 'wood', post);
      this.boxMM(b, x - 0.1, P + 0.2, z - 0.1, x + 0.1, P + 2.6, z + 0.1, 'wood', post, NC);
    }
    this.boxMM(b, -S / 2, P, -S / 2, S / 2, P + 0.2, S / 2, 'wood', wood);
    const ry = P + 0.2, rh = P + 1.25;
    this.boxMM(b, -S / 2, ry, -S / 2, S / 2, rh, -S / 2 + 0.1, 'wood', wood);
    this.boxMM(b, -S / 2, ry, -S / 2 + 0.1, -S / 2 + 0.1, rh, S / 2, 'wood', wood);
    this.boxMM(b, S / 2 - 0.1, ry, -S / 2 + 0.1, S / 2, rh, S / 2, 'wood', wood);
    this.boxMM(b, -S / 2 + 0.1, ry, S / 2 - 0.1, -0.65, rh, S / 2, 'wood', wood);
    this.boxMM(b, 0.65, ry, S / 2 - 0.1, S / 2 - 0.1, rh, S / 2, 'wood', wood);
    this.boxMM(b, -S / 2 - 0.3, P + 2.6, -S / 2 - 0.3, S / 2 + 0.3, P + 2.75, S / 2 + 0.3, 'metal', C(0x5a6050));
    // 계단
    const n = 20, rise = (P + 0.2) / n, run = 0.3;
    for (let k = 0; k < n; k++) {
      const z0 = S / 2 + (n - 1 - k) * run;
      this.boxMM(b, -0.6, -0.4, z0, 0.6, (k + 1) * rise, z0 + run, 'wood', wood);
    }
  },
  container(b, lx, ly, lz, r, color, open) {
    const c = this.sub(b, lx, ly, lz, r);
    const L = 6.06, H = 2.6, Wd = 2.44, t = 0.08;
    if (!open) { this.box(c, 0, H / 2, 0, L, H, Wd, 'metal', color); return; }
    this.boxMM(c, -L / 2, 0, -Wd / 2, L / 2, 0.12, Wd / 2, 'metal', C(0x555555));
    this.boxMM(c, -L / 2, H - 0.1, -Wd / 2, L / 2, H, Wd / 2, 'metal', color);
    this.boxMM(c, -L / 2, 0, -Wd / 2, L / 2, H, -Wd / 2 + t, 'metal', color);
    this.boxMM(c, -L / 2, 0, Wd / 2 - t, L / 2, H, Wd / 2, 'metal', color);
    this.boxMM(c, -L / 2, 0, -Wd / 2 + t, -L / 2 + t, H, Wd / 2 - t, 'metal', color);
    this.boxMM(c, L / 2, 0, Wd / 2, L / 2 + 0.05, H, Wd / 2 + 1.2, 'metal', color);
    this.loot(c, 0, 0.13, 0);
  },
  containers(b) {
    const r = this.rnd;
    const col = () => C(U.pick(CONT));
    this.container(b, -1.5, 0, -2.2, 0, col(), r() < 0.5);
    this.container(b, -1.5, 0, 0.6, 0, col(), r() < 0.5);
    if (r() < 0.6) this.container(b, -1.5, 2.6, -2.2, 0, col(), false);
    if (r() < 0.7) this.container(b, 3.0, 0, 1.5, 1, col(), r() < 0.5);
  },
  sandbags(b) {
    const r = this.rnd;
    this.box(b, 0, 0.5, 1.5, 3.2, 1.0, 0.8, 'sandbag', C(0xffffff));
    this.box(b, -1.9, 0.5, 0.2, 0.8, 1.0, 2.0, 'sandbag', C(0xf0f0f0));
    if (r() < 0.6) this.box(b, 1.9, 0.5, 0.2, 0.8, 1.0, 2.0, 'sandbag', C(0xf0f0f0));
  },
  silo(b) {
    this.cyl(b, 0, 0, 0, 2.6, 2.6, 11, 18, 'metal', C(0xb8bcc0), true);
    const g = new THREE.SphereGeometry(2.6, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
    g.translate(0, 11, 0);
    this.geo(b, g, 'metal', C(0xa8acb0));
  },
  hay(b) {
    const r = this.rnd;
    for (let i = 0; i < 4; i++) {
      const g = new THREE.CylinderGeometry(0.75, 0.75, 1.2, 14).toNonIndexed();
      g.rotateX(Math.PI / 2);
      const x = (r() - 0.5) * 3.5, z = (r() - 0.5) * 3.5;
      g.translate(x, 0.75, z);
      this.geo(b, g, 'hay', C(0xffffff), x, z);
      const p = this.tf(b, x, z);
      this.addCollider(p[0] - 0.7, b.y, p[1] - 0.7, p[0] + 0.7, b.y + 1.5, p[1] + 0.7, 'wood');
    }
  },
  tank(b) {
    this.cyl(b, 0, 0, 0, 3.8, 3.8, 7.5, 24, 'metal', C(0xd0d4d8), true);
    const g = new THREE.ConeGeometry(3.9, 1.2, 24).toNonIndexed();
    g.translate(0, 8.1, 0);
    this.geo(b, g, 'metal', C(0xb0b4b8));
    this.cyl(b, 3.8, 0, 0, 0.35, 0.35, 1.2, 8, 'metal', C(0x777777), false);
  },
  chimney(b) {
    this.cyl(b, 0, 0, 0, 1.6, 2.5, 36, 20, 'concrete', C(0xd8d4cc), true);
    this.cyl(b, 0, 30, 0, 1.78, 1.85, 2.2, 20, 'paint', C(0xb0302a), false);
    this.cyl(b, 0, 26, 0, 1.88, 1.95, 2.2, 20, 'paint', C(0xb0302a), false);
  },
  shed(b) {
    const wc = C(U.pick([0x8a6a48, 0x7a5a40, 0x9a8060]));
    const Wd = 5, D = 4, H = 2.6, T = 0.15;
    this.wallX(b, -Wd / 2, Wd / 2, D / 2 - T / 2, T, 0, H, [this.door(0, 1.2)], 'wood', wc);
    this.wallX(b, -Wd / 2, Wd / 2, -D / 2 + T / 2, T, 0, H, [], 'wood', wc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, -Wd / 2 + T / 2, T, 0, H, [this.win(0, 0.8, 1.2, 1.9)], 'wood', wc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, Wd / 2 - T / 2, T, 0, H, [], 'wood', wc);
    this.boxMM(b, -Wd / 2 - 0.3, H, -D / 2 - 0.3, Wd / 2 + 0.3, H + 0.15, D / 2 + 0.3, 'metal', C(0x6a5a4a));
    this.loot(b, 0, 0.05, -0.5); this.loot(b, 1.4, 0.05, 0.6);
  },
  car(b, lx, lz, r) {
    const c = this.sub(b, lx, 0, lz, r);
    const col = C(U.pick(CARC)), dark = C(0x1c1c1c);
    this.boxMM(c, -2.15, 0.34, -0.88, 2.15, 1.02, 0.88, 'paint', col);
    this.boxMM(c, -1.15, 1.02, -0.8, 0.95, 1.55, 0.8, 'glass', C(0x2a3a48));
    this.boxMM(c, -1.1, 1.55, -0.78, 0.9, 1.62, 0.78, 'paint', col, NC);
    this.boxMM(c, -2.25, 0.36, -0.86, -2.12, 0.62, 0.86, 'dark', dark, NC);
    this.boxMM(c, 2.12, 0.36, -0.86, 2.25, 0.62, 0.86, 'dark', dark, NC);
    for (const sx of [-1.35, 1.35]) for (const sz of [-0.83, 0.83]) {
      const g = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14).toNonIndexed();
      g.rotateX(Math.PI / 2); g.translate(sx, 0.36, sz);
      this.geo(c, g, 'dark', dark, sx, sz);
    }
  },
  ruins(b) {
    const r = this.rnd, col = C(U.pick([0xb8b0a0, 0xa09888, 0xc0b8a8]));
    const m = r() < 0.5 ? 'brick' : 'concrete';
    const L = 6 + r() * 4;
    this.boxMM(b, -L / 2, -0.5, -0.15, L / 2, 0.8 + r() * 2.2, 0.15, m, m === 'brick' ? C(0xffffff) : col);
    this.boxMM(b, -L / 2, -0.5, 0.15, -L / 2 + 0.3, 0.6 + r() * 1.8, 0.15 + 2 + r() * 3, m, m === 'brick' ? C(0xffffff) : col);
    if (r() < 0.6) this.boxMM(b, L / 2 - 2.5, -0.5, 2.5, L / 2, 1.1, 2.8, m, m === 'brick' ? C(0xffffff) : col);
    for (let i = 0; i < 3; i++) { const s = 0.3 + r() * 0.5; this.box(b, (r() - 0.5) * L, s / 2 - 0.1, 1 + r() * 2, s, s, s, 'concrete', col, NC); }
  },
  // 통나무 산장 (숲·산)
  cabin(b) {
    const Wd = 8, D = 7, H = 2.8, T = 0.22;
    const wc = C(U.pick([0x7a5434, 0x6a4a30, 0x8a6240])), rc = C(U.pick([0x3a3f36, 0x4a3a2c, 0x2f3b3a]));
    this.boxMM(b, -Wd / 2 + T, 0, -D / 2 + T, Wd / 2 - T, 0.03, D / 2 - T, 'floor', C(0xd8c8b0), NC);
    this.wallX(b, -Wd / 2, Wd / 2, D / 2 - T / 2, T, 0, H, [this.door(-1.4, 1.1), this.win(1.6, 1.2, 1.0, 2.0)], 'wood', wc);
    this.wallX(b, -Wd / 2, Wd / 2, -D / 2 + T / 2, T, 0, H, [this.win(0, 1.2, 1.0, 2.0)], 'wood', wc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, -Wd / 2 + T / 2, T, 0, H, [this.win(0, 1.0, 1.1, 1.9)], 'wood', wc);
    this.wallZ(b, -D / 2 + T, D / 2 - T, Wd / 2 - T / 2, T, 0, H, [], 'wood', wc);
    // 통나무 띠
    for (let y = 0.35; y < H; y += 0.55) { this.boxMM(b, -Wd / 2 - 0.05, y, D / 2 - 0.02, Wd / 2 + 0.05, y + 0.08, D / 2 + 0.05, 'wood', C(0x5a3e28), NC); this.boxMM(b, -Wd / 2 - 0.05, y, -D / 2 - 0.05, Wd / 2 + 0.05, y + 0.08, -D / 2 + 0.02, 'wood', C(0x5a3e28), NC); }
    this.boxMM(b, -Wd / 2, H, -D / 2, Wd / 2, H + 0.18, D / 2, 'wood', C(0x6a4a30));
    this.hipRoof(b, Wd, D, H + 0.18, rc, 2.0);
    // 현관 데크
    this.boxMM(b, -Wd / 2, -0.1, D / 2, Wd / 2, 0.08, D / 2 + 1.6, 'wood', C(0x8a6a48));
    for (const x of [-Wd / 2 + 0.2, Wd / 2 - 0.2]) this.boxMM(b, x - 0.08, 0.08, D / 2 + 1.42, x + 0.08, H, D / 2 + 1.58, 'wood', C(0x5a3e28), NC);
    this.boxMM(b, -Wd / 2, H - 0.1, D / 2, Wd / 2, H + 0.05, D / 2 + 1.7, 'wood', C(0x5a4030), NC);
    this.furniture(b, -Wd / 2 + T, -D / 2 + T, Wd / 2 - T, D / 2 - T, 0);
    this.loot(b, -1.5, 0.05, -1.2); this.loot(b, 1.8, 0.05, 1.0); this.loot(b, 0.2, 0.05, 2.2);
  },
  // 강 위 다리 (도로가 강을 건너는 곳)
  genBridges() {
    const deck = C(0x8a8780), rail = C(0x5a5a5e), pier = C(0x9a968e);
    for (const br of this.bridges) {
      const yaw = Math.atan2(br.ux, br.uz);   // 로컬 +z = 도로 방향
      const m = new THREE.Matrix4().makeRotationY(yaw); m.setPosition(br.x, br.y, br.z);
      const b = { x: br.x, y: br.y, z: br.z, rot: 0, m };
      const L = br.half * 2, Wd = br.w, t = 0.5;
      // 다리 상판·난간·교각 (회전된 상자라 충돌은 아래에서 따로)
      const addBox = (w, h, d, x, y, z, mat, col) => { const g = this.boxGeom(w, h, d, TILE[mat] || 2); g.translate(x, y, z); g.applyMatrix4(m); this.addGeo(g, mat, col, br.x, br.z); };
      addBox(Wd, t, L, 0, -t / 2, 0, 'concrete', deck);
      for (const sx of [-1, 1]) {
        addBox(0.3, 0.9, L, sx * (Wd / 2 - 0.15), 0.45, 0, 'concrete', rail);
        for (let z = -L / 2 + 2; z < L / 2 - 1; z += 4) addBox(0.36, 1.05, 0.36, sx * (Wd / 2 - 0.15), 0.5, z, 'concrete', rail);
      }
      for (let z = -L / 2 + 6; z <= L / 2 - 6; z += Math.max(8, (L - 12) / 3)) addBox(Wd * 0.7, br.y - br.level + 4, 1.2, 0, -(br.y - br.level + 4) / 2 - t, z, 'concrete', pier);
      // 충돌: 도로 방향을 따라 작은 상자로 쪼갠다 (축 정렬 상자로 회전된 상판 근사)
      const step = 1.0;
      for (let z = -L / 2; z < L / 2; z += step) {
        for (let x = -Wd / 2 + 0.5; x < Wd / 2; x += 1.0) {
          const cx = br.x + br.uz * x + br.ux * (z + step / 2), cz = br.z - br.ux * x + br.uz * (z + step / 2);
          this.addCollider(cx - 0.6, br.y - t, cz - 0.6, cx + 0.6, br.y, cz + 0.6, 'hard');
        }
        for (const sx of [-1, 1]) {
          const x = sx * (Wd / 2 - 0.15), cx = br.x + br.uz * x + br.ux * (z + step / 2), cz = br.z - br.ux * x + br.uz * (z + step / 2);
          this.addCollider(cx - 0.3, br.y, cz - 0.3, cx + 0.3, br.y + 0.95, cz + 0.3, 'hard');
        }
      }
    }
  },
  fence(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3));
    const col = C(0x8a7050);
    for (let i = 0; i < n; i++) {
      if (this.rnd() < 0.12) continue;
      const ax = U.lerp(x0, x1, i / n), az = U.lerp(z0, z1, i / n), bx = U.lerp(x0, x1, (i + 1) / n), bz = U.lerp(z0, z1, (i + 1) / n);
      const h = this.heightAt((ax + bx) / 2, (az + bz) / 2);
      const b = this.ctx((ax + bx) / 2, h, (az + bz) / 2, 0);
      const alongX = Math.abs(bx - ax) > Math.abs(bz - az), seg = len / n;
      if (alongX) { this.boxMM(b, -seg / 2, 0.45, -0.04, seg / 2, 0.55, 0.04, 'wood', col); this.boxMM(b, -seg / 2, 0.85, -0.04, seg / 2, 0.95, 0.04, 'wood', col, NC); }
      else { this.boxMM(b, -0.04, 0.45, -seg / 2, 0.04, 0.55, seg / 2, 'wood', col); this.boxMM(b, -0.04, 0.85, -seg / 2, 0.04, 0.95, seg / 2, 'wood', col, NC); }
      this.boxMM(b, -0.07, -0.3, -0.07, 0.07, 1.05, 0.07, 'wood', C(0x6b5038), NC);
      // 울타리 충돌 높이 보정
      const last = this.boxes[this.boxes.length - 1]; last.minY = h - 0.3; last.maxY = h + 1.05;
    }
  },

  /* -------------------------------------------------------------- */
  /* 배치                                                            */
  /* -------------------------------------------------------------- */
  overlapsFoot(x0, z0, x1, z1) {
    for (const f of this.footprints) if (x0 < f.maxX && x1 > f.minX && z0 < f.maxZ && z1 > f.minZ) return true;
    return false;
  },
  place(kind, x, z, rot, opts) {
    const fp = FOOT[kind];
    const fw = fp[0], fd = fp[1], oz = fp[2] || 0;
    const odd = rot & 1;
    const off = this.tf({ x: 0, z: 0, rot }, 0, oz);
    const cx = x + off[0], cz = z + off[1];
    const hw = (odd ? fd : fw) / 2, hd = (odd ? fw : fd) / 2;
    const m = (opts && opts.margin !== undefined) ? opts.margin : 3;
    if (cx - hw < -HALF + 20 || cx + hw > HALF - 20 || cz - hd < -HALF + 20 || cz + hd > HALF - 20) return false;
    if (this.overlapsFoot(cx - hw - m, cz - hd - m, cx + hw + m, cz + hd + m)) return false;
    if (kind !== 'car' && this.roadDist(cx, cz) < Math.max(hw, hd) + 4.5) return false;
    // 지면 높이
    let mn = 1e9, mx = -1e9;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
      const h = this.heightAt(cx - hw + hw * 2 * i / 4, cz - hd + hd * 2 * j / 4);
      if (h < mn) mn = h; if (h > mx) mx = h;
    }
    if (mn < 0.6) return false;
    // 강·호수 근처는 피한다
    for (const [px, pz] of [[cx, cz], [cx - hw, cz - hd], [cx + hw, cz - hd], [cx - hw, cz + hd], [cx + hw, cz + hd]]) {
      const wl = this.waterAt(px, pz);
      if (wl > 0.05 && this.heightAt(px, pz) < wl + 2.5) return false;
    }
    if (this.bridges && this.bridges.some(br => Math.hypot(cx - br.x, cz - br.z) < br.half + Math.max(hw, hd) + 4)) return false;
    if (opts && opts.maxSlope !== undefined && mx - mn > opts.maxSlope) return false;
    this.footprints.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd, kind });
    this.cur = LOD_KIND[kind] ? { x: cx, z: cz, tag: LOD_KIND[kind], geos: [] } : null;
    let fy = mx + 0.12;
    const noFound = ['car', 'sandbags', 'hay', 'ruins', 'containers', 'tower'];
    if (!noFound.includes(kind)) {
      const fb = this.ctx(cx, fy, cz, 0);
      this.boxMM(fb, -hw - 0.05, mn - fy - 0.6, -hd - 0.05, hw + 0.05, 0, hd + 0.05, 'concrete', C(0xa8a49c));
    }
    if (kind === 'containers' || kind === 'tower') fy = mn + 0.02;
    if (kind === 'sandbags' || kind === 'hay' || kind === 'ruins') fy = (mn + mx) / 2;
    const b = this.ctx(x, fy, z, rot);
    switch (kind) {
      case 'house1': this.house1(b, 10, 8); break;
      case 'shed': this.shed(b); break;
      case 'house2': this.multiStory(b, 12, 10, 2); break;
      case 'apt': this.multiStory(b, 14, 12, 3); break;
      case 'shop': this.shop(b, 10, 9); break;
      case 'warehouse': this.warehouse(b, 24, 14); break;
      case 'barracks': this.barracks(b, 16, 7); break;
      case 'barn': this.barn(b, 16, 12); break;
      case 'tower': this.tower(b); break;
      case 'containers': this.containers(b); break;
      case 'sandbags': this.sandbags(b); break;
      case 'silo': this.silo(b); break;
      case 'hay': this.hay(b); break;
      case 'tank': this.tank(b); break;
      case 'chimney': this.chimney(b); break;
      case 'car': b.y = this.heightAt(x, z); this.car(b, 0, 0, 0); break;
      case 'ruins': this.ruins(b); break;
      case 'cabin': this.cabin(b); break;
    }
    if (this.cur && this.cur.tag === 'b') this.makeProxy(this.cur);
    this.cur = null;
    return true;
  },
  // 멀리서 볼 건물 대역: 벽은 상자 하나, 지붕은 원래 지붕. 재질 하나로 합쳐 청크당 1회 그린다
  makeProxy(B) {
    const bb = new THREE.Box3(), gb = new THREE.Box3();
    let roofY = Infinity, best = null, bestA = -1;
    const area = {};
    const roofs = [];
    for (const e of B.geos) {
      if (!e.geo.boundingBox) e.geo.computeBoundingBox();
      gb.copy(e.geo.boundingBox);
      if (e.mat === 'roof') { roofs.push(e); roofY = Math.min(roofY, gb.min.y); continue; }
      if (e.mat === 'glass' || e.mat === 'dark') continue;
      bb.union(gb);
      if (e.mat === 'floor') continue;
      const sx = gb.max.x - gb.min.x, sy = gb.max.y - gb.min.y, sz = gb.max.z - gb.min.z;
      const k = e.mat + '#' + e.color.getHexString();
      area[k] = (area[k] || 0) + sy * (sx + sz);
      if (area[k] > bestA) { bestA = area[k]; best = e; }
    }
    if (bb.isEmpty() || !best) return;
    const top = roofs.length ? Math.min(roofY + 0.05, bb.max.y) : bb.max.y;
    const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z, h = top - bb.min.y;
    const cx = Math.floor((B.x + HALF) / LOD_CH), cz = Math.floor((B.z + HALF) / LOD_CH);
    const list = this.proxyParts;
    if (h > 0.2) {
      const g = new THREE.BoxGeometry(w - 0.1, h, d - 0.1).toNonIndexed();
      g.translate((bb.min.x + bb.max.x) / 2, bb.min.y + h / 2, (bb.min.z + bb.max.z) / 2);
      list.push({ geo: g, mat: best.mat, color: best.color, cx, cz });
    }
    for (const e of roofs) list.push({ geo: e.geo.clone(), mat: 'roof', color: e.color, cx, cz });
  },
  genTowns() {
    const r = this.rnd;
    for (const t of this.towns) {
      if (t.type === 'range') { this.buildRange(t); continue; }
      const content = TOWN_CONTENT[t.type];
      for (const [kind, count] of content) {
        let placed = 0;
        for (let tries = 0; tries < count * 50 && placed < count; tries++) {
          const ang = r() * Math.PI * 2;
          let rr = Math.sqrt(r()) * (t.r - 6);
          let x = t.x + Math.cos(ang) * rr, z = t.z + Math.sin(ang) * rr;
          let rot;
          if (kind === 'car') {
            // 도로 옆에 주차
            const road = U.pick(this.roads);
            const tt = r();
            x = U.lerp(road.ax, road.bx, tt); z = U.lerp(road.az, road.bz, tt);
            if (Math.hypot(x - t.x, z - t.z) > t.r + 10) continue;
            const ang2 = Math.atan2(road.bz - road.az, road.bx - road.ax);
            const side = r() < 0.5 ? 1 : -1;
            x += Math.cos(ang2 + Math.PI / 2) * side * 4.6; z += Math.sin(ang2 + Math.PI / 2) * side * 4.6;
            rot = Math.abs(Math.cos(ang2)) > Math.abs(Math.sin(ang2)) ? 0 : 1;
            if (r() < 0.3) rot = U.randInt(0, 3);
          } else {
            const dx = t.x - x, dz = t.z - z;
            rot = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 0 : 2);
            if (r() < 0.25) rot = Math.floor(r() * 4);
          }
          if (this.place(kind, x, z, rot, { margin: kind === 'car' ? 1 : 3.5 })) placed++;
        }
      }
      // 농장 울타리
      if (t.type === 'farm' && this.rnd() < 0.8) {
        const R = t.r + 6;
        this.fence(t.x - R, t.z - R, t.x + R, t.z - R);
        this.fence(t.x - R, t.z + R, t.x - 8, t.z + R);
        this.fence(t.x + 8, t.z + R, t.x + R, t.z + R);
        this.fence(t.x - R, t.z - R, t.x - R, t.z + R);
      }
    }
  },
  // 사격장 고정 구조물: 사격대(지붕·벤치 테이블), 옆·뒤 흙벽, 표적 레일. 표적·총은 훈련 모드에서만 올린다
  buildRange(t) {
    const y = t.h, b = this.ctx(t.x, y, t.z, 0), FL = 46;           // 사격선 (사격장 중심 기준 +z 46m)
    this.range = { x: t.x, z: t.z, y, line: t.z + FL, spawn: { x: t.x, z: t.z + FL + 3 } };
    const conc = C(0xbdb8ae), wood = C(0x8a6a48), dark = C(0x3a3a38), metal = C(0x7d838a), bag = C(0xd8ccb0);
    // 사격대 바닥·지붕·기둥
    this.boxMM(b, -16, -0.4, FL, 16, 0.06, FL + 10, 'concrete', conc, NC);
    for (const x of [-15.6, -5.2, 5.2, 15.6]) for (const z of [FL + 0.4, FL + 9.6]) this.boxMM(b, x - 0.15, 0, z - 0.15, x + 0.15, 3.4, z + 0.15, 'metal', metal);
    this.boxMM(b, -16.4, 3.4, FL - 0.4, 16.4, 3.6, FL + 10.4, 'metal', C(0x5d6066), NC);
    this.boxMM(b, -16.4, 3.0, FL + 10.2, 16.4, 3.4, FL + 10.4, 'metal', C(0x5d6066), NC);
    // 벤치 테이블 4개 (사격선 바로 앞): 소총 · 산탄총 · 권총 · 조준경/투척
    this.range.tables = [];
    for (let i = 0; i < 4; i++) {
      const x0 = -14 + i * 7.2, x1 = x0 + 5.6, z0 = FL + 0.6, z1 = FL + 1.6;
      this.boxMM(b, x0, 0.86, z0, x1, 0.94, z1, 'wood', wood);
      for (const [lx, lz] of [[x0 + 0.1, z0 + 0.1], [x1 - 0.1, z0 + 0.1], [x0 + 0.1, z1 - 0.1], [x1 - 0.1, z1 - 0.1]]) this.boxMM(b, lx - 0.05, 0.06, lz - 0.05, lx + 0.05, 0.86, lz + 0.05, 'wood', C(0x5a4632), NC);
      this.boxMM(b, x0 + 0.1, 0.3, z0 + 0.1, x1 - 0.1, 0.34, z1 - 0.1, 'wood', C(0x6b5038), NC);
      this.range.tables.push({ x0: t.x + x0, x1: t.x + x1, z: t.z + (z0 + z1) / 2, y: y + 0.94 });
    }
    // 부착물 전용 테이블: 기존 사격대 뒤쪽, 두 줄로 정돈한다.
    const ax0=-6,ax1=6,az0=FL+6.2,az1=FL+8.2;
    this.boxMM(b,ax0,.86,az0,ax1,.94,az1,'wood',wood);
    for(const x of [ax0+.12,ax1-.12])for(const z of [az0+.12,az1-.12])this.boxMM(b,x-.05,.06,z-.05,x+.05,.86,z+.05,'wood',C(0x5a4632),NC);
    this.range.attachmentTable={x0:t.x+ax0,x1:t.x+ax1,z0:t.z+az0,z1:t.z+az1,y:y+.94};
    // 흙벽 (뒤쪽 탄 받이, 양옆)
    this.boxMM(b, -42, -1, -82, 42, 7.5, -75, 'sandbag', bag);
    this.boxMM(b, -42, -1, -75, -38, 3.6, FL - 2, 'sandbag', bag);
    this.boxMM(b, 38, -1, -75, 42, 3.6, FL - 2, 'sandbag', bag);
    // 움직이는 표적 레일 (20m · 40m · 60m)
    this.range.rails = [];
    for (const d of [20, 40, 60]) {
      const z = FL - d;
      this.boxMM(b, -17, 0.02, z - 0.06, 17, 0.12, z + 0.06, 'metal', dark, NC);
      this.boxMM(b, -17.4, 0, z - 0.5, -16.6, 1.0, z + 0.5, 'concrete', conc, NC);
      this.boxMM(b, 16.6, 0, z - 0.5, 17.4, 1.0, z + 0.5, 'concrete', conc, NC);
      this.range.rails.push({ z: t.z + z, d });
    }
    // 거리 표지 기둥 (숫자는 훈련 모드에서 붙인다)
    for (const d of [10, 25, 50, 75, 100]) this.boxMM(b, -36.1, 0, FL - d - 0.1, -35.9, 1.8, FL - d + 0.1, 'wood', wood, NC);
    // 나무·집이 들어오지 않게 영역 표시
    if (G.RangeProps) G.RangeProps.build(this, b, FL);
    this.footprints.push({ minX: t.x - 16, maxX: t.x + 16, minZ: t.z + FL, maxZ: t.z + FL + 10, kind: 'pad' });   // 사격대 바닥 (포장, 풀 없음)
    this.footprints.push({ minX: t.x - 44, maxX: t.x + 44, minZ: t.z - 84, maxZ: t.z + FL + 16, kind: 'range' });
  },
  genWild() {
    const r = this.rnd;
    const inTown = (x, z, pad) => this.towns.some(t => Math.hypot(x - t.x, z - t.z) < t.r + pad);
    this.wildHouses = [];
    const tryWild = (kind, count, slope, pad, minH, maxH) => {
      let placed = 0;
      for (let i = 0; i < count * 60 && placed < count; i++) {
        const x = (r() - 0.5) * 820 * MK, z = (r() - 0.5) * 820 * MK;
        if (Math.hypot(x, z) > 420 * MK || inTown(x, z, pad)) continue;
        const h = this.heightAt(x, z);
        if (h < (minH || 2.5) || h > (maxH || 200)) continue;
        if (this.place(kind, x, z, Math.floor(r() * 4), { maxSlope: slope, margin: 6 })) { placed++; this.wildHouses.push({ x, z, kind }); }
      }
    };
    // 외딴 농가 무리 (집 + 헛간 + 창고)
    for (let n = 0; n < 24; n++) {
      for (let i = 0; i < 60; i++) {
        const x = (r() - 0.5) * 760 * MK, z = (r() - 0.5) * 760 * MK;
        if (Math.hypot(x, z) > 400 * MK || inTown(x, z, 60)) continue;
        const h = this.heightAt(x, z); if (h < 3 || h > 45) continue;
        let ok = 0;
        if (this.place('house1', x, z, Math.floor(r() * 4), { maxSlope: 1.0, margin: 5 })) { ok++; this.wildHouses.push({ x, z, kind: 'house1' }); }
        else continue;
        for (const k of ['shed', r() < 0.5 ? 'barn' : 'house2', 'hay']) for (let j = 0; j < 12; j++) { const a = r() * 6.28, d = 16 + r() * 14; if (this.place(k, x + Math.cos(a) * d, z + Math.sin(a) * d, Math.floor(r() * 4), { maxSlope: 1.4, margin: 3 })) { ok++; break; } }
        break;
      }
    }
    // 작은 마을(집 3~6채)을 마을 사이 빈 땅에 고르게 흩뿌린다: 섬을 격자로 나눠 칸마다 한 번씩 시도
    const cells = 9, cs = 820 * MK / cells;
    for (let gz = 0; gz < cells; gz++) for (let gx = 0; gx < cells; gx++) {
      if (r() < 0.12) continue;
      for (let i = 0; i < 40; i++) {
        const x = (gx + 0.15 + r() * 0.7) * cs - 410 * MK, z = (gz + 0.15 + r() * 0.7) * cs - 410 * MK;
        if (Math.hypot(x, z) > 410 * MK || inTown(x, z, 55)) continue;
        const h = this.heightAt(x, z); if (h < 3 || h > 90) continue;
        const kinds = ['house1', r() < 0.5 ? 'house2' : 'house1', 'shed', r() < 0.6 ? 'house1' : 'cabin', r() < 0.5 ? 'house2' : 'shed', 'house1'];
        const want = 3 + Math.floor(r() * 4);
        let n = 0;
        for (let k = 0; k < kinds.length && n < want; k++) {
          for (let j = 0; j < 10; j++) {
            const a = r() * 6.28, d = n === 0 ? 0 : 13 + r() * 18;
            const hx = x + Math.cos(a) * d, hz = z + Math.sin(a) * d;
            if (this.place(kinds[k], hx, hz, Math.floor(r() * 4), { maxSlope: 1.6, margin: 4 })) { if (n === 0) this.wildHouses.push({ x: hx, z: hz, kind: kinds[k] }); n++; break; }
          }
        }
        if (n > 0) break;
      }
    }
    tryWild('house1', 90, 1.2, 28);
    tryWild('shed', 40, 0.8, 25);
    tryWild('house2', 45, 1.0, 28);
    tryWild('cabin', 55, 1.8, 20, 12, 120);
    tryWild('ruins', 40, 2.5, 20);
    tryWild('tower', 12, 1.5, 20);
    tryWild('sandbags', 20, 2.0, 15);
    tryWild('containers', 12, 0.8, 20);
    // 버려진 자동차
    for (let i = 0; i < 36; i++) {
      const road = U.pick(this.roads), tt = 0.15 + r() * 0.7;
      const ang = Math.atan2(road.bz - road.az, road.bx - road.ax);
      const x = U.lerp(road.ax, road.bx, tt) + Math.cos(ang + Math.PI / 2) * (r() - 0.5) * 6;
      const z = U.lerp(road.az, road.bz, tt) + Math.sin(ang + Math.PI / 2) * (r() - 0.5) * 6;
      if (inTown(x, z, 5)) continue;
      this.place('car', x, z, Math.floor(r() * 4), { margin: 2 });
    }
  },

  // 흙길: 외딴 집에서 가장 가까운 도로까지, 그리고 숲·산을 지나는 오솔길
  genPaths() {
    const r = this.rnd, nz = this.noise;
    this.paths = [];
    const nearestRoad = (x, z) => {
      let best = null, bd = 1e9;
      for (const rd of this.roads) {
        const dx = rd.bx - rd.ax, dz = rd.bz - rd.az, l2 = dx * dx + dz * dz;
        const t = U.clamp(((x - rd.ax) * dx + (z - rd.az) * dz) / l2, 0, 1);
        const px = rd.ax + dx * t, pz = rd.az + dz * t, d = Math.hypot(x - px, z - pz);
        if (d < bd) { bd = d; best = { x: px, z: pz, d }; }
      }
      return best;
    };
    const wet = (x, z) => this.heightAt(x, z) < this.waterAt(x, z) + 0.4;
    const addPath = (ax, az, bx, bz, w) => {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(L / 6)), pts = [];
      const seed = r() * 100;
      for (let i = 0; i <= n; i++) {
        const t = i / n, x0 = U.lerp(ax, bx, t), z0 = U.lerp(az, bz, t);
        const off = nz.noise2(seed + t * L / 90, 3.3) * Math.min(18, L * 0.12) * Math.sin(Math.PI * t);
        const x = x0 + (-(bz - az) / L) * off, z = z0 + ((bx - ax) / L) * off;
        if (wet(x, z)) return false;
        pts.push([x, z]);
      }
      this.paths.push({ pts, w: w || 2.6 });
      return true;
    };
    for (const h of this.wildHouses) {
      const nr = nearestRoad(h.x, h.z);
      if (nr && nr.d > 14 && nr.d < 260) addPath(h.x, h.z, nr.x, nr.z, 2.6);
    }
    // 오솔길: 마을과 마을 사이 도로가 없는 곳
    const T = this.towns.filter(t => t.type !== 'range');
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
      const d = Math.hypot(T[i].x - T[j].x, T[i].z - T[j].z);
      if (d > 420 || d < 120) continue;
      const linked = this.roads.some(rd => (Math.hypot(rd.ax - T[i].x, rd.az - T[i].z) < 5 && Math.hypot(rd.bx - T[j].x, rd.bz - T[j].z) < 5) || (Math.hypot(rd.ax - T[j].x, rd.az - T[j].z) < 5 && Math.hypot(rd.bx - T[i].x, rd.bz - T[i].z) < 5));
      if (!linked && r() < 0.55) addPath(T[i].x, T[i].z, T[j].x, T[j].z, 3.2);
    }
  },

  /* -------------------------------------------------------------- */
  /* 지형 텍스처 / 메시                                               */
  /* -------------------------------------------------------------- */
  paintTerrain() {
    const nz = this.noise;
    const splat = document.createElement('canvas'); splat.width = splat.height = TS;
    const map = document.createElement('canvas'); map.width = map.height = TS;
    const MS = 512;
    const mask = document.createElement('canvas'); mask.width = mask.height = MS;
    const sctx = splat.getContext('2d'), mctx = map.getContext('2d'), kctx = mask.getContext('2d');
    const simg = sctx.createImageData(TS, TS), mimg = mctx.createImageData(TS, TS), kimg = kctx.createImageData(MS, MS);
    const sd = simg.data, md = mimg.data, kd = kimg.data;
    // 실사 지형 레이어 가중치: R 흙, G 모래, B 바위, A 포장(도로·건물 바닥)
    const wt = new Uint8Array(TS * TS * 4);
    const nrm = new THREE.Vector3();
    const mix = (a, b, t, o) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
    const grassA = [58, 77, 38], grassB = [82, 96, 48], dry = [138, 126, 76], litter = [72, 68, 44], dirt = [112, 92, 66], sand = [200, 184, 140], rock = [112, 110, 104], seabed = [96, 104, 88];
    const c = [0, 0, 0];
    for (let py = 0; py < TS; py++) {
      const z = (py + 0.5) / TS * SIZE - HALF;
      for (let px = 0; px < TS; px++) {
        const x = (px + 0.5) / TS * SIZE - HALF;
        const h = this.heightAt(x, z), wl = this.waterAt(x, z), hw = h - wl;
        this.normalAt(x, z, nrm);
        const slope = 1 - nrm.y;
        const n1 = nz.noise2(x * 0.011, z * 0.011);
        const n2 = nz.noise2(x * 0.0045 + 40, z * 0.0045);
        const n3 = nz.noise2(x * 0.03 - 9, z * 0.03 + 3);
        mix(grassA, grassB, n1 * 0.5 + 0.5, c);
        mix(c, dry, U.smoothstep(0.1, 0.8, n2) * 0.6, c);
        // 숲 바닥: 낙엽·그늘로 어둡고 갈색
        const forest = U.smoothstep(0.5, 0.72, nz.fbm(x * 0.006 + 300, z * 0.006 - 120, 3) * 0.5 + 0.5);
        mix(c, litter, forest * 0.55, c);
        const dirtW = U.smoothstep(0.45, 0.75, n3 * 0.6 + n1 * 0.4);
        mix(c, dirt, dirtW * 0.8, c);
        const sandW = wl > 0.05 ? U.smoothstep(1.6, 0.5, hw) * 0.85 : U.smoothstep(2.8, 1.2, hw);
        mix(c, sand, sandW, c);
        const rockW = Math.max(U.smoothstep(0.22, 0.42, slope), U.smoothstep(78, 100, h) * 0.8);
        mix(c, rock, rockW, c);
        if (hw < -0.3) mix(c, seabed, U.smoothstep(-0.3, -3, hw), c);
        const jit = (Math.random() - 0.5) * 8;
        const i = (py * TS + px) * 4;
        sd[i] = c[0] + jit; sd[i + 1] = c[1] + jit; sd[i + 2] = c[2] + jit; sd[i + 3] = 255;
        wt[i] = dirtW * 0.8 * 255; wt[i + 1] = sandW * 255; wt[i + 2] = rockW * 255;
        // 지도 색상
        if (hw < 0) {
          const dpt = U.clamp(-hw / 14, 0, 1);
          md[i] = 52 - dpt * 30; md[i + 1] = 110 - dpt * 45; md[i + 2] = 140 - dpt * 40;
        } else {
          const shade = U.clamp(0.75 + (nrm.x - nrm.z) * 1.6 + h * 0.006, 0.5, 1.25);
          md[i] = c[0] * shade; md[i + 1] = c[1] * shade; md[i + 2] = c[2] * shade;
        }
        md[i + 3] = 255;
        // 풀 마스크
        if ((px & 1) === 0 && (py & 1) === 0) {
          const g = (1 - sandW) * (1 - rockW) * (1 - dirtW * 0.9) * (1 - forest * 0.45) * (hw > 0.8 ? 1 : 0);
          const k = ((py >> 1) * MS + (px >> 1)) * 4;
          kd[k] = kd[k + 1] = kd[k + 2] = U.clamp(g * 255, 0, 255); kd[k + 3] = 255;
        }
      }
    }
    sctx.putImageData(simg, 0, 0); mctx.putImageData(mimg, 0, 0); kctx.putImageData(kimg, 0, 0);
    const s = TS / SIZE, ks = MS / SIZE;
    const toC = (x, sc) => (x + HALF) * sc;
    // 마을 땅 (사격장은 풀밭 그대로)
    for (const t of this.towns) {
      if (t.type === 'range') continue;
      for (const [ctx, sc, col] of [[sctx, s, 'rgba(132,118,96,'], [mctx, s, 'rgba(150,138,118,']]) {
        const g = ctx.createRadialGradient(toC(t.x, sc), toC(t.z, sc), 0, toC(t.x, sc), toC(t.z, sc), (t.r + 12) * sc);
        g.addColorStop(0, col + '0.75)'); g.addColorStop(0.7, col + '0.55)'); g.addColorStop(1, col + '0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(toC(t.x, sc), toC(t.z, sc), (t.r + 12) * sc, 0, Math.PI * 2); ctx.fill();
      }
      const g = kctx.createRadialGradient(toC(t.x, ks), toC(t.z, ks), 0, toC(t.x, ks), toC(t.z, ks), (t.r + 6) * ks);
      g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      kctx.fillStyle = g; kctx.beginPath(); kctx.arc(toC(t.x, ks), toC(t.z, ks), (t.r + 6) * ks, 0, Math.PI * 2); kctx.fill();
    }
    // 도로
    const drawRoads = (ctx, sc, edge, asph, line) => {
      ctx.lineCap = 'round';
      for (const r of this.roads) { ctx.strokeStyle = edge; ctx.lineWidth = (r.w + 2.5) * sc; ctx.beginPath(); ctx.moveTo(toC(r.ax, sc), toC(r.az, sc)); ctx.lineTo(toC(r.bx, sc), toC(r.bz, sc)); ctx.stroke(); }
      for (const r of this.roads) { ctx.strokeStyle = asph; ctx.lineWidth = r.w * sc; ctx.beginPath(); ctx.moveTo(toC(r.ax, sc), toC(r.az, sc)); ctx.lineTo(toC(r.bx, sc), toC(r.bz, sc)); ctx.stroke(); }
      if (line) {
        ctx.setLineDash([3 * sc, 4 * sc]); ctx.strokeStyle = line; ctx.lineWidth = 0.25 * sc;
        for (const r of this.roads) { ctx.beginPath(); ctx.moveTo(toC(r.ax, sc), toC(r.az, sc)); ctx.lineTo(toC(r.bx, sc), toC(r.bz, sc)); ctx.stroke(); }
        ctx.setLineDash([]);
      }
    };
    // 흙길
    const drawPaths = (ctx, sc, col, wk) => {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col;
      for (const pth of this.paths || []) {
        ctx.lineWidth = pth.w * sc * (wk || 1); ctx.beginPath();
        pth.pts.forEach((p, i) => i ? ctx.lineTo(toC(p[0], sc), toC(p[1], sc)) : ctx.moveTo(toC(p[0], sc), toC(p[1], sc)));
        ctx.stroke();
      }
    };
    drawPaths(sctx, s, 'rgba(118,98,70,0.75)');
    drawPaths(mctx, s, 'rgba(150,128,96,0.8)', 1.4);
    drawPaths(kctx, ks, 'rgba(0,0,0,0.85)', 0.8);
    drawRoads(sctx, s, 'rgba(120,104,80,0.85)', '#55524d', 'rgba(230,210,140,0.7)');
    drawRoads(mctx, s, 'rgba(110,100,85,0.9)', '#6d6a64', null);
    drawRoads(kctx, ks, '#000', '#000', null);
    // 다리 (지도)
    for (const br of this.bridges || []) {
      mctx.strokeStyle = '#7a776f'; mctx.lineWidth = (br.w + 1) * s; mctx.lineCap = 'butt';
      mctx.beginPath(); mctx.moveTo(toC(br.x - br.ux * br.half, s), toC(br.z - br.uz * br.half, s)); mctx.lineTo(toC(br.x + br.ux * br.half, s), toC(br.z + br.uz * br.half, s)); mctx.stroke();
    }
    // 건물 바닥
    const noPad = ['car', 'sandbags', 'hay', 'ruins', 'tower'];
    for (const f of this.footprints) {
      if (f.kind === 'range') continue;   // 사격장 영역은 풀밭 그대로
      if (!noPad.includes(f.kind)) {
        sctx.fillStyle = 'rgba(150,146,138,0.95)';
        sctx.fillRect(toC(f.minX - 1, s), toC(f.minZ - 1, s), (f.maxX - f.minX + 2) * s, (f.maxZ - f.minZ + 2) * s);
      }
      mctx.fillStyle = f.kind === 'car' ? 'rgba(80,80,80,0.6)' : 'rgba(58,58,62,0.95)';
      mctx.fillRect(toC(f.minX, s), toC(f.minZ, s), (f.maxX - f.minX) * s, (f.maxZ - f.minZ) * s);
      kctx.fillStyle = '#000';
      kctx.fillRect(toC(f.minX - 1.5, ks), toC(f.minZ - 1.5, ks), (f.maxX - f.minX + 3) * ks, (f.maxZ - f.minZ + 3) * ks);
    }
    this.splatCanvas = splat; this.mapCanvas = map; this.maskCanvas = mask;
    // 마을 흙바닥·도로 갓길(흙)과 포장 마스크를 따로 그려 가중치에 합친다
    const gray = () => { const cv = document.createElement('canvas'); cv.width = cv.height = TS; const x = cv.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#000'; x.fillRect(0, 0, TS, TS); return x; };
    const tctx = gray(), pctx = gray();
    for (const t of this.towns) {
      if (t.type === 'range') continue;
      const g = tctx.createRadialGradient(toC(t.x, s), toC(t.z, s), 0, toC(t.x, s), toC(t.z, s), (t.r + 12) * s);
      g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(0.7, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      tctx.fillStyle = g; tctx.beginPath(); tctx.arc(toC(t.x, s), toC(t.z, s), (t.r + 12) * s, 0, Math.PI * 2); tctx.fill();
    }
    drawPaths(tctx, s, 'rgba(255,255,255,0.9)', 1.1);
    drawRoads(tctx, s, '#fff', '#fff', null);
    drawRoads(pctx, s, '#000', '#fff', null);
    for (const f of this.footprints) {
      if (noPad.includes(f.kind) || f.kind === 'range') continue;
      pctx.fillStyle = 'rgba(255,255,255,0.85)';
      pctx.fillRect(toC(f.minX - 1, s), toC(f.minZ - 1, s), (f.maxX - f.minX + 2) * s, (f.maxZ - f.minZ + 2) * s);
    }
    const td = tctx.getImageData(0, 0, TS, TS).data, pd = pctx.getImageData(0, 0, TS, TS).data;
    for (let i = 0; i < wt.length; i += 4) {
      const d = wt[i] / 255, t = td[i] / 255;
      wt[i] = (1 - (1 - d) * (1 - t * 0.85)) * 255;
      wt[i + 3] = pd[i];
    }
    const wtex = this.terrainW = new THREE.DataTexture(wt, TS, TS, THREE.RGBAFormat);
    wtex.magFilter = THREE.LinearFilter; wtex.minFilter = THREE.LinearMipmapLinearFilter; wtex.generateMipmaps = true;
    wtex.wrapS = wtex.wrapT = THREE.ClampToEdgeWrapping; wtex.needsUpdate = true;
  },
  buildTerrainMesh() {
    // 지형을 64칸(200m) 청크로 나누고, 청크마다 해상도 5단계(1·2·4·8·16칸 간격)를 미리 만든다.
    // 카메라에서 먼 청크일수록 성긴 단계를 쓰고(updateTerrainLOD), 단계가 다른 청크 사이 틈은 아래로 내린 '치마'로 가린다
    const H = this.heights;
    const nrm = new Float32Array(N * N * 3);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const hl = H[iz * N + Math.max(0, ix - 1)], hr = H[iz * N + Math.min(RES, ix + 1)];
      const hd = H[Math.max(0, iz - 1) * N + ix], hu = H[Math.min(RES, iz + 1) * N + ix];
      let nx = hl - hr, ny = 2 * CELL, nz = hd - hu;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (iz * N + ix) * 3; nrm[i] = nx; nrm[i + 1] = ny; nrm[i + 2] = nz;
    }
    const CH = 64, NCH = RES / CH, STEPS = [1, 2, 4, 8, 16];
    const makeLod = (cx, cz, st) => {
      const n = CH / st + 1, ix0 = cx * CH, iz0 = cz * CH;
      const skirtN = 4 * (n - 1);
      const vc = n * n + skirtN * 2;
      const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), uv1 = new Float32Array(vc * 2);
      let v = 0;
      const put = (ix, iz, dy) => {
        const gi = iz * N + ix, x = ix * CELL - HALF, z = iz * CELL - HALF;
        pos[v * 3] = x; pos[v * 3 + 1] = H[gi] - dy; pos[v * 3 + 2] = z;
        nor[v * 3] = nrm[gi * 3]; nor[v * 3 + 1] = nrm[gi * 3 + 1]; nor[v * 3 + 2] = nrm[gi * 3 + 2];
        uv[v * 2] = ix / RES; uv[v * 2 + 1] = iz / RES; uv1[v * 2] = x / 4; uv1[v * 2 + 1] = z / 4;
        return v++;
      };
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put(ix0 + i * st, iz0 + j * st, 0);
      const idx = [];
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b2 = (j + 1) * n + i, c = b2 + 1, d = a + 1;
        idx.push(a, b2, d, b2, c, d);
      }
      // 치마: 가장자리를 따라 아래로 내린 띠 (앞뒤 양면)
      const drop = 1.5 + st * 1.2;
      const ring = [];
      for (let i = 0; i < n - 1; i++) ring.push([i, 0]);
      for (let j = 0; j < n - 1; j++) ring.push([n - 1, j]);
      for (let i = n - 1; i > 0; i--) ring.push([i, n - 1]);
      for (let j = n - 1; j > 0; j--) ring.push([0, j]);
      const top = ring.map(([i, j]) => j * n + i), bot = ring.map(([i, j]) => put(ix0 + i * st, iz0 + j * st, drop));
      for (let k = 0; k < ring.length; k++) {
        const k2 = (k + 1) % ring.length, a = top[k], b2 = top[k2], c = bot[k2], d = bot[k];
        idx.push(a, d, b2, b2, d, c, a, b2, d, b2, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, v * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv.subarray(0, v * 2), 2));
      g.setAttribute('uv1', new THREE.BufferAttribute(uv1.subarray(0, v * 2), 2));
      g.setIndex(idx);
      g.computeBoundingSphere();
      return g;
    };
    const splatTex = new THREE.CanvasTexture(this.splatCanvas);
    splatTex.flipY = false; splatTex.colorSpace = THREE.SRGBColorSpace; splatTex.anisotropy = 8;
    splatTex.wrapS = splatTex.wrapT = THREE.ClampToEdgeWrapping;
    const mat = this.terrainMaterial(splatTex) || this.terrainMaterialProc(splatTex);
    this.terrainChunks = [];
    const grp = new THREE.Group();
    for (let cz = 0; cz < NCH; cz++) for (let cx = 0; cx < NCH; cx++) {
      const lods = STEPS.map(st => makeLod(cx, cz, st));
      const mesh = new THREE.Mesh(lods[STEPS.length - 1], mat);
      mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      grp.add(mesh);
      this.terrainChunks.push({ mesh, lods, lod: STEPS.length - 1, x0: cx * CH * CELL - HALF, z0: cz * CH * CELL - HALF, x1: (cx + 1) * CH * CELL - HALF, z1: (cz + 1) * CH * CELL - HALF });
    }
    this.scene.add(grp);
    this.terrain = grp;
    this.terrainMat = mat;
    // 단계 경계 거리 (품질에 따라 배율)
    this.terrainLodDist = [140, 330, 650, 1000];
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a4a44, roughness: 1 }));
    sea.position.y = -15; sea.matrixAutoUpdate = false; sea.updateMatrix();
    this.scene.add(sea);
  },
  // 기존 절차적 지형 재질 (실사 에셋이 없을 때)
  terrainMaterialProc(splatTex) {
    const hN = G.Tex.tileNoise(256, 8, 5, 91), aN = G.Tex.tileNoise(256, 4, 5, 17);
    const detail = G.Tex.normalMap(hN, 256, 9, aN);
    detail.channel = 1;
    const mat = new THREE.MeshStandardMaterial({ map: splatTex, normalMap: detail, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.96, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n float dtl = texture2D(normalMap, vNormalMapUv).a;\n diffuseColor.rgb *= mix(0.7, 1.25, dtl);');
    };
    return mat;
  },
  // 실사 지형 재질: 풀/흙/모래/바위/아스팔트 사진 텍스처를 가중치 맵으로 섞고, 원래 색 지도(splat)로 넓은 범위의 색 변화를 준다
  terrainMaterial(splatTex) {
    const A = G.Assets;
    if (!A || !A.enabled) return null;
    const L = ['grass', 'dirt', 'sand', 'rock', 'asphalt'];
    for (const k of L) if (!A.tex[k] || !A.tex[k].normal) return null;
    const lin = (r, g, b) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    const gN = A.tex.grass.normal.clone(); gN.channel = 1; gN.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map: splatTex, normalMap: gN, normalScale: new THREE.Vector2(1, 1), roughness: 1, metalness: 0 });
    const U2 = {
      tW: { value: this.terrainW },
      tGrassD: { value: A.tex.grass.map }, tDirtD: { value: A.tex.dirt.map }, tDirtN: { value: A.tex.dirt.normal },
      tSandD: { value: A.tex.sand.map }, tSandN: { value: A.tex.sand.normal }, tRockD: { value: A.tex.rock.map }, tRockN: { value: A.tex.rock.normal },
      tAsphD: { value: A.tex.asphalt.map }, tAsphN: { value: A.tex.asphalt.normal },
      // 원래 색 지도의 레이어별 기준색 (색 지도 / 기준색 = 넓은 범위 색 변화)
      uRefG: { value: lin(75, 95, 42) }, uRefD: { value: lin(118, 100, 76) }, uRefS: { value: lin(200, 184, 140) },
      uRefR: { value: lin(112, 110, 104) }, uRefA: { value: lin(105, 101, 95) },
      // 사진 텍스처 평균색으로 나눠 밝기를 맞춘 뒤 이 색을 곱한다
      uMeanG: { value: A.tex.grass.mean }, uMeanD: { value: A.tex.dirt.mean }, uMeanS: { value: A.tex.sand.mean },
      uMeanR: { value: A.tex.rock.mean }, uMeanA: { value: A.tex.asphalt.mean }
    };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U2);
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
        uniform sampler2D tW, tGrassD, tDirtD, tDirtN, tSandD, tSandN, tRockD, tRockN, tAsphD, tAsphN;
        uniform vec3 uRefG, uRefD, uRefS, uRefR, uRefA, uMeanG, uMeanD, uMeanS, uMeanR, uMeanA;
        float tLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
        // 높이 기반 경계: 중간 가중치를 텍스처 밝기로 흔들어 자연스러운 경계를 만든다
        float tHB(float w, float hgt) { return smoothstep(0.0, 1.0, clamp(w + (hgt - 0.5) * 2.4 * w * (1.0 - w), 0.0, 1.0)); }
        vec3 tNrm(sampler2D t, vec2 uv) { return texture2D(t, uv).xyz * 2.0 - 1.0; }`)
      .replace('#include <map_fragment>', `
        vec3 splatC = texture2D(map, vMapUv).rgb;
        vec4 tw = texture2D(tW, vMapUv);
        vec2 tuv = vNormalMapUv;                 // 월드 좌표 / 4m
        vec2 uvG = tuv * 1.6, uvD = tuv * 1.25, uvS = tuv * 1.1, uvR = tuv * 0.45, uvA = tuv * 0.9;
        // 풀은 두 배율을 섞어 반복 무늬를 줄인다
        vec3 cG = mix(texture2D(tGrassD, uvG).rgb, texture2D(tGrassD, tuv * 0.37 + 0.31).rgb, 0.45) / max(uMeanG, vec3(0.01));
        vec3 cD = texture2D(tDirtD, uvD).rgb / max(uMeanD, vec3(0.01));
        vec3 cS = texture2D(tSandD, uvS).rgb / max(uMeanS, vec3(0.01));
        vec3 cR = texture2D(tRockD, uvR).rgb / max(uMeanR, vec3(0.01));
        vec3 cA = texture2D(tAsphD, uvA).rgb / max(uMeanA, vec3(0.01));
        float wD = tHB(tw.r, tLum(cD) * 0.5), wS = tHB(tw.g, tLum(cS) * 0.5), wR = tHB(tw.b, tLum(cR) * 0.5), wA = smoothstep(0.25, 0.75, tw.a);
        // 레이어 순서: 풀 → 흙 → 모래 → 바위 → 포장
        vec3 det = mix(mix(mix(mix(cG, cD, wD), cS, wS), cR, wR), cA, wA);
        // 색 지도는 원래 부드러운 경계라, 같은 부드러운 가중치의 기준색으로 나눠 '색 변화'만 뽑아낸다 (경계 번짐 방지)
        vec3 refSoft = mix(mix(mix(mix(uRefG, uRefD, tw.r), uRefS, tw.g), uRefR, tw.b), uRefA, tw.a);
        vec3 ref = mix(mix(mix(mix(uRefG, uRefD, wD), uRefS, wS), uRefR, wR), uRefA, wA);
        vec3 macro = ref * mix(vec3(1.0), clamp(splatC / max(refSoft, vec3(0.02)), 0.7, 1.35), 0.8);
        diffuseColor.rgb *= clamp(macro * mix(vec3(1.0), det, 0.85), 0.0, 1.0);
        vec3 nG = tNrm(normalMap, uvG), nD = tNrm(tDirtN, uvD), nS = tNrm(tSandN, uvS), nR = tNrm(tRockN, uvR), nA = tNrm(tAsphN, uvA);
        vec3 terrainN = normalize(mix(mix(mix(mix(nG, nD, wD), nS, wS), nR, wR), nA, wA));
        float terrainR = mix(mix(mix(mix(0.97, 0.95, wD), 0.92, wS), 0.86, wR), 0.82, wA);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = terrainR;')
      .replace('#include <normal_fragment_maps>', `
        vec3 mapN = terrainN;
        mapN.xy *= normalScale;
        normal = normalize( tbn * mapN );`);
    };
    return mat;
  },
  buildSkyWater() {
    const sky = this.sky = new THREE.Sky();
    sky.scale.setScalar(20000);
    this.scene.add(sky);
    const hemi = this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5d5140, 1.0);
    this.scene.add(hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 1; sc.far = 900;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
    this.scene.add(sun); this.scene.add(sun.target);
    this.sunDir = new THREE.Vector3(0.5, 0.6, 0.3).normalize();
    // 물
    const wh = G.Tex.tileNoise(256, 6, 4, 77);
    const wn = this.waterNormal = G.Tex.normalMap(wh, 256, 5);
    wn.repeat.set(500, 500);
    const water = this.water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1d5a70, roughness: 0.06, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.3, 0.3), transparent: true, opacity: 0.84 }));
    water.position.y = this.WATER;
    water.matrixAutoUpdate = false; water.updateMatrix();
    water.renderOrder = 1;
    this.scene.add(water);
    this.buildInlandWater(water.material);
    // 구름
    const cloudTex = G.Tex.canvas(256, 128, (c, w, h) => {
      for (let i = 0; i < 26; i++) {
        const x = w * 0.2 + Math.random() * w * 0.6, y = h * 0.35 + Math.random() * h * 0.3, r = 20 + Math.random() * 35;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }
    }, { clamp: true });
    this.clouds = [];
    const cr = U.mulberry32(5);
    const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.75 });
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(cloudMat);
      s.position.set((cr() - 0.5) * 3000, 420 + cr() * 180, (cr() - 0.5) * 3000);
      s.scale.set(420 + cr() * 380, 150 + cr() * 90, 1);
      this.scene.add(s); this.clouds.push(s);
    }
  },
  // 호수·강 수면 (바다와 같은 재질, 바다와 같은 UV 배율)
  buildInlandWater(mat) {
    const uvOf = (x, z) => [(x + 3000) / 6000, 1 - (z + 3000) / 6000];
    const add = (pos, uv, idx) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.setIndex(idx); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); m.renderOrder = 1; m.matrixAutoUpdate = false; m.receiveShadow = true;
      this.scene.add(m);
    };
    for (const L of this.lakes) {
      const pos = [L.cx, L.level, L.cz], uv = uvOf(L.cx, L.cz), idx = [], seg = 64, R = L.ext + 12;
      for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2, x = L.cx + Math.cos(a) * R, z = L.cz + Math.sin(a) * R; pos.push(x, L.level, z); uv.push(...uvOf(x, z)); if (i) idx.push(0, i + 1, i); }
      add(pos, uv, idx);
    }
    for (const R of this.rivers) {
      let pos = [], uv = [], idx = [], n = 0;
      const flush = () => { if (n > 1) add(pos, uv, idx); pos = []; uv = []; idx = []; n = 0; };
      const P = R.pts;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        if (p.level <= 0.12) { flush(); continue; }
        const q = P[Math.min(P.length - 1, i + 1)], o = P[Math.max(0, i - 1)];
        let dx = q.x - o.x, dz = q.z - o.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        const w = p.w + 4;
        const lx = p.x - dz * w, lz = p.z + dx * w, rx = p.x + dz * w, rz = p.z - dx * w;
        pos.push(lx, p.level, lz, rx, p.level, rz); uv.push(...uvOf(lx, lz), ...uvOf(rx, rz));
        if (n) { const b = (n - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }   // 위를 향하는 면
        n++;
      }
      flush();
    }
  },
  setTimeOfDay(tod) {
    if (tod === 'random') tod = U.pick(['day', 'day', 'sunset', 'night', 'fog', 'rain']);
    if (this.tod === tod && this.envRT) return; // 같은 시간대면 환경맵 재생성(끊김) 생략
    this.tod = tod;
    // 시간대·날씨: 밤·안개·비는 사진 하늘 대신 계산한 하늘을 쓴다. vis = 봇 시야 배율
    const PRESET = {
      day:    { elev: 38, az: 145, turb: 5, ray: 1.4, mie: 0.004, sunC: 0xffeed8, sunI: 3.2, hemiS: 0xc8dcff, hemiG: 0x5a4c38, hemiI: 1.0, fog: 0xb7cde0, fogD: 0.0017, exp: 0.6, cloud: 0xffffff, vis: 1 },
      sunset: { elev: 6, az: 250, turb: 8, ray: 2.6, mie: 0.006, sunC: 0xffa868, sunI: 2.7, hemiS: 0x9eb4d8, hemiG: 0x5a4030, hemiI: 0.75, fog: 0xc9a58e, fogD: 0.002, exp: 0.62, cloud: 0xffc8a8, vis: 1 },
      night:  { elev: 42, az: 210, skyElev: -9, turb: 2, ray: 0.35, mie: 0.002, sunC: 0x9fb6e6, sunI: 1.5, hemiS: 0x6478a8, hemiG: 0x1c222e, hemiI: 1.5, fog: 0x101824, fogD: 0.0038, exp: 0.62, cloud: 0x202838, vis: 0.5, noCloud: true },
      fog:    { elev: 30, az: 145, turb: 18, ray: 0.9, mie: 0.02, sunC: 0xe8e4dc, sunI: 2.4, hemiS: 0xd4dce2, hemiG: 0x77736a, hemiI: 2.6, fog: 0xa9b3b8, fogD: 0.011, exp: 0.56, cloud: 0xd0d4d6, vis: 0.42, noCloud: true },
      rain:   { elev: 34, az: 160, turb: 20, ray: 0.7, mie: 0.02, sunC: 0xc4ccd6, sunI: 1.9, hemiS: 0xb4c0cc, hemiG: 0x5c5e58, hemiI: 2.3, fog: 0x7f8b96, fogD: 0.0048, exp: 0.54, cloud: 0x8a9098, vis: 0.75, noCloud: true }
    };
    const P = Object.assign({}, PRESET[tod] || PRESET.day);
    this.weather = tod; this.visK = P.vis;
    const phi = THREE.MathUtils.degToRad(90 - P.elev), theta = THREE.MathUtils.degToRad(P.az);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    // 실사 HDRI 하늘이 있으면 태양 방향·안개 색을 사진 하늘에 맞춘다
    const S = G.Assets && G.Assets.sky[tod];
    if (S) {
      this.sunDir.copy(S.sunDir);
      if (S.sunElev < 7) { this.sunDir.y = Math.tan(THREE.MathUtils.degToRad(7)) * Math.hypot(this.sunDir.x, this.sunDir.z); this.sunDir.normalize(); }
      P.fog = S.horizon.clone().multiplyScalar(0.92);
      P.hemiI *= 0.55;
    }
    const u = this.sky.material.uniforms;
    u.turbidity.value = P.turb; u.rayleigh.value = P.ray; u.mieCoefficient.value = P.mie; u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.copy(this.sunDir);
    // 밤: 하늘은 해가 진 상태로, 조명은 높이 뜬 달빛으로
    if (P.skyElev !== undefined) u.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - P.skyElev), theta);
    this.sun.color.setHex(P.sunC); this.sun.intensity = P.sunI;
    this.hemi.color.setHex(P.hemiS); this.hemi.groundColor.setHex(P.hemiG); this.hemi.intensity = P.hemiI;
    this.scene.fog = new THREE.FogExp2(P.fog, P.fogD);
    this.fogColor = new THREE.Color(P.fog); this.fogD = P.fogD;
    this.renderer.toneMappingExposure = P.exp;
    for (const c of this.clouds) { c.material.color.setHex(P.cloud); c.visible = !S && !P.noCloud; }
    this.sky.visible = !S;
    this.scene.background = S ? (S.bg || S.hdr) : null;
    this.scene.backgroundIntensity = S && S.bg ? G.Assets.BG_MAX : 1;
    // 환경맵
    const pm = new THREE.PMREMGenerator(this.renderer);
    if (this.envRT) this.envRT.dispose();
    if (S) {
      this.envRT = pm.fromEquirectangular(S.hdr);
    } else {
      const es = new THREE.Scene();
      const sky2 = new THREE.Sky(); sky2.scale.setScalar(1000);
      for (const k in u) if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = u[k].value;
      es.add(sky2);
      this.envRT = pm.fromScene(es, 0, 0.1, 2000);
    }
    this.scene.environment = this.envRT.texture;
    if (G.vmScene) G.vmScene.environment = this.envRT.texture;
    pm.dispose();
    this.syncGrassLight();
    if (G.FX) G.FX.setFog(this.fogColor, P.fogD);
    if (this.fogK && this.fogK !== 1) this.setFogScale(this.fogK);
  },

  /* -------------------------------------------------------------- */
  /* 식생                                                            */
  /* -------------------------------------------------------------- */
  colorize(g, hex, jitter) {
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    const c = new THREE.Color(hex);
    for (let i = 0; i < n; i += 3) {
      const j = jitter ? 1 + (Math.random() - 0.5) * jitter : 1;
      for (let k = 0; k < 3 && i + k < n; k++) { col[(i + k) * 3] = c.r * j; col[(i + k) * 3 + 1] = c.g * j; col[(i + k) * 3 + 2] = c.b * j; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (g.attributes.uv) g.deleteAttribute('uv');
    return g;
  },
  wobble(g, amt, freq, seed) {
    const p = g.attributes.position, nz = this.noise;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = nz.noise2(x * freq + seed + z * 0.7, y * freq - seed + z * 0.3);
      const s = 1 + n * amt;
      p.setXYZ(i, x * s, y + n * amt * 0.5, z * s);
    }
    g.computeVertexNormals();
    return g;
  },
  async genVegetation(progress) {
    const M = THREE.mergeGeometries;
    // 소나무
    const pine = [];
    pine.push(this.colorize(new THREE.CylinderGeometry(0.14, 0.26, 3.2, 7).toNonIndexed().translate(0, 1.6, 0), 0x5a4030, 0.2));
    const tiers = [[2.0, 2.3, 3.2, 0x2c5228], [3.4, 1.85, 2.9, 0x31592b], [4.7, 1.4, 2.6, 0x386431], [5.9, 0.95, 2.1, 0x3f6d35]];
    tiers.forEach(([y, r, h, c], i) => pine.push(this.colorize(this.wobble(new THREE.ConeGeometry(r, h, 9, 2).toNonIndexed().translate(0, y + h / 2, 0), 0.12, 0.9, i * 3), c, 0.25)));
    const pineGeo = M(pine);
    // 활엽수
    const oak = [];
    oak.push(this.colorize(new THREE.CylinderGeometry(0.16, 0.3, 3.4, 7).toNonIndexed().translate(0, 1.7, 0), 0x5e4834, 0.2));
    oak.push(this.colorize(new THREE.CylinderGeometry(0.06, 0.12, 1.6, 5).toNonIndexed().rotateZ(0.8).translate(0.55, 3.2, 0), 0x5e4834, 0.2));
    const blobs = [[0, 4.4, 0, 1.9, 0x4a7a2e], [1.2, 3.9, 0.5, 1.4, 0x55863a], [-1.1, 4.0, -0.4, 1.5, 0x4f7f33], [0.2, 5.3, -0.5, 1.3, 0x5d8f3e], [-0.3, 4.2, 1.1, 1.2, 0x527f35]];
    blobs.forEach(([x, y, z, r, c], i) => oak.push(this.colorize(this.wobble(new THREE.IcosahedronGeometry(r, 1), 0.18, 0.8, i * 7).translate(x, y, z), c, 0.3)));
    const oakGeo = M(oak);
    // 바위
    const rockGeo = this.colorize(this.wobble(new THREE.IcosahedronGeometry(1, 1), 0.28, 0.9, 3), 0x8a8780, 0.25);
    // 덤불
    const bushGeo = M([
      this.colorize(this.wobble(new THREE.IcosahedronGeometry(0.75, 1), 0.22, 1.4, 1).translate(0, 0.45, 0), 0x46702c, 0.3),
      this.colorize(this.wobble(new THREE.IcosahedronGeometry(0.55, 1), 0.22, 1.4, 2).translate(0.55, 0.35, 0.2), 0x507a32, 0.3)
    ]);
    const vegMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true });
    const windU = this.windTime = { value: 0 };
    vegMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = windU;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
        float sw = sin(uTime * 1.4 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.4;
        float k = max(0.0, position.y - 2.0);
        transformed.x += sw * 0.025 * k; transformed.z += sw * 0.015 * k;
        #endif`);
    };
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    // 실사 바위 텍스처 (UV가 없는 바위라 월드 좌표 3면 투영)
    const RA = G.Assets && G.Assets.tex.boulder;
    if (RA) {
      rockMat.roughness = 0.9;
      rockMat.onBeforeCompile = (sh) => {
        sh.uniforms.tRock = { value: RA.map }; sh.uniforms.uRockMean = { value: RA.mean };
        sh.vertexShader = 'varying vec3 vTPW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
          vec4 tpw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          tpw = instanceMatrix * tpw;
          #endif
          vTPW = (modelMatrix * tpw).xyz;`);
        sh.fragmentShader = 'varying vec3 vTPW;\nuniform sampler2D tRock;\nuniform vec3 uRockMean;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          vec3 tpn = abs(normalize(cross(dFdx(vTPW), dFdy(vTPW))));
          tpn = pow(tpn, vec3(4.0)); tpn /= (tpn.x + tpn.y + tpn.z);
          vec3 tps = vTPW * 0.35;
          vec3 rc = texture2D(tRock, tps.yz).rgb * tpn.x + texture2D(tRock, tps.xz).rgb * tpn.y + texture2D(tRock, tps.xy).rgb * tpn.z;
          diffuseColor.rgb *= rc / max(uRockMean, vec3(0.01)) * 0.9;`);
      };
    }
    // 배치
    const r = this.rnd, nz = this.noise, nrm = new THREE.Vector3();
    const list = { pine: [], oak: [], rock: [], bush: [] };
    const blocked = (x, z, pad) => {
      for (const f of this.footprints) if (x > f.minX - pad && x < f.maxX + pad && z > f.minZ - pad && z < f.maxZ + pad) return true;
      return false;
    };
    const inTown = (x, z, pad) => this.towns.some(t => Math.hypot(x - t.x, z - t.z) < t.r + pad);
    const onBridge = (x, z) => this.bridges.some(b => Math.hypot(x - b.x, z - b.z) < b.half + 6);
    const MAXT = Math.round(2600 * MK * MK * 2.1), MAXR = Math.round(900 * MK * MK), MAXB = Math.round(2200 * MK * MK * 1.9);
    for (let i = 0; i < 52000 * MK * MK; i++) {
      const x = (r() - 0.5) * (SIZE - 40), z = (r() - 0.5) * (SIZE - 40);
      const h = this.heightAt(x, z), wl = this.waterAt(x, z), hw = h - wl;
      if (hw < 1.5) continue;
      const riv = wl > 0.05 && hw < 9 ? 0.3 : 0;                    // 강·호숫가 숲
      const forest = nz.fbm(x * 0.006 + 300, z * 0.006 - 120, 3) * 0.5 + 0.5 + riv;
      this.normalAt(x, z, nrm);
      const kind = r();
      if (kind < 0.5) {
        if (hw < 2.6 || nrm.y < 0.78 || r() > U.smoothstep(0.38, 0.64, forest) * 0.94 + 0.03) continue;
        if (inTown(x, z, 6) || this.roadDist(x, z) < 6 || blocked(x, z, 3) || onBridge(x, z)) continue;
        if (list.pine.length + list.oak.length > MAXT) continue;
        (h > 32 || r() < 0.5 ? list.pine : list.oak).push([x, h, z]);
      } else if (kind < 0.62) {
        if (list.rock.length > MAXR || r() > 0.35 + (1 - nrm.y) * 2) continue;
        if (this.roadDist(x, z) < 5 || blocked(x, z, 2) || inTown(x, z, 0)) continue;
        list.rock.push([x, h, z]);
      } else {
        if (hw < 2.0 || list.bush.length > MAXB || r() > U.smoothstep(0.28, 0.58, forest) + 0.14) continue;
        if (this.roadDist(x, z) < 4.5 || blocked(x, z, 1.5)) continue;
        list.bush.push([x, h, z]);
      }
    }
    // 청크별 인스턴스 메시
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
    const build = (items, geo, mat, cast, perItem) => {
      const chunks = {};
      for (const it of items) { const k = Math.floor((it[0] + HALF) / 250) + ',' + Math.floor((it[2] + HALF) / 250); (chunks[k] || (chunks[k] = [])).push(it); }
      for (const k in chunks) {
        const arr = chunks[k];
        const im = new THREE.InstancedMesh(geo, mat, arr.length);
        arr.forEach((it, i) => { perItem(it, m4, tint); im.setMatrixAt(i, m4); im.setColorAt(i, tint); });
        im.castShadow = cast; im.receiveShadow = true;
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        this.scene.add(im);
      }
    };
    // 실사 나무·덤불 (EZ-Tree) — 실패하면 아래 기존 저폴리 나무로
    let ez = false;
    if (G.Veg && G.Veg.available()) {
      try {
        if (progress) progress(0.8, '나무 키우는 중...');
        await G.Veg.build(this, { pine: list.pine, oak: list.oak, bush: list.bush }, r);
        ez = true;
      } catch (e) { console.warn('[veg] EZ-Tree 실패, 기존 나무 사용', e); }
    }
    if (!ez) build(list.pine, pineGeo, vegMat, true, (it, m, t) => {
      const s = 0.85 + r() * 0.75;
      q.setFromAxisAngle(up, r() * 6.28); sc.set(s, s * (0.9 + r() * 0.3), s); ps.set(it[0], it[1] - 0.2, it[2]);
      m.compose(ps, q, sc); t.setRGB(0.8 + r() * 0.35, 0.85 + r() * 0.3, 0.8 + r() * 0.25);
      this.addCollider(it[0] - 0.28 * s, it[1] - 0.5, it[2] - 0.28 * s, it[0] + 0.28 * s, it[1] + 5 * s, it[2] + 0.28 * s, 'wood');
    });
    if (!ez) build(list.oak, oakGeo, vegMat, true, (it, m, t) => {
      const s = 0.85 + r() * 0.6;
      q.setFromAxisAngle(up, r() * 6.28); sc.set(s, s * (0.9 + r() * 0.25), s); ps.set(it[0], it[1] - 0.2, it[2]);
      const y = r(); m.compose(ps, q, sc); t.setRGB(0.85 + y * 0.35, 0.85 + r() * 0.25, 0.7 + r() * 0.25);
      this.addCollider(it[0] - 0.32 * s, it[1] - 0.5, it[2] - 0.32 * s, it[0] + 0.32 * s, it[1] + 3.4 * s, it[2] + 0.32 * s, 'wood');
    });
    build(list.rock, rockGeo, rockMat, true, (it, m, t) => {
      const s = 0.6 + Math.pow(r(), 2) * 2.6;
      const sx = s * (0.8 + r() * 0.6), sy = s * (0.5 + r() * 0.5), sz = s * (0.8 + r() * 0.6);
      q.setFromAxisAngle(up, r() * 6.28); sc.set(sx, sy, sz); ps.set(it[0], it[1] - sy * 0.25, it[2]);
      m.compose(ps, q, sc); const v = 0.75 + r() * 0.3; t.setRGB(v, v * 0.98, v * 0.94);
      const e = Math.min(sx, sz) * 0.75;
      if (s > 0.9) this.addCollider(it[0] - e, it[1] - 1, it[2] - e, it[0] + e, it[1] + sy * 0.7, it[2] + e, 'hard');
    });
    if (!ez) build(list.bush, bushGeo, vegMat, false, (it, m, t) => {
      const s = 0.7 + r() * 0.8;
      q.setFromAxisAngle(up, r() * 6.28); sc.set(s, s * (0.8 + r() * 0.4), s); ps.set(it[0], it[1] - 0.1, it[2]);
      m.compose(ps, q, sc); t.setRGB(0.8 + r() * 0.35, 0.85 + r() * 0.3, 0.75 + r() * 0.25);
    });
  },
  setupGrass(quality) {
    if (G.Veg) G.Veg.setQuality(quality);
    if (this.grass) { this.scene.remove(this.grass); this.grass.geometry.dispose(); this.grass.material.dispose(); this.grass = null; }
    if (quality === 'low' || quality === 'potato') return;
    const count = quality === 'high' ? 40000 : 16000, PS = quality === 'high' ? 74 : 56;
    // 가는 풀잎 4장 묶음 (3마디, 휘어짐) — aT: 높이 비율, 잎 번호(색 변화)
    const blade = [];
    const segs = 3, rr = U.mulberry32(5150);
    for (let b = 0; b < 4; b++) {
      const ang = b * Math.PI * 2 / 4 + rr() * 0.9, ox = (rr() - 0.5) * 0.3, oz = (rr() - 0.5) * 0.3;
      const ca = Math.cos(ang), sa = Math.sin(ang), hgt = 0.26 + rr() * 0.3, wid = 0.022 + rr() * 0.012;
      const bend = 0.12 + rr() * 0.22, bdir = rr() * 6.28, bx = Math.cos(bdir), bz = Math.sin(bdir);
      const pts = [];
      for (let s2 = 0; s2 <= segs; s2++) {
        const t = s2 / segs, w = wid * (1 - t * 0.92);
        const lean = t * t * bend;
        pts.push([[-w * ca + ox + lean * bx, t * hgt * (1 - t * bend * 0.3), -w * sa + oz + lean * bz], [w * ca + ox + lean * bx, t * hgt * (1 - t * bend * 0.3), w * sa + oz + lean * bz], t, b / 3]);
      }
      for (let s2 = 0; s2 < segs; s2++) {
        const [a0, a1, ta, bb] = pts[s2], [b0, b1, tb] = pts[s2 + 1];
        blade.push([a0, ta, bb], [a1, ta, bb], [b0, tb, bb], [a1, ta, bb], [b1, tb, bb], [b0, tb, bb]);
      }
    }
    const base = new Float32Array(blade.length * 3), hAttr = new Float32Array(blade.length * 2);
    blade.forEach(([p, t, bb], i) => { base[i * 3] = p[0]; base[i * 3 + 1] = p[1]; base[i * 3 + 2] = p[2]; hAttr[i * 2] = t; hAttr[i * 2 + 1] = bb; });
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(hAttr, 2));
    const off = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { off[i * 4] = Math.random() * PS; off[i * 4 + 1] = Math.random() * PS; off[i * 4 + 2] = Math.random(); off[i * 4 + 3] = Math.random(); }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    geo.instanceCount = count;
    const maskTex = new THREE.CanvasTexture(this.maskCanvas);
    maskTex.flipY = false; maskTex.colorSpace = THREE.NoColorSpace;
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uCenter: { value: new THREE.Vector3() }, uPS: { value: PS }, uTime: { value: 0 },
        uHeight: { value: this.heightTex }, uMask: { value: maskTex }, uMap: { value: SIZE }, uRes: { value: RES },
        uFogColor: { value: this.fogColor ? this.fogColor.clone() : new THREE.Color(0xb7cde0) }, uFogD: { value: this.fogD || 0.0014 },
        // 선형 색: 뿌리 쪽 / 잎끝 / 마른 풀
        uColA: { value: new THREE.Color(0.042, 0.068, 0.017) }, uColB: { value: new THREE.Color(0.12, 0.175, 0.036) }, uColDry: { value: new THREE.Color(0.16, 0.15, 0.065) },
        uSunDir: { value: this.sunDir.clone() }, uSunCol: { value: new THREE.Color(3, 2.9, 2.7) }, uAmb: { value: new THREE.Color(0.9, 1.0, 1.15) }
      },
      vertexShader: `
        uniform vec3 uCenter; uniform float uPS; uniform float uTime; uniform sampler2D uHeight; uniform sampler2D uMask;
        uniform float uMap; uniform float uRes; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColDry;
        attribute vec4 aOff; attribute vec2 aT;
        varying vec3 vCol; varying float vT; varying float vDepth; varying vec3 vWorld; varying float vFlower;
        float getH(vec2 wp) {
          vec2 g = clamp((wp + uMap * 0.5) / uMap * uRes, vec2(0.0), vec2(uRes));
          return texture2D(uHeight, (g + 0.5) / (uRes + 1.0)).r;
        }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          vec2 base = uCenter.xz - uPS * 0.5;
          vec2 wp = base + mod(aOff.xy - base, uPS);
          float dc = length(wp - uCenter.xz);
          float mask = texture2D(uMask, (wp + uMap * 0.5) / uMap).r;
          float fade = 1.0 - smoothstep(uPS * 0.32, uPS * 0.5, dc);
          // 군데군데 키 큰 풀밭과 짧은 풀밭
          float patchN = vnoise(wp * 0.07);
          float tall = 0.75 + patchN * 0.55;
          float s = (0.6 + aOff.z * 0.55) * tall * smoothstep(0.25, 0.7, mask) * fade;
          float flower = 0.0;
          float rot = aOff.w * 6.2831;
          vec3 p = position;
          p.xz = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * p.xz;
          p *= s;
          if (flower > 0.5) p.y *= 1.15;
          // 바람: 큰 물결 + 잔떨림
          float gust = sin(uTime * 0.9 + wp.x * 0.05 + wp.y * 0.035) * 0.5 + 0.5;
          float w = sin(uTime * 1.7 + wp.x * 0.19 + wp.y * 0.13) * (0.4 + gust * 0.6) + sin(uTime * 3.4 + wp.x * 0.7 + wp.y * 0.4 + aT.y * 3.0) * 0.18;
          float k = aT.x * aT.x * s;
          p.x += w * 0.2 * k; p.z += w * 0.11 * k;
          vec3 world = vec3(wp.x, getH(wp) - 0.04, wp.y) + p;
          vec4 mv = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mv;
          float dry = smoothstep(0.6, 0.92, vnoise(wp * 0.021 + 7.0)) * 0.45 + aOff.z * 0.08;
          vCol = mix(mix(uColA, uColB, aT.x * 0.85 + aT.y * 0.15), mix(uColDry * 0.5, uColDry, aT.x), dry * (0.4 + aT.x * 0.6));
          vCol *= 0.85 + hash(aOff.xy) * 0.3;
          vT = aT.x; vDepth = -mv.z; vWorld = world; vFlower = flower * (1.0 + floor(aOff.w * 3.0));
        }`,
      fragmentShader: `
        uniform vec3 uFogColor; uniform float uFogD; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb;
        varying vec3 vCol; varying float vT; varying float vDepth; varying vec3 vWorld; varying float vFlower;
        void main() {
          vec3 alb = vCol;
          // 꽃: 잎끝 마디만 꽃잎 색 (흰색·노랑·보라)
          if (vFlower > 0.5 && vT > 0.7) alb = vFlower < 1.5 ? vec3(0.8, 0.78, 0.7) : vFlower < 2.5 ? vec3(0.85, 0.6, 0.06) : vec3(0.35, 0.16, 0.6);
          float ao = mix(0.55, 1.0, smoothstep(0.0, 0.8, vT));
          float sunUp = clamp(uSunDir.y * 1.4 + 0.25, 0.2, 1.0);
          vec3 V = normalize(vWorld - cameraPosition);
          float back = pow(max(dot(V, uSunDir), 0.0), 5.0) * vT;         // 해를 등지고 비치는 잎
          vec3 c = alb * (uSunCol * sunUp * (0.55 + 0.45 * vT) + uAmb) * ao + alb * uSunCol * back * 0.9;
          float f = 1.0 - exp(-uFogD * uFogD * vDepth * vDepth);
          c = mix(c, uFogColor, f);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    this.grass = mesh;
    this.scene.add(mesh);
    this.syncGrassLight();
  },
  // 안개 배율 (저사양 단계는 시야 거리를 줄이는 대신 안개를 짙게)
  setFogScale(k) {
    this.fogK = k;
    if (this.scene.fog) this.scene.fog.density = (this.fogD || 0.0014) * k;
    this.syncGrassLight();
    if (G.FX && this.fogColor) G.FX.setFog(this.fogColor, (this.fogD || 0.0014) * k);
  },
  // 풀 셰이더 조명을 해·하늘에 맞춘다
  syncGrassLight() {
    if (!this.grass) return;
    const u = this.grass.material.uniforms;
    u.uSunDir.value.copy(this.sunDir);
    u.uSunCol.value.copy(this.sun.color).multiplyScalar(this.sun.intensity * 0.62);
    u.uAmb.value.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.75);
    if (this.fogColor) u.uFogColor.value.copy(this.fogColor);
    u.uFogD.value = (this.fogD || 0.0014) * (this.fogK || 1);
  },

  /* -------------------------------------------------------------- */
  /* 질의                                                            */
  /* -------------------------------------------------------------- */
  queryBoxes(x0, z0, x1, z1, cb) {
    const s = ++this.stamp;
    const gx0 = U.clamp(Math.floor((x0 + HALF) / GCELL), 0, GN - 1), gx1 = U.clamp(Math.floor((x1 + HALF) / GCELL), 0, GN - 1);
    const gz0 = U.clamp(Math.floor((z0 + HALF) / GCELL), 0, GN - 1), gz1 = U.clamp(Math.floor((z1 + HALF) / GCELL), 0, GN - 1);
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
      const cell = this.grid[gz * GN + gx];
      for (let i = 0; i < cell.length; i++) {
        const b = this.boxes[cell[i]];
        if (b.stamp === s) continue;
        b.stamp = s;
        if (b.maxX < x0 || b.minX > x1 || b.maxZ < z0 || b.minZ > z1) continue;
        cb(b);
      }
    }
  },
  // 박스 레이캐스트 (DDA) — 가장 가까운 t 반환
  rayBoxes(ox, oy, oz, dx, dy, dz, maxD, out) {
    const s = ++this.stamp;
    let best = maxD, hb = null, ax = 0, sg = 0;
    let gx = Math.floor((ox + HALF) / GCELL), gz = Math.floor((oz + HALF) / GCELL);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    let tMaxX = Math.abs(dx) > 1e-9 ? (((gx + (dx > 0 ? 1 : 0)) * GCELL - HALF) - ox) / dx : Infinity;
    let tMaxZ = Math.abs(dz) > 1e-9 ? (((gz + (dz > 0 ? 1 : 0)) * GCELL - HALF) - oz) / dz : Infinity;
    const tDX = Math.abs(dx) > 1e-9 ? GCELL / Math.abs(dx) : Infinity, tDZ = Math.abs(dz) > 1e-9 ? GCELL / Math.abs(dz) : Infinity;
    let t = 0, guard = 0;
    const idx = Math.abs(dx) > 1e-12 ? 1 / dx : 1e12, idy = Math.abs(dy) > 1e-12 ? 1 / dy : 1e12, idz = Math.abs(dz) > 1e-12 ? 1 / dz : 1e12;
    while (t <= best && guard++ < 400) {
      if (gx >= 0 && gx < GN && gz >= 0 && gz < GN) {
        const cell = this.grid[gz * GN + gx];
        for (let i = 0; i < cell.length; i++) {
          const b = this.boxes[cell[i]];
          if (b.stamp === s) continue;
          b.stamp = s;
          let t0 = (b.minX - ox) * idx, t1 = (b.maxX - ox) * idx, a = 0, sgn = dx > 0 ? -1 : 1;
          if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
          let ty0 = (b.minY - oy) * idy, ty1 = (b.maxY - oy) * idy;
          if (ty0 > ty1) { const tmp = ty0; ty0 = ty1; ty1 = tmp; }
          if (ty0 > t0) { t0 = ty0; a = 1; sgn = dy > 0 ? -1 : 1; }
          if (ty1 < t1) t1 = ty1;
          if (t0 > t1) continue;
          let tz0 = (b.minZ - oz) * idz, tz1 = (b.maxZ - oz) * idz;
          if (tz0 > tz1) { const tmp = tz0; tz0 = tz1; tz1 = tmp; }
          if (tz0 > t0) { t0 = tz0; a = 2; sgn = dz > 0 ? -1 : 1; }
          if (tz1 < t1) t1 = tz1;
          if (t0 > t1 || t0 < 0 || t0 >= best) continue;
          best = t0; hb = b; ax = a; sg = sgn;
        }
      } else if ((gx < 0 && stepX < 0) || (gx >= GN && stepX > 0) || (gz < 0 && stepZ < 0) || (gz >= GN && stepZ > 0)) break;
      if (tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDX; gx += stepX; } else { t = tMaxZ; tMaxZ += tDZ; gz += stepZ; }
    }
    if (hb && out) {
      out.t = best; out.box = hb; out.mat = hb.mat;
      out.normal.set(ax === 0 ? sg : 0, ax === 1 ? sg : 0, ax === 2 ? sg : 0);
    }
    return hb ? best : Infinity;
  },
  rayTerrain(ox, oy, oz, dx, dy, dz, maxD) {
    let t = 0, prev = 0, guard = 0;
    while (t < maxD && guard++ < 600) {
      const y = oy + dy * t, h = this.heightAt(ox + dx * t, oz + dz * t);
      if (y < h) {
        let a = prev, b = t;
        for (let i = 0; i < 8; i++) { const m = (a + b) * 0.5; if (oy + dy * m < this.heightAt(ox + dx * m, oz + dz * m)) b = m; else a = m; }
        return b;
      }
      prev = t;
      t += Math.max(0.35, (y - h) * 0.55);
    }
    const y = oy + dy * maxD;
    if (y < this.heightAt(ox + dx * maxD, oz + dz * maxD)) {
      let a = prev, b = maxD;
      for (let i = 0; i < 8; i++) { const m = (a + b) * 0.5; if (oy + dy * m < this.heightAt(ox + dx * m, oz + dz * m)) b = m; else a = m; }
      return b;
    }
    return Infinity;
  },
  // 통합 레이캐스트: 결과는 this.hit
  raycast(o, d, maxD, noTerrain) {
    const h = this.hit;
    const tb = this.rayBoxes(o.x, o.y, o.z, d.x, d.y, d.z, maxD, h);
    const tt = noTerrain ? Infinity : this.rayTerrain(o.x, o.y, o.z, d.x, d.y, d.z, Math.min(maxD, tb));
    if (tt < tb) {
      h.t = tt; h.box = null; h.mat = 'terrain';
      h.point.set(o.x + d.x * tt, o.y + d.y * tt, o.z + d.z * tt);
      this.normalAt(h.point.x, h.point.z, h.normal);
      return true;
    }
    if (tb < Infinity) { h.point.set(o.x + d.x * tb, o.y + d.y * tb, o.z + d.z * tb); return true; }
    return false;
  },
  los(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.01) return true;
    const ix = dx / d, iy = dy / d, iz = dz / d;
    if (this.rayBoxes(a.x, a.y, a.z, ix, iy, iz, d - 0.2, null) < Infinity) return false;
    if (this.rayTerrain(a.x, a.y, a.z, ix, iy, iz, d - 0.2) < Infinity) return false;
    if (G.Throwables && G.Throwables.smokeBlocks(a, b)) return false;
    return true;
  },
  // 캐릭터 발 아래 지면 높이
  ground(x, z, feetY, r, step) {
    let g = this.heightAt(x, z), mat = 'terrain';
    const lim = feetY + step;
    this.queryBoxes(x - r, z - r, x + r, z + r, b => {
      if (b.maxY > lim || b.maxY <= g) return;
      const cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x;
      const cz = z < b.minZ ? b.minZ : z > b.maxZ ? b.maxZ : z;
      if ((cx - x) * (cx - x) + (cz - z) * (cz - z) <= r * r) { g = b.maxY; mat = b.mat; }
    });
    this._gmat = mat;
    return g;
  },
  // 위쪽이 막혀 있는가 (실내 판정)
  covered(x, y, z) {
    return this.rayBoxes(x, y, z, 0, 1, 0, 25, null) < Infinity;
  },

  update(dt, camPos, cam) {
    this.time += dt;
    this.lodT = (this.lodT || 0) - dt;
    const lz = G.lodZoom || 1;
    if (lz !== this.lodZoom) { this.lodZoom = lz; this.lodT = 0; }
    if (this.lodT <= 0 && this.lod.length) { this.lodT = 0.2; this.updateLOD(camPos); }
    this.updateTerrainLOD(camPos);
    if (this.windTime) this.windTime.value = this.time;
    if (G.Veg) G.Veg.update(dt, camPos);
    if (G.Ambient) G.Ambient.update(dt, camPos, this);
    if (this.grass) {
      const u = this.grass.material.uniforms;
      u.uCenter.value.copy(camPos); u.uTime.value = this.time;
      this.grass.visible = camPos.y - this.heightAt(camPos.x, camPos.z) < 60;
    }
    this.waterNormal.offset.x += dt * 0.004; this.waterNormal.offset.y += dt * 0.0025;
    // 그림자 카메라 추적 (텍셀 스냅)
    const s = this.sun, snap = 150 / s.shadow.mapSize.x;
    const cx = Math.round(camPos.x / snap) * snap, cz = Math.round(camPos.z / snap) * snap;
    const cy = Math.max(this.heightAt(cx, cz), camPos.y - 30);
    s.target.position.set(cx, cy, cz);
    s.position.set(cx + this.sunDir.x * 400, cy + this.sunDir.y * 400, cz + this.sunDir.z * 400);
    s.target.updateMatrixWorld();
    for (const c of this.clouds) { c.position.x += dt * 3; if (c.position.x > 1700) c.position.x = -1700; }
  }
};

function tick() { return new Promise(r => setTimeout(r, 0)); }
function segIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const rX = bx - ax, rZ = bz - az, sX = dx - cx, sZ = dz - cz;
  const den = rX * sZ - rZ * sX;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sZ - (cz - az) * sX) / den, u = ((cx - ax) * rZ - (cz - az) * rX) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + rX * t, z: az + rZ * t };
}

})();
