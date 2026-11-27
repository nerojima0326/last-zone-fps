# v107 검증 후 통합 병합

기준 main은 v106 `b375107`, 검사한 수정본은 `9ed859c`이다. 총기·캐릭터 수정과 운전석 핸들·계기판까지 다음 10개 커밋을 합쳤다. 기능별 커밋은 유지했다. `version.txt`와 `index.html` BUILD는 모두 107이다.

- `b931bb3` 신규 총기 6종 장전 손의 총몸 관통 수정 (v107)
- `5d9950a` 차량 내부 시점의 몸통 관통과 외부 몸 복원 수정 (v107)
- `944e4db` 압축 법선 복사 오류로 생긴 M4 표면 반짝임 수정 (v107)
- `5b4add9` 캐릭터 미리보기의 강하 모듈 누락과 도구 검사 보완 (v107)
- `8b929df` 고정 의존성과 전체 검사·실시간 경기 계측 환경 추가 (v107)
- `0f39db4` 검사 원본의 실행 용도와 저장소·배포 용량 정리안 기록 (v107)
- `eaf46b2` 전체 검증 결과 정리 및 빌드 v107 반영
- `f75333b` 운전석 핸들과 손의 좌우 조향 방향 수정 (v107)
- `e61f417` 차종별 핸들 테두리·패드·살과 손 접촉 개선 (v107)
- `9ed859c` 차종별 계기판 모델·속도·회전수·야간 표시 개선 (v107)

`npm run check`로 50개 검사를 모두 실행해 통과했다. [명령·결과 JSON](v107-merge-checks.json). 원본 이미지·영상·개별 로그는 저장소 밖에 저장했다. 장전 관통의 3mm/10mm 기준은 그대로다.

| 검사 | 결과 | 시간(초) |
| --- | --- | ---: |
| check-aim.cjs | 통과 | 92.9 |
| check-airdrop.cjs | 통과 | 41.6 |
| check-attachments.cjs | 통과 | 29.9 |
| check-bundled-viewmodels.cjs | 통과 | 151.9 |
| check-cabin-instruments.cjs | 통과 | 17.7 |
| check-cabin-model.cjs | 통과 | 16.5 |
| check-cabin-steering.cjs | 통과 | 19.2 |
| check-classic-hands.cjs | 통과 | 47.7 |
| check-clearance.cjs | 통과 | 8.4 |
| check-combat-environment.cjs | 통과 | 44.3 |
| check-combat.cjs | 통과 | 50.8 |
| check-driving-controls.cjs | 통과 | 15.8 |
| check-driving-input.cjs | 통과 | 14.4 |
| check-expanded-motion.cjs | 통과 | 21.3 |
| check-fire-flipbook.cjs | 통과 | 54.2 |
| check-gameplay-polish.cjs | 통과 | 44.4 |
| check-glock-import.mjs | 통과 | 1.3 |
| check-hand-poses.cjs | 통과 | 141 |
| check-knife-motions.cjs | 통과 | 53.3 |
| check-knife-touch.cjs | 통과 | 24.4 |
| check-knives.cjs | 통과 | 50.7 |
| check-live-session.cjs | 통과 | 115 |
| check-m4-model.mjs | 통과 | 0.8 |
| check-map-drive.cjs | 통과 | 39.9 |
| check-map-hydrology.cjs | 통과 | 6.2 |
| check-mobile-models.cjs | 통과 | 0.2 |
| check-mobile-scene.cjs | 통과 | 117.9 |
| check-mobile-stability.cjs | 통과 | 135.5 |
| check-native-reticle.cjs | 통과 | 31.6 |
| check-original-weapon-audio.cjs | 통과 | 3 |
| check-patch-people.cjs | 통과 | 95.6 |
| check-plane-model.cjs | 통과 | 31.4 |
| check-primary-scopes.cjs | 통과 | 21.5 |
| check-quality-performance.cjs | 통과 | 49.7 |
| check-reloads.cjs | 통과 | 45.9 |
| check-render-clarity.cjs | 통과 | 133 |
| check-scope-models.mjs | 통과 | 0.9 |
| check-session-polish.cjs | 통과 | 39.2 |
| check-smoke-trail.cjs | 통과 | 14.8 |
| check-startup.cjs | 통과 | 44.9 |
| check-throwable-motion.cjs | 통과 | 19.1 |
| check-training-range.cjs | 통과 | 71 |
| check-validation-reports.cjs | 통과 | 0 |
| check-vehicle-cabin.cjs | 통과 | 27.3 |
| check-vehicle-physics.cjs | 통과 | 17.1 |
| check-vehicle-throwable-vfx.cjs | 통과 | 29.5 |
| check-vehicle-wheels.cjs | 통과 | 28.1 |
| check-weapon-audio.cjs | 통과 | 37.4 |
| check-weapon-catalog.cjs | 통과 | 72.6 |
| check-weapon-surface.cjs | 통과 | 26.5 |

검사 환경은 Chromium·SwiftShader이며 실제 휴대폰 FPS 결과는 아니다. 비일시정지 훈련장·수송기→낙하→착지 실시간 검사도 포함한다. [운전석 추가 검증](v107-cockpit-checks.md)과 [원래 v107 수정 검증](v107-summary.md)은 별도로 보존했다. 게임 실행 파일은 전체 검사를 통과한 수정본과 같다.
