// 일반 이미지 텍스처의 원근 필터링과 MSAA 알파 경계를 늦게 로딩되는 모델에도 적용한다.
(function () {
'use strict';
const G = window.G, THREE = window.THREE;
const Q = G.TextureQuality = {
  maxAnisotropy: 1, roots: new WeakMap(), covered: new WeakSet(), changed: 0,
  texture(t) {
    // 데이터·깊이·렌더 타깃은 조회 의미가 달라 이미지용 밉맵을 만들면 안 된다.
    if (!t?.isTexture || t.isDataTexture || t.isData3DTexture || t.isDataArrayTexture || t.isDepthTexture || t.isRenderTargetTexture || t.isFramebufferTexture || t.isCubeTexture || t.isVideoTexture) return;
    const mip = !t.isCompressedTexture || t.mipmaps.length > 1;
    const min = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    const generate = !t.isCompressedTexture;
    if (t.anisotropy === this.maxAnisotropy && t.minFilter === min && t.generateMipmaps === generate) return;
    t.anisotropy = this.maxAnisotropy; t.minFilter = min; t.generateMipmaps = generate;
    t.needsUpdate = true; this.changed++;
  },
  material(m) {
    for (const key in m) if (m[key]?.isTexture) this.texture(m[key]);
    if (m.uniforms) for (const u of Object.values(m.uniforms)) for (const t of [].concat(u.value)) this.texture(t);
    if (!(m.alphaTest > 0)) return;
    if (!this.covered.has(m)) {
      this.covered.add(m);
      const compile = m.onBeforeCompile, key = m.customProgramCacheKey();
      m.onBeforeCompile = function (sh, renderer) {
        compile.call(this, sh, renderer);
        // 나뭇잎 전용 셰이더는 자체 밉 보정과 알파 경계 처리를 유지한다.
        if (!this.alphaToCoverage || sh.uniforms.lzLeafAA) return;
        sh.fragmentShader = 'float lzCoverageAlpha;\n' + sh.fragmentShader;
        sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', `
          #ifdef USE_ALPHATEST
            float lzAlphaWidth=max(fwidth(diffuseColor.a),0.015);
            diffuseColor.a=smoothstep(alphaTest-lzAlphaWidth,alphaTest+lzAlphaWidth,diffuseColor.a);
            if(diffuseColor.a<0.001)discard;
          #endif
          lzCoverageAlpha=diffuseColor.a;`)
          .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor.a=lzCoverageAlpha;');
      };
      m.customProgramCacheKey = () => key + '-coverage-v81-' + m.alphaToCoverage;
    }
    const coverage = (G.msaaSamples || 0) > 0 && !G.RT?.active();
    if (m.alphaToCoverage !== coverage) { m.alphaToCoverage = coverage; m.needsUpdate = true; }
  },
  scan(root, force) {
    if (!root?.traverse) return;
    const now = performance.now();
    if (!force && now - (this.roots.get(root) || -1e9) < 500) return;
    this.roots.set(root, now);
    const materials = new Set();
    root.traverse(o => { for (const m of [].concat(o.material || [])) materials.add(m); });
    for (const m of materials) this.material(m);
  },
  init(renderer) {
    this.maxAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    const init = renderer.initTexture.bind(renderer), render = renderer.render.bind(renderer), compile = renderer.compile.bind(renderer);
    renderer.initTexture = t => { this.texture(t); return init(t); };
    renderer.render = (scene, camera) => { this.scan(scene); return render(scene, camera); };
    renderer.compile = (scene, camera, targetScene) => { this.scan(scene, true); return compile(scene, camera, targetScene); };
  }
};
})();
