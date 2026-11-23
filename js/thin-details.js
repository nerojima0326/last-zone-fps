// 울타리·난간 같은 긴 막대가 장면의 한 픽셀보다 가늘어져 사라지는 현상을 막는다.
// 충돌·AO용 정점은 유지하고, 래스터 렌더링 때만 단면을 부드럽게 넓힌다.
(function () {
'use strict';
const G = window.G, THREE = window.THREE;
const D = G.ThinDetails = {
  materials: new Set(), height: { value: 540 }, enabled: { value: 1 },
  geometry(geo, w, h, d, matrix, mat) {
    const dims = [w, h, d], axis = dims.indexOf(Math.max(...dims));
    const sides = dims.filter((_, i) => i !== axis), radius = Math.min(...sides) / 2;
    if (dims[axis] < .8 || Math.max(...sides) > .12 || dims[axis] / Math.max(...sides) < 8 || Math.max(...sides) / Math.min(...sides) > 4) return;
    const pos = geo.attributes.position, data = new Int8Array(pos.count * 4), v = new THREE.Vector3(), rotation = new THREE.Matrix3().setFromMatrix4(matrix);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).setComponent(axis, 0).applyMatrix3(rotation);
      data[i * 4] = Math.round(v.x / radius * 16); data[i * 4 + 1] = Math.round(v.y / radius * 16); data[i * 4 + 2] = Math.round(v.z / radius * 16);
      data[i * 4 + 3] = Math.max(1, Math.round(radius * 2000));
    }
    geo.setAttribute('thinData', new THREE.Int8BufferAttribute(data, 4)); this.materials.add(mat);
  },
  prepare(geos, mat) {
    if (!this.materials.has(mat)) return;
    for (const geo of geos) if (!geo.attributes.thinData) geo.setAttribute('thinData', new THREE.Int8BufferAttribute(new Int8Array(geo.attributes.position.count * 4), 4));
  },
  resolution(height, rt) { this.height.value = Math.max(1, height); this.enabled.value = rt ? 0 : 1; },
  shader(sh, mat) {
    if (!this.materials.has(mat)) return;
    sh.uniforms.lzThinHeight = this.height; sh.uniforms.lzThinEnabled = this.enabled;
    sh.vertexShader = 'attribute vec4 thinData; uniform float lzThinHeight; uniform float lzThinEnabled;\n' + sh.vertexShader;
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      if(thinData.w>0.0 && lzThinEnabled>0.5){
        float radius=thinData.w*0.0005;
        float depth=-(modelViewMatrix*vec4(position,1.0)).z;
        float pixel=2.0*max(0.0,depth)/(projectionMatrix[1][1]*lzThinHeight);
        float extra=max(0.0,pixel*0.55-radius);
        transformed+=thinData.xyz*(extra/16.0);
      }`);
  }
};
})();
