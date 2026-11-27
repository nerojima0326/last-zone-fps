// v107 검사 파일을 빠짐없이 순차 실행하고 산출물은 저장소 밖에 기록한다.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.CHECK_OUT||path.join(os.tmpdir(),'last-zone-checks-'+Date.now()));
if(out===root||out.startsWith(root+path.sep))throw Error('검사 산출물 폴더는 저장소 밖으로 지정하세요.');
fs.mkdirSync(out,{recursive:true});
const files=fs.readdirSync(__dirname).filter(f=>/^check-.*\.(cjs|mjs)$/.test(f)).sort();
if(!files.includes('check-clearance.cjs'))throw Error('필수 장전 관통 검사가 없습니다.');
const only=process.env.CHECK_ONLY?.split(','),selected=only?files.filter(f=>only.includes(f)):files,results=[];
if(only&&selected.length!==only.length)throw Error('알 수 없는 검사 이름입니다.');
const extra={'check-m4-model.mjs':['assets/models/viewmodels/m4_animations.zip'],'check-glock-import.mjs':['assets/models/viewmodels/glock17.fbx']};
const chrome=process.env.CHROME_BIN||['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
const env={...process.env,THREE_DIR:process.env.THREE_DIR||path.join(root,'node_modules/three'),...(chrome?{CHROME_BIN:chrome}:{})};
function save(){
 const report={version:fs.readFileSync(path.join(root,'version.txt'),'utf8').trim(),complete:results.length===selected.length,scope:only?'선택 검사':'전체 검사',checks:results};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(out,'results.md'),'| 검사 | 결과 | 시간(초) | 이유 |\n|---|---|---:|---|\n'+results.map(r=>`| ${r.name} | ${r.status} | ${r.seconds} | ${r.reason.replace(/\|/g,'/').replace(/\n/g,' ')} |`).join('\n')+'\n');
}
(async()=>{
 console.log('검사 기록: '+out);
 for(const file of selected){
  const dir=path.join(out,file.replace(/\.(cjs|mjs)$/,''));fs.mkdirSync(dir,{recursive:true});
  const args=[path.join('tools',file),...(extra[file]||[])],log=path.join(dir,'console.log'),fd=fs.openSync(log,'w'),started=performance.now();let timeout=false;
  const result=await new Promise(resolve=>{
   const child=cp.spawn(process.execPath,args,{cwd:root,env:{...env,REPORT:path.join(dir,'report.json'),KNIFE_SHOTS:path.join(dir,'shots'),MOBILE_SHOTS:path.join(dir,'shots'),AIR_SHOTS_DIR:path.join(dir,'shots'),PLANE_SHOTS:path.join(dir,'shots')},stdio:['ignore',fd,fd],detached:process.platform!=='win32'});
   const timer=setTimeout(()=>{timeout=true;try{process.platform==='win32'?child.kill():process.kill(-child.pid,'SIGKILL');}catch(e){}},Number(process.env.CHECK_TIMEOUT_MS)||600000);
   child.once('error',error=>{clearTimeout(timer);resolve({code:null,error:error.message});});child.once('close',code=>{clearTimeout(timer);resolve({code});});
  });
  fs.closeSync(fd);const text=fs.readFileSync(log,'utf8'),reason=timeout?'검사 제한 시간 초과':result.error||(result.code===0?'':text.trim().split('\n').filter(l=>/Error|Timeout|FAIL|Assertion/.test(l)).slice(0,2).join(' / ')||'종료 코드 '+result.code);
  const row={name:file,command:'node '+args.join(' '),status:timeout||result.error?'못 돌림':result.code===0?'통과':'실패',exitCode:result.code,seconds:+((performance.now()-started)/1000).toFixed(1),reason,log};
  results.push(row);save();console.log(`${results.length}/${selected.length} ${row.status} ${file} (${row.seconds}초)${reason?' — '+reason:''}`);
 }
 console.log('전체 결과: '+path.join(out,'results.md'));if(results.some(r=>r.status!=='통과'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
