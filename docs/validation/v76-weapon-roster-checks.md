# v76 무기 30종 검증

2026-11-22, Node 24.22.3 / Chromium 156 / SwiftShader로 실제 게임과 장전 스튜디오를 검사했다. 기존 15종에 새 모델·성능을 가진 15종을 추가했다. 새 총기의 장전은 구조에 맞는 기존 동작을 바탕으로 손 접촉점과 작동부 경로를 맞춘 것이다.

[도감 모델 15종](v76-new-weapon-models.jpg) · [실제 지향 사격 자세](v76-new-weapon-holds.jpg) · [장전 화면](v76-new-weapon-reloads.jpg) · [도감 화면](v76-armory-desktop.jpg) · [모바일 도감](v76-armory-mobile.png) · [수치 기록](v76-weapon-roster-checks.json)

## 결과

| 검사 | 결과 |
| --- | --- |
| 도감·훈련 선택 | 전체 30종, 신규 15종, 7개 계열 필터, 이름·탄약 검색, 3D 회전, 발사음 미리듣기, 모바일 레이아웃 |
| 사용 경로 | 전리품에 30종 포함, 새 15종 모두 장착, 일반 매치에서 직접 지급 제한, 훈련 종료 시 정리 |
| 조준 | 16:9·4:3에서 166개 조합, 7,992회 샘플. 새 총기는 실제 앞 가늠쇠 끝과 뒤 가늠자 높이도 확인 |
| 사격·반동 | 실제 마우스 사격으로 10·50·100m 명중. 전체 무기의 탄도 270조건, 반동 단발 60·연사 180조건, 실제/대체 표시 120조건 통과 |
| 1인칭 손 | 지향·조준·이동·질주·발사·장전 810조건, 반복 자세 60조건, 좌표계 변경 30조건, 실패 0 |
| 장전 | 30종 × 빈 탄창/잔탄 60조건, 연속 프레임 20,857회, 탄약·사운드 720조건 통과 |
| 팔 경로 | 빈 탄창/잔탄 × 30·60·144 FPS, 180조건·32,334프레임 통과 |
| 총성 | 고유 뱅크 46개 디코딩, 30종 발사·장전음 구분, 발사 변형·근거리·원거리 총 180개 원본 파형 검사 |
| 오디오 복구·정리 | 44.1/48kHz, 생성기 대체 재생, 오래된 매니페스트, 소음기, 음소거, 스테레오 시작점, 큐 분리, 노드 정리 통과 |
| 기존 기능 | Glock/M4 가져오기·초기화, 번들 모델, 저장소 비활성화, 실제 전투 경로, 훈련장 재입장, 지형·운전·충돌 통과 |
| 에셋 대체 | 사격장 에셋이 없는 경우에도 30종과 표적·줍기·재입장이 동작 |

손 검사는 변형된 스킨 메시와 총 표면 삼각형을 측정한다. 기존 허용 기준(쥐는 자세 손바닥 6.5mm·손가락 11mm, 장전 손바닥 10mm·손가락 15mm)을 유지했다. 이는 장갑의 접촉 두께를 허용하는 회귀 검사다. 이미지 비교를 위해 게임 프레임을 정지했으므로 캡처의 FPS 표시는 성능 벤치마크 값으로 사용하지 않는다.

## 재현

기존 테스트 환경에서 `.github/workflows/game-regressions.yml`의 13개 검사를 실행한다. `node tools/check-weapon-catalog.cjs`를 추가했고, 총기 수와 오디오 뱅크 수를 사용하는 기존 검사도 30종·고유 경로 기준으로 갱신했다.

```bash
node tools/check-weapon-catalog.cjs
node tools/check-aim.cjs
node tools/check-hand-poses.cjs
node tools/check-reloads.cjs
node tools/check-clearance.cjs
node tools/check-original-weapon-audio.cjs
node tools/check-weapon-audio.cjs
```

`SHOTS=<출력 경로> node tools/check-weapon-catalog.cjs`는 새 15종의 도감 모델·지향·가늠쇠 조준 화면과 주요 장전 화면을 저장한다. `REPORT=<파일>`을 지원하는 검사는 상세 측정값을 별도 JSON으로 저장한다. 발사 뱅크는 `node tools/build-original-weapon-audio.cjs`로 재생성한다.
