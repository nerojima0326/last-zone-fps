# GLB → .gltf + 여러 .bin (각 ~15MB) + 텍스처 파일 (기기로 보낼 때 파일당 25MB 제한)
import json, struct, sys, os
src, outdir, name = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(outdir, exist_ok=True)
b = open(src, 'rb').read(); L = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + L])
off = 20 + L; BL = struct.unpack('<I', b[off:off + 4])[0]; bin_ = b[off + 8: off + 8 + BL]
bvs = j['bufferViews']; imgViews = set()
for i, im in enumerate(j.get('images', [])):
    v = bvs[im['bufferView']]; data = bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    ext = '.jpg' if im.get('mimeType') == 'image/jpeg' else '.png'
    fn = f'{name}_tex{i}{ext}'; open(os.path.join(outdir, fn), 'wb').write(data)
    imgViews.add(im['bufferView']); del im['bufferView']; im.pop('mimeType', None); im['uri'] = fn
LIMIT = 15 << 20
bufs = []; cur = bytearray(); remap = {}
newViews = []
for i, v in enumerate(bvs):
    if i in imgViews: remap[i] = None; continue
    data = bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    if len(cur) + len(data) > LIMIT and len(cur) > 0: bufs.append(cur); cur = bytearray()
    while len(cur) % 4: cur.append(0)
    nv = dict(v); nv['buffer'] = len(bufs); nv['byteOffset'] = len(cur); cur += data
    remap[i] = len(newViews); newViews.append(nv)
bufs.append(cur)
for a in j.get('accessors', []):
    if 'bufferView' in a: a['bufferView'] = remap[a['bufferView']]
j['bufferViews'] = newViews
j['buffers'] = []
for k, buf in enumerate(bufs):
    fn = f'{name}_{k}.bin'; open(os.path.join(outdir, fn), 'wb').write(buf)
    j['buffers'].append({'uri': fn, 'byteLength': len(buf)})
json.dump(j, open(os.path.join(outdir, name + '.gltf'), 'w'), separators=(',', ':'))
print('bins', len(bufs), [len(x) >> 20 for x in bufs], 'images', len(imgViews))
