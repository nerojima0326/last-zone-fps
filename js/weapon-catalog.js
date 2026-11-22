// Expansion roster: shared by gameplay, original models, recoil and audio tools.
(function (root, factory) {
  const catalog = factory();
  if (typeof module === 'object' && module.exports) module.exports = catalog;
  else (root.G = root.G || {}).WeaponCatalog = catalog;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const optics = ['reddot', 'holo', 'x2', 'x4', 'x8'];
  const primary = { cls: 'rifle', ammo: '556', dmg: 25, head: 2.2, rpm: 750, auto: true, action: 'auto', mag: 30, reload: 2.5,
    spread: .025, ads: .0025, move: .036, bloom: .005, bloomMax: .032, recoilV: .016, recoilH: .006, vel: 860,
    adsFov: 46, kick: .6, range: 650, falloff: [110, .82], tracerLen: 9, sound: 'rifle', tier: 2, scopes: optics, adsTime: .18 };
  const smg = { ...primary, family: 'smg', ammo: '9mm', dmg: 20, head: 1.9, vel: 390, spread: .021, ads: .0035, move: .025,
    bloom: .004, bloomMax: .028, recoilV: .011, recoilH: .005, range: 260, falloff: [28, .56], tracerLen: 5, adsFov: 55, adsTime: .12, scopes: optics.slice(0, 3) };
  const lmg = { ...primary, family: 'lmg', adsTime: .29, spread: .035, move: .065, bloomMax: .05, kick: .8, tier: 3, scopes: optics.slice(0, 4) };
  const dmr = { ...primary, family: 'dmr', auto: false, action: 'semi', mag: 20, spread: .024, ads: .001, move: .049,
    bloom: .011, bloomMax: .03, head: 2.3, range: 950, tracerLen: 11, sound: 'dmr', adsTime: .22 };
  const shot = { cls: 'shotgun', family: 'shotgun', ammo: '12g', dmg: 14, head: 1.5, rpm: 90, action: 'pump', mag: 8, reloadType: 'shell', reload: .58,
    spread: .064, ads: .047, move: .024, bloom: 0, bloomMax: 0, recoilV: .06, recoilH: .017, vel: 425, adsFov: 61, kick: 1.55,
    pellets: 9, range: 135, falloff: [7, 30], tracerLen: 4, sound: 'shotgun', tier: 3, scopes: optics.slice(0, 3), adsTime: .2 };
  const entries = {};
  function add(key, short, family, base, stats, role, shape, reloadBase, audioBase, sound, motion, weight) {
    const [body, bark, crack, decay, balance, space, room] = sound;
    const [back, pitch, yaw, roll, speed, damping, action] = motion;
    entries[key] = { stats: { ...base, ...stats, key, short, family, name: short + ' ' + { assault: '돌격소총', smg: '기관단총', lmg: '경기관총', dmr: '지정사수소총', sniper: '저격소총', shotgun: '전술 산탄총', pistol: '권총' }[family], role },
      shape, reloadBase, audioBase, lootWeight: weight,
      audio: { body, bark, crack, decay, balance, space, room, tag: key + ' ' + family + ' report' },
      motion: { back, pitch, yaw, roll, speed, damping, ...(action ? { action } : {}) } };
  }
  add('mp9', 'MP-9', 'smg', smg, { rpm: 820, reload: 2.05, kick: .42 }, '빠른 조준 · 안정적인 근거리 연사',
    { style: 'tube', barrel: .35, guard: .13, stock: 'slider', mag: 'curve', color: 'dark' }, 'sc17', 'g18',
    [350, 1900, 7600, .029, [1.1, .72, .65], 10, .11], [.013, 1.9, .3, .42, 34, .82, .036], 2.8);
  add('v45', 'V-45', 'smg', smg, { ammo: '45', dmg: 22, mag: 25, rpm: 1100, reload: 2.35, vel: 290, recoilV: .009, recoilH: .007, kick: .35, tier: 3, falloff: [22, .5] }, '초고속 연사 · 짧은 교전 거리',
    { style: 'vector', barrel: .27, guard: .09, stock: 'skeleton', mag: 'straight', color: 'tan' }, 'sc17', 'm1911',
    [240, 1300, 4900, .027, [.86, 1.1, .7], 9, .10], [.011, 1.4, .32, .5, 37, .87, .028], 1.6);
  add('cx9', 'CX-9', 'smg', smg, { dmg: 18, mag: 40, rpm: 900, reload: 2.4, kick: .38, recoilH: .0045, adsTime: .13 }, '40발 탄창 · 가벼운 반동',
    { style: 'compact', barrel: .31, guard: .14, stock: 'wire', mag: 'long', color: 'metal' }, 'sc17', 'p92',
    [390, 3100, 8800, .025, [1.2, .68, .63], 8, .095], [.012, 1.6, .25, .36, 35, .85, .033], 2.3);
  add('sm45', 'SM-45', 'smg', smg, { ammo: '45', dmg: 26, rpm: 650, reload: 2.3, vel: 300, kick: .55, recoilV: .015, recoilH: .0055, falloff: [34, .64] }, '느린 연사 · 높은 한 발 피해',
    { style: 'polymer', barrel: .37, guard: .15, stock: 'skeleton', mag: 'straight', color: 'olive' }, 'sc17', 'm1911',
    [182, 680, 4400, .049, [.8, 1.15, .9], 16, .16], [.019, 2.7, .32, .6, 29, .81, .049], 2.1);
  add('ar416', 'AR-416', 'assault', primary, { dmg: 25, rpm: 750, reload: 2.45, recoilH: .0055, tier: 3 }, '균형 잡힌 중거리 돌격소총',
    { style: 'quad', barrel: .55, guard: .23, stock: 'slider', mag: 'stanag', color: 'tan' }, 'sc17', 'ar7',
    [225, 2450, 7400, .043, [1.15, .91, .65], 18, .18], [.02, 2.5, .3, .38, 31, .81, .047], 2.2);
  add('sg56', 'SG-56', 'assault', primary, { dmg: 27, rpm: 700, reload: 2.65, recoilV: .018, recoilH: .0065, vel: 900, falloff: [140, .86], adsTime: .19 }, '긴 유효 사거리 · 묵직한 타격',
    { style: 'swiss', barrel: .59, guard: .22, stock: 'skeleton', mag: 'curve', color: 'olive' }, 'ka47', 'ka47',
    [198, 1650, 6500, .06, [1.0, 1.1, .8], 24, .20], [.024, 3.2, .36, .51, 28, .8, .053], 2);
  add('ms56', 'MS-56', 'assault', primary, { dmg: 23, rpm: 800, reload: 2.2, vel: 790, adsTime: .145, spread: .022, move: .03, falloff: [85, .76], kick: .53 }, '짧은 카빈 · 빠른 기동과 조준',
    { style: 'mlok', barrel: .43, guard: .19, stock: 'compact', mag: 'stanag', color: 'tan' }, 'sc17', 'ar7',
    [265, 2900, 8300, .035, [1.18, .78, .74], 14, .15], [.017, 2.1, .34, .4, 33, .8, .041], 2.8);
  add('lm86', 'LM-86', 'lmg', lmg, { dmg: 25, mag: 60, rpm: 720, reload: 4.7, vel: 915, recoilV: .016, recoilH: .007, falloff: [165, .86] }, '60발 드럼 · 지속적인 지원 사격',
    { style: 'quad', barrel: .68, guard: .30, stock: 'fixed', mag: 'drum', color: 'tan', bipod: true }, 'aa12', 'aa12',
    [205, 2050, 6900, .047, [1.0, 1.15, .78], 20, .19], [.021, 2.6, .38, .45, 27, .87, .052], 1.3);
  add('rk762', 'RK-762', 'lmg', lmg, { ammo: '762', dmg: 32, mag: 45, rpm: 600, reload: 3.65, vel: 760, recoilV: .024, recoilH: .009, ads: .003, falloff: [145, .84], adsTime: .26 }, '45발 곡선 탄창 · 강한 7.62mm 화력',
    { style: 'ak', barrel: .72, guard: .25, stock: 'fixed', mag: 'banana', color: 'wood', bipod: true }, 'ka47', 'ka47',
    [142, 840, 4200, .081, [.85, 1.25, 1.03], 29, .25], [.031, 3.8, .5, .72, 25, .83, .06], 1.1);
  add('mg60', 'MG-60', 'lmg', lmg, { ammo: '762', dmg: 30, mag: 100, rpm: 800, reload: 6.4, vel: 825, recoilV: .022, recoilH: .011, ads: .0035, adsTime: .34, spread: .042, move: .078, kick: .9, tier: 4, falloff: [180, .88] }, '100발 탄띠 · 덮개 개방식 장전',
    { style: 'support', barrel: .76, guard: .29, stock: 'fixed', mag: 'beltBox', color: 'olive', bipod: true }, 'aa12', 'aa12',
    [125, 1400, 5700, .078, [1.1, 1.3, .95], 26, .25], [.028, 3.2, .55, .8, 26, .88, .057], .65);
  add('sr25', 'SR-25', 'dmr', dmr, { ammo: '762', dmg: 50, rpm: 280, reload: 2.9, recoilV: .035, recoilH: .007, vel: 885, kick: 1.12, falloff: [250, .9], tier: 4, baseSight: 'x4' }, '정밀 반자동 · 기본 4배율 조준경',
    { style: 'quad', barrel: .70, guard: .32, stock: 'marksman', mag: 'box', color: 'dark', bipod: true }, 'sc17', 'mk14',
    [162, 3200, 8400, .089, [1.3, 1.0, .9], 33, .29], [.034, 4.8, .38, .55, 25, .83, .06], .9);
  add('dm56', 'DM-56', 'dmr', dmr, { dmg: 39, rpm: 420, reload: 2.5, recoilV: .022, recoilH: .005, vel: 940, kick: .8, falloff: [200, .84], tier: 3, baseSight: 'x2' }, '빠른 후속 사격 · 5.56mm 정밀 소총',
    { style: 'mlok', barrel: .64, guard: .29, stock: 'marksman', mag: 'box', color: 'tan' }, 'sc17', 'ar7',
    [280, 3500, 9100, .051, [1.25, .82, .8], 23, .18], [.025, 3.4, .3, .4, 29, .84, .049], 1.4);
  add('m24', 'M-24', 'sniper', dmr, { ammo: '762', dmg: 92, head: 2.5, rpm: 50, action: 'bolt', cycle: 1.1, mag: 5, reloadType: 'mag', reload: 3.4,
    spread: .055, ads: .00035, move: .065, bloom: 0, bloomMax: 0, recoilV: .054, recoilH: .009, vel: 935, kick: 1.7, range: 1150, falloff: [400, .92], tier: 4, baseSight: 'x4', adsTime: .28 }, '고위력 볼트액션 · 탈착식 5발 탄창',
    { style: 'bolt', barrel: .78, guard: .29, stock: 'marksman', mag: 'mini', color: 'olive', bipod: true }, 'kr98', 'kr98',
    [108, 2200, 7800, .128, [1.4, 1.2, 1.1], 47, .42], [.044, 6.6, .45, .72, 21, .84], .75);
  add('sp12', 'SP-12', 'shotgun', shot, {}, '8발 튜브 · 펌프 작동 · 접이식 개머리판',
    { style: 'pump', barrel: .64, guard: .24, stock: 'folded', color: 'dark' }, 's12', 's12',
    [156, 670, 5100, .087, [.85, 1.3, 1.07], 30, .25], [.04, 6.3, .55, .78, 24, .83], 1.8);
  add('p226', 'P-226', 'pistol', {}, { cls: 'pistol', ammo: '9mm', dmg: 27, head: 2, rpm: 400, mag: 18, reload: 1.55, len: .198,
    spread: .014, ads: .004, move: .021, bloom: .011, bloomMax: .032, recoilV: .028, recoilH: .0075, vel: 390, adsFov: 64, kick: .85,
    range: 320, falloff: [40, .73], tracerLen: 5, sound: 'pistol', tier: 2, scopes: ['reddot'], adsTime: .12 }, '18발 탄창 · 안정적인 반자동 보조무기',
    { style: 'pistol', barrel: .15, color: 'metal' }, 'p92', 'p92',
    [310, 2400, 7900, .039, [1.15, .72, .88], 13, .14], [.021, 5.8, .43, .8, 30, .81, .046], 2.4);
  return entries;
});
