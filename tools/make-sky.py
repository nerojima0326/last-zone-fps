"""4k HDRI(.hdr) -> 하늘 배경 JPG(_bg.jpg) 변환기.

게임(js/assets.js)과 같은 방식으로 하늘 평균 밝기를 SKY_TARGET 에 맞추고,
0..BG_MAX 범위를 sRGB JPG 에 담는다. 게임은 이 JPG 를 BG_MAX 배로 밝혀서 배경으로 그린다.

사용법: python tools/make-sky.py assets/_src/<이름>_4k.hdr assets/hdri/<이름>_bg.jpg
필요: numpy, opencv-python
"""
import sys
import numpy as np
import cv2

SKY_TARGET = 1.25
BG_MAX = 3.0


def main(src, dst):
    img = cv2.imread(src, cv2.IMREAD_ANYDEPTH | cv2.IMREAD_COLOR)  # BGR float32
    if img is None:
        raise SystemExit('읽을 수 없음: ' + src)
    rgb = img[:, :, ::-1].astype(np.float32)
    h, w, _ = rgb.shape
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    rows = np.arange(h // 2)
    el = np.pi / 2 - (rows + 0.5) / h * np.pi
    cw = np.cos(el)[:, None]
    up = np.minimum(lum[: h // 2], 10.0)
    avg = float((up * cw).sum() / (cw.sum() * w))
    k = SKY_TARGET / avg
    lin = np.clip(rgb * k / BG_MAX, 0.0, 1.0)
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    out = (srgb * 255.0 + 0.5).astype(np.uint8)[:, :, ::-1]
    cv2.imwrite(dst, out, [cv2.IMWRITE_JPEG_QUALITY, 90])
    print('%s: %dx%d, 평균 %.3f, 배율 %.3f -> %s' % (src, w, h, avg, k, dst))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
