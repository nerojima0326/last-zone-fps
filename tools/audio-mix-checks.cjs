// Runs against the shipped mixer and decoded banks in the game browser.
module.exports = async function checkAudioMix({ render, timing }) {
  const W = G.WeaponAudio, A = G.Audio, sr = 44100, renders = [], results = [];
  const random = Math.random; Math.random = () => .5;
  const stats = data => {
    let sum = 0, peak = 0;
    for (const v of data) { if (!Number.isFinite(v)) throw Error('Invalid PCM'); sum += v * v; peak = Math.max(peak, Math.abs(v)); }
    let attack = 0; const n = Math.min(data.length, Math.ceil(.025 * sr));
    for (let i = 0; i < n; i++) attack += data[i] * data[i];
    return { peak, rms: Math.sqrt(sum / data.length), attackRms: Math.sqrt(attack / n) };
  };
  function context(seconds, volume = 1) {
    const c = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr), comp = c.createDynamicsCompressor();
    for (const p of ['threshold', 'knee', 'ratio', 'attack', 'release']) comp[p].value = A.comp[p].value;
    comp.connect(c.destination);
    const master = c.createGain(); master.gain.value = .75; master.connect(comp);
    const verb = c.createGain(); verb.gain.value = 0; verb.connect(master);
    const clock = { currentTime: 0, sampleRate: sr };
    for (const key of ['createBufferSource', 'createBiquadFilter', 'createGain', 'createStereoPanner', 'createOscillator']) clock[key] = c[key].bind(c);
    const bus = { ctx: clock, master, verb, listener: { x: 0, y: 0, z: 0, yaw: 0 }, ok: () => true,
      volOf: () => volume, _budget: () => true, noiseBuf: A.noiseBuf, brownBuf: A.brownBuf,
      out: A.out, noise: A.noise, tone: A.tone, spatial: A.spatial };
    return { c, clock, bus };
  }
  function save(name, buffer) {
    if (!render) return;
    const pcm = new Int16Array(buffer.length * 2), left = buffer.getChannelData(0), right = buffer.getChannelData(1);
    for (let i = 0; i < buffer.length; i++) {
      pcm[i * 2] = Math.round(Math.max(-1, Math.min(1, left[i])) * 32767);
      pcm[i * 2 + 1] = Math.round(Math.max(-1, Math.min(1, right[i])) * 32767);
    }
    const bytes = new Uint8Array(pcm.buffer); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    renders.push({ name, pcm: btoa(binary) });
  }
  async function play(id, kind, volume = 1) {
    W.sequence[id] = 0; // Compare the same take with and without suppression.
    const row = timing.find(r => r.id === id && r.empty), seconds = kind === 'reload' ? row.seconds + .5 : 2.5;
    const { c, clock, bus } = context(seconds, volume);
    if (kind === 'reload') for (const event of row.events) { clock.currentTime = event.at; W.event(bus, event.type, id); }
    else if (kind === 'burst') {
      const d = G.WEAPONS[id], count = Math.min(d.mag, Math.ceil(d.rpm / 60));
      for (let i = 0; i < count; i++) {
        clock.currentTime = i * 60 / d.rpm; W.fire(bus, id, null, true);
        if (W.own.length > 4 || W.voices.length > 48) throw Error(id + ' unbounded firing voices');
      }
    } else W.fire(bus, id, null, true, kind === 'suppressed');
    const buffer = await c.startRendering(), result = stats(buffer.getChannelData(0));
    if (result.peak > .98 || volume && result.rms < .0001 || !volume && result.peak !== 0) throw Error(id + ' ' + kind + ' invalid level ' + JSON.stringify({volume,seconds,events:row.events,...result}));
    if (volume) save(id + '-' + kind, buffer);
    return result;
  }
  try {
    // The right channel leads by 40ms. A left-channel-only scan loses the crack.
    const buffer = A.ctx.createBuffer(2, sr, sr), cue = { offset: .1, duration: .15 };
    buffer.getChannelData(1).fill(.7, Math.floor(.104 * sr), Math.floor(.114 * sr));
    buffer.getChannelData(0).fill(.7, Math.floor(.144 * sr), Math.floor(.154 * sr));
    W.align(buffer, { test: cue });
    if (cue.start > .106) throw Error('Stereo transient alignment drops the leading channel');

    // A decoder-adjusted start cannot read into the neighbouring atlas cue.
    const { c, bus } = context(.12), synthetic = c.createBuffer(1, Math.ceil(.2 * sr), sr);
    synthetic.getChannelData(0).fill(.1, Math.floor(.04 * sr), Math.floor(.07 * sr));
    synthetic.getChannelData(0).fill(.9, Math.floor(.075 * sr), Math.floor(.10 * sr));
    const bank = { path: '__cue_test', cues: { first: { offset: .04, start: .06, duration: .03 } } };
    W.buffers[bank.path] = synthetic;
    W.play(bus, bank, 'first', { g: 1, pan: 0, lp: 20000, rev: 0 }, { vary: 0 });
    const isolated = await c.startRendering(); delete W.buffers[bank.path];
    // Allow the production compressor's look-ahead and filter settling. A
    // leaked second contact would still be sounding after 30ms.
    if (stats(isolated.getChannelData(0).subarray(Math.ceil(.03 * sr))).peak > .00001) throw Error('Audio cue leaks the next mechanical event');

    for (const id of G.GUN_IDS) {
      const shot = await play(id, 'shot'), burst = await play(id, 'burst'), reload = await play(id, 'reload');
      const row = { id, shot, burst, reload };
      if (!['db2', 'r45'].includes(id)) {
        row.suppressed = await play(id, 'suppressed');
        if (row.suppressed.attackRms > shot.attackRms * .7 || row.suppressed.peak > shot.peak * .8) throw Error(id + ' suppressor fails to reduce the report');
      }
      await play(id, 'shot', 0); await play(id, 'reload', 0);
      results.push(row);
    }
    const { c: zero, bus: zeroBus } = context(.5);
    const w = W.bank('ar7'); W.play(zeroBus, w.fx, 'close', { g: 1, lp: 20000, rev: 0 }, { gain: 0 });
    if (stats((await zero.startRendering()).getChannelData(0)).peak !== 0) throw Error('Explicit zero gain is ignored');

    // The synthetic backup must obey the same weapons mute setting.
    const saved = W.buffers, backup = context(.8, 0); W.buffers = {};
    try { A.click.call(backup.bus, 'magin', 'ar7'); A.shot.call(backup.bus, 'ar7', null, true); }
    finally { W.buffers = saved; }
    if (stats((await backup.c.startRendering()).getChannelData(0)).peak !== 0) throw Error('Fallback ignores weapons mute');
    await new Promise(r => setTimeout(r, 30));
    const retained=W.voices.filter(v=>v.ctx!==A.ctx);
    if (retained.length || W.own.some(v=>v.ctx!==A.ctx)) throw Error('Offline audio nodes retained after rendering: '+JSON.stringify(retained.map(v=>({role:v.role,t:v.t}))));
    return { weapons: results, stereoAttack: true, isolatedCues: true, mute: true, fallbackMute: true, cleanedUp: true, renders };
  } finally { Math.random = random; }
};
