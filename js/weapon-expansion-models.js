// Original expansion models, in metres. Shared by held, dropped and actor guns.
(function () {
'use strict';
const G = window.G, T = window.THREE;
Object.assign(G.GunLib.COL, { machined: 0x4b535e, phosphate: 0x2c323b, polymer: 0x343b43 });
function block(B, part, mat, w, h, d, x, y, z, rx = 0) {
  // Bevel the main machined/polymer surfaces; small details keep crisp edges.
  const r = Math.min(.002, w / 5, h / 5, d / 5), q = new T.Shape();
  q.moveTo(-w / 2 + r, -h / 2 + r); q.lineTo(w / 2 - r, -h / 2 + r);
  q.lineTo(w / 2 - r, h / 2 - r); q.lineTo(-w / 2 + r, h / 2 - r); q.closePath();
  const geo = new T.ExtrudeGeometry(q, { depth: d - 2 * r, steps: 1, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 1 });
  geo.translate(0, 0, -d / 2 + r); if (rx) geo.rotateX(rx);
  B.add(part, mat, geo.translate(x, y, z));
}
function stock(B, s) {
  const c = s.color, z = s.style === 'tube' || s.style === 'compact' ? .25 : .30;
  if (s.stock === 'folded') {
    for (const x of [-.03, .03]) block(B, 'body', 'metal', .009, .012, .27, x, .088, -.025);
    block(B, 'body', 'dark', .074, .016, .025, 0, .088, -.15);
  } else if (s.stock === 'wire' || s.stock === 'skeleton') {
    for (const y of [.053, -.006]) B.cyl('body', 'metal', .006, .006, .075, z, 0, y);
    block(B, 'body', c, .034, .087, .024, 0, .018, z);
    if (s.stock === 'skeleton') block(B, 'body', c, .03, .025, .095, 0, .056, z - .04);
  } else if (s.stock === 'fixed' || s.stock === 'marksman') {
    block(B, 'body', c, .043, .069, z - .09, 0, .015, (z + .09) / 2);
    block(B, 'body', 'poly', .046, .092, .014, 0, .003, z + .006);
    if (s.stock === 'marksman') {
      block(B, 'body', 'poly', .047, .025, .12, 0, .061, z - .07);
      B.cylX('body', 'steel', .009, .049, 0, .023, z - .06);
    }
  } else {
    B.cyl('body', 'metal', .012, .012, .07, z - .02, 0, .04);
    block(B, 'body', c, .04, .062, .105, 0, .015, z - .045);
    block(B, 'body', 'poly', .044, .083, .014, 0, .005, z + .01);
    for (let i = 0; i < 4; i++) B.box('body', 'dark', .043, .003, .004, 0, -.009 + i * .012, z + .018);
  }
}
function magazine(B, s) {
  if (!s.mag) return;
  const z = s.style === 'vector' ? -.066 : -.09;
  B.pivots.mag = [0, -.01, z];
  if (s.mag === 'drum' || s.mag === 'doubleDrum') {
    block(B, 'mag', 'dark', .028, .06, .05, 0, -.035, z);
    const r = s.mag === 'drum' ? .066 : .071;
    for (const x of s.mag === 'drum' ? [0] : [-.047, .047]) {
      B.cyl('mag', 'poly', r, r, z - .04, z + .04, x, -.105, 24);
      B.cyl('mag', 'metal', r * .79, r * .79, z + .04, z + .044, x, -.105, 24);
      B.cyl('mag', 'dark', .014, .014, z + .044, z + .047, x, -.105, 16);
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; B.cyl('mag', 'dark', .003, .003, z + .044, z + .046, x + Math.sin(a) * r * .87, -.105 + Math.cos(a) * r * .87, 6); }
    }
  } else {
    const narrow = ['straight', 'curve', 'long'].includes(s.mag), w = narrow ? .022 : .027;
    const h = s.mag === 'mini' ? .052 : s.mag === 'long' ? .185 : s.mag === 'box' ? .094 : s.mag === 'banana' ? .195 : .143;
    const d = narrow ? .033 : .058, curve = ['curve', 'stanag', 'banana'].includes(s.mag) ? .26 : 0;
    for (let i = 0; i < 3; i++) {
      const f = (i + .5) / 3, cy = -.01 - h * f, cz = z + curve * h * f * f;
      block(B, 'mag', s.mag === 'banana' ? 'bake' : 'dark', w, h / 3 + .008, d, 0, cy, cz, curve * f);
      for (const x of [-1, 1]) for (const dz of [-.008, .008]) B.box('mag', 'metal', .001, h / 3 * .8, .002, x * (w / 2 + .0005), cy, cz + dz, curve * f);
    }
    block(B, 'mag', 'poly', w + .005, .01, d + .005, 0, -.01 - h, z + curve * h, curve);
  }
}
function details(B, s, front) {
  // Ejection-port recess, pinned lower, selector, bolt catch and charging handle.
  B.box('body', 'dark', .002, .016, .052, .024, .045, -.035);
  B.box('body', 'steel', .002, .008, .034, .0252, .044, -.039);
  for (const x of [-.025, .025]) for (const z of [-.08, .045]) B.cylX('body', 'steel', .003, .002, x, .012, z, 8);
  B.cylX('body', 'dark', .007, .004, -.026, .011, .012);
  B.box('body', 'metal', .005, .005, .019, -.03, .011, .016, -.3);
  const charge = s.style === 'ak' || s.style === 'bolt' ? [.047, .063, .015] : [s.style === 'vector' ? -.065 : -.036, .063, -.072];
  if (s.style !== 'bolt') {
    if (s.style === 'vector') B.cylX('charge', 'dark', .0035, .04, -.044, charge[1], charge[2]);
    block(B, 'charge', 'dark', .027, .009, .014, charge[0], charge[1], charge[2]); B.pivots.charge = charge;
  }
  B.box('rearsight', 'dark', .024, .012, .016, 0, .0885, .058);
  B.notch(.112, .058, .025, .019, .012);
  B.box('body', 'dark', .024, .043, .013, 0, .0785, front);
  B.box('body', 'metal', .0035, .015, .004, 0, .1045, front);
  for (const x of [-.012, .012]) B.box('body', 'metal', .004, .018, .01, x, .103, front);
  return charge;
}
function longGun(B, entry) {
  const s = entry.shape, c = s.color, smg = entry.stats.family === 'smg', bolt = s.style === 'bolt', pump = s.style === 'pump';
  const w = smg ? .044 : .048, guardH = smg ? .043 : .05, guardZ = -.14 - s.guard / 2;
  block(B, 'body', s.style === 'swiss' || s.style === 'ak' ? 'metal' : c, w, .037, .21, 0, .022, -.018);
  if (s.style === 'tube') B.cyl('body', 'metal', .024, .024, .085, -.19, 0, .061, 20);
  else if (bolt) B.cyl('body', 'metal', .021, .021, .07, -.17, 0, .058, 20);
  else block(B, 'body', 'metal', w - .003, .034, .225, 0, .056, -.022);
  if (s.style === 'vector') { block(B, 'body', c, .052, .081, .095, 0, -.027, -.035); block(B, 'body', 'dark', .048, .016, .083, 0, -.073, -.035); }
  // The grip and trigger stay at the same measured contact frame as the IK rig.
  block(B, 'body', 'poly', .027, .085, .035, 0, -.046, .045, -.30); B.trigger('metal');
  for (let i = 0; i < 5; i++) B.box('body', 'dark', .028, .002, .028, 0, -.018 - i * .012, .047 + i * .0036, -.30);
  stock(B, s);
  const guardPart = pump ? 'pump' : 'body';
  if (s.style === 'tube') B.cyl(guardPart, 'poly', .029, .026, -.14, -.14 - s.guard, 0, .031, 16);
  else block(B, guardPart, c, w + .004, guardH, s.guard, 0, .03, guardZ);
  for (let i = 0; i < Math.floor(s.guard / .027); i++) for (const x of [-1, 1]) {
    const z = -.155 - i * .027;
    B.box(guardPart, 'dark', .0015, s.style === 'mlok' ? .007 : .014, .017, x * (w / 2 + .0025), .038, z);
    if (s.style === 'quad') B.box(guardPart, 'dark', .005, .026, .008, x * (w / 2 + .004), .029, z);
  }
  if (s.style === 'swiss') block(B, 'body', c, .034, .014, s.guard * .85, 0, .067, guardZ);
  B.cyl('body', 'metal', pump ? .013 : s.style === 'support' ? .012 : .009, .009, -.12, -s.barrel, 0, .057, 20);
  if (s.style === 'support') for (let i = 0; i < 10; i++) B.cyl('body', 'dark', .016, .016, -.47 - i * .017, -.477 - i * .017, 0, .057, 16);
  B.cyl('body', 'dark', .013, .013, -s.barrel, -s.barrel - .035, 0, .057, 12);
  B.disc('body', 'dark', .006, 0, .057, -s.barrel - .0355);
  if (pump) {
    B.cyl('body', 'metal', .011, .011, -.12, -s.barrel + .03, 0, .017, 18);
    B.pivots.pump = [0, .03, guardZ];
    for (let i = 0; i < 9; i++) B.box('pump', 'dark', w + .006, .003, .004, 0, .004, -.155 - i * .024);
    // Perforated heat shield, with a clear central sight channel.
    for (const x of [-.02, .02]) { block(B, 'body', 'metal', .007, .025, .37, x, .073, -.34); for (let i = 0; i < 12; i++) B.box('body', 'dark', .001, .009, .011, x + Math.sign(x) * .004, .076, -.17 - i * .028); }
  }
  B.box('body', 'dark', .026, .006, .20, 0, .078, -.028); B.rail('body', 'metal', .083, -.13, .065);
  if (s.style === 'quad' || s.style === 'mlok') B.rail('body', 'dark', .063, -.15, -.13 - s.guard);
  if (!pump) { block(B, 'body', 'metal', .036, .035, .068, 0, -.003, -.09); magazine(B, s); }
  const charge = details(B, s, -.11 - s.guard);
  if (bolt) {
    B.pivots.bolt = [0, .058, .055];
    B.cyl('bolt', 'steel', .012, .012, .07, -.09, 0, .058, 16);
    B.cylX('bolt', 'metal', .0045, .076, .038, .058, .055); B.sphere('bolt', 'dark', .010, .078, .047, .055);
  }
  if (s.bipod) for (const x of [-1, 1]) { block(B, 'body', 'dark', .008, .012, .22, x * .032, -.005, -.32 - s.guard * .45, -.08); B.cylX('body', 'steel', .006, .008, x * .031, .017, -.14 - s.guard, 10); }
  return { muzzle: [0, .057, -s.barrel - .035], sight: [.112, .058], rail: [.085, -.03],
    fore: [0, .03 - guardH / 2 - (entry.stats.key === 'lm86' ? .007 : .004), guardZ - s.guard * (pump ? .26 : .12)], port: pump ? [0, -.005, -.07] : bolt ? [0, .085, -.04] : [.025, .05, -.04],
    charge: bolt ? [.078, .047, .055] : charge,
    extra: { chargeMode: charge[0] < 0 ? 'left' : 'under' } };
}
function pistol(B) {
  block(B, 'body', 'metal', .031, .021, .153, 0, .009, -.038);
  block(B, 'slide', 'metal', .029, .029, .166, 0, .036, -.043); B.pivots.slide = [0, .036, -.043];
  B.cyl('body', 'steel', .007, .007, -.012, -.13, 0, .038, 20);
  B.cyl('body', 'dark', .004, .004, -.125, -.133, 0, .038, 16);
  block(B, 'body', 'poly', .031, .087, .037, 0, -.043, .013, -.20); B.trigger('metal', -.022, -.023, .052);
  for (let i = 0; i < 8; i++) for (const x of [-1, 1]) { B.box('body', 'dark', .001, .0025, .028, x * .016, -.014 - i * .009, .014 + i * .0018, -.20); B.box('slide', 'dark', .001, .023, .002, x * .015, .036, .014 - i * .004, -.16); }
  B.box('slide', 'dark', .019, .002, .021, .005, .051, -.042);
  B.box('body', 'dark', .009, .018, .009, 0, .035, .044, -.4); // external hammer
  B.cylX('body', 'steel', .005, .034, 0, .007, .018, 12);
  B.box('body', 'dark', .004, .006, .023, -.018, .002, -.005);
  block(B, 'mag', 'dark', .023, .075, .026, 0, -.046, .014, -.20);
  block(B, 'mag', 'poly', .033, .009, .039, 0, -.089, .024, -.20); B.pivots.mag = [0, -.087, .022];
  B.notch(.060, .031, .021, .012, .009);
  B.box('slide', 'dark', .004, .008, .008, 0, .056, -.116);
  return { muzzle: [0, .038, -.133], sight: [.060, .031], rail: [.052, .005, 'slide'], fore: [-.023, -.058, .015],
    slideTop: [0, .052, .022], magDir: [0, -Math.cos(.20), Math.sin(.20)] };
}
for (const [id, entry] of Object.entries(G.WeaponCatalog)) G.GunLib.DESIGNS[id] = B => {
  const add = B.add, finish = { metal: 'machined', dark: 'phosphate', poly: 'polymer' };
  B.add = function (part, mat, geometry) { return add.call(this, part, finish[mat] || mat, geometry); };
  return entry.shape.style === 'pistol' ? pistol(B) : longGun(B, entry);
};
})();
