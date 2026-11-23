# v79 미병합 분기 통합 검증

기준: `main` / `gh-pages`의 v76 (`36afcf6`)에서 미병합 원격 브랜치 전체를 확인하고 통합했습니다.

| 브랜치 | 원본 커밋 | 통합 내용 |
| --- | --- | --- |
| `feat/import-expansion-weapon-assets` | `b3dc2cb` | v77 신규 총기 모델·장전 곡선 |
| `feat/quality-performance-v78` | `b5b7241` | v78 화질·텍스처·모델·로딩 최적화 |
| `feat/gameplay-polish-v79` | `7c997b6` | v79 발소리·보행·재질·봇·LOD 개선 |
| `codex/patch-people-arms-v34` | `18e67df` | [PR #33](https://github.com/nerojima0326/last-zone-fps/pull/33)의 CC0 캐릭터·팔, 출처·가공 도구·선택형 미리보기 |
| `unity-m0` | `8360dfa` | [PR #58](https://github.com/nerojima0326/last-zone-fps/pull/58)의 Unity 사격장·섬 배틀로얄 이식 |

v77~v79는 이어진 커밋이므로 v79 브랜치를 병합하면 세 분기의 이력이 모두 포함됩니다. 오래된 Patch 분기의 충돌은 현재 게임의 SWAT/Rocketbox·M4 리그, 조준·손 접촉·장전·보행 개선을 유지하도록 해결했습니다. 기존 v79의 `js/` 파일, `index.html`, `version.txt`는 그대로이며, 별도 미리보기용 `js/patch-characters.js`만 추가했습니다. 기본 게임에서는 이 모듈이나 Patch 사람 에셋을 요청하지 않습니다.

Patch 모델은 `tools/people.html`, 팔은 `tools/reloads.html?arms=patch`에서 사용할 수 있습니다. 선택형 팔은 현재 30종의 장전 드라이버를 사용하며 에셋 로딩 실패 시 절차적 팔로 복구합니다. 기본 장전 미리보기는 현재 리그를 유지합니다.

## 이번 통합에서 실행한 검사

환경: Node 24.22.3, Chromium 156 / SwiftShader, Three.js r160.

| 검사 | 결과 |
| --- | --- |
| `check-glock-import.mjs` | 통과: 30·60·144fps, 조준·발사·장전·부착물·모델 교체/해제 |
| `check-m4-model.mjs` | 통과: 586개 검사, 474개 프레임 |
| `check-original-weapon-audio.cjs` | 통과: 실패 항목 없음 |
| `RANGE_FALLBACK=1 check-training-range.cjs` | 통과: 시설 대체 모델, 충돌·명중·전리품·재진입 |
| `check-reloads.cjs` | 통과: 60가지 장전, 연속 손 리그, 탄약·소리 720가지 |
| `check-gameplay-polish.cjs` | 통과: 발 접촉·자세 전환·봇·LOD·발소리·설정 |
| `check-patch-people.cjs` | 통과: 에셋 SHA-256, 캐릭터 2종·자세 7종, 팔 장전 60가지, 로딩 실패 복구, 기본 게임과의 분리 |

JS 파일 101개와 미리보기 모듈 2개의 구문 검사, `git diff --check`도 통과했습니다. 기존 v79의 전체 11종 검사 결과는 [v79 검증 기록](v79-gameplay-polish.md)에 있으며, 해당 게임 실행 코드가 이번 충돌 해결에서 그대로 유지되는지도 확인했습니다.

Patch 검사의 예전 총기·표적 수 가정을 현재 구성에 맞췄습니다. 훈련장에는 일반 표적 14개, 실내 표적 11개, 수류탄 표적 3개와 총기 30종이 있습니다. SwiftShader에서의 첫 로딩을 위해 미리보기 검사에 명시적인 제한 시간을 적용했습니다.

## Unity 검증 범위

`unity/`의 212개 파일(17,269,383바이트)은 원본 분기와 일치하며 웹 실행 파일을 변경하지 않습니다. C# 소스 38개와 GLB 21개가 포함되어 있고, GLB 헤더·버전·파일 길이를 확인했습니다. 이 환경에는 Unity 실행기와 C# 컴파일러가 없어 컴파일·실행 검사는 수행하지 않았습니다. 설치·맵 데이터 생성 방법과 미구현 항목은 [Unity README](../../unity/README.md)에 있습니다.
