# 장전 애니메이션 (v40)

저작자: **Cransh** ([Sketchfab](https://sketchfab.com/ccransh)). 두 원본의 glTF `asset.extras` 및 AK 배포본의 `license.txt`에 **CC BY 4.0**이 명시되어 있습니다. 코드 저장소의 MIT 표기 대신 모델·애니메이션 자체의 CC BY 4.0 조건을 따릅니다.

| 게임 적용 | 원본 / 클립 | GitHub 배포본 |
|---|---|---|
| SC-17 · SA-12 · AA-12의 잔탄 장전 | [FPS AK-74m animations](https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14) / `Rig\|AK_Reload` | [Ayush-Mohanty/FPS-Arms-3D](https://github.com/Ayush-Mohanty/FPS-Arms-3D/tree/c80a452e680c5a27c9e936176eb17e446869529a/Models/fps_ak-74m_animations) |
| 같은 총기의 빈 탄창 장전 | 같은 원본 / `Rig\|AK_Reload_full` | 같은 배포본 |
| M-1014의 탄약을 꺼내고 한 발씩 넣는 동작 | [FPS Arms remington (shotgun)](https://sketchfab.com/3d-models/fps-arms-remington-shotgun-e68ef617fe8a48cca8610d016ffd5881) / `Armature\|SG_FPS_Reload` | [lawrior/fps-arms](https://github.com/lawrior/fps-arms/tree/89a0088101869b275e7835da9f7fa124f192ba5f) |
| DB-2의 탄약을 가져오는 손 동작·총기 자세 | 같은 샷건 클립을 열린 약실 위치와 두 발 삽입 단계에 맞춰 조정 | 같은 배포본 |

## 변경·적용 방식

- 원본 메시·텍스처를 복사하는 대신, 애니메이션의 손목 경로와 총기 위치·회전을 60 Hz로 추출해 `motion.json`에 포함했습니다. 추출본도 CC BY 4.0으로 제공합니다.
- 이 데이터로 기존 게임 리그를 구동합니다. 총기 자세는 원본 곡선을 중심으로 적용하고, 손이 이동하는 구간에는 원본 경로의 굴곡을 옮겼습니다. 총몸 주변을 안전하게 지나도록 경로·이동 폭을 조정했습니다.
- 총기마다 탄창을 잡고 빼기, 새 탄창 삽입, 노리쇠 조작 시점을 맞춰 시간을 재배치합니다. 접촉 순간에는 기존 IK 기준점을 유지하고, 손에 든 탄창·산탄이 실제 손 위치를 따라갑니다.
- M-1014는 원본의 여러 발 장전 중 한 번의 탄약 이동 사이클을 현재 게임의 한 발 장전마다 반복합니다. 원본의 펌프 사격 애니메이션은 사용하지 않습니다.
- **DB-2 전용의 중절식 원본 클립을 적용한 것은 아닙니다.** Remington의 탄약 이동·총기 자세를 중절식 리그에 맞췄으며, 총열 개폐·탄피 배출·두 발 동시 삽입은 기존 게임 동작을 유지합니다.
- 기존 장전 시간·탄약 계산·탄 수에 따른 사운드 이벤트·장전 중단 규칙을 유지합니다. 다른 총기와 M4·Glock의 전용 애니메이션은 유지합니다.

게임은 번들된 JSON을 시작할 때 자동 로딩합니다. 파일 선택·업로드·외부 사이트 연결이 필요하지 않습니다. 데이터 파일을 읽지 못하면 기존 장전 모션으로 실행합니다.

## 라이선스·재생성

This work is based on “FPS AK-74m animations” and “FPS Arms remington (shotgun)” by Cransh, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source links are listed above. Changes: curve extraction, resampling, coordinate conversion, timing retargeting, contact constraints and shotgun phase adaptation.

전문: [LICENSE-CC-BY-4.0.txt](LICENSE-CC-BY-4.0.txt).

고정 원본 URL·커밋·SHA-256: [`tools/reload-motion-sources.json`](../../../tools/reload-motion-sources.json).

```sh
python3 tools/fetch-reload-motions.py
THREE_DIR=/path/to/node_modules/three node tools/extract-reload-motions.mjs \
  tools/_reload-src assets/animations/reloads/motion.json
```

원본 입력은 Git에서 제외한 `tools/_reload-src/`에 저장합니다. 다운로드와 추출 시 SHA-256을 검증합니다. 플레이 중에는 이 도구나 원본 파일이 필요하지 않습니다.
