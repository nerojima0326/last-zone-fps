// v108 검사·촬영은 과거 검증 자료를 덮어쓰거나 지울 수 없다.
const fs=require('node:fs'),path=require('node:path'),{fileURLToPath}=require('node:url');
const protectedDir=fs.realpathSync(path.resolve(__dirname,'../docs/validation'));
function protect(value){
 if(typeof value==='number')return;let p=path.resolve(value instanceof URL?fileURLToPath(value):Buffer.isBuffer(value)?value.toString():String(value)),parent=p,tail=[];
 while(!fs.existsSync(parent)){tail.unshift(path.basename(parent));const next=path.dirname(parent);if(next===parent)break;parent=next;}
 try{p=path.resolve(fs.realpathSync(parent),...tail);}catch(e){}
 if(p===protectedDir||p.startsWith(protectedDir+path.sep))throw Error('v108 검사 산출물은 저장소 밖 임시 폴더에 저장하세요: '+p);
}
if(!fs.__lzArtifactGuard){
 Object.defineProperty(fs,'__lzArtifactGuard',{value:true});
 for(const name of['writeFile','appendFile','mkdir','unlink','rm','rmdir','truncate','createWriteStream'])for(const key of[name,name+'Sync'])if(typeof fs[key]==='function'){const fn=fs[key];fs[key]=function(...args){protect(args[0]);return fn.apply(this,args);};}
 for(const name of['copyFile','rename','cp'])for(const key of[name,name+'Sync'])if(typeof fs[key]==='function'){const fn=fs[key];fs[key]=function(...args){protect(args[1]);if(name==='rename')protect(args[0]);return fn.apply(this,args);};}
 for(const key of['open','openSync']){const fn=fs[key];fs[key]=function(...args){if(typeof args[1]==='string'?/[wa+]/.test(args[1]):args[1]&(fs.constants.O_WRONLY|fs.constants.O_RDWR))protect(args[0]);return fn.apply(this,args);};}
 for(const name of['writeFile','appendFile','mkdir','unlink','rm','rmdir','truncate','copyFile','rename','cp','open'])if(fs.promises[name]){const fn=fs.promises[name];fs.promises[name]=async function(...args){if(name==='open'){if(typeof args[1]==='string'?/[wa+]/.test(args[1]):args[1]&(fs.constants.O_WRONLY|fs.constants.O_RDWR))protect(args[0]);}else{protect(args[['copyFile','cp'].includes(name)?1:0]);if(name==='rename')protect(args[1]);}return fn.apply(this,args);};}
 require('node:module').syncBuiltinESMExports();
}
module.exports={protect};
