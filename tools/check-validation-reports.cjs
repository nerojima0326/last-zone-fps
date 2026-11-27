
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// v107 이후 병합 보고서에는 장전 관통 검사를 반드시 기록한다.
const fs=require('fs'),path=require('path'),assert=require('assert');
const dir=path.resolve(__dirname,'../docs/validation'),rows=[];
for(const name of fs.readdirSync(dir).filter(n=>/-merge-checks\.json$/.test(n))){
 const report=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')),version=Number(name.match(/^v(\d+)/)?.[1]||report.version||report['버전']);
 if(version<107)continue;
 const checks=report.checks||report['검사'];assert(Array.isArray(checks),name+' 검사 목록 누락');
 assert(checks.some(r=>/\bcheck-clearance\.cjs\b/.test(r.command||r['명령']||'')),name+' 필수 check-clearance 누락');rows.push(name);
}
console.log('PASS v107 이후 병합 보고서의 장전 관통 검사 포함',JSON.stringify(rows));
