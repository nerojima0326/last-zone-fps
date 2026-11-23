# NaN 행렬 노드(병합된 건물 조각: 원래 단위 행렬)를 단위 행렬로
import json, struct, sys
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read(); L = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + L])
n = 0
for nd in j['nodes']:
    if 'matrix' in nd and any(v is None for v in nd['matrix']): del nd['matrix']; n += 1
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
rest = b[20 + L:]
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + len(rest)) + struct.pack('<II', len(js), 0x4E4F534A) + js + rest
open(dst, 'wb').write(out); print('fixed', n)
