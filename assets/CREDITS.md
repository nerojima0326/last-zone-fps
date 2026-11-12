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
| KA-47 소총 | AK-47 (3DModelsCC0 "Free CC0 Guns & Explosives Pack", GLB 변환본) | [GitHub (BoQsc)](https://github.com/BoQsc/cc0-guns-explosives-pack-glb) | CC0 |
| KR-98 저격소총 | Sniper Rifle (같은 팩, 일체형 조준경은 빼고 가늠자 추가) | [GitHub (BoQsc)](https://github.com/BoQsc/cc0-guns-explosives-pack-glb) | CC0 |
| S-12 산탄총 | Shotgun (같은 팩, 펌프액션) | [GitHub (BoQsc)](https://github.com/BoQsc/cc0-guns-explosives-pack-glb) | CC0 |
| SC-17 · MK-14 · M-1014 · DB-2 · SA-12 · AA-12 · G-18 · M-1911 · DE-7 · R-45 | 이 게임용으로 직접 설계한 모델 (`tools/guns/designs.js`) | — | 이 저장소의 일부 |
| P-92 권총 | Service Pistol (Mateusz Sadek) | [Poly Haven](https://polyhaven.com/a/service_pistol) | CC0 |
| 나무 · 덤불 | EZ-Tree 생성기 (Daniel Greenheck, 나무껍질·잎 텍스처 포함) | [GitHub](https://github.com/dgreenheck/ez-tree) | MIT (`vendor/ez-tree.LICENSE.txt`) |

MIT 라이선스 에셋은 게임을 배포할 때 위 라이선스 파일(저작권 고지)을 함께 넣어야 합니다. CC0 에셋은 표기 의무가 없습니다.

## 사람 · 1인칭 팔 (v34, Patch 에셋)

Patch가 MakeHuman/MPFB의 CC0 부품으로 준비한 실사 캐릭터 `mpfb:human-0408`, `mpfb:human-0348`을 사용합니다. 긴소매 캐릭터의 팔·손을 분리한 1인칭 모델도 포함합니다. 원작자 MakeHuman team, Cortu, MargaretToigo와 Patch의 정확한 크레딧, 원본 해시, 라이선스, 가공 내용은 [캐릭터·팔 출처](patch/people/CREDITS.md)에 있습니다.

## 훈련장 시설 (v33, Patch 에셋)

모래주머니 벽은 Polyfork의 Sandbag Wall Section(CC BY 4.0), 사격장 바닥은 Rob Tuytel의 Concrete Floor Painted(CC0), 보급 상자는 PierreB3D의 Plastic Crate 01(CC0)을 사용합니다. Patch에서 제공받은 파일을 게임에 포함했으며 별도 파일 선택 없이 불러옵니다. 크기·배치와 렌더링 재질은 게임에 맞게 조정했습니다. 원본 출처·고지·라이선스는 [훈련장 에셋 출처](patch/range/CREDITS.md)와 해당 폴더의 `LICENSES/`에 있습니다. 게임 메뉴의 **훈련장 에셋 출처**에서도 확인할 수 있습니다.

## 기존 에셋 파일 안내

- `tex/`, `hdri/*_1k.hdr`, `models/pistol/`, `_src/`, `vendor/ez-tree.es.js` 는 `download-assets.bat` 으로 받습니다.
- `hdri/*_bg.jpg` 는 `_src/` 의 4k HDRI를 `tools/make-sky.py` 로 변환한 하늘 배경입니다.
- `char/`(군인 아틀라스 텍스처), `models/rifle/` 은 `_src/` 원본을 `tools/convert-models.py` 로 변환한 결과입니다.
- `models/guns/*.glb` 는 `tools/guns/run.cjs build` 로 만든 결과입니다 (실사 3종은 위 팩 원본을 정규화·1K 텍스처, 나머지는 직접 설계). 자세한 방법은 `tools/guns/README.md`.
- `_src/` 는 변환에만 쓰이므로 (약 300MB) 지워도 게임에는 영향이 없습니다.

## 총성 · 장전음 (v20)

실제 총성은 The Free Firearm Sound Library(CC0), 기계 조작음은 SpringySpringo의 에어소프트 녹음(CC0)을 편집했다. 총기별 매핑·가공·출처는 [오디오 출처](audio/weapons/CREDITS.md)를 참고한다.

## 조준경 · 총기 부착물 (v21)

조준경과 부착물은 LonesomeDucky의 [Rifle Scope](https://opengameart.org/content/rifle-scope)와 Pichuliru의 [Flat Gun Attachments](https://pichuliru.itch.io/flat-gun-attachments)를 사용합니다. 모두 CC0이며, 모델별 출처와 가공 내용은 [부착물 출처](models/attachments/CREDITS.md)에 기록했습니다.
