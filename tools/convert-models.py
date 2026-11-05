"""다운로드한 원본(assets/_src)을 게임용으로 변환한다.
- Rocketbox 군인: 2K TGA 텍스처 4장 -> 아틀라스 JPG 1장, FBX 복사 -> assets/char/<이름>/
- M4A1 소총: FBX + PBR PNG -> 1K JPG (diff / nor / arm)      -> assets/models/rifle/
사용법: python tools/convert-models.py <assets/_src 경로> <assets 출력 경로>
필요: Pillow, numpy
"""
import sys, os, glob, shutil, zipfile, io
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
ATLAS = 1536  # 군인 텍스처 아틀라스 크기 (칸 768)


def save_jpg(im, path, size, q=88):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im = im.convert('RGB')
    if size and im.size[0] > size:
        im = im.resize((size, max(1, round(im.size[1] * size / im.size[0]))), Image.LANCZOS)
    im.save(path, quality=q, optimize=True)


# 군인 캐릭터
for d in sorted(glob.glob(os.path.join(SRC, 'rocketbox', '*'))):
    if not os.path.isdir(d):
        continue
    name = os.path.basename(d)
    fbx = os.path.join(d, name + '.fbx')
    tgas = glob.glob(os.path.join(d, '*.tga'))
    if not os.path.exists(fbx) or not tgas:
        continue
    out = os.path.join(OUT, 'char', name)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out, exist_ok=True)
    shutil.copy(fbx, os.path.join(out, name + '.fbx'))
    # 부위별 텍스처 4장을 아틀라스 1장으로 (캐릭터당 드로우콜 절약). js/soldiers.js 의 CELLS 와 같은 배치
    # UV 공간 기준: body u0-.5 v.5-1 / head u.5-1 v.5-1 / equipment u0-.5 v.25-.5 / helmet u.5-1 v0-.5
    for kind in ('diff', 'nor'):
        A, c = ATLAS, ATLAS // 2
        bg = (128, 128, 255) if kind == 'nor' else (90, 90, 90)
        atlas = Image.new('RGB', (A, A), bg)
        for t in tgas:
            base = os.path.splitext(os.path.basename(t))[0]
            part = [p for p in ('body', 'equipment', 'head', 'helmet') if '_' + p + '_' in base + '_']
            if not part or ('nor' if base.endswith('normal') else 'diff') != kind:
                continue
            box = {'body': (0, 0, c, c), 'head': (c, 0, A, c), 'equipment': (0, c, c, c + c // 2), 'helmet': (c, c, A, A)}[part[0]]
            atlas.paste(Image.open(t).convert('RGB').resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS), box[:2])
        atlas.save(os.path.join(out, 'atlas_' + kind + '.jpg'), quality=92 if kind == 'nor' else 88, optimize=True)
    print('char', name, sorted(os.listdir(out)))

# M4A1
z = os.path.join(SRC, 'guns', 'm4a1.zip')
if os.path.exists(z):
    zf = zipfile.ZipFile(z)
    rd = lambda n: Image.open(io.BytesIO(zf.read('M4A1/' + n)))
    out = os.path.join(OUT, 'models', 'rifle')
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, 'M4A1.fbx'), 'wb').write(zf.read('M4A1/M4A1.fbx'))
    save_jpg(rd('M4A1_Base_Color.png'), os.path.join(out, 'm4a1_diff.jpg'), 1024)
    save_jpg(rd('M4A1_Normal.png'), os.path.join(out, 'm4a1_nor.jpg'), 1024, 92)
    r = np.asarray(rd('M4A1_Roughness.png').convert('L').resize((1024, 1024), Image.LANCZOS))
    m = np.asarray(rd('M4A1_Metallic.png').convert('L').resize((1024, 1024), Image.LANCZOS))
    arm = np.stack([np.full_like(r, 255), r, m], -1)
    save_jpg(Image.fromarray(arm), os.path.join(out, 'm4a1_arm.jpg'), 1024, 92)
    print('rifle', sorted(os.listdir(out)))
