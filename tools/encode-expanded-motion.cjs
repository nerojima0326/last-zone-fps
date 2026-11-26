// 실제 조준·장전 프레임을 1배속 전후 영상으로 합친다. FFmpeg·Noto Sans CJK 필요.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(process.env.GUN_SHOTS||'/tmp/lz-v99-motion'),out=path.resolve(process.env.GUN_VIDEO_OUT||'/workspace/artifacts/v99-gun-motion-comparison.mp4'),font='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc';
const names={mp9:'MP-9 · 손잡이 고정과 해제',ar416:'AR-416 · 탄창 교체와 볼트 멈치',mg60:'MG-60 · 급탄 덮개와 탄띠',p226:'P-226 · 슬라이드 해제'},clips=[];
const reports=Object.fromEntries(['before','after'].map(k=>[k,JSON.parse(fs.readFileSync(path.join(root,k+'-video.json')))]));
for(const[id,name]of Object.entries(names)){
 const a=reports.before.clips.find(c=>c.id===id),b=reports.after.clips.find(c=>c.id===id);if(a.frames!==b.frames)throw Error('전후 촬영 길이 불일치: '+id);
 const args=['-y','-hide_banner','-loglevel','error'],filters=[];
 for(const[i,mode]of ['before','after'].entries()){args.push('-framerate','30','-i',path.join(root,mode+'-'+id,'%04d.png'));const label=path.join(root,mode+'-'+id+'.txt');fs.writeFileSync(label,(mode==='before'?'변경 전 v98':'변경 후 v99')+' | '+name);filters.push('['+i+':v]pad=720:450:0:40:color=0x17222d,drawtext=fontfile='+font+':textfile='+label+':fontsize=18:fontcolor=white:x=15:y=8[p'+i+']');}
 filters.push('[p0][p1]vstack=inputs=2[v]');const file=path.join(root,'compare-'+id+'.mp4');args.push('-filter_complex',filters.join(';'),'-map','[v]','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',file);cp.execFileSync('ffmpeg',args);clips.push(file);
}
const list=path.join(root,'concat-v99.txt');fs.writeFileSync(list,clips.map(p=>"file '"+p.replace(/'/g,"'\\''")+"'").join('\n')+'\n');fs.mkdirSync(path.dirname(out),{recursive:true});cp.execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',out]);
cp.execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-ss','1.85','-i',out,'-frames:v','1','-q:v','2',out.replace(/\.mp4$/,'.jpg')]);
const probe=JSON.parse(cp.execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',out],{encoding:'utf8'}));fs.writeFileSync(path.join(root,'video.json'),JSON.stringify({seconds:+probe.format.duration,streams:probe.streams.map(s=>({codec:s.codec_name,width:s.width,height:s.height,fps:s.r_frame_rate,frames:s.nb_frames})),clips:reports.after.clips,base:reports.before.base},null,2)+'\n');console.log('PASS 비교 영상',out,probe.format.duration+'초');
