// v84 총성 재생성·조작음 재가공. 원본 조작음은 고정 커밋에서 읽어 중복 가공을 피한다.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync,execFileSync}=require('child_process');
const D=require('../js/weapon-sound-design.js');
const catalog=require('../js/weapon-catalog.js');
const root=path.resolve(__dirname,'..'),audio=path.join(root,'assets/audio/weapons');
const out=path.resolve(process.argv[2]||audio),sr=44100;
const source='83563f6eecc062ca3b4f07196f51840a19434bf2';
const read=file=>execFileSync('git',['show',source+':assets/audio/weapons/'+file],{cwd:root,maxBuffer:32*1024*1024});
const manifest=JSON.parse(read('manifest.json').toString()),decoded=new Map();
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex').slice(0,12);
function encode(file,pcm,channels,rate){
 const result=spawnSync('ffmpeg',['-v','error','-y','-f','f32le','-ar',String(sr),'-ac',String(channels),'-i','-','-codec:a','libmp3lame','-b:a',rate,path.join(out,file)],{input:pcm,maxBuffer:32*1024*1024});
 if(result.status!==0)throw Error(result.stderr.toString());return sha(fs.readFileSync(path.join(out,file)));
}
function original(bank){
 if(!decoded.has(bank.path)){
  const result=spawnSync('ffmpeg',['-v','error','-i','-','-f','f32le','-ar',String(sr),'-ac','1','-'],{input:read(bank.path),maxBuffer:32*1024*1024});
  if(result.status!==0)throw Error(result.stderr.toString());const data=new Float32Array(result.stdout.length/4);
  for(let i=0;i<data.length;i++)data[i]=result.stdout.readFloatLE(i*4);decoded.set(bank.path,data);
 }return decoded.get(bank.path);
}
function remakeHandling(id,bank){
 const p=D.profiles[id],data=original(bank),pieces=[Buffer.alloc(Math.round(.2*sr)*4)],cues={};let frames=Math.round(.2*sr);
 for(const [name,cue]of Object.entries(bank.cues)){
  if(name==='near'||name==='far')continue;
  const a=Math.max(0,Math.floor(cue.offset*sr)),b=Math.min(data.length,Math.ceil((cue.offset+cue.duration)*sr)),raw=data.subarray(a,b);let peak=0;
  for(const x of raw)peak=Math.max(peak,Math.abs(x));let onset=0;while(onset<raw.length&&Math.abs(raw[onset])<peak*.10)onset++;
  const start=Math.max(0,onset-Math.round(.002*sr)),speed=.94+(p.handle%211)/211*.10,n=Math.max(Math.round(.055*sr),Math.min(Math.round(.28*sr),Math.ceil((raw.length-start)/speed)));
  const input=new Float32Array(n);for(let i=0;i<n;i++){const at=start+i*speed,j=Math.floor(at),k=at-j;input[i]=(raw[j]||0)*(1-k)+(raw[j+1]||0)*k}
  const dry=D.filter(D.filter(input,sr,'high',105),sr,'low',Math.min(10000,p.handle*2.8+2200)),body=D.filter(dry,sr,'band',p.handle*.58,.75),detail=D.handling(id,name,sr).mono;
  const mixed=new Float32Array(n);peak=0;
  for(let i=0;i<n;i++){mixed[i]=Math.tanh((dry[i]*.82+body[i]*.48+(detail[i]||0)*.24)*1.15);peak=Math.max(peak,Math.abs(mixed[i]))}
  for(let i=0;i<n;i++)mixed[i]*=.68/Math.max(peak,1e-8)*Math.min(1,i/(sr*.0005))*Math.min(1,(n-i)/(sr*.014));
  cues[name]={offset:frames/sr,duration:n/sr};pieces.push(Buffer.from(mixed.buffer),Buffer.alloc(Math.round(.2*sr)*4));frames+=n+Math.round(.2*sr);
 }
 const file=id+'-handling-v'+D.edition+'.mp3';return {path:file,sha:encode(file,Buffer.concat(pieces),1,'96k'),cues,source:'CC0 recorded contacts + original contact layers v84',sourceCommit:source};
}
fs.mkdirSync(out,{recursive:true});
for(const [id,entry]of Object.entries(catalog)){
  if(!manifest.weapons[id])manifest.weapons[id]=JSON.parse(JSON.stringify(manifest.weapons[entry.audioBase]));
  const w=manifest.weapons[id];w.handleRate=1;
  w.mix={...w.mix,handling:entry.stats.family==='lmg'?.94:.82};
  if(entry.motion.action)w.mix.action=entry.motion.action;else delete w.mix.action;
}
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
  const file=id+'-report-v'+D.edition+'.mp3';
  w.shot={path:file,sha:encode(file,Buffer.concat(pieces),2,'160k'),cues,source:D.source};
  w.fx=remakeHandling(id,w.fx);w.rate=w.handleRate=1;
  w.mix={...w.mix,shot:D.profiles[id].body<130?.90:.84,handling:w.mix?.handling||.80};
  for(const name of ['own','near','far'])delete w.src[name];
  w.src.report='Original synthesis: js/weapon-sound-design.js';
  w.src.handling='CC0 조작음 재가공 · 고정 원본 '+source.slice(0,7);
  console.log(id,D.profiles[id].tag);
}
manifest.edition=D.edition;manifest.source='새 압력파 총성·총기별 CC0 조작음 재가공 v84';
manifest.design={generator:'js/weapon-sound-design.js',generatorSha:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'js/weapon-sound-design.js'))).digest('hex').slice(0,12),catalogSha:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'js/weapon-catalog.js'))).digest('hex').slice(0,12),generatorVersion:D.version,variants:D.variants,recordedShotInputs:0,tool:'tools/build-original-weapon-audio.cjs'};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,1)+'\n');
