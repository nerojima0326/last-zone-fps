// vehicles.js — 탈 수 있는 차량: F 탑승/하차, WASD 운전, Space 드리프트, Shift 가속, V 시점 전환
//  실사 차량 3종의 접지·공중 관성·차체 충돌을 플레이어와 봇이 함께 사용한다.
(function () {
'use strict';
const THREE = window.THREE, G = window.G, U = G.U;
const V3 = THREE.Vector3;
const _f = new V3(), _r = new V3(), _c = new V3(), _e = new V3(), _d = new V3();
const _support = new V3();
const _wheelRay=new THREE.Ray(),_wheelBox=new THREE.Box3(),_vehicleInv=new THREE.Matrix4(),_contact=new V3(),_axis=new V3();
const _contactPose=new THREE.Quaternion();
const HALF_L = 1.9, HALF_W = 0.95, REV = 6;
const HP = 1600;
// v108 속도(m/s)·가속·조향·질량(t)·내구도·계기 눈금을 차종별로 공유한다.
const TUNING = {
  porter: { max:18.5, boost:23, accel:5.2, steer:.48, response:5.4, yawResponse:9, mass:2.6, hp:2400, dial:100 },
  e2200: { max:22, boost:29, accel:7.1, steer:.52, response:6.3, yawResponse:11, mass:1.9, hp:1900, dial:120 },
  izh: { max:26, boost:34, accel:9, steer:.61, response:8, yawResponse:15, mass:1.3, hp:1400, dial:140 },
  fallback: { max:21, boost:28, accel:9.5, steer:.55, response:7, yawResponse:12, mass:1.7, hp:1600, dial:120 }
};
const RESPAWN = 25;             // 폭발한 차는 잔해로 이 시간(초)만큼 남았다가, 처음 놓였던 자리에 새 차로 다시 나온다
// v53 실사 차량 (Sketchfab CC-BY-4.0, tools/vehicles/build-real.cjs): 현대 포터 II 탑차 · 마쓰다 E2200 트럭 · IZH-2715 픽업
const NAMES = { porter: '포터 II 탑차', e2200: 'E2200 트럭', izh: 'IZH-2715 픽업' };
const KINDS = Object.keys(NAMES);
const S = 1;                    // GLB 단위 = 미터
const PAINT = {
  porter: [0xd8d8d2],
  e2200: [0xdedcd4, 0x4a5d6e, 0x5d6b3e, 0x8a2a22, 0x9a9890],   // 'Paint' 재질(차체 일부) 색
  izh: [0xcfcfc6]
};
// 모델이 없을 때(예전 지프 상자) · 직접 만든 차량 객체의 기본 치수
const JEEP = { hl: HALF_L, hw: HALF_W, top: 1.7, r: 0.42, wheelPts: [[-0.95, -1.25], [0.95, -1.25], [-0.95, 1.25], [0.95, 1.25]] };
const dimOf = v => v.dim || (v.dim = JEEP);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _X = new V3(1, 0, 0), _Y = new V3(0, 1, 0), _vel = new V3(), _o = new V3(), _m4 = new THREE.Matrix4();
const _wallNormal=new V3(),_move={x:0,z:0,hit:false,impact:0};

function build() {
  const col = (g, c) => { g = g.toNonIndexed(); const k = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const bx = (w, h, d, x, y, z, c) => col(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
  const body = 0x4d5a3a, dark = 0x23261f;
  const parts = [
    bx(1.85,.20,3.8,0,.30,0,body), bx(1.7, 0.28, 1.25, 0, 1.12, -1.2, body),                   // 바닥·보닛
    bx(1.78,.08,1.9,0,1.73,.45,body), bx(.065,.34,1.9,-.86,.98,.45,body),bx(.065,.34,1.9,.86,.98,.45,body),bx(1.78,.34,.07,0,.98,1.36,body), // 지붕·문 아래쪽
    ...[-.86,.86].flatMap(x=>[-.46,1.36].map(z=>bx(.07,.63,.07,x,1.40,z,body))),
    bx(1.95, 0.16, 0.2, 0, 0.6, -1.95, dark), bx(1.95, 0.16, 0.2, 0, 0.6, 1.95, dark),             // 범퍼
    bx(0.3, 0.18, 0.06, -0.62, 0.95, -1.91, 0xfff6d0), bx(0.3, 0.18, 0.06, 0.62, 0.95, -1.91, 0xfff6d0),
    bx(0.3, 0.14, 0.06, -0.62, 0.9, 1.91, 0xb01c14), bx(0.3, 0.14, 0.06, 0.62, 0.9, 1.91, 0xb01c14),
    bx(0.5, 0.5, 0.2, 0, 1.2, 2.0, dark)                                                           // 예비 타이어
  ];
  return THREE.mergeGeometries(parts);
}

const Vh = G.Vehicles = {
  list: [], geo: null, mat: null, models: {}, kinds: KINDS,
  tuning: TUNING,
  spec(v) { return TUNING[v.cabinKind || v.kind] || TUNING.fallback; },
  nameOf(kind) { return NAMES[kind] || '차량'; },
  // Kenney Car Kit 모델 (없으면 예전 지프 상자 모델)
  async load() {
    if (location.protocol === 'file:' || !THREE.GLTFLoader) return;
    const gl = new THREE.GLTFLoader();
    if (THREE.MeshoptDecoder) gl.setMeshoptDecoder(THREE.MeshoptDecoder);
    const v = window.LZ_BUILD || '';
    await Promise.all(KINDS.map(k => gl.loadAsync('assets/models/vehicles/' + k + '.glb' + (v ? '?v=' + v : '')).then(g => {
      const root = g.scene;
      root.updateMatrixWorld(true);
      const wheels = [];
      root.traverse(o => { if (/^wheel_(front|back)(Left|Right)$/.test(o.name)) wheels.push(o.name); });
      // 바퀴 바닥 = 땅, 앞뒤 바퀴 가운데 = 원점 (앞은 -Z)
      const box = new THREE.Box3().setFromObject(root), wz = [], wx = [], wheelDefs=[];
      let r = 0;
      for (const n of wheels) {
        const w = root.getObjectByName(n), wb = new THREE.Box3().setFromObject(w), c = wb.getCenter(new V3());
        wz.push(c.z); wx.push(Math.abs(c.x)); r = Math.max(r, (wb.max.y - wb.min.y) / 2);
        wheelDefs.push({r:(wb.max.y-wb.min.y)*S/2,width:(wb.max.x-wb.min.x)*S});
      }
      const cz = (Math.min(...wz) + Math.max(...wz)) / 2;
      // 차체 상자 (거울 같은 튀어나온 것까지 포함하지 않게 차체 노드로)
      const body = root.getObjectByName('body'), bb = new THREE.Box3().setFromObject(body || root);
      this.models[k] = {
        root, wheels, wheelDefs, r: r * S, y0: -box.min.y * S, cz: -cz * S,
        hl: (bb.max.z - bb.min.z) / 2 * S, hw: Math.min(bb.max.x - bb.min.x, 2 * Math.max(...wx) + r) / 2 * S, top: (box.max.y - box.min.y) * S,
        wheelPts: wheels.map(n => { const w = root.getObjectByName(n), c = new THREE.Box3().setFromObject(w).getCenter(new V3()); return [c.x * S, (c.z - cz) * S]; })
      };
      root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.realize(root, box);
    }).catch(e => console.info('[vehicle] ' + k + ' 모델 없음', e.message))));
  },
  // v52 실사 재질: 장난감 같은 원색 대신 짙은 색유리 · 무광 플라스틱 · 크롬 · 클리어코트 도장,
  //  차체 아래쪽일수록 흙먼지 (정점 속성 dirt 를 모델 높이로 굽는다)
  mats: null,
  realize(root, box) {
    if (!this.mats) {
      const dirty = m => {
        m.onBeforeCompile = sh => {
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float dirt;\nvarying float vDirt;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDirt = dirt;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDirt;')
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.26, 0.20), vDirt);')
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, vDirt);');
        };
        m.customProgramCacheKey = () => 'dirt';
        return m;
      };
      this.mats = {
        dirty,
        window: new THREE.MeshPhysicalMaterial({ name: 'window', color: 0x0d1215, roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5 }),
        plastic: dirty(new THREE.MeshStandardMaterial({ name: 'plastic', color: 0x1c1e1e, roughness: 0.78, metalness: 0.05 })),
        _defaultMat: dirty(new THREE.MeshStandardMaterial({ name: '_defaultMat', color: 0x8f918f, roughness: 0.32, metalness: 0.85 })),
        carTire: dirty(new THREE.MeshStandardMaterial({ name: 'carTire', color: 0x131313, roughness: 0.95, metalness: 0 }))
      };
    }
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), _p = new V3(), lo = box.min.y, hi = box.max.y;
    root.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry, pos = g.attributes.position, d = new Float32Array(pos.count);
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        const y = (_p.fromBufferAttribute(pos, i).applyMatrix4(m).y - lo) / (hi - lo);
        d[i] = 0.62 * (1 - THREE.MathUtils.smoothstep(y, 0.12, 0.55));
      }
      g.setAttribute('dirt', new THREE.BufferAttribute(d, 1));
      // Kenney 재질은 이름으로 바꾸고, 실사 차량 재질은 흙먼지만 입힌다 (금속도 1 로 바뀐 재질은 낮춘다)
      const swap = mm => {
        if (this.mats[mm.name]) return this.mats[mm.name];
        if (/^paint/i.test(mm.name) || !mm.isMeshStandardMaterial) return mm;
        const cache = this.mats.real || (this.mats.real = new Map());
        if (!cache.has(mm)) {
          const c = mm.clone();
          if (!c.metalnessMap && c.metalness > 0.5 && !/metal|chrome|mirror/i.test(c.name)) c.metalness = 0.15;
          if (c.transparent) { c.roughness = Math.min(c.roughness, 0.1); c.envMapIntensity = 1.4; }
          else this.mats.dirty(c);
          cache.set(mm, c);
        }
        return cache.get(mm);
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
  },
  burnt: null,
  // 차량 한 대의 메시: 모델이 있으면 복제(차체 색만 바꿔), 없으면 상자 지프
  makeMesh(v) {
    const kind = KINDS.find(k => this.models[k] && k === v.kind) || KINDS.find(k => this.models[k]);
    if (!kind) {
      if (!this.geo) { this.geo = build(); this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }); }
      const m=new THREE.Group(),body=new THREE.Mesh(this.geo,this.mat);body.name='body';body.castShadow=true;m.add(body);m.rotation.order='YXZ';
      if(!this.tireGeo){this.tireGeo=new THREE.CylinderGeometry(.42,.42,.3,20).rotateZ(Math.PI/2);this.tireMat=new THREE.MeshStandardMaterial({color:0x151515,roughness:.95});this.rimGeo=new THREE.CylinderGeometry(.21,.21,.315,6).rotateZ(Math.PI/2);this.rimMat=new THREE.MeshStandardMaterial({color:0x85857d,metalness:.7,roughness:.5})}
      v.wheels=JEEP.wheelPts.map(([x,z],i)=>{const w=new THREE.Group();w.name='wheel_'+(z<0?'front':'back')+(x<0?'Left':'Right');w.position.set(x,.42,z);const tire=new THREE.Mesh(this.tireGeo,this.tireMat),rim=new THREE.Mesh(this.rimGeo,this.rimMat);tire.castShadow=rim.castShadow=true;w.add(tire,rim);m.add(w);return{o:w,front:z<0,r:.42,width:.3}});
      v.dim = JEEP;
      v.cabinKind='fallback';
      v.ownedMaterials=[];
      return m;
    }
    const M = this.models[kind], g = new THREE.Group(), inner = M.root.clone(true);
    v.kind = kind;
    inner.scale.setScalar(S); inner.position.set(0, M.y0, M.cz);
    const color = new THREE.Color(U.pick(PAINT[kind] || [0xcccccc]));
    const paint = new Map();
    inner.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map(m => {
        if (!/^paint/i.test(m.name)) return m;
        if (!paint.has(m)) {
          // 클리어코트 도장 (탁하게 바랜 색)
          const c = this.mats.dirty(new THREE.MeshPhysicalMaterial({ name: m.name, color: color.clone().lerp(new THREE.Color(0x6b6558), 0.18), roughness: 0.42, metalness: 0.2, clearcoat: 0.55, clearcoatRoughness: 0.35 }));
          paint.set(m, c);
        }
        return paint.get(m);
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    g.add(inner); g.rotation.order = 'YXZ';
    v.wheels = M.wheels.map((n,i) => { const w = inner.getObjectByName(n); return { o: w, front: /front/.test(n), ...M.wheelDefs[i] }; });
    v.ownedMaterials=Array.from(paint.values());
    v.spin = 0;
    v.dim = { hl: M.hl, hw: M.hw, top: M.top, r: M.r, wheelPts: M.wheelPts };
    return g;
  },
  newVehicle(x, y, z, yaw, extra) {
    if (!this.geo) { this.geo = build(); this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }); }
    const v = Object.assign({ kind: U.pick(KINDS), pos: new V3(x, y, z), yaw, speed: 0, lat: 0, steer: 0, pitch: 0, roll: 0, driver: null, box: null, hitT: new Map(), noiseT: 0, hp: HP, maxHp: HP, fuel: 1, engineHeat: .35, displayRpm: 0, dead: false, burnT: 0, smokeT: 0, lastHit: null, skid: [null, null] }, extra || {});
    if (!v.home) v.home = { x, z, yaw };
    v.home.kind = v.kind;
    v.mesh = this.makeMesh(v);
    v.maxHp=this.spec(v).hp;if(extra?.hp===undefined)v.hp=v.maxHp;
    G.VehicleCabin.glazing(v);
    G.VehicleWheels.setup(v);
    G.scene.add(v.mesh);
    this.list.push(v); this.place(v, 1); G.VehicleWheels.sync(v);this.block(v);G.RT?.invalidate();
    return v;
  },
  reset() {
    for (const v of this.list) { G.scene.remove(v.mesh); this.unblock(v);G.VehicleWheels.dispose(v); }
    this.list = [];
    G.RT?.invalidate();
    if (this.skids) { this.skids.count = 0; this.skidN = 0; }
    G.VehicleSkids?.reset();
    if (G.Audio.ctx) G.Audio.setLoop('skid', 0);
    if (G.Audio.ctx) { G.Audio.setLoop('engine', 0); G.Audio.setLoop('engineBot', 0); }
  },
  spawn(n) {
    const W = G.World;
    let tries = 0;
    while (this.list.length < n && tries++ < n * 30) {
      // 도로 옆에 세워 둔다
      const rd = U.pick(W.roads), t = Math.random(), dx = rd.bx - rd.ax, dz = rd.bz - rd.az, L = Math.hypot(dx, dz) || 1;
      if (rd.course) continue;   // v66 훈련 기지 섬의 운전 코스에는 배틀로얄 차량을 두지 않는다
      const side = (Math.random() < 0.5 ? -1 : 1) * (rd.w * 0.5 + 2.2);
      const x = rd.ax + dx * t - dz / L * side, z = rd.az + dz * t + dx / L * side;
      if (Math.abs(x) > W.HALF - 30 || Math.abs(z) > W.HALF - 30) continue;
      const y = W.heightAt(x, z);
      if (y - W.waterAt(x, z) < 0.6) continue;
      if (Math.abs(W.heightAt(x + 2, z) - y) > 0.7 || Math.abs(W.heightAt(x, z + 2) - y) > 0.7) continue;
      let blocked = false;
      W.queryBoxes(x - 2.6, z - 2.6, x + 2.6, z + 2.6, b => { if (b.maxY > y + 0.3 && b.minY < y + 2) blocked = true; });
      if (blocked || this.list.some(v => Math.hypot(v.pos.x - x, v.pos.z - z) < 40)) continue;
      this.newVehicle(x, y, z, Math.atan2(-dx, -dz) + (Math.random() < 0.5 ? Math.PI : 0));
    }
  },
  // 정해진 자리에 한 대 (훈련장 운전 코스)
  spawnAt(x, z, yaw, kind) {
    return this.newVehicle(x, G.World.heightAt(x, z), z, yaw, { home: { x, z, yaw }, kind: kind || 'izh' });
  },
  // 세워 둔 차는 충돌 상자를 둔다 (걸어서 통과·총알 관통 방지). 회전을 감안해 조금 줄인 축 정렬 상자
  block(v) {
    const c = Math.abs(Math.cos(v.yaw)), s = Math.abs(Math.sin(v.yaw)), D = dimOf(v);
    const hx = D.hw * c + D.hl * s - 0.25 * Math.min(c, s) * 2, hz = D.hw * s + D.hl * c - 0.25 * Math.min(c, s) * 2;
    v.box = G.World.addCollider(v.pos.x - hx, v.pos.y, v.pos.z - hz, v.pos.x + hx, v.pos.y + D.top, v.pos.z + hz, 'metal', true);
    v.box.vehicle = v;
  },
  unblock(v) { G.World.removeCollider(v.box); v.box = null; },
  groundAt(x,z,feetY){
    const W=G.World;let y=Math.max(W.heightAt(x,z),W.waterAt(x,z)-.9);
    // 상판 위에서는 다리를 받침으로 삼고, 아래로 통과 중인 차를 상판 위로 올리지 않는다.
    for(const b of W.bridges||[]){if(feetY+.65<b.y)continue;const dx=x-b.x,dz=z-b.z;if(Math.abs(dx*b.ux+dz*b.uz)<=b.half+.1&&Math.abs(dx*b.uz-dz*b.ux)<=b.w*.5-.15)y=Math.max(y,b.y)}return y;
  },
  place(v, k, dt) {
    const W = G.World;
    _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    const ground = (x, z) => this.groundAt(x,z,v.pos.y);
    const h = (ox, oz) => ground(v.pos.x + _f.x * oz + _r.x * ox, v.pos.z + _f.z * oz + _r.z * ox);
    const D = dimOf(v);
    const settling=dt&&v.grounded!==false&&v.settleT>0;if(settling)_contactPose.copy(v.mesh.quaternion);
    // 차체 끝보다 실제 바퀴가 먼저 절벽을 벗어나지는 않는다. 네 바퀴 위치에서 지면을 읽는다.
    let hf=0,hb=0,hl=0,hr=0,zf=0,zb=0,xl=0,xr=0,nf=0,nb=0,nl=0,nr=0;
    for(const [x,z] of D.wheelPts){const y=h(x,-z);if(z<0){hf+=y;zf+=z;nf++}else{hb+=y;zb+=z;nb++}if(x<0){hl+=y;xl+=x;nl++}else{hr+=y;xr+=x;nr++}}
    hf/=nf;hb/=nb;hl/=nl;hr/=nr;
    const drops=G.VehicleWheels.drops(v),pitch = Math.atan2(hf-hb-drops.front+drops.rear,zb/nb-zf/nf),roll = Math.atan2((hr-hl-drops.right+drops.left)*Math.cos(pitch),xr/nr-xl/nl);
    const oldPitch=v.pitch,oldRoll=v.roll;
    if(dt&&v.grounded===false){v.pitch=U.clamp(v.pitch+(v.pitchRate||0)*dt,-.7,.7);v.roll=U.clamp(v.roll+(v.rollRate||0)*dt,-.55,.55);v.pitchRate*=Math.exp(-2*dt);v.rollRate*=Math.exp(-2*dt)}
    else{
      const nextPitch=U.lerp(v.pitch,dt?U.clamp(pitch,-.7,.7):pitch,k),nextRoll=U.lerp(v.roll,dt?U.clamp(roll,-.55,.55):roll,k);
      v.pitch=dt?oldPitch+U.clamp(nextPitch-oldPitch,-.6*dt,.6*dt):nextPitch;v.roll=dt?oldRoll+U.clamp(nextRoll-oldRoll,-.45*dt,.45*dt):nextRoll;
      if(dt){v.pitchRate=(v.pitch-oldPitch)/dt;v.rollRate=(v.roll-oldRoll)/dt}
    }
    v.mesh.rotation.set(v.pitch + (v.tilt ? v.tilt.x : 0), v.yaw, v.roll + (v.tilt ? v.tilt.z : 0));
    // 기울어진 바퀴의 접점으로 차체를 받쳐 비탈 안으로 타이어가 들어가지 않게 한다.
    let supportY = -Infinity,previousSupport=-Infinity;
    for (let i=0;i<D.wheelPts.length;i++) {
      const [x,z]=D.wheelPts[i],w=v.wheels?.[i];
      _support.set(x,w?w.r-w.radius:0,z).applyQuaternion(v.mesh.quaternion);
      supportY = Math.max(supportY, ground(v.pos.x + _support.x, v.pos.z + _support.z) - _support.y);
      if(settling){_support.set(x,w?w.r-w.radius:0,z).applyQuaternion(_contactPose);previousSupport=Math.max(previousSupport,ground(v.pos.x+_support.x,v.pos.z+_support.z)-_support.y)}
    }
    // 착지 뒤 자세 복귀는 바퀴 접점을 중심으로 회전한다. 회전으로 낮아진 차체를 새 낙하로 세지 않는다.
    if(settling)v.pos.y+=supportY-previousSupport;
    if(dt&&!v.dead)G.VehicleSuspension.step(v,supportY,dt);
    else{v.pos.y = Math.max(supportY, U.lerp(v.pos.y, supportY, k));G.VehicleSuspension.reset(v)}
    v.mesh.position.copy(v.pos);
    v.mesh.position.y+=v.springOffset||0;
    if (v.hop) v.mesh.position.y += v.hop.y;
    v.mesh.updateMatrixWorld(true);
    v.groundContacts=v.wheels?0:D.wheelPts.length;
    if(v.wheels){
      // 파손된 코너의 높이를 낮추고 남은 작은 접점 오차는 바퀴 이동 범위 안에서 흡수한다.
      for(const w of v.wheels){
        w.o.position.y=w.rest.y;w.grounded=false;if(v.grounded===false)continue;
        w.o.updateWorldMatrix(true,false);w.o.getWorldPosition(_support);
        const floor=ground(_support.x,_support.z),axis=_axis.set(1,0,0).applyQuaternion(v.mesh.quaternion),extent=w.radius*Math.sqrt(Math.max(0,1-axis.y*axis.y))+w.width*.5*Math.abs(axis.y);
        const gap=floor-(_support.y-extent),vertical=Math.max(.5,v.mesh.matrixWorld.elements[5]),travel=U.clamp(gap/vertical,-.20,.20);
        w.o.position.y+=travel;w.groundGap=gap-travel*vertical;w.grounded=Math.abs(w.groundGap)<.055;if(w.grounded)v.groundContacts++;
      }
      v.mesh.updateMatrixWorld(true);
    }
  },
  // 충돌 법선 방향의 운동만 반사한다. 벽을 스칠 때 진행 속도까지 없애지 않는다.
  move(v,nx,nz,velocity,dt) {
    const W=G.World,D=dimOf(v),offL=Math.max(.6,D.hl-D.hw),fx=-Math.sin(v.yaw),fz=-Math.cos(v.yaw),radius=D.hw+.05;
    let bumped=false,impact=0;
    for(const off of [offL,0,-offL]){
      const cx0=nx+fx*off,cz0=nz+fz*off;let cx=cx0,cz=cz0;
      W.queryBoxes(cx-radius,cz-radius,cx+radius,cz+radius,b=>{
        if(b.vehicle===v||b.bridgeDeck&&v.pos.y>b.maxY-.95)return;
        if(b.maxY<=v.pos.y+.55||b.minY>=v.pos.y+D.top)return;
        const px=U.clamp(cx,b.minX,b.maxX),pz=U.clamp(cz,b.minZ,b.maxZ),dx=cx-px,dz=cz-pz,d2=dx*dx+dz*dz;
        if(d2>=radius*radius)return;
        let depth;
        if(d2>1e-8){const distance=Math.sqrt(d2);_wallNormal.set(dx/distance,0,dz/distance);depth=radius-distance;}
        else{
          // 상자 안에서 시작해도 가장 가까운 면으로 빠져나온다.
          const left=cx-b.minX,right=b.maxX-cx,back=cz-b.minZ,front=b.maxZ-cz,nearest=Math.min(left,right,back,front);
          if(nearest===left)_wallNormal.set(-1,0,0);else if(nearest===right)_wallNormal.set(1,0,0);else if(nearest===back)_wallNormal.set(0,0,-1);else _wallNormal.set(0,0,1);depth=radius+nearest;
        }
        cx+=_wallNormal.x*(depth+.001);cz+=_wallNormal.z*(depth+.001);
        const into=velocity.dot(_wallNormal);
        if(into<0){impact=Math.max(impact,-into);velocity.addScaledVector(_wallNormal,-into*(1+(-into>4?.025:0)));}
        bumped=true;
      });
      nx+=cx-cx0;nz+=cz-cz0;
    }
    if(bumped){velocity.multiplyScalar(Math.exp(-.15*dt));v.yawRate=(v.yawRate||0)*Math.exp(-8*dt);}
    Object.assign(_move,{x:nx,z:nz,hit:bumped,impact});return _move;
  },
  near(a) {
    let best = null, bd = 3.4;
    for (const v of this.list) {
      if (v.driver || v.dead) continue;
      const d = Math.hypot(v.pos.x - a.pos.x, v.pos.z - a.pos.z);
      if (d < bd && Math.abs(v.pos.y - a.pos.y) < 2.5) { bd = d; best = v; }
    }
    return best;
  },
  enter(P, v) {
    const a = P.a;
    this.unblock(v);
    v.driver = a; v.claim = null; P.vehicle = v;
    G.VehicleCabin.enter(P,v);
    P.reload = null; P.autoReload = null; P.heal = null; P.ads = 0; P.scopeView = 0; P.lean = 0; a.leanX = 0; if (P.abortThrow) P.abortThrow(); else P.throwSt = null; P.cycleT = -1;
    a.crouch = false; a.prone = false;
    P.orbitYaw = v.yaw; P.orbitPitch = -0.22;
    G.VM.set(null);
    G.Audio.click('close', 'ka47');
  },
  exit(P, forced) {
    const v = P.vehicle, a = P.a, W = G.World;
    if (!v) return;
    _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    // 왼쪽 → 오른쪽 → 뒤 순서로 빈 곳을 찾는다
    let done = false;
    for (const [ox, oz] of [[-1.9, 0], [1.9, 0], [0, 3], [0, -3]]) {
      const x = v.pos.x + _r.x * ox + Math.sin(v.yaw) * oz, z = v.pos.z + _r.z * ox + Math.cos(v.yaw) * oz;
      let free = true;
      W.queryBoxes(x - 0.4, z - 0.4, x + 0.4, z + 0.4, b => { if (b.maxY > v.pos.y + 0.5 && b.minY < v.pos.y + 1.8) free = false; });
      if (!free) continue;
      a.pos.set(x, Math.max(this.groundAt(x,z,v.pos.y), v.pos.y - 0.5), z); done = true; break;
    }
    if (!done && !forced) return;
    G.VehicleCabin.leave(P);
    if (!done) a.pos.set(v.pos.x, v.pos.y + 1.8, v.pos.z);
    a.vel.set(-Math.sin(v.yaw) * v.speed * 0.5, 0, -Math.cos(v.yaw) * v.speed * 0.5);
    a.yaw = P.orbitYaw; a.pitch = 0;
    v.driver = null; P.vehicle = null;
    v.handbrake=false;v.drift=false;v.boosting=false;G.VehicleSkids?.stop(v);
    if (Math.abs(v.speed) < 1.5&&v.grounded!==false) { v.speed = 0; this.block(v); }
    P.camY = a.pos.y + a.eyeH();
    P.raise = 0; P.sw = { t: 0.2, to: a.cur };
    G.Audio.setLoop('engine', 0);
  },
  // 플레이어 운전 (Player.updateGround 에서 호출)
  drive(P, dt) {
    const I = G.Input, a = P.a, v = P.vehicle, W = G.World, cam = G.camera;
    P.camMode = 'vehicle';
    if(I.hit('KeyV'))G.VehicleCabin.toggle(P);
    if(P.vehicleView!=='first'){
      P.orbitYaw -= I.mdx * 0.0026 * P.sens;
      P.orbitPitch = U.clamp(P.orbitPitch - P.lookY() * 0.0026 * P.sens, -1.1, 0.25);
    }
    const thr = (I.down('KeyW') ? 1 : 0) - (I.down('KeyS') ? 1 : 0), st = (I.down('KeyA') ? 1 : 0) - (I.down('KeyD') ? 1 : 0);
    this.step(v, a, dt, thr, st, false, I.down('Space'), I.down('ShiftLeft')||I.down('ShiftRight'));
    if (!v.driver) return;
    P.sprinting = false; P.ads = 0; P.scopeView = 0;
    // 소리: 엔진 + 주변 봇이 듣는다
    G.Audio.setLoop('engine', 0.32 + Math.abs(v.speed) / this.spec(v).max * 0.25);
    G.Audio.setLoopRate('engine', 0.7 + Math.abs(v.speed) / this.spec(v).max * 1.1);
    v.noiseT -= dt;
    if (v.noiseT <= 0) { v.noiseT = 1; G.Game.onNoise(v.pos, 45 + Math.abs(v.speed) * 2.5, a); }
    // 흙먼지
    if (Math.abs(v.speed) > 7 && Math.random() < dt * 14) G.FX.dust(_c.copy(v.pos).addScaledVector(_f, -1.7 * Math.sign(v.speed)), 1, 0, 0.3, 0, 0.5, 0.45, 0.36, 1.4);
    // 내리기
    const hpP = Math.round(v.hp / (v.maxHp||HP) * 100);
    P.prompt = '<kbd>' + G.Settings.label('KeyF') + '</kbd> 내리기 · <kbd>' + G.Settings.label('Space') + '</kbd> 드리프트 · <kbd>'+G.Settings.label('ShiftLeft')+'</kbd> 가속 · <b>' + Math.round(Math.hypot(v.speed, v.lat) * 3.6) + '</b> km/h · 차량 ' + (v.burnT > 0 ? '<b style="color:#ff5a3c">불붙음!</b>' : '<b' + (hpP < 30 ? ' style="color:#ff8a3c"' : '') + '>' + hpP + '%</b>') + (v.wheelDamage?' · <b style="color:#ffb45e">타이어 파손 '+v.wheelDamage+'/4</b>':'') + (v.drift ? ' · <b style="color:#ffd23f">드리프트</b>' : v.boosting?' · <b style="color:#ffd23f">가속 중</b>':''); P.lootTarget = null; P.reviveTarget = null;
    P.prompt+=' · <kbd>'+G.Settings.label('KeyV')+'</kbd> '+(P.vehicleView==='first'?'외부 시점':'내부 시점');
    if (I.hit('KeyF')) { this.exit(P); return; }
    if(P.vehicleView==='first')G.VehicleCabin.camera(P,dt);
    else{
      cam.near=P.vehicleNear??.05;
      // 경사면에서 추적 카메라가 캐빈 안으로 당겨지지 않도록 지형 위로 올린다.
      const dist = 7.5;
      _c.set(Math.sin(P.orbitYaw) * Math.cos(P.orbitPitch), -Math.sin(P.orbitPitch), Math.cos(P.orbitYaw) * Math.cos(P.orbitPitch));
      _e.copy(v.pos); _e.y += 1.9;
      _d.copy(_e).addScaledVector(_c, dist);
      for (let i = 1; i <= 8; i++) {
        const t = i / 8, x = U.lerp(_e.x, _d.x, t), z = U.lerp(_e.z, _d.z, t);
        _d.y = Math.max(_d.y, _e.y + (W.heightAt(x, z) + 0.5 - _e.y) / t);
      }
      _c.copy(_d).sub(_e);
      let L = _c.length(); _c.normalize();
      const wall = W.rayBoxes(_e.x, _e.y, _e.z, _c.x, _c.y, _c.z, L, null);
      if (wall < Infinity) L = Math.max(0.3, wall - 0.3);
      cam.position.copy(_e).addScaledVector(_c, L);
      const gy = W.heightAt(cam.position.x, cam.position.z) + 0.4; if (cam.position.y < gy) cam.position.y = gy;
      cam.lookAt(_e);
      cam.fov = U.damp(cam.fov, 74 + Math.abs(v.speed) * 0.35, 5, dt); cam.updateProjectionMatrix();
    }
    G.VM.set(null);
    G.lodZoom = 1;
  },
  // 차량 물리 한 단계 (플레이어·봇 공용). thr: -1..1, st: 왼쪽 +, brake: 브레이크, hand: 핸드브레이크, boost: 추가 가속
  //  속도는 차 앞방향(speed)과 옆방향(lat) 두 성분. 차가 도는 만큼 속도 방향은 늦게 따라온다 →
  //  뒷바퀴가 미끄러지면(핸드브레이크) 옆으로 흐르며 드리프트, 평소엔 접지력이 옆 속도를 금방 없앤다.
  step(v, a, dt, thr, st, brake, hand, boost) {
    // 수직 낙하뿐 아니라 접점·회전·수평 충돌도 같은 짧은 시간 간격으로 진행한다.
    const parts=Math.max(1,Math.ceil(dt*120-1e-7)),h=dt/parts;
    for(let i=0;i<parts;i++){this.stepPhysics(v,a,h,thr,st,brake,hand,boost);if(v.driver!==a)break}
  },
  stepPhysics(v, a, dt, thr, st, brake, hand, boost) {
    const W = G.World, spec=this.spec(v);
    const grounded=v.grounded!==false;
    const traction=grounded?U.clamp((v.groundContacts??(v.wheels?.length||4))/(v.wheels?.length||4),0,1):0;
    const wet = W.waterAt(v.pos.x, v.pos.z) - Math.max(W.heightAt(v.pos.x, v.pos.z),v.pos.y);
    if(v.fuel<=0)thr=0; // v108 연료계는 실제 잔량을 표시한다.
    if(v.driver&&!v.dead)v.fuel=Math.max(0,(v.fuel??1)-dt*(.000012+Math.max(0,thr)*.000035)*(boost?1.5:1));
    v.engineHeat=U.damp(v.engineHeat??.35,v.dead?0:.35+Math.abs(thr)*.23+(boost?.12:0)+(1-v.hp/(v.maxHp||HP))*.20,.15,dt);
    if (v.dead) { thr = 0; st = 0; brake = true; hand = false; }
    v.handbrake=!!hand;
    v.boosting=!!boost&&grounded&&traction>0&&thr>0&&v.speed>=0&&!brake&&!hand&&!v.dead&&wet<=.3;
    // v107 변속기 시뮬레이션 대신 속도대·가속 입력으로 표시용 회전수를 부드럽게 추정한다.
    v.throttle=thr;const kph=Math.hypot(v.speed,v.lat||0)*3.6,gear=Math.min(4,Math.floor(kph/24)),rpm=v.dead?0:800+(kph-gear*24)*70+gear*180+Math.max(0,thr)*(v.boosting?2200:1250);
    v.displayRpm=U.damp(v.displayRpm||0,U.clamp(rpm,0,6500),thr>0?6:3,dt);
    const punctures=v.wheelDamage||0,top = (wet > 0.5 ? 4 : v.boosting?spec.boost:spec.max)*Math.max(.38,1-punctures*.15),power=v.boosting?1.35:1;
    // 많이 부서지면 힘이 빠진다
    const weak = (v.hp < (v.maxHp||HP) * 0.3 ? 0.65 : 1)*Math.pow(.88,punctures);
    if(!grounded){v.speed*=Math.exp(-.025*dt);v.lat*=Math.exp(-.025*dt)}
    else if (hand) {
      // 꺾으면서 당기면 뒷바퀴만 미끄러진다: 거의 감속하지 않고, 가속 페달을 밟고 있으면 속도를 유지
      if (Math.abs(st) > 0.2 && Math.abs(v.speed) > 6) {
        v.speed = approach(v.speed, 0, 1.8 * traction * dt);
        if (thr > 0 && v.speed > 0 && v.speed < top) v.speed = Math.min(top, v.speed + spec.accel*.63 * weak * traction * (1 - v.speed / (top + 4)) * dt);
      } else v.speed = approach(v.speed, 0, 16 * traction * dt);
    }
    else if (brake) v.speed = approach(v.speed, 0, 26 * traction * dt);
    else if (thr > 0) {if(v.speed<0)v.speed=approach(v.speed,0,22*traction*dt);else if(v.speed<top)v.speed=Math.min(top,v.speed+spec.accel*weak*power*traction*(1-v.speed/(top+4))*dt);}
    else if (thr < 0) v.speed = v.speed > 0.5 ? approach(v.speed, 0, 20 * traction * dt) : Math.max(-REV*Math.max(.45,1-punctures*.14), v.speed - 6*Math.pow(.88,punctures)*traction * dt);
    else v.speed = approach(v.speed, 0, (2.2 + Math.abs(v.speed) * 0.12)*traction * dt);
    // Shift를 놓아도 속도를 잘라 내지 않는다. 정상 속도까지 부드럽게 돌아온다.
    if (grounded&&v.speed > top) v.speed = approach(v.speed, top, (wet>.5||punctures?14:4) * dt);
    v.steer = U.damp(v.steer, st, spec.response, dt);
    const lock = spec.steer / (1 + Math.abs(v.speed) * 0.06);v.steerAngle=v.steer*lock;
    // 지금 속도 (세계 좌표)
    _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    _vel.copy(_f).multiplyScalar(v.speed).addScaledVector(_r, v.lat || 0);
    // 핸드브레이크로 뒷바퀴를 잠그면 차 머리가 더 잘 돈다
    const slide = grounded&&traction>0&&hand&&Math.abs(v.speed)>6;
    let yawRate = grounded?Math.tan(v.steerAngle) * v.speed / (v.wheelbase||2.6)+(v.tirePull||0)*U.clamp(v.speed/8,-1,1):0;
    if (slide) yawRate *= 1.25;
    else if(grounded){const limit=(wet>.3?5:10)/Math.max(3,Math.abs(v.speed));yawRate=U.clamp(yawRate,-limit,limit);}
    // 접지가 끊기면 핸들은 차체를 돌리지 못한다. 도약 직전의 각운동량은 공중에서도 이어진다.
    v.yawRate=grounded?U.damp(v.yawRate||0,yawRate*traction,spec.yawResponse,dt):(v.yawRate||0)*Math.exp(-.35*dt);
    v.yaw += v.yawRate * dt;
    // 새 방향으로 속도 나누기
    _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    v.speed = _vel.dot(_f); v.lat = _vel.dot(_r);
    // 옆 접지력: 평소 강하게, 핸드브레이크면 약하게. 잃은 옆 속도 일부는 앞으로 (드리프트를 빠져나올 때 가속)
    v.driftBlend=U.damp(v.driftBlend||0,slide?1:0,12,dt);
    const grip = U.lerp(wet>.3?9:18,2.2,v.driftBlend)*Math.max(.35,1-punctures*.16);
    const lat0 = v.lat;
    if(grounded)v.lat *= Math.exp(-grip*traction * dt);
    if (grounded&&!slide && v.speed > 0 && v.speed < top) v.speed = Math.min(top, v.speed + Math.abs(lat0 - v.lat) * 0.25);
    if (Math.abs(v.lat) < 0.02) v.lat = 0;
    v.drift = slide&&Math.abs(v.lat)>1.5;
    let nx = v.pos.x + (_f.x * v.speed + _r.x * v.lat) * dt, nz = v.pos.z + (_f.z * v.speed + _r.z * v.lat) * dt;
    // 가파른 비탈은 오르지 못한다
    const lead = Math.sign(v.speed) * 2.2, slope = (this.groundAt(nx+_f.x*lead,nz+_f.z*lead,v.pos.y)-this.groundAt(nx,nz,v.pos.y)) / 2.2;
    if (grounded&&slope > 0.95) { v.speed *= -0.15; v.lat = 0; nx = v.pos.x; nz = v.pos.z; }
    // 내리막 힘은 실제 바퀴로 정한 차체 기울기를 따른다. 아직 밟지 않은 절벽으로 끌어당기지 않는다.
    else if(grounded&&traction>0&&!brake&&!hand&&Math.abs(v.speed)>.1)v.speed-=9.81*Math.sin(v.pitch)*Math.cos(v.pitch)*dt;
    _vel.copy(_f).multiplyScalar(v.speed).addScaledVector(_r,v.lat);
    const collision=this.move(v,nx,nz,_vel,dt);nx=collision.x;nz=collision.z;
    if (collision.hit) {
      // 세게 들이받은 순간에만 한 번 다친다
      const hitV = collision.impact;
      if (!v.bump && hitV > 9) { if (a.isPlayer) G.FX.shake(0.3); G.Audio.impact(v.pos, 'metal'); G.Game.damage(a, Math.min(30, (hitV - 9) * 2.2/Math.sqrt(spec.mass/1.7)), null, 'fall', false, a.pos, null); this.damage(v, (hitV - 9) * 6, null, 'crash'); }
    }
    v.speed=_vel.dot(_f);v.lat=_vel.dot(_r);v.bump = collision.hit;
    const lim = W.HALF - 6;
    v.pos.x = U.clamp(nx, -lim, lim); v.pos.z = U.clamp(nz, -lim, lim);
    this.place(v, 1 - Math.exp(-10 * dt),dt);
    this.wheelAnim(v, dt);
    this.tires(v, dt);
    if (v.driver !== a) return;
    // 들이받기
    if (Math.abs(v.speed) > 5) {
      const now = G.Game.time, s = Math.sign(v.speed);
      for (const t of G.Game.actors) {
        if (!t.alive || t === a || t.team === a.team || t.state !== 'ground') continue;
        const dx = t.pos.x - (v.pos.x + _f.x * 1.3 * s), dz = t.pos.z - (v.pos.z + _f.z * 1.3 * s);
        if (dx * dx + dz * dz > 1.6 * 1.6 || Math.abs(t.pos.y - v.pos.y) > 1.8) continue;
        if ((v.hitT.get(t) || -9) > now - 0.7) continue;
        v.hitT.set(t, now);
        t.chest(_c);
        G.Game.damage(t, Math.abs(v.speed) * 7 * spec.mass/1.7, a, 'vehicle', false, _c, _f);
        G.FX.blood(_c, _f.x * s, 0.3, _f.z * s, 8); G.Audio.impact(_c, 'flesh');
        t.vel.x += _f.x * v.speed * 0.6; t.vel.z += _f.z * v.speed * 0.6; t.vel.y = 3.5;
        v.speed *= 0.82;
      }
    }
    // 운전자 상태
    a.pos.copy(v.pos); a.vel.set(_f.x * v.speed + _r.x * v.lat, v.vy||0, _f.z * v.speed + _r.z * v.lat); a.hspeed = Math.abs(v.speed); a.onGround = v.grounded!==false; a.yaw = v.yaw; a.pitch = 0;
  },
  /* ---------------- 바퀴 · 타이어 자국 ---------------- */
  wheelAnim(v, dt) {
    G.VehicleWheels.update(v,dt);
  },
  // 드리프트: 뒷바퀴 자국 · 타이어 연기 · 끼익 소리
  tires(v, dt) {
    const near = v.pos.distanceTo(G.camera.position) < 160;
    if (!v.skid) v.skid = [null, null];
    if (!v.handbrake || !v.drift || !near || v.dead) { G.VehicleSkids.stop(v); if (v.driver && v.driver.isPlayer && G.Audio.ctx) G.Audio.setLoop('skid', 0); return; }
    const rear = (v.wheels||[]).filter(w=>!w.front);
    rear.slice(0, 2).forEach((w, i) => {
      if(w.grounded===false){G.VehicleSkids.stopTrack(v,i);return;}
      w.o.getWorldPosition(_o);
      _o.y = this.groundAt(_o.x,_o.z,v.pos.y) + 0.03;
      G.VehicleSkids.add(v,i,_o,U.clamp(w.width*.75,.18,.34),U.clamp(Math.abs(v.lat)/12,.18,.48));
      if (Math.random() < dt * 22) G.FX.dust(_o, 1, -v.lat * 0.04, 0.35, 0, 0.62, 0.62, 0.6, 1.1);
    });
    if (v.driver && v.driver.isPlayer && G.Audio.ctx) G.Audio.setLoop('skid', U.clamp(Math.abs(v.lat) / 7, 0.15, 0.55));
  },
  /* ---------------- 부서짐 · 폭발 ---------------- */
  // 차체 상자와 실제 조향된 바퀴를 분리한다. 바퀴 구멍은 차체 삼각형으로 가림을 확인한다.
  rayHit(o, d, maxT) {
    let best = null;
    for (const v of this.list) {
      const D = dimOf(v), R = D.hl + 1;
      const dx = v.pos.x - o.x, dz = v.pos.z - o.z;
      // 광선과 차 중심의 거리로 먼저 거른다
      const tc = dx * d.x + dz * d.z, h = dx * dx + dz * dz - tc * tc / (d.x * d.x + d.z * d.z + 1e-9);
      if (h > R * R || tc < -R || tc > maxT + R) continue;
      const limit=best?Math.min(best.t,maxT):maxT;
      _vehicleInv.copy(v.mesh.matrixWorld).invert();_wheelRay.set(o,d).applyMatrix4(_vehicleInv);_wheelBox.min.set(-D.hw,.3,-D.hl);_wheelBox.max.set(D.hw,D.top*.92,D.hl);
      let body=Infinity;if(_wheelBox.containsPoint(_wheelRay.origin)){body=0;_contact.copy(_wheelRay.origin)}else if(_wheelRay.intersectBox(_wheelBox,_contact))body=_e.copy(_contact).applyMatrix4(v.mesh.matrixWorld).distanceTo(o);
      const wheel=G.VehicleWheels.ray(v,o,d,limit);
      if(wheel){const cover=G.VehicleWheels.occluder(v,o,d,wheel.t-.025);if(cover===Infinity){best=wheel;continue}body=Math.min(body,cover)}
      else if(body<limit&&G.VehicleWheels.well(v,_contact,_vehicleInv))body=G.VehicleWheels.occluder(v,o,d,limit);
      if(body<limit)best={v,t:body};
    }
    return best;
  },
  // 피해: 반쯤 부서지면 연기, 다 부서지면 잠시 불타다 폭발
  damage(v, amt, by, kind) {
    if (!v || v.dead || amt <= 0) return;
    if (by) v.lastHit = by;
    if(kind==='crash')amt*=Math.sqrt(this.spec(v).mass/1.7); // v108 무거운 차는 충돌 에너지가 크고 내구도도 높다.
    v.hp -= amt;
    if (v.hp <= 0 && !v.burnT) {
      v.hp = 0;
      v.burnT = kind === 'blast' ? 0.45 + Math.random() * 0.5 : 2.4;   // 옆 차가 터지면 곧바로 연쇄 폭발
      G.Audio.impact(v.pos, 'metal');
    } else if (v.burnT && kind === 'blast') v.burnT = Math.min(v.burnT, 0.5);
  },
  // 폭발 반경 안의 차에 피해 (수류탄 · 다른 차의 폭발)
  blast(p, r, dmg, by, skip) {
    for (const v of this.list) {
      if (v === skip || v.dead) continue;
      const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z) - v.dim.hw * 0.6;
      if (d < r && Math.abs(v.pos.y - p.y) < 4) this.damage(v, dmg * Math.pow(1 - Math.max(0, d) / r, 1.1), by, 'blast');
    }
  },
  center(v, out) { return out.set(0, v.dim.top * 0.45, 0).applyAxisAngle(_Y, v.yaw).add(v.pos); },
  engine(v, out) { return out.set(0, v.dim.top * 0.62, -v.dim.hl * 0.62).applyAxisAngle(_Y, v.yaw).add(v.pos); },
  explode(v) {
    const Game = G.Game, W = G.World, by = v.lastHit && v.lastHit.alive !== undefined ? v.lastHit : null;
    v.dead = true; v.burnT = 0;
    // 타고 있던 사람은 내린 뒤 폭발에 맞는다
    const d0 = v.driver;
    if (d0) { const P = G.Player; if (P.vehicle === v) this.exit(P, true); else if (d0.brain && d0.brain.vehicle === v) this.botExit(d0.brain); else v.driver = null; }
    v.speed = 0; v.lat = 0;
    if (G.Audio.ctx && d0 && d0.isPlayer) { G.Audio.setLoop('skid', 0); G.Audio.setLoop('engine', 0); }
    const p = this.center(v, new V3());
    G.FX.explosion(p);
    _c.copy(p).add(_e.set((Math.random() - 0.5) * 1.6, 0.6, (Math.random() - 0.5) * 2.4)); G.FX.explosion(_c);
    G.FX.light(p, 0xff8030, 1600, 0.6, 70);
    G.FX.debris(p, 26, 0, 1.2, 0, 0.09, 0.08, 0.07);
    G.Audio.explosion(p); G.Audio.impact(p, 'metal');
    const camD = G.camera.position.distanceTo(p);
    G.FX.shake(U.clamp(1.8 - camD / 30, 0, 1.4));
    // 사람 피해 (벽 뒤는 안전)
    for (const a of Game.actors) {
      if (!a.alive || a.state !== 'ground') continue;
      a.chest(_c);
      const d = _c.distanceTo(p);
      if (d > 9) continue;
      _d.copy(_c).sub(p).normalize();
      if (a !== d0 && W.rayBoxes(p.x, p.y, p.z, _d.x, _d.y, _d.z, Math.max(0, d - 0.3), null) < Infinity) {
        // 차 자신의 충돌 상자는 이미 없다; 다른 벽이면 막힘
        continue;
      }
      const dmg = a === d0 ? 260 : 210 * Math.pow(1 - d / 9, 1.2);
      if (dmg > 1) { Game.damage(a, dmg, by, 'carbomb', false, _c, _d); a.vel.x += _d.x * 6; a.vel.z += _d.z * 6; a.vel.y = Math.max(a.vel.y, 3.5); }
    }
    Game.onNoise(p, 170, by);
    this.blast(p, 8, 300, by, v);
    // 들썩 튀어 오르고 기울어진 채 내려앉는다
    v.hop = { y: 0, vy: 5.5 + Math.random() * 1.5 };
    v.tilt = { x: (Math.random() - 0.5) * 0.3, z: (Math.random() - 0.5) * 0.45, tx: (Math.random() - 0.5) * 0.12, tz: (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.1) };
    // 불탄 껍데기
    if (!this.burnt) this.burnt = { body: new THREE.MeshStandardMaterial({ color: 0x1d1b19, roughness: 0.95, metalness: 0.25 }), glass: new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.6, metalness: 0.1 }) };
    v.mesh.traverse(o => {
      if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => /window|glass/i.test(m.name) ? this.burnt.glass : this.burnt.body) : (/window|glass/i.test(o.material.name) ? this.burnt.glass : this.burnt.body);
    });
    if (v.wheels) for (const w of v.wheels) w.o.visible = Math.random() < 0.6;
    G.RT?.invalidate();
    v.wreckT = 0;
    if (!v.box) this.block(v);
  },
  // 연기 · 불길 (부서진 정도에 따라)
  burnFx(v, dt) {
    if (v.pos.distanceTo(G.camera.position) > 220) return;
    const e = this.engine(v, _c);
    const hpK = v.hp / (v.maxHp||HP);
    if (v.dead) {
      if (v.wreckT < 14) {         // 남은 불
        if (Math.random() < dt * 26) this.flame(this.center(v, _e).add(_o.set((Math.random() - 0.5) * v.dim.hw, 0.2, (Math.random() - 0.5) * v.dim.hl)), 0.8);
        if (Math.random() < dt * 9) G.FX.dust(_e.copy(this.center(v, _e)).add(_o.set(0, 0.8, 0)), 1, 0, 1.6, 0, 0.09, 0.085, 0.08, 2.4);
      } else if (v.wreckT < 45 && Math.random() < dt * 4) G.FX.dust(_e.copy(this.center(v, _e)).add(_o.set(0, 0.6, 0)), 1, 0, 1.2, 0, 0.2, 0.19, 0.18, 2);
      return;
    }
    if (v.burnT > 0) {             // 터지기 직전: 보닛에서 불길
      if (Math.random() < dt * 60) this.flame(_e.copy(e).add(_o.set((Math.random() - 0.5) * 0.8, 0.1, (Math.random() - 0.5) * 0.7)), 1.1);
      if (Math.random() < dt * 14) G.FX.dust(_e.copy(e).add(_o.set(0, 0.5, 0)), 1, 0, 1.8, 0, 0.08, 0.07, 0.07, 2.2);
    } else if (hpK < 0.55 && Math.random() < dt * (hpK < 0.3 ? 16 : 7)) {
      const g = hpK < 0.3 ? 0.12 : 0.45;
      G.FX.dust(_e.copy(e).add(_o.set(0, 0.25, 0)), 1, 0, 1.3, 0, g, g, g * 0.97, hpK < 0.3 ? 1.8 : 1.3);
    }
  },
  flame(p, k) {
    G.FX.add.spawn({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 0.6, vy: 1.6 + Math.random() * 1.6, vz: (Math.random() - 0.5) * 0.6,
      life: 0.4 + Math.random() * 0.4, s0: 0.85 * k, s1: 0.15, r: 6, g: 2.4 + Math.random() * 0.8, b: 0.6, a: 0.85, drag: 1.2, grav: -1.5 });
  },
  /* ---------------- 봇 운전 ---------------- */
  // 봇이 탈 만한 빈 차 (다른 봇이 찜하지 않은 것)
  freeNear(a, r) {
    let best = null, bd = r;
    for (const v of this.list) {
      if (v.driver || v.dead || v.hp < (v.maxHp||HP) * 0.3 || v.wheelDamage>2 || (v.claim && v.claim !== a && v.claim.alive)) continue;
      if (G.World.waterAt(v.pos.x, v.pos.z) - Math.max(G.World.heightAt(v.pos.x, v.pos.z),v.pos.y) > 0.3) continue;
      const d = Math.hypot(v.pos.x - a.pos.x, v.pos.z - a.pos.z);
      if (d < bd && Math.abs(v.pos.y - a.pos.y) < 3) { bd = d; best = v; }
    }
    return best;
  },
  botEnter(bot, v) {
    const a = bot.a;
    if (v.driver) return false;
    this.unblock(v);
    v.driver = a; v.claim = null; bot.vehicle = v; a.inVehicle = v;
    a.crouch = false; a.prone = false; a.leanX = 0;
    G.VehicleCabin.ensure(v);
    bot.vStop = false; bot.vStuck = 0; bot.vRev = 0; bot.vLast = v.pos.clone(); bot.vT = 0;
    if (G.Audio.ok() && G.WeaponAudio) G.WeaponAudio.eventAt(G.Audio, 'close', 'ka47', v.pos);
    return true;
  },
  botExit(bot) {
    const v = bot.vehicle, a = bot.a, W = G.World;
    if (!v) return;
    _r.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    let done = false;
    for (const [ox, oz] of [[-1.9, 0], [1.9, 0], [0, 3], [0, -3]]) {
      const x = v.pos.x + _r.x * ox + Math.sin(v.yaw) * oz, z = v.pos.z + _r.z * ox + Math.cos(v.yaw) * oz;
      let free = true;
      W.queryBoxes(x - 0.4, z - 0.4, x + 0.4, z + 0.4, b => { if (b.maxY > v.pos.y + 0.5 && b.minY < v.pos.y + 1.8) free = false; });
      if (!free) continue;
      a.pos.set(x, Math.max(this.groundAt(x,z,v.pos.y), v.pos.y - 0.5), z); done = true; break;
    }
    if (!done) a.pos.set(v.pos.x, v.pos.y + 1.8, v.pos.z);
    a.vel.set(-Math.sin(v.yaw) * v.speed * 0.4, 0, -Math.cos(v.yaw) * v.speed * 0.4);
    a.yaw = v.yaw; a.pitch = 0;
    G.VehicleCabin.release(a.model);
    v.driver = null;v.handbrake=false;v.drift=false;v.boosting=false;G.VehicleSkids.stop(v); bot.vehicle = null; a.inVehicle = null;
    if (Math.abs(v.speed) < 1.5&&v.grounded!==false) { v.speed = 0; this.block(v); }
  },
  // 봇 운전: 목표 쪽으로 핸들을 꺾고, 막히면 후진해서 돌아 나온다. 다 오면 true(내릴 때)
  botDrive(bot, dt, goal) {
    const a = bot.a, v = bot.vehicle, W = G.World;
    const dx = goal.x - v.pos.x, dz = goal.z - v.pos.z, dist = Math.hypot(dx, dz);
    if (dist < 18) { this.step(v, a, dt, 0, 0, true); return Math.abs(v.speed) < 1; }
    const want = Math.atan2(-dx, -dz);
    let diff = U.angleDiff(v.yaw, want);
    // 앞이 막혔으면 피해 가는 쪽으로
    _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw));
    const look = 5 + Math.abs(v.speed) * 0.5;
    // 차 폭만큼 세 줄로 앞을 본다
    const ahead = (yaw) => {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
      for (const o of [0, -0.95, 0.95]) if (W.rayBoxes(v.pos.x + rx * o, v.pos.y + 1, v.pos.z + rz * o, fx, 0, fz, look, null) < Infinity) return true;
      const hx = v.pos.x + fx * look, hz = v.pos.z + fz * look;
      const floor=this.groundAt(hx,hz,v.pos.y);return floor-v.pos.y>2.2||W.waterAt(hx,hz)-floor>.6;
    };
    const blocked = ahead(v.yaw);
    if (blocked) {
      for (const t of [0.5, 0.9, 1.4]) {
        if (!ahead(v.yaw + t)) { diff = t; break; }
        if (!ahead(v.yaw - t)) { diff = -t; break; }
      }
    }
    let thr = Math.abs(diff) > 1.6 ? 0.5 : 1, st = U.clamp(diff * 2.2, -1, 1);
    // 끼임: 2초 동안 거의 못 움직였으면 1.3초 후진
    bot.vT += dt;
    if (bot.vRev > 0) { bot.vRev -= dt; thr = -1; st = -bot.vRevSt; }
    else if (bot.vT > 2) {
      if (v.pos.distanceTo(bot.vLast) < 2.5) { bot.vStuck++; bot.vRev = 1.3; bot.vRevSt = st || 1; }
      else bot.vStuck = Math.max(0, bot.vStuck - 1);
      bot.vT = 0; bot.vLast.copy(v.pos);
    }
    // 봇은 너무 빨리 몰지 않고, 앞이 막히거나 크게 꺾을 때는 속도를 줄인다 (들이받아 다치지 않게)
    const cruise=this.spec(v).max*.7,slow = (Math.abs(diff) > 0.8 && v.speed > cruise*.6) || (blocked && v.speed > cruise*.47);
    if (thr > 0 && v.speed > cruise) thr = 0;
    this.step(v, a, dt, slow ? 0 : thr, st, slow);
    return false;
  },
  // 잔해를 치우고 처음 자리에 새 차 (사람·다른 차가 자리를 막고 있으면 비킬 때까지 기다린다)
  respawn(v) {
    const H = v.home;
    for (const a of G.Game.actors) if (a.alive && Math.hypot(a.pos.x - H.x, a.pos.z - H.z) < 5) return false;
    for (const o of this.list) if (o !== v && Math.hypot(o.pos.x - H.x, o.pos.z - H.z) < 5) return false;
    G.scene.remove(v.mesh); this.unblock(v);G.VehicleWheels.dispose(v);
    this.list.splice(this.list.indexOf(v), 1);
    const n = this.newVehicle(H.x, G.World.heightAt(H.x, H.z), H.z, H.yaw, { home: H, kind: H.kind });
    G.FX.dust(_e.copy(n.pos).add(_o.set(0, 0.4, 0)), 10, 0, 0.6, 0, 0.55, 0.52, 0.48, 1.6);
    return true;
  },
  update(dt) {
    G.VehicleSkids.update(dt);
    for (const v of this.list) if (v.dead) v.wreckT += dt;
    for (const v of this.list.slice()) if (v.dead && v.wreckT > RESPAWN && (v.respawnT = (v.respawnT || 0) - dt) <= 0) { if (!this.respawn(v)) v.respawnT = 2; }
    // 봇이 운전하는 차 중 가장 가까운 차의 엔진 소리
    if (G.Audio.ctx) {
      let near = null, nd = 120;
      for (const v of this.list) if (v.driver && !v.driver.isPlayer) { const d = v.pos.distanceTo(G.camera.position); if (d < nd) { nd = d; near = v; } }
      if (near) { G.Audio.setLoop('engineBot', 0.5 + Math.abs(near.speed) / this.spec(near).max * 0.3, near.pos, 14); G.Audio.setLoopRate('engineBot', 0.7 + Math.abs(near.speed) / this.spec(near).max * 1.1); }
      else G.Audio.setLoop('engineBot', 0);
    }
    for (const v of this.list) {
      if (v.hp < (v.maxHp||HP) * 0.55 || v.dead) this.burnFx(v, dt);
      if (v.burnT > 0) {
        v.burnT -= dt;
        if (v.burnT <= 0) this.explode(v);
      }
      if (v.hop) {
        v.hop.vy -= 18 * dt; v.hop.y += v.hop.vy * dt;
        v.tilt.x = U.damp(v.tilt.x, v.tilt.tx, 3, dt); v.tilt.z = U.damp(v.tilt.z, v.tilt.tz, 3, dt);
        if (v.hop.y <= 0 && v.hop.vy < 0) { v.hop.y = 0; if (v.hop.vy < -3) { v.hop.vy *= -0.25; G.Audio.impact(v.pos, 'metal'); } else { v.hop = null; } }
        this.place(v, 1);
      }
    }
    // 운전자가 없는 채로 굴러가는 차는 서서히 멈춘 뒤 다시 충돌 상자를 둔다
    for (const v of this.list) {
      if (v.driver) {
        const d = v.driver;
        if (!d.alive || d.knocked) { const P = G.Player; if (P.vehicle === v) this.exit(P, true); else if (d.brain && d.brain.vehicle === v) this.botExit(d.brain); else v.driver = null; }
        else if (!d.isPlayer) {
          v.noiseT -= dt;
          if (v.noiseT <= 0) { v.noiseT = 1; G.Game.onNoise(v.pos, 45 + Math.abs(v.speed) * 2.5, d); }
          if (Math.abs(v.speed) > 7 && Math.random() < dt * 14 && v.pos.distanceTo(G.camera.position) < 120) { _f.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); G.FX.dust(_c.copy(v.pos).addScaledVector(_f, -1.7 * Math.sign(v.speed)), 1, 0, 0.3, 0, 0.5, 0.45, 0.36, 1.4); }
        }
        continue;
      }
      if (v.speed === 0 && !v.lat&&v.grounded!==false&&!v.springOffset) continue;
      v.handbrake=false;v.drift=false;v.boosting=false;G.VehicleSkids.stop(v);
      // 하차한 차도 같은 차체 충돌·수직 적분을 쓴다. 공중에서 주차 제동으로 수평 속도를 없애지 않는다.
      const parts=Math.max(1,Math.ceil(dt*120-1e-7)),h=dt/parts;
      for(let i=0;i<parts;i++){
        const grounded=v.grounded!==false;
        if(grounded){v.speed=approach(v.speed,0,9*h);v.lat=approach(v.lat||0,0,12*h);}
        else{v.speed*=Math.exp(-.025*h);v.lat=(v.lat||0)*Math.exp(-.025*h);}
        _f.set(-Math.sin(v.yaw),0,-Math.cos(v.yaw));_r.set(Math.cos(v.yaw),0,-Math.sin(v.yaw));_vel.copy(_f).multiplyScalar(v.speed).addScaledVector(_r,v.lat);
        v.yawRate=(v.yawRate||0)*Math.exp(-(grounded?8:.35)*h);v.yaw+=v.yawRate*h;
        _f.set(-Math.sin(v.yaw),0,-Math.cos(v.yaw));_r.set(Math.cos(v.yaw),0,-Math.sin(v.yaw));
        const collision=this.move(v,v.pos.x+_vel.x*h,v.pos.z+_vel.z*h,_vel,h),lim=G.World.HALF-6;
        v.pos.x=U.clamp(collision.x,-lim,lim);v.pos.z=U.clamp(collision.z,-lim,lim);v.speed=_vel.dot(_f);v.lat=_vel.dot(_r);
        if(Math.abs(v.speed)<.02)v.speed=0;if(Math.abs(v.lat)<.02)v.lat=0;
        this.place(v,1-Math.exp(-10*h),h);this.wheelAnim(v,h);
      }
      if (v.speed === 0 && !v.lat && !v.box&&v.grounded!==false) this.block(v);
    }
  },
  draw(ctx, toS, scale) {
    for (const v of this.list) {
      const [x, y] = toS(v.pos.x, v.pos.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-v.yaw);
      ctx.fillStyle = v.dead ? '#3a3633' : v.driver ? '#ffd23f' : '#e8e8e8'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.fillRect(-2.6 * scale, -4.4 * scale, 5.2 * scale, 8.8 * scale); ctx.strokeRect(-2.6 * scale, -4.4 * scale, 5.2 * scale, 8.8 * scale);
      ctx.restore();
    }
  }
};
function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }

})();
