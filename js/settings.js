// settings.js — 설정 창: 조준 감도·시야각·상하 반전, 음량(전체·총소리·환경음), 키 바꾸기
// 이 브라우저에만 저장된다 (localStorage 'lastzone_settings')
(function () {
'use strict';
const G = window.G, U = G.U;
const KEY = 'lastzone_settings';
const DEF = { adsSens: 1, scopeSens: 1, fov: 80, invertY: false, vol: { master: 1, weapons: 1, ambient: 1 }, binds: {} };
// 바꿀 수 있는 동작: 게임 코드가 쓰는 원래 키(논리 키) → 이름
const ACTIONS = [
  ['KeyW', '앞으로'], ['KeyS', '뒤로'], ['KeyA', '왼쪽'], ['KeyD', '오른쪽'],
  ['ShiftLeft', '달리기 · 숨 참기'], ['Space', '점프 · 넘기 · 브레이크'], ['KeyC', '앉기'], ['KeyZ', '엎드리기'],
  ['KeyQ', '왼쪽 기울이기'], ['KeyE', '오른쪽 기울이기'], ['KeyR', '재장전'], ['KeyF', '줍기 · 상호작용'],
  ['KeyV', '조준경 교체'], ['KeyB', '사격 모드'], ['KeyG', '빠른 투척'], ['KeyH', '치료'],
  ['KeyL', '손전등'], ['KeyM', '지도'],
  ['Digit1', '소총'], ['Digit2', '산탄총'], ['Digit3', '권총'], ['Digit4', '투척무기']
];
const RESERVED = new Set(['Escape', 'Tab', 'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight']);

function keyName(code) {
  if (!code) return '없음';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return '숫자패드 ' + code.slice(6);
  const N = { Space: 'Space', ShiftLeft: '왼쪽 Shift', ShiftRight: '오른쪽 Shift', ControlLeft: '왼쪽 Ctrl', ControlRight: '오른쪽 Ctrl', AltLeft: '왼쪽 Alt', AltRight: '오른쪽 Alt', CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Enter: 'Enter', Backspace: 'Backspace', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  return N[code] || code;
}

const S = G.Settings = {
  data: null, ACTIONS, keyName,
  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    this.data = Object.assign({}, DEF, s || {});
    this.data.vol = Object.assign({}, DEF.vol, (s && s.vol) || {});
    this.data.binds = Object.assign({}, (s && s.binds) || {});
    this.apply();
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* 저장 안 되면 이번 실행만 */ } },
  // 실제로 누르는 키 (바꾸지 않았으면 원래 키)
  bound(action) { return this.data.binds[action] || action; },
  apply() {
    const d = this.data, P = G.Player, A = G.Audio, I = G.Input;
    if (P) { P.adsSens = d.adsSens; P.scopeSens = d.scopeSens; P.fov = d.fov; P.invertY = d.invertY; }
    if (A) { A.vol = d.vol; if (A.master) A.master.gain.setTargetAtTime(0.75 * d.vol.master, A.ctx.currentTime, 0.05); }
    // 키 바꾸기: 누른 키 → 게임이 아는 키
    if (I) {
      const remap = {}, blocked = new Set();
      for (const [act] of ACTIONS) {
        const k = this.bound(act);
        if (k !== act) { remap[k] = act; blocked.add(act); }
      }
      for (const k in remap) blocked.delete(k);
      // 다른 동작이 쓰던 키를 빼앗았으면 원래 키는 막는다 (두 동작이 한 키에 겹치지 않게)
      I.remap = remap; I.blocked = blocked;
    }
  },
  setBind(action, code) {
    const b = this.data.binds;
    // 이미 다른 동작이 그 키를 쓰고 있으면 서로 바꾼다
    const old = this.bound(action);
    for (const [act] of ACTIONS) if (act !== action && this.bound(act) === code) { if (old === act) delete b[act]; else b[act] = old; }
    if (code === action) delete b[action]; else b[action] = code;
    this.apply(); this.save();
  },

  /* ---------------- 설정 창 ---------------- */
  initUI() {
    const $ = id => document.getElementById(id);
    const panel = $('settingsPanel');
    if (!panel) return;
    const d = this.data;
    const open = () => { this.render(); panel.classList.remove('hidden'); G.Audio.init(); this.apply(); G.Audio.click('ui'); };
    for (const id of ['settingsBtn', 'settingsBtn2']) { const b = $(id); if (b) b.addEventListener('click', open); }
    const close = () => { this.waiting = null; panel.classList.add('hidden'); this.render(); };
    $('setClose').addEventListener('click', close);
    $('setReset').addEventListener('click', () => {
      this.data = JSON.parse(JSON.stringify(DEF));
      this.apply(); this.save(); this.render();
      // 메뉴의 마우스 감도는 그대로 둔다 (UI.opts.sens)
    });
    // 슬라이더
    const slider = (id, get, set, fmt) => {
      const el = $(id), out = $(id + 'Val');
      el.value = get(); out.textContent = fmt(get());
      el.addEventListener('input', () => { set(+el.value); out.textContent = fmt(+el.value); this.apply(); this.save(); });
      return el;
    };
    const pct = v => Math.round(v * 100) + '%';
    this.sliders = [
      ['setAds', () => this.data.adsSens, v => this.data.adsSens = v, v => v.toFixed(2)],
      ['setScope', () => this.data.scopeSens, v => this.data.scopeSens = v, v => v.toFixed(2)],
      ['setFov', () => this.data.fov, v => this.data.fov = v, v => v + '°'],
      ['setVolMaster', () => this.data.vol.master, v => this.data.vol.master = v, pct],
      ['setVolWeapons', () => this.data.vol.weapons, v => this.data.vol.weapons = v, pct],
      ['setVolAmbient', () => this.data.vol.ambient, v => this.data.vol.ambient = v, pct]
    ].map(a => (slider(...a), a));
    const inv = $('setInvert');
    inv.addEventListener('click', () => { this.data.invertY = !this.data.invertY; this.apply(); this.save(); this.render(); });
    // 키 목록
    const list = $('setKeys');
    list.addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      if (btn.dataset.reset) { delete this.data.binds[btn.dataset.act]; this.apply(); this.save(); this.render(); return; }
      this.waiting = btn.dataset.act; this.render();
    });
    // 바꿀 키 입력 받기 (게임 입력보다 먼저 가로챈다)
    addEventListener('keydown', e => {
      if (!this.waiting) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const act = this.waiting;
      this.waiting = null;
      if (e.code === 'Escape') { this.render(); return; }
      if (RESERVED.has(e.code)) { $('setMsg').textContent = keyName(e.code) + ' 키는 쓸 수 없습니다.'; this.render(); return; }
      this.setBind(act, e.code);
      $('setMsg').textContent = '';
      this.render();
    }, true);
    this.render();
  },
  render() {
    const $ = id => document.getElementById(id);
    if (!$('settingsPanel')) return;
    const d = this.data;
    if (this.sliders) for (const [id, get, , fmt] of this.sliders) { $(id).value = get(); $(id + 'Val').textContent = fmt(get()); }
    const inv = $('setInvert');
    inv.textContent = d.invertY ? '켜짐' : '꺼짐'; inv.classList.toggle('on', d.invertY);
    let h = '';
    for (const [act, name] of ACTIONS) {
      const k = this.bound(act), changed = k !== act, wait = this.waiting === act;
      h += `<div class="sk${changed ? ' changed' : ''}"><span>${name}</span><button data-act="${act}" class="kb${wait ? ' wait' : ''}">${wait ? '키를 누르세요…' : keyName(k)}</button>${changed ? `<button data-act="${act}" data-reset="1" class="kr" title="기본값 ${keyName(act)}">↺</button>` : '<i></i>'}</div>`;
    }
    $('setKeys').innerHTML = h;
    this.updateHelp();
  },
  // 메뉴의 조작법 표시도 바뀐 키로
  updateHelp() {
    for (const el of document.querySelectorAll('kbd[data-k]')) el.textContent = keyName(this.bound(el.dataset.k));
  }
};
S.load();
})();
