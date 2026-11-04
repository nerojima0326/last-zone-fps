// ui.js — 메뉴, HUD, 나침반, 미니맵/전체지도, 킬피드, 결과 화면
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;
const PXD = 3.2; // 나침반 px/도
const MODE_NOTES = {
  1: '혼자서 모든 적과 싸워 최후의 1인이 되세요.',
  2: 'AI 봇 1명이 팀원으로 함께합니다. 쓰러진 팀원을 <b>F</b>를 길게 눌러 소생시킬 수 있습니다.',
  3: 'AI 봇 2명이 팀원으로 함께하는 3인 트리오입니다.',
  4: 'AI 봇 3명이 팀원으로 함께하는 4인 분대전입니다.'
};
const _v = new V3();
const $ = id => document.getElementById(id);

const UI = G.UI = {
  opts: { size: 1, players: 40, diff: 'normal', loadout: 'rifle', tod: 'day', quality: 'auto', sens: 1, name: 'Player', fpsTarget: 120, showFps: 'on', qv: 2 },
  feed: [], dmgDirs: [], hmT: 0, hurtV: 0, lowPulse: 0, centerT: 0, killT: 0, pickT: 0, mapOpen: false,
  init() {
    try { const s = JSON.parse(localStorage.getItem('lastzone_opts') || 'null'); if (s) Object.assign(this.opts, s); } catch (e) { /* 저장소 사용 불가 */ }
    // 예전 기본값(높음)을 쓰던 사람은 한 번 '자동'으로 바꿔 준다
    if (this.opts.qv !== 2) { this.opts.qv = 2; if (this.opts.quality === 'high') this.opts.quality = 'auto'; }
    this.fpsEl = $('fpsBox');
    this.fpsEl.classList.toggle('hidden', this.opts.showFps !== 'on');
    document.querySelectorAll('.ppl').forEach(p => { p.innerHTML = '<i></i>'.repeat(+p.dataset.n); });
    const modes = document.querySelectorAll('.mode');
    const setMode = (n) => {
      modes.forEach(b => b.classList.toggle('on', +b.dataset.size === n));
      this.opts.size = n; $('modeNote').innerHTML = MODE_NOTES[n];
    };
    modes.forEach(b => b.addEventListener('click', () => { setMode(+b.dataset.size); G.Audio.init(); G.Audio.click('ui'); }));
    setMode(this.opts.size);
    document.querySelectorAll('.seg').forEach(seg => {
      const key = seg.dataset.opt;
      const btns = seg.querySelectorAll('button');
      btns.forEach(b => {
        if (String(this.opts[key]) === b.dataset.v) { btns.forEach(x => x.classList.remove('on')); b.classList.add('on'); }
        b.addEventListener('click', () => {
          btns.forEach(x => x.classList.remove('on')); b.classList.add('on');
          this.opts[key] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v;
          G.Audio.init(); G.Audio.click('ui');
          if (key === 'tod' && G.Game.state === 'menu') G.World.setTimeOfDay(this.opts.tod);
          if (key === 'fpsTarget' && G.DRS) G.DRS.target = this.opts.fpsTarget;
          if (key === 'showFps') this.fpsEl.classList.toggle('hidden', this.opts.showFps !== 'on');
        });
      });
    });
    const sens = $('optSens');
    sens.value = this.opts.sens; $('sensVal').textContent = (+this.opts.sens).toFixed(2);
    sens.addEventListener('input', () => { this.opts.sens = +sens.value; $('sensVal').textContent = this.opts.sens.toFixed(2); G.Player.sens = this.opts.sens; });
    $('optName').value = this.opts.name || 'Player';
    $('startBtn').addEventListener('click', () => {
      this.opts.name = ($('optName').value || 'Player').trim().slice(0, 12) || 'Player';
      try { localStorage.setItem('lastzone_opts', JSON.stringify(this.opts)); } catch (e) { /* 무시 */ }
      G.startGame(Object.assign({}, this.opts));
    });
    $('trainBtn').addEventListener('click', () => {
      this.opts.name = ($('optName').value || 'Player').trim().slice(0, 12) || 'Player';
      try { localStorage.setItem('lastzone_opts', JSON.stringify(this.opts)); } catch (e) { /* 무시 */ }
      G.startGame(Object.assign({}, this.opts, { mode: 'training' }));
    });
    $('resumeBtn').addEventListener('click', () => G.resume());
    $('quitBtn').addEventListener('click', () => G.toMenu());
    $('againBtn').addEventListener('click', () => G.startGame(Object.assign({}, this.opts)));
    $('menuBtn').addEventListener('click', () => G.toMenu());
    // 나침반
    const strip = $('compassStrip');
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    let html = '';
    for (let d = -180; d <= 540; d += 5) {
      const x = (d + 180) * PXD, dd = ((d % 360) + 360) % 360;
      html += '<i class="ct' + (d % 15 === 0 ? ' big' : '') + '" style="left:' + x + 'px"></i>';
      if (labels[dd] !== undefined) html += '<span class="cl' + (dd === 0 ? ' n' : '') + '" style="left:' + x + 'px">' + labels[dd] + '</span>';
      else if (d % 15 === 0) html += '<span class="cl s" style="left:' + x + 'px">' + dd + '</span>';
    }
    strip.innerHTML = html;
    this.compassMarks = document.createElement('div');
    this.compassMarks.style.cssText = 'position:absolute;inset:0;';
    $('compass').appendChild(this.compassMarks);
    this.mini = $('minimap'); this.mctx = this.mini.getContext('2d');
    this.big = $('bigmap'); this.bctx = this.big.getContext('2d');
    this.el = {
      alive: $('aliveNum'), teams: $('teamsNum'), kills: $('killNum'), hpFill: $('hpFill'), hpLag: $('hpLag'), hpText: $('hpText'),
      vest: $('vestIcon'), helm: $('helmIcon'), meds: $('medsInfo'), mag: $('ammoMag'), res: $('ammoRes'), wname: $('weaponName'), fmode: $('fireMode'), slots: $('slots'),
      cross: $('crosshair'), hit: $('hitmarker'), prompt: $('prompt'), progress: $('progress'), progLabel: $('progressLabel'), progFill: $('progressFill'),
      center: $('centerMsg'), kill: $('killMsg'), pick: $('pickupMsg'), plane: $('planeHint'), spec: $('spectate'), vig: $('vignette'), zoneO: $('zoneOverlay'),
      knockO: $('knockOverlay'), flash: $('flashOverlay'), zoneInfo: $('zoneInfo'), zoneLabel: $('zoneLabel'), zoneTime: $('zoneTime'), strip, compassDeg: $('compassDeg'),
      feed: $('killfeed'), dmg: $('dmgDirs'), team: $('teamPanel'), tags: $('tags'), bigWrap: $('bigmapWrap')
    };
    this.cache = {};
  },
  set(key, el, val, prop) { if (this.cache[key] !== val) { this.cache[key] = val; el[prop || 'textContent'] = val; } },
  fps(fps, pr, refreshMs) {
    const show = this.opts.showFps === 'on' && G.Game.state !== 'menu';
    this.fpsEl.classList.toggle('hidden', !show);
    if (!show) return;
    const hz = Math.round(1000 / refreshMs);
    const target = Math.min(this.opts.fpsTarget || 120, hz + 2);
    let t = Math.round(fps) + ' FPS · 해상도 ' + Math.round(pr * 100) + '% · 그래픽 ' + (G.qualityLabel ? G.qualityLabel() : '');
    if (hz < (this.opts.fpsTarget || 120) - 5) t += ' · 모니터 ' + hz + 'Hz';
    this.fpsEl.textContent = t;
    this.fpsEl.className = fps >= target * 0.92 ? '' : fps >= target * 0.7 ? 'warn' : 'bad';
    this.fpsEl.classList.remove('hidden');
  },
  // 잠깐 떴다 사라지는 안내
  toast(msg) {
    let el = this.toastEl;
    if (!el) { el = this.toastEl = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('on');
    clearTimeout(this.toastTm); this.toastTm = setTimeout(() => el.classList.remove('on'), 2600);
  },
  showMenu() { $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); $('results').classList.add('hidden'); $('pause').classList.add('hidden'); },
  hideMenu() { $('menu').classList.add('hidden'); },
  showPause(on) { $('pause').classList.toggle('hidden', !on); },
  startMatch() {
    $('hud').classList.remove('hidden'); $('results').classList.add('hidden'); $('pause').classList.add('hidden');
    this.el.feed.innerHTML = ''; this.feed = [];
    this.el.dmg.innerHTML = ''; this.dmgDirs = [];
    this.cache = {}; this.slotKey = null;
    this.mapOpen = false; this.el.bigWrap.classList.remove('on');
    // 팀 패널 / 태그
    const Game = G.Game, team = Game.teams[Game.player.team];
    this.el.team.innerHTML = '';
    this.el.tags.innerHTML = '';
    this.compassMarks.innerHTML = '';
    this.teamRows = []; this.tags = []; this.cmarks = [];
    if (team.members.length > 1) {
      team.members.forEach((m, i) => {
        const row = document.createElement('div'); row.className = 'tm';
        row.innerHTML = '<div class="num" style="background:' + Game.TEAM_COLORS[i] + '">' + (i + 1) + '</div><div class="nm">' + G.esc(m.name) + '</div><div class="hb"><i></i></div>';
        this.el.team.appendChild(row);
        this.teamRows.push({ m, row, bar: row.querySelector('i') });
        if (m !== Game.player) {
          const tg = document.createElement('div'); tg.className = 'tag3d'; tg.style.color = Game.TEAM_COLORS[i];
          tg.innerHTML = '<div>' + G.esc(m.name) + '</div><div class="dist"></div><div class="dot" style="background:' + Game.TEAM_COLORS[i] + '"></div>';
          this.el.tags.appendChild(tg);
          this.tags.push({ m, el: tg, dist: tg.querySelector('.dist') });
          const cm = document.createElement('i'); cm.className = 'cm'; cm.style.cssText = 'position:absolute;top:22px;width:8px;height:8px;border-radius:50%;transform:translateX(-50%);box-shadow:0 0 3px #000;background:' + Game.TEAM_COLORS[i];
          this.compassMarks.appendChild(cm);
          this.cmarks.push({ m, el: cm });
        }
      });
    }
  },
  center(text, sub, cls, dur) {
    const e = this.el.center;
    e.className = cls || ''; e.innerHTML = text + (sub ? '<small>' + sub + '</small>' : '');
    e.style.opacity = 1; this.centerT = dur || 3;
  },
  killMsg(text, sub, knock, n) {
    const e = this.el.kill;
    e.className = knock ? 'knock' : '';
    e.innerHTML = '<b>' + text + '</b><span>' + G.esc(sub) + (n ? ' · ' + n + ' 킬' : '') + '</span>';
    e.style.opacity = 1; this.killT = 2.6;
  },
  pickup(text) { const e = this.el.pick; e.textContent = '+ ' + text; e.style.opacity = 1; this.pickT = 2; },
  toast(text) { const e = this.el.pick; e.textContent = text; e.style.opacity = 1; this.pickT = 1.8; },
  feedMsg(html) { this.pushFeed('<span>' + html + '</span>'); },
  killfeed(killer, victim, weapon, head, knock) {
    const P = G.Game.player, pt = P.team;
    const nm = a => !a ? '' : '<span class="' + (a === P ? 'me' : a.team === pt ? 'mate' : '') + '">' + G.esc(a.name) + '</span>';
    const w = G.Game.WEAPON_LABEL[weapon] || weapon;
    let html;
    if (killer && killer !== victim) html = nm(killer) + '<span class="w">' + w + '</span>' + (head ? '<span class="hs">HS</span>' : '') + nm(victim) + (knock ? '<span class="kn">기절</span>' : '');
    else html = nm(victim) + '<span class="w">' + w + '</span>' + (knock ? '<span class="kn">기절</span>' : '<span class="kn">사망</span>');
    this.pushFeed(html);
  },
  pushFeed(html) {
    const d = document.createElement('div'); d.className = 'kf'; d.innerHTML = html;
    this.el.feed.appendChild(d);
    this.feed.push({ el: d, t: 6 });
    while (this.feed.length > 6) { const f = this.feed.shift(); f.el.remove(); }
  },
  hitmarker(head, kill) {
    const e = this.el.hit;
    e.className = kill ? 'kill' : head ? 'head' : '';
    this.hmT = kill ? 0.35 : 0.18;
  },
  hurt(dmg, from) {
    this.hurtV = Math.min(1, this.hurtV + dmg / 35);
    if (from) {
      const el = document.createElement('div'); el.className = 'dd';
      this.el.dmg.appendChild(el);
      this.dmgDirs.push({ el, pos: from.clone(), t: 1.6 });
      if (this.dmgDirs.length > 6) { const d = this.dmgDirs.shift(); d.el.remove(); }
    }
  },
  showResults(r) {
    $('resTitle').textContent = r.win ? '최후의 생존자!' : (r.rank <= 3 ? '아깝습니다!' : '다음엔 더 잘할 수 있어요');
    $('resTitle').className = r.win ? 'win' : '';
    $('resRank').innerHTML = '<b>#' + r.rank + '</b><span>/ ' + r.teams + (G.Game.teamSize > 1 ? ' 팀' : '') + '</span>';
    $('resKills').textContent = r.kills; $('resDmg').textContent = r.dmg; $('resTime').textContent = U.fmtTime(r.time); $('resTeamKills').textContent = r.teamKills;
    $('results').classList.remove('hidden');
  },

  update(dt) {
    const Game = G.Game;
    if (Game.state !== 'playing' && Game.state !== 'ended') return;
    const P = G.Player, a = Game.player, el = this.el, cam = G.camera;
    if (G.Input.hit('KeyM') && Game.state === 'playing') { this.mapOpen = !this.mapOpen; el.bigWrap.classList.toggle('on', this.mapOpen); }
    this.set('alive', el.alive, Game.aliveCount());
    this.set('teams', el.teams, Game.teamsAlive());
    this.set('kills', el.kills, a.kills);
    // 체력
    const hpP = a.knocked ? a.bleed : a.alive ? a.hp : 0;
    this.set('hpw', el.hpFill.style, Math.max(0, hpP) + '%', 'width');
    this.set('hplag', el.hpLag.style, Math.max(0, hpP) + '%', 'width');
    this.set('hpt', el.hpText, Math.ceil(Math.max(0, hpP)));
    this.set('hpc', el.hpFill, a.knocked ? 'knock' : hpP < 30 ? 'low' : '', 'className');
    this.set('vest', el.vest, a.vest ? 'gear-i on' : 'gear-i', 'className');
    this.set('helm', el.helm, a.helmet ? 'gear-i on' : 'gear-i', 'className');
    this.set('meds', el.meds, '붕대 ' + a.meds.bandage + ' · 구급상자 ' + a.meds.medkit);
    // 무기
    const inst = a.weapons[a.cur], def = inst ? G.WEAPONS[inst.id] : G.WEAPONS[a.cur];
    if (a.cur === 'throw') {
      const k = P.throwKind;
      this.set('mag', el.mag, a.throwables[k]); this.set('res', el.res, '');
      this.set('wn', el.wname, G.THROW_NAMES[k]); this.set('fm', el.fmode, '좌클릭 던지기 · 우클릭 굴리기');
    } else if (inst) {
      this.set('mag', el.mag, inst.mag); this.set('res', el.res, '/ ' + a.ammo[def.ammo]);
      const sc = inst.scope || def.baseSight;
      this.set('wn', el.wname, def.name + (sc ? ' · ' + G.SCOPES[sc].name : ''));
      const mode = def.auto ? (P.fireMode === 'auto' ? 'AUTO' : 'SINGLE') : ({ pump: 'PUMP', bolt: 'BOLT', break: 'DOUBLE' }[def.action] || 'SEMI');
      const spare = G.SCOPE_ORDER.some(t => a.scopes[t] > 0 && def.scopes.includes(t));
      this.set('fm', el.fmode, mode + ' · ' + G.AMMO_NAMES[def.ammo] + (spare ? ' · V 조준경' : ''));
    } else {
      this.set('mag', el.mag, '-'); this.set('res', el.res, ''); this.set('wn', el.wname, '맨손'); this.set('fm', el.fmode, '');
    }
    this.set('magc', el.mag, inst && inst.mag <= Math.ceil(def.mag * 0.25) ? 'low' : '', 'className');
    const tk = P.throwKind;
    const skey = a.cur + a.gunId('rifle') + a.gunId('shotgun') + a.gunId('pistol') + tk + a.throwables[tk] + (a.throwCount() ? 1 : 0);
    if (this.slotKey !== skey) {
      this.slotKey = skey;
      let slots = '';
      ['rifle', 'shotgun', 'pistol'].forEach((k, i) => {
        const w = a.weapons[k];
        slots += '<div class="slot' + (w ? ' has' : '') + (a.cur === k ? ' cur' : '') + '"><span class="k">' + (i + 1) + '</span>' + (w ? G.WEAPONS[w.id].short : G.CLASS_NAMES[k]) + '</div>';
      });
      slots += '<div class="slot' + (a.throwCount() ? ' has' : '') + (a.cur === 'throw' ? ' cur' : '') + '"><span class="k">4</span>' + G.THROW_NAMES[tk] + ' <span class="cnt">' + a.throwables[tk] + '</span></div>';
      el.slots.innerHTML = slots;
    }
    // 조준점
    const showCross = a.alive && a.state === 'ground' && !a.knocked && P.ads < 0.5 && !this.mapOpen && a.cur !== 'throw';
    this.drawScope(a.alive && a.state === 'ground' ? P.scopeView : 0, inst ? (inst.scope || def.baseSight) : null, P);
    el.cross.style.display = showCross ? 'block' : 'none';
    if (showCross) {
      const sp = def && def.pellets ? P.currentSpread(def) : 0.01;
      const gap = 4 + sp * (innerHeight / 2) / Math.tan(cam.fov * Math.PI / 360);
      const c = el.cross.children;
      c[0].style.top = (-gap - 9) + 'px'; c[1].style.top = gap + 'px'; c[2].style.left = (-gap - 9) + 'px'; c[3].style.left = gap + 'px';
    }
    this.hmT -= dt; el.hit.style.opacity = this.hmT > 0 ? 1 : 0;
    // 피격 방향
    for (let i = 0; i < this.dmgDirs.length; i++) {
      const d = this.dmgDirs[i];
      d.t -= dt;
      if (d.t <= 0) { d.el.remove(); this.dmgDirs.splice(i--, 1); continue; }
      const ang = Math.atan2(-(d.pos.x - a.pos.x), -(d.pos.z - a.pos.z));
      d.el.style.transform = 'rotate(' + (-(ang - a.yaw)) + 'rad)';
      d.el.style.opacity = Math.min(1, d.t);
    }
    // 오버레이
    this.hurtV = Math.max(0, this.hurtV - dt * 1.4);
    this.lowPulse += dt * (a.hp < 30 ? 6 : 2);
    const low = a.alive && !a.knocked && a.hp < 30 ? (0.25 + Math.sin(this.lowPulse) * 0.12) * (1 - a.hp / 30) : 0;
    el.vig.style.opacity = Math.min(1, this.hurtV * 0.8 + low);
    el.zoneO.style.opacity = a.alive && a.state === 'ground' && !Game.inZone(a.pos) ? 1 : 0;
    el.knockO.style.opacity = a.knocked ? 1 : 0;
    el.flash.style.opacity = P.flashAmt;
    // 프롬프트 / 진행
    const showPrompt = P.prompt && a.alive && a.state === 'ground' && !this.mapOpen;
    if (showPrompt) { this.set('prompt', el.prompt, P.prompt, 'innerHTML'); el.prompt.style.display = 'block'; } else el.prompt.style.display = 'none';
    let prog = null;
    if (P.heal) prog = [(P.heal.kind === 'medkit' ? '구급상자' : '붕대') + ' 사용 중...', P.heal.t / P.heal.dur];
    else if (P.revive) prog = ['소생 중...', P.revive.t / 5];
    else if (P.reload) prog = null;
    if (!prog && a.knocked) {
      const reviver = Game.teams[a.team].members.find(m => m.brain && m.brain.reviving === a);
      if (reviver) prog = [G.esc(reviver.name) + ' 님이 소생 중...', reviver.brain.reviveT / 5];
    }
    if (prog) { el.progress.style.display = 'block'; this.set('pl', el.progLabel, prog[0], 'innerHTML'); el.progFill.style.width = (U.clamp(prog[1], 0, 1) * 100) + '%'; }
    else el.progress.style.display = 'none';
    // 메시지 타이머
    this.centerT -= dt; if (this.centerT <= 0) el.center.style.opacity = 0;
    this.killT -= dt; if (this.killT <= 0) el.kill.style.opacity = 0;
    this.pickT -= dt; if (this.pickT <= 0) el.pick.style.opacity = 0;
    for (let i = 0; i < this.feed.length; i++) { const f = this.feed[i]; f.t -= dt; if (f.t < 1) f.el.style.opacity = Math.max(0, f.t); if (f.t <= 0) { f.el.remove(); this.feed.splice(i--, 1); } }
    // 강하 안내
    let ph = '';
    if (a.alive && a.state === 'plane') ph = Game.planeCanJump() ? '<kbd>F</kbd> 뛰어내리기<small>마우스로 둘러보고 원하는 지역 위에서 강하하세요 · M 지도</small>' : '<small>맵 상공에 진입하면 뛰어내릴 수 있습니다</small>';
    else if (a.alive && a.state === 'freefall') ph = (P.altitude < 260 && P.dropT > 1 ? '<kbd>F</kbd> 낙하산 펼치기' : '자유 낙하 중') + '<small>고도 ' + Math.round(P.altitude || 0) + 'm · W 급강하 · S 감속</small>';
    else if (a.alive && a.state === 'chute') ph = '<small>고도 ' + Math.round(P.altitude || 0) + 'm · W/S 속도 조절 · 마우스 방향 전환</small>';
    this.set('plane', el.plane, ph, 'innerHTML');
    // 관전
    if (!a.alive && P.specTarget && Game.state === 'playing') { el.spec.style.display = 'block'; this.set('spec', el.spec, '관전 중: <b>' + G.esc(P.specTarget.name) + '</b> · 좌클릭으로 전환', 'innerHTML'); }
    else el.spec.style.display = 'none';
    // 나침반
    const yaw = P.camMode === 'fp' ? a.yaw : (P.camMode === 'spectate' && P.specTarget ? P.specTarget.yaw : P.orbitYaw);
    const bearing = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    el.strip.style.transform = 'translateX(' + (260 - (bearing + 180) * PXD) + 'px)';
    this.set('cdeg', el.compassDeg, Math.round(bearing) % 360);
    for (const c of this.cmarks) {
      if (!c.m.alive || c.m.state === 'plane') { c.el.style.display = 'none'; continue; }
      const b = ((Math.atan2(c.m.pos.x - a.pos.x, -(c.m.pos.z - a.pos.z)) * 180 / Math.PI) + 360) % 360;
      let rel = b - bearing; if (rel > 180) rel -= 360; if (rel < -180) rel += 360;
      if (Math.abs(rel) > 78) { c.el.style.display = 'none'; continue; }
      c.el.style.display = 'block'; c.el.style.left = (260 + rel * PXD) + 'px';
    }
    // 팀
    for (const r of this.teamRows) {
      const m = r.m;
      const cls = 'tm' + (!m.alive ? ' dead' : m.knocked ? ' knocked' : '');
      if (r.cls !== cls) { r.cls = cls; r.row.className = cls; }
      r.bar.style.width = (!m.alive ? 0 : m.knocked ? m.bleed : m.hp) + '%';
    }
    // 3D 태그
    for (const t of this.tags) {
      const m = t.m;
      if (!m.alive || m.state === 'plane') { t.el.style.display = 'none'; continue; }
      _v.copy(m.pos); _v.y += m.knocked ? 0.9 : m.state === 'chute' ? 2.4 : 2.05;
      const d = cam.position.distanceTo(_v);
      _v.project(cam);
      if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) { t.el.style.display = 'none'; continue; }
      t.el.style.display = 'block';
      t.el.style.left = ((_v.x + 1) / 2 * innerWidth) + 'px'; t.el.style.top = ((1 - _v.y) / 2 * innerHeight) + 'px';
      t.el.classList.toggle('knocked', m.knocked);
      t.dist.textContent = Math.round(d) + 'm';
    }
    // 자기장 정보
    const Z = Game.zone;
    if (Z) {
      let lab = '자기장', tm = Z.timer;
      if (Z.state === 'pre') lab = '자기장 대기';
      else if (Z.state === 'wait') lab = '축소까지';
      else if (Z.state === 'shrink') lab = '축소 중';
      else { lab = '최종 자기장'; tm = 0; }
      this.set('zl', el.zoneLabel, lab);
      this.set('zt', el.zoneTime, U.fmtTime(tm));
      this.set('zc', el.zoneInfo, Z.state === 'shrink' ? 'shrink' : '', 'className');
    }
    this.frame = (this.frame || 0) + 1;
    // 미니맵은 약 40Hz, 전체 지도는 약 20Hz로 갱신
    this.miniT = (this.miniT || 0) + dt;
    if (this.miniT >= 0.024) { this.miniT = 0; this.drawMini(); }
    if (this.mapOpen) { this.bigT = (this.bigT || 0) + dt; if (this.bigT >= 0.05) { this.bigT = 0; this.drawBig(); } }
  },
  // 배율 조준경 화면 (원형 시야 + 조준선)
  drawScope(amt, type, P) {
    const c = this.scopeEl || (this.scopeEl = document.getElementById('scopeOverlay'));
    if (!c) return;
    if (amt <= 0.01 || !type || G.SCOPES[type].zoom <= 1) {
      if (c.style.display !== 'none') { c.style.display = 'none'; const hb = document.getElementById('breathBar'); if (hb) hb.style.display = 'none'; }
      return;
    }
    const W = innerWidth, H = innerHeight;
    const key = type + W + 'x' + H;
    if (this.scopeKey !== key) {
      this.scopeKey = key;
      c.width = W; c.height = H;
      const x = c.getContext('2d'), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.46;
      x.clearRect(0, 0, W, H);
      x.fillStyle = '#000'; x.beginPath(); x.rect(0, 0, W, H); x.arc(cx, cy, R, 0, Math.PI * 2, true); x.fill();
      // 렌즈 가장자리 그림자
      const g = x.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0.92)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(20,20,20,0.95)'; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
      if (type === 'x2') {
        x.strokeStyle = 'rgba(255,60,40,0.9)'; x.lineWidth = 1.6;
        x.beginPath(); x.arc(cx, cy, R * 0.06, 0, Math.PI * 2); x.stroke();
        x.fillStyle = 'rgba(255,50,30,1)'; x.beginPath(); x.arc(cx, cy, 2.4, 0, Math.PI * 2); x.fill();
      } else if (type === 'x4') {
        // ACOG 식 쉐브론 + 탄도 낙차 눈금
        x.strokeStyle = 'rgba(255,70,40,0.95)'; x.fillStyle = 'rgba(255,70,40,0.95)'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(cx - 9, cy + 9); x.lineTo(cx, cy); x.lineTo(cx + 9, cy + 9); x.stroke();
        x.strokeStyle = 'rgba(10,10,10,0.85)'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx, cy + 14); x.lineTo(cx, cy + R * 0.55); x.stroke();
        for (let i = 1; i <= 4; i++) { const yy = cy + 14 + i * R * 0.1, w = 14 - i * 2.2; x.beginPath(); x.moveTo(cx - w, yy); x.lineTo(cx + w, yy); x.stroke(); }
        x.lineWidth = 3; x.beginPath(); x.moveTo(cx - R, cy); x.lineTo(cx - R * 0.35, cy); x.moveTo(cx + R * 0.35, cy); x.lineTo(cx + R, cy); x.stroke();
      } else {
        // 밀도트 십자선
        x.strokeStyle = 'rgba(10,10,10,0.9)';
        x.lineWidth = 6; x.beginPath(); x.moveTo(cx - R, cy); x.lineTo(cx - R * 0.42, cy); x.moveTo(cx + R * 0.42, cy); x.lineTo(cx + R, cy);
        x.moveTo(cx, cy + R); x.lineTo(cx, cy + R * 0.42); x.moveTo(cx, cy - R); x.lineTo(cx, cy - R * 0.42); x.stroke();
        x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx - R * 0.42, cy); x.lineTo(cx + R * 0.42, cy); x.moveTo(cx, cy - R * 0.42); x.lineTo(cx, cy + R * 0.42); x.stroke();
        x.fillStyle = 'rgba(10,10,10,0.9)';
        for (let i = 1; i <= 4; i++) { const d = i * R * 0.09; for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { x.beginPath(); x.arc(cx + dx, cy + dy, 2.2, 0, Math.PI * 2); x.fill(); } }
        x.fillStyle = 'rgba(255,40,30,0.95)'; x.beginPath(); x.arc(cx, cy, 1.6, 0, Math.PI * 2); x.fill();
      }
    }
    c.style.display = 'block';
    c.style.opacity = U.clamp((amt - 0.3) / 0.6, 0, 1).toFixed(3);
    const hb = document.getElementById('breathBar');
    if (hb) {
      const show = G.SCOPES[type].zoom >= 4 && amt > 0.9;
      hb.style.display = show ? 'block' : 'none';
      if (show) { hb.firstChild.style.width = (P.breath * 100).toFixed(1) + '%'; hb.classList.toggle('lock', P.breathLock); }
    }
  },
  focus() {
    const Game = G.Game, a = Game.player, P = G.Player;
    if (a.state === 'plane' && Game.plane) return Game.plane.pos;
    if (!a.alive && P.specTarget) return P.specTarget.pos;
    return a.pos;
  },
  drawZone(ctx, toS, k, Wd, H) {
    const Z = G.Game.zone;
    if (!Z) return;
    const [cx, cy] = toS(Z.cur.x, Z.cur.z);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, Wd, H); ctx.arc(cx, cy, Math.max(0.5, Z.cur.r * k), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(40,100,240,0.3)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, Z.cur.r * k), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(90,170,255,0.95)'; ctx.lineWidth = Math.max(2, Wd / 220); ctx.stroke();
    if (Z.next) {
      const [nx, ny] = toS(Z.next.x, Z.next.z);
      ctx.beginPath(); ctx.arc(nx, ny, Math.max(0.5, Z.next.r * k), 0, Math.PI * 2);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, Wd / 300); ctx.stroke();
      const a = G.Game.player, p = this.focus();
      if (a.alive && Math.hypot(p.x - Z.next.x, p.z - Z.next.z) > Z.next.r) {
        const [px, py] = toS(p.x, p.z);
        ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
      }
    }
    ctx.restore();
  },
  drawActors(ctx, toS, scale) {
    const Game = G.Game, team = Game.teams[Game.player.team], P = G.Player;
    team.members.forEach((m, i) => {
      if (!m.alive && m !== Game.player) return;
      if (m.state === 'plane' && !(m === Game.player)) return;
      const p = m.state === 'plane' && Game.plane ? Game.plane.pos : m.pos;
      const [x, y] = toS(p.x, p.z);
      if (m === Game.player && m.alive) {
        ctx.save(); ctx.translate(x, y);
        const yaw = P.camMode === 'fp' ? m.yaw : P.orbitYaw;
        ctx.rotate(-yaw);
        ctx.beginPath(); ctx.moveTo(0, -9 * scale); ctx.lineTo(6 * scale, 7 * scale); ctx.lineTo(0, 3.5 * scale); ctx.lineTo(-6 * scale, 7 * scale); ctx.closePath();
        ctx.fillStyle = Game.teamSize > 1 ? Game.TEAM_COLORS[i] : '#ffd23f'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
        // 시야 부채꼴
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 40 * scale, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
        ctx.restore();
      } else if (m.alive) {
        ctx.beginPath(); ctx.arc(x, y, 6 * scale, 0, Math.PI * 2);
        ctx.fillStyle = m.knocked ? (Math.floor(Date.now() / 300) % 2 ? '#ff4b4b' : '#661111') : Game.TEAM_COLORS[i];
        ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#000'; ctx.font = 'bold ' + Math.round(9 * scale) + 'px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x, y + 0.5);
      }
    });
  },
  drawMini() {
    const ctx = this.mctx, Wd = this.mini.width, H = this.mini.height, Game = G.Game, mc = G.World.mapCanvas;
    const S = 260, k = Wd / S, mk = mc.width / G.World.SIZE;
    const f = this.focus(), px = f.x, pz = f.z;
    ctx.fillStyle = '#1d3f50'; ctx.fillRect(0, 0, Wd, H);
    const HALF = G.World.HALF;
    ctx.drawImage(mc, (px - S / 2 + HALF) * mk, (pz - S / 2 + HALF) * mk, S * mk, S * mk, 0, 0, Wd, H);
    const toS = (x, z) => [(x - px) * k + Wd / 2, (z - pz) * k + H / 2];
    // 수송기 경로
    if (Game.plane && !Game.plane.done && Game.player.state === 'plane') {
      const p = Game.plane, a0 = toS(p.start.x, p.start.z), a1 = toS(p.start.x + p.dir.x * p.len, p.start.z + p.dir.z * p.len);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke(); ctx.setLineDash([]);
    }
    this.drawZone(ctx, toS, k, Wd, H);
    this.drawActors(ctx, toS, 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, Wd - 2, H - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = 'bold 22px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', Wd / 2, 22);
  },
  drawBig() {
    const ctx = this.bctx, Wd = this.big.width, H = this.big.height, Game = G.Game, Wl = G.World;
    const k = Wd / Wl.SIZE;
    ctx.drawImage(Wl.mapCanvas, 0, 0, Wd, H);
    const HALF = Wl.HALF, cell = Wl.SIZE / 10;
    const toS = (x, z) => [(x + HALF) * k, (z + HALF) * k];
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.font = '600 16px Rajdhani, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (let i = 1; i < 10; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell * k, 0); ctx.lineTo(i * cell * k, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell * k); ctx.lineTo(Wd, i * cell * k); ctx.stroke();
    }
    for (let i = 0; i < 10; i++) { ctx.fillText('ABCDEFGHIJ'[i], i * cell * k + 6, 4); ctx.fillText(String(i + 1), 4, i * cell * k + 6); }
    // 지형 이름 (산·호수·강)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const L of (Wl.labels || [])) {
      const [x, y] = toS(L.x, L.z);
      ctx.font = 'italic 600 15px "Noto Sans KR", sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.strokeText(L.name, x, y);
      ctx.fillStyle = L.water ? '#bfe6ff' : '#f2e6c8'; ctx.fillText(L.name, x, y);
    }
    for (const t of Wl.towns) {
      const [x, y] = toS(t.x, t.z);
      ctx.font = 'bold ' + (t.r > 60 ? 18 : 15) + 'px "Noto Sans KR", sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(t.name, x, y - t.r * k - 10);
      ctx.fillStyle = '#fff'; ctx.fillText(t.name, x, y - t.r * k - 10);
    }
    if (Game.plane && !Game.plane.done) {
      const p = Game.plane, a0 = toS(p.start.x, p.start.z), a1 = toS(p.start.x + p.dir.x * p.len, p.start.z + p.dir.z * p.len);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([12, 10]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke(); ctx.setLineDash([]);
      const [x, y] = toS(p.pos.x, p.pos.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(p.dir.z, p.dir.x) + Math.PI / 2);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(10, 8); ctx.lineTo(0, 4); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    this.drawZone(ctx, toS, k, Wd, H);
    this.drawActors(ctx, toS, 1.6);
  }
};

})();
