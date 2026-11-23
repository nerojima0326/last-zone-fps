// Stable screen-door coverage: neighboring levels partition the same pixels.
// Material variants are cached per source + level, shared by all world copies.
(function(){
'use strict';
const G=window.G,T=window.THREE;
const cache=new WeakMap();
const F=G.LODFade={enabled:{value:1},eye:{value:new T.Vector3()},zoom:{value:1},clones:0,
  update(camera){if(camera)this.eye.value.copy(camera.position);this.zoom.value=Math.max(1,G.lodZoom||1)},
  shader(sh,level,radius,horizontal){
    sh.uniforms.lzFadeEnabled=this.enabled;sh.uniforms.lzFadeEye=this.eye;sh.uniforms.lzFadeZoom=this.zoom;
    if(radius)sh.uniforms.lzFadeRadius=radius;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 lzFadeEye; uniform float lzFadeZoom; varying float vLzDistance;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 lzCenter = (modelMatrix *
        #ifdef USE_INSTANCING
          instanceMatrix *
        #endif
          vec4(0.0,0.0,0.0,1.0)).xyz;
        vLzDistance = ${horizontal?'length((lzCenter-lzFadeEye).xz)':'distance(lzCenter,lzFadeEye) / lzFadeZoom'};`);
    const entry=radius?(level===0?'1.0':'smoothstep(lzFadeRadius-6.0,lzFadeRadius+6.0,vLzDistance)'):(level===0?'1.0':level===1?'smoothstep(11.0,13.0,vLzDistance)':'smoothstep(26.0,30.0,vLzDistance)');
    const exit=radius?(level===0?'smoothstep(lzFadeRadius-6.0,lzFadeRadius+6.0,vLzDistance)':'0.0'):(level===0?'smoothstep(11.0,13.0,vLzDistance)':level===1?'smoothstep(26.0,30.0,vLzDistance)':'0.0');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>\nuniform float lzFadeEnabled; ${radius?'uniform float lzFadeRadius;':''} varying float vLzDistance;`)
      .replace('#include <opaque_fragment>',`
        if(lzFadeEnabled>0.5){
          float lzNoise = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy),vec2(0.06711056,0.00583715))));
          if(lzNoise >= ${entry} || lzNoise < ${exit}) discard;
        }
        #include <opaque_fragment>`);
  },
  level(base,level){
    if(Array.isArray(base))return base.map(m=>this.level(m,level));
    let variants=cache.get(base);if(!variants){variants=new Map();cache.set(base,variants)}
    if(variants.has(level))return variants.get(level);
    const mat=base.clone(),hook=base.onBeforeCompile.bind(base),key=base.customProgramCacheKey();
    mat.onBeforeCompile=(sh,r)=>{hook(sh,r);this.shader(sh,level,null,false)};
    mat.customProgramCacheKey=()=>key+'|lod-fade-v79-'+level;
    mat.userData.fadeLevel=level;variants.set(level,mat);this.clones++;return mat;
  },
  foliage(mat,radius,near){
    const hook=mat.onBeforeCompile.bind(mat),key=mat.customProgramCacheKey();
    mat.onBeforeCompile=(sh,r)=>{hook(sh,r);this.shader(sh,near?0:1,radius,true)};
    mat.customProgramCacheKey=()=>key+'|foliage-fade-v79-'+(near?0:1);
  },
  coverage(d,level){const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};const a=smooth(11,13,d),b=smooth(26,30,d);return level===0?1-a:level===1?a-b:b}
};
})();
