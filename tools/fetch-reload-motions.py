"""Authoring only. Download pinned reload-animation inputs with SHA-256 checks."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parent
cache = root / '_reload-src'
cache.mkdir(exist_ok=True)
for entry in json.loads((root / 'reload-motion-sources.json').read_text()):
    target = cache / entry['file']
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == entry['sha256']:
        print('Verified cache:', entry['file'])
        continue
    with urlopen(entry['url'], timeout=60) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise ValueError('Source checksum mismatch: ' + entry['file'])
    temporary = target.with_suffix(target.suffix + '.tmp')
    temporary.write_bytes(data)
    temporary.replace(target)
    print('Downloaded and verified:', entry['file'])
