// Browse all weapons in the menu; equip them directly only in solo training.
(function () {
'use strict';
const G = window.G, T = window.THREE, $ = id => document.getElementById(id);
const A = G.Armory = {
  open: false, family: 'all', query: '', selected: 'mp9', yaw: .75, pitch: .15,
  show() {
    if (this.open || G.Settings?.open || G.Attachments?.open) return;
    if (G.Game.state !== 'menu' && !(G.Game.state === 'playing' && G.Game.training && G.Game.player?.alive)) return;
    this.init(); this.training = G.Game.state === 'playing'; this.wasPaused = !!G.paused;
    this.returnFocus = document.activeElement; this.open = true;
    G.paused = true;
    if (this.training) { G.paused = true; G.Input.unlock(); G.UI.showPause(false); }
    $('armoryModal').classList.remove('hidden');
    const key = G.Settings.label('KeyJ');
    $('armoryHint').textContent = this.training ? `총기를 선택하면 가득 장전된 상태로 받습니다. ${key} 또는 Esc로 닫기` : `훈련장에서 ${key}를 누르면 원하는 총기를 바로 시험할 수 있습니다.`;
    this.list(); this.detail(); $('armorySearch').focus();
  },
  close(resume = true) {
    if (!this.open) return;
    this.open = false; $('armoryModal').classList.add('hidden');
    if (this.training && resume && G.Game.state === 'playing') {
      if (this.wasPaused) { G.paused = true; G.UI.showPause(true); $('trainArmoryBtn').focus(); }
      else G.resume();
    } else if (!this.training) { G.paused = this.wasPaused; this.returnFocus?.focus(); }
  },
  init() {
    if ($('armoryModal')) return;
    const modal = document.createElement('div'); modal.id = 'armoryModal'; modal.className = 'hidden';
    modal.innerHTML = '<section class="armory-panel" role="dialog" aria-modal="true" aria-labelledby="armoryTitle"><header><div><small>LAST ZONE / ARMORY</small><h2 id="armoryTitle">무기 도감 <em>36</em></h2></div><button id="armoryClose" aria-label="무기 도감 닫기">닫기 ×</button></header><p id="armoryHint"></p><div class="armory-search"><input id="armorySearch" type="search" placeholder="무기 이름 · 탄약 검색" aria-label="총기 검색"><span id="armoryCount" role="status"></span></div><nav id="armoryFilters" aria-label="총기 종류"></nav><div class="armory-content"><div id="armoryList" aria-label="총기 목록"></div><aside><div id="armoryPreview" aria-label="드래그해서 총기 회전"></div><small class="armory-drag">드래그해서 회전</small><div id="armoryDetail"></div><button id="armorySound">발사음 듣기</button><button id="armoryEquip">훈련 무기로 장착</button></aside></div></section>';
    document.body.append(modal);
    $('armoryClose').onclick = () => this.close();
    modal.onclick = e => { if (e.target === modal) this.close(); };
    $('armorySearch').oninput = e => { this.query = e.target.value; this.list(); };
    $('armoryFilters').onclick = e => { const b = e.target.closest('[data-family]'); if (b) { this.family = b.dataset.family; this.list(); } };
    $('armoryList').onclick = e => { const b = e.target.closest('[data-gun]'); if (b) { this.selected = b.dataset.gun; this.list(); this.detail(); } };
    $('armoryEquip').onclick = () => this.equip(this.selected);
    $('armorySound').onclick = () => { G.Audio.init(); G.Audio.shot(this.selected, null, true); };
    let drag;
    const host = $('armoryPreview');
    host.onpointerdown = e => { drag = [e.clientX, e.clientY]; host.setPointerCapture(e.pointerId); };
    host.onpointermove = e => { if (!drag) return; this.yaw += (e.clientX - drag[0]) * .012; this.pitch = G.U.clamp(this.pitch + (e.clientY - drag[1]) * .008, -.75, .75); drag = [e.clientX, e.clientY]; this.renderPreview(); };
    host.onpointerup = host.onpointercancel = () => { drag = null; };
    addEventListener('resize', () => { if (this.open) this.renderPreview(); });
  },
  list() {
    const groups = { all: '총기 전체', new: '신규 총기 15종', melee: '칼 6종', ...G.FAMILY_NAMES };
    $('armoryFilters').innerHTML = Object.entries(groups).map(([k, name]) => `<button data-family="${k}" aria-pressed="${this.family === k}">${name}</button>`).join('');
    const q = this.query.trim().toLocaleLowerCase();
    const ids = (this.family==='melee'?G.Knives.ids:G.GUN_IDS).filter(id => {
      if(G.Knives.is(id))return [G.Knives.catalog[id].name,G.Knives.catalog[id].role].join(' ').includes(q);
      const d = G.WEAPONS[id];
      return (this.family === 'all' || (this.family === 'new' ? !!G.WeaponCatalog[id] : d.family === this.family)) &&
        [d.name, d.short, G.AMMO_NAMES[d.ammo], G.FAMILY_NAMES[d.family], d.role || ''].join(' ').toLocaleLowerCase().includes(q);
    });
    $('armoryCount').textContent = ids.length + ' / ' + (this.family==='melee'?G.Knives.ids.length:G.GUN_IDS.length) + '종';
    if(this.family==='melee'){
      $('armoryList').innerHTML=ids.map(id=>{const d=G.Knives.catalog[id];return '<button data-gun="'+id+'" aria-pressed="'+(this.selected===id)+'"><span>근접무기</span><strong>'+d.name+'</strong><small>피해 '+d.dmg+' · 사거리 '+d.reach+'m</small></button>'}).join('');return;
    }
    $('armoryList').innerHTML = ids.length ? ids.map(id => { const d = G.WEAPONS[id], action = d.reloadType === 'revolver' ? '리볼버' : { auto: '자동', semi: '반자동', bolt: '볼트액션', pump: '펌프', break: '중절식' }[d.action]; return `<button data-gun="${id}" aria-pressed="${this.selected === id}"><span>${G.FAMILY_NAMES[d.family]}${G.WeaponCatalog[id] ? '<b>NEW</b>' : ''}</span><strong>${d.short}</strong><small>${G.AMMO_NAMES[d.ammo]} · ${d.mag}발 · ${action}</small></button>`; }).join('') : '<p class="armory-empty">검색 결과가 없습니다.</p>';
  },
  detail() {
    $('armorySound').hidden=G.Knives.is(this.selected);
    if(G.Knives.is(this.selected)){
      const d=G.Knives.catalog[this.selected];
      $('armoryDetail').innerHTML='<small>근접무기</small><h3>'+d.name+'</h3><p>'+d.role+'</p><dl><div><dt>피해</dt><dd>'+d.dmg+'</dd></div><div><dt>사거리</dt><dd>'+d.reach+'m</dd></div><div><dt>공격 간격</dt><dd>'+d.duration+'초</dd></div></dl><p>좌클릭 휘두르기 · 우클릭 / '+G.Settings.label('KeyT')+' 자세히 보기 · '+G.Settings.label('Digit5')+' 칼 종류 변경</p><a target="_blank" rel="noopener" href="assets/models/knives/CREDITS.md">모델·모션 출처</a>';
      $('armoryEquip').hidden=!this.training;this.preview(this.selected);return;
    }
    const d = G.WEAPONS[this.selected], damage = d.pellets > 1 ? d.dmg + ' × ' + d.pellets : d.dmg;
    $('armoryDetail').innerHTML = `<small>${G.FAMILY_NAMES[d.family]} / ${G.AMMO_NAMES[d.ammo]}</small><h3>${d.name}</h3><p>${d.role || { assault: '다양한 거리에서 활용하는 균형 잡힌 주무기', dmr: '정확한 단발 사격에 적합한 정밀 소총', sniper: '강한 한 발과 수동 노리쇠 작동', shotgun: '근접전에서 강력한 산탄 화력', pistol: '빠르게 꺼내 쓰는 보조무기' }[d.family]}</p><dl><div><dt>기본 피해</dt><dd>${damage}</dd></div><div><dt>분당 발사</dt><dd>${d.rpm}</dd></div><div><dt>탄창</dt><dd>${d.mag}발</dd></div><div><dt>조준 시간</dt><dd>${Math.round(d.adsTime * 1000)}ms</dd></div><div><dt>${d.reloadType === 'shell' ? '한 발 장전' : '탄창 교체'}</dt><dd>${d.reload.toFixed(2)}초</dd></div><div><dt>무기 슬롯</dt><dd>${G.CLASS_NAMES[d.cls]}</dd></div></dl>`;
    $('armoryEquip').hidden = !this.training;
    const imported = G.Guns.gunData(this.selected);
    if (imported.extra?.importedExpansion) {
      const credit = document.createElement('small'); credit.className = 'armory-credit';
      credit.textContent = imported.sourceAsset + ' · ' + imported.credit + ' ';
      const link = document.createElement('a'); link.href = 'assets/models/guns/EXPANSION-CREDITS.md';
      link.target = '_blank'; link.rel = 'noopener'; link.textContent = '모델·모션 출처'; credit.append(link);
      $('armoryDetail').append(credit);
    }
    this.preview(this.selected);
  },
  equip(id) {
    if(G.Knives.is(id)){
      if(!this.open||!this.training||!G.Game.training||!G.Training.active||!G.Knives.equip(G.Player,id))return false;
      G.UI.toast(G.Knives.catalog[id].name+' 장착');this.close();return true;
    }
    if (!this.open || !this.training || !G.Game.training || !G.Training.active || !G.Game.player?.alive || !G.GUN_IDS.includes(id)) return false;
    const a = G.Game.player, p = G.Player, d = G.WEAPONS[id];
    a.give(id, 0); a.ammo[d.ammo] = 999; a.cur = d.cls;
    p.reload = p.autoReload = p.sw = p.throwSt = null; p.cycleT = p.pumpT = -1;
    p.ads = p.bloom = p.recoilAcc = 0; p.fireMode = 'auto'; p.nextFire = G.U.now() + .2; p.raise = 0;
    G.VM.set(id); G.Audio.click('switch'); G.UI.toast(d.short + ' 장착');
    this.close(); return true;
  },
  preview(id) {
    if (!this.renderer) {
      this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true }); this.renderer.setPixelRatio(Math.min(G.screenPixelRatio(), 1.5));
      this.renderer.outputColorSpace = T.SRGBColorSpace; $('armoryPreview').append(this.renderer.domElement);
      this.scene = new T.Scene();
      // Render targets belong to their WebGL context; build this viewer's
      // reflections from the shared CPU-backed HDR instead of the game target.
      const hdr = G.Assets?.sky?.day?.hdr;
      if (hdr) { const pm = new T.PMREMGenerator(this.renderer); this.environment = pm.fromEquirectangular(hdr); this.scene.environment = this.environment.texture; pm.dispose(); }
      this.scene.add(new T.HemisphereLight(0xdcecff, 0x383027, 3.4));
      const light = new T.DirectionalLight(0xffead0, 4.5); light.position.set(-1, 2, 2); this.scene.add(light);
      const rim = new T.DirectionalLight(0x9fc7ff, 3); rim.position.set(1, .5, -1); this.scene.add(rim);
      this.camera = new T.PerspectiveCamera(32, 1, .01, 10);
    }
    if (this.object) this.scene.remove(this.object);
    if(G.Knives.is(id)){
      const shape=G.Knives.model(id),bounds=new T.Box3().setFromObject(shape),center=bounds.getCenter(new T.Vector3());
      shape.position.sub(center);const group=this.object=new T.Group();group.add(shape);this.scene.add(group);this.renderPreview();return;
    }
    const data = G.Guns.gunData(id), group = this.object = new T.Group(), shape = new T.Group();
    // Cached model geometry/materials are shared, never disposed by this viewer.
    for (const part of Object.values(data.parts)) for (const [mat, geometry] of Object.entries(part)) shape.add(new T.Mesh(geometry, data.real ? data.mats[mat] : G.Guns.mats()[mat] || G.Guns.mats().metal));
    const sight = G.WEAPONS[id].baseSight;
    if (sight && data.rail) {
      let profile=G.VM.models[id]?.attachmentProfile;
      if(!profile){shape.updateWorldMatrix(true,true);profile=G.AttachmentMounts.measure([shape],new T.Matrix4(),{rail:[data.muzzle.x,data.rail.y,data.rail.z],muzzle:data.muzzle,under:data.fore},G.WEAPONS[id])}
      const optic=G.AttachmentMounts.optic(profile,sight,G.WEAPONS[id]);if(optic)shape.add(optic.root);
    }
    const bounds = new T.Box3().setFromObject(shape), center = bounds.getCenter(new T.Vector3());
    shape.position.sub(center); group.add(shape); this.scene.add(group);
    this.renderPreview();
  },
  renderPreview() {
    if (!this.object || !this.open) return;
    const host = $('armoryPreview'), w = host.clientWidth, h = host.clientHeight;
    this.renderer.setSize(w, h); this.camera.aspect = w / h;
    this.object.rotation.set(this.pitch, this.yaw + Math.PI / 2, 0);
    const size = new T.Box3().setFromObject(this.object).getSize(new T.Vector3()), f = 2 * Math.tan(this.camera.fov * Math.PI / 360);
    this.camera.position.set(0, 0, Math.max(size.y / f, size.x / (f * this.camera.aspect)) * 1.12 + size.z / 2);
    this.camera.lookAt(0, 0, 0); this.camera.updateProjectionMatrix();
    G.TextureQuality?.scan(this.scene, true);
    this.renderer.render(this.scene, this.camera);
  }
};
$('armoryBtn').onclick = $('trainArmoryBtn').onclick = () => A.show();
addEventListener('keydown', e => {
  const shortcut = G.Input.map(e.code) === 'KeyJ', typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;
  if (A.open && e.code === 'Tab') {
    const nodes = [...$('armoryModal').querySelectorAll('button,input')].filter(n => !n.hidden && !n.disabled && n.getClientRects().length);
    const i = nodes.indexOf(document.activeElement); e.preventDefault(); e.stopImmediatePropagation(); nodes[(i + (e.shiftKey ? nodes.length - 1 : 1)) % nodes.length]?.focus();
  } else if ((A.open && (e.code === 'Escape' || shortcut && !typing)) || (shortcut && G.Game.training && G.Game.state === 'playing' && !typing && !G.Settings?.open && !G.Attachments?.open)) {
    e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) A.open ? A.close() : A.show();
  }
}, true);
})();
