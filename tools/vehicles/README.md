# 차량 바퀴 보정

`repair-wheels.cjs`는 v85 커밋 `401a95292dae33004113cb06264fcebba1934177`의 배포 GLB를 입력으로 쓴다. 현재 출력 파일을 다시 입력으로 가공하지 않는다.

```sh
npm install --prefix /tmp/lz-vehicle-tools --no-audit --no-fund @gltf-transform/core@4.1.1 @gltf-transform/extensions@4.1.1 @gltf-transform/functions@4.1.1 meshoptimizer@0.23.0
NODE_PATH=/tmp/lz-vehicle-tools/node_modules node tools/vehicles/repair-wheels.cjs
```

다른 출력 폴더를 마지막 인자로 지정할 수 있다. 원본 커밋을 포함한 Git 이력이 필요하다.

- 기존 바퀴의 평평한 옆면 법선의 우세 방향으로 원본 조향각을 추정한다. 꺾인 원본의 축에 맞는 원통에서 타이어 삼각형을 회수한 뒤 앞바퀴의 조향 자세를 풀어 X축으로 굴릴 수 있게 한다.
- 트레드의 위치·법선으로 중심을 추정하고, 회전축 노드와 양자화 해제용 기하 노드를 나눈다.
- 같은 재질의 프리미티브를 합쳐 정점 용접·meshopt 압축을 적용한다. 텍스처의 바이트와 삼각형 수를 검사한다.
- `wheel-repair-v86.json`에 파일 해시, 원본 조향각, 중심, 회수한 삼각형 수와 용량을 기록한다.

브라우저 검사는 `node tools/check-vehicle-wheels.cjs`를 사용한다. `NODE_PATH`에 Playwright, `THREE_DIR`에 Three.js r160, `CHROME_BIN`에 Chromium 경로를 지정하는 기존 검사 환경을 사용한다. 모델 3종과 기본 대체 차량, 총기 30종, 주행·충돌·수명과 리소스 정리를 검사한다.
