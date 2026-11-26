// 신규 15정의 조준·실제 장전 상태를 같은 시각에 촬영한다.
const fs=require('fs'),path=require('path'),fixture=require('./expanded-motion-fixture.cjs');
const mode=process.argv[2]||'after',out=path.resolve(process.env.GUN_SHOTS||'/tmp/lz-v99-motion'),base='d0d18317c3726787f712728b3b60a842ef77aa4e';
(async()=>{const video=process.env.GUN_VIDEO==='1',f=await fixture({base:mode==='before'?base:null,viewport:video?{width:720,height:405}:undefined}),p=f.page,report={mode,base,shots:[],clips:[],errors:f.errors};fs.mkdirSync(out,{recursive:true});try{
 const ids=process.env.GUN_IDS?.split(',')||(video?['mp9','ar416','mg60','p226']:await p.evaluate(()=>Object.keys(G.WeaponCatalog)));
 if(video&&process.env.GUN_IDS&&fs.existsSync(path.join(out,mode+'-video.json')))report.clips=JSON.parse(fs.readFileSync(path.join(out,mode+'-video.json'))).clips.filter(c=>!ids.includes(c.id));
 for(const id of ids){await p.evaluate(id=>gunStudio.select(id),id);
  if(video){const seconds=await p.evaluate(id=>1.3+G.Guns.reloadDuration(id,true)+.7,id),dir=path.join(out,mode+'-'+id),frames=Math.ceil(seconds*30);fs.mkdirSync(dir,{recursive:true});for(let i=0;i<frames;i++){await p.evaluate(t=>gunStudio.advance(t),i/30);fs.writeFileSync(path.join(dir,String(i).padStart(4,'0')+'.png'),Buffer.from(await p.evaluate(()=>gunStudio.image()),'base64'));}report.clips.push({id,frames,fps:30,seconds:frames/30,ammo:await p.evaluate(()=>G.Player.a.weapons[G.Player.a.cur].mag)});
  }else for(const[name,t]of [['hip',0],['raise',.38],['ads',.75],['take',1.8],['seat',2.65],['action',3.2]]){await p.evaluate(t=>gunStudio.advance(t),t);const file=mode+'-'+id+'-'+name+'.png';fs.writeFileSync(path.join(out,file),Buffer.from(await p.evaluate(()=>gunStudio.image()),'base64'));report.shots.push({id,name,t,file});}console.log('촬영',mode,id);}
 if(video)report.clips.sort((a,b)=>['mp9','ar416','mg60','p226'].indexOf(a.id)-['mp9','ar416','mg60','p226'].indexOf(b.id));
 fs.writeFileSync(path.join(out,mode+(video?'-video':'')+'.json'),JSON.stringify(report,null,2)+'\n');if(f.errors.length)throw Error(f.errors.join('\n'));console.log('PASS 비교 촬영',video?report.clips:report.shots.length);
 }finally{await f.close()}})().catch(e=>{console.error(e);process.exitCode=1});
