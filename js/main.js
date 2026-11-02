// main.js — 렌더러, 후처리, 동적 해상도, 메인 루프, 게임 시작/일시정지
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;

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
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.9 }, uSat: { value: 1.08 }, uKnock: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; uniform float uSat; uniform float uKnock; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat * (1.0 - uKnock * 0.8));
      c.rgb = mix(c.rgb, c.rgb * vec3(1.15, 0.7, 0.7), uKnock * 0.5);
      vec2 d = vUv - 0.5;
      c.rgb *= clamp(1.0 - dot(d, d) * uVig, 0.0, 1.0);
      gl_FragColor = c;
    }`
};
// 품질 프리셋: 해상도 배율 상한, MSAA, 그림자, 블룸, 풀
const QUALITY = {
  low:    { dpr: 0.8,  msaa: 0, shadow: 1024, range: 50, bloom: false },
  medium: { dpr: 1.0,  msaa: 2, shadow: 2048, range: 65, bloom: true },
  high:   { dpr: 1.25, msaa: 4, shadow: 2048, range: 75, bloom: true }
};
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
    if (composer) composer.setPixelRatio(pr);
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
  G.World.setTimeOfDay(G.UI.opts.tod || 'day');
  G.Player.sens = G.UI.opts.sens;
  DRS.target = G.UI.opts.fpsTarget || 120;
  applyQuality(G.UI.opts.quality);
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
  G.renderNow = () => composer.render(0.016);
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
  if (G.quality !== q || !composer) setupComposer(Q.msaa);
  const sun = G.World.sun;
  if (sun.shadow.mapSize.x !== Q.shadow) {
    sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  const sc = sun.shadow.camera; sc.left = -Q.range; sc.right = Q.range; sc.top = Q.range; sc.bottom = -Q.range; sc.updateProjectionMatrix();
  bloom.enabled = Q.bloom;
  G.World.setupGrass(q);
  G.quality = q;
  DRS.reset(basePixelRatio(q));
  onResize();
  renderer.shadowMap.needsUpdate = true;
}

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  G.vmCamera.aspect = innerWidth / innerHeight; G.vmCamera.updateProjectionMatrix();
  if (G.quality) { DRS.base = basePixelRatio(G.quality); DRS.apply(true); }
  if (composer) composer.setSize(innerWidth, innerHeight);
}

// 매치 시작 시 사용될 셰이더를 미리 컴파일해 첫 사용 시 끊김을 없앤다
function warmup() {
  const shown = [];
  const show = o => { if (o && !o.visible) { o.visible = true; shown.push(o); } };
  const temp = [];
  for (const it of G.Game.loot) show(it.mesh);
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
  if (G.quality !== opts.quality) applyQuality(opts.quality);
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
  // 그림자 맵은 2프레임마다 갱신 (높은 주사율에서도 60Hz 이상 유지)
  if (frameNo % 2 === 0 || ms > 14) renderer.shadowMap.needsUpdate = true;
  composer.render(dt);
  G.Input.endFrame();
}

})();
