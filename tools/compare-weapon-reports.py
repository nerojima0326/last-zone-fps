"""Compare actual game renders. Usage: python tools/compare-weapon-reports.py OLD_WAV_DIR NEW_WAV_DIR OUTPUT_DIR
Requires numpy and ffmpeg. Produces all-weapon before/after and new-only audio.
"""
from pathlib import Path
import json,wave,subprocess,numpy as np
import sys
# RENDER_AUDIO outputs from v74 and v75; keep both at their actual game levels.
older=Path(sys.argv[1]);after=Path(sys.argv[2]);docs=Path(sys.argv[3]);docs.mkdir(parents=True,exist_ok=True);sr=44100
manifest=json.loads((Path(__file__).resolve().parents[1]/'assets/audio/weapons/manifest.json').read_text());parts=[];newparts=[];rows=[];cursor=0;newcursor=0

def load(path):
 with wave.open(str(path),'rb')as f:
  assert f.getframerate()==sr and f.getnchannels()==2
  return np.frombuffer(f.readframes(f.getnframes()),np.int16).reshape(-1,2).copy()
def features(pcm):
 x=pcm.astype(float).mean(1)/32768;idx=np.flatnonzero(abs(x)>abs(x).max()*.08);x=x[idx[0]:idx[0]+round(.20*sr)];x=np.pad(x,(0,round(.20*sr)-len(x)))
 power=abs(np.fft.rfft(x*np.hanning(len(x))))**2;freq=np.fft.rfftfreq(len(x),1/sr)
 edges=[50,150,300,600,1200,2400,4800,9600,18000]
 bands=np.array([power[(freq>=a)&(freq<b)].sum()for a,b in zip(edges,edges[1:])]);bands/=max(1e-15,bands.sum())
 return bands,float(np.sum(freq*power)/power.sum()),x
for id in manifest['weapons']:
 old=load(older/f'{id}-shot.wav');new=load(after/f'{id}-shot.wav');a,ca,x=features(old);b,cb,y=features(new)
 size=2**int(np.ceil(np.log2(len(x)*2)));corr=np.fft.irfft(np.fft.rfft(x,size)*np.conj(np.fft.rfft(y,size)),size);span=round(.008*sr);peak=max(abs(corr[:span]).max(),abs(corr[-span:]).max())/max(1e-15,np.linalg.norm(x)*np.linalg.norm(y))
 duration=1.10 if id in ['kr98','db2','de7']else.85
 old=old[:round(duration*sr)];new=new[:round(duration*sr)];pause=np.zeros((round(.28*sr),2),np.int16)
 row={'id':id,'beforeStart':round(cursor/sr,2),'afterStart':round((cursor+len(old)+len(pause))/sr,2),'spectralDistance':round(float(abs(a-b).sum()*.5),4),'oldCentroidHz':round(ca),'newCentroidHz':round(cb),'maxWaveCorrelation':round(float(peak),4),'newPreviewStart':round(newcursor/sr,2)}
 parts.extend([old,pause,new,pause]);cursor+=len(old)+len(new)+len(pause)*2
 newparts.extend([new,pause]);newcursor+=len(new)+len(pause);rows.append(row)
for name,pcm in [('v75-reports-comparison.mp3',parts),('v75-new-reports.mp3',newparts)]:
 subprocess.run(['ffmpeg','-v','error','-y','-f','s16le','-ar',str(sr),'-ac','2','-i','-','-b:a','160k',str(docs/name)],input=np.concatenate(pcm).tobytes(),check=True)
(docs/'v75-reports-comparison.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows,indent=1))
