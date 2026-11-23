"""Reproduce the bundled CC0 audio from a pinned mirror; no plugin code."""
import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1] / 'assets/audio/footsteps'
manifest = json.loads((root / 'sources.json').read_text())
url = 'https://codeload.github.com/Boyquotes/kenney-impact-sounds-for-godot/zip/' + manifest['commit']
archive = ZipFile(io.BytesIO(urlopen(url, timeout=30).read()))
for item in manifest['files']:
    member = next(name for name in archive.namelist() if name.rsplit('/', 1)[-1] == item['file'])
    data = archive.read(member)
    if hashlib.sha256(data).hexdigest() != item['sha256']:
        raise ValueError('Audio hash mismatch: ' + item['file'])
    (root / item['file']).write_bytes(data)
print('Verified and copied', len(manifest['files']), 'CC0 samples')
