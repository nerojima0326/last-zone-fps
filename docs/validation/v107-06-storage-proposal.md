# v107 저장소·배포 용량 정리 제안

이 문서는 실행 전 검토안이다. 기존 대용량 파일 삭제, 과거 커밋 재작성, 강제 푸시는 실행하지 않았다.

## 확인한 용량

v106 이후 현재 추적 파일 합계는 약 267.88MiB이며, `docs/validation`은 89.01MiB다. 그중 PNG 68.46MiB, JPG 5.18MiB, MP4 5.44MiB다. Git 객체 저장 공간과 현재 파일 크기는 서로 다르므로 이 합계가 새 클론의 전송량을 뜻하지는 않는다.

| 파일 | 크기 | 실제 사용 경로 |
|---|---:|---|
| `assets/models/viewmodels/glock17.fbx` | 22,972,544바이트 | `check-glock-import.mjs`의 사용자 FBX 가져오기 검사, `tools/viewmodels/convert-fbx-packs.cjs`의 변환 입력 |
| `assets/models/viewmodels/m4_animations.zip` | 12,732,515바이트 | `check-m4-model.mjs`의 원본 애니메이션 검사, 같은 변환 도구의 입력 |

게임은 `glock17.glb`, `m4.glb`를 자동 로드한다. `g17-pilot.js`와 `m4-viewmodel.js`는 사용자가 직접 선택한 파일도 읽지만 위 원본 경로를 자동 요청하지 않는다. `check-bundled-viewmodels.cjs`도 게임이 위 ZIP/FBX를 요청하면 실패하도록 검사한다. 따라서 두 원본은 검사·변환에 필요하지만 게임 배포 파일로는 필요하지 않다.

반면 `assets/models/rifle/M4A1.fbx`와 `assets/models/pistol/service_pistol_1k.gltf`는 `GunModels.load()`가 실제로 읽는다. 확장자 기준으로 FBX·glTF 전체를 배포에서 제외하면 게임의 다른 모델 경로가 깨진다. 제외할 원본은 `viewmodels/glock17.fbx`와 `viewmodels/m4_animations.zip` 두 파일로 한정해야 한다.

## 권장 순서와 영향

1. **게임 배포만 분리**: GitHub Pages를 Actions 배포로 전환하고 저장소 파일을 임시 배포 폴더에 복사하되 `.git/`, `node_modules/`, `docs/validation/`, 위 두 원본 파일을 제외한다. `tools/people.html`·`tools/reloads.html` 등 공개 미리보기와 루트의 다른 페이지·아이콘은 함께 복사한다. 원본과 검사 도구는 저장소에 보존하므로 로컬 검사 재현성과 Git의 과거 링크를 유지한다. 검증 폴더와 두 원본만으로 배포 산출물에서 약 123.06MiB를 줄일 수 있다.
2. **현재 버전의 검증 미디어 정리**: 필요한 전후 이미지를 작은 JPG로 남기고 나머지는 GitHub Release 자산이나 별도 보관소로 옮긴 다음 일반 삭제 커밋을 만든다. 현재 트리와 Pages 용량은 줄지만 과거 Git 객체는 남는다. 기존 문서의 이미지 링크도 함께 갱신해야 한다.
3. **Git 히스토리 정리**: 새 클론의 크기까지 줄여야 할 때만 별도 백업·전체 참조 목록을 확보한 뒤 `git filter-repo`로 합의한 경로를 제거한다. main·gh-pages·관련 브랜치·태그 커밋 ID가 바뀌고 공동 작업자의 재클론이 필요하다. 옛 커밋을 사용하는 회귀 검사와 문서 링크도 새 기준으로 수정해야 한다. Git LFS로 옮기는 것만으로 과거 대용량 객체가 사라지지는 않는다.

1번부터 적용하는 방법을 권장한다. 2·3번은 삭제 범위와 링크 보존 방법을 사용자가 확인한 뒤 진행한다. 이번 요청에서는 방법만 제시하며 배포 방식도 변경하지 않았다.

123.06MiB는 배포 산출물 기준의 절감량이다. 게임 로딩의 전송량은 브라우저가 실제 요청하는 자원을 기준으로 별도 측정한다.

## 이번부터 적용한 규칙

새 큰 화면·영상은 `/workspace/artifacts/v107` 등 저장소 밖에 기록한다. 전체 검사 실행기는 저장소 내부 출력 경로를 거부하고, 기존에 `docs/validation/v89`를 덮어쓰던 수송기 검사도 임시 폴더를 사용한다. CI 기록은 Actions 산출물로 7일간 보관한다. 원본 에셋과 과거 검증 미디어는 그대로 유지한다.
