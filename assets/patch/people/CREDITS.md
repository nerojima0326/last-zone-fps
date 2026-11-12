# 캐릭터 · 1인칭 팔 (v34)

Patch의 공개 에셋 라이브러리에서 받은 MakeHuman/MPFB 캐릭터입니다. 두 전신 모델과 1인칭 팔은 **CC0 1.0 Universal**로 게임과 함께 배포됩니다. 파일 선택이나 계정 연결 없이 자동으로 불러옵니다.

| 게임 파일 | Patch 에셋 | 용도 |
|---|---|---|
| `survivor-sweater.glb` | `mpfb:human-0408` — Slim man in a knit sweater and cargo pants | 전신 캐릭터 |
| `survivor-cargo.glb` | `mpfb:human-0348` — Bald man in a tucked t-shirt and cargo pants | 전신 캐릭터 |
| `fps-arms.glb` | `mpfb:human-0408`의 팔·손 부분 | 모든 기본 총기 · 주먹 · 투척의 1인칭 팔 |

원작 부품: **MakeHuman team, Cortu, MargaretToigo**. 모델 조합·게임용 53관절 뼈대·옷 아래 피부 제거·GLB 준비: **Patch**.

- [MakeHuman/MPFB 원본 프로젝트](https://github.com/makehumancommunity/mpfb2/tree/d0a32e57a7f915cb2f2b95410e2117648c7bbb7e)
- [Patch human-0408 메타데이터](https://patch.gg/api/v1/assets/mpfb%3Ahuman-0408)
- [Patch human-0348 메타데이터](https://patch.gg/api/v1/assets/mpfb%3Ahuman-0348)
- [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) · [법률 전문](CC0-1.0.txt)

Last Zone 변경: 텍스처를 최대 1K로 축소하고 팔·손의 삼각형을 별도 GLB로 분리했습니다. 전신은 게임의 걷기·앉기·조준·낙하산·기절·사망 자세로 구동하며, 1인칭 팔은 기존 손목·손가락·팔꿈치 IK에 스킨을 다시 연결합니다. 총기별 장전 시간·탄약·피해량은 유지합니다. 사용자가 선택한 M4 ZIP 모델은 기존처럼 우선합니다.

원본 다운로드 주소·SHA-256·정확한 크레딧과 가공 결과 해시는 `manifest.json`에 있습니다. `npm install sharp` 후 `node tools/build-patch-people.cjs`로 원본 해시를 검증하고 다시 만들 수 있습니다.
