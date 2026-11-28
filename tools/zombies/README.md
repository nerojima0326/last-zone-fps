# v109 좀비 미션 개발 도구

외부 다운로드 없이 기존 Patch CC0 인체를 Blender 4.3에서 가공한다. 원본 제작자와 파생 파일 라이선스는 patch.json, assets/zombies/CC0-1.0.txt를 따른다. 큰 제작 중간 파일과 촬영·검사 기록은 저장소 밖에 둔다.

```sh
blender -b -t 2 --python tools/zombies/build-assets.py -- /tmp/last-zone-zombie-source
node tools/zombies/pack-assets.cjs /tmp/last-zone-zombie-source
node tools/zombies/bake-palettes.cjs
node tools/zombies/bake-navigation.cjs
blender -b -t 2 --python tools/zombies/build-city.py -- /tmp/last-zone-zombie-city.glb
node tools/zombies/pack-city.cjs /tmp/last-zone-zombie-city.glb
python tools/zombies/build-audio.py
node tools/zombies/manifest.cjs
node tools/zombies/capture-models.cjs
node tools/zombies/capture-city.cjs
npm run check:zombie
```

`check-zombie-mode`는 목표 조건을 직접 설정해 순서·저장·결과를 검사한다. 이 검사의 화면과 소요 시간은 실제 플레이 분량 측정이 아니다.

`check-zombie-perf`는 파일럿이 실제 입력을 넣는다. 위치 이동, 무적, 목표 건너뛰기, 타이머 가속을 사용하지 않는다. 길찾기 자료 준비는 측정 전에 하고, 조종 계산 시간도 기록한다. 도중 사망하면 기본 설정에서는 실제 체크포인트에서 최대 2회 재시도하고, 최종 탈출하지 못하면 실패한다. 재시도 구간 시간도 누적한다. CHECK_TIMEOUT_MS를 별도로 정하지 않으면 전체 검사 실행기는 이 검사에 45분을 허용한다.

| 환경 변수 | 기본값 / 의미 |
|---|---|
| ZOMBIE_OUT | 저장소 밖 임시 폴더 |
| ZOMBIE_DIFFICULTY | infected / survivor / nightmare / doomsday |
| ZOMBIE_GPU | hardware이면 실제 GPU 사용 시도 · 결과의 렌더러 이름으로 확인 |
| ZOMBIE_REQUIRE_TARGETS | 1이면 60FPS·99백분위 33ms·50ms 초과 0개도 합격 조건 |
| ZOMBIE_QUALITY | potato / low / medium / high |
| ZOMBIE_WIDTH, ZOMBIE_HEIGHT | 640, 360 · 소프트웨어 GPU 검증용 |
| ZOMBIE_STRESS | 1이면 40마리 이상 고정 부하를 60초 측정 · 전체 미션 분량과 별도 |
| ZOMBIE_SEGMENT | defense이면 실제 발전기 90초 방어를 부분 재현 · 전체 미션 분량과 별도 |
| ZOMBIE_SECONDS | 지정하면 부분 검사로 명시, 전체 미션 통과로 집계하지 않음 |
| ZOMBIE_TIMEOUT_MS | 2400000 · 전체 미션 한도 |
| ZOMBIE_RETRY | 기본 실제 체크포인트 재시도 최대 2회 · 0이면 즉시 실패 |
| ZOMBIE_MAX_RETRIES | 자동 재시도 상한 · 기본 2회, 최대 8회 · 실제 게임 체크포인트 규칙 사용 |

중간 사양 PC의 1920×1080 60FPS 여부는 하드웨어 GPU에서 같은 검사를 실행해 확인해야 한다. SwiftShader 결과와 섞어 표기하지 않는다.

기본 CI의 성능 검사 통과는 전체 실제 조작 탈출과 실행 오류 없음의 뜻이다. `performanceTargets`는 별도로 기록하며 소프트웨어 GPU가 목표를 충족했다고 표기하지 않는다. 실제 GPU 인증 시에는 `ZOMBIE_GPU=hardware ZOMBIE_REQUIRE_TARGETS=1 ZOMBIE_WIDTH=1920 ZOMBIE_HEIGHT=1080`을 사용한다.

모바일 검사는 844×390 터치 컨텍스트에서 길게 누르기·밀쳐내기·손전등과 목표/버튼 겹침을 확인한다. 실제 휴대폰 GPU의 성능 검증을 대신하지 않는다. 전체 미션 검사는 최소 15장과 코드·자원 지문, 원시 프레임·메모리·입력 조종 상태를 저장소 밖에 남긴다.

`capture-city`는 별도 기능 촬영이다. 항구 장면을 정지 상태로 구성해 헬기 외부·위·정면을 1280×720으로 찍고 소품 치수를 기록한다. 이 화면을 실제 미션 완주 시간·성능 측정에 섞지 않는다.

어려운 난이도의 자동 조작은 보급 메뉴에서 MG-60을 선택하고, 짧은 회피와 정조준 사격을 번갈아 입력한다. 장비는 실제 보급 상자에서 획득하며 탄약·체력·보급 횟수 규칙을 바꾸지 않는다. 게임·자원 지문과 검사 도구를 포함한 지문을 따로 기록해 검사 조작이 바뀐 경우를 구분한다.

최후의 날 조작은 비명자·폭발형 우선 처치, 실제 H 치료, 방어 시작 전 보급·탄창 준비를 포함한다. 밀쳐내기는 가까운 모든 위협을 확인하고 폭발형이 접근하면 실제 이동으로 피한다. 검사 로그에는 피격 원인과 치료 시도도 남긴다.

최고 난이도 자동 입력은 가까운 탱커가 있을 때 먼 비명자를 조준 중이어도 X로 밀쳐낸다. 폭발형의 실제 피해 반경(6m) 밖인 무전탑 위에서는 아래층 감염자 때문에 F 송출 입력을 취소하지 않는다. 이 두 입력은 `check-zombie-ai.cjs`에서 재현한다.

깊은 물에는 육지 경로가 없을 수 있다. `check-zombie-ai`는 실제로 문제가 난 해안 좌표에서 빈 경로 반환과 6초 실시간 플레이 갱신을 확인한다. 자동 조작의 최후의 날 미완주·예외 기록은 완주 결과와 구분한다.

## v110 백야 검역단지

일반 섬 객체는 장면 밖에 보관하고, 좀비 모드는 전용 지형·건물·충돌 격자·미니맵·목표를 사용한다. 일반 선택 시 원래 참조와 조명을 복원한다. 전용 자원은 좀비 선택 때만 요청한다. 이전 v109 체크포인트와 기록은 삭제하지 않고 별도 저장 키를 쓴다.

    python tools/zombies/build-quarantine-layout.py
    blender -b -t 2 --python tools/zombies/build-quarantine.py -- /tmp/quarantine-modules.glb
    node tools/zombies/pack-quarantine.cjs /tmp/quarantine-modules.glb
    node tools/zombies/bake-navigation.cjs
    node tools/zombies/manifest.cjs

지금의 bake-navigation은 144만 칸의 전용 검역단지 경로를 굽는다. 이전 섬용 nav-grid.bin.gz와 sector 파일은 보관하지만 v110 좀비 미션에서는 요청하지 않는다. 전용 맵은 check-zombie-map에서 섬 분리·네 그래픽 단계·목표 연결·철교 높이·저장 분리·반복 진입과 일반 복원을 검사한다.
