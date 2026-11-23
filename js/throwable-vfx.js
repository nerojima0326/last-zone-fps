// 수류탄·화염병 전용 효과. 세 개의 인스턴스 드로와 고정 풀을 사용한다.
(function () {
'use strict';
const G=window.G,T=window.THREE,U=G.U,V=T.Vector3,obj=new T.Object3D(),up=new V(0,1,0),dir=new V(),point=new V(),normal=new V(),forward=new V(),hit={normal:new V()};
const limits={potato:[80,24,.45],low:[128,48,.65],medium:[192,72,.85],high:[256,96,1]};
const P=G.ThrowableVFX={
  ready:false,clock:0,frame:0,sprites:[],free:[],draw:[],chunks:[],marks:[],chunkIndex:0,markIndex:0,fireCalls:0,
  caps(){return limits[G.quality]||limits.medium},
  loadFire(){
    // 로딩을 기다리지 않아 시작 화면을 막지 않는다. 누락 시 내장 불꽃으로 복귀한다.
    this.fireState='loading';new T.TextureLoader().load('assets/textures/vfx/pool-fire-v85.webp',tex=>{
      tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.ClampToEdgeWrapping;G.TextureQuality?.texture(tex);
      this.spriteMaterial.uniforms.fireMap.value=tex;this.spriteMaterial.uniforms.fireReady.value=1;G.renderer?.initTexture(tex);this.fireState='ready';
    },undefined,()=>{this.fireState='fallback'});
  },
  atlas(){
    return G.Tex.canvas(512,512,c=>{
      const image=c.createImageData(512,512),d=image.data,rnd=U.mulberry32(840612);
      for(let tile=0;tile<16;tile++){
        const noise=Array.from({length:17*17},()=>rnd());
        const field=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;return U.lerp(U.lerp(noise[iy*17+ix],noise[iy*17+ix+1],fx),U.lerp(noise[(iy+1)*17+ix],noise[(iy+1)*17+ix+1],fx),fy)};
        for(let y=0;y<128;y++)for(let x=0;x<128;x++){
          const u=(x+.5)/128,v=(y+.5)/128,n=field(u*15,v*15)*.62+field(u*7,v*7)*.38,i=(((tile>>2)*128+y)*512+(tile%4)*128+x)*4;
          if(tile<8){
            const h=1-v,curve=Math.sin(h*9+tile*.82)*.16*h,width=.12+.46*Math.pow(v,.7),edge=Math.abs((u-.5)*2-curve)/width;
            const a=U.clamp((1-edge+n*.60-.23)*2.3,0,1)*U.smoothstep(0,.11,h)*U.smoothstep(0,.06,v);
            const heat=U.clamp((1-edge)*.72+v*.48-n*.15,0,1);d[i]=255;d[i+1]=Math.round(50+190*heat);d[i+2]=Math.round(6+106*heat**3);d[i+3]=Math.round(a*255);
          }else{
            const fine=field(u*11,v*11),r=Math.hypot((u-.5)*2,(v-.5)*2),a=U.clamp((1-r+n*.72+fine*.25-.53)*2.4,0,1),g=Math.round(80+n*125+fine*50);d[i]=d[i+1]=d[i+2]=g;d[i+3]=Math.round(a*(tile<12?.82:.68)*255);
          }
        }
      }c.putImageData(image,0,0);
    },{clamp:true});
  },
  init(fx){
    if(this.ready)return;this.fx=fx;
    const geo=new T.InstancedBufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0]),3));geo.setAttribute('uv',new T.BufferAttribute(new Float32Array([0,0,1,0,1,1,0,1]),2));geo.setIndex([0,1,2,0,2,3]);
    const attr=(name,n)=>{const a=new T.InstancedBufferAttribute(new Float32Array(256*n),n);a.setUsage(T.DynamicDrawUsage);geo.setAttribute(name,a);return a};
    this.positions=attr('iPos',3);this.sizes=attr('iSize',2);this.colors=attr('iColor',4);this.styles=attr('iStyle',4);
    const fog=()=>({fogColor:{value:new T.Color(0xb7cde0)},fogD:{value:.0014}});
    const atlas=this.atlas();
    this.spriteMaterial=new T.ShaderMaterial({uniforms:{map:{value:atlas},fireMap:{value:atlas},fireReady:{value:0},...fog()},transparent:true,depthWrite:false,
      vertexShader:`attribute vec3 iPos;attribute vec2 iSize;attribute vec4 iColor;attribute vec4 iStyle;varying vec2 vUv;varying vec2 vLocal;varying vec4 vColor;varying vec4 vStyle;varying float vDepth;
      void main(){vec4 mv=viewMatrix*vec4(iPos,1.);if(iStyle.z<.5){vec3 right=normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0]));mv=viewMatrix*vec4(iPos+right*position.x*iSize.x+vec3(0.,(position.y+.5)*iSize.y,0.),1.);}else{float c=cos(iStyle.y),s=sin(iStyle.y);mv.xy+=vec2(position.x*c-position.y*s,position.x*s+position.y*c)*iSize;}
      float tile=iStyle.x;vUv=(vec2(mod(tile,4.),3.-floor(tile/4.))+.015+uv*.97)/4.;vLocal=uv;vColor=iColor;vStyle=iStyle;vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`,
      // 검은 배경은 방출광이 없는 영역이다. 광량으로 알파를 구하고 곱한 상태로 보간한다.
      fragmentShader:`uniform sampler2D map;uniform sampler2D fireMap;uniform float fireReady;uniform vec3 fogColor;uniform float fogD;varying vec2 vUv;varying vec2 vLocal;varying vec4 vColor;varying vec4 vStyle;varying float vDepth;
      vec4 flame(float frame){vec2 tile=vec2(mod(frame,4.),3.-floor(frame/4.));vec4 t=texture2D(fireMap,(tile+.002+vLocal*.996)/4.);t.a*=smoothstep(.012,.24,max(t.r,max(t.g,t.b)));t.rgb/=max(t.a,.01);return t;}
      void main(){vec4 tex;
      if((vStyle.z<.5||vStyle.z>2.5)&&fireReady>.5){float frame=mod(vStyle.w,16.);vec4 a=flame(floor(frame)),b=flame(mod(floor(frame)+1.,16.));tex=mix(vec4(a.rgb*a.a,a.a),vec4(b.rgb*b.a,b.a),fract(frame));tex.rgb/=max(tex.a,.001);tex.rgb*=2.4;
      }else{vec2 uv=vUv;if(vStyle.z<.5){float y=fract(uv.y*4.),edge=floor(uv.x*4.)/4.;uv.x=clamp(uv.x+sin(y*12.+vStyle.w)*y*.012,edge+.004,edge+.246);}tex=texture2D(map,uv);}
      float a=tex.a*vColor.a*smoothstep(.08,.42,vDepth);if(vStyle.z<.5)a*=smoothstep(0.,.08,vLocal.y);if(a<.004)discard;float f=1.-exp(-fogD*fogD*vDepth*vDepth);gl_FragColor=vec4(mix(tex.rgb*vColor.rgb,fogColor,f),a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    G.renderer?.initTexture(this.spriteMaterial.uniforms.map.value);
    this.spriteMesh=new T.Mesh(geo,this.spriteMaterial);this.spriteMesh.name='투척물 불꽃·연기 풀';this.spriteMesh.frustumCulled=false;this.spriteMesh.renderOrder=5;geo.instanceCount=0;fx.scene.add(this.spriteMesh);
    for(let i=0;i<256;i++)this.free.push({p:new V(),v:new V(),age:0,life:1,w:1,h:1,w1:1,h1:1,r:1,g:1,b:1,alpha:1,kind:0,billboard:false,drag:0,lift:0,rot:0,spin:0,seed:0,depth:0});
    const groundGeo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);this.groundData=new T.InstancedBufferAttribute(new Float32Array(48*4),4);this.groundData.setUsage(T.DynamicDrawUsage);groundGeo.setAttribute('iData',this.groundData);
    this.groundMaterial=new T.ShaderMaterial({uniforms:{clock:{value:0},...fog()},transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,
      vertexShader:`attribute vec4 iData;varying vec2 vUv;varying vec4 vData;varying float vDepth;void main(){vUv=uv;vData=iData;vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);vDepth=-p.z;gl_Position=projectionMatrix*p;}`,
      fragmentShader:`uniform float clock;uniform vec3 fogColor;uniform float fogD;varying vec2 vUv;varying vec4 vData;varying float vDepth;void main(){vec2 p=(vUv-.5)*2.;float r=length(p),age=max(0.,clock-vData.x),t=age/vData.y;float n=sin(p.x*19.+vData.w)*sin(p.y*23.-vData.w)*.065+sin(p.x*37.+p.y*29.)*.025;float shape=1.-smoothstep(.55+n,1.+n,r);float a;vec3 col;
      if(vData.z<.5){a=exp(-pow((r-.73-n)*6.,2.))*(1.-t)*.34;col=vec3(.40,.32,.23);}else{a=shape*smoothstep(0.,.2,age)*min(1.,(1.-t)*4.)*.62;col=vec3(.036,.027,.018);if(vData.z<1.5){float rim=exp(-pow((r-.60-n)*12.,2.));col+=vec3(.7,.15,.018)*rim*max(0.,1.-age/9.)*.35;}}
      if(a<.003||t>=1.)discard;float f=1.-exp(-fogD*fogD*vDepth*vDepth);gl_FragColor=vec4(mix(col,fogColor,f),a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    this.groundMesh=new T.InstancedMesh(groundGeo,this.groundMaterial,48);this.groundMesh.name='먼지 고리·연료 그을음 풀';this.groundMesh.frustumCulled=false;this.groundMesh.count=0;this.groundMesh.renderOrder=1;this.groundMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);fx.scene.add(this.groundMesh);
    for(let i=0;i<48;i++)this.marks.push({active:false,p:new V(),q:new T.Quaternion(),birth:0,life:1,size:1,kind:0,seed:0});
    const shardGeo=new T.TetrahedronGeometry(.5),shardMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.28,metalness:.18});
    this.shardMesh=new T.InstancedMesh(shardGeo,shardMat,96);this.shardMesh.name='병 조각·수류탄 파편 풀';this.shardMesh.frustumCulled=false;this.shardMesh.count=0;this.shardMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);fx.scene.add(this.shardMesh);
    const white=new T.Color(0xffffff);for(let i=0;i<96;i++){this.shardMesh.setColorAt(i,white);this.chunks.push({active:false,p:new V(),probe:new V(),v:new V(),rotation:new T.Euler(),spin:new V(),scale:new V(),color:new T.Color(),floor:0,age:0,life:1})}
    this.ready=true;this.loadFire();
  },
  setFog(color,d){if(!this.ready)return;for(const m of[this.spriteMaterial,this.groundMaterial]){m.uniforms.fogColor.value.copy(color);m.uniforms.fogD.value=d}},
  birth(kind,p){
    if(!this.ready||this.sprites.length>=this.caps()[0])return null;const s=this.free.pop();if(!s)return null;
    s.p.copy(p);s.v.set(0,0,0);s.age=0;s.life=1;s.w=s.h=s.w1=s.h1=1;s.r=s.g=s.b=1;s.alpha=1;s.kind=kind;s.billboard=kind!==0;s.drag=s.lift=s.rot=s.spin=0;s.seed=Math.random()*8;s.owner=null;this.sprites.push(s);return s;
  },
  mark(p,n,size,kind,life){const m=this.marks[this.markIndex++%48];m.active=true;m.p.copy(p).addScaledVector(n,.022);m.q.setFromUnitVectors(up,n);m.size=size;m.kind=kind;m.life=life;m.birth=this.clock;m.seed=Math.random()*30;return m},
  surface(p){
    const W=G.World,y=W.ground(p.x,p.z,p.y+.10,.04,.15);if(p.y-y>1.35||p.y<y-.2)return false;
    normal.set(0,1,0);point.set(p.x,y,p.z);
    const terrain=W.heightAt(p.x,p.z);if(Math.abs(y-terrain)<.07)W.normalAt(p.x,p.z,normal);return true;
  },
  fragments(p,n,count,glass){
    const cap=this.caps()[1];for(let i=0;i<count;i++){
      const c=this.chunks[this.chunkIndex++%cap],a=Math.random()*Math.PI*2,speed=glass?U.rand(2,5):U.rand(6,15);c.active=true;c.age=0;c.life=glass?U.rand(1.5,2.7):U.rand(.8,1.7);c.p.copy(p).addScaledVector(n,.045);
      c.v.set(Math.cos(a)*speed,U.rand(glass?1:3,glass?5:11),Math.sin(a)*speed).addScaledVector(n,glass?1.7:2);c.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);c.spin.set(U.rand(-15,15),U.rand(-12,12),U.rand(-15,15));
      c.probe.copy(c.p);const size=glass?U.rand(.045,.11):U.rand(.022,.075);c.scale.set(size,glass?size*.7:size,glass?size*.16:size*.7);c.color.setHex(glass?(i%3?0x758d53:0x9f713d):(i%3?0x5d5141:0x8b8b80));c.floor=G.World.ground(p.x,p.z,p.y+.1,.03,.15);
    }
  },
  grenade(p){
    if(!this.ready)return false;G.SessionPerf?.mark('폭발');const d=G.camera.position.distanceTo(p);if(d>160)return true;
    const k=this.caps()[2]*(d>65?.45:1);this.fx.light(p,0xffb96c,1100,.24,38);
    this.fx.add.spawn({x:p.x,y:p.y+.4,z:p.z,life:.17,s0:1.8,s1:5.4,r:5.5,g:3.6,b:1.6,a:.85});
    for(let i=0;i<Math.ceil(11*k);i++){const s=this.birth(0,p);if(!s)break;const a=Math.random()*6.28;s.p.y+=.4;s.v.set(Math.cos(a)*U.rand(4,9),U.rand(2,6),Math.sin(a)*U.rand(4,9));s.w=U.rand(2,3.3);s.w1=U.rand(3.4,4.6);s.h=s.w;s.h1=s.w1;s.life=U.rand(.23,.4);s.drag=5;s.r=1.2;s.g=1;s.b=.85;s.alpha=.85;s.billboard=true;s.rot=a}
    for(let i=0;i<Math.ceil(28*k);i++){const s=this.birth(1,p);if(!s)break;const a=Math.random()*6.28,speed=U.rand(2.8,6.8);s.p.y+=U.rand(.3,.8);s.v.set(Math.cos(a)*speed,U.rand(1.3,4.3),Math.sin(a)*speed);s.w=s.h=U.rand(1,1.7);s.w1=s.h1=U.rand(4.2,6.2);s.life=U.rand(2.5,4.2);s.drag=1.4;s.lift=.3;s.r=.23;s.g=.215;s.b=.19;s.alpha=.78;s.spin=U.rand(-.35,.35)}
    if(this.surface(p)){
      const floor=point.clone(),n=normal.clone();this.mark(floor,n,12,0,.95);this.mark(floor,n,4.1,2,20);
      for(let i=0;i<Math.ceil(22*k);i++){const s=this.birth(2,floor);if(!s)break;const a=i/Math.ceil(22*k)*Math.PI*2,speed=U.rand(6,12);s.p.y+=.14;s.v.set(Math.cos(a)*speed,U.rand(.3,1.3),Math.sin(a)*speed);s.w=s.h=.85;s.w1=s.h1=3.4;s.life=U.rand(.85,1.6);s.drag=2.6;s.r=.62;s.g=.49;s.b=.34;s.alpha=.68}
    }
    this.fragments(p,up,Math.ceil(32*k),false);return true;
  },
  ignite(o,f){
    if(!this.ready)return false;const p=o.pos,n=o.contactNormal||up,d=G.camera.position.distanceTo(p),k=this.caps()[2];if(d>120)return true;
    this.fragments(p,n,Math.ceil(28*k),true);this.fx.light(p,0xffa647,190,.17,15);
    for(let i=0;i<Math.ceil(14*k);i++){const s=this.birth(0,p);if(!s)break;const a=i/14*Math.PI*2;s.v.set(Math.cos(a)*U.rand(2,4),U.rand(.5,2.5),Math.sin(a)*U.rand(2,4)).addScaledVector(n,.6);s.w=.35;s.w1=.18;s.h=.5;s.h1=.9;s.life=U.rand(.20,.5);s.drag=3;s.r=1.7;s.g=1.3;s.b=1;s.alpha=.9}
    normal.set(0,1,0);if(Math.abs(f.pos.y-G.World.heightAt(f.pos.x,f.pos.z))<.07)G.World.normalAt(f.pos.x,f.pos.z,normal);this.mark(f.pos,normal,5.4,1,20);
    for(const p of f.patches){normal.set(0,1,0);if(Math.abs(p.y-G.World.heightAt(p.x,p.z))<.07)G.World.normalAt(p.x,p.z,normal);this.mark(p,normal,1.3,1,20)}
    this.fireVisual(f);return true;
  },
  fireVisual(f){
    const v=f.visual={smoke:0,ember:0,age:0,sites:[]};
    // 바깥 점 사이의 빈 공간도 연료 불길로 채운다. 지면 조회는 점화 때 한 번만 한다.
    for(let i=0;i<f.patches.length;i++)for(let j=0;j<(i?2:1);j++){
      const p=f.pos.clone().lerp(f.patches[i],j?.95:.48);if(!i)p.copy(f.pos);
      p.y=G.World.ground(p.x,p.z,p.y+.6,.1,.9)+.03;
      const distance=Math.hypot(p.x-f.pos.x,p.z-f.pos.z),inner=j===0;
      v.sites.push({p,delay:distance*.12,w:U.rand(inner?2.1:1.6,inner?2.7:2.0),h:U.rand(inner?.85:1.2,inner?1.35:1.8),s:null,phase:Math.random()*6.28});
    }return v;
  },
  fadeFire(v){
    if(!v?.sites)return;for(const site of v.sites){const s=site.s;if(s?.owner===v){s.owner=null;s.life=Math.min(s.life,s.age+.12)}site.s=null}
  },
  fire(f,dt){
    if(!this.ready)return false;if(f.t<=0)return true;const d=G.camera.position.distanceTo(f.pos);if(d>85||this.fireCalls++>=6){this.fadeFire(f.visual);return true}
    const v=f.visual?.sites?f.visual:this.fireVisual(f),k=U.clamp(f.t/1.5,0,1),density=this.caps()[2]*(d>45?.5:1);v.age+=dt;v.smoke+=dt*2.2*density;
    for(let i=0;i<v.sites.length;i++){
      const site=v.sites[i];if(v.age<site.delay)continue;if(d>45&&i%2){const s=site.s;if(s?.owner===v){s.owner=null;s.life=Math.min(s.life,s.age+.12)}site.s=null;continue}let s=site.s;
      if(!s||s.owner!==v){s=this.birth(0,site.p);if(!s)continue;site.s=s;s.owner=v;s.life=Math.max(.05,f.t);s.p.y-=site.h*.08;s.r=1.08;s.g=1.02;s.b=1;s.alpha=.86}
      const flutter=1+Math.sin(this.clock*7.1+site.phase)*.045+Math.sin(this.clock*13+site.phase*2)*.025;
      s.w=s.w1=site.w*(1+Math.sin(this.clock*4.3+site.phase)*.035);s.h=s.h1=site.h*flutter;s.alpha=.86*k;
    }
    while(v.smoke>=1){v.smoke--;for(let i=0;i<f.patches.length;i+=3){const s=this.birth(1,f.patches[i]);if(!s)break;s.p.y+=.7;s.v.set(.24,1.1,.15);s.w=s.h=.9;s.w1=s.h1=3.0;s.life=2.8;s.drag=.15;s.lift=.14;s.r=.145;s.g=.14;s.b=.135;s.alpha=.36;s.spin=U.rand(-.15,.15)}}
    v.ember+=dt*4*density*k;while(v.ember>=1){v.ember--;const s=this.birth(3,f.patches[Math.floor(Math.random()*f.patches.length)]);if(!s)break;s.p.y+=.2;s.v.set(U.rand(-.3,.3),U.rand(1.5,3),U.rand(-.3,.3));s.w=.018;s.w1=.004;s.h=.075;s.h1=.025;s.life=.8;s.lift=-1.5;s.r=4;s.g=1.8;s.b=.3;s.alpha=.9}
    return true;
  },
  update(dt){
    if(!this.ready)return;this.clock+=dt;this.frame++;this.fireCalls=0;const caps=this.caps(),cam=G.camera;cam.getWorldDirection(forward);this.draw.length=0;
    for(let i=0;i<this.sprites.length;i++){
      const s=this.sprites[i];s.age+=dt;if(s.age>=s.life||i>=caps[0]){s.owner=null;this.free.push(s);this.sprites[i]=this.sprites.at(-1);this.sprites.pop();i--;continue}
      s.v.multiplyScalar(Math.exp(-s.drag*dt));s.v.y+=s.lift*dt;s.p.addScaledVector(s.v,dt);s.rot+=s.spin*dt;s.depth=(s.p.x-cam.position.x)*forward.x+(s.p.y-cam.position.y)*forward.y+(s.p.z-cam.position.z)*forward.z;this.draw.push(s);
    }
    this.draw.sort((a,b)=>b.depth-a.depth);let n=0;
    for(const s of this.draw){const t=s.age/s.life,fade=s.owner?U.smoothstep(0,.16,s.age)*U.clamp((s.life-s.age)/.35,0,1):U.smoothstep(0,s.kind===0?.035:.10,s.age)*U.clamp((1-t)*(s.kind===0?4:2.5),0,1),tile=s.kind===0?(Math.floor(s.age*16+s.seed)%8):8+(s.kind===2?4:0)+Math.floor(s.seed)%4;
      this.positions.setXYZ(n,s.p.x,s.p.y,s.p.z);this.sizes.setXY(n,U.lerp(s.w,s.w1,t),U.lerp(s.h,s.h1,t));this.colors.setXYZW(n,s.r,s.g,s.b,s.alpha*fade);this.styles.setXYZW(n,tile,s.rot,s.kind===0?(s.billboard?3:0):1,s.age*(11+s.seed*.14)+s.seed*2);n++;
    }this.spriteMesh.geometry.instanceCount=n;if(n||this.lastSprites)for(const a of[this.positions,this.sizes,this.colors,this.styles])a.needsUpdate=true;this.lastSprites=n;
    n=0;let queries=0,floors=0;
    for(let step=0;step<this.chunks.length;step++){
      const i=(step+this.frame*13)%this.chunks.length;
      const c=this.chunks[i];if(!c.active)continue;c.age+=dt;if(c.age>=c.life||i>=caps[1]){c.active=false;continue}
      c.v.y-=12*dt;dir.copy(c.p).addScaledVector(c.v,dt).sub(c.probe);const length=dir.length();
      // 이전 검사 위치부터 확인해 검사 예산 때문에 건너뛴 프레임의 얇은 벽도 놓치지 않는다.
      if(length>.003&&c.age<.8&&queries<12&&((i+this.frame)%2===0)){queries++;dir.divideScalar(length);const distance=G.World.rayBoxes(c.probe.x,c.probe.y,c.probe.z,dir.x,dir.y,dir.z,length+.015,hit);
        if(distance<Infinity){c.p.copy(c.probe).addScaledVector(dir,Math.max(0,distance-.015));c.v.reflect(hit.normal).multiplyScalar(.30)}else c.p.addScaledVector(c.v,dt);c.probe.copy(c.p);
      }else c.p.addScaledVector(c.v,dt);
      if(floors<4&&((i+this.frame)%8===0)){c.floor=G.World.ground(c.p.x,c.p.z,c.p.y+.06,.03,.15);floors++}
      if(c.p.y<c.floor+.008){c.p.y=c.floor+.008;c.v.y=Math.abs(c.v.y)*.23;c.v.x*=.65;c.v.z*=.65;c.spin.multiplyScalar(.6)}
      c.rotation.x+=c.spin.x*dt;c.rotation.y+=c.spin.y*dt;c.rotation.z+=c.spin.z*dt;obj.position.copy(c.p);obj.rotation.copy(c.rotation);obj.scale.copy(c.scale).multiplyScalar(Math.min(1,(c.life-c.age)/.25));obj.updateMatrix();this.shardMesh.setMatrixAt(n,obj.matrix);this.shardMesh.setColorAt(n,c.color);n++;
    }this.shardMesh.count=n;if(n){this.shardMesh.instanceMatrix.needsUpdate=true;this.shardMesh.instanceColor.needsUpdate=true}
    n=0;for(const m of this.marks){if(!m.active)continue;const age=this.clock-m.birth;if(age>=m.life){m.active=false;continue}obj.position.copy(m.p);obj.quaternion.copy(m.q);obj.scale.setScalar(m.kind===0?m.size*(.10+.90*U.clamp(age/.5,0,1)):m.size);obj.updateMatrix();this.groundMesh.setMatrixAt(n,obj.matrix);this.groundData.setXYZW(n,m.birth,m.life,m.kind,m.seed);n++}
    this.groundMesh.count=n;this.groundMaterial.uniforms.clock.value=this.clock;if(n){this.groundMesh.instanceMatrix.needsUpdate=true;this.groundData.needsUpdate=true}
  },
  reset(){
    if(!this.ready)return;for(const s of this.sprites){s.owner=null;this.free.push(s)}this.sprites.length=this.draw.length=0;for(const c of this.chunks)c.active=false;for(const m of this.marks)m.active=false;
    this.spriteMesh.geometry.instanceCount=this.shardMesh.count=this.groundMesh.count=0;this.clock=this.frame=this.fireCalls=this.lastSprites=this.chunkIndex=this.markIndex=0;
  }
};
})();
