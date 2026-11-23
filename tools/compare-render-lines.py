# 브라우저 원본 PNG를 읽어 투영된 선의 약한 구간을 측정한다. Pillow가 필요하다.
import json
import sys
from pathlib import Path
from PIL import Image

root = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/lz-v81-clarity')
result = {'threshold': 8, 'unit': '8비트 RGB 평균 대비', 'rows': []}
for mode in ['before', 'after']:
    report = json.loads((root / (mode + '.json')).read_text())
    for line in report['lines']:
        image = Image.open(root / line['file']).convert('RGB')
        def gray(x, y):
            return sum(image.getpixel((x, y))) / 3
        for projection in line['project']:
            (x0, y0), (x1, y1) = projection['points']
            contrasts = []
            for x in range(max(0, int(x0 + 5)), min(image.width, int(x1 - 5))):
                y = round(y0 + (y1 - y0) * (x - x0) / (x1 - x0))
                if y < 6 or y + 6 >= image.height:
                    continue
                background = (gray(x, y - 6) + gray(x, y + 6)) / 2
                contrasts.append(max(0, background - min(gray(x, yy) for yy in range(y - 3, y + 4))))
            result['rows'].append({'mode': mode, 'distance': line['distance'], 'phase': line['phase'], 'thickness': projection['thickness'],
                'meanContrast': sum(contrasts) / len(contrasts), 'minContrast': min(contrasts),
                'weakPercent': 100 * sum(v < result['threshold'] for v in contrasts) / len(contrasts)})
for row in result['rows']:
    if row['mode'] == 'after' and row['distance'] == 35:
        assert row['weakPercent'] < 2, row
(root / 'line-contrast.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
for mode in ['before', 'after']:
    values = [r['weakPercent'] for r in result['rows'] if r['mode'] == mode and r['distance'] == 35 and r['thickness'] == .006]
    print(mode, '35m, 6mm 선의 약한 구간:', round(min(values), 1), '~', round(max(values), 1), '%')
