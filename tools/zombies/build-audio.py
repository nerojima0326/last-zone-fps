# v109 외부 녹음 없이 신음·숨·무전·긴장 음악을 원본 합성한다.
import numpy as np, wave, subprocess, json
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'assets/zombies/audio';out.mkdir(parents=True,exist_ok=True)
work=Path('/tmp/last-zone-zombie-audio');work.mkdir(exist_ok=True);sr=22050;rng=np.random.default_rng(109)
def save(name,x):
 x=np.tanh(x)*.75;p=work/(name+'.wav')
 with wave.open(str(p),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((np.clip(x,-1,1)*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(p),'-c:a','libvorbis','-q:a','3',str(out/(name+'.ogg'))],check=True)
for name,dur,base in [('moan',2.8,74),('scream',1.9,143),('attack',.7,105),('breath',1.5,48),('step',.27,48),('radio',.3,480)]:
 t=np.arange(int(sr*dur))/sr;n=rng.normal(0,.4,len(t));smooth=np.convolve(n,np.ones(7)/7,mode='same');env=np.sin(np.pi*t/dur)**1.2
 if name=='step':x=(smooth*.8+np.sin(t*2*np.pi*base)*.25)*np.exp(-t*22)
 elif name=='radio':x=smooth*np.sin(t*2*np.pi*620)*env*.5+np.sin(t*2*np.pi*1320)*np.exp(-((t-.08)/.025)**2)*.07
 else:
  phase=np.cumsum(base*(1+.08*np.sin(t*6)+.045*smooth))/sr*2*np.pi;voice=np.zeros_like(t)
  for harmonic in range(1,22):
   f=base*harmonic;weight=np.exp(-((f-480)/180)**2)*.25+np.exp(-((f-1150)/300)**2)*.12+1/harmonic*.06;voice+=np.sin(phase*harmonic)*weight
  x=(voice*(.4 if name!='breath' else .04)+smooth*(.15 if name!='breath' else .35))*env
 save(name,x)
for idx,name in enumerate(['explore','combat','defense','escape']):
 dur=24;t=np.arange(sr*dur)/sr;x=np.zeros_like(t)
 for freq,amp in [(41.203,.12),(61.735,.07),(82.407,.05),(98,.025)]:x+=np.sin(2*np.pi*freq*t+.15*np.sin(t*.3))*amp
 x*=.55+.14*np.sin(t*2*np.pi/(8 if idx==0 else 3))
 if idx:
  period=[.8,.6,.5][idx-1];beat=(t%period);x+=(np.sin(2*np.pi*(48*beat+12*(1-np.exp(-beat*12))))*.19+rng.normal(0,.05,len(t)))*np.exp(-beat*25)
 fade=np.minimum(1,np.minimum(t/.15,(dur-t)/.15));save(name,x*fade)
(out/'credits.json').write_text(json.dumps({'author':'LAST ZONE 프로젝트','license':'CC0-1.0','source':'tools/zombies/build-audio.py','files':[p.name for p in out.glob('*.ogg')],'description':'신음·호흡·공격·발소리·무전 잡음과 4개 음악 루프를 원본 합성. 외부 음원·샘플 없음.'},ensure_ascii=False,indent=2))
