// assets.js — 무료 실사 에셋 로더 (Poly Haven, 전부 CC0 퍼블릭 도메인)
// download-assets.bat 으로 받은 assets/ 폴더의 사진 텍스처와 HDRI 하늘을 불러온다.
// 파일이 없거나 file:// 로 열었을 때는 아무것도 하지 않고, 기존 절차적 텍스처가 그대로 쓰인다.
(function () {
'use strict';
const THREE = window.THREE, G = window.G;

// 용도 → Poly Haven 에셋 이름 (https://polyhaven.com/a/<이름>)
const TEX = {
  // 지형
  grass: 'sparse_grass', dirt: 'dirt', rock: 'rock_face_03', sand: 'coast_sand_01', asphalt: 'asphalt_02',
  // 건물
  plaster: 'white_plaster_02', brick: 'red_brick_03', wood: 'weathered_brown_planks', floor: 'wood_floor',
  roof: 'grey_roof_tiles_02', concrete: 'concrete_floor_worn_001', metal: 'corrugated_iron', crate: 'plywood',
  // 바위
  boulder: 'rock_face_03'
};
const HDRI = { day: 'kloofendal_48d_partly_cloudy_puresky', sunset: 'belfast_sunset_puresky' };
const BASE = 'assets/';
const SKY_TARGET = 1.25;   // 정규화 후 하늘 평균 밝기 (렌더러 노출 0.6 기준)
const SKY_CLAMP = 60;      // 환경맵 태양 최대값 (PMREM 반점 방지)
const BG_MAX = 3.0;        // 배경 JPG 가 담는 최대 밝기 (tools/make-sky.py 와 같아야 함)

function linear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

G.Assets = {
  TEX, HDRI, BG_MAX,
  tex: {},        // key → { map, normal, arm, mean: Color(linear) }
  sky: {},        // tod → { hdr, bg, sunDir, horizon: Color, zenith: Color }
  enabled: false,

  // 이미지 평균 색 (선형)
  meanColor(img) {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 16, 16);
    const d = x.getImageData(0, 0, 16, 16).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += linear(d[i]); g += linear(d[i + 1]); b += linear(d[i + 2]); }
    const n = d.length / 4;
    return new THREE.Color(r / n, g / n, b / n);
  },

  loadTex(loader, url, srgb, aniso) {
    return new Promise(res => {
      loader.load(url, t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = aniso;
        res(t);
      }, undefined, () => res(null));
    });
  },

  async load(renderer, progress) {
    if (location.protocol === 'file:') { console.info('[assets] file:// 실행 — 실사 에셋은 start.bat(로컬 서버)으로 실행할 때만 쓰입니다.'); return; }
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const loader = new THREE.TextureLoader();
    const jobs = [];
    let done = 0, total = 0;
    const step = () => { done++; if (progress) progress(0.30 + 0.02 * done / total, '실사 에셋 불러오는 중... (' + done + '/' + total + ')'); };
    for (const id of new Set(Object.values(TEX))) {   // 같은 에셋은 한 번만 불러온다
      const p = BASE + 'tex/' + id + '/' + id;
      total += 3;
      jobs.push(Promise.all([
        this.loadTex(loader, p + '_diff_1k.jpg', true, aniso).then(t => (step(), t)),
        this.loadTex(loader, p + '_nor_gl_1k.jpg', false, aniso).then(t => (step(), t)),
        this.loadTex(loader, p + '_arm_1k.jpg', false, aniso).then(t => (step(), t))
      ]).then(([map, normal, arm]) => {
        if (!map) return;
        const e = { map, normal, arm, mean: this.meanColor(map.image) };
        for (const key in TEX) if (TEX[key] === id) this.tex[key] = e;
      }));
    }
    for (const tod in HDRI) { total += 2; jobs.push(this.loadSky(tod, HDRI[tod], loader, step)); }
    await Promise.all(jobs);
    this.enabled = Object.keys(this.tex).length > 0;
    for (const k in this.tex) for (const t of [this.tex[k].map, this.tex[k].normal, this.tex[k].arm]) if (t) renderer.initTexture(t);
    for (const k in this.sky) for (const t of [this.sky[k].hdr, this.sky[k].bg]) if (t) renderer.initTexture(t);
    console.info('[assets] 텍스처 ' + Object.keys(this.tex).length + '/' + Object.keys(TEX).length + ', 하늘 ' + Object.keys(this.sky).length + '/' + Object.keys(HDRI).length);
  },

  async loadSky(tod, id, loader, step) {
    const hdr = await new Promise(res => {
      if (!THREE.RGBELoader) return res(null);
      new THREE.RGBELoader().setDataType(THREE.HalfFloatType).load(BASE + 'hdri/' + id + '_1k.hdr', t => res(t), undefined, () => res(null));
    });
    step();
    const bg = await new Promise(res => loader.load(BASE + 'hdri/' + id + '_bg.jpg', t => res(t), undefined, () => res(null)));
    step();
    if (!hdr) return;
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const info = this.analyzeSky(hdr);
    if (bg) { bg.mapping = THREE.EquirectangularReflectionMapping; bg.colorSpace = THREE.SRGBColorSpace; }
    this.sky[tod] = Object.assign({ hdr, bg }, info);
  },

  // HDRI 분석: 태양 방향, 평균 밝기, 지평선 색. 데이터를 SKY_TARGET 밝기로 정규화한다.
  analyzeSky(tex) {
    const { data, width: W, height: H } = tex.image;
    const f = THREE.DataUtils.fromHalfFloat, h = THREE.DataUtils.toHalfFloat;
    let best = -1, bx = 0, by = 0, sum = 0, wsum = 0;
    const hor = [0, 0, 0], zen = [0, 0, 0]; let hn = 0, zn = 0;
    for (let y = 0; y < H / 2; y++) {
      const el = Math.PI / 2 - (y + 0.5) / H * Math.PI, cw = Math.cos(el);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const l = 0.2126 * f(data[i]) + 0.7152 * f(data[i + 1]) + 0.0722 * f(data[i + 2]);
        if (l > best) { best = l; bx = x; by = y; }
        sum += Math.min(l, 10) * cw; wsum += cw;
      }
    }
    // 지평선·천정 평균색 (태양 쪽 ±40°는 눈부심 때문에 제외)
    for (let y = 0; y < H / 2; y++) {
      const el = Math.PI / 2 - (y + 0.5) / H * Math.PI;
      const isHor = el > 0.01 && el < 0.1, isZen = el > 0.9;
      if (!isHor && !isZen) continue;
      for (let x = 0; x < W; x++) {
        let da = Math.abs(x - bx) / W; da = Math.min(da, 1 - da) * 360;
        if (da < 40) continue;
        const i = (y * W + x) * 4, r = f(data[i]), g = f(data[i + 1]), b = f(data[i + 2]);
        if (isHor) { hor[0] += r; hor[1] += g; hor[2] += b; hn++; } else { zen[0] += r; zen[1] += g; zen[2] += b; zn++; }
      }
    }
    const avg = sum / wsum, k = SKY_TARGET / avg;
    for (let i = 0; i < data.length; i++) {
      if ((i & 3) === 3) continue;
      data[i] = h(Math.min(f(data[i]) * k, SKY_CLAMP));
    }
    tex.needsUpdate = true;
    const el = Math.PI / 2 - (by + 0.5) / H * Math.PI, az = ((bx + 0.5) / W - 0.5) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
    return {
      sunDir, sunElev: THREE.MathUtils.radToDeg(el), scale: k,
      horizon: new THREE.Color(hor[0] / hn * k, hor[1] / hn * k, hor[2] / hn * k),
      zenith: new THREE.Color(zen[0] / zn * k, zen[1] / zn * k, zen[2] / zn * k)
    };
  },

  // 사진 텍스처를 MeshStandardMaterial 에 입힌다. target(선형 평균색)을 주면 원래 색감에 맞춰 보정
  applyTo(mat, key, target, amount) {
    const A = this.tex[key];
    if (!A) return false;
    mat.map = A.map;
    mat.bumpMap = null;
    if (A.normal) { mat.normalMap = A.normal; mat.normalScale.set(1, 1); }
    if (A.arm) { mat.roughnessMap = A.arm; mat.aoMap = A.arm; mat.aoMapIntensity = 0.8; mat.roughness = 1; }
    if (target) {
      const a = amount === undefined ? 0.6 : amount, m = A.mean;
      mat.color.setRGB(
        THREE.MathUtils.lerp(1, target.r / Math.max(m.r, 0.01), a),
        THREE.MathUtils.lerp(1, target.g / Math.max(m.g, 0.01), a),
        THREE.MathUtils.lerp(1, target.b / Math.max(m.b, 0.01), a));
    }
    mat.needsUpdate = true;
    return true;
  }
};

})();
