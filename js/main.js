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
// 색보정 (선형 HDR, 톤매핑 전): 그림자는 살짝 차갑게, 밝은 곳은 따뜻하게, 대비 약간, 채도 살짝 낮춤
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.95 }, uSat: { value: 0.97 }, uKnock: { value: 0 }, uCon: { value: 1.07 },
    uShadow: { value: new THREE.Vector3(0.93, 0.98, 1.07) }, uHigh: { value: new THREE.Vector3(1.05, 1.0, 0.93) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; uniform float uSat; uniform float uKnock; uniform float uCon; uniform vec3 uShadow; uniform vec3 uHigh; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb *= mix(uShadow, uHigh, smoothstep(0.02, 0.7, l));
      c.rgb = 0.18 * pow(max(c.rgb, vec3(0.0)) / 0.18, vec3(uCon));
      l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat * (1.0 - uKnock * 0.8));
      c.rgb = mix(c.rgb, c.rgb * vec3(1.15, 0.7, 0.7), uKnock * 0.5);
      vec2 d = vUv - 0.5;
      c.rgb *= clamp(1.0 - dot(d, d) * uVig, 0.0, 1.0);
      gl_FragColor = c;
    }`
};
// 품질 프리셋
// dpr 해상도 배율 상한 · msaa · shadow 그림자 맵(0 = 끔) · range 그림자 범위 · bloom · post 후처리(끄면 화면에 바로 그림)
// far 시야 거리 · fog 안개 배율 · lod 건물 상세 거리 배율 · terr 지형 상세 거리 배율 · shEvery 그림자 갱신 주기(프레임)
const QUALITY = {
  potato: { dpr: 0.6,  msaa: 0, shadow: 0,    range: 0,  bloom: false, post: false, far: 750,  fog: 1.45, lod: 0.6, terr: 0.5,  shEvery: 0 },
  low:    { dpr: 0.75, msaa: 0, shadow: 1024, range: 42, bloom: false, post: false, far: 1100, fog: 1.2,  lod: 0.8, terr: 0.7,  shEvery: 3 },
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
const MAX_PIXELS = 2560 * 1440;

let renderer, scene, camera, composer, bloom, grade, last = 0, menuAng = 0, frameNo = 0;
G.paused = false;

/* ------------------------------------------------------------------ */
/* 동적 해상도 — 목표 FPS를 유지하도록 렌더 해상도를 자동 조절          */
/* ------------------------------------------------------------------ */
const DRS = {
  base: 1, scale: 1, applied: 0, minScale: 0.55, target: 120,
  iv: new Float32Array(120), ivN: 0, refresh: 1000 / 60, refreshEst: 1e9,
  acc: 0, cnt: 0, checkT: 0, lastDown: -1e9, lastChange: 0, fps: 0, fpsAcc: 0, fpsN: 0, fpsT: 0,
  reset(base) { this.base = base; this.scale = 1; this.lastDown = -1e9; this.apply(true); },
  apply(force) {
    const pr = Math.max(0.35, this.base * this.scale);
    if (!force && Math.abs(pr - this.applied) < 0.01) return;
    this.applied = pr;
    renderer.setPixelRatio(pr);
    if (composer && usePost()) composer.setPixelRatio(pr);
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
    if (ms > 100) return; // 백그라운드 탭 / 일시적 멈춤은 무시
    this.acc += ms; this.cnt++;
    if (now - this.checkT < 500) return;
    this.checkT = now;
    const avg = this.acc / this.cnt; this.acc = 0; this.cnt = 0;
    autoGovern(now, 1000 / avg, this);
    const goal = Math.max(1000 / this.target, this.refresh * 0.98);
    if (avg > goal * 1.1 && this.scale > this.minScale) {
      this.scale = Math.max(this.minScale, this.scale - (avg > goal * 1.5 ? 0.12 : 0.06));
      this.lastDown = now; this.apply();
    } else if (avg < goal * 1.03 && this.scale < 1 && now - this.lastDown > 4000 && now - this.lastChange > 2500) {
      this.scale = Math.min(1, this.scale + 0.05);
      this.lastChange = now; this.apply();
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

  scene = G.scene = new THREE.Scene();
  camera = G.camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 4000);
  camera.rotation.order = 'YXZ';
  G.vmScene = new THREE.Scene();
  G.vmCamera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.01, 10);

  G.Input.init(renderer.domElement);
  await G.World.init(scene, renderer, progress);
  progress(0.92, '효과 준비 중...');
  G.FX.init(scene);
  G.VM.init(G.vmScene);

  G.UI.init();
  if(G.G17Pilot)G.G17Pilot.init();
  if(G.M4Viewmodel)await G.M4Viewmodel.init();
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
  progress(1, '완료');
  document.getElementById('loading').classList.add('hidden');
  G.UI.showMenu();

  addEventListener('resize', onResize);
  renderer.domElement.addEventListener('click', () => {
    if ((G.Game.state === 'playing') && !G.Input.locked) G.resume();
  });
  G.onLockChange = (locked) => {
    if (G.Game.state !== 'playing') return;
    if(G.Attachments?.open){G.paused=true;G.UI.showPause(false);return;}
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
  composer.addPass(grade);
  composer.addPass(new THREE.OutputPass());
  composer.setSize(innerWidth, innerHeight);
  G.renderNow = () => renderFrame(0.016);
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
  G.World.setupGrass(q);
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
function usePost() { const Q = QUALITY[G.quality]; return !Q || Q.post; }
function renderFrame(dt) {
  const Q = QUALITY[G.quality];
  if (!Q || Q.post) { composer.render(dt); return; }
  renderer.setRenderTarget(null);
  renderer.autoClear = true;
  renderer.render(scene, camera);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(G.vmScene, G.vmCamera);
  renderer.autoClear = true;
}
G.__apply = (q) => applyQuality(q);
G.qualityLabel = () => (G.qualityMode === 'auto' ? '자동·' : '') + (TIER_NAME[G.quality] || '');

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  G.vmCamera.aspect = innerWidth / innerHeight; G.vmCamera.updateProjectionMatrix();
  if (G.quality) { DRS.base = basePixelRatio(G.quality); DRS.apply(true); }
  if (composer && usePost()) composer.setSize(innerWidth, innerHeight);
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
};

function frame(now) {
  requestAnimationFrame(frame);
  const ms = now - last;
  let dt = ms / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 0.001;
  frameNo++;
  const Game = G.Game;
  try {
    if (Game.state === 'menu') {
      menuAng += dt * 0.025;
      const r = 360 * G.World.HALF / 500;
      camera.position.set(Math.cos(menuAng) * r, 150 + Math.sin(menuAng * 2) * 20, Math.sin(menuAng) * r);
      camera.lookAt(Math.cos(menuAng + 0.6) * 60, 12, Math.sin(menuAng + 0.6) * 60);
      camera.fov = 60; camera.updateProjectionMatrix();
      G.VM.set(null);
      G.FX.update(dt);
    } else if (!G.paused) {
      Game.update(dt);
      G.FX.update(dt);
    }
    G.World.update(dt, camera.position, camera);
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
  renderFrame(dt);
  G.Input.endFrame();
}

})();
