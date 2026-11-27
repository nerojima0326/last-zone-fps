# v107 캐릭터 미리보기 의존성

수정 전 `check-patch-people.cjs`로 `Cannot read properties of undefined (reading 'pose')`를 재현했다. `people.html`이 `character.js`를 불러오면서 그 캐릭터의 강하 자세·낙하산 팽창에 필요한 `airborne.js`를 누락했다. `pose`만 선택 호출로 바꾸면 뒤의 `deployDuration` 참조도 남으므로, 이 도구가 실제 강하 모듈을 준비하도록 의존성을 맞췄다.

수정 후 같은 검사가 통과했다. 캐릭터 2종·7자세, Patch 팔 장전 60조합, 파일 누락 대체 경로, 실제 훈련장 격리 검사를 유지했다. `tools/viewer.html`의 소총 FBX와 `tools/guns/build.html`의 기본 G18 제작·렌더도 실제로 열어 검사했다. 원본 다운로드가 필요한 제작 입력 전체를 검증했다고 해석하지 않는다.

장전 도구는 별도 강하 캐릭터를 쓰지 않으며, `check-clearance`·`check-reloads`·`check-classic-hands`에서 준비·재생이 통과했다. `tools/*.html` 중 캐릭터 강하 모듈을 소비하는 페이지는 `people.html`이었다.

원본 로그: `/workspace/artifacts/v107/04-tools/{before,after}.log`. 새 검증 이미지는 저장소에 추가하지 않았다.
