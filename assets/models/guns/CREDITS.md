v77 신규 15종의 별도 출처·변경·장전 모션 기록: [EXPANSION-CREDITS.md](EXPANSION-CREDITS.md).

# 권총 · 리볼버 · DMR 모델 (v42)

직접 설계했던 M-1911 · DE-7 · R-45 · MK-14를 CC0 모델로 바꿨습니다. 시작할 때 자동으로 적용되며, 1인칭·3인칭·바닥 전리품에 같은 모델을 씁니다.

| 게임 총기 / 번들 파일 | 원본 에셋 | 제작자 / 배포처 | 라이선스 |
|---|---|---|---|
| M-1911 / `m1911.glb` | Flat Guns East — Pistol Compact East | Pichuliru / [fps-asset-kit](https://github.com/petroulacl/fps-asset-kit) | CC0 1.0 |
| DE-7 / `de7.glb` | Flat Guns East — Pistol Full East | Pichuliru / 같은 배포처 | CC0 1.0 |
| MK-14 / `mk14.glb` | Flat Guns West — Sniper Material West | Pichuliru / 같은 배포처 | CC0 1.0 |
| KR-98 / `kr98.glb` (v47) | Ultimate Gun Pack — SniperRifle_1 (내장 탄창 볼트액션) | Quaternius / R-45와 같은 배포처 | CC0 1.0 |
| R-45 / `r45.glb` | Ultimate Gun Pack — Revolver_2 | Quaternius / [원본](https://quaternius.com/packs/ultimategun.html), GitHub 사본 [WingNut17/ps1-style](https://github.com/WingNut17/ps1-style) (`assets/models/props/items/weapons/Ultimate Gun Pack by Quaternius/`) | CC0 1.0 |

가공:
- 권총 2종은 탄창(손잡이) 높이를 기존 설계와 같게 맞추고 같은 위치에 놓아 손 IK가 그대로 쥐게 했습니다. 슬라이드·탄창 분리, 조준·레일·슬라이드 당기는 점·탄창 빠지는 방향을 모델에서 계산합니다.
- R-45는 한 덩어리 메시라 실린더를 기하(가장 넓은 원통 구간)로 떼어 냈습니다. 실린더 반지름을 기존 설계와 같게 맞추고, 실린더 안의 탄 6발은 기존 설계의 것을 실린더 축에 맞춰 넣었습니다. 원본은 색만 있는 재질이라 금속·나무 재질을 새로 지정했습니다.
- KR-98(v47)은 탄창을 갈아 끼우지 않는 내장 탄창 볼트액션 사냥총입니다 (`imported.js` `buildBoltRifle`). 원본의 일체형 조준경(경통·렌즈·링)은 빼서 게임의 조준경을 달 수 있게 했고, 기관부 오른쪽으로 나온 볼트 손잡이만 움직이는 부품으로 나눴습니다. 크기는 방아쇠~총구 0.766 m(이전 KR-98과 같음), 원점은 방아쇠입니다. 장전은 볼트를 열고 배출구로 한 발씩 밀어 넣은 뒤 닫습니다.
- MK-14는 받치는 손 높이를 총열 덮개 아랫면에 맞추고, 장전 중 탄창을 쥐는 위치를 조금 낮춰(`RSTYLE.mk14.hd`) 팔이 탄창 멈치 부위를 스치지 않게 했습니다.
- 원본 URL·SHA-256은 [`tools/guns/imported-sources.json`](../../../tools/guns/imported-sources.json)에 고정했습니다.

# 추가 AR · SG 모델 (v39)

아래 모델은 게임에 포함되어 **시작할 때 자동 적용**됩니다. 파일 선택·업로드·별도 다운로드가 필요하지 않으며 1인칭, 3인칭, 바닥 전리품에 같은 모델을 사용합니다. v39에서는 기존 게임의 팔 IK·사격·장전 동작을 연결했습니다. v40에 추가한 별도 원본 장전 모션과 해당 라이선스는 [장전 애니메이션 출처](../../animations/reloads/CREDITS.md)에 기록했습니다.

| 게임 총기 / 번들 파일 | 원본 에셋 | 제작자 / 배포처 | 라이선스 |
|---|---|---|---|
| SC-17 / `sc17.glb` | Flat Guns West — Rifle Battle West | Pichuliru / [fps-asset-kit](https://github.com/petroulacl/fps-asset-kit) | CC0 1.0 |
| M-1014 / `m1014.glb` | Flat Guns East — Shotgun Pump East, 포엔드를 고정식으로 적용 | Pichuliru / 같은 배포처 | CC0 1.0 |
| SA-12 / `sa12.glb` | Flat Guns East — Shotgun Auto East | Pichuliru / 같은 배포처 | CC0 1.0 |
| AA-12 / `aa12.glb` | Flat Guns West — Shotgun Auto West | Pichuliru / 같은 배포처 | CC0 1.0 |
| DB-2 / `db2.glb` | Boomstick / DoubleBarrelShotgun (짧은 쌍열 산탄총) | [Godot-Dojo / Deprecated-Godot-XR-Weapons](https://github.com/Godot-Dojo/Deprecated-Godot-XR-Weapons), 원작자 이름 미기재 | CC0 Public Domain |

Flat Guns 원작 페이지: [West](https://opengameart.org/content/cc0-flat-guns-west), [East](https://opengameart.org/content/cc0-flat-guns-east). GitHub 배포 저장소 README에도 CC0 / 재배포·수정·상업적 이용 허용이 명시되어 있습니다.

DB-2 원본 glTF의 `asset.copyright`는 `CC0 Public Domain`입니다. 해당 저장소 README는 3D 모델이 CC0임을 명시합니다. 저장소의 코드 라이선스(MIT)와 모델 라이선스는 별개입니다.

가공: 미터 단위·방아쇠 원점·총구 −Z 정규화, 스킨의 정지 포즈를 정적 메시로 변환, 탄창·노리쇠·가늠자·중절 총열 분리, 조준/부착물/손/장전구 기준점 추가, meshopt 압축. DB-2의 PBR 텍스처는 1K로 축소·번들했습니다. M-1014는 펌프 모델의 포엔드를 고정해 반자동 동작에 사용합니다. 실총의 정확한 복제품을 뜻하지는 않습니다.

고정 원본 커밋:

- Flat Guns: `a19b7458a593598211c95ec46ef4eb4b6d1f94d7`
- Boomstick: `f08c7b1ae25ef23a287789b65ec52fe71419d03b`

원본 파일별 URL과 SHA-256은 [`tools/guns/imported-sources.json`](../../../tools/guns/imported-sources.json)에 기록되어 있습니다. 재생성 방법은 [`tools/guns/README.md`](../../../tools/guns/README.md)를 참고하세요. 플레이 중에는 GitHub나 원작 사이트에 접속하지 않습니다.

CC0 전문: [LICENSE-CC0.txt](LICENSE-CC0.txt) / [Creative Commons](https://creativecommons.org/publicdomain/zero/1.0/).
