# v106 카람빗·쿠나이의 별도 모션

카람빗은 검지 끝마디에 고리를 지지한 확장 그립과 칼 자체의 반회전을 사용합니다. 쿠나이는 안쪽으로 당겨 받아 쥐는 꺼내기와 칼끝을 곧게 뻗는 찌르기·올려 긋기로 구분했습니다. 두 칼의 꺼내기·공격 두 방향·검사를 각각 변경했습니다.

[두 칼 전후 비교 영상](v106/knife-motion-comparison.mp4) · [비교 화면](v106/knife-motion-comparison.jpg) · [출처 목록](v106/references.json) · [검증 결과](v106/checks.json)

## 별도로 확인한 자료

| 칼 | 고정된 원본 자료 | 확인한 동작 |
| --- | --- | --- |
| 카람빗 | [GambelStrike2 · viewmodel.js](https://github.com/erqf1/GambelStrike2/blob/ccde7d5e021cb80f3e2a6889b145f6d6fe59725c/js/viewmodel.js#L248), 커밋 `ccde7d5` | 카람빗 전용 고리 축 회전·반회전과 복귀 구성 |
| 쿠나이 | [Project Kunai · Arms_rig.fbx](https://github.com/liewdamien22-a11y/project_kunai/blob/3295dfde3d8df7990a4eb865e478a1e34b505abb/personal%20project/Assets/Arms_rig.fbx), 커밋 `3295dfd` | 실제 FBX의 `arms_rig\|catch` 0.833초·`arms_rig\|throw` 0.125초·`arms_rig\|parry` 0.417초 |

쿠나이는 FBX를 열어 애니메이션과 팔 관절을 확인하고 참고용 뷰어에서도 자세를 확인했습니다. [PlayerKunaiScript.cs](https://github.com/liewdamien22-a11y/project_kunai/blob/3295dfde3d8df7990a4eb865e478a1e34b505abb/personal%20project/Assets/Scripts/Player/PlayerKunaiScript.cs)의 꺼내기·투척·회수 연결도 읽었습니다. 받아 쥘 때의 안쪽 팔 이동, 전방으로 뻗는 동작, 빠르게 움직인 뒤 회수하는 리듬을 게임의 오른손·근접 공격에 맞게 작성했습니다.

두 자료의 동작 구성을 참고해 기존 손 리그용 곡선을 자체 작성했습니다. 참고 프로젝트의 코드·모델·애니메이션 파일은 게임 번들에 포함하지 않습니다. 실제 손은 기존 검은 전술 장갑·녹색 소매입니다. 원본 파일의 SHA-256은 [references.json](v106/references.json)에 기록했습니다.

## 구현

- 카람빗 고리의 실제 메시에서 안쪽 중심 약 `(-0.002165, -0.026844, 0)`m, 안쪽 반경 약 15.57mm를 측정했습니다. 장갑과의 접촉 여유에 맞춰 장착 크기를 1.18배로 조정했습니다.
- 검지 뼈의 실제 월드 변환에서 고리 축을 만들고, 다른 손가락은 접어 회전 경로를 비웁니다. 부모의 비균일 스케일을 상쇄해 고리가 찌그러지거나 손에서 미끄러지지 않게 합니다.
- 꺼내기와 검사는 고리 축으로 180도 반회전합니다. 공격은 확장 그립을 유지해 바깥을 감아 당기거나 아래에서 걸어 올립니다. 검사 중 공격하면 현재 손·칼 자세에서 이어지고, 타격 시점 전에 회전을 회수합니다.
- 쿠나이는 받아 쥐는 꺼내기, 어깨를 당긴 후 정면 찌르기, 낮은 준비 자세에서 올려 긋기, 손등 쪽으로 돌려 삼각 날과 고리를 확인하는 검사로 구성했습니다. 왼손의 보조 이동도 별도 곡선입니다.
- 대체 카람빗에도 실제 고리·손잡이·곡선 날을 만들어 같은 검지 축을 적용합니다. 3인칭도 같은 고리 축을 사용하고 무기 전환·차량 탑승 때 손가락을 복귀시킵니다.

## 검증

브라우저 검증은 소프트웨어 WebGL을 사용하는 Chromium에서 수행합니다. 모바일 검사는 터치 입력 경로의 에뮬레이션입니다.

```sh
source /workspace/.last-zone-fps-env/env.sh
node tools/check-knives.cjs
node tools/check-knife-motions.cjs
KNIFE_FALLBACK=1 node tools/check-knife-motions.cjs
node tools/check-knife-touch.cjs
```

- 정상·대체 모델 각각 **1,310개 자세**의 실제 스키닝된 장갑·칼 삼각형을 검사합니다. 카람빗·발리송의 꺼내기·검사는 각각 120구간으로 나눕니다.
- 정상 카람빗의 최대 교차 깊이는 **1.508mm**, 대체 카람빗은 **0mm**, 쿠나이는 정상·대체 모두 **0mm**입니다. 기존 2mm 미만 기준을 유지합니다.
- 매 자세에서 실제 검지 뼈와 카람빗 고리 사이의 오차를 검사합니다. 손의 상대 이동·회전과 칼의 손에 대한 실제 상대 회전으로 96쌍의 동작 차이를 비교합니다.
- 30·60·144FPS에서 72개 동작의 칼끝 연속성·손목 제한·복귀와 카람빗 검사 중 공격 전환 15개 구간을 확인합니다. 전환 중 칼끝 최대 속도는 6.392m/s이며 손의 교차 깊이도 2mm 미만입니다. 실제 공격의 한 번 타격·교대·사거리·벽 가림·취소·3인칭·키 재지정과 모바일 칼 선택·검사·공격을 확인합니다.
- 다른 네 칼은 v105와 비교한 **2,420개 모션 샘플이 동일**합니다. 모든 칼의 피해량·사거리·공격 주기도 동일합니다.

비교 영상은 v105와 v106의 실제 게임 손 리그를 각각 30FPS로 촬영해 두 칼의 꺼내기·공격 두 방향·검사를 나란히 배치했습니다. 짧은 쪽이 마지막 자세에서 기다렸다가 다음 동작을 함께 시작합니다.

```sh
KNIFE_IDS=knife_karambit,knife_kunai KNIFE_SHOTS=/tmp/lz-after KNIFE_VIDEO=1 node tools/capture-knife-motions.cjs
python3 tools/compare-knife-motions.py /tmp/lz-before /tmp/lz-after /tmp/knife-motion-comparison.mp4 --before-label 'v105 변경 전' --after-label 'v106 변경 후' --preview-id all
```
