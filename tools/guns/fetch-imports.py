"""Optional authoring step: fetch the pinned CC0 inputs, never needed to play."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parent
destination = root / 'src' / 'imported'
destination.mkdir(parents=True, exist_ok=True)
for entry in json.loads((root / 'imported-sources.json').read_text()):
    target = destination / entry['file']
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == entry['sha256']:
        print('Cached:', entry['file'])
        continue
    with urlopen(entry['url'], timeout=60) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise ValueError('Source checksum mismatch: ' + entry['file'])
    temporary = target.with_suffix(target.suffix + '.tmp')
    temporary.write_bytes(data)
    temporary.replace(target)
    print('Downloaded and verified:', entry['file'])
