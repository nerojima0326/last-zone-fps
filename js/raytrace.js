// raytrace.js — 실시간 레이트레이싱 조명 (실험, v50)
//  three-realtime-rt (ThreeRT, MIT, https://github.com/GoldwinXS/three-realtime-rt) 를 설정에서 켜면
//  게임 장면(훈련장·필드)을 하이브리드 디퍼드 방식으로 그린다: three.js 가 G-버퍼를 그리고,
//  BVH 로 그림자·반사·(고사양이면) 1회 반사광을 추적한다.
//
//  이 게임에 맞춘 부분
//   · 인스턴스 모델(나무·풀·바위·모래주머니), 파티클·스프라이트, 투명·가산 혼합, 커스텀 셰이더(하늘 등)는
//     ThreeRT 가 그리지 못한다 → 레이어 2 로 옮겨 '덧그리기'로 그린다: RT 화면 위에 RT 대상 물체의
//     깊이만 다시 그린 뒤(깊이 프리패스) 평소 방식으로 그려 가려짐이 맞게 한다. 이 물체들은 RT 그림자를
//     드리우지 않는다.
//   · 사람(봇·플레이어 모델)과 전리품은 BVH 에서 뺀다 (G-버퍼에는 그려져 조명을 받는다) — 20명 CPU
//     스키닝 비용과 주운 전리품이 남기는 '유령 그림자'를 피한다.
//   · 차량과 훈련장 표적은 움직이는 물체(dynamicMeshes)로 등록해 매 프레임 갱신 → 그림자가 따라간다.
//   · 게임은 노출(시간대별 0.5~0.7)을 곱한 ACES 톤매핑을 쓰는데 ThreeRT 합성은 노출이 없다: RT 에 넘기는 조명 세기에 노출을 곱한다.
//   · HDR 하늘 사진(배경 텍스처)은 RT 화면에 없으므로, 먼 구에 입혀 덧그리기 단계에서 빈 하늘에만 그린다.
//   · ThreeRT 는 자체 품질 조절(목표 FPS)을 하므로 켜져 있는 동안 게임의 동적 해상도는 멈춘다.
//  지원하지 않는 기기(소프트웨어 렌더러, EXT_color_buffer_float 없음)면 꺼진 채로 안내만 한다.
(function () {
'use strict';
const G = window.G, THREE = window.THREE;
const KEY = 'lastzone_rt', OVER = 2;

function load() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
function save(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* 이번 실행만 */ } }

// ThreeRT 의 G-버퍼로 표현할 수 없는 재질 → 덧그리기
function overlayMat(m) {
  if (!m) return false;
  if (Array.isArray(m)) return m.some(overlayMat);
  return m.isShaderMaterial || m.isRawShaderMaterial || m.isPointsMaterial || m.isSpriteMaterial || m.isLineBasicMaterial ||
    m.transparent || (m.blending !== undefined && m.blending !== THREE.NormalBlending) || m.depthWrite === false;
}

const RT = G.RT = {
  wanted: load(),
  state: 'off',          // off | loading | on | unsupported | error
  msg: '',
  rt: null, dirty: true, frame: 0,
  tagged: new Set(), excluded: new Set(), dyn: [], lights: [], lightKey: '',
  size: new THREE.Vector2(), last: new THREE.Vector2(-1, -1),
  depthMat: null,

  label() {
    if (this.state === 'loading') return '불러오는 중…';
    if (this.state === 'unsupported') return '지원 안 됨';
    if (this.state === 'error') return '오류';
    return this.wanted && this.state === 'on' ? '켜짐' : '꺼짐';
  },
  active() { return this.wanted && this.state === 'on' && !!this.rt; },
  // 이번 프레임을 RT 로 그릴지 (컴파일 준비 중에는 평소 방식)
  drawing() { return this.active() && !this.preparing; },
  async setEnabled(on) {
    this.wanted = !!on; save(this.wanted);
    if (this.wanted) { await this.start(); await this.prepare(); } else this.stop();
    if (G.Settings) G.Settings.render();
  },
  // v54: 장면 컴파일(BVH 만들기)은 몇 초 걸려 게임이 멈춘 것처럼 보인다 → 로딩 화면을 띄운 채로 미리 한다.
  //  게임 시작 로딩 · 판 시작 · 메뉴로 돌아갈 때 · 설정에서 켤 때 부른다. 게임 중에는 다시 컴파일하지 않는다.
  preparing: false,
  async prepare(text) {
    if (!this.active() || !this.dirty || this.preparing) return;
    this.preparing = true;
    const L = document.getElementById('loading'), T = document.getElementById('loadText'), F = document.getElementById('loadFill');
    const hidden = L.classList.contains('hidden'), oldText = T.textContent;
    L.classList.remove('hidden'); T.textContent = text || '레이트레이싱 장면 준비 중... (몇 초 걸립니다)'; F.style.width = '100%';
    await new Promise(r => setTimeout(r, 80));   // 로딩 화면이 먼저 그려지게
    try { this.compile(G.scene); }
    catch (e) { console.warn('[RT] 컴파일 실패', e); this.wanted = false; save(false); this.state = 'error'; this.msg = '레이트레이싱 장면을 준비하지 못해 껐습니다'; }
    this.preparing = false;
    if (hidden) L.classList.add('hidden'); else T.textContent = oldText;
  },
  async init() {
    // 그래픽 장치가 감당하지 못해 WebGL 이 끊기면 레이트레이싱을 끈 채로 저장 (다음 실행에서 또 끊기지 않게)
    G.renderer.domElement.addEventListener('webglcontextlost', () => {
      if (!this.rt) return;
      const was = this.active();
      this.rt = null; this.untag();
      if (was) { this.wanted = false; save(false); this.state = 'error'; this.msg = '그래픽 장치가 감당하지 못해 레이트레이싱을 껐습니다'; console.warn('[RT] WebGL 컨텍스트 손실 — 레이트레이싱 끔'); }
      else this.state = 'off';
      if (G.Settings) G.Settings.render();
    });
    if (this.wanted) await this.start();
  },
  async start() {
    if (this.rt) { this.state = 'on'; this.dirty = true; return; }
    if (location.protocol === 'file:') { this.state = 'error'; this.msg = '로컬 파일(file://)에서는 쓸 수 없습니다'; this.wanted = false; return; }
    this.state = 'loading'; if (G.Settings) G.Settings.render();
    try {
      const mod = await import('three-realtime-rt');
      const R = mod.RealtimeRaytracer, renderer = G.renderer;
      if (!R.isSupported(renderer)) { this.state = 'unsupported'; this.msg = '이 그래픽 장치에서는 레이트레이싱을 쓸 수 없습니다 (WebGL2 · 부동소수점 렌더 타깃 필요)'; this.wanted = false; save(false); return; }
      let opts = {};
      try { opts = R.recommendedOptions(R.detectTier(renderer)) || {}; } catch (e) { opts = {}; }
      opts = Object.assign({}, opts, { targetFps: 55, overscan: 0 });
      renderer.getDrawingBufferSize(this.size);
      this.rt = new R(renderer, opts);
      if (this.rt.supported === false) { this.rt.dispose && this.rt.dispose(); this.rt = null; this.state = 'unsupported'; this.wanted = false; save(false); return; }
      this.depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
      this.last.set(-1, -1);
      this.state = 'on'; this.dirty = true; this.msg = '';
      console.info('[RT] three-realtime-rt 켜짐', this.rt.tier || '');
    } catch (e) {
      console.warn('[RT] 불러오기 실패', e);
      this.state = 'error'; this.msg = '레이트레이싱 모듈을 불러오지 못했습니다: ' + e.message; this.wanted = false; save(false);
    }
  },
  stop() {
    this.untag();
    if (G.Training && G.Training.syncLamps) setTimeout(() => G.Training.syncLamps(), 0);   // state 가 바뀐 뒤 훈련장 조명 광원 빼기
    if (this.rt) { try { this.rt.releaseTargets && this.rt.releaseTargets(); } catch (e) { /* 무시 */ } }
    if (this.state === 'on') this.state = 'off';
  },
  // 새 판·메뉴 전환 등 장면 구성이 크게 바뀌면 다시 컴파일
  invalidate() { this.dirty = true; },

  /* ---------- 장면 분류 ---------- */
  tag(scene) {
    scene.traverse(o => {
      if (o.userData.__rt) return;
      const over = o.isPoints || o.isSprite || o.isLine || o.isInstancedMesh || (o.isMesh && (overlayMat(o.material) || (o.geometry && o.geometry.isInstancedBufferGeometry)));
      if (!over) return;
      o.userData.__rt = { mask: o.layers.mask, ex: o.userData.rtExclude };
      o.layers.set(OVER); o.userData.rtExclude = true;
      this.tagged.add(o);
    });
  },
  untag() {
    for (const o of this.tagged) { const s = o.userData.__rt; if (!s) continue; o.layers.mask = s.mask; o.userData.rtExclude = s.ex; delete o.userData.__rt; }
    this.tagged.clear();
    for (const o of this.excluded) { if (o.userData.__rtEx !== undefined) { o.userData.rtExclude = o.userData.__rtEx; delete o.userData.__rtEx; } }
    this.excluded.clear();
  },
  exclude(root) {
    if (!root) return;
    root.traverse(o => { if (o.isMesh && o.userData.__rtEx === undefined) { o.userData.__rtEx = o.userData.rtExclude; o.userData.rtExclude = true; this.excluded.add(o); } });
  },
  compile(scene) {
    const Game = G.Game;
    this.tag(scene);
    // 사람 · 전리품: BVH 에서 뺀다
    for (const a of Game.actors || []) { const m = a.model; if (m) { this.exclude(m.root); this.exclude(m.lodMesh); this.exclude(m.helmetMesh); } }
    for (const it of Game.loot || []) this.exclude(it.mesh);
    // 움직이는 물체: 차량
    this.dyn = [];
    for (const v of (G.Vehicles && G.Vehicles.list) || []) v.mesh.traverse(o => { if (o.isMesh && !o.userData.rtExclude) this.dyn.push(o); });
    // 훈련장 표적 (좌우로 움직이고, 맞으면 넘어간다)
    const T = G.Training;
    if (T && T.active) for (const t of T.targets || []) if (t.root) t.root.traverse(o => { if (o.isMesh && !o.userData.rtExclude) this.dyn.push(o); });
    // 조명 목록 (훈련장 지붕 조명은 RT 일 때만 광원으로)
    if (G.Training && G.Training.syncLamps) G.Training.syncLamps();
    this.lights = [];
    scene.traverse(o => { if (o.isLight) this.lights.push(o); });
    const t0 = performance.now();
    this.scaleLights(true);
    try { this.rt.compileScene(scene, { dynamicMeshes: this.dyn }); }
    finally { this.scaleLights(false); }
    this.lightKey = '';
    this.rt.resetAccumulation && this.rt.resetAccumulation();
    console.info('[RT] 장면 컴파일', Math.round(performance.now() - t0) + ' ms', '움직이는 메시', this.dyn.length, '덧그리기', this.tagged.size);
    this.dirty = false;
  },
  // RT 에 넘길 때만 조명을 노출(0.6)만큼 낮춘다
  scaleLights(on) {
    const k = G.renderer.toneMappingExposure;
    for (const l of this.lights) {
      if (on) { l.userData.__rtI = l.intensity; l.intensity *= k; }
      else if (l.userData.__rtI !== undefined) { l.intensity = l.userData.__rtI; delete l.userData.__rtI; }
    }
  },
  syncLights(scene) {
    // 바뀐 조명이 있을 때만 다시 읽힌다 (총구 섬광 조명 · 시간대 · 손전등)
    let k = '';
    k += G.renderer.toneMappingExposure.toFixed(3) + '|';
    for (const l of this.lights) k += (l.visible ? 1 : 0) + ',' + l.intensity.toFixed(2) + ',' + l.position.x.toFixed(1) + ',' + l.position.y.toFixed(1) + ',' + l.position.z.toFixed(1) + ',' + l.color.getHex() + ';';
    if (k === this.lightKey) return;
    this.lightKey = k;
    this.scaleLights(true);
    try { this.rt.updateLights(scene); } finally { this.scaleLights(false); }
  },

  // 배경 텍스처(HDR 하늘 사진): 깊이가 비어 있는(하늘) 곳에만 그린다
  drawBackground(renderer, scene, camera, bg) {
    if (!bg || !bg.isTexture || bg.isCubeTexture) return;
    if (!this.bgScene) {
      this.bgScene = new THREE.Scene();
      const geo = new THREE.SphereGeometry(1, 48, 24); geo.scale(-1, 1, 1);
      this.bgMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ depthWrite: false, fog: false }));
      this.bgMesh.rotation.y = Math.PI;   // three 의 등장방형 배경과 같은 방향
      this.bgMesh.frustumCulled = false;
      this.bgScene.add(this.bgMesh);
    }
    const m = this.bgMesh.material;
    if (m.map !== bg) { m.map = bg; m.needsUpdate = true; }
    m.color.setScalar(scene.backgroundIntensity !== undefined ? scene.backgroundIntensity : 1);
    this.bgMesh.position.copy(camera.position);
    this.bgMesh.scale.setScalar(camera.far * 0.9);
    const mask = camera.layers.mask; camera.layers.set(0);
    renderer.render(this.bgScene, camera);
    camera.layers.mask = mask;
  },
  /* ---------- 그리기 ---------- */
  render(renderer, scene, camera, vmScene, vmCamera) {
    const rt = this.rt;
    renderer.getDrawingBufferSize(this.size);
    if (!this.size.equals(this.last)) { rt.setSize(this.size.x, this.size.y); this.last.copy(this.size); }
    if (this.dirty) this.compile(scene);
    else if (++this.frame % 60 === 0) {
      // 새로 생긴 파티클 · 효과 물체 분류, 새 전리품 제외
      this.tag(scene);
      for (const it of G.Game.loot || []) if (it.mesh && it.mesh.userData.__rtEx === undefined) this.exclude(it.mesh);
    }
    // 안개 · 조명 · 움직이는 차량
    const f = scene.fog;
    rt.fog.enabled = !!(f && f.isFogExp2);
    if (rt.fog.enabled) { rt.fog.color.copy(f.color); rt.fog.density = f.density; }
    this.syncLights(scene);
    if (this.dyn.length) rt.updateDynamic();

    const mask = camera.layers.mask, ac = renderer.autoClear, su = renderer.shadowMap.autoUpdate, bg = scene.background;
    camera.layers.set(0);
    rt.render(scene, camera);
    // 덧그리기: RT 물체의 깊이만 다시 → 레이어 2 물체(하늘·나무·파티클·투명)를 평소처럼
    renderer.setRenderTarget(null);
    renderer.autoClear = false;
    renderer.clearDepth();
    scene.overrideMaterial = this.depthMat; renderer.shadowMap.autoUpdate = false; scene.background = null;
    renderer.render(scene, camera);
    scene.overrideMaterial = null; renderer.shadowMap.autoUpdate = su;
    this.drawBackground(renderer, scene, camera, bg);
    camera.layers.set(OVER);
    renderer.render(scene, camera);
    camera.layers.mask = mask; scene.background = bg;
    // 1인칭 무기
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);
    renderer.autoClear = ac;
  }
};
})();
