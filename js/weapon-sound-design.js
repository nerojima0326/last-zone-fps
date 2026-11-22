// Original weapon reports. The browser fallback and offline asset builder use
// this same deterministic pressure/noise model; no recorded shot is an input.
(function (root, factory) {
  const design = factory();
  if (typeof module === 'object' && module.exports) module.exports = design;
  else (root.G = root.G || {}).WeaponSound = design;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  // body Hz, bark Hz, crack Hz, body decay seconds, crack/body/bark balance,
  // reflection spacing ms, diffuse decay seconds. These are different acoustic
  // signatures, not pitch shifts of one shared sound.
  const profiles = {
    ar7:   { body: 210, bark: 2200, crack: 6800, decay: .046, balance: [1.1,.82,.60], space: 17, room: .16, tag: 'tight sharp rifle' },
    ka47:  { body: 155, bark: 760,  crack: 3900, decay: .071, balance: [.78,1.1,1.00], space: 27, room: .22, tag: 'wooden midrange bark' },
    sc17:  { body: 135, bark: 1250, crack: 5400, decay: .082, balance: [1.0,1.2,.86], space: 23, room: .26, tag: 'heavy steel rifle' },
    mk14:  { body: 235, bark: 3100, crack: 8100, decay: .064, balance: [1.25,.92,.88], space: 31, room: .21, tag: 'bright long rifle crack' },
    kr98:  { body: 118, bark: 1850, crack: 7200, decay: .115, balance: [1.35,1.2,1.05], space: 43, room: .39, tag: 'long bolt rifle report' },
    s12:   { body: 145, bark: 530,  crack: 4500, decay: .093, balance: [.72,1.3,1.12], space: 35, room: .27, tag: 'wide shotgun blast' },
    m1014: { body: 190, bark: 1120, crack: 6200, decay: .066, balance: [1.02,1.12,.82], space: 21, room: .19, tag: 'compact shotgun slam' },
    db2:   { body: 102, bark: 420,  crack: 3400, decay: .125, balance: [.85,1.42,1.20], space: 39, room: .33, tag: 'deep open barrel blast' },
    sa12:  { body: 175, bark: 920,  crack: 4800, decay: .062, balance: [.90,1.08,1.25], space: 19, room: .18, tag: 'raspy semi-auto bark' },
    aa12:  { body: 270, bark: 1450, crack: 3700, decay: .041, balance: [.80,1.23,1.12], space: 13, room: .13, tag: 'dense automatic hammer' },
    p92:   { body: 330, bark: 2700, crack: 8500, decay: .035, balance: [1.20,.60,.82], space: 11, room: .13, tag: 'dry nine millimetre clap' },
    g18:   { body: 440, bark: 3900, crack: 9700, decay: .025, balance: [1.15,.54,.68], space: 8,  room: .09, tag: 'short automatic pistol snap' },
    m1911: { body: 205, bark: 880,  crack: 5200, decay: .057, balance: [.88,1.10,.84], space: 16, room: .18, tag: 'hollow heavy pistol thock' },
    de7:   { body: 128, bark: 1600, crack: 7600, decay: .105, balance: [1.25,1.36,1.10], space: 33, room: .31, tag: 'large pistol pressure blast' },
    r45:   { body: 285, bark: 1700, crack: 6500, decay: .078, balance: [1.12,1.0,1.12], space: 25, room: .25, tag: 'raw revolver side blast' }
  };
  function random(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function seedOf(id, take) {
    let seed = 0x7519A23F;
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
    const duration=Math.max(.28,p.decay*6+.09)+(far?.55:near?.12:0);
    const n=Math.ceil(duration*sr), lead=Math.ceil(.002*sr), count=n-lead;
    const white=noise(count,rng), other=noise(count,rng);
    const crack=envelope(filter(filter(white,sr,'high',p.crack*.30),sr,'low',p.crack),sr,.00012,.0045*variation,p.balance[0]*(far?.28:1));
    const body=envelope(filter(white,sr,'band',p.body*variation,.68),sr,.0018,p.decay*variation,p.balance[1]);
    const bark=envelope(filter(other,sr,'band',p.bark*variation,.85),sr,.0005,p.decay*.42,p.balance[2]);
    const gas=envelope(filter(other,sr,'low',780),sr,.003,p.decay*.8,.24);
    const dry=new Float32Array(n);
    // A short bipolar pressure front: no periodic oscillator or bass note.
    const pressureTime=.0008*(210/p.body)**.23;
    for(let i=0;i<count;i++) {
      const t=i/sr, u=t/pressureTime;
      const front=(1-u)*Math.exp(-u)*p.balance[0]*.42;
      dry[i+lead]=Math.tanh((crack[i]+body[i]+bark[i]+gas[i]+front)*.62);
    }
    // The revolver's cylinder gap contributes a second short, diffuse vent.
    if(id==='r45')for(let i=Math.ceil(.004*sr);i<n;i++)dry[i]+=dry[i-Math.ceil(.004*sr)]*.075*Math.exp(-i/sr/.025);
    const direct=filter(filter(dry,sr,'high',55),sr,'low',far?3100:near?8200:12500);
    const reverbInput=filter(direct,sr,'low',far?1900:4300);
    const left=diffuse(reverbInput,sr,p.space/1000,p.room*(far?2.1:1),-1);
    const right=diffuse(reverbInput,sr,p.space/1000,p.room*(far?2.1:1),1);
    const wet=far?.90:near?.32:.14;
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
    const scale=(far?.78:.86)/Math.max(peak,1e-8);
    for(let i=0;i<n;i++) {left[i]*=scale;right[i]*=scale;}
    return {left,right,sampleRate:sr,duration:n/sr};
  }
  return { version:1, edition:75, variants:4, profiles, generate };
});
