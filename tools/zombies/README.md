# v109 좀비 미션 개발 도구

외부 다운로드 없이 기존 Patch CC0 인체를 Blender 4.3에서 가공한다. 원본 제작자와 파생 파일 라이선스는 patch.json, assets/zombies/CC0-1.0.txt를 따른다. 큰 제작 중간 파일과 촬영·검사 기록은 저장소 밖에 둔다.

```sh
blender -b -t 2 --python tools/zombies/build-assets.py -- /tmp/last-zone-zombie-source
node tools/zombies/pack-assets.cjs /tmp/last-zone-zombie-source
node tools/zombies/bake-palettes.cjs
blender -b -t 2 --python tools/zombies/build-city.py -- /tmp/last-zone-zombie-city.glb
node tools/zombies/pack-city.cjs /tmp/last-zone-zombie-city.glb
python tools/zombies/build-audio.py
npm run check:zombie
```

`check-zombie-mode`는 목표 조건을 직접 설정해 순서·저장·결과를 검사한다. 이 검사의 화면과 소요 시간은 실제 플레이 분량 측정이 아니다.

`check-zombie-perf`는 파일럿이 실제 입력을 넣는다. 위치 이동, 무적, 목표 건너뛰기, 타이머 가속을 사용하지 않는다. 길찾기 자료 준비는 측정 전에 하고, 조종 계산 시간도 기록한다. 도중 실패하면 기본 설정에서는 실패한다. CHECK_TIMEOUT_MS를 별도로 정하지 않으면 전체 검사 실행기는 이 검사에 45분을 허용한다.

| 환경 변수 | 기본값 / 의미 |
|---|---|
| ZOMBIE_OUT | 저장소 밖 임시 폴더 |
| ZOMBIE_DIFFICULTY | infected / survivor / nightmare / doomsday |
| ZOMBIE_QUALITY | potato / low / medium / high |
| ZOMBIE_WIDTH, ZOMBIE_HEIGHT | 640, 360 · 소프트웨어 GPU 검증용 |
| ZOMBIE_SECONDS | 지정하면 부분 검사로 명시, 전체 미션 통과로 집계하지 않음 |
| ZOMBIE_TIMEOUT_MS | 2400000 · 전체 미션 한도 |
| ZOMBIE_RETRY | 1이면 실제 체크포인트 재시작 최대 2회 |

중간 사양 PC의 1920×1080 60FPS 여부는 하드웨어 GPU에서 같은 검사를 실행해 확인해야 한다. SwiftShader 결과와 섞어 표기하지 않는다.
