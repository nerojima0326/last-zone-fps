# GLB 안의 PNG 텍스처를 (투명도가 없으면) JPEG 로 바꿔 파일 크기를 줄인다
import json, struct, io, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read()
L = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + L])
off = 20 + L; BL = struct.unpack('<I', b[off:off + 4])[0]; bin_ = b[off + 8: off + 8 + BL]
bvs = j['bufferViews']; repl = {}
for im in j.get('images', []):
    v = bvs[im['bufferView']]; data = bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    if im.get('mimeType') != 'image/png': continue
    img = Image.open(io.BytesIO(data))
    if img.mode in ('RGBA', 'LA') and img.getchannel('A').getextrema()[0] < 250: continue
    out = io.BytesIO(); img.convert('RGB').save(out, 'JPEG', quality=88); repl[im['bufferView']] = out.getvalue(); im['mimeType'] = 'image/jpeg'
new = bytearray()
for i, v in enumerate(bvs):
    data = repl.get(i) or bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    while len(new) % 4: new.append(0)
    v['byteOffset'] = len(new); v['byteLength'] = len(data); new += data
while len(new) % 4: new.append(0)
j['buffers'][0]['byteLength'] = len(new)
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(new)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(new), 0x004E4942) + bytes(new)
open(dst, 'wb').write(out)
print(src, len(b) // 1024, '->', len(out) // 1024, 'KB', 'jpeg', len(repl))
