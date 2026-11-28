// v109 배포 자원 전체의 크기·해시를 기록한다.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),base=path.resolve(__dirname,'../../assets/zombies');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json')));manifest.files=[];
function scan(dir){
 for(const name of fs.readdirSync(dir)){
  const file=path.join(dir,name);
  if(fs.statSync(file).isDirectory())scan(file);
  else if(name!=='manifest.json'){
   const data=fs.readFileSync(file);manifest.files.push({file:path.relative(base,file),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
  }
 }
}
scan(base);manifest.totalBytes=manifest.files.reduce((sum,f)=>sum+f.bytes,0);fs.writeFileSync(path.join(base,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('좀비 전용 자원 '+manifest.files.length+'개 · '+manifest.totalBytes+'바이트');
