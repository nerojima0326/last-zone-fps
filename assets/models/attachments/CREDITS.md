# Attachment model credits

## v92 직접 만든 스코프·부착물

현재 게임은 `v92/`의 21종 모델을 사용합니다. 외부 원본 메시·텍스처를 사용하지 않고 `js/attachment-models.js`에서 직접 작성했습니다.

- 조준경 6종: 소형 개방형 도트, 밀폐형 레드닷, 홀로그램, 2배율 프리즘, 4배율 소형 스코프, 8배율 장거리 스코프.
- 총구 5종: 소총/권총 소음기, 보정기, 삼지 소염기, 초크.
- 손잡이 4종, 소형 레이저, 전술/뺨 패드 2종, 탄창 바닥판/고리 3종.
- `tools/attachments/build-v92.cjs`로 재질별 병합·이미지 텍스처 없는 PBR 재질·위치/법선 양자화·meshopt 압축을 적용했습니다. 미터 단위, 전방 -Z, 레일 접면 Y=0, 총구 체결면 Z=0입니다.
- `v92/manifest.json`에 파일 크기·SHA-256·삼각형 수·광축·접면을 기록했습니다. 런타임의 누락 시 대체 형상도 동일한 원형 코드에서 생성됩니다.

이전 모델의 원본 파일과 아래 출처는 기존 버전 재현을 위해 보존합니다.

## v59 실사 부착물 (CC-BY-4.0)

`tools/attachments/build-real.cjs` 로 만들었습니다. 원본은 Sketchfab 모델이고, GitHub 사본(trusthemind/game `apps/web/public/models/attach.glb`)에서 가져왔습니다.
바꾼 내용: 부착물마다 따로 떼어 실제 크기 그대로 방향·바닥 맞춤, 렌즈 재질을 반투명 유리로 교체, ACOG·조준경·레이저는 삼각형 단순화, 텍스처 512 px WebP, 위치·법선 양자화와 meshopt 압축.

| 파일 | 게임에서 | 원본 |
|---|---|---|
| `rd-aimpoint.glb` | 레드닷 | "Generic Red Dot Scope / Rifle Attachment Lowpoly" by valterjherson1 |
| `holo-eotech.glb` | 홀로그램 | "EoTech EXPS3-0 Holographic Weapon Sight Lowpoly" by valterjherson1 |
| `scope-acog.glb` | 2배율 | "ACOG Scope" by GC_3D_ART |
| `scope-sniper.glb` | 4배율 · 8배율 | "SV-98 Sniper Rifle" by SpatialNeglect (조준경 부분) |
| `sup-rifle.glb` | 소음기 | "Suppressors 10 Pack" by The WarVet |
| `brake-rifle.glb` | 보정기 · 소염기 | "low-poly AK-74M Zenitco" by D_U (DTK-1 제퇴기) |
| `grip-vertical.glb` | 수직·앵글·경량·하프 손잡이 | "low-poly AK-74M Zenitco" by D_U (RK-1 손잡이) |
| `laser-perst.glb` | 레이저 모듈 | "Zenitco / Зенит Perst 4 Laser Sight Attachment" by valterjherson1 |

- This work is based on "Generic Red Dot Scope / Rifle Attachment Lowpoly" (https://sketchfab.com/3d-models/generic-red-dot-scope-rifle-attachment-lowpoly-8bf2794c30d04fa0aed1e3df92cd8a9e) by valterjherson1 (https://sketchfab.com/valterjherson1) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "EoTech EXPS3-0 Holographic Weapon Sight Lowpoly" (https://sketchfab.com/3d-models/eotech-exps3-0-holographic-weapon-sight-lowpoly-45e4fcdfb1b34756ab9e866564a12f66) by valterjherson1 (https://sketchfab.com/valterjherson1) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "ACOG Scope" (https://sketchfab.com/3d-models/acog-scope-286f48a9123c4f05be81147c85f8d0d7) by GC_3D_ART (https://sketchfab.com/GC_3D_ART) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "SV-98 Sniper Rifle" (https://sketchfab.com/3d-models/sv-98-sniper-rifle-9167543c8cee476a9c027dd9e6f5aee4) by SpatialNeglect (https://sketchfab.com/SpatialNeglect) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "Suppressors 10 Pack" (https://sketchfab.com/3d-models/suppressors-10-pack-3a3c123f94a446589873b1d4df53c83c) by The WarVet (https://sketchfab.com/TheWarVet) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "low-poly AK-74M Zenitco" (https://sketchfab.com/3d-models/low-poly-ak-74m-zenitco-35ad8e37a513453cbbbd04064fa5fb79) by D_U (https://sketchfab.com/D_U) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "Zenitco / Зенит Perst 4 Laser Sight Attachment" (https://sketchfab.com/3d-models/zenitco-perst-4-laser-sight-attachment-3ebaa8bc75c34a538f4dd28e33eda119) by valterjherson1 (https://sketchfab.com/valterjherson1) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

## v61 직접 만든 부착물

`tools/attachments/build-procedural.mjs` 로 이 저장소에서 직접 만든 모델입니다 (외부 원본 없음).

| 파일 | 게임에서 |
|---|---|
| `rmr.glb` | 권총 미니 도트 (RMR 꼴 — 사다리꼴 후드, 렌즈, 조절 나사, LED) |
| `choke.glb` | 산탄총 연장 초크 (관 + 세로 홈 고리 + 가스 포트) |

## 예전 모델 (CC0)

- `micro-dot.glb` (v60 까지 권총 미니 도트, 지금은 쓰지 않음): [Flat Gun Attachments](https://pichuliru.itch.io/flat-gun-attachments) by Pichuliru, CC0.
