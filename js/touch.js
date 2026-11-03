'use strict';
/* ------------------------------------------------------------------ */
/* 휴대폰 터치 조작: 왼쪽 조이스틱(이동) · 오른쪽 드래그(시점) · 버튼     */
/* 버튼은 키보드/마우스 입력(G.Input)을 그대로 흉내 내므로 게임 코드는 그대로 쓴다 */
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

  /* ---------------- UI 만들기 ---------------- */
  const ui = document.createElement('div');
  ui.id = 'touchUI';
  ui.innerHTML = `
    <div id="tStick"><div id="tKnob"></div><div id="tSprint">달리기</div></div>
    <button class="tb tb-fire" data-act="fire"><span>발사</span></button>
    <button class="tb tb-fire2" data-act="fire"><span>발사</span></button>
    <button class="tb tb-ads" data-act="ads"><span>조준</span></button>
    <button class="tb tb-jump" data-act="key" data-key="Space"><span>점프</span></button>
    <button class="tb tb-crouch" data-act="key" data-key="KeyC"><span>앉기</span></button>
    <button class="tb tb-reload" data-act="key" data-key="KeyR"><span>장전</span></button>
    <button class="tb tb-f" data-act="key" data-key="KeyF"><span id="tFLabel">줍기</span></button>
    <div class="tb-row">
      <button class="tb sm" data-act="wheel"><span>무기<br>교체</span></button>
      <button class="tb sm" data-act="key" data-key="KeyV"><span>배율</span></button>
      <button class="tb sm" data-act="key" data-key="KeyB"><span>연사</span></button>
      <button class="tb sm" data-act="key" data-key="KeyG"><span>투척</span></button>
      <button class="tb sm" data-act="key" data-key="KeyH"><span>치료</span></button>
    </div>
    <div class="tb-top">
      <button class="tb sm" data-act="pause"><span>Ⅱ</span></button>
      <button class="tb sm" data-act="key" data-key="KeyM"><span>지도</span></button>
    </div>`;
  document.body.appendChild(ui);
  const stick = ui.querySelector('#tStick'), knob = ui.querySelector('#tKnob'), sprintTag = ui.querySelector('#tSprint');
  const fLabel = ui.querySelector('#tFLabel'), fBtn = ui.querySelector('.tb-f'), adsBtn = ui.querySelector('.tb-ads');

  /* ---------------- 입력 상태 ---------------- */
  const touches = new Map();      // identifier → { role, ... }
  let adsOn = false;
  const R = 90;                   // 조이스틱 반지름 (가상 px)
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
  function releaseAll() {
    touches.clear();
    I.keys = {}; I.lmb = false; I.rmb = false; adsOn = false;
    adsBtn.classList.remove('on');
    stick.classList.remove('on');
    sprintTag.classList.remove('on');
    ui.querySelectorAll('.tb.down').forEach(b => b.classList.remove('down'));
  }

  ui.addEventListener('touchstart', e => {
    e.preventDefault();               // 터치가 마우스 클릭으로 바뀌지 않게
    if (!I.locked) return;
    for (const t of e.changedTouches) {
      const [x, y] = toStage(t.clientX, t.clientY);
      const btn = t.target.closest && t.target.closest('.tb');
      if (btn) {
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
      const W = innerWidth;
      if (x < W * 0.42) {
        // 왼쪽: 누른 곳에 조이스틱이 생긴다
        touches.set(t.identifier, { role: 'stick', cx: x, cy: y });
        stick.style.left = x + 'px'; stick.style.top = y + 'px';
        stick.classList.add('on');
        knob.style.transform = 'translate(-50%,-50%)';
        setMove(0, 0);
      } else {
        touches.set(t.identifier, { role: 'look', x, y });
      }
    }
  }, { passive: false });

  function onMove(e) {
    for (const t of e.changedTouches) {
      const rec = touches.get(t.identifier);
      if (!rec) continue;
      e.preventDefault();
      const [x, y] = toStage(t.clientX, t.clientY);
      if (rec.role === 'stick') {
        let dx = x - rec.cx, dy = y - rec.cy;
        const d = Math.hypot(dx, dy);
        if (d > R) {
          // 손가락이 멀리 가면 조이스틱이 따라온다
          const over = d - R; rec.cx += dx / d * over; rec.cy += dy / d * over;
          dx = x - rec.cx; dy = y - rec.cy;
          stick.style.left = rec.cx + 'px'; stick.style.top = rec.cy + 'px';
        }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        setMove(dx / R, dy / R);
      } else if (rec.role === 'look' || rec.look) {
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
      if (rec.role === 'stick') { setMove(0, 0); stick.classList.remove('on'); }
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
