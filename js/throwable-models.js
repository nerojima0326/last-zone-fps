// throwable-models.js — 투척무기 4종 실사 모델 (v46)
//  원본: 3DModelsCC0 "Free CC0 Guns & Explosives Pack" (CC0) — 수류탄(M67 형) · 섬광탄(M84 형) · 연막탄(M18) · 화염병
//  assets/models/throwables/<frag|flash|smoke|molotov>.glb — tools/throwables/build.cjs 로 만든 게임용 GLB
//    원점 = 몸통 가운데, 위(+Y) = 신관·병목, 안전손잡이는 +X 쪽, 단위 m (실제 크기)
//  파일이 없으면(file:// 등) weapons.js 의 절차적 모델이 그대로 쓰인다.
(function () {
'use strict';
const THREE = window.THREE, G = window.G;
const IDS = ['frag', 'flash', 'smoke', 'molotov'];
// 손에 쥐는 높이를 예전 모델과 맞춘다 (병은 몸통을 쥔다)
const LIFT = { molotov: 0.045 };

const TM = G.ThrowModels = {
  src: {},
  has(k) { return !!this.src[k]; },
  async load(renderer) {
    if (location.protocol === 'file:' || !THREE.GLTFLoader) return;
    const gl = new THREE.GLTFLoader();
    if (THREE.MeshoptDecoder) gl.setMeshoptDecoder(THREE.MeshoptDecoder);
    const v = window.LZ_BUILD || '';
    await Promise.all(IDS.map(k => gl.loadAsync('assets/models/throwables/' + k + '.glb' + (v ? '?v=' + v : '')).then(g => {
      const root = g.scene;
      root.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        const m = o.material;
        m.envMapIntensity = 0.8;
        // 병(투명 유리)은 뒤쪽 면까지 그려 두께가 보이게
        if (m.transparent) { m.side = THREE.DoubleSide; m.depthWrite = false; }
        for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap]) if (t && renderer) renderer.initTexture(t);
      });
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      this.src[k] = { root, top: box.max.y };
    }).catch(e => console.info('[throw] ' + k + ' 모델 없음', e.message))));
  },
  // 공유 지오메트리·재질 복제본. pin: false → 안전핀을 뺀 모습 (던진 뒤)
  make(k, opt = {}) {
    const S = this.src[k];
    if (!S) return null;
    const g = new THREE.Group();
    const m = S.root.clone(true);
    m.position.y = LIFT[k] || 0;
    g.add(m);
    g.userData.keep = true;   // weapons.js mergeStatic 이 합치지 않게
    g.userData.top = S.top + (LIFT[k] || 0);
    m.traverse(o => { if (o.isMesh) { o.userData.keep = true; if (o.name === 'pin' || /pin/i.test(o.parent?.name || '')) g.userData.pin = o; } });
    if (opt.pin === false && g.userData.pin) g.userData.pin.visible = false;
    return g;
  }
};
})();
