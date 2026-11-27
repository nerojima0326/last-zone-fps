# v108 전체 수정 병합

main v107 `4b5e027`에 검사한 수정본 `5b16313`의 미병합 22개 커밋을 통합한다. 기능별 커밋은 유지한다. `version.txt`와 `index.html` BUILD는 모두 108이다.

상공 안개·그리기 거리, 낙하 HUD, 차종별 계기판·성능·조향 그립, 실내 크기·세부 장착·미러, 저격총 소리 청취, 자동 품질 회복, 이동 중 GPU 준비와 총구 판정, 초기 로딩·판 준비·관전의 그래픽 복구까지 포함한다.

`npm run check` 전체 60개가 통과한 동일 커밋을 병합한다. 병합 준비 뒤 실행 파일을 검사본과 비교했으며 변경은 검증 문서 두 개뿐이다. [명령·결과 JSON](v108-merge-checks.json)에 필수 `check-clearance.cjs` 명령과 통과 결과를 포함했다. 장전 관통의 작동 중 3mm·복귀 중 10mm 기준은 그대로다. 새 문서의 검증 보고서 규칙도 별도로 검사한다.

| 검사 | 결과 | 시간(초) |
|---|---|---:|
| check-aim.cjs | 통과 | 98 |
| check-air-hud.cjs | 통과 | 27.1 |
| check-air-visibility.cjs | 통과 | 31 |
| check-airdrop.cjs | 통과 | 46.1 |
| check-artifact-paths.cjs | 통과 | 0.7 |
| check-attachments.cjs | 통과 | 48.5 |
| check-auto-quality.cjs | 통과 | 36.2 |
| check-bundled-viewmodels.cjs | 통과 | 140.7 |
| check-cabin-instruments.cjs | 통과 | 32.6 |
| check-cabin-model.cjs | 통과 | 28.3 |
| check-cabin-mounts.cjs | 통과 | 29.8 |
| check-cabin-steering.cjs | 통과 | 29.3 |
| check-classic-hands.cjs | 통과 | 59.9 |
| check-clearance.cjs | 통과 | 7.2 |
| check-combat-environment.cjs | 통과 | 50.1 |
| check-combat.cjs | 통과 | 61.4 |
| check-driving-controls.cjs | 통과 | 30.6 |
| check-driving-input.cjs | 통과 | 28.8 |
| check-expanded-motion.cjs | 통과 | 37.7 |
| check-fire-flipbook.cjs | 통과 | 64.4 |
| check-gameplay-polish.cjs | 통과 | 50.5 |
| check-glock-import.mjs | 통과 | 0.5 |
| check-graphics-recovery.cjs | 통과 | 47.1 |
| check-hand-poses.cjs | 통과 | 147.4 |
| check-knife-motions.cjs | 통과 | 61.2 |
| check-knife-touch.cjs | 통과 | 27.8 |
| check-knives.cjs | 통과 | 60.9 |
| check-live-session.cjs | 통과 | 130.5 |
| check-m4-model.mjs | 통과 | 0.9 |
| check-map-drive.cjs | 통과 | 46 |
| check-map-hydrology.cjs | 통과 | 6.5 |
| check-mobile-models.cjs | 통과 | 0.2 |
| check-mobile-scene.cjs | 통과 | 132 |
| check-mobile-stability.cjs | 통과 | 160.7 |
| check-native-reticle.cjs | 통과 | 39.1 |
| check-original-weapon-audio.cjs | 통과 | 3.4 |
| check-patch-people.cjs | 통과 | 106.3 |
| check-plane-model.cjs | 통과 | 34.1 |
| check-primary-scopes.cjs | 통과 | 28.6 |
| check-quality-performance.cjs | 통과 | 66.2 |
| check-reloads.cjs | 통과 | 46.6 |
| check-render-clarity.cjs | 통과 | 137.6 |
| check-render-prep.cjs | 통과 | 68.3 |
| check-scope-models.mjs | 통과 | 1 |
| check-session-polish.cjs | 통과 | 46.2 |
| check-shot-hearing.cjs | 통과 | 28.8 |
| check-smoke-trail.cjs | 통과 | 29.4 |
| check-spectator-prep.cjs | 통과 | 29.8 |
| check-startup.cjs | 통과 | 48 |
| check-throwable-motion.cjs | 통과 | 33.9 |
| check-training-range.cjs | 통과 | 104.8 |
| check-validation-reports.cjs | 통과 | 0 |
| check-vehicle-cabin.cjs | 통과 | 35.8 |
| check-vehicle-physics.cjs | 통과 | 32 |
| check-vehicle-throwable-vfx.cjs | 통과 | 36.2 |
| check-vehicle-tuning.cjs | 통과 | 31 |
| check-vehicle-wheels.cjs | 통과 | 28.7 |
| check-weapon-audio.cjs | 통과 | 44.1 |
| check-weapon-catalog.cjs | 통과 | 82 |
| check-weapon-surface.cjs | 통과 | 45.6 |

검사 환경은 Chromium·SwiftShader이며 실제 휴대폰 FPS를 측정한 결과는 아니다. Android 화면·터치 모사에서 연결 복구·재입장을 확인했고, 비일시정지 훈련장과 40명 경기의 수송기→자유낙하→낙하산→착지도 통과했다. PNG·영상·원본 실행 로그는 저장소 밖 `/workspace/artifacts/v108-recovery-fixes`에 남겼다.

통합 커밋:

- `bc34dbe` 강하 고도에 맞춰 안개와 섬 원거리 시야 복원 (v108)
- `a31e78c` 검사 산출물의 과거 검증 자료 덮어쓰기·삭제 차단 (v108)
- `b3384f1` 강하 안내와 무기 HUD·나침반의 좁은 화면 겹침 수정 (v108)
- `759a7e6` 9시·3시 미끄럼 그립으로 운전 팔의 계기판 가림 제거 (v108)
- `74f76eb` 무기 계열·탄종으로 신규 저격총의 봇 청취 거리 통일 (v108)
- `ff69e17` 봇의 주먹 비상 공격과 플레이어 전용 칼 경로 확인 기록 (v108)
- `ee8e87c` 차종별 계기판과 실제 연료·수온 바늘을 공유 자원으로 구현 (v108)
- `8982eba` 차종별 가속·최고속도·조향·질량·내구도를 물리와 봇에 연결 (v108)
- `2a75b48` 정지·최대 조향의 계기판 픽셀 가림과 같은 위치 촬영 검사 보강 (v108)
- `3e2ad6d` 초기·착지 부하와 단발 정지를 제외하고 자동 품질 회복·재시험 개선 (v108)
- `a64b196` 검증된 수정 묶음의 빌드 번호를 v108로 갱신
- `61a34ca` 계기판 크기·높이를 줄이고 모바일 숫자 가독성 유지 (v108)
- `674ebae` 공유 메시로 차량 라디오·공조·도어·기어 등 실내 디테일 보강 (v108)
- `9aec7a3` 공조·수납 받침과 비상등 버튼을 밀착하고 장착 검사 추가 (v108)
- `f4bd361` 숫자 가림 검사에 원본 차체·전체 실내와 가림막 검출 추가 (v108)
- `3be1c9e` 미러의 백색 반사를 완화하고 원본 면에 테두리 추가 (v108)
- `60b50d1` 이동한 카메라 행렬을 갱신해 총구 차폐 판정 수정 (v108)
- `436dc1b` 플레이 중 GPU 준비를 미루고 판 시작 전 자원 준비 완료 보장 (v108)
- `1f497b3` 초기 그래픽 연결 복구 뒤 준비 재시도와 환경맵 재생성 (v108)
- `8712e4f` 판 준비 중 연결 손실에도 준비 완료 뒤 재개하고 렌더 타깃 정리 (v108)
- `e32a5ac` 관전 중 총기 팩 준비를 보류해 화면 진행 정지 방지 (v108)
- `5b16313` 손실 알림 전 실제 WebGL 상태를 확인해 준비 중단 방지 (v108)
