# 신규 총기 조준·장전 곡선 (v99)

`expanded-motion.json`은 LAST ZONE의 기존 에셋에서 추출해 게임의 총기·손 접촉점에 맞춘 모션입니다. 원본별 라이선스를 유지하며, 파일의 `sources`와 각 클립에 라이선스·저작자·원본 SHA-256을 기록합니다. M4 유래 곡선은 Fab Standard License가 적용됩니다.

| 원본 작품 · 저작자 | 사용 구간 | 게임 적용 | 라이선스 |
|---|---|---|---|
| [M4 - FPS Weapon Animations Pack FREE (v.1)](https://www.fab.com/listings/38da8f1e-cb54-4cda-beb1-6e55642a55a9) · BarcodeGames | `Reload`, `Reload_Empty`, `Draw` | AR 계열 장전·긴 총의 들어 올리기 | Fab Standard License |
| [FPS AK-74m animations](https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14) · Cransh | `Rig\|AK_Reload`, `Rig\|AK_Reload_full`, `Rig\|AK_Draw` | RK-762 장전·들어 올리기 | CC BY 4.0 |
| [Animated FPS hands (rifle animation pack)](https://sketchfab.com/3d-models/animated-fps-hands-rifle-animation-pack-5f2d0ed780a94724b36ab505f7564057) · Cransh | `Arms_FPS_Anim_Reload_Fast`, `Arms_FPS_Anim_Draw` | DM-56 | CC BY 4.0 |
| [FPS Arms remington (shotgun)](https://sketchfab.com/3d-models/fps-arms-remington-shotgun-e68ef617fe8a48cca8610d016ffd5881) · Cransh | `SG_FPS_Reload`의 시작·한 발·종료 구간 | SP-12 | CC BY 4.0 |
| [FPS pistol animations](https://sketchfab.com/3d-models/fps-pistol-animations-0d7a343dcb6f401197a73c91aee93f6d) · Cransh | `FPS_Pistol_Reload_easy`, `FPS_Pistol_Reload_full` | P-226 장전 | CC BY 4.0 |
| [[9mm Pistol] Ultimate FPS Animations](https://sketchfab.com/3d-models/9mm-pistol-ultimate-fps-animations-c26d7f5aa72f4b01a6da4578caa8f07f) · 1Matzh | `Equip` | P-226 들어 올리기 | CC BY 4.0 |
| [sniper animated](https://sketchfab.com/3d-models/sniper-animated-d6b5bccd148540f0b722d05998c9af38) · DJMaesen | `allanims`의 1.5~3.75초 | M-24 | CC BY 4.0 |
| [Kriss Vector Animated( Free)](https://skfb.ly/6RKL7) · BarcodeGames | FBX `Armature\|Reload\|BaseLayer`에서 변환한 `Animation` | V-45 | CC BY 4.0 |
| [fps animated smg](https://sketchfab.com/3d-models/fps-animated-smg-ea3dad7478624495a5a46f40127b0579) · DJMaesen | `allanims`의 빈 총·전술 장전 구간 | MP-9·CX-9·SM-45의 자유 손 동작 | CC BY 4.0 |
| [lmg animated](https://sketchfab.com/3d-models/lmg-animated-c02dc6663f344008a502148e751c9974) · DJMaesen | `allanims`의 9.8~14.4초, 0.9~5.6초 | MG-60 | CC BY 4.0 |

CC BY 4.0 원본의 라이선스: <https://creativecommons.org/licenses/by/4.0/> · [전문](LICENSE-CC-BY-4.0.txt). 기존 GitHub 배포 경로와 에셋 변환 기록은 [뷰모델 크레딧](../../models/viewmodels/CREDITS.md), [신규 총기 크레딧](../../models/guns/EXPANSION-CREDITS.md), [해시 고정 원본 목록](../../../tools/guns/expansion-sources.json)에 있습니다.

변경: 총몸의 강체 회전을 제거한 손목 좌표, 손목 회전·손가락 굽힘과 총몸 이동을 60Hz로 추출했습니다. 쿼터니언 부호를 프레임 사이에 연속으로 맞추고, 총기별 접촉 사건 사이로 시간과 공간을 옮깁니다. 탄창·손잡이·급탄 덮개에 닿을 때는 해당 부품의 실제 위치를 사용하며, MP5 계열 손잡이 고정·해제 등은 게임 모델의 구조에 맞춰 조정합니다. 1인칭 손 형상·UV·텍스처는 기존 M4 팔을 재사용합니다.

제작 도구: [build-expanded-motion.cjs](../../../tools/guns/build-expanded-motion.cjs). 실행 코드와 수동 접촉 보정값은 이 저장소에서 작성했습니다. 총기 이름은 게임의 가상 이름이며, 플랫폼에 맞춰 원본 곡선을 재배치한 동작입니다.
