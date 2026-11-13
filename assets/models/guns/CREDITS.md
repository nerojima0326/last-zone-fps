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
