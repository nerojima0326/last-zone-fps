"""Download immutable, attributed source assets; no source-repository code runs.

python tools/guns/fetch-expansion-assets.py <output-directory> [--verify-only]
Then run prepare-expansion-vector.py in Blender and import-expansion.cjs.
"""
import hashlib
import json
from pathlib import Path
import sys
from urllib.request import Request, urlopen

folder = Path(sys.argv[1]).resolve()
verify_only = '--verify-only' in sys.argv[2:]
folder.mkdir(parents=True, exist_ok=True)
manifest = json.loads(Path(__file__).with_name('expansion-sources.json').read_text())
for key, source in manifest['sources'].items():
    if 'url' not in source:
        continue  # Derived Vector GLB and already bundled Remington curves.
    name = source['file']
    if Path(name).name != name:
        raise ValueError('Source filename must be local: ' + name)
    target = folder / name
    expected = source['sha256']
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == expected:
        print('Verified', name)
        continue
    if verify_only:
        raise ValueError('Missing or modified source: ' + name)
    request = Request(source['url'], headers={'User-Agent': 'LastZoneFPS-AssetImporter/1.0'})
    with urlopen(request, timeout=60) as response:
        content = response.read(32 * 1024 * 1024 + 1)
    if len(content) > 32 * 1024 * 1024:
        raise ValueError('Source exceeds size limit: ' + name)
    if hashlib.sha256(content).hexdigest() != expected:
        raise ValueError('Source checksum mismatch: ' + name)
    target.write_bytes(content)
    print('Downloaded and verified', name)
