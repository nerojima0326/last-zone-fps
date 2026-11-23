// Original procedural wall/floor wear. One shared 128px noise texture; no
// additional meshes, material copies, draw calls, or change to baked positions.
(function () {
'use strict';
const G=window.G,T=window.THREE;
const kinds={plaster:1,brick:1,concrete:1,wood:2,floor:2,metal:3,paint:3,roof:1};
const F=G.SurfaceWear={
  enabled:{value:1},texture:null,
  supports(key){return !!kinds[key]},
  init(){
    if(this.texture)return;
    const n=128,data=new Uint8Array(n*n*4),rnd=G.U.mulberry32(81076);
    for(let i=0;i<n*n;i++){const v=Math.floor(80+rnd()*175);data[i*4]=v;data[i*4+1]=Math.floor(rnd()*255);data[i*4+2]=v;data[i*4+3]=255}
    const tex=this.texture=new T.DataTexture(data,n,n,T.RGBAFormat);
    tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;
    tex.generateMipmaps=true;tex.needsUpdate=true;
  },
  edges(geo,dims){
    const a=new Uint16Array(geo.attributes.position.count*4),uv=geo.attributes.uv;
    for(let f=0;f<6;f++)for(let v=0;v<6;v++){
      const i=f*6+v,x=uv.getX(i),y=uv.getY(i),[w,h]=dims[f];
      a.set([x*w,y*h,(1-x)*w,(1-y)*h].map(d=>Math.round(Math.min(16,d)/16*65535)),i*4);
    }
    geo.setAttribute('wearEdges',new T.BufferAttribute(a,4,true));
  },
  geometry(geo,mat,building){
    if(!kinds[mat]){geo.deleteAttribute('wearEdges');return}
    const n=geo.attributes.position.count,info=new Float32Array(n);
    const base=building?.y??geo.boundingBox?.min.y??0;
    const seed=building?Math.sin(building.x*1.31+building.z*2.73)*.5+.5:.45;
    const strength=building?.tag==='b'?.65+seed*.35:.28;
    info.fill(Math.floor(base*16)*2+(kinds[mat]?strength:0));
    geo.setAttribute('surfaceInfo',new T.BufferAttribute(info,1));
    if(!geo.attributes.wearEdges){const a=new Uint16Array(n*4);a.fill(65535);geo.setAttribute('wearEdges',new T.BufferAttribute(a,4,true))}
  },
  shader(sh,key){
    if(!kinds[key])return;
    this.init();sh.uniforms.uSurfaceWear=this.enabled;sh.uniforms.uWearNoise={value:this.texture};
    sh.uniforms.uWearKind={value:kinds[key]};
    sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
      attribute vec4 wearEdges; attribute float surfaceInfo;
      varying vec4 vWearEdges; varying vec3 vWearPos; varying vec2 vSurfaceInfo; varying vec3 vWearNormal;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      vWearEdges=wearEdges*16.0;vSurfaceInfo=vec2(floor(surfaceInfo*.5)/16.0,fract(surfaceInfo*.5)*2.0);
      vWearPos=(modelMatrix*vec4(position,1.0)).xyz;vWearNormal=normalize(mat3(modelMatrix)*normal);`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      uniform float uSurfaceWear;uniform sampler2D uWearNoise;uniform float uWearKind;
      varying vec4 vWearEdges;varying vec3 vWearPos;varying vec2 vSurfaceInfo;varying vec3 vWearNormal;`)
      .replace('#include <color_fragment>',`#include <color_fragment>
      float wearDistance=1.0-smoothstep(35.0,75.0,length(cameraPosition-vWearPos));
      float wearStrength=uSurfaceWear*vSurfaceInfo.y*wearDistance;
      float wearChip=0.0;float wearDirt=0.0;
      if(wearStrength>.001){
      vec2 wearUV=abs(vWearNormal.y)>.55?vWearPos.xz:abs(vWearNormal.x)>.55?vWearPos.zy:vWearPos.xy;
      vec2 wearNoise=texture2D(uWearNoise,wearUV*.027).rg;
      float wearFine=texture2D(uWearNoise,wearUV*.38).g;
      float wearBase=exp(-max(0.0,vWearPos.y-vSurfaceInfo.x)*2.1)*(1.0-abs(vWearNormal.y));
      float wearEdge=min(min(vWearEdges.x,vWearEdges.y),min(vWearEdges.z,vWearEdges.w));
      wearChip=(1.0-smoothstep(.006,.024,wearEdge))*smoothstep(.2,.8,wearFine);
      wearDirt=wearBase*(.10+.16*wearNoise.x)+smoothstep(.56,.9,wearNoise.y)*.055;
      wearDirt+=abs(vWearNormal.y)*smoothstep(.54,.95,wearFine)*.10;
      diffuseColor.rgb*=1.0-wearDirt*wearStrength;
      diffuseColor.rgb+=vec3(.055,.048,.038)*wearChip*wearStrength*(uWearKind>2.5 ? .6 : 1.0);
      }`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+wearStrength*(wearDirt*.25-wearChip*.09),.08,1.0);`);
  }
};
})();
