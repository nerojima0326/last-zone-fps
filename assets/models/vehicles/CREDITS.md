# 차량 모델 (v48)

| 파일 | 게임 속 차량 | 원본 | 라이선스 |
|---|---|---|---|
| `suv.glb` | SUV (예비 타이어) | Kenney Car Kit — suv | CC0 1.0 |
| `truck.glb` | 픽업트럭 | Kenney Car Kit — truck | CC0 1.0 |
| `sedan.glb` | 세단 | Kenney Car Kit — sedan | CC0 1.0 |
| `van.glb` | 밴 | Kenney Car Kit — van | CC0 1.0 |

- 원작: [Kenney](https://kenney.nl) "Car Kit" (CC0 1.0, 퍼블릭 도메인).
- 받은 곳: GitHub 사본 [kidscancode/3d_car_sphere](https://github.com/kidscancode/3d_car_sphere) `assets/kenney_car_kit/` (커밋 `cabc5c0`).
- 가공 (`tools/vehicles/build.cjs`): 정점 용접·중복 제거·양자화·meshopt 압축만 합니다 (원본 4개 610 KB → 73 KB). 노드(차체 `body`, 바퀴 `wheel_frontLeft` 등)는 그대로 두어 게임에서 바퀴를 굴리고 앞바퀴를 꺾습니다.
- 게임(`js/vehicles.js`)에서 1.6배(미터)로 키우고, 바퀴 바닥을 땅에, 앞뒤 바퀴 가운데를 원점에 맞춥니다. 차체 색은 차종마다 몇 가지 색 중 하나로 칠합니다. 폭발한 차는 그을린 재질로 바꿉니다.
