// main.js — 렌더러, 후처리, 동적 해상도, 메인 루프, 게임 시작/일시정지
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;

// 화면 깜빡임 방지: 반짝이는 표면(조준경 렌즈 등)의 반사광이 너무 밝으면 HDR 버퍼가 넘쳐서(Inf/NaN)
// 블룸이 화면 전체로 번지며 번쩍인다. 모든 기본 재질의 출력값을 안전한 범위로 묶는다.
THREE.ShaderChunk.dithering_fragment = THREE.ShaderChunk.dithering_fragment +
  '\n#ifndef LZ_SAFE_OUT\n#define LZ_SAFE_OUT\n#endif\n' +
  'gl_FragColor.rgb = any(isnan(gl_FragColor.rgb)) ? vec3(0.0) : clamp(gl_FragColor.rgb, 0.0, 48.0);\n';

class ViewmodelPass extends THREE.Pass {
  constructor(scene, camera) { super(); this.scene = scene; this.camera = camera; this.needsSwap = false; }
  render(renderer, writeBuffer, readBuffer) {
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = ac;
  }
}
// 색보정 (선형 HDR, 톤매핑 전) — v52 '현대 군사 FPS' 톤
//  · 가장자리 색수차 · 가벼운 선명화(이웃 밝기 범위로 묶어 테두리 번짐 없음)
//  · 풀·나뭇잎 같은 쨍한 초록은 올리브·흙빛 쪽으로 눌러 전장 같은 칙칙한 색으로
//  · 그림자 청록 / 밝은 곳 주황 분할 톤, 대비 올리고 채도 낮춤, 비네트, 움직이는 필름 그레인
// v68 OutputPass(톤매핑·sRGB)를 여기에 합쳤다 → 전체 화면 패스 하나와 HDR 버퍼 왕복 하나를 아낀다
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, toneMappingExposure: { value: 0.6 }, uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) }, uTime: { value: 0 },
    uVig: { value: 1.2 }, uSat: { value: 0.83 }, uKnock: { value: 0 }, uCon: { value: 1.17 }, uGreen: { value: 0.45 },
    uGrain: { value: 0.07 }, uCA: { value: 0.006 }, uSharp: { value: 0.2 },
    uShadow: { value: new THREE.Vector3(0.9, 0.99, 1.1) }, uHigh: { value: new THREE.Vector3(1.08, 1.0, 0.88) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `#include <common>
    #include <tonemapping_pars_fragment>
    uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uTime; uniform float uVig; uniform float uSat; uniform float uKnock; uniform float uCon;
    uniform float uGreen; uniform float uGrain; uniform float uCA; uniform float uSharp; uniform vec3 uShadow; uniform vec3 uHigh; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (uCA > 0.0) { vec2 ca = d * r2 * uCA; c.r = texture2D(tDiffuse, vUv + ca).r; c.b = texture2D(tDiffuse, vUv - ca).b; }
      if (uSharp > 0.0) {   // 최저·저해상도에서는 꺼서 텍스처 읽기 4번을 아낀다
        vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb, s = texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)).rgb;
        vec3 e = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb, w = texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)).rgb;
        vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w)));
        c = clamp(c + (c * 4.0 - n - s - e - w) * uSharp, mn, mx);
      }
      c = max(c, vec3(0.0));
      float l = luma(c);
      float g = clamp((c.g - max(c.r, c.b)) / (c.g + 1e-4) * 2.2, 0.0, 1.0);
      c = mix(c, l * vec3(1.1, 1.0, 0.78), g * uGreen);
      c *= mix(uShadow, uHigh, smoothstep(0.02, 0.6, l));
      c = 0.18 * pow(c / 0.18, vec3(uCon));
      l = luma(c);
      c = mix(vec3(l), c, uSat * (1.0 - uKnock * 0.8));
      c = mix(c, c * vec3(1.15, 0.7, 0.7), uKnock * 0.5);
      c *= clamp(1.0 - r2 * uVig, 0.0, 1.0);
      if (uGrain > 0.0) c *= 1.0 + (hash(vUv / uTexel + fract(uTime) * vec2(61.3, 17.9)) - 0.5) * uGrain;
      // (예전 OutputPass) ACES 톤매핑 → sRGB
      c = ACESFilmicToneMapping(c);
      gl_FragColor = sRGBTransferOETF(vec4(c, 1.0));
    }`
};
// v67 FXAA: 장면 해상도에서 (화소 중심이 맞아야 글자 같은 촘촘한 곳이 뭉개지지 않는다). OutputPass 뒤라 sRGB 값에서 계단을 찾는다.
//  FXAA 3.11 콘솔판 (가장자리 방향 찾기 + 방향 따라 두 번 섞기)
const FXAAShader = {
  uniforms: { tDiffuse: { value: null }, uIn: { value: new THREE.Vector2(1 / 640, 1 / 360) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uIn; varying vec2 vUv;
    float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main(){
      vec3 rgbM = texture2D(tDiffuse, vUv).rgb;
      float lNW = lum(texture2D(tDiffuse, vUv + vec2(-0.5, 0.5) * uIn).rgb), lNE = lum(texture2D(tDiffuse, vUv + vec2(0.5, 0.5) * uIn).rgb);
      float lSW = lum(texture2D(tDiffuse, vUv + vec2(-0.5,-0.5) * uIn).rgb), lSE = lum(texture2D(tDiffuse, vUv + vec2(0.5,-0.5) * uIn).rgb);
      float lM = lum(rgbM);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      if (lMax - lMin < max(0.05, lMax * 0.125)) { gl_FragColor = vec4(rgbM, 1.0); return; }
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0));
      dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * uIn;
      vec3 a = 0.5 * (texture2D(tDiffuse, vUv - dir * (1.0 / 6.0)).rgb + texture2D(tDiffuse, vUv + dir * (1.0 / 6.0)).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture2D(tDiffuse, vUv - dir * 0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
      float lB = lum(b);
      gl_FragColor = vec4((lB < lMin || lB > lMax) ? a : b, 1.0);
    }`
};
// v68 업스케일: AMD FSR 1.0 EASU (가장자리 방향을 보고 12점 램쵸스형 필터로 늘린다) — 단순 선형보다 낮은 내부 해상도에서도 또렷하다
//  uEasu 0: 그대로 복사 (배율 ~1) · 1: 선형 + 이웃 범위 선명화 (최저, 가장 싸다) · 2: EASU
const UpscaleShader = {
  uniforms: { tDiffuse: { value: null }, uIn: { value: new THREE.Vector2(1 / 640, 1 / 360) }, uInSize: { value: new THREE.Vector2(640, 360) }, uEasu: { value: 2 }, uSharp: { value: 0.2 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uIn; uniform vec2 uInSize; uniform float uEasu; uniform float uSharp; varying vec2 vUv;
    float L(vec3 c){ return c.g + 0.5 * (c.r + c.b); }
    void easuSet(inout vec2 dir, inout float len, float w, float lA, float lB, float lC, float lD, float lE){
      float lenX = max(abs(lD - lC), abs(lC - lB)), dirX = lD - lB;
      dir.x += dirX * w; lenX = clamp(abs(dirX) / max(lenX, 1e-5), 0.0, 1.0); len += lenX * lenX * w;
      float lenY = max(abs(lE - lC), abs(lC - lA)), dirY = lE - lA;
      dir.y += dirY * w; lenY = clamp(abs(dirY) / max(lenY, 1e-5), 0.0, 1.0); len += lenY * lenY * w;
    }
    void easuTap(inout vec3 aC, inout float aW, vec2 off, vec2 dir, vec2 len, float lob, float clp, vec3 c){
      vec2 v = vec2(dot(off, dir), dot(off, vec2(-dir.y, dir.x))) * len;
      float d2 = min(dot(v, v), clp);
      float wB = 0.4 * d2 - 1.0, wA = lob * d2 - 1.0;
      wB *= wB; wA *= wA; wB = 1.5625 * wB - 0.5625;
      float w = wB * wA; aC += c * w; aW += w;
    }
    vec3 T(vec2 p){ return texture2D(tDiffuse, p * uIn).rgb; }
    void main(){
      if (uEasu < 1.5) {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        if (uEasu > 0.5) {
          vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, uIn.y)).rgb, s = texture2D(tDiffuse, vUv - vec2(0.0, uIn.y)).rgb;
          vec3 e = texture2D(tDiffuse, vUv + vec2(uIn.x, 0.0)).rgb, w = texture2D(tDiffuse, vUv - vec2(uIn.x, 0.0)).rgb;
          vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w)));
          c = clamp(c + (c - (n + s + e + w) * 0.25) * uSharp, mn, mx);
        }
        gl_FragColor = vec4(c, 1.0); return;
      }
      vec2 pp = vUv * uInSize - 0.5, fp = floor(pp); pp -= fp; fp += 0.5;
      //    b c
      //  e f g h
      //  i j k l
      //    n o
      vec3 b = T(fp + vec2(0.0, -1.0)), c = T(fp + vec2(1.0, -1.0));
      vec3 e = T(fp + vec2(-1.0, 0.0)), f = T(fp), g = T(fp + vec2(1.0, 0.0)), h = T(fp + vec2(2.0, 0.0));
      vec3 i = T(fp + vec2(-1.0, 1.0)), j = T(fp + vec2(0.0, 1.0)), k = T(fp + vec2(1.0, 1.0)), l = T(fp + vec2(2.0, 1.0));
      vec3 n = T(fp + vec2(0.0, 2.0)), o = T(fp + vec2(1.0, 2.0));
      float bL = L(b), cL = L(c), eL = L(e), fL = L(f), gL = L(g), hL = L(h), iL = L(i), jL = L(j), kL = L(k), lL = L(l), nL = L(n), oL = L(o);
      vec2 dir = vec2(0.0); float len = 0.0;
      easuSet(dir, len, (1.0 - pp.x) * (1.0 - pp.y), bL, eL, fL, gL, jL);
      easuSet(dir, len, pp.x * (1.0 - pp.y), cL, fL, gL, hL, kL);
      easuSet(dir, len, (1.0 - pp.x) * pp.y, fL, iL, jL, kL, nL);
      easuSet(dir, len, pp.x * pp.y, gL, jL, kL, lL, oL);
      float dr = dot(dir, dir); bool zro = dr < 1.0 / 32768.0;
      dir = zro ? vec2(1.0, 0.0) : dir * inversesqrt(dr);
      len = len * 0.5; len *= len;
      float stretch = dot(dir, dir) / max(abs(dir.x), abs(dir.y));
      vec2 len2 = vec2(1.0 + (stretch - 1.0) * len, 1.0 - 0.5 * len);
      float lob = 0.5 - 0.29 * len, clp = 1.0 / lob;
      vec3 aC = vec3(0.0); float aW = 0.0;
      easuTap(aC, aW, vec2(0.0, -1.0) - pp, dir, len2, lob, clp, b);
      easuTap(aC, aW, vec2(1.0, -1.0) - pp, dir, len2, lob, clp, c);
      easuTap(aC, aW, vec2(-1.0, 1.0) - pp, dir, len2, lob, clp, i);
      easuTap(aC, aW, vec2(0.0, 1.0) - pp, dir, len2, lob, clp, j);
      easuTap(aC, aW, vec2(0.0, 0.0) - pp, dir, len2, lob, clp, f);
      easuTap(aC, aW, vec2(-1.0, 0.0) - pp, dir, len2, lob, clp, e);
      easuTap(aC, aW, vec2(1.0, 1.0) - pp, dir, len2, lob, clp, k);
      easuTap(aC, aW, vec2(2.0, 1.0) - pp, dir, len2, lob, clp, l);
      easuTap(aC, aW, vec2(2.0, 0.0) - pp, dir, len2, lob, clp, h);
      easuTap(aC, aW, vec2(1.0, 0.0) - pp, dir, len2, lob, clp, g);
      easuTap(aC, aW, vec2(1.0, 2.0) - pp, dir, len2, lob, clp, o);
      easuTap(aC, aW, vec2(0.0, 2.0) - pp, dir, len2, lob, clp, n);
      vec3 mn = min(min(f, g), min(j, k)), mx = max(max(f, g), max(j, k));
      gl_FragColor = vec4(clamp(aC / aW, mn, mx), 1.0);   // 링잉 없이 이웃 4점 범위로
    }`
};
// 품질 프리셋
// dpr 해상도 배율 상한 · msaa · shadow 그림자 맵(0 = 끔) · range 그림자 범위 · bloom · post 후처리(끄면 화면에 바로 그림)
// far 시야 거리 · fog 안개 배율 · lod 건물 상세 거리 배율 · terr 지형 상세 거리 배율 · shEvery 그림자 갱신 주기(프레임)
const QUALITY = {
  // v67 최저도 후처리(가벼운 길)를 쓴다: 장면은 낮은 해상도로 그리고, 화면 해상도로 늘리며 FXAA (fxaa)
  potato: { dpr: 0.6,  msaa: 0, shadow: 0,    range: 0,  bloom: false, post: true,  far: 750,  fog: 1.45, lod: 0.6, terr: 0.5,  shEvery: 0, fxaa: true, lite: true },
  low:    { dpr: 0.75, msaa: 0, shadow: 1024, range: 42, bloom: false, post: true,  far: 1100, fog: 1.2,  lod: 0.8, terr: 0.7,  shEvery: 3, fxaa: true },
  medium: { dpr: 1.0,  msaa: 2, shadow: 2048, range: 62, bloom: true,  post: true,  far: 2200, fog: 1.0,  lod: 1,   terr: 1,    shEvery: 2 },
  high:   { dpr: 1.25, msaa: 4, shadow: 2048, range: 75, bloom: true,  post: true,  far: 4000, fog: 1.0,  lod: 1,   terr: 1.25, shEvery: 2 }
};
const TIERS = ['potato', 'low', 'medium', 'high'];
const TIER_NAME = { potato: '최저', low: '낮음', medium: '중간', high: '높음' };
// '자동' 품질: 그래픽 카드로 시작 단계를 고르고, 게임 중 60fps 아래로 떨어지면 한 단계씩 낮춘다
const Auto = { downN: 0, upT: 0, lastChange: -1e9, lastUp: -1e9, failed: {}, max: 3, start: 'high' };
function guessTier() {
  try { const s = localStorage.getItem('lz_auto_tier'); if (s && QUALITY[s]) return s; } catch (e) { /* 무시 */ }
  let s = '';
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    s = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch (e) { /* 무시 */ }
  G.gpuName = s;
  if (/swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(s)) return 'potato';
  if (document.documentElement.classList.contains('mobile')) return 'low';
  if (/iris xe|arc\b|radeon\(tm\) graphics|vega \d|apple m\d|apple gpu/i.test(s)) return 'medium';
  if (/intel|mali|adreno|powervr|vivante|videocore|hd graphics|uhd graphics/i.test(s)) return 'low';
  return 'high';
}
function resolveQuality(opt) {
  if (opt !== 'auto') return QUALITY[opt] ? opt : 'high';
  if (!Auto.guessed) { Auto.guessed = true; Auto.start = guessTier(); Auto.max = Math.min(3, TIERS.indexOf(Auto.start) + 1); }
  return Auto.tier || Auto.start;
}
function autoGovern(now, fps, drs) {
  if (G.qualityMode !== 'auto') return;
  const ti = TIERS.indexOf(G.quality);
  const hz = 1000 / drs.refresh;
  // 내려가기: 60fps 아래인데 해상도를 이미 최저로 낮췄거나, 아주 느릴 때
  if (fps < 57 && (drs.scale <= drs.minScale + 0.01 || fps < 42)) Auto.downN++; else Auto.downN = Math.max(0, Auto.downN - 1);
  if (ti > 0 && Auto.downN >= (fps < 42 ? 3 : 6) && now - Auto.lastChange > 3000) {
    if (now - Auto.lastUp < 30000) Auto.failed[G.quality] = true;   // 방금 올렸다가 버티지 못하면 다시 올리지 않는다
    Auto.downN = 0; Auto.upT = 0; Auto.lastChange = now;
    setTier(TIERS[ti - 1]);
    return;
  }
  // 올라가기: 해상도 100%로 화면 주사율을 꽉 채운 채 25초 버티면 한 단계 위를 시험
  if (drs.scale >= 1 && fps >= Math.min(hz, drs.target) - 3) Auto.upT += 0.5; else Auto.upT = 0;
  if (ti < Auto.max && Auto.upT >= 25 && now - Auto.lastChange > 20000 && !Auto.failed[TIERS[ti + 1]]) {
    Auto.upT = 0; Auto.lastChange = Auto.lastUp = now;
    setTier(TIERS[ti + 1]);
  }
}
function setTier(q) {
  Auto.tier = q;
  try { localStorage.setItem('lz_auto_tier', q); } catch (e) { /* 무시 */ }
  applyQuality(q);
  if (G.UI && G.UI.toast) G.UI.toast('그래픽 자동 조절: ' + TIER_NAME[q]);
}
// v68 '자동' 첫 실행 측정: 저장된 단계가 없으면 메뉴 화면(지도 위를 나는 장면)에서 단계별로 1~2초씩 재서 고른다
//  GPU 타이머가 있으면 GPU 시간으로 (13.5 ms 넘으면 한 단계 아래, 5.5 ms 아래면 한 단계 위), 없으면 프레임이 주사율을 놓칠 때만 낮춘다
const Bench = { active: false, done: false };
function startAutoBench() {
  if (G.qualityMode !== 'auto' || Bench.done || Bench.active) return;
  try { if (localStorage.getItem('lz_auto_tier')) { Bench.done = true; return; } } catch (e) { /* 무시 */ }
  Object.assign(Bench, { active: true, n: 0, acc: 0, skip: 45, dir: 0, steps: 0 });
  if (G.Perf) G.Perf.setQuiet(true);
}
function benchFrame(ms) {
  if (!Bench.active) return;
  if (G.Game.state !== 'menu' || G.qualityMode !== 'auto' || (G.UI.opts && G.UI.opts.quality !== 'auto') || G.paused) { Bench.active = false; if (G.Perf) G.Perf.setQuiet(false); return; }   // 판을 시작하면 그만 (저장 안 함 → 다음에 다시)
  if (Bench.skip > 0) { Bench.skip--; return; }   // 단계를 바꾼 직후(셰이더 컴파일)는 버린다
  if (ms > 1000) return;   // 탭 전환 같은 큰 끊김만 버린다
  Bench.acc += ms; Bench.n++;
  if (Bench.n < 75) return;
  const avg = Bench.acc / Bench.n, st = G.Perf ? G.Perf.stats(60) : null, gpu = st && G.Perf.hasGpu ? st.gpuTotal : 0;
  const ti = TIERS.indexOf(G.quality);
  const slow = gpu ? gpu > 13.5 : avg > Math.max(DRS.refresh * 1.15, 18);
  let next = ti;
  if (slow && ti > 0 && Bench.dir <= 0) next = ti - 1;
  else if (gpu && gpu < 5.5 && ti < 3 && Bench.dir >= 0) next = ti + 1;
  if (next !== ti && Bench.steps < 3) {
    Bench.dir = next - ti; Bench.steps++; Bench.n = 0; Bench.acc = 0; Bench.skip = 45;
    applyQuality(TIERS[next]);
    return;
  }
  Bench.active = false; Bench.done = true;
  if (G.Perf) G.Perf.setQuiet(false);
  Auto.start = Auto.tier = G.quality; Auto.max = Math.min(3, TIERS.indexOf(G.quality) + (gpu ? 0 : 1));
  try { localStorage.setItem('lz_auto_tier', G.quality); } catch (e) { /* 무시 */ }
  G.benchResult = { tier: G.quality, avg, gpu };
  if (G.UI && G.UI.toast) G.UI.toast('그래픽 자동 설정: ' + TIER_NAME[G.quality] + (gpu ? ' (GPU ' + gpu.toFixed(1) + 'ms)' : ''));
  if (G.Settings && G.Settings.render) try { G.Settings.render(); } catch (e) { /* 무시 */ }
}
// v68 단계별 비등방 필터 상한 (아직 GPU 에 올라가지 않은 텍스처만 — 올린 것을 다시 올리면 멈칫한다)
const ANISO = { potato: 2, low: 4, medium: 8, high: 16 };
function applyAniso(q) {
  const cap = Math.min(ANISO[q] || 16, renderer.capabilities.getMaxAnisotropy() || 1), seen = new Set();
  const visit = t => {
    if (!t || !t.isTexture || seen.has(t)) return; seen.add(t);
    if (t.userData.aniso0 === undefined) t.userData.aniso0 = t.anisotropy;
    if (renderer.properties.get(t).__webglInit) return;
    t.anisotropy = Math.max(1, Math.min(t.userData.aniso0, cap));
  };
  for (const root of [scene, G.vmScene]) root.traverse(o => {
    if (!o.material) return;
    for (const m of [].concat(o.material)) {
      for (const k in m) { const v = m[k]; if (v && v.isTexture) visit(v); }
      if (m.uniforms) for (const k in m.uniforms) visit(m.uniforms[k] && m.uniforms[k].value);
    }
  });
}
const MAX_PIXELS = 2560 * 1440;
// v67 화면(캔버스) 해상도: 후처리를 쓰면 장면 해상도와 따로 — 마지막 패스만 이 해상도로 그린다
function outputPixelRatio() {
  const Q = QUALITY[G.quality];
  let pr = Math.min(devicePixelRatio || 1, Q && !Q.msaa ? 1 : 1.5);   // 저사양은 화면 1 배까지 (그 위는 브라우저가 늘린다)
  const px = innerWidth * innerHeight * pr * pr;
  if (px > MAX_PIXELS) pr *= Math.sqrt(MAX_PIXELS / px);
  return pr;
}

let renderer, scene, camera, composer, bloom, grade, fxaa, upAA, last = 0, menuAng = 0, frameNo = 0;
G.paused = false;

/* ------------------------------------------------------------------ */
/* 동적 해상도 — 목표 FPS를 유지하도록 렌더 해상도를 자동 조절          */
/* ------------------------------------------------------------------ */
const DRS = {
  base: 1, scale: 1, applied: 0, minScale: 0.55, target: 120,
  iv: new Float32Array(120), ivN: 0, refresh: 1000 / 60, refreshEst: 1e9,
  acc: 0, cnt: 0, checkT: 0, lastDown: -1e9, lastChange: 0, fps: 0, fpsAcc: 0, fpsN: 0, fpsT: 0,
  lastUp: -1e9, ceil: 0, upWait: 4000,
  reset(base) { this.base = base; this.scale = 1; this.lastDown = -1e9; this.lastUp = -1e9; this.ceil = 0; this.upWait = 4000; this.apply(true); },
  apply(force) {
    const pr = Math.max(0.35, this.base * this.scale);
    // 레이트레이싱은 캔버스 크기로 자기 버퍼를 잡는다 → 그때는 예전처럼 캔버스 자체를 줄인다
    const split = composer && usePost() && !(G.RT && G.RT.active()), out = split ? outputPixelRatio() : pr;
    if (!force && Math.abs(pr - this.applied) < 0.01 && split === this.split) return;
    this.applied = pr; this.split = split;
    if (Math.abs(renderer.getPixelRatio() - out) > 1e-3) renderer.setPixelRatio(out);
    if (composer && usePost()) composer.setPixelRatio(pr);
    if (upAA) syncUpAA();
  },
  frame(now, ms) {
    // 모니터 주사율 추정 (최근 프레임 간격의 하위 20%)
    this.iv[this.ivN++ % this.iv.length] = ms;
    if (this.ivN >= this.iv.length && this.ivN % 30 === 0) {
      const s = Array.from(this.iv).sort((a, b) => a - b);
      const p = s[Math.floor(s.length * 0.2)];
      if (p > 3.5) this.refreshEst = Math.min(this.refreshEst, p);
      this.refresh = Math.min(this.refreshEst, 1000 / 30);
    }
    // FPS 표시용
    this.fpsAcc += ms; this.fpsN++;
    if (now - this.fpsT > 500) { this.fps = 1000 / (this.fpsAcc / this.fpsN); this.fpsAcc = 0; this.fpsN = 0; this.fpsT = now; G.UI.fps(this.fps, this.applied, this.refresh); }
    if (G.Game.state !== 'playing' || G.paused) { this.acc = 0; this.cnt = 0; return; }
    // 레이트레이싱은 자체 품질 조절을 한다: 동적 해상도·자동 품질은 쉰다
    const rt = !!(G.RT && G.RT.active());
    if (rt !== !!this.rtWas) { this.rtWas = rt; this.apply(true); }
    if (rt) { this.acc = 0; this.cnt = 0; return; }
    if (ms > 100) return; // 백그라운드 탭 / 일시적 멈춤은 무시
    this.acc += ms; this.cnt++;
    if (now - this.checkT < 500) return;
    this.checkT = now;
    const avg = this.acc / this.cnt; this.acc = 0; this.cnt = 0;
    autoGovern(now, 1000 / avg, this);
    const goal = Math.max(1000 / this.target, this.refresh * 0.98);
    // v68 해상도가 오르락내리락 깜빡이지 않게:
    //  · 내릴 때는 픽셀 수 ∝ 시간으로 보고 목표에 맞는 배율로 한 번에 (최소 0.04, 최대 0.15)
    //  · 올릴 때는 올린 뒤 예상 시간(배율² 비례)이 목표 안일 때만, 올렸다가 곧 다시 내려가면 그 배율은 한동안(기다림 두 배씩) 시도하지 않는다
    if (avg > goal * 1.1 && this.scale > this.minScale) {
      const want = this.scale * Math.sqrt(goal / avg) * 0.97;
      const ns = Math.max(this.minScale, Math.min(this.scale - 0.04, Math.max(this.scale - 0.15, want)));
      if (now - this.lastUp < 3000) { this.ceil = this.scale; this.upWait = Math.min(32000, (this.upWait || 4000) * 2); }
      this.scale = ns; this.lastDown = now; this.apply();
    } else if (this.scale < 1 && now - this.lastDown > (this.upWait || 4000) && now - this.lastChange > 2500) {
      const ns = Math.min(1, this.scale + 0.05);
      const pred = avg * (ns * ns) / (this.scale * this.scale);
      const blocked = this.ceil && ns >= this.ceil - 1e-3 && now - this.lastDown < 30000;
      const capped = avg < this.refresh * 1.04 && avg < goal * 1.03;   // 화면 주사율에 묶여 있으면 여유를 잴 수 없다 → 예전처럼 한 칸 시도
      if ((capped || pred < goal * 1.02) && !blocked) {
        this.scale = ns; this.lastChange = this.lastUp = now; this.apply();
        if (now - this.lastDown > 30000) { this.ceil = 0; this.upWait = 4000; }
      }
    }
  }
};
G.DRS = DRS;

G.boot = async function () {
  const loadFill = document.getElementById('loadFill'), loadText = document.getElementById('loadText');
  const progress = (p, t) => { loadFill.style.width = Math.round(p * 100) + '%'; if (t) loadText.textContent = t; };
  progress(0.3, '렌더러 초기화 중...');
  renderer = G.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.6;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('app').appendChild(renderer.domElement);
  if (G.Perf) G.Perf.init(renderer);

  scene = G.scene = new THREE.Scene();
  camera = G.camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 4000);
  camera.rotation.order = 'YXZ';
  G.vmScene = new THREE.Scene();
  G.vmCamera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.01, 10);

  G.Input.init(renderer.domElement);
  await G.World.init(scene, renderer, progress);
  progress(0.92, '효과 준비 중...');
  G.FX.init(scene);
  G.Extras.init(scene);
  await Promise.all([G.ReloadAssets?.load(), G.ThrowModels?.load(renderer), G.Vehicles?.load()]);
  G.VM.init(G.vmScene);

  G.UI.init();
  if (G.Settings) { G.Settings.apply(); G.Settings.initUI(); }
  progress(0.94, '총기 모델 자동 적용 중...');
  await Promise.all([G.G17Pilot?.init(),G.M4Viewmodel?.init()]);
  // 총기별 실사 장전 동작 팩 (v51) — 뒤에서 하나씩 받고, 받기 전에는 절차적 모델을 쓴다
  G.AssetVM?.init();
  // M4 팩의 실사 팔을 나머지 총기에도 (M4·Glock 이 준비된 뒤)
  G.RealArms?.init();
  if(G.Attachments)G.Attachments.initUI();
  G.World.setTimeOfDay(G.UI.opts.tod || 'day');
  G.Player.sens = G.UI.opts.sens;
  DRS.target = G.UI.opts.fpsTarget || 120;
  G.qualityMode = G.UI.opts.quality;
  applyQuality(resolveQuality(G.UI.opts.quality));
  camera.position.set(450, 160, 450); camera.lookAt(0, 20, 0);
  progress(0.97, '셰이더 컴파일 중...');
  await new Promise(r => setTimeout(r, 30));
  renderer.compile(scene, camera);
  renderer.shadowMap.needsUpdate = true;
  // 레이트레이싱을 켜 두었으면 로딩 화면에서 모듈을 받고 장면까지 미리 컴파일한다
  if (G.RT) {
    if (G.RT.wanted) progress(0.99, '레이트레이싱 준비 중...');
    await G.RT.init();
    if (G.RT.active()) { progress(0.99, '레이트레이싱 장면 준비 중... (몇 초 걸립니다)'); await G.RT.prepare('레이트레이싱 장면 준비 중... (몇 초 걸립니다)'); }
    if (G.Settings) G.Settings.render();
  }
  progress(1, '완료');
  document.getElementById('loading').classList.add('hidden');
  G.UI.showMenu();
  startAutoBench();

  addEventListener('resize', onResize);
  renderer.domElement.addEventListener('click', () => {
    if (G.Game.spectating && !G.Input.locked) { G.Input.lock(); return; }
    if (G.Game.state === 'playing' && !G.Input.locked && !G.Settings?.open && !G.Attachments?.open && !G.Armory?.open) G.resume();
  });
  G.onLockChange = (locked) => {
    if (G.Game.spectating && !locked) { G.Game.stopSpectate(); return; }
    if (G.Game.state !== 'playing') return;
    if(G.Attachments?.open||G.Armory?.open){G.paused=true;G.UI.showPause(false);return;}
    if (!locked) { G.paused = true; G.UI.showPause(true); }
    else { G.paused = false; G.UI.showPause(false); }
  };
  window.addEventListener('error', e => showError(e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  last = performance.now();
  requestAnimationFrame(frame);
};

function showError(msg) {
  const b = document.getElementById('errorBox');
  b.classList.remove('hidden');
  b.textContent = (b.textContent ? b.textContent + '\n' : '') + msg;
}

function setupComposer(samples) {
  if (composer) {
    composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
    for (const p of composer.passes) if (p.dispose) p.dispose();
  }
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples });
  composer = new THREE.EffectComposer(renderer, rt);
  composer.addPass(new THREE.RenderPass(scene, camera));
  composer.addPass(new ViewmodelPass(G.vmScene, G.vmCamera));
  bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.28, 0.4, 3.5);
  // 블룸은 절반 해상도에서 처리
  const bloomSetSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => bloomSetSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
  composer.addPass(bloom);
  grade = new THREE.ShaderPass(GradeShader);
  grade.material.toneMapped = false;   // 톤매핑은 셰이더 안에서 (화면에 바로 그려도 두 번 걸리지 않게)
  composer.addPass(grade);
  // v67 FXAA (장면 해상도) → 업스케일 (화면 해상도, 마지막)
  fxaa = G.fxaaPass = new THREE.ShaderPass(FXAAShader);
  composer.addPass(fxaa);
  upAA = G.upAA = new THREE.ShaderPass(UpscaleShader);
  composer.addPass(upAA);
  composer.setSize(innerWidth, innerHeight);
  if (G.Perf) G.Perf.hookComposer(composer, new Map([[grade, 'grade'], [fxaa, 'fxaa'], [upAA, 'upscale']]));
  G.renderNow = () => renderFrame(0.016);
}

// 업스케일 패스: 장면 해상도와 화면 해상도가 같고 FXAA 도 필요 없으면 꺼서 한 패스를 아낀다
function syncUpAA() {
  const Q = QUALITY[G.quality] || QUALITY.high, rt = composer.renderTarget1;
  upAA.uniforms.uIn.value.set(1 / Math.max(1, rt.width), 1 / Math.max(1, rt.height));
  upAA.uniforms.uInSize.value.set(Math.max(1, rt.width), Math.max(1, rt.height));
  fxaa.uniforms.uIn.value.copy(upAA.uniforms.uIn.value);
  const ratio = DRS.applied / Math.max(1e-3, renderer.getPixelRatio());
  fxaa.enabled = !!Q.fxaa;
  upAA.uniforms.uEasu.value = ratio >= 0.97 ? 0 : Q.lite ? 1 : 2;   // 최저는 싼 선형+선명화, 그 위는 EASU
  upAA.uniforms.uSharp.value = U.clamp((1 - ratio) * 0.5, 0.06, 0.25);
  upAA.enabled = !!Q.fxaa || ratio < 0.97;   // FXAA 를 쓰면 늘 마지막에 (FXAA 가 화면 해상도에서 돌지 않게)
  // 장면 해상도가 낮을 때는 필름 그레인·색수차·선명화를 줄인다 (늘리면 큰 점으로 번져 '점점이' 보였다)
  const k = U.clamp((ratio - 0.55) / 0.4, 0, 1);
  grade.uniforms.uGrain.value = 0.07 * k * (Q.lite ? 0 : 1);
  grade.uniforms.uSharp.value = 0.2 * k;
  grade.uniforms.uCA.value = 0.006 * (Q.lite ? 0 : 1);
}
function basePixelRatio(q) {
  let pr = Math.min(devicePixelRatio || 1, QUALITY[q].dpr);
  const px = innerWidth * innerHeight * pr * pr;
  if (px > MAX_PIXELS) pr *= Math.sqrt(MAX_PIXELS / px);
  return pr;
}

function applyQuality(q) {
  if (!QUALITY[q]) q = 'high';
  const Q = QUALITY[q];
  if (Q.post && (!composer || !QUALITY[G.quality] || QUALITY[G.quality].msaa !== Q.msaa || !QUALITY[G.quality].post)) setupComposer(Q.msaa);
  if (!composer) setupComposer(0);
  // 후처리를 끄는 단계에서는 composer 의 큰 렌더 타깃(HDR·MSAA·블룸)을 놓아 그래픽 메모리를 돌려준다
  if (!Q.post) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); for (const p of composer.passes) if (p.dispose) p.dispose(); }
  const sun = G.World.sun;
  sun.castShadow = Q.shadow > 0;
  if (Q.shadow > 0 && sun.shadow.mapSize.x !== Q.shadow) {
    sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  if (Q.range) { const sc = sun.shadow.camera; sc.left = -Q.range; sc.right = Q.range; sc.top = Q.range; sc.bottom = -Q.range; sc.updateProjectionMatrix(); }
  bloom.enabled = Q.bloom;
  grade.enabled = true;
  G.World.setupGrass(q);
  applyAniso(q);
  G.World.lodDist = Q.lod; G.World.terrDist = Q.terr; G.World.lodT = 0;
  if (G.World.setFogScale) G.World.setFogScale(Q.fog);
  camera.far = Q.far; camera.updateProjectionMatrix();
  G.quality = q;
  DRS.minScale = q === 'potato' ? 0.5 : 0.55;
  DRS.reset(basePixelRatio(q));
  onResize();
  renderer.shadowMap.needsUpdate = true;
}
// 한 프레임 그리기: 후처리를 쓰면 composer, 아니면 화면에 바로 (본 장면 → 1인칭 총)
const _db = new THREE.Vector2();
function usePost() { const Q = QUALITY[G.quality]; return !Q || Q.post; }
function renderFrame(dt) {
  // The catalogue draws its own preview on demand over the last game frame.
  if (G.Armory?.open) return;
  // 레이트레이싱 (설정에서 켰고 지원되는 기기일 때)
  const PF = G.Perf && G.Perf.on ? G.Perf : null;
  if (G.RT && G.RT.drawing()) { if (PF) PF.seg('rt'); G.RT.render(renderer, scene, camera, G.vmScene, G.vmCamera); return; }
  const Q = QUALITY[G.quality];
  if (!Q || Q.post) {
    const rt = composer.renderTarget1;   // 색보정은 장면 해상도에서 돈다
    grade.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    grade.uniforms.uTexel.value.set(1 / rt.width, 1 / rt.height); grade.uniforms.uTime.value = (grade.uniforms.uTime.value + 0.618) % 64;
    composer.render(dt); return;
  }
  renderer.setRenderTarget(null);
  renderer.autoClear = true;
  if (PF) PF.seg('scene');
  renderer.render(scene, camera);
  renderer.autoClear = false;
  renderer.clearDepth();
  if (PF) PF.seg('viewmodel');
  renderer.render(G.vmScene, G.vmCamera);
  renderer.autoClear = true;
}
G.__apply = (q) => applyQuality(q);
G.qualityShEvery = () => (QUALITY[G.quality] || QUALITY.high).shEvery;
G.composerRT = () => (composer && usePost() && !(G.RT && G.RT.drawing())) ? composer.renderTarget1 : null;
G.qualityLabel = () => (G.qualityMode === 'auto' ? '자동·' : '') + (TIER_NAME[G.quality] || '');

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  G.vmCamera.aspect = innerWidth / innerHeight; G.vmCamera.updateProjectionMatrix();
  if (G.quality) { DRS.base = basePixelRatio(G.quality); DRS.apply(true); }
  if (composer && usePost()) { composer.setSize(innerWidth, innerHeight); if (upAA) syncUpAA(); }
}

// 매치 시작 시 사용될 셰이더를 미리 컴파일해 첫 사용 시 끊김을 없앤다
function warmup() {
  const shown = [];
  const show = o => { if (o && !o.visible) { o.visible = true; shown.push(o); } };
  const temp = [];
  const seenK = new Set();
  for (const it of G.Game.loot) { if (seenK.has(it.kind)) continue; seenK.add(it.kind); show(it.mesh); }
  for (const a of G.Game.actors) { const m = a.model; show(m.root); show(m.lodMesh); show(m.helmetMesh); }
  const m0 = G.Game.actors[0].model;
  m0.showChute(true); m0.showChute(false); show(m0.chute);
  for (const k of G.THROW_ORDER) { const t = G.Guns.throwModel(k, false); t.position.copy(camera.position); scene.add(t); temp.push(t); }
  for (const k of G.GUN_IDS) { const g = G.Guns.tpModel(k); g.position.copy(camera.position); scene.add(g); temp.push(g); }
  if (G.Game.zone) show(G.Game.zone.mesh);
  for (const k in G.VM.models) show(G.VM.models[k].root);
  G.VM.root.traverse(o => { if (o !== G.VM.root) show(o); });
  renderer.compile(scene, camera);
  renderer.compile(G.vmScene, G.vmCamera);
  // v67 처음 보는 텍스처를 GPU 로 올리느라 게임 중에 멈칫하던 것 (숲에 처음 들어갈 때 등) → 판이 시작되면
  //  프레임마다 3 ms 안에서 조금씩 미리 올린다 (한 번에 다 올리면 저사양에서 시작 화면이 수 초 멈춘다)
  const texs = new Set();
  for (const root of [scene, G.vmScene]) root.traverse(o => {
    if (!o.material) return;
    for (const m of [].concat(o.material)) for (const k in m) { const v = m[k]; if (v && v.isTexture && !v.isRenderTargetTexture && v.image) texs.add(v); }
  });
  G.prewarmTex = [...texs];
  for (const o of shown) o.visible = false;
  for (const t of temp) scene.remove(t);
  G.VM.set(null);
}

G.startGame = function (opts) {
  G.Audio.init();
  G.UI.hideMenu();
  document.getElementById('results').classList.add('hidden');
  G.Player.sens = opts.sens;
  DRS.target = opts.fpsTarget || 120;
  G.qualityMode = opts.quality;
  const q = resolveQuality(opts.quality);
  Auto.downN = 0; Auto.upT = 0; Auto.lastChange = performance.now();
  if (G.quality !== q) applyQuality(q);
  else DRS.reset(basePixelRatio(G.quality));
  G.World.setTimeOfDay(opts.tod);
  G.Game.start(opts);
  warmup();
  G.paused = false;
  G.Input.lock();
  // 레이트레이싱: 새 판의 장면을 로딩 화면에서 미리 컴파일 (게임 중 멈춤 없음)
  if (G.RT) { G.RT.invalidate(); G.RT.prepare(); }
};
G.resume = function () {
  G.Audio.init();
  G.UI.showPause(false);
  G.paused = false;
  G.Input.lock();
};
G.toMenu = function () {
  G.Game.cleanup();
  G.paused = false;
  G.Input.unlock();
  G.VM.set(null);
  G.UI.showMenu();
  camera.fov = 80; camera.updateProjectionMatrix();
  if (G.RT) { G.RT.invalidate(); G.RT.prepare(); }
};

function frame(now) {
  requestAnimationFrame(frame);
  const ms = now - last;
  let dt = ms / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 0.001;
  frameNo++;
  const Game = G.Game, tUpd = performance.now();
  try {
    if (Game.state === 'menu') {
      menuAng += dt * 0.025;
      const r = 360 * G.World.HALF / 500;
      camera.position.set(Math.cos(menuAng) * r, 150 + Math.sin(menuAng * 2) * 20, Math.sin(menuAng) * r);
      camera.lookAt(Math.cos(menuAng + 0.6) * 60, 12, Math.sin(menuAng + 0.6) * 60);
      camera.fov = 60; camera.updateProjectionMatrix();
      G.VM.set(null);
      G.FX.update(dt);
      benchFrame(ms);
    } else if (!G.paused) {
      Game.update(dt);
      G.FX.update(dt);
    }
    G.World.update(dt, camera.position, camera);
    G.Weather.update(dt);
    G.UI.update(dt);
    const a = Game.player;
    grade.uniforms.uKnock.value = U.damp(grade.uniforms.uKnock.value, a && a.knocked ? 1 : 0, 4, dt);
    DRS.frame(now, ms);
  } catch (e) {
    console.error(e);
    showError(e.message + '\n' + (e.stack || '').split('\n').slice(1, 3).join('\n'));
  }
  // 그림자 맵 갱신 주기: 중간·높음은 2프레임마다(느리면 매 프레임), 낮음은 3프레임마다, 최저는 그림자 없음
  const se = (QUALITY[G.quality] || QUALITY.high).shEvery;
  if (se && (frameNo % se === 0 || (se === 2 && ms > 14))) renderer.shadowMap.needsUpdate = true;
  // v67 텍스처 미리 올리기 (warmup 이 모은 목록을 프레임당 3 ms 까지)
  if (G.prewarmTex && G.prewarmTex.length) { const t0 = performance.now(); while (G.prewarmTex.length && performance.now() - t0 < 3) { try { renderer.initTexture(G.prewarmTex.pop()); } catch (e) { /* 무시 */ } } }
  const updMs = performance.now() - tUpd;
  if (G.Perf) G.Perf.frameStart();
  renderFrame(dt);
  if (G.Perf) G.Perf.frameEnd(ms, updMs);
  // 섬광: 맞은 순간의 화면을 잔상으로 붙잡는다 (그린 직후라야 WebGL 캔버스를 복사할 수 있다)
  if (G.Player && G.Player.freezeReq) { G.Player.freezeReq = false; G.UI.freezeFrame && G.UI.freezeFrame(renderer.domElement); }
  G.Input.endFrame();
}

})();
