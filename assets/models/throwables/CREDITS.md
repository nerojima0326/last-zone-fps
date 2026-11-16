# 투척무기 모델 (v46)

| 파일 | 게임 속 이름 | 원본 | 라이선스 |
|---|---|---|---|
| `frag.glb` | 수류탄 | FragGrenadeModel (M67 형 세열 수류탄) | CC0 1.0 |
| `flash.glb` | 섬광탄 | Flashbang (M84 형 섬광 수류탄) | CC0 1.0 |
| `smoke.glb` | 연막탄 | Smoke_Grenade (M18 연막 수류탄) | CC0 1.0 |
| `molotov.glb` | 화염병 | Molotov_Cocktail (유리병 · 액체 · 천 심지) | CC0 1.0 |

- 원작: 3DModelsCC0, "Free CC0 Guns & Explosives Pack" (CC0 1.0, 퍼블릭 도메인).
- 받은 곳: BoQsc의 GLB 변환본 [cc0-guns-explosives-pack-glb](https://github.com/BoQsc/cc0-guns-explosives-pack-glb) 릴리스의 `Guns.Explosives_glb.zip` (KA-47 · S-12와 같은 팩).
- 가공 (`tools/throwables/build.cjs`):
  - 노드 변환을 정점에 굽고, 몸통 가운데를 원점에 둡니다. 위(+Y)는 신관·병목, 안전손잡이는 +X 쪽입니다. 크기는 원본(실제 크기)을 그대로 씁니다.
  - 화염병은 원본 병이 옆으로 13.5° 기울어 있어 똑바로 세웠습니다.
  - 텍스처는 512 px WebP로 줄였고, 위치·법선 양자화와 meshopt 압축을 했습니다. 원본 4개 44 MB → 0.7 MB.
  - 안전핀(`pin`)은 따로 남겨 두어, 손에 들고 던질 때 핀을 뽑고 던진 수류탄은 핀이 빠진 채로 보입니다.
