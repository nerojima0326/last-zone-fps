# 개발·검사 환경 (v107)

Node.js 22 이상을 사용한다. FFmpeg는 기존 오디오·영상 검사에 필요하다. Ubuntu에서는 `sudo apt-get install ffmpeg`로 설치한다.

```sh
npm ci --no-audit --no-fund
npx playwright install --with-deps chromium
npm run check
```

개발 의존성은 루트 `package.json`과 `package-lock.json`에 고정했다. Three.js 0.160.0과 three-mesh-bvh 0.7.8은 현재 게임 버전과 맞춘 조합이다. 검사 실행기는 `THREE_DIR`를 루트 설치 경로로 정하고, 시스템 Chromium이 있으면 사용한다. 다른 브라우저 실행 파일은 `CHROME_BIN`으로 지정할 수 있다.

`npm run check`는 `tools/check-*.cjs`, `tools/check-*.mjs`를 자동으로 찾아 순차 실행한다. M4 ZIP·Glock FBX 검사에는 저장소의 원본 경로를 자동 전달한다. 장전 관통 검사가 빠지면 실행을 거부한다. 하나가 실패해도 나머지를 실행하고 마지막 종료 코드를 1로 반환한다.

```sh
CHECK_OUT=/tmp/last-zone-checks npm run check
CHECK_OUT=/tmp/last-zone-recheck CHECK_ONLY=check-clearance.cjs,check-aim.cjs npm run check
```

`results.md`에 전체 통과/실패/못 돌림 표, `results.json`에 명령·시간·실패 이유를 기록한다. 개별 폴더에는 콘솔 로그와 상세 보고서를 둔다. 기본 출력은 시스템 임시 폴더이며 저장소 내부 경로는 허용하지 않는다. 기본 검사 제한 시간은 파일당 600초이고 더 느린 환경에서는 `CHECK_TIMEOUT_MS`로 조절한다. 새 큰 이미지·영상은 Git에 추가하지 않는다.

## 실제 진행 검사

```sh
REPORT=/tmp/last-zone-live.json npm run check:live
```

훈련장과 40명 경기 각각을 실제 RAF로 각각 최소 30초간 실행한다. 훈련장은 이동·사격·장전 입력도 완료한다. 일시정지·수동 시간 전진·DRS 비활성화는 사용하지 않는다. 경기는 실제 입력 처리로 수송기에서 뛰어내리고 Shift 강하·낙하산·착지를 거친다. 소프트웨어 렌더러에서도 착지까지 진행하도록 기본 320×180·최저 품질을 사용한다. `LIVE_WIDTH`, `LIVE_HEIGHT`, `LIVE_QUALITY`, `LIVE_SECONDS`로 변경할 수 있다. 게임의 dt 상한 때문에 실시간과 시뮬레이션 시간이 다를 수 있어 둘 다 기록한다. 착지나 입력이 끝나지 않으면 30초 이후에도 계속 실행한다.

다음을 기록한다.

- 판 시작 동기 호출, `warmup()` 전체·컴파일 시간, 첫 렌더 콜백 종료까지 지연
- CDP JS 힙, Linux `/proc`의 해당 Chromium 렌더러 프로세스 RSS 합계와 최대값
- ArrayBuffer 등 backing storage는 JS 힙과 별도로 기록한다. 단계별 `performance.memory` 값은 버퍼가 포함될 수 있어 CDP의 순수 힙과 직접 비교하지 않는다.
- 실제 프레임 간격의 평균·p50·p95·p99·최장값, 긴 작업, 게임 상태 전환, DRS 배율
- 준비된 뷰모델 수·남은 텍스처 수와 시작 전후 메모리

현재 자동 브라우저 검사는 SwiftShader를 사용한다. 수치는 이 클라우드의 CPU 렌더링 결과이며 Galaxy S24 FE나 실제 GPU의 FPS로 환산하지 않는다. 실제 기기에서는 게임 설정의 성능 기록으로 같은 품질·동선의 기록을 저장해 비교할 수 있다. RSS는 GPU VRAM과 별개이고, 여러 렌더러 프로세스가 있으면 각각의 PID와 합계를 보관한다.

CI도 `npm ci`와 같은 전체 실행기를 사용한다. 기존 대체 자원·모바일 운전 경로는 별도로 유지한다. Actions 산출물은 7일간 보관하며 Pages로 배포하지 않는다.
