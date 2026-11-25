// 실제 렌더 프레임을 휴대폰에서 비교하기 쉬운 위/아래 1배속 영상으로 합친다.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(process.env.THROW_SHOTS||'/tmp/lz-v98-video'),out=path.resolve(process.env.THROW_VIDEO||'/workspace/artifacts/v98-throwable-comparison.mp4'),font='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc';
const names={frag:'수류탄',molotov:'화염병',smoke:'연막탄',flash:'섬광탄','air-smoke':'위로 던진 연막탄'};
const reports=Object.fromEntries(['before','after'].map(mode=>[mode,JSON.parse(fs.readFileSync(path.join(root,mode+'.json')))])),clips=[];
for(const [kind,name]of Object.entries(names)){
 const fps=kind==='air-smoke'?15:30,args=['-y','-hide_banner','-loglevel','error'];
 for(const mode of ['before','after'])args.push('-framerate',String(fps),'-i',path.join(root,mode+'-'+kind,'%04d.png'));
 const filters=[];
 for(const [i,mode]of ['before','after'].entries()){
  const label=path.join(root,mode+'-'+kind+'.txt'),height=kind==='air-smoke'?' · 첫 분사 '+reports[mode].smoke.first.height.toFixed(1)+'m':'';
  fs.writeFileSync(label,(mode==='before'?'변경 전 v97':'변경 후 v98')+'  |  '+name+height);
  filters.push('['+i+':v]fps=30,pad=720:450:0:40:color=0x17222d,drawtext=fontfile='+font+':textfile='+label+':fontsize=20:fontcolor=white:x=18:y=7[p'+i+']');
 }
 filters.push('[p0][p1]vstack=inputs=2[v]');const clip=path.join(root,'compare-'+kind+'.mp4');args.push('-filter_complex',filters.join(';'),'-map','[v]','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',clip);cp.execFileSync('ffmpeg',args);clips.push(clip);
}
const list=path.join(root,'concat.txt');fs.writeFileSync(list,clips.map(p=>"file '"+p.replace(/'/g,"'\\''")+"'").join('\n')+'\n');fs.mkdirSync(path.dirname(out),{recursive:true});cp.execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',out]);
cp.execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-ss','1.2','-i',out,'-frames:v','1','-q:v','2',out.replace(/\.mp4$/,'.jpg')]);
const probe=JSON.parse(cp.execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',out],{encoding:'utf8'}));fs.writeFileSync(path.join(root,'video.json'),JSON.stringify({file:out,duration:probe.format.duration,streams:probe.streams.map(s=>({codec:s.codec_name,width:s.width,height:s.height,rate:s.r_frame_rate,frames:s.nb_frames})),before:reports.before.smoke,after:reports.after.smoke},null,2)+'\n');console.log('PASS 비교 영상',out,probe.format.duration+'초');
