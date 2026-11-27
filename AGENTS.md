# LAST ZONE 작업 규칙

- 주석·UI·커밋 메시지는 한국어로 작성하고 변경 주석에 버전을 표시한다.
- 병합 전 `npm run check`를 실행한다. `tools/check-clearance.cjs`는 필수이며 작동 중 3mm, 복귀 중 10mm 기준을 완화하지 않는다.
- v107 이후 `docs/validation/*-merge-checks.json`에는 `check-clearance.cjs`의 실행 명령·결과를 반드시 포함한다. 과거 보고서는 소급 변경하지 않는다.
- 새 검증 영상·큰 이미지는 저장소 밖에 저장한다. 기존 대용량 파일 삭제·Git 히스토리 재작성은 사용자가 정리 방법을 확인한 뒤에만 실행한다.
