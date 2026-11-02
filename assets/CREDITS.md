# 에셋 출처

모두 무료 에셋입니다. 지형·건물 텍스처와 HDRI 하늘은 [Poly Haven](https://polyhaven.com)의 **CC0(퍼블릭 도메인)** 에셋으로, 개인·상업 용도 모두 무료이며 출처 표기 의무도 없습니다.

## 지형 · 건물 · 하늘 (Poly Haven, CC0)

| 용도 | 에셋 | 링크 |
|---|---|---|
| 지형 · 풀 | sparse_grass | https://polyhaven.com/a/sparse_grass |
| 지형 · 흙 | dirt | https://polyhaven.com/a/dirt |
| 지형 · 모래 | coast_sand_01 | https://polyhaven.com/a/coast_sand_01 |
| 지형 · 바위 / 바위 소품 | rock_face_03 | https://polyhaven.com/a/rock_face_03 |
| 지형 · 도로 | asphalt_02 | https://polyhaven.com/a/asphalt_02 |
| 건물 · 회벽 | white_plaster_02 | https://polyhaven.com/a/white_plaster_02 |
| 건물 · 벽돌 | red_brick_03 | https://polyhaven.com/a/red_brick_03 |
| 건물 · 판자 | weathered_brown_planks | https://polyhaven.com/a/weathered_brown_planks |
| 건물 · 마루 | wood_floor | https://polyhaven.com/a/wood_floor |
| 건물 · 지붕 | grey_roof_tiles_02 | https://polyhaven.com/a/grey_roof_tiles_02 |
| 건물 · 콘크리트 | concrete_floor_worn_001 | https://polyhaven.com/a/concrete_floor_worn_001 |
| 창고 · 컨테이너 · 금속 | corrugated_iron | https://polyhaven.com/a/corrugated_iron |
| 나무 상자 | plywood | https://polyhaven.com/a/plywood |
| 하늘 (낮) | kloofendal_48d_partly_cloudy_puresky | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky |
| 하늘 (노을) | belfast_sunset_puresky | https://polyhaven.com/a/belfast_sunset_puresky |

## 캐릭터 · 총기 · 나무

| 용도 | 에셋 | 출처 | 라이선스 |
|---|---|---|---|
| 군인 캐릭터 3종 | Military_Male_01 · Military_Male_03 · Military_Female_01 | [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) | MIT (`char/LICENSE-Rocketbox.md`) |
| AR-7 소총 | M4A1 Assault Rifle (원작 3DModelsCC0, nisu 재배포) | [OpenGameArt](https://opengameart.org/content/m4a1-assault-rifle) | CC0 |
| S-12 산탄총 | Semi-Auto Shotgun with Magazine (crookedmouth) | [OpenGameArt](https://opengameart.org/content/semi-auto-shotgun-with-magazine) | CC0 (CC-BY-SA 3.0과 이중 라이선스 중 CC0 선택) |
| P-92 권총 | Service Pistol (Mateusz Sadek) | [Poly Haven](https://polyhaven.com/a/service_pistol) | CC0 |
| 나무 · 덤불 | EZ-Tree 생성기 (Daniel Greenheck, 나무껍질·잎 텍스처 포함) | [GitHub](https://github.com/dgreenheck/ez-tree) | MIT (`vendor/ez-tree.LICENSE.txt`) |

MIT 라이선스 에셋은 게임을 배포할 때 위 라이선스 파일(저작권 고지)을 함께 넣어야 합니다. CC0 에셋은 표기 의무가 없습니다.

## 파일 안내

- `tex/`, `hdri/*_1k.hdr`, `models/pistol/`, `_src/`, `vendor/ez-tree.es.js` 는 `download-assets.bat` 으로 받습니다.
- `hdri/*_bg.jpg` 는 `_src/` 의 4k HDRI를 `tools/make-sky.py` 로 변환한 하늘 배경입니다.
- `char/`(군인 아틀라스 텍스처), `models/rifle/`, `models/shotgun/` 은 `_src/` 원본을 `tools/convert-models.py` 로 변환한 결과입니다.
- `_src/` 는 변환에만 쓰이므로 (약 300MB) 지워도 게임에는 영향이 없습니다.
