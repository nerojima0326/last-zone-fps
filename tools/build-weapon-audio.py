"""Build compact browser banks from the credited CC0 originals (requires ffmpeg, numpy).
Usage: python tools/build-weapon-audio.py /path/to/lz-audio-sources
The source folder contains extracted/Prepared SFX Library plus the three foley WAVs.
"""
import json,sys,subprocess,hashlib
from pathlib import Path
import numpy as np
SRC=Path(sys.argv[1]); OUT=Path(__file__).resolve().parents[1]/'assets/audio/weapons';OUT.mkdir(parents=True,exist_ok=True)
SR=44100; STRIDE=1.25
# Fictional weapons: representative recordings, not a claim of exact model/calibre capture.
SHOTS={
 'ar7':('AR-15/D_32P.wav',1.00,125,1.5,15500,.85),
 'ka47':('AK-47/C_28P.wav',.98,180,3.5,12500,.90),
 'sc17':('SKS/U_19P.wav',1.02,155,2.0,14500,.85),
 'mk14':('Marlin 336/I_22P.wav',.97,130,4.0,13500,.95),
 'kr98':('Tikka/W_29P.wav',.96,110,4.0,15000,1.05),
 's12':('Model 12/K_22P.wav',1.00,100,3.0,10500,.95),
 'm1014':('Nova/O_21P.wav',1.03,130,2.5,13000,.85),
 'db2':('Mossberg/N_30P.wav',.95,90,5.0,9500,1.05),
 'sa12':('Nova/O_21P.wav',.97,160,4.0,11000,.90),
 'aa12':('Mossberg/N_30P.wav',1.04,145,2.0,12000,.75),
 'p92':('Walther PPQ/X_39P.wav',1.02,220,-1.0,16500,.70),
 'g18':('Bersa/F_47P.wav',1.07,250,-2.0,15500,.60),
 'm1911':('1911/A_42P.wav',1.00,170,1.5,12500,.80),
 'de7':('1911/A_42P.wav',.92,110,5.0,14500,1.00),
 'r45':('Smith & Wesson 642/V_27P.wav',.97,185,3.0,14000,.85),
}
def decode(p):
 return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-ac','1','-ar',str(SR),'-f','f32le','-']),'<f4').copy()
def filter_pcm(x,chain):
 return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-af',chain,'-f','f32le','-'],input=x.astype('<f4').tobytes()),'<f4').copy()
def encode(x,name):
 p=OUT/name
 subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-b:a','96k',str(p)],input=x.astype('<f4').tobytes(),check=True)
 return {'path':name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def fade(x,attack=.0005,release=.025):
 x=x.copy();n=min(len(x)//2,max(1,round(SR*attack)));m=min(len(x)//2,max(1,round(SR*release)));x[:n]*=np.linspace(0,1,n);x[-m:]*=np.linspace(1,0,m);return x
def onsets(x):
 n=441;env=np.sqrt(np.mean(x[:len(x)//n*n].reshape(-1,n)**2,axis=1));idx=np.flatnonzero(env>env.max()*.38)
 groups=np.split(idx,np.flatnonzero(np.diff(idx)>40)+1);peaks=[int(g[np.argmax(env[g])]) for g in groups if len(g)]
 assert len(peaks)>=2,('need two independent shots',peaks)
 out=[]
 for peak in peaks[:2]:
  start=peak
  while start>0 and env[start-1]>env[peak]*.075:start-=1
  out.append(max(0,start/100-.006))
 return out
manifest={'sourceArchiveSha256':hashlib.sha256((SRC/'firearms.7z').read_bytes()).hexdigest(),'schema':1,'sampleRate':SR,'stride':STRIDE,'shots':{},'foley':{}}
for key,(source,rate,body,bass,lp,duration) in SHOTS.items():
 path=SRC/'extracted/Prepared SFX Library'/source;x=decode(path);times=onsets(x);bank=np.zeros(round(STRIDE*2*SR),dtype=np.float32);cues=[]
 for i,t in enumerate(times):
  clip=x[round(t*SR):round((t+duration)*SR)];clip=clip*(.72/max(float(np.max(np.abs(clip))),1e-8))
  chain=f'asetrate={SR*rate},aresample={SR},highpass=f=65,lowpass=f={lp},equalizer=f={body}:t=o:w=1.5:g={bass},acompressor=threshold=0.04:ratio=3:attack=0.1:release=100:makeup=3.5,alimiter=limit=0.75:level=false'
  clip=fade(filter_pcm(clip,chain));clip*=.80/max(float(np.max(np.abs(clip))),1e-8);assert len(clip)<STRIDE*SR
  pos=round(i*STRIDE*SR);bank[pos:pos+len(clip)]=clip;cues.append({'offset':i*STRIDE,'duration':len(clip)/SR})
 manifest['shots'][key]={**encode(bank,key+'.mp3'),'cues':cues,'source':source,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceOnsets':times,'filter':chain,'peak':.80,'rate':rate,'bodyHz':body,'bodyDb':bass,'lowpass':lp}
foley={
 'pistol-out':('pistol-reload.wav',.11,.30),'pistol-in':('pistol-reload.wav',.63,1.02),'pistol-close':('pistol-reload.wav',1.24,1.45),
 'rifle-out':('rifle-reload.wav',.19,.38),'rifle-in':('rifle-reload.wav',.99,1.15),'rifle-close':('rifle-reload.wav',1.19,1.39),
 'open':('pump.wav',.025,.18),'close':('pump.wav',.185,.39),'shell':('rifle-reload.wav',.44,.65),
 'dry':('rifle-reload.wav',.26,.29),'cloth':('rifle-reload.wav',.42,.57),
}
chunks=[];offset=0.;cues={}
for key,(source,start,end) in foley.items():
 x=decode(SRC/source)[round(start*SR):round(end*SR)];x=fade(x*(.65/max(float(np.max(np.abs(x))),1e-8)),.001,.012)
 cues[key]={'offset':offset,'duration':len(x)/SR,'source':source,'sourceStart':start,'sourceEnd':end,'sourceSha256':hashlib.sha256((SRC/source).read_bytes()).hexdigest()}
 chunks.extend([x,np.zeros(round(.06*SR),dtype=np.float32)]);offset+=(len(x)+round(.06*SR))/SR
manifest['foley']={**encode(np.concatenate(chunks),'foley.mp3'),'cues':cues}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Built 15 distinct two-take shot banks and physical foley bank:',sum(p.stat().st_size for p in OUT.glob('*.mp3')),'bytes')
