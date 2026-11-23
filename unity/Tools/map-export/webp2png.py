# GLB 안의 WebP 텍스처를 PNG/JPEG 로 (유니티 glTFast 는 WebP 를 못 읽는다)
import json, struct, sys, io
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read(); L = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + L])
off = 20 + L; BL = struct.unpack('<I', b[off:off + 4])[0]; bin_ = b[off + 8: off + 8 + BL]
bvs = j['bufferViews']; repl = {}
for im in j.get('images', []):
    if im.get('mimeType') != 'image/webp': continue
    v = bvs[im['bufferView']]; data = bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    img = Image.open(io.BytesIO(data)); out = io.BytesIO()
    if img.mode in ('RGBA', 'LA') and img.getchannel('A').getextrema()[0] < 250: img.save(out, 'PNG'); im['mimeType'] = 'image/png'
    else: img.convert('RGB').save(out, 'JPEG', quality=90); im['mimeType'] = 'image/jpeg'
    repl[im['bufferView']] = out.getvalue()
for t in j.get('textures', []):
    e = t.get('extensions', {}).get('EXT_texture_webp')
    if e is not None: t['source'] = e['source']; del t['extensions']['EXT_texture_webp']
    if 'extensions' in t and not t['extensions']: del t['extensions']
for k in ('extensionsUsed', 'extensionsRequired'):
    if k in j: j[k] = [x for x in j[k] if x != 'EXT_texture_webp']
    if k in j and not j[k]: del j[k]
new = bytearray()
for i, v in enumerate(bvs):
    data = repl.get(i) or bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    while len(new) % 4: new.append(0)
    v['byteOffset'] = len(new); v['byteLength'] = len(data); v.pop('byteStride', None) if i in repl else None; new += data
while len(new) % 4: new.append(0)
j['buffers'] = [{'byteLength': len(new)}]
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(new)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(new), 0x004E4942) + bytes(new))
print(dst, len(repl), 'images converted')
