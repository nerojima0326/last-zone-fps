// Fit the animated hands to each weapon without moving its sights or action.
(function () {
'use strict';
const G = window.G, T = window.THREE, V = T.Vector3, Q = T.Quaternion;
// Offsets are metres in the weapon frame: right, up, back. Finger opening is
// measured in radians along the finger's own bend plane, not a rig-local axis.
const profiles = {
  ar7: {"R":{"at":[0,0,0]},"L":{"at":[0,0,0]}},
  ka47: {"R":{"at":[0.006,-0.002,0.002]},"L":{"at":[-0.009,-0.003,0]}},
  sc17: {"R":{"at":[0.0125,-0.009,0.009],"curl":[[-0.24,0.24],[0.24,0.12],[0.24,0.24],[-0.12,-0.12],[0.12,0]]},"L":{"at":[-0.021,-0.0205,-0.0195]}},
  mk14: {"R":{"at":[0.0135,-0.007,0.008],"curl":[[-0.12,-0.12],[0,0],[0,0],[0,0.12],[0.24,0.24]]},"L":{"at":[-0.006,-0.003,0],"curl":[[-0.24,0],[0.12,0],[0.24,0.12],[0.24,0.24],[0.24,0.24]]}},
  kr98: {"R":{"at":[0,0,0]},"L":{"at":[-0.007,-0.004,-0.01]}},
  s12: {"R":{"at":[0,0,0],"curl":[[0.24,0.12],[-0.24,-0.12],[-0.12,0.12],[0.12,0],[0,0]]},"L":{"at":[-0.004,-0.002,0]}},
  m1014: {"R":{"at":[0.005,-0.032,-0.025],"turn":[-8,0,0]},"L":{"at":[-0.0055,-0.014,-0.002],"freeAt":[-0.015,-0.02,0]}},
  db2: {"R":{"at":[0.003,0,0]},"L":{"at":[0,-0.004,0],"curl":[[-0.24,0],[0,0],[0,0],[0.12,0],[0.24,0]]}},
  sa12: {"R":{"at":[0,0,0],"curl":[[0.24,0],[-0.24,0],[0.24,0.12],[0.12,-0.12],[0,0]]},"L":{"at":[-0.006,-0.003,0]}},
  aa12: {"R":{"at":[0.0065,-0.01,-0.01]},"L":{"at":[0,-0.0155,-0.062],"freeAt":[-0.018,0,0]}},
  p92: {"R":{"at":[0.007,0.003,0.0135]},"L":{"at":[-0.012,-0.015,0.0135]}},
  g18: {"R":{"at":[0.015,-0.005,0.008],"curl":[[0.12,0],[0,0.12],[-0.24,0.24],[-0.12,0.12],[0.24,0.24]]},"L":{"at":[-0.0065,-0.0055,0.0025]}},
  m1911: {"R":{"at":[0.003,-0.002,0]},"L":{"at":[-0.005,-0.008,0.0015]}},
  de7: {"R":{"at":[0.007,-0.003,0]},"L":{"at":[-0.011,-0.002,0],"curl":[[0.24,-0.24],[0,0],[0,0],[0.24,0],[0.24,0]]}},
  r45: {"R":{"at":[0.012,-0.0015,-0.003]},"L":{"at":[0.0075,0.006,0.0015]}}
};
// Procedural fallback weapons have their own fitted contacts. A correction
// measured for an imported animation pack must not displace those grips.
const fallbackProfiles = { db2: profiles.db2 };
const rigs = new WeakMap();
function sideOf(name) { return /left|_L(?:_|$)|^L_|L(?:_\d+)?$/i.test(name) ? 'L' : 'R'; }
function remember(rig, bone) {
  if (!rig.saved.has(bone)) rig.saved.set(bone, { p: bone.position.clone(), q: bone.quaternion.clone(), s: bone.scale.clone(), auto: bone.matrixAutoUpdate, matrix: bone.matrix.clone() });
}
function turnBone(bone, from, to) {
  // FBX rigs may contain nonuniform scale. Cancel the complete parent matrix
  // before solving a rotation; world-quaternion products lose that transform.
  bone.parent.updateWorldMatrix(true, false);
  const inv = bone.parent.matrixWorld.clone().invert();
  const q = new Q().setFromUnitVectors(from.transformDirection(inv), to.transformDirection(inv));
  bone.quaternion.premultiply(q).normalize(); bone.updateWorldMatrix(false, true);
}
function chain(root) {
  const out = [root]; let b = root;
  while (out.length < 5) { b = b.children.find(c => c.isBone); if (!b) break; out.push(b); }
  return out;
}
function magazine(model, bone, meshes) {
  if (!bone) return null;
  model.updateWorldMatrix(true, false); model.updateMatrixWorld(true);
  const box = new T.Box3(), inv = bone.matrixWorld.clone().invert(), p = new V();
  const under = b => { for (; b; b = b.parent) if (b === bone) return true; return false; };
  const list = meshes || []; if (!meshes) model.traverse(o => { if (o.isMesh) list.push(o); });
  for (const mesh of list) {
    const g = mesh.geometry, ix = g.attributes.skinIndex, w = g.attributes.skinWeight;
    for (let i = 0; i < g.attributes.position.count; i++) {
      let weight = under(mesh) ? 1 : 0;
      if (mesh.isSkinnedMesh && ix && w) for (let j = 0; j < 4; j++) if (under(mesh.skeleton.bones[ix.getComponent(i, j)])) weight += w.getComponent(i, j);
      if (weight > .7) box.expandByPoint(mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv));
    }
  }
  return box.isEmpty() ? null : { bone, box, delta: new V() };
}
function bind(model, frame) {
  let rig = rigs.get(model); if (rig) return rig;
  model.updateWorldMatrix(true, true);
  const bones = [], unique = new Set();
  model.traverse(o => { if (o.isSkinnedMesh) for (const b of o.skeleton.bones) if (!unique.has(b)) { unique.add(b); bones.push(b); } });
  const size = new Map(), count = b => { if (size.has(b)) return size.get(b); let n = 0; for (const c of b.children) if (unique.has(c)) n += 1 + count(c); size.set(b, n); return n; };
  const named = bones.filter(b => /^(?:LeftHand|RightHand|Hand_[LR]|[LR]_wrist|DEF-hand[LR])(?:_\d+)?$/i.test(b.name));
  const candidates = named.length ? named : bones.filter(b => /hand|wrist/i.test(b.name) && b.children.filter(c => unique.has(c) && count(c) >= 2).length >= 4);
  const below = (a, b) => { for (let p = b.parent; p; p = p.parent) if (p === a) return true; return false; };
  const roots = candidates.filter(b => !candidates.some(c => c !== b && below(b, c)));
  const inv = frame.clone().invert();
  rig = { saved: new Map(), hands: [], magazines: ['Mag1_j', 'Mag2_j'].map(n => magazine(model, model.getObjectByName(n))).filter(Boolean) };
  for (const hand of roots) {
    const side = sideOf(hand.name), word = side === 'L' ? 'Left' : 'Right';
    const upper = bones.find(b => new RegExp('^(?:' + word + 'Arm|UpArm_' + side + '|' + side + '_arm|DEF-upper_arm' + side + ')(?:_\\d+)?$', 'i').test(b.name));
    const fore = bones.find(b => new RegExp('^(?:' + word + 'ForeArm|Forearm_' + side + '|' + side + '_elbow|DEF-forearm' + side + ')(?:_\\d+)?$', 'i').test(b.name));
    const deform = []; hand.traverse(b => { if (b.isBone && /^(?:DEF-(?:thumb01|f_(?:index|middle|ring|pinky)01)[LR]|[LR]_(?:thumb|index|ind|indx|point|middle|ring|pink|pinky)1)(?:_\d+)?$/i.test(b.name)) deform.push(b); });
    const fingers = (deform.length ? deform : hand.children.filter(b => b.isBone && count(b) >= 2)).map(chain);
    for (let i = 0; i < fingers.length; i++) {
      const finger = fingers[i], name = finger[0].name;
      const generic = /^Bone_[LR]\d/i.test(name);
      const digit = /thumb/i.test(name) ? 0 : /index|point|ind/i.test(name) ? 1 : /middle/i.test(name) ? 2 : /ring/i.test(name) ? 3 : /pink/i.test(name) ? 4 : generic ? 4 - i : i;
      finger.digit = digit;
      // Generic packs include a metacarpal before the knuckle. Rotating that
      // palm bone to curl a finger splays the whole digit sideways.
      const first = generic && finger.length === 5 ? 1 : 0;
      finger.joints = [first, first + 1];
      if (finger.length < first + 3) continue;
      const [a, b, c] = finger.slice(first), A = a.getWorldPosition(new V()), B = b.getWorldPosition(new V()), C = c.getWorldPosition(new V());
      finger.axes = [a, b].map(bone => {
        const inv = bone.matrixWorld.clone().invert(), u = A.clone().applyMatrix4(inv), v = B.clone().applyMatrix4(inv), w = C.clone().applyMatrix4(inv);
        const axis = new V().crossVectors(v.clone().sub(u), w.sub(v));
        return axis.lengthSq() < 1e-12 ? null : axis.normalize();
      });
    }
    // The copied fallback arms can first appear with a nearly straight trigger
    // finger, or during a barrel-opening pose. Use the same rig's authored
    // Idle bend axes so first-use timing cannot flip an anatomical axis.
    if (model === G.RealArms?.copy) {
      const reference = rigs.get(G.M4Viewmodel?.model)?.hands.find(h => h.side === side);
      if (reference) for (const f of fingers) {
        const ref = reference.fingers.find(x => x.digit === f.digit);
        if (ref) f.axes = ref.axes.map(axis => axis?.clone());
      }
    }
    for (const finger of fingers) finger.restQ = finger.map(b => b.quaternion.clone());
    rig.hands.push({ hand, side, upper, fore, fingers, rest: hand.getWorldPosition(new V()).applyMatrix4(inv), restMatrix: inv.clone().multiply(hand.matrixWorld) });
  }
  rigs.set(model, rig); return rig;
}
// A small hand correction also needs an elbow solve. Moving only the wrist
// leaves a seam between the glove and cuff, especially on independent IK rigs.
function moveHand(rig, h, target, sourceMatrix, wantedMatrix, weight) {
  const H = h.hand, U = h.upper, F = h.fore;
  remember(rig, H);
  if (U && F) {
    remember(rig, U); remember(rig, F);
    const S = U.getWorldPosition(new V()), E0 = F.getWorldPosition(new V()), W0 = H.getWorldPosition(new V());
    const tip = F.worldToLocal(W0.clone()), a = S.distanceTo(E0), b = E0.distanceTo(W0), dv = target.clone().sub(S), length = dv.length(), u = dv.normalize();
    const d = T.MathUtils.clamp(length, Math.abs(a - b) + 1e-5, (a + b) * .9999);
    if (Math.abs(length - d) > 1e-6) {
      const shift = u.clone().multiplyScalar(length - d); S.add(shift); E0.add(shift);
      U.position.copy(U.parent.worldToLocal(S.clone())); U.updateWorldMatrix(false, true);
    }
    const x = (a * a - b * b + d * d) / (2 * d), y = Math.sqrt(Math.max(0, a * a - x * x));
    const pole = E0.clone().sub(S).addScaledVector(u, -E0.clone().sub(S).dot(u));
    if (pole.lengthSq() < 1e-10) pole.set(h.side === 'L' ? -1 : 1, -1, 0).addScaledVector(u, -pole.dot(u));
    const E = S.clone().addScaledVector(u, x).addScaledVector(pole.normalize(), y), W = S.clone().addScaledVector(u, d);
    turnBone(U, E0.sub(S), E.clone().sub(S));
    const elbow = F.getWorldPosition(new V()), currentTip = F.localToWorld(tip);
    turnBone(F, currentTip.sub(elbow), W.sub(elbow));
  }
  H.parent.updateWorldMatrix(true, false);
  const inv = H.parent.matrixWorld.clone().invert(), q = new Q(), scale = new V(), pos = new V();
  inv.clone().multiply(sourceMatrix).decompose(pos, q, scale);
  const wantedQ = new Q(), wantedScale = new V();
  inv.clone().multiply(wantedMatrix).decompose(pos, wantedQ, wantedScale);
  H.position.copy(target).applyMatrix4(inv);
  H.quaternion.copy(q.normalize()).slerp(wantedQ.normalize(), weight).normalize();
  H.scale.copy(scale).lerp(wantedScale, weight);
  // A rotated wrist below nonuniform FBX scale needs the complete affine
  // matrix. Decomposing to TRS alone introduces shear error: the glove changes
  // shape and clips the gun when the animation changes its parent orientation.
  // The next source animation restores normal matrix updates before sampling.
  if (weight < 1e-5 || weight > 1 - 1e-5) {
    H.matrix.copy(inv).multiply(weight < 1e-5 ? sourceMatrix : wantedMatrix).setPosition(H.position);
    H.matrixAutoUpdate = false;
  }
  H.updateWorldMatrix(false, true);
}
function openFinger(rig, bones, amount, joint = 1) {
  if (!amount || bones.length < 3) return;
  const bone = bones[bones.joints[joint]], axis = bones.axes?.[joint]; if (!axis) return;
  remember(rig, bone);
  bone.quaternion.multiply(new Q().setFromAxisAngle(axis, -amount)).normalize(); bone.updateWorldMatrix(false, true);
}
G.HandContact = {
  profiles, fallbackProfiles,
  magazine,
  swappedMagazine(original, groups) {
    if (!original) return null;
    const box = new T.Box3(), inv = original.bone.matrixWorld.clone().invert(), p = new V();
    for (const holder of groups) if (holder.parent === original.bone) holder.traverse(mesh => {
      if (!mesh.isMesh) return; mesh.updateWorldMatrix(true, false);
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) box.expandByPoint(mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv));
    });
    return box.isEmpty() ? original : { ...original, targetBox: box, delta: box.getCenter(new V()).sub(original.box.getCenter(new V())) };
  },
  // Each source pose starts from its own animation. Never feed last frame's
  // fitted position or finger rotation back into a partially keyed clip.
  restore(model) {
    const rig = model && rigs.get(model); if (!rig) return;
    for (const [b, s] of rig.saved) { b.position.copy(s.p); b.quaternion.copy(s.q); b.scale.copy(s.s); b.matrixAutoUpdate = s.auto; b.matrix.copy(s.matrix); b.matrixWorldNeedsUpdate = true; }
    rig.saved.clear();
  },
  frame(bone, rest, q) {
    bone.updateWorldMatrix(true, false);
    const m = bone.matrixWorld.clone().multiply(rest.clone().invert());
    if (q) m.multiply(new T.Matrix4().makeRotationFromQuaternion(q));
    return m;
  },
  bind,
  apply(id, model, frame, weights, context) {
    const profile = model === G.RealArms?.copy ? fallbackProfiles[id] : profiles[id]; if (!profile) return;
    const rig = bind(model, frame), inv = frame.clone().invert();
    for (const h of rig.hands) {
      const C = profile[h.side]; if (!C) continue;
      const W = h.hand.getWorldPosition(new V()), local = W.clone().applyMatrix4(inv);
      // Free hands retain the authored bolt/magazine/slide paths. Blend near
      // the holding pose so reload start/end and pump strokes cannot snap.
      const distance = local.distanceTo(h.rest);
      let weight = weights?.[h.side] ?? 1;
      const reload = context?.reload, smooth = x => { x = T.MathUtils.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
      const moving = !!(weights || (h.side === 'L' ? context?.movingLeft || reload && id !== 'kr98' : context?.movingRight));
      if (!weights) {
        weight = 1;
        if (h.side === 'L' && reload && reload.type !== 'mag' && id !== 'kr98') {
          weight = reload.phase === 'start' ? 1 - smooth((reload.pp || 0) / .25)
            : reload.phase === 'end' ? smooth(((reload.pp || 0) - .65) / .35) : 0;
        }
      }
      let magWeight = 0, magDelta = new V();
      if (h.side === 'L' && reload?.type === 'mag') {
        const p = reload.p || 0, release = smooth(p / .12) * (1 - smooth((p - .86) / .14));
        const nearGrip = 1 - smooth((distance - .035) / .06);
        weight = 1 - release + release * nearGrip;
        // Swap magazines can sit far from the original animation's magazine.
        // Follow that part's own frame while the hand grips it, rather than
        // pushing a loading hand toward the weapon's front furniture.
        const magazines = context.magazine ? [context.magazine] : rig.magazines;
        const bases = h.fingers.map(f => f[0].getWorldPosition(new V()));
        const palm = bases.reduce((v, p) => v.add(p), new V()).multiplyScalar(.65 / Math.max(1, bases.length)).addScaledVector(W, .35);
        const probes = [palm, ...h.fingers.map(f => f[f.length - 1].getWorldPosition(new V()))];
        for (const mag of magazines) {
          mag.bone.updateWorldMatrix(true, false);
          const local = mag.bone.worldToLocal(palm.clone()), scale = mag.bone.getWorldScale(new V()).length() / Math.sqrt(3);
          if (scale < 1e-5 || !Number.isFinite(scale)) continue;
          const gap = Math.min(...probes.map(p => mag.box.distanceToPoint(mag.bone.worldToLocal(p.clone())))) * scale;
          const contact = (1 - smooth((gap - .015) / .05)) * release * smooth((distance - .02) / .045);
          if (contact <= magWeight) continue;
          const center = mag.bone.localToWorld(mag.box.getCenter(new V()));
          magDelta.copy(mag.delta);
          if (mag.targetBox) {
            // Match the contacted surface of a different-sized magazine.
            // A drum needs a side grip, rather than a fist through its centre.
            for (const axis of ['x', 'y', 'z']) {
              const nearest = T.MathUtils.clamp(local[axis], mag.box.min[axis], mag.box.max[axis]);
              const u = (nearest - mag.box.min[axis]) / Math.max(1e-6, mag.box.max[axis] - mag.box.min[axis]);
              magDelta[axis] = T.MathUtils.lerp(mag.targetBox.min[axis], mag.targetBox.max[axis], u) - nearest;
            }
          }
          magDelta.applyMatrix4(mag.bone.matrixWorld).sub(mag.bone.getWorldPosition(new V()));
          magDelta.addScaledVector(palm.clone().sub(center).normalize(), .0045);
          magWeight = contact;
        }
        weight *= 1 - magWeight;
      }
      const freeWeight = h.side === 'L' && reload ? 1 - weight * weight : 0;
      if (weight < 1e-5 && magWeight < 1e-5 && !(C.freeAt && freeWeight)) continue;
      const sourceMatrix = h.hand.matrixWorld.clone(), restMatrix = h.restMatrix.clone();
      let offsetFrame = frame, offset = new V(...C.at);
      if (moving) {
        // Procedural hands already follow moving barrels and levers. Keep
        // their authored finger pose and rotate the small fit with the hand.
        const inverseRest = h.restMatrix.clone().invert();
        offset.applyMatrix4(inverseRest).sub(new V().setFromMatrixPosition(inverseRest)); offsetFrame = sourceMatrix;
      }
      const delta = offset.applyMatrix4(offsetFrame).sub(new V().setFromMatrixPosition(offsetFrame)).multiplyScalar(weight);
      const target = W.clone();
      if (C.freeAt && freeWeight) {
        const extra = new V(...C.freeAt).transformDirection(frame).multiplyScalar(new V(...C.freeAt).length() * freeWeight);
        delta.add(extra);
      }
      if (!moving) {
        // A held grip stays on the furniture through idle breathing and fire
        // clips. Only the free hand follows the authored manipulation path.
        target.lerp(h.rest.clone().applyMatrix4(frame), weight);
      }
      if (C.turn) {
        restMatrix.premultiply(new T.Matrix4().makeRotationFromEuler(new T.Euler(...C.turn.map(v => v * Math.PI / 180), 'YXZ')));
        restMatrix.setPosition(h.rest);
      }
      moveHand(rig, h, target.add(delta).addScaledVector(magDelta, magWeight), sourceMatrix,
        moving ? sourceMatrix : frame.clone().multiply(restMatrix), moving ? 0 : weight);
      for (let i = 0; i < h.fingers.length; i++) {
        const digit = h.fingers[i].digit, index = digit === 1;
        if (!weights && !moving) for (let j = 0; j < h.fingers[i].length; j++) {
          const bone = h.fingers[i][j]; remember(rig, bone);
          bone.quaternion.slerp(h.fingers[i].restQ[j], weight).normalize(); bone.updateWorldMatrix(false, true);
        }
        if (C.curl?.[digit]) {
          openFinger(rig, h.fingers[i], C.curl[digit][0] * weight, 0);
          openFinger(rig, h.fingers[i], C.curl[digit][1] * weight, 1);
        }
        if (!weights && h.side === 'R' && index) {
          const held = G.WEAPONS[id]?.auto && G.Input?.lmb && !reload;
          openFinger(rig, h.fingers[i], -.05 * (held ? 1 : T.MathUtils.clamp(G.VM.slideT || 0, 0, 1)) * weight, 1);
        }
        if (magWeight > 0) {
          openFinger(rig, h.fingers[i], .06 * magWeight, 0);
          openFinger(rig, h.fingers[i], .12 * magWeight, 1);
        }
      }
    }
  }
};
})();
