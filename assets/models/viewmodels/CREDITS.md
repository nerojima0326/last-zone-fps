# 1인칭 총기 모델 출처

| 파일 | 게임 내 사용 | 에셋 | 제작자 | 출처 | 라이선스 |
|---|---|---|---|---|---|
| `m4_animations.zip` | AR-7 1인칭 총·팔·손, 꺼내기·사격·장전 애니메이션. 팔·손 메시는 v41부터 나머지 총기(AR-7·G-18 제외)와 맨손·투척 화면에도 쓰입니다(`js/real-arms.js`) | M4 - FPS Weapon Animations Pack FREE (v.1) | BarcodeGames | [Fab](https://www.fab.com/listings/38da8f1e-cb54-4cda-beb1-6e55642a55a9) | Fab Standard License |
| `glock17.fbx` | G-18 1인칭 총·팔·손, 사격·장전 애니메이션 | Glock 17 FPS 모델·애니메이션 | 확인 필요 | 확인 필요 (저장소 소유자가 제공) | 확인 필요 |
| `ak74.glb` (v51) | KA-47 1인칭 팔·총, 사격·장전(·꺼내기) 애니메이션 | FPS AK-74m animations | Cransh | [Sketchfab](https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14) · GitHub 사본 [Ayush-Mohanty/FPS-Arms-3D](https://github.com/Ayush-Mohanty/FPS-Arms-3D) | CC-BY-4.0 |
| `saiga.glb` (v51) | SA-12 · AA-12 1인칭 팔·총, 사격·장전(·꺼내기) 애니메이션 | FPS Saiga animations | Cransh | [Sketchfab](https://sketchfab.com/3d-models/fps-saiga-animations-8c911e4dbe9145dfaf7b269bb351f6b4) · GitHub 사본 [mcbernie/bevy-fps-starter](https://github.com/mcbernie/bevy-fps-starter) | CC-BY-4.0 |
| `acr.glb` (v51) | SC-17 · MK-14 1인칭 팔·총, 사격·장전(·꺼내기) 애니메이션 | Animated FPS hands (rifle animation pack) | Cransh | [Sketchfab](https://sketchfab.com/3d-models/animated-fps-hands-rifle-animation-pack-5f2d0ed780a94724b36ab505f7564057) · GitHub 사본 [efs91/open-esport-2025](https://github.com/efs91/open-esport-2025) | CC-BY-4.0 |
| `remington.glb` (v51) | S-12 · M-1014 1인칭 팔·총, 사격·장전(·꺼내기) 애니메이션 | FPS Arms remington (shotgun) | Cransh | [Sketchfab](https://sketchfab.com/3d-models/fps-arms-remington-shotgun-e68ef617fe8a48cca8610d016ffd5881) · GitHub 사본 [LoanRoze/TirAuxKirby](https://github.com/LoanRoze/TirAuxKirby) | CC-BY-4.0 |
| `xdm.glb` (v51) | M-1911 · DE-7 1인칭 팔·총, 사격·장전(·꺼내기) 애니메이션 | FPS pistol animations | Cransh | [Sketchfab](https://sketchfab.com/3d-models/fps-pistol-animations-0d7a343dcb6f401197a73c91aee93f6d) · GitHub 사본 [xssl9/ZERO_FRAME](https://github.com/xssl9/ZERO_FRAME) | CC-BY-4.0 |
| `p9mm.glb` (v51) | P-92 1인칭 팔·총, 사격·장전(·꺼내기) 애니메이션 | [9mm Pistol] Ultimate FPS Animations | 1Matzh | [Sketchfab](https://sketchfab.com/3d-models/9mm-pistol-ultimate-fps-animations-c26d7f5aa72f4b01a6da4578caa8f07f) · GitHub 사본 [VixidDev/Heatstroke](https://github.com/VixidDev/Heatstroke) | CC-BY-4.0 |

## 메모

- 두 파일은 저장소 소유자가 직접 받아 넣은 원본입니다. 게임은 시작할 때 이 파일을 그대로 불러와 크기·재질·애니메이션 재생 속도만 맞춥니다.
- `glock17.fbx` 안에는 M4 팩과 같은 이름의 손·장갑 텍스처(`Hand_D`, `Glove_D`)와 같은 작업 폴더 경로가 들어 있어 같은 제작자의 팩일 가능성이 높지만, 다운로드 페이지와 라이선스는 아직 기록되지 않았습니다. 받은 곳을 확인하면 위 표를 채워 주세요.
- Fab Standard License는 에셋을 게임(프로젝트)에 넣어 배포하는 것은 허용하지만, 에셋 자체를 단독으로 재배포하는 것은 금지합니다. 공개 저장소·사이트에 원본 ZIP/FBX를 그대로 두는 것이 이에 해당할 수 있으니 공개 범위를 확인하세요.

## v51 장전 동작 팩 (CC-BY-4.0)

위 표의 `ak74.glb` · `saiga.glb` · `acr.glb` · `remington.glb` · `xdm.glb` · `p9mm.glb` 은 Sketchfab 에 CC-BY-4.0 으로 공개된 1인칭 애니메이션 팩을, 각 팩을 그대로 담아 둔 GitHub 저장소에서 받아 `tools/viewmodels/build.cjs` 로 게임용 GLB 로 바꾼 것입니다. 원본 라이선스 문구가 요구하는 출처 표기:

- This work is based on "FPS AK-74m animations" (https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14) by Cransh licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "FPS Saiga animations" (https://sketchfab.com/3d-models/fps-saiga-animations-8c911e4dbe9145dfaf7b269bb351f6b4) by Cransh licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "Animated FPS hands (rifle animation pack)" (https://sketchfab.com/3d-models/animated-fps-hands-rifle-animation-pack-5f2d0ed780a94724b36ab505f7564057) by Cransh licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "FPS Arms remington (shotgun)" (https://sketchfab.com/3d-models/fps-arms-remington-shotgun-e68ef617fe8a48cca8610d016ffd5881) by Cransh licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "FPS pistol animations" (https://sketchfab.com/3d-models/fps-pistol-animations-0d7a343dcb6f401197a73c91aee93f6d) by Cransh licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "[9mm Pistol] Ultimate FPS Animations" (https://sketchfab.com/3d-models/9mm-pistol-ultimate-fps-animations-c26d7f5aa72f4b01a6da4578caa8f07f) by 1Matzh licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

바꾼 내용: Specular-Glossiness 재질을 Metal-Rough 로 변환, 텍스처를 1024 px WebP 로 축소, 겹치는 애니메이션 키 정리, 위치·법선 양자화와 meshopt 압축. `acr.glb` 는 원본의 조준경·소음기 메시를 빼고, 가중치가 0 이라 뼈대 원점으로 끌려가던 탄창 정점 6개를 탄창 뼈에 묶었습니다. `p9mm.glb` 는 원본에 들어 있던 하늘 상자·조준 표시 메시를 뺐습니다. 모양과 애니메이션 자체는 바꾸지 않았습니다.

## v55 총별 실사 총 모델 (CC-BY-4.0)

같은 장전 동작 팩을 쓰는 두 총이 똑같아 보이지 않도록, 한쪽 총의 메시만 아래 실사 모델로 바꿔 끼웁니다 (`swap/*.glb`, `tools/viewmodels/build-swap.cjs`). 팔과 장전 동작은 위 팩 그대로입니다.

| 게임 총 | 파일 | 원본 | 얹는 팩 |
|---|---|---|---|
| SC-17 | `swap/sc17.glb` | Scar H Assault Rifle Black - free (Rotuma) | ACR |
| M-1014 | `swap/m1014.glb` | Low-Poly Benelli M4 Super 90 (TastyTony) | Remington |
| M-1911 | `swap/m1911.glb` | Colt M1911 (b0ho) | 권총 팩 |
| DE-7 | `swap/de7.glb` | Desert Eagle (ELIZION) | 권총 팩 |

AA-12 · MK-14 는 공개 라이선스의 실사 모델을 찾지 못해 게임에 원래 있던 총 모델(`assets/models/guns/aa12.glb`, `mk14.glb`)을 각각 Saiga · ACR 팩의 손에 얹습니다.

- This work is based on "Scar H Assault Rifle Black - free" (https://sketchfab.com/3d-models/scar-h-assault-rifle-black-free-55a0a5c139114747a31eb878ba19acc0) by Rotuma (https://sketchfab.com/Rotuma) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "Low-Poly Benelli M4 Super 90" (https://sketchfab.com/3d-models/low-poly-benelli-m4-super-90-caea90a9470143b69e6042f75b9c59cc) by TastyTony (https://sketchfab.com/TastyTony) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "Colt M1911" (https://sketchfab.com/3d-models/colt-m1911-6b20f04b583a4c4a9d009c0412f01678) by b0ho (https://sketchfab.com/b0ho) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "Desert Eagle" (https://sketchfab.com/3d-models/desert-eagle-cabde59f5cf24effaf80536e35d04e95) by ELIZION (https://sketchfab.com/ELIZION) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

바꾼 내용: 스킨·애니메이션 제거(바인드 자세), 실제 길이로 크기 맞춤, 탄창·슬라이드 부위 분리, 텍스처 1024 px WebP, 위치·법선 양자화와 meshopt 압축. Colt M1911 은 삼각형을 8 % 로 줄였고, Desert Eagle 은 따로 떠 있던 낱개 탄을 뺐습니다.
