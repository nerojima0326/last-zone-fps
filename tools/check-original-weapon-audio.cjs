const assert=require('assert'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const D=require('../js/weapon-sound-design.js');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/audio/weapons/manifest.json'),'utf8'));
assert.equal(manifest.edition,D.edition);
assert.equal(manifest.design.catalogSha,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../js/weapon-catalog.js'))).digest('hex').slice(0,12),'Roster audio profiles changed without rebuilding banks');
assert.equal(manifest.design.generatorSha,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../js/weapon-sound-design.js'))).digest('hex').slice(0,12),'Report generator changed without rebuilding the banks');
assert.deepEqual(Object.keys(manifest.weapons).sort(),Object.keys(D.profiles).sort());
const hashes=new Set(),rows=[];
const hash=s=>crypto.createHash('sha256').update(Buffer.from(s.left.buffer)).update(Buffer.from(s.right.buffer)).digest('hex');
function measure(s){
 let peak=0,sum=0;
 for(let i=0;i<s.left.length;i++)for(const channel of [s.left,s.right]){
  const v=channel[i];assert(Number.isFinite(v),'Non-finite generated PCM');peak=Math.max(peak,Math.abs(v));sum+=v*v;
 }
 const onset=s.left.findIndex(v=>Math.abs(v)>.01)/s.sampleRate;
 assert(peak>.7&&peak<.87,'Generated sample peak/headroom');
 assert(onset>=0&&onset<.008,'Generated report has an audible delay');
 return {peak,rms:Math.sqrt(sum/(s.left.length*2)),duration:s.duration};
}
for(const id of Object.keys(D.profiles)){
 const levels=[];
 for(let take=0;take<D.variants;take++){
  const s=D.generate(id,take),h=hash(s),stats=measure(s);assert(!hashes.has(h),'Shared firing waveform');hashes.add(h);levels.push(stats.rms);
  assert.equal(hash(D.generate(id,take)),h,'Generation depends on prior calls');
 }
 assert(Math.max(...levels)/Math.min(...levels)<1.8,'Firing variants change volume excessively');
 for(const perspective of ['near','far']){const s=D.generate(id,0,perspective),h=hash(s);measure(s);assert(!hashes.has(h));hashes.add(h);}
 const at48=D.generate(id,0,'own',48000);measure(at48);assert(Math.abs(at48.duration-D.generate(id).duration)<1/44100,'Hardware sample rate changes duration');
 const w=manifest.weapons[id];assert.equal(w.shot.source,D.source);
 assert.equal(Object.keys(w.shot.cues).filter(n=>n.startsWith('own')).length,D.variants);
 assert(w.shot.cues.near&&w.shot.cues.far&&!w.fx.cues.near&&!w.fx.cues.far,'Firing and handling regions are mixed');
 rows.push({id,variants:D.variants,minRms:Math.min(...levels),maxRms:Math.max(...levels)});
}
console.log(JSON.stringify({weapons:rows.length,uniqueGeneratedReports:hashes.size,variants:D.variants,sourceShotInputs:0,sampleRates:[44100,48000],failures:[]},null,2));
