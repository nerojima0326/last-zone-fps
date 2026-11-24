"""고정된 공개 에셋만 내려받고 해시를 검사한다. 외부 저장소 코드는 실행하지 않는다."""
from pathlib import Path
import hashlib, json, sys, urllib.request, zipfile

folder = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/lz-knife-source')
folder.mkdir(parents=True, exist_ok=True)
sources = json.loads(Path(__file__).with_name('sources.json').read_text())['sources']
for key, source in sources.items():
    file = folder / source['file']
    if file.name != source['file']:
        raise ValueError('잘못된 파일 이름')
    if not file.exists() or hashlib.sha256(file.read_bytes()).hexdigest() != source['sha256']:
        with urllib.request.urlopen(source['url'], timeout=45) as response:
            data = response.read(32 * 1024 * 1024 + 1)
        if len(data) > 32 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != source['sha256']:
            raise ValueError('원본 크기/해시 불일치: ' + key)
        file.write_bytes(data)
    if key == 'ual':
        with zipfile.ZipFile(file) as archive:
            (folder / 'ual.glb').write_bytes(archive.read(source['member']))
    print('확인:', source['file'])
