# out/ → Unity Assets/LastZone/Map (raw .bytes · glb · mapinfo.json · 지형 텍스처)
import json, os, shutil, sys
O = '/home/claude/lz-export/out'; D = '/home/claude/lastzone-unity/Assets/LastZone/Map'
os.makedirs(D + '/Tex', exist_ok=True)
for f in os.listdir(O):
    s = os.path.join(O, f)
    if f.endswith('.bin'): shutil.copy(s, os.path.join(D, f[:-4] + '.bytes'))
    elif f.endswith('.png'): shutil.copy(s, os.path.join(D, f[:-4] + '_png.bytes'))
    elif f.endswith('.glb') and f != 'world.glb': shutil.copy(s, os.path.join(D, f))
m = json.load(open(O + '/meta.json'))
city = next((t for t in m['towns'] if t['type'] == 'city'), {'x': 0, 'z': 20})
info = {
  'towns': [{'name': t['name'], 'type': t['type'], 'x': t['x'], 'z': t['z'], 'r': t['r']} for t in m['towns']],
  'loot': [v for p in m['loot'] for v in (p['x'], p['y'], p['z'])],
  'veg': m['veg'], 'roads': [v for r in m['roads'] for v in (r[0], r[1], r[2], r[3], r[4], 1 if (-680 <= (r[0]+r[2])/2 <= -590 and 620 <= (r[1]+r[3])/2 <= 730) or r[0] < -570 and r[1] > 540 else 0)], 'sun': m.get('sunDir') or [0.4, 0.8, 0.4], 'spawn': [city['x'] + 6, 0, city['z'] + 6]
}
json.dump(info, open(D + '/mapinfo.json', 'w'), ensure_ascii=False)
shutil.copy(O + '/meta.json', D + '/meta.json')
T = '/home/claude/last-zone-fps/assets/tex'
for t in ['sparse_grass', 'dirt', 'coast_sand_01', 'rock_face_03', 'asphalt_02']:
    for k in ['diff', 'nor_gl']:
        shutil.copy(f'{T}/{t}/{t}_{k}_1k.jpg', f'{D}/Tex/{t}_{k}_1k.jpg')
print('towns', len(info['towns']), 'loot', len(info['loot']) // 3, 'veg', [(v['name'], v['n']) for v in m['veg']])
