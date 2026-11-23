// 원본 불꽃 원화의 배치를 유지한 채 배포용 WebP와 출처·해시를 만든다.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),source=path.join(root,'assets/sources/vfx/pool-fire-v85.png'),out=path.resolve(process.argv[2]||path.join(root,'assets/textures/vfx'));
const data=fs.readFileSync(source),width=data.readUInt32BE(16),height=data.readUInt32BE(20),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(width!==height)throw Error('불꽃 아틀라스는 정사각형 4×4 배치여야 합니다.');
fs.mkdirSync(out,{recursive:true});const dest=path.join(out,'pool-fire-v85.webp');
cp.execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',source,'-vf','scale=1024:1024:flags=lanczos','-c:v','libwebp','-quality','92','-compression_level','6',dest]);
const compressed=fs.readFileSync(dest),manifest={version:85,file:path.basename(dest),frames:16,columns:4,rows:4,tile:256,fps:12,bytes:compressed.length,sha256:sha(compressed),source:'original-generated-flame-atlas-v1',sourceFile:'assets/sources/vfx/pool-fire-v85.png',sourceSha256:sha(data),sourceSize:[width,height]};
fs.writeFileSync(path.join(out,'pool-fire-v85.json'),JSON.stringify(manifest,null,2)+'\n');console.log('PASS 불꽃 변환',JSON.stringify(manifest));
