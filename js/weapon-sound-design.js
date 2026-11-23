// Original weapon reports. The browser fallback and offline asset builder use
// this same deterministic pressure/noise model; no recorded shot is an input.
(function (root, factory) {
  const catalog = typeof module === 'object' && module.exports ? require('./weapon-catalog.js') : root.G?.WeaponCatalog;
  const design = factory(catalog);
  if (typeof module === 'object' && module.exports) module.exports = design;
  else (root.G = root.G || {}).WeaponSound = design;
})(typeof globalThis === 'object' ? globalThis : this, function (catalog) {
  'use strict';
  // 저음·중음·파열음·감쇠·세 대역 비중·반사 간격·잔향·조작음 공명 주파수. 30종을 각각 조율한다.
  const signatures = {
    ar7:[180,1700,7300,.052,1.30,.95,.72,14,.15,1480,'짧고 단단한 소총'],
    ka47:[135,900,5100,.078,.82,1.26,1.10,29,.23,880,'낮고 거친 소총'],
    sc17:[104,1200,6000,.089,1.04,1.42,.88,24,.27,1120,'무거운 강철 소총'],
    mk14:[160,2900,8500,.075,1.42,1.03,.96,33,.24,2120,'밝은 장거리 소총'],
    kr98:[91,2100,7400,.125,1.42,1.55,.84,46,.40,970,'긴 볼트액션 압력음'],
    s12:[110,650,4100,.102,.78,1.50,1.24,37,.28,750,'넓고 묵직한 산탄'],
    m1014:[170,1500,6200,.081,1.20,1.13,.86,20,.21,1510,'날카로운 반자동 산탄'],
    db2:[82,410,3200,.142,.82,1.72,1.32,42,.35,610,'낮고 긴 더블배럴'],
    sa12:[145,1000,5200,.072,.91,1.25,1.40,18,.20,1290,'거친 가스 작동 산탄'],
    aa12:[220,1300,4000,.048,.92,1.38,1.12,12,.14,1800,'짧은 자동 산탄 타격'],
    p92:[290,2200,7900,.035,1.35,.58,.72,10,.12,2740,'건조한 9mm 파열'],
    g18:[365,3700,9300,.028,1.45,.44,.54,7,.085,3370,'짧은 자동권총 파열'],
    m1911:[165,740,4900,.062,.86,1.26,.94,17,.19,1390,'속이 빈 중저음 권총'],
    de7:[92,1800,7000,.118,1.23,1.65,1.18,35,.33,1060,'큰 구경의 압력음'],
    r45:[185,1650,6600,.088,1.12,1.23,1.35,26,.27,1770,'실린더 배기와 금속음'],
    mp9:[260,2450,8100,.038,1.32,.64,.78,11,.12,2870,'가벼운 금속성 연사'],
    v45:[155,1100,5700,.029,.96,1.21,.88,8,.10,1650,'낮고 빠른 연사'],
    cx9:[325,3100,9000,.031,1.46,.53,.61,9,.11,3150,'촘촘하고 밝은 연사'],
    sm45:[125,680,4500,.065,.78,1.39,1.06,19,.19,1210,'느리고 무거운 연사'],
    ar416:[200,2350,7800,.056,1.38,1.02,.82,16,.17,1930,'맑고 단단한 작동음'],
    sg56:[145,1600,6000,.070,1.05,1.26,1.14,25,.23,1180,'긴 총열의 중음 파열'],
    ms56:[235,900,6500,.053,1.18,.98,1.20,13,.16,2320,'짧은 불펍 공명'],
    lm86:[175,2200,6900,.057,1.20,1.18,1.01,17,.19,1570,'묵직한 경기관총'],
    rk762:[115,800,4800,.087,.86,1.50,1.16,30,.28,820,'거친 7.62mm 연사'],
    mg60:[85,1300,5900,.094,1.10,1.65,1.25,28,.30,1020,'급탄식 기관총의 무게감'],
    sr25:[125,2550,8000,.085,1.36,1.28,.90,32,.27,1690,'선명한 지정사수 소총'],
    dm56:[195,3200,9000,.066,1.50,.93,.91,23,.21,2460,'가늘고 빠른 정밀 사격'],
    m24:[75,2100,7800,.135,1.47,1.64,.92,49,.43,910,'긴 저격총 잔향'],
    sp12:[120,950,5300,.104,.95,1.46,1.16,34,.29,1160,'강한 펌프 산탄'],
    p226:[310,2900,8600,.042,1.43,.63,.86,12,.14,3010,'밝은 슬라이드 권총']
  }, profiles={};
  for(const [id,v] of Object.entries(signatures))profiles[id]={body:v[0],bark:v[1],crack:v[2],decay:v[3],balance:v.slice(4,7),space:v[7],room:v[8],handle:v[9],tag:v[10]};
  function random(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function seedOf(id, take) {
    let seed = 0x8429A23F;
    for (const c of id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
    return seed ^ Math.imul(take + 1, 0x45d9f3b);
  }
  function noise(n, rng) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = rng() * 2 - 1;
    return out;
  }
  // RBJ biquads, used only on newly generated pressure/noise.
  function filter(input, sr, type, frequency, q = .707) {
    const w = 2 * Math.PI * Math.min(frequency, sr * .44) / sr, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2;
    if (type === 'low') { b0 = (1-c)/2; b1 = 1-c; b2 = b0; }
    else if (type === 'high') { b0 = (1+c)/2; b1 = -(1+c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1+a, a1 = -2*c/a0, a2 = (1-a)/a0;
    b0 /= a0; b1 /= a0; b2 /= a0;
    const out = new Float32Array(input.length);
    let x1=0, x2=0, y1=0, y2=0;
    for (let i=0;i<input.length;i++) {
      const x=input[i], y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;
      out[i]=y; x2=x1; x1=x; y2=y1; y1=y;
    }
    return out;
  }
  function envelope(layer, sr, attack, decay, gain, delay = 0) {
    let energy=0;
    const sample=Math.min(layer.length, Math.ceil(decay*sr));
    for(let i=0;i<sample;i++) energy+=layer[i]*layer[i];
    const scale=gain / Math.max(1e-8, Math.sqrt(energy / sample));
    for(let i=0;i<layer.length;i++) {
      const t=i/sr-delay;
      layer[i]*=t<0?0:scale*(1-Math.exp(-t/attack))*Math.exp(-t/decay);
    }
    return layer;
  }
  function diffuse(input, sr, spacing, decay, side) {
    const out=new Float32Array(input.length);
    for(const [j,ratio] of [1.0,1.173,1.397,1.617].entries()) {
      const delay=Math.round(sr*(spacing*ratio + side*(j%2?.0007:-.0005)));
      const feedback=Math.exp(-3*delay/sr/decay), line=new Float32Array(delay);
      let at=0, low=0;
      for(let i=0;i<input.length;i++) {
        const v=line[at]; low+=.27*(v-low);
        line[at]=input[i]+low*feedback;
        out[i]+=v*.25; if(++at===delay)at=0;
      }
    }
    return out;
  }
  function generate(id, take=0, perspective='own', sr=44100) {
    const p=profiles[id]; if(!p)throw Error('Unknown weapon report: '+id);
    if(!Number.isFinite(sr)||sr<16000||sr>192000)throw Error('Unsupported report sample rate');
    const rng=random(seedOf(id,take)), variation=1+(rng()-.5)*.055;
    const far=perspective==='far', near=perspective==='near';
    const duration=Math.max(.28,p.decay*5.4+.10)+(far?.44:near?.10:0);
    const n=Math.ceil(duration*sr), lead=Math.ceil(.002*sr), count=n-lead;
    const white=noise(count,rng), other=noise(count,rng), vent=noise(count,rng);
    const crack=envelope(filter(filter(white,sr,'high',p.crack*.38),sr,'low',p.crack),sr,.00008,.0027*variation,p.balance[0]*(far?.24:1));
    const body=envelope(filter(other,sr,'band',p.body*variation,.82),sr,.0010,p.decay*variation,p.balance[1],.0012);
    const bark=envelope(filter(vent,sr,'band',p.bark*variation,1.05),sr,.00035,p.decay*.31,p.balance[2]);
    const gas=envelope(filter(other,sr,'low',1100),sr,.004,p.decay*1.12,.30,.003);
    const chamber=envelope(filter(vent,sr,'band',p.bark*.58,1.9),sr,.0003,.012,.16,.019+p.space*.00013);
    const dry=new Float32Array(n);
    // 짧은 압력파 뒤에 독립적인 몸통·총구 가스·약실 공명을 둔다. 이전의 강한 포화를 피한다.
    const pressureTime=.00065*(180/p.body)**.28;
    for(let i=0;i<count;i++) {
      const t=i/sr, u=t/pressureTime;
      const front=(1-u)*Math.exp(-u)*p.balance[0]*1.4;
      const x=crack[i]*.62+body[i]*.42+bark[i]*.34+gas[i]*.25+chamber[i]+front;
      dry[i+lead]=x/(1+.15*Math.abs(x));
    }
    // The revolver's cylinder gap contributes a second short, diffuse vent.
    if(id==='r45')for(let i=Math.ceil(.004*sr);i<n;i++)dry[i]+=dry[i-Math.ceil(.004*sr)]*.075*Math.exp(-i/sr/.025);
    const direct=filter(filter(dry,sr,'high',42),sr,'low',far?2800:near?9400:14200);
    const reverbInput=filter(direct,sr,'low',far?1900:4300);
    const left=diffuse(reverbInput,sr,p.space/1000,p.room*(far?2.1:1),-1);
    const right=diffuse(reverbInput,sr,p.space/1000,p.room*(far?2.1:1),1);
    const wet=far?1.05:near?.38:.11;
    let peak=0, mean=0;
    for(let i=0;i<n;i++) {
      left[i]=direct[i]+left[i]*wet; right[i]=direct[i]+right[i]*wet;
      mean+=(left[i]+right[i])*.5;
    }
    mean/=n;
    const fade=Math.ceil(.025*sr);
    for(let i=0;i<n;i++) {
      const gain=i>n-fade?((n-i)/fade)**2:1;
      left[i]=i<lead?0:(left[i]-mean)*gain; right[i]=i<lead?0:(right[i]-mean)*gain;
      peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
    }
    const scale=(far?.76:.84)/Math.max(peak,1e-8);
    for(let i=0;i<n;i++) {left[i]*=scale;right[i]*=scale;}
    return {left,right,sampleRate:sr,duration:n/sr};
  }
  function handling(id,name,sr=44100){
    const p=profiles[id];if(!p)throw Error('알 수 없는 조작음: '+id);
    const seed=seedOf(id+':'+name,17),rng=random(seed),close=/close|magin|down|port/.test(name),duration=name==='dry'?.065:close?.16:.21;
    const n=Math.ceil(duration*sr),raw=noise(n,rng),click=envelope(filter(raw,sr,'high',1400),sr,.0003,.008,close?.30:.18);
    const body=envelope(filter(raw,sr,'band',p.handle,.85),sr,.001,close?.023:.034,.27);
    const rattle=envelope(filter(noise(n,rng),sr,'band',p.handle*1.8,1.6),sr,.001,.022,.13,close?.013:.028);
    const out=new Float32Array(n);let peak=0;
    for(let i=0;i<n;i++){out[i]=Math.tanh((click[i]+body[i]+rattle[i])*.28);peak=Math.max(peak,Math.abs(out[i]))}
    for(let i=0;i<n;i++)out[i]*=.6/Math.max(peak,1e-8)*Math.min(1,(n-i)/(sr*.018));
    return {mono:out,sampleRate:sr,duration:n/sr};
  }
  return { version:2, edition:84, source:'original-pressure-transient-v2', variants:4, profiles, generate, handling, filter };
});
