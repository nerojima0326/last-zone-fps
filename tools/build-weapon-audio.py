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
 'sc17': (['B_17','B_18'], 'B_23', 'B_21', 1.04),
 'mk14': (['E_20','E_23'], 'E_22', 'E_17', 1.0),
 'kr98': (['M_20','M_22'], 'M_19', 'M_23', 1.0),
 's12':  (['O_18','O_20'], 'O_19', 'O_15', 1.0),
 'm1014':(['K_19','K_21'], 'K_20', 'K_16', 1.0),
 'db2':  (['N_27','N_29'], 'N_28', 'N_24', 0.97),
 'sa12': (['H_18','H_20'], 'H_19', 'H_15', 1.0),
 'aa12': (['H_20','H_18'], 'H_21', 'H_17', 1.06),
 'p92':  (['F_44','F_45'], 'F_46', 'F_42', 1.0),
 'g18':  (['G_26','G_32'], 'G_25', 'G_13', 1.0),
 'm1911':(['A_35','A_36'], 'A_41', 'A_39', 1.0),
 'de7':  (['L_20','L_22'], 'L_21', 'L_17', 0.97),
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
        y, n = shot(i, 1.6, True); st.append((f'own{k}', y)); log.append(f'{gid} own {i} takes={n} {len(y)/SR:.2f}s')
    sb, sm = bank(st, 2)
    h1 = enc(sb, os.path.join(OUT, f'{gid}-shot.mp3'), 2, 160)
    mono = []
    y, n = shot(near, 1.4, False); mono.append(('near', y)); log.append(f'{gid} near {near} takes={n}')
    y, n = shot(far, 2.2, False); mono.append(('far', y)); log.append(f'{gid} far {far} takes={n}')
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
