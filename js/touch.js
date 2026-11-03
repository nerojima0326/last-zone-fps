'use strict';
/* ------------------------------------------------------------------ */
/* 휴대폰 터치 조작: 고정 조이스틱(이동) · 화면 드래그(시점) · 버튼       */
/* 버튼은 키보드/마우스 입력(G.Input)을 그대로 흉내 내므로 게임 코드는 그대로 쓴다 */
/* 버튼·조이스틱 위치와 크기는 사용자가 직접 바꿀 수 있다 (기기에 저장)     */
/* ------------------------------------------------------------------ */
(function () {
  const root = document.documentElement;
  if (!root.classList.contains('mobile')) return;
  const I = G.Input;

  // 포인터 잠금 대신 '조작 중' 상태만 바꾼다
  I.lock = function () {
    if (this.locked) return;
    this.locked = true;
    if (G.onLockChange) G.onLockChange(true);
  };
  I.unlock = function () {
    if (!this.locked) return;
    this.locked = false;
    releaseAll();
    if (G.onLockChange) G.onLockChange(false);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.Game && G.Game.state === 'playing') I.unlock(); });

  // 실제 화면 좌표 → 가상 화면(body) 좌표 (index.html 의 화면 맞춤과 짝)
  function toStage(x, y) {
    const s = window.__stageScale || 1;
    if (window.__stageRot) return [y / s, (root.clientWidth - x) / s];
    return [x / s, y / s];
  }

  /* ---------------- 버튼 목록과 기본 배치 ---------------- */
  // ax: 기준 가장자리(l 왼쪽 / r 오른쪽), x: 그 가장자리에서 중심까지, y: 위에서 중심까지 (가상 화면 높이 720 기준), d: 지름
  const ITEMS = [
    { id: 'stick', name: '이동 조이스틱', ax: 'l', x: 230, y: 520, d: 200 },
    { id: 'fire', name: '발사', html: '<span>발사</span>', act: 'fire', cls: 'tb-fire', ax: 'r', x: 150, y: 530, d: 160, fs: 28 },
    { id: 'fire2', name: '발사 (왼쪽)', html: '<span>발사</span>', act: 'fire', cls: 'tb-fire', ax: 'l', x: 95, y: 355, d: 110, fs: 22 },
    { id: 'ads', name: '조준', html: '<span>조준</span>', act: 'ads', ax: 'r', x: 317, y: 615, d: 110 },
    { id: 'jump', name: '점프', html: '<span>점프</span>', act: 'key', key: 'Space', ax: 'r', x: 90, y: 370, d: 100 },
    { id: 'crouch', name: '앉기', html: '<span>앉기</span>', act: 'key', key: 'KeyC', ax: 'r', x: 216, y: 374, d: 92 },
    { id: 'reload', name: '장전', html: '<span>장전</span>', act: 'key', key: 'KeyR', ax: 'r', x: 314, y: 484, d: 92 },
    { id: 'f', name: '줍기', html: '<span class="tF">줍기</span>', act: 'key', key: 'KeyF', cls: 'tb-f', ax: 'r', x: 450, y: 420, d: 100 },
    { id: 'wheel', name: '무기 교체', html: '<span>무기<br>교체</span>', act: 'wheel', ax: 'r', x: 411, y: 253, d: 74, fs: 16 },
    { id: 'scope', name: '배율', html: '<span>배율</span>', act: 'key', key: 'KeyV', ax: 'r', x: 325, y: 253, d: 74, fs: 16 },
    { id: 'mode', name: '연사', html: '<span>연사</span>', act: 'key', key: 'KeyB', ax: 'r', x: 239, y: 253, d: 74, fs: 16 },
    { id: 'throw', name: '투척', html: '<span>투척</span>', act: 'key', key: 'KeyG', ax: 'r', x: 153, y: 253, d: 74, fs: 16 },
    { id: 'heal', name: '치료', html: '<span>치료</span>', act: 'key', key: 'KeyH', ax: 'r', x: 67, y: 253, d: 74, fs: 16 },
    { id: 'pause', name: '일시정지', html: '<span>Ⅱ</span>', act: 'pause', ax: 'l', x: 277, y: 67, d: 74, fs: 16 },
    { id: 'map', name: '지도', html: '<span>지도</span>', act: 'key', key: 'KeyM', ax: 'l', x: 363, y: 67, d: 74, fs: 16 }
  ];
  const BY = {};
  for (const it of ITEMS) BY[it.id] = it;
  const SAVE_KEY = 'lz_touch_layout_v1';
  let layout = {};
  try { layout = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch (e) { layout = {}; }
  const saveLayout = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(layout)); } catch (e) { /* 저장 안 되면 이번 판만 */ } };

  /* ---------------- UI 만들기 ---------------- */
  const ui = document.createElement('div');
  ui.id = 'touchUI';
  let html = '<div id="tStick" class="tItem" data-id="stick"><div id="tKnob"></div><div id="tSprint">달리기</div></div>';
  for (const it of ITEMS) {
    if (it.id === 'stick') continue;
    html += `<button class="tb tItem ${it.cls || ''}" data-id="${it.id}" data-act="${it.act}"${it.key ? ` data-key="${it.key}"` : ''}>${it.html}</button>`;
  }
  ui.innerHTML = html;
  document.body.appendChild(ui);
  for (const el of ui.querySelectorAll('.tItem')) BY[el.dataset.id].el = el;
  const stick = BY.stick.el, knob = ui.querySelector('#tKnob'), sprintTag = ui.querySelector('#tSprint');
  const fLabel = ui.querySelector('.tF'), fBtn = BY.f.el, adsBtn = BY.ads.el;

  // 편집 도구 막대
  const bar = document.createElement('div');
  bar.id = 'touchEditBar';
  bar.innerHTML = `
    <div class="teInfo"><b>버튼 위치 바꾸기</b><span id="teSel">버튼을 눌러 끌어서 옮기세요</span></div>
    <div class="teBtns">
      <button data-e="smaller">작게</button><button data-e="bigger">크게</button>
      <button data-e="reset1">이 버튼 기본값</button><button data-e="resetAll">전체 기본값</button>
      <button data-e="bar">막대 ⇅</button>
      <button data-e="done" class="teDone">완료</button>
    </div>`;
  document.body.appendChild(bar);
  const selInfo = bar.querySelector('#teSel');

  /* ---------------- 배치 계산 ---------------- */
  // 저장값은 화면 비율이 달라도 맞도록 가상 화면 너비·높이에 대한 비율(fx, fy)과 크기 배율(k)
  function place(it) {
    const VW = innerWidth, VH = innerHeight;
    const L = layout[it.id];
    const k = L && L.k ? L.k : 1;
    const d = it.d * k;
    let cx = it.ax === 'r' ? VW - it.x : it.x, cy = it.y * VH / 720;
    if (L && L.fx !== undefined) { cx = L.fx * VW; cy = L.fy * VH; }
    cx = Math.min(VW - d / 2, Math.max(d / 2, cx)); cy = Math.min(VH - d / 2, Math.max(d / 2, cy));
    it.cx = cx; it.cy = cy; it.r = d / 2;
    const s = it.el.style;
    s.left = (cx - d / 2) + 'px'; s.top = (cy - d / 2) + 'px'; s.width = d + 'px'; s.height = d + 'px';
    if (it.fs) s.fontSize = (it.fs * k) + 'px'; else if (it.id !== 'stick') s.fontSize = (20 * k) + 'px';
    if (it.id === 'stick') { knob.style.width = knob.style.height = (d * 0.44) + 'px'; }
  }
  function applyLayout() { for (const it of ITEMS) place(it); }
  applyLayout();
  addEventListener('resize', () => setTimeout(applyLayout, 30));

  /* ---------------- 입력 상태 ---------------- */
  const touches = new Map();      // identifier → { role, ... }
  let adsOn = false;
  const LOOK = 1.7;               // 드래그 → 마우스 이동량 배율

  function press(code) { if (!I.keys[code]) I.hits[code] = true; I.keys[code] = true; }
  function release(code) { I.keys[code] = false; }
  function setMove(nx, ny) {
    I.keys.KeyW = ny < -0.3; I.keys.KeyS = ny > 0.3;
    I.keys.KeyA = nx < -0.3; I.keys.KeyD = nx > 0.3;
    const sprint = ny < -0.85 && Math.abs(nx) < 0.5;
    I.keys.ShiftLeft = sprint;
    sprintTag.classList.toggle('on', sprint);
  }
  function setKnob(dx, dy) { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; }
  function releaseAll() {
    touches.clear();
    I.keys = {}; I.lmb = false; I.rmb = false; adsOn = false;
    adsBtn.classList.remove('on');
    stick.classList.remove('on'); setKnob(0, 0);
    sprintTag.classList.remove('on');
    ui.querySelectorAll('.tb.down').forEach(b => b.classList.remove('down'));
  }

  /* ---------------- 편집 모드 ---------------- */
  let editing = false, sel = null;
  function select(it) {
    sel = it;
    ui.querySelectorAll('.tItem.sel').forEach(e => e.classList.remove('sel'));
    if (it) { it.el.classList.add('sel'); selInfo.textContent = '고른 버튼: ' + it.name + ' — 끌어서 옮기거나 크기를 바꾸세요'; }
    else selInfo.textContent = '버튼을 눌러 끌어서 옮기세요';
  }
  function setL(it, o) { layout[it.id] = Object.assign(layout[it.id] || {}, o); place(it); }
  G.openTouchLayout = function () {
    editing = true;
    releaseAll();
    root.classList.add('touch-editing');
    ui.classList.add('show', 'edit');
    ui.dataset.st = 'ground';
    applyLayout();
    select(null);
  };
  function closeEdit() {
    editing = false;
    saveLayout();
    select(null);
    root.classList.remove('touch-editing');
    ui.classList.remove('edit');
    wasShown = null;   // 다음 프레임에 표시 상태를 다시 정한다
  }
  bar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const k = b.dataset.e;
    if (k === 'done') { closeEdit(); return; }
    if (k === 'bar') { bar.classList.toggle('bottom'); return; }
    if (k === 'resetAll') { layout = {}; applyLayout(); select(null); return; }
    if (!sel) { selInfo.textContent = '먼저 바꿀 버튼을 누르세요'; return; }
    const cur = (layout[sel.id] && layout[sel.id].k) || 1;
    if (k === 'smaller') setL(sel, { k: Math.max(0.6, +(cur - 0.1).toFixed(2)) });
    else if (k === 'bigger') setL(sel, { k: Math.min(1.8, +(cur + 0.1).toFixed(2)) });
    else if (k === 'reset1') { delete layout[sel.id]; place(sel); }
  });
  // 메뉴·일시정지 화면의 '버튼 위치 바꾸기'
  for (const id of ['touchLayoutBtn', 'touchLayoutBtn2']) {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => G.openTouchLayout());
  }

  /* ---------------- 터치 처리 ---------------- */
  const hitItem = (t, x, y) => {
    const el = t.target.closest && t.target.closest('.tItem');
    if (el) return BY[el.dataset.id];
    // 조이스틱은 테두리 바깥 조금까지 잡히게
    const S = BY.stick;
    if (Math.hypot(x - S.cx, y - S.cy) < S.r * 1.25) return S;
    return null;
  };

  ui.addEventListener('touchstart', e => {
    e.preventDefault();               // 터치가 마우스 클릭으로 바뀌지 않게
    for (const t of e.changedTouches) {
      const [x, y] = toStage(t.clientX, t.clientY);
      const it = hitItem(t, x, y);
      if (editing) {
        if (it) { select(it); touches.set(t.identifier, { role: 'drag', it, ox: x - it.cx, oy: y - it.cy }); }
        else select(null);
        continue;
      }
      if (!I.locked) continue;
      if (it && it.id === 'stick') {
        // 고정 조이스틱: 받침은 그대로, 손잡이만 움직인다
        touches.set(t.identifier, { role: 'stick' });
        stick.classList.add('on');
        moveStick(x, y);
        continue;
      }
      if (it) {
        const btn = it.el;
        btn.classList.add('down');
        const act = btn.dataset.act;
        const rec = { role: 'btn', btn, act, key: btn.dataset.key, x, y };
        touches.set(t.identifier, rec);
        if (act === 'fire') { I.lmb = true; I.lmbHit = true; rec.look = true; }
        else if (act === 'ads') { adsOn = !adsOn; I.rmb = adsOn; I.rmbHit = adsOn; adsBtn.classList.toggle('on', adsOn); }
        else if (act === 'key') press(rec.key);
        else if (act === 'wheel') I.wheel += 1;
        else if (act === 'pause') { I.unlock(); return; }
        continue;
      }
      // 버튼·조이스틱이 아닌 곳: 화면을 끌어 시점 회전
      touches.set(t.identifier, { role: 'look', x, y });
    }
  }, { passive: false });

  function moveStick(x, y) {
    const S = BY.stick, R = S.r * 0.9;
    let dx = x - S.cx, dy = y - S.cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    setKnob(dx, dy);
    setMove(dx / R, dy / R);
  }
  function onMove(e) {
    for (const t of e.changedTouches) {
      const rec = touches.get(t.identifier);
      if (!rec) continue;
      e.preventDefault();
      const [x, y] = toStage(t.clientX, t.clientY);
      if (rec.role === 'drag') {
        const it = rec.it;
        setL(it, { fx: (x - rec.ox) / innerWidth, fy: (y - rec.oy) / innerHeight });
      } else if (rec.role === 'stick') moveStick(x, y);
      else if (rec.role === 'look' || rec.look) {
        I.mdx += (x - rec.x) * LOOK;
        I.mdy += (y - rec.y) * LOOK;
        rec.x = x; rec.y = y;
      }
    }
  }
  function onEnd(e) {
    for (const t of e.changedTouches) {
      const rec = touches.get(t.identifier);
      if (!rec) continue;
      touches.delete(t.identifier);
      if (rec.role === 'drag') saveLayout();
      else if (rec.role === 'stick') { setMove(0, 0); setKnob(0, 0); stick.classList.remove('on'); }
      else if (rec.role === 'btn') {
        rec.btn.classList.remove('down');
        if (rec.act === 'fire') {
          let still = false;
          for (const r of touches.values()) if (r.act === 'fire') still = true;
          if (!still) I.lmb = false;
        } else if (rec.act === 'key') release(rec.key);
      }
    }
  }
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchcancel', onEnd);

  /* ---------------- 상황에 맞게 보이기 ---------------- */
  let wasShown = false;
  function tick() {
    requestAnimationFrame(tick);
    if (editing) return;
    // 게임 중인데 조작 상태가 꺼져 있으면 (일시정지 제외) 바로 켠다
    if (G.Game && G.Game.state === 'playing' && !G.paused && !I.locked) I.lock();
    const playing = G.Game && G.Game.state === 'playing' && !G.paused && I.locked;
    if (playing !== wasShown) { ui.classList.toggle('show', playing); if (!playing) releaseAll(); wasShown = playing; }
    if (!playing) return;
    const P = G.Player, a = P && P.a;
    if (!a) return;
    const st = !a.alive ? 'dead' : (a.state === 'plane' || a.state === 'freefall' || a.state === 'chute') ? 'air' : 'ground';
    if (ui.dataset.st !== st) ui.dataset.st = st;
    let label = '', on = false;
    if (st === 'air') { label = a.state === 'plane' ? '점프' : '낙하산'; on = true; }
    else if (P.reviveTarget) { label = '소생'; on = true; }
    else if (P.lootTarget) { label = '줍기'; on = true; }
    else label = '줍기';
    if (fLabel.textContent !== label) fLabel.textContent = label;
    fBtn.classList.toggle('lit', on);
    // 조준이 풀렸으면 (재장전·교체 등) 버튼도 같이 풀어 준다
    if (adsOn && !I.rmb) { adsOn = false; adsBtn.classList.remove('on'); }
  }
  requestAnimationFrame(tick);
})();
