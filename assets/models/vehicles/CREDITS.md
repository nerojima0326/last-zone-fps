# 차량 모델 (v53)

| 파일 | 게임 속 차량 | 원본 (Sketchfab) | 제작자 | GitHub 사본 | 라이선스 |
|---|---|---|---|---|---|
| `porter.glb` | 현대 포터 II 탑차 | [Hyundai - Pother II (Bongo III)](https://sketchfab.com/3d-models/hyundai-pother-ii-bongo-iii-3869c5bc8dff40ad97ee165ba31e0ee1) | yunho98 | [MJKM9163/threeJS-portfolio](https://github.com/MJKM9163/threeJS-portfolio) `public/cars/bongo` | CC-BY-4.0 |
| `e2200.glb` | 1톤 트럭 (차체 일부 색 변화) | [Mazda E 2200 Pickup Truck](https://sketchfab.com/3d-models/mazda-e-2200-pickup-truck-3d6fe0687b074e2bb57bd931a9621d58) | ARDmation | [Krugou/3DModelingAndMRApps](https://github.com/Krugou/3DModelingAndMRApps) `web2/3d-assets/mazda_e_2200_pickup_truck` | CC-BY-4.0 |
| `izh.glb` | 낡은 픽업 | [IZH-2715-PICKUP](https://sketchfab.com/3d-models/izh-2715-pickup-e40df534b7af43d08b4833d3a77c197f) | Ashkelon | [IqbalArif16/iqbalmukti](https://github.com/IqbalArif16/iqbalmukti) `assets/3D Model/izh-2715-pickup` | CC-BY-4.0 |

출처 표기 (원본 license.txt 문구):

- This work is based on "Hyundai - Pother II (Bongo III)" (https://sketchfab.com/3d-models/hyundai-pother-ii-bongo-iii-3869c5bc8dff40ad97ee165ba31e0ee1) by yunho98 (https://sketchfab.com/yunho98122810) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "Mazda E 2200 Pickup Truck" (https://sketchfab.com/3d-models/mazda-e-2200-pickup-truck-3d6fe0687b074e2bb57bd931a9621d58) by ARDmation (https://sketchfab.com/ardmation) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "IZH-2715-PICKUP" (https://sketchfab.com/3d-models/izh-2715-pickup-e40df534b7af43d08b4833d3a77c197f) by Ashkelon (https://sketchfab.com/Ashkelon) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

가공 (`tools/vehicles/build-real.cjs`): 길이 방향을 −Z(앞)로 돌리고 실제 길이(포터 5.1 m · E2200 4.7 m · IZH 4.4 m)로 맞춘 뒤, 바닥을 y=0 에 둡니다. 원본은 바퀴가 차체와 한 메시라서, 네 바퀴 원통 안에 든 삼각형을 떼어 `wheel_frontLeft` 등 노드로 만들어 게임에서 굴리고 꺾습니다. 텍스처는 1024 px WebP, E2200 은 삼각형 수를 절반으로 줄였습니다. 모양·텍스처 자체는 바꾸지 않았습니다.

v48~v52 에 쓰던 Kenney Car Kit(CC0) 차량은 v53 에서 이 실사 차량으로 바뀌었습니다.

v86에서는 `tools/vehicles/repair-wheels.cjs`로 v85 배포본을 읽어 차체에 남아 있던 타이어 삼각형을 해당 바퀴로 옮겼습니다. E2200·IZH의 원본 앞바퀴에 구워져 있던 조향 자세를 법선으로 추정해 풀고 차량 X축에 맞췄습니다. 트레드 위치·법선으로 회전 중심을 보정하고 압축용 변환을 자식 노드로 분리해 축을 유지합니다. 원본 텍스처·재질·삼각형 수는 보존합니다. 파손 시에는 해당 게임 차량의 타이어 정점만 변형하며 공용 원본은 변경하지 않습니다. 원본과 결과 해시는 `wheel-repair-v86.json`에 기록합니다.
