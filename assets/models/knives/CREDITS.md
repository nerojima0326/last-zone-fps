# 칼 모델·모션 출처 (v90)

이 폴더의 에셋은 아래 원작자의 조건을 유지합니다. 저장소 코드의 라이선스가 외부 모델·애니메이션의 라이선스를 대신하지 않습니다. 원본 파일·불변 커밋·SHA-256은 [소스 목록](../../../tools/knives/sources.json), 변환 결과는 [manifest.json](manifest.json)에 기록했습니다. 게임 실행 중 외부 에셋 서비스에 접속하지 않습니다.

## 모델

| 게임 칼 | 원작자·원본 | GitHub 배포본 | 라이선스 |
| --- | --- | --- | --- |
| 버터플라이 | **Ginsta**, [Butterfly Knife](https://poly.pizza/m/FnD4lI5Wz1) | [niganmahhh/FPSGame](https://github.com/niganmahhh/FPSGame/tree/4d582665057e12f0e5d1c44d1ae1ebd048d9e046), `butterfly-knife.glb` | Creative Commons Attribution — 배포본은 버전 번호를 명시하지 않습니다. [원본 배포본의 출처 표기](https://github.com/niganmahhh/FPSGame/blob/4d582665057e12f0e5d1c44d1ae1ebd048d9e046/public/models/ASSET_CREDITS.md)를 보존합니다. |
| 양날 단검 | **3dmodelscc0**, [Melee Weapons Pack](https://3dmodelscc0.itch.io/free-cc0-melee-weapons-pack) | 위 FPSGame의 `cc0-dagger.glb`; 원본 GLB 변환 배포처 [BoQsc/cc0-melee-weapons-pack-glb](https://github.com/BoQsc/cc0-melee-weapons-pack-glb) | CC0 1.0 |
| 전투 나이프 | **3dmodelscc0**, 같은 팩 | 위 FPSGame의 `cc0-combat-knife.glb` | CC0 1.0 |
| 쿠나이 | **3dmodelscc0**, 같은 팩 | 위 FPSGame의 `cc0-kunai.glb` | CC0 1.0 |
| 마체테 | **3dmodelscc0**, 같은 팩 | 위 FPSGame의 `cc0-machete.glb` | CC0 1.0 |
| 카람빗 | **Diamonddogkz**, [Karambit](https://sketchfab.com/3d-models/karambit-dfd7606f189a413681305a39b8841ce8) | [EldarJamiyev/GARAM](https://github.com/EldarJamiyev/GARAM/tree/90fc4fc41c9bb3fcc07c9d61d835defaa9ce76fa), `packages/client/public/models/raw/karambit.glb` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — 원본 GLB의 작가·라이선스·원본 주소 메타데이터도 확인했습니다. |

가공: 실제 미터 단위와 손잡이 접점을 기준으로 좌표·방향을 맞추고, 카메라·조명 노드를 제거했습니다. 노멀과 노멀맵 접선을 함께 변환했습니다. 텍스처는 최대 1024px WebP, 지오메트리는 meshopt로 압축했습니다. 버터플라이는 Ginsta의 손잡이 메시를 유지하고 게임용의 뾰족한 칼날·기계식 회전축을 추가했습니다. v90의 손잡이 닫힘·열림·검사 중 회전은 이 게임에서 추가한 동작입니다. 버터플라이의 재질, 쿠나이의 잡는 방향을 조정했고 마체테는 1인칭 화면에 맞게 크기를 추가 조정했습니다.

## 가져온 모션 (v90 자료)

| 동작 | 원작·클립 | 라이선스 |
| --- | --- | --- |
| 꺼내기 | **Cransh**, [Animated FPS hands (rifle animation pack)](https://sketchfab.com/3d-models/animated-fps-hands-rifle-animation-pack-5f2d0ed780a94724b36ab505f7564057), `Armature\|Arms_FPS_Anim_Draw` | CC BY 4.0 |
| 자세히 보기 | 같은 팩, `Armature\|Arms_FPS_Anim_rifle_inspect` | CC BY 4.0 |
| 휘두르기 | **Quaternius**, [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html), `Sword_Attack`의 0~0.65초 구간 | CC0 1.0 |

Cransh 팩의 팔 모델 원작자는 **DJMaesen**이며 팩의 총 모델은 **doomsentinel**입니다. 이 작업에서는 팩의 총 메시를 가져오지 않고 손목의 위치·회전 곡선을 추출했습니다. 기존에 번들된 [ACR 팩과 출처](../viewmodels/CREDITS.md)를 사용했습니다. Quaternius 팩은 [cktang88/3d-fps의 고정 커밋](https://github.com/cktang88/3d-fps/tree/130ac2a5c856401ec36e7d35afcfefe40c5801f4)에서 배포된 ZIP을 사용했으며 ZIP 안의 [원본 라이선스](UAL-LICENSE.txt)를 함께 보관했습니다.

모션은 60Hz로 샘플링하여 [motion.json](motion.json)에 저장했습니다. 원작의 FPS 소총 검사·3인칭 검 공격 클립을 칼에 맞게 재배치했습니다. 팔 길이·손목 각도·그립 위치에 맞춰 변위를 제한하고, 공격·검사의 시각과 손잡이 동작을 게임에 맞게 조정했습니다. 실제 손·팔은 기존 게임의 [1인칭 팔 리그](../viewmodels/CREDITS.md)를 사용합니다.

라이선스 전문: [CC0 1.0](LICENSE-CC0-1.0.txt), [CC BY 4.0](LICENSE-CC-BY-4.0.txt).

## v95의 동작 변경

v95의 실행 동작은 `js/knives.js`에 새로 작성한 칼 전용 손목·팔 곡선과 칼별 그립 보정을 사용합니다. 발리송은 펼친 상태로 꺼내고, 꺼내기·공격·검사에서 잠긴 손잡이를 유지합니다. 기존 `motion.json`과 위 원작자·라이선스 표시는 변환 자료의 출처로 보존합니다. 모델 GLB와 텍스처의 저작자·라이선스는 그대로입니다. 실제 팔은 위에 명시된 기존 1인칭 팔 리그를 계속 사용합니다.

## v96의 칼별 동작

`js/knives.js`에 꺼내기 6개·공격 12개·자세히 보기 6개를 새로 작성했습니다. 각 칼의 오른손 위치·손목 회전과 왼손 보조 동작을 독립적인 곡선으로 구성합니다. 상용 게임의 모델·애니메이션 파일을 추출하거나 복제하지 않았습니다. 콜옵의 전술적인 단검 동작, 배그의 무거운 마체테, 발로란트의 빠른 손목 연출을 동작의 방향으로 삼았습니다.

공개 구현은 [erqf1/GambelStrike2의 고정 커밋](https://github.com/erqf1/GambelStrike2/blob/ccde7d5e021cb80f3e2a6889b145f6d6fe59725c/js/viewmodel.js)을 읽고, 칼별 꺼내기·검사와 두 방향 공격을 나누는 구성을 참고했습니다. 해당 프로젝트의 코드·키프레임·에셋은 복사하지 않았습니다. 기존 모델·텍스처·팔 리그와 v90 자료의 라이선스 표시는 보존합니다. 발리송은 전개·잠금 상태를 유지한 채 손목과 팔로 연출합니다.

## 재현

```sh
python tools/knives/fetch.py /tmp/lz-knife-source
# three, @gltf-transform/{core,extensions,functions}, meshoptimizer, sharp 필요
NODE_PATH=/path/to/dependencies/node_modules node tools/knives/build.cjs /tmp/lz-knife-source
```

## v105의 전개 리그와 모션

현재 버터플라이 모델은 `tools/knives/build-balisong.cjs`로 자체 제작한 채널 손잡이·탱·핀·래치·칼날입니다. 이전 Ginsta 모델의 출처는 v90~v104 이력을 위해 위 표와 `sources.json`에 보존합니다. 다른 다섯 칼과 검은 전술 장갑·녹색 소매 모델의 출처와 라이선스는 그대로입니다. 재현 시 기존 `build.cjs` 실행 후 `build-balisong.cjs`를 실행해야 현재 버터플라이 모델이 생성됩니다.

동작의 참고 자료는 [GambelStrike2의 공개 뷰모델 구현](https://github.com/erqf1/GambelStrike2/blob/ccde7d5e021cb80f3e2a6889b145f6d6fe59725c/js/viewmodel.js)입니다. 발리송에서 안전 손잡이를 고정한 채 칼날과 자유 손잡이를 순서대로 움직이는 구성, 펼친 뒤 손가락을 닫는 순서를 확인했습니다. 해당 프로젝트의 코드·키프레임을 가져오지 않고 기존 게임 리그에 맞는 별도 곡선을 작성했습니다. 꺼내기 6개·공격 12개·검사 6개가 `js/knives.js`에 있으며 발리송의 관절 각도·손가락 벌림도 같은 시간축에서 재생합니다. 상용 게임의 애니메이션 에셋을 반입하지 않았습니다.

자료 확인 범위: Google 검색과 YouTube는 이 환경의 네트워크 프록시에서 CONNECT 403으로 차단됐습니다. GitHub 저장소 검색·원본 소스 열람은 성공했습니다. YouTube 영상을 시청하거나 그 영상에서 모션을 추출한 작업은 아닙니다.

## v106 카람빗·쿠나이의 별도 참고 자료

- **카람빗:** [GambelStrike2의 카람빗 전용 클립](https://github.com/erqf1/GambelStrike2/blob/ccde7d5e021cb80f3e2a6889b145f6d6fe59725c/js/viewmodel.js#L248)의 고리 중심 회전·반회전 후 복귀 구성을 확인했습니다. 게임에서는 실제 검지 끝마디에 고리를 고정한 확장 그립으로 꺼내기·두 방향 베기·검사를 새로 작성했습니다. 기존 Diamonddogkz 모델과 라이선스를 유지하며 장갑에 맞게 장착 크기를 1.18배로 맞춥니다.
- **쿠나이:** **Liew Zhe Wei Damien**의 [Project Kunai 고정 커밋](https://github.com/liewdamien22-a11y/project_kunai/tree/3295dfde3d8df7990a4eb865e478a1e34b505abb), `personal project/Assets/Arms_rig.fbx`의 실제 `arms_rig|catch`, `arms_rig|throw`, `arms_rig|parry` 클립과 `PlayerKunaiScript.cs`의 동작 연결을 열어 확인했습니다. 안쪽으로 당겨 받아 쥐는 팔 이동, 빠른 전방 동작과 복귀 리듬을 기존 게임의 오른손과 근접 공격에 맞게 새로 구성했습니다.

두 자료는 각각 별도의 동작 참고 자료입니다. v106에 들어가는 키프레임은 LAST ZONE의 기존 손 리그용으로 작성한 곡선이며 참고 프로젝트의 모델·코드·애니메이션 파일을 번들에 추가하지 않았습니다. 실제 팔은 기존 검은 전술 장갑·녹색 소매 모델입니다. 확인한 원본 파일의 주소·SHA-256과 검증 결과는 [v106 기록](../../../docs/validation/v106-knife-motion.md)에 남깁니다.
