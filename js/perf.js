// v68 성능 오버레이 — F3 또는 주소 뒤 ?perf=1 로 켠다 (?perf=sync : 타이머 쿼리가 없는 기기에서 1픽셀 읽기로 GPU 를 기다리며 잰다, 느려짐)
//  FPS · 프레임 시간 · 1% low · 패스별 GPU 시간(그림자, 장면, 1인칭 총, 블룸, 색보정, 출력, FXAA, 업스케일)
//  · draw calls · 삼각형 · 텍스처/지오메트리/셰이더 수 · 내부/출력 해상도 · DRS 배율
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const P = G.Perf = {
    on: false, show: false, quiet: false, sync: qs.get('perf') === 'sync',
    ft: new Float32Array(600), ftN: 0,
    gpu: {}, cpu: { update: 0, submit: 0 }, info: {},
    cur: null, t0: 0, gl: null, ext: null, pool: [], pending: [],
    el: null, showT: 0
  };
  // 브라우저의 gl.finish 는 실제로 기다리지 않는 경우가 많다 → 1×1 픽셀을 읽어 앞선 GPU 작업이 끝날 때까지 막는다
  let syncFb = null; const px = new Uint8Array(4);
  function gpuWait() {
    const gl = P.gl;
    if (!syncFb) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      syncFb = gl.createFramebuffer();
      const rb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, syncFb); gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rb);
      P.renderer.state.reset && P.renderer.resetState();   // 텍스처 바인딩을 건드렸으니 three 의 캐시를 비운다
    }
    const rb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, syncFb);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rb);
  }
  P.gpuWait = () => gpuWait();
  function ema(o, k, v) { o[k] = o[k] === undefined ? v : o[k] * 0.9 + v * 0.1; }

  P.init = function (renderer) {
    P.renderer = renderer;
    P.gl = renderer.getContext();
    try { P.ext = P.gl.getExtension('EXT_disjoint_timer_query_webgl2'); } catch (e) { P.ext = null; }
    // 그림자 맵은 RenderPass 안에서 그려진다 → 따로 끊어서 잰다
    const sm = renderer.shadowMap, r0 = sm.render.bind(sm);
    sm.render = function (lights, scene, camera) {
      if (!P.on || !P.cur) return r0(lights, scene, camera);
      const back = P.cur; P.seg('shadow'); r0(lights, scene, camera); P.seg(back);
    };
    if (qs.has('perf')) P.toggle(true);
    addEventListener('keydown', e => { if (e.code === 'F3') { e.preventDefault(); P.toggle(); } });
  };
  // 오버레이 없이 시간만 잰다 (자동 품질 측정용)
  P.setQuiet = function (v) { P.quiet = !!v; setOn(P.show || P.quiet); };
  function setOn(v) {
    if (P.on === v) return;
    if (!v) closeCur();
    P.on = v;
    if (P.renderer) { P.renderer.info.autoReset = !P.on; P.renderer.info.reset(); }
  }
  P.toggle = function (v) {
    P.show = v === undefined ? !P.show : !!v;
    setOn(P.show || P.quiet);
    if (P.show && !P.el) {
      P.el = document.createElement('pre');
      P.el.id = 'perfOverlay';
      P.el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;margin:0;padding:6px 8px;background:rgba(0,0,0,.72);color:#9f9;font:11px/1.35 Consolas,monospace;pointer-events:none;white-space:pre;border-radius:4px';
      document.body.appendChild(P.el);
    }
    if (P.el) P.el.style.display = P.show ? '' : 'none';
  };
  // 이름 붙은 패스 감싸기 (composer 를 새로 만들 때마다 부른다)
  const NAMES = [['RenderPass', 'scene'], ['ViewmodelPass', 'viewmodel'], ['UnrealBloomPass', 'bloom'], ['OutputPass', 'output']];
  P.hookComposer = function (composer, names) {
    for (const p of composer.passes) {
      if (p.__perf) continue;
      let n = names && names.get(p);
      if (!n) for (const [c, nm] of NAMES) if (p.constructor && p.constructor.name === c) n = nm;
      n = n || (p.constructor && p.constructor.name) || 'pass';
      const r = p.render;
      p.render = function () { if (P.on && this.enabled !== false) P.seg(n); return r.apply(this, arguments); };
      p.__perf = n;
    }
  };

  // ---- 구간 시간 재기: 앞 구간을 닫고 새 구간을 연다 (타이머 쿼리는 겹칠 수 없어서) ----
  function closeCur() {
    if (!P.cur) return;
    if (P.ext && !P.sync) { P.gl.endQuery(P.ext.TIME_ELAPSED_EXT); }
    else if (P.sync) { gpuWait(); P.acc[P.cur] = (P.acc[P.cur] || 0) + performance.now() - P.t0; }
    P.cur = null;
  }
  P.seg = function (name) {
    if (!P.on) return;
    closeCur();
    P.cur = name;
    if (P.ext && !P.sync) {
      const q = P.pool.pop() || P.gl.createQuery();
      P.gl.beginQuery(P.ext.TIME_ELAPSED_EXT, q);
      P.pending.push({ q, name, f: P.frameId });
    } else if (P.sync) { P.t0 = performance.now(); }
  };
  P.frameId = 0; P.acc = {};
  P.frameStart = function () {
    if (!P.on) return;
    P.frameId++; P.acc = {};
    P.renderer.info.reset();
    if (P.sync) gpuWait();
    P.tSubmit = performance.now();
  };
  P.frameEnd = function (ms, updMs) {
    // 프레임 간격은 켜져 있지 않아도 쌓아 둔다 (켜는 순간 바로 1% low 가 나오게)
    P.ft[P.ftN++ % P.ft.length] = ms;
    if (!P.on) return;
    closeCur();
    ema(P.cpu, 'submit', performance.now() - P.tSubmit);
    ema(P.cpu, 'update', updMs);
    if (P.sync) {
      const seen = {};
      for (const k in P.acc) { ema(P.gpu, k, P.acc[k]); seen[k] = 1; }
      for (const k in P.gpu) if (!seen[k]) ema(P.gpu, k, 0);
    } else if (P.ext) {
      // 결과는 몇 프레임 뒤에 나온다: 준비된 것만 모은다
      const gl = P.gl, disjoint = gl.getParameter(P.ext.GPU_DISJOINT_EXT), sum = {};
      let f = -1, done = 0;
      while (done < P.pending.length) {
        const e = P.pending[done];
        if (!gl.getQueryParameter(e.q, gl.QUERY_RESULT_AVAILABLE)) break;
        if (f !== e.f && f >= 0) { flush(sum); for (const k in sum) delete sum[k]; }
        f = e.f;
        if (!disjoint) sum[e.name] = (sum[e.name] || 0) + gl.getQueryParameter(e.q, gl.QUERY_RESULT) / 1e6;
        P.pool.push(e.q); done++;
      }
      if (f >= 0) flush(sum);
      if (done) P.pending.splice(0, done);
      if (P.pending.length > 400) { for (const e of P.pending) gl.deleteQuery(e.q); P.pending.length = 0; }
    }
    const i = P.renderer.info;
    P.info = { calls: i.render.calls, tris: i.render.triangles, tex: i.memory.textures, geo: i.memory.geometries, prog: i.programs ? i.programs.length : 0 };
    const now = performance.now();
    if (P.show && now - P.showT > 250) { P.showT = now; draw(); }
  };
  function flush(sum) {
    const seen = {};
    for (const k in sum) { ema(P.gpu, k, sum[k]); seen[k] = 1; }
    for (const k in P.gpu) if (!seen[k]) ema(P.gpu, k, 0);
  }
  // 최근 프레임 통계 (n 개)
  P.stats = function (n) {
    n = Math.min(n || 300, P.ftN, P.ft.length);
    const a = [];
    for (let k = 0; k < n; k++) a.push(P.ft[(P.ftN - 1 - k + P.ft.length * 4) % P.ft.length]);
    if (!a.length) return { fps: 0, avg: 0, low1: 0 };
    const avg = a.reduce((s, v) => s + v, 0) / a.length;
    a.sort((x, y) => y - x);
    const w = a.slice(0, Math.max(1, Math.floor(a.length / 100)));
    const worst = w.reduce((s, v) => s + v, 0) / w.length;
    let gsum = 0; for (const k in P.gpu) gsum += P.gpu[k];
    P.hasGpu = !!(P.ext && !P.sync && Object.keys(P.gpu).length);
    return { fps: 1000 / avg, avg, low1: 1000 / worst, gpu: Object.assign({}, P.gpu), gpuTotal: gsum, cpu: Object.assign({}, P.cpu), info: Object.assign({}, P.info) };
  };
  const ORDER = ['shadow', 'scene', 'viewmodel', 'bloom', 'grade', 'output', 'fxaa', 'upscale', 'post'];
  function draw() {
    const s = P.stats(300), r = P.renderer, D = G.DRS || {};
    const sz = r.getDrawingBufferSize(new THREE.Vector2());
    const cr = G.composerRT && G.composerRT();
    const vm = G.viewmodelRT && G.viewmodelRT();
    const lines = [
      `FPS ${s.fps.toFixed(0)}  ${s.avg.toFixed(1)}ms  1%low ${s.low1.toFixed(0)}`,
      `품질 ${G.qualityLabel ? G.qualityLabel() : ''}  DRS ${((D.scale || 1) * 100).toFixed(0)}%`,
      `장면 ${cr ? Math.round(cr.width) + 'x' + Math.round(cr.height) : '-'}  화면 ${sz.x}x${sz.y}`,
      `CPU 갱신 ${s.cpu.update.toFixed(2)}ms  제출 ${s.cpu.submit.toFixed(2)}ms`,
      `GPU ${P.ext && !P.sync ? '' : P.sync ? '(sync) ' : '(타이머 없음: ?perf=sync) '}${s.gpuTotal.toFixed(2)}ms`
    ];
    if (vm && vm.width > 1) lines.splice(3, 0, `총·손 ${Math.round(vm.width)}x${Math.round(vm.height)}`);
    const ks = Object.keys(P.gpu).sort((a, b) => (ORDER.indexOf(a) + 99 * (ORDER.indexOf(a) < 0)) - (ORDER.indexOf(b) + 99 * (ORDER.indexOf(b) < 0)));
    for (const k of ks) lines.push(`  ${k.padEnd(10)} ${P.gpu[k].toFixed(2)}`);
    lines.push(`draw ${s.info.calls}  tris ${(s.info.tris / 1000).toFixed(0)}k`);
    lines.push(`tex ${s.info.tex}  geo ${s.info.geo}  prog ${s.info.prog}`);
    P.el.textContent = lines.join('\n');
  }
})();
