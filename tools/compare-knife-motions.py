#!/usr/bin/env python3
"""게임 리그로 촬영한 두 버전의 꺼내기·공격·검사를 같은 시각에 비교한다."""
import argparse
import json
import math
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('before', type=Path)
    parser.add_argument('after', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--before-label', default='v104 변경 전')
    parser.add_argument('--after-label', default='v105 변경 후')
    parser.add_argument('--preview-id', default='knife_butterfly')
    args = parser.parse_args()
    old = json.loads((args.before / 'timeline.json').read_text())
    new = json.loads((args.after / 'timeline.json').read_text())
    font_file = subprocess.check_output(['fc-match', '-f', '%{file}', 'Noto Sans CJK KR'], text=True)
    font = ImageFont.truetype(font_file, 22)
    small = ImageFont.truetype(font_file, 18)
    names = {'butterfly': '버터플라이 나이프', 'dagger': '양날 단검', 'combat': '전투 나이프',
             'karambit': '카람빗', 'kunai': '쿠나이', 'machete': '마체테'}
    phases = ['꺼내기', '첫 번째 공격', '두 번째 공격', '자세히 보기']
    args.output.parent.mkdir(parents=True, exist_ok=True)
    encoder = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo',
        '-pix_fmt', 'rgb24', '-s', '1280x480', '-r', '30', '-i', '-', '-an',
        '-c:v', 'libx264', '-crf', '22', '-preset', 'fast', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', str(args.output)], stdin=subprocess.PIPE)
    count = 0
    preview = []
    try:
        for knife, clips in new.items():
            for action, (a, b) in enumerate(zip(old[knife], clips)):
                assert (a['kind'], a['variant']) == (b['kind'], b['variant'])
                duration = max(a['duration'], b['duration'])
                for frame in range(math.ceil(duration * 30) + 1):
                    elapsed = frame / 30
                    view = Image.new('RGB', (1280, 480), '#14202b')
                    draw = ImageDraw.Draw(view)
                    draw.text((20, 9), args.before_label, font=font, fill='#d6dde4')
                    draw.text((660, 9), args.after_label, font=font, fill='#8fe1b0')
                    for x, base, clip in [(0, args.before, a), (640, args.after, b)]:
                        n = round(min(elapsed / clip['duration'], 1) * (clip['endFrame'] - clip['startFrame']))
                        filename = base / (knife + '-frames') / f"{clip['startFrame'] + n:03d}.png"
                        with Image.open(filename) as image:
                            view.paste(image.convert('RGB').resize((640, 400), Image.Resampling.LANCZOS), (x, 45))
                    title = names[knife.removeprefix('knife_')] + ' · ' + phases[action]
                    draw.text((20, 449), title, font=small, fill='white')
                    draw.text((940, 449), '실제 게임 손 리그 · 30FPS', font=small, fill='#b0becb')
                    encoder.stdin.write(view.tobytes())
                    count += 1
                    if (args.preview_id == 'all' or knife == args.preview_id) and action in [0, 3] and frame == round(duration * .4 * 30):
                        preview.append(view.copy())
                # 짧은 쪽이 끝난 뒤에는 마지막 자세를 유지해 다음 동작의 시작을 맞춘다.
                for _ in range(6):
                    encoder.stdin.write(view.tobytes())
                    count += 1
    finally:
        encoder.stdin.close()
        code = encoder.wait()
    if code:
        raise RuntimeError(f'영상 변환 실패: {code}')
    if preview:
        sheet = Image.new('RGB', (1280, 480 * len(preview)))
        for i, image in enumerate(preview):
            sheet.paste(image, (0, 480 * i))
        sheet.save(args.output.with_suffix('.jpg'), quality=90)
    print(json.dumps({'file': str(args.output), 'frames': count, 'seconds': count / 30}, ensure_ascii=False))


if __name__ == '__main__':
    main()
