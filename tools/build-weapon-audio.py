# Free Firearm Sound Library(CC0) 마스터 트랙 → 게임용 총소리·조작음 뱅크
# 실총 녹음 → 게임 사운드 뱅크. 사용: python3 tools/build-weapon-audio.py <FreeFirearmsSFXLibrary 클론> assets/audio/weapons
# 원본: https://github.com/buddingmonkey/FreeFirearmsSFXLibrary (Master Tracks, CC0). ffmpeg·numpy 필요.
import sys, os, json, glob, subprocess, hashlib
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
# 게임 총 → Free Firearm Sound Library 마스터 트랙 (CC0)
SHOTS = {  # own(뒤에서 = 쏘는 사람 시점) 2개, near 1, far 1, rate
 'ar7':  (['D_27','D_29'], 'D_31', 'D_25', 1.0),
 'ka47': (['C_39','C_42'], 'C_25', 'C_17', 1.0),
 'sc17': (['B_17','B_18'], 'B_23', 'B_21', 1.0),
 'mk14': (['U_13','U_15'], 'U_12', 'U_16', 1.0),   # v43: SKS (반자동 소총)
 'kr98': (['M_20','M_22'], 'M_19', 'M_23', 1.0),
 's12':  (['O_18','O_20'], 'O_19', 'O_15', 1.0),
 'm1014':(['K_19','K_21'], 'K_20', 'K_16', 1.0),
 'db2':  (['N_27','N_29'], 'N_28', 'N_24', 1.0),
 'sa12': (['H_18','H_20'], 'H_19', 'H_15', 1.0),
 'aa12': (['H_20','H_18'], 'H_21', 'H_17', 1.0),   # SA-12 와 같은 녹음 → 아래 CHAR 로 크게 다르게
 'p92':  (['F_44','F_45'], 'F_46', 'F_42', 1.0),
 'g18':  (['X_38','X_40'], 'X_39', 'X_31', 1.0),   # v43: Walther PPQ (9mm 권총)
 'm1911':(['A_35','A_36'], 'A_41', 'A_39', 1.0),
 'de7':  (['L_20','L_22'], 'L_21', 'L_17', 1.0),
 'r45':  (['V_24','V_26'], 'V_25', 'V_21', 1.0),
}
# 조작음: magout, magin, open(당김/열기), close(놓음/닫힘), shell(한 발), port(약실에 한 발), dry
HANDLE = {
 'ar7':  dict(magout='D_5', magin='D_4', open='D_9', close='D_13', dry='D_16'),
 'ka47': dict(magout='C_11', magin='C_10', open='C_12', close='C_13', dry='C_7'),
 'sc17': dict(magout='D_5', magin='D_4', open='U_3', close='U_4', dry='U_6'),
 'mk14': dict(magout='G_9', magin='G_8', open='U_1', close='U_2', dry='U_6'),
 'kr98': dict(magout='W_5', magin='W_4', open='W_9', close='W_12', dry='W_13', up='W_6', down='M_7'),
 's12':  dict(open='O_4', close='O_5', shell='O_3', port='O_7', dry='O_8'),
 'm1014':dict(open='U_1', close='U_2', shell='K_3', port='K_13', dry='K_7'),
 'db2':  dict(open='H_13', close='H_1', shell='H_7', dry='H_8'),
 'sa12': dict(magout='N_11', magin='N_10', open='C_0', close='C_1', dry='N_18'),
 'aa12': dict(magout='P_7', magin='P_6', open='P_8', close='U_2', dry='P_1'),
 'p92':  dict(magout='F_5', magin='F_4', open='F_8', close='F_17', dry='F_23'),
 'g18':  dict(magout='X_5', magin='X_4', open='X_8', close='X_11', dry='X_18'),
 'm1911':dict(magout='A_5', magin='A_4', open='A_8', close='A_11', dry='A_19'),
 'de7':  dict(magout='A_5', magin='A_4', open='A_8', close='A_17', dry='A_19'),
 'r45':  dict(open='V_9', shell='V_3', magin='V_2', close='V_10', dry='V_5'),
}
EXTRA = {'switch': 'C_4'}
# v43.1: 총마다 성격을 뚜렷하게 (녹음에 직접 굽는다). 노트북·휴대폰 스피커에서도 들리도록 300 Hz~8 kHz 에서 차이를 낸다.
#  pitch: 재생 속도(음높이·길이) · peak/cut: 강조·깎는 중음 주파수와 dB · treble: 5 kHz 선반 dB
#  tail: <1 이면 잔향을 짧게 · echo: 반사음(지연 ms, 크기) · drive: 포화(dB, 묵직한 총) · thump: 저음 충격(서브우퍼용)
CHAR = {
 'ar7':  dict(pitch=1.00, peak=(2500, 6), cut=(600, -4),  treble=2,  tail=0.80, echo=(0, 0),     drive=0, thump=(0.00, 70)),
 'ka47': dict(pitch=0.90, peak=(900, 7),  cut=(3000, -5), treble=-2, tail=1.00, echo=(45, .25),  drive=3, thump=(0.15, 68)),
 'sc17': dict(pitch=0.86, peak=(700, 6),  cut=(2500, -4), treble=0,  tail=1.00, echo=(70, .30),  drive=2, thump=(0.25, 60)),
 'mk14': dict(pitch=1.08, peak=(3200, 7), cut=(800, -5),  treble=3,  tail=0.70, echo=(0, 0),     drive=0, thump=(0.15, 66)),
 'kr98': dict(pitch=0.80, peak=(1200, 6), cut=(400, -4),  treble=2,  tail=1.00, echo=(110, .35), drive=4, thump=(0.35, 55)),
 's12':  dict(pitch=0.88, peak=(500, 8),  cut=(3000, -6), treble=-3, tail=1.00, echo=(60, .30),  drive=4, thump=(0.35, 56)),
 'm1014':dict(pitch=1.06, peak=(1600, 7), cut=(400, -5),  treble=1,  tail=0.75, echo=(0, 0),     drive=2, thump=(0.20, 60)),
 'db2':  dict(pitch=0.78, peak=(350, 9),  cut=(2500, -6), treble=-4, tail=1.00, echo=(90, .35),  drive=6, thump=(0.50, 48)),
 'sa12': dict(pitch=1.03, peak=(1400, 8), cut=(4000, -5), treble=1,  tail=0.70, echo=(30, .20),  drive=3, thump=(0.20, 64)),
 'aa12': dict(pitch=0.74, peak=(450, 9),  cut=(2000, -7), treble=-5, tail=0.60, echo=(35, .30),  drive=8, thump=(0.45, 50)),
 'p92':  dict(pitch=1.12, peak=(3000, 6), cut=(700, -5),  treble=3,  tail=0.70, echo=(0, 0),     drive=0, thump=(0.00, 80)),
 'g18':  dict(pitch=1.28, peak=(4500, 8), cut=(900, -7),  treble=5,  tail=0.45, echo=(0, 0),     drive=0, thump=(0.00, 80)),
 'm1911':dict(pitch=0.94, peak=(1100, 7), cut=(3500, -4), treble=0,  tail=0.90, echo=(50, .25),  drive=3, thump=(0.12, 74)),
 'de7':  dict(pitch=0.76, peak=(600, 9),  cut=(3000, -5), treble=-1, tail=1.00, echo=(120, .40), drive=8, thump=(0.60, 44)),
 'r45':  dict(pitch=0.86, peak=(1800, 8), cut=(500, -4),  treble=3,  tail=1.00, echo=(80, .30),  drive=4, thump=(0.35, 52)),
}
def character(y, gid):
    c = CHAR[gid]; ch = y.shape[1]
    (pf, pg), (cf, cg) = c['peak'], c['cut']
    af = [f'equalizer=f={pf}:t=o:w=1.2:g={pg}', f'equalizer=f={cf}:t=o:w=1.4:g={cg}', f'treble=g={c["treble"]}:f=5000:w=0.7']
    if c['drive']: af += [f'volume={c["drive"]}dB', 'asoftclip=type=atan']
    if c['echo'][0]: af += [f'aecho=1.0:0.9:{c["echo"][0]}|{int(c["echo"][0] * 2.3)}:{c["echo"][1]}|{c["echo"][1] * .5:.3f}']
    af += [f'asetrate={int(SR * c["pitch"])}', f'aresample={SR}']
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', '-', '-af', ','.join(af), '-f', 'f32le', '-'],
                         input=(y / (np.abs(y).max() + 1e-9) * 0.5).astype(np.float32).tobytes(), capture_output=True, check=True).stdout
    z = np.frombuffer(raw, np.float32).reshape(-1, ch).copy()
    t = np.arange(len(z)) / SR
    if c['tail'] < 1:
        z *= np.where(t < 0.05, 1, np.exp(-(t - 0.05) / (0.45 * c['tail'])))[:, None]
    thump, f = c['thump']
    if thump > 0:
        k = np.argmax(np.abs(z).max(1) > np.abs(z).max() * 0.3)
        tt = np.maximum(0, t - k / SR)
        th = np.sin(2 * np.pi * f * tt * (1 - 0.25 * np.minimum(tt / 0.15, 1))) * np.exp(-tt / 0.05) * (1 - np.exp(-tt / 0.002)) * (t >= k / SR)
        z += (0.18 * thump * np.abs(z).max() * th)[:, None]
    z = fade(z, min(0.25, len(z) / SR * 0.3))
    return z / (np.abs(z).max() + 1e-9) * 0.97
SRC = sys.argv[1]; OUT = sys.argv[2]
SR = 44100
paths = {os.path.basename(p)[:-4]: p for p in glob.glob(os.path.join(SRC, 'Master Tracks', '*', '*.wav'))}

def load(i, ch=2, hp=0):
    af = ['-af', f'highpass=f={hp}:poles=2'] if hp else []
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', paths[i], '-ac', str(ch), '-ar', str(SR)] + af + ['-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()

def env(x, win):
    a = np.abs(x).max(1)
    k = max(1, int(win * SR))
    c = np.convolve(a, np.ones(k) / k, 'same')
    return c

def events(x, thr_rel, gap, win=0.004):
    e = env(x, win); pk = e.max(); on = e > pk * thr_rel
    ev = []; i = 0; n = len(e)
    while i < n:
        if on[i]:
            s = i; last = i
            while i < n and (on[i] or i - last < gap * SR):
                if on[i]: last = i
                i += 1
            ev.append((s, last, e[s:last + 1].max()))
        else: i += 1
    return ev, e

def fade(y, tail):
    n = len(y); k = min(n, int(tail * SR))
    y[n - k:] *= np.linspace(1, 0, k)[:, None] ** 2
    y[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))[:, None]
    return y

def shot(i, length, stereo, take=0):
    x = load(i, 2)
    ev, e = events(x, 0.35, 0.5, 0.002)
    ev = [v for v in ev if v[2] > e.max() * 0.5]
    s = ev[min(take, len(ev) - 1)][0]
    # 다음 총성 전까지
    nxt = [v[0] for v in ev if v[0] > s + 0.1 * SR]
    end = min(len(x), s + int(length * SR), (nxt[0] - int(0.02 * SR)) if nxt else len(x))
    y = x[max(0, s - int(0.004 * SR)):end].copy()
    if not stereo: y = y.mean(1, keepdims=True)
    y = fade(y, min(0.5, len(y) / SR * 0.5))
    return y / (np.abs(y).max() + 1e-9) * 0.97, len(ev)

LEN = {'magout': 0.35, 'magin': 0.3, 'open': 0.45, 'close': 0.3, 'shell': 0.32, 'port': 0.35, 'dry': 0.18, 'up': 0.2, 'down': 0.22, 'switch': 0.25}
def handle(i, kind):
    x = load(i, 1, 150)
    ev, e = events(x, 0.12, 0.3, 0.004)
    if not ev: raise RuntimeError('no event ' + i)
    pk = np.median([v[2] for v in ev])
    best = min(ev, key=lambda v: abs(v[2] - pk))
    s0, s1 = best[0], best[1]
    seg = e[s0:s1 + 1]; p = s0 + int(seg.argmax()); P = e[p]
    # 시작: 정점 앞 0.25초 안에서 정점의 25%를 처음 넘는 곳 (open 은 당기는 소리부터)
    back = int((0.25 if kind in ('open', 'port') else 0.08) * SR)
    w = e[max(0, p - back):p + 1]; idx = np.nonzero(w > P * 0.25)[0]
    s = max(0, p - back) + (idx[0] if len(idx) else len(w) - 1) - int(0.008 * SR)
    lim = min(len(x), s + int(LEN.get(kind, 0.3) * SR)); j = p
    while j < lim and (e[j] > P * 0.012 or j < p + int(0.1 * SR)): j += 1
    y = x[max(0, s):min(lim, j + int(0.04 * SR))].copy()
    y = fade(y, min(0.06, len(y) / SR * 0.3))
    return y / (np.abs(y).max() + 1e-9) * 0.9, len(ev)

def enc(y, path, ch, kbps):
    y16 = np.clip(y, -1, 1)
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', '-', '-b:a', f'{kbps}k', path], input=y16.astype(np.float32).tobytes(), check=True)
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()

def bank(cues, ch, gap=0.25):
    pad = np.zeros((int(gap * SR), ch), np.float32)
    parts = [pad]; meta = {}; t = gap
    for name, y in cues:
        meta[name] = {'offset': round(t, 4), 'duration': round(len(y) / SR, 4)}
        parts += [y.astype(np.float32), pad]; t += len(y) / SR + gap
    return np.concatenate(parts), meta

os.makedirs(OUT, exist_ok=True)
man = {'schema': 2, 'sampleRate': SR, 'source': 'The Free Firearm Sound Library (CC0 1.0) master tracks', 'weapons': {}}
log = []
for gid in SHOTS:
    own, near, far, rate = SHOTS[gid]
    st = [];
    for k, i in enumerate(own):
        y, n = shot(i, 1.6, True); y = character(y, gid); st.append((f'own{k}', y)); log.append(f'{gid} own {i} takes={n} {len(y)/SR:.2f}s')
    sb, sm = bank(st, 2)
    h1 = enc(sb, os.path.join(OUT, f'{gid}-shot.mp3'), 2, 160)
    mono = []
    y, n = shot(near, 1.4, False); y = character(y, gid); mono.append(('near', y)); log.append(f'{gid} near {near} takes={n}')
    y, n = shot(far, 2.2, False); y = character(y, gid); mono.append(('far', y)); log.append(f'{gid} far {far} takes={n}')
    for ev, i in HANDLE[gid].items():
        y, n = handle(i, ev); mono.append((ev, y)); log.append(f'{gid} {ev} {i} takes={n} {len(y)/SR:.2f}s')
    mb, mm = bank(mono, 1)
    h2 = enc(mb, os.path.join(OUT, f'{gid}-fx.mp3'), 1, 112)
    man['weapons'][gid] = {'rate': rate, 'shot': {'path': f'{gid}-shot.mp3', 'sha': h1[:12], 'cues': sm}, 'fx': {'path': f'{gid}-fx.mp3', 'sha': h2[:12], 'cues': mm}, 'src': {'own': own, 'near': near, 'far': far, **HANDLE[gid]}}
for ev, i in EXTRA.items():
    y, n = handle(i, ev); b, m = bank([(ev, y)], 1); h = enc(b, os.path.join(OUT, f'{ev}.mp3'), 1, 96)
    man[ev] = {'path': f'{ev}.mp3', 'sha': h[:12], 'cues': m, 'src': i}
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print('\n'.join(log))
