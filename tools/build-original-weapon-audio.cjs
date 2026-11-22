// New report banks from deterministic synthesis. No old firing PCM is read.
// Existing CC0 handling banks remain byte-for-byte unchanged.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const D=require('../js/weapon-sound-design.js');
const root=path.resolve(__dirname,'..'),audio=path.join(root,'assets/audio/weapons');
const out=path.resolve(process.argv[2]||audio),sr=44100;
const manifest=JSON.parse(fs.readFileSync(path.join(audio,'manifest.json'),'utf8'));
fs.mkdirSync(out,{recursive:true});
for(const [id,w]of Object.entries(manifest.weapons)){
  const samples=[];for(let take=0;take<D.variants;take++)samples.push(['own'+take,D.generate(id,take,'own',sr)]);
  for(const p of ['near','far'])samples.push([p,D.generate(id,0,p,sr)]);
  const pieces=[Buffer.alloc(Math.round(.2*sr)*8)],cues={};let frames=Math.round(.2*sr);
  for(const [name,sound]of samples){
    const pcm=new Float32Array(sound.left.length*2);
    for(let i=0;i<sound.left.length;i++){pcm[i*2]=sound.left[i];pcm[i*2+1]=sound.right[i];}
    cues[name]={offset:frames/sr,duration:sound.left.length/sr};
    pieces.push(Buffer.from(pcm.buffer),Buffer.alloc(Math.round(.2*sr)*8));frames+=sound.left.length+Math.round(.2*sr);
  }
  const file=id+'-report-v75.mp3',dest=path.join(out,file);
  const encoded=spawnSync('ffmpeg',['-v','error','-y','-f','f32le','-ar',String(sr),'-ac','2','-i','-','-codec:a','libmp3lame','-b:a','160k',dest],{input:Buffer.concat(pieces),maxBuffer:16*1024*1024});
  if(encoded.status!==0)throw Error(encoded.stderr.toString());
  w.shot={path:file,sha:crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex').slice(0,12),cues,source:'original-pressure-noise-v1'};
  for(const name of ['own','near','far'])delete w.src[name];
  w.src.report='Original synthesis: js/weapon-sound-design.js';
  // These retired firing regions are never selected from the handling atlas.
  for(const name of ['near','far'])delete w.fx.cues[name];
  console.log(id,D.profiles[id].tag);
}
manifest.edition=75;manifest.source='Original generated reports; CC0 recorded handling';
manifest.design={generator:'js/weapon-sound-design.js',generatorSha:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'js/weapon-sound-design.js'))).digest('hex').slice(0,12),generatorVersion:D.version,variants:D.variants,recordedShotInputs:0,tool:'tools/build-original-weapon-audio.cjs'};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,1)+'\n');
