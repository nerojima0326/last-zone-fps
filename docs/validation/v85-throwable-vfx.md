# v85 큰 수류탄 폭발·실사풍 화염병

기준 커밋은 v84 `9dc90c0d4eb27782ba931b4da0073ad4c24f202c`이다. 같은 사격장·카메라·난수·경과 시간에서 전후 화면을 비교했다.

## 확인한 원인과 변경

기존 수류탄의 섬광은 최대 1.8m, 수명 0.085초이고 불꽃 분출도 0.08~0.16초에 끝났다. 새 섬광은 최대 **5.4m로 3배**, 수명은 **0.17초**다. 분출은 2~3.3m에서 3.4~4.6m로 퍼지고 0.23~0.4초 동안 보인다. 지면 먼지 고리는 6.5m에서 **12m**로 넓혔고, 연기의 크기·확산 속도와 파편 수도 함께 높였다. 공중 폭발에는 지면 먼지 고리를 붙이지 않는 기존 조건을 유지한다.

화염병은 128픽셀 불꽃 8장을 짧은 수명의 입자로 반복해 같은 촛불 윤곽이 떨어져 보였다. 이제 **실사풍 화염 원화 16장**을 사용하고, 알파를 곱한 두 프레임을 보간한다. 불길은 연료면에 고정하고 내부·외부의 높이와 위상을 다르게 하며 기존 점 사이의 빈 공간도 채운다. 검은 배경에서 광량을 기준으로 화염만 분리해 흰 번짐을 제거한다. 얇게 갈라지는 불꽃·검은 연기·작은 불티·연료 그을음으로 이어진다.

원화는 이 게임을 위해 ImageGen으로 새로 만들었으며 실제 촬영본은 아니다. [보관한 원화와 변환 방법](../../assets/sources/vfx/README.md).

## 전후 화면

| 장면 | v84 | v85 |
| --- | --- | --- |
| 수류탄, 폭발 0.25초 | [이전](v85-grenade-before.png) | [이후](v85-grenade-after.png) |
| 화염병, 점화 1.2초 | [이전](v85-molotov-before.png) | [이후](v85-molotov-after.png) |
| 가까운 화염병 | [이전](v85-molotov-near-before.png) | [이후](v85-molotov-near-after.png) |
| 먼 수류탄 | [이전](v85-grenade-far-before.png) | [이후](v85-grenade-far-after.png) |

[실제 게임 불길 움직임, 2초 영상](v85-molotov-motion.webm). 영상은 근거리 게임 화면을 초당 12장으로 저장한 자료이며 실제 게임 FPS 측정 자료가 아니다.

## 로딩·성능·회귀 검사

배포 텍스처는 **189,214바이트**, 1024×1024 한 장이다. 일반 RGBA와 밉맵을 사용하는 GPU 메모리는 약 **5.3MiB**다. 원본 PNG는 게임에서 요청하지 않는다. 별도의 동영상 디코더나 실시간 볼륨 렌더링을 추가하지 않았다.

텍스처 로딩을 의도적으로 멈춘 상태에서도 메뉴에 진입했다. 내려받기가 끝나면 내장 불꽃에서 새 원화로 바뀌고, 404인 경우 내장 불꽃으로 훈련을 계속했다. 정상 로딩에서는 텍스처 요청이 한 번이었다. 원화 16장을 실제 셰이더로 각각 렌더해 서로 다른 결과와 네 모서리의 완전한 투명도를 검사했다.

수류탄 피해와 판정은 변경하지 않았다. 화염병의 **반경 3.4m·지속 9초**도 유지했다. 실제 충돌·중복 점화 방지·병 모델 제거, 네 품질 단계, 30·60·144 FPS의 화염 개수, 9초 수명과 바닥 고정, 장면 재설정과 누락 복귀를 검사했다.

효과는 기존 세 인스턴스 메시와 조명 두 개를 사용한다. 품질별 스프라이트 제한 80 / 128 / 192 / 256과 파편 제한 24 / 48 / 72 / 96을 유지한다. 가까운 85m 안의 최대 여섯 화염에만 세부 효과를 만들고, 멀어지면 고정 불길도 짧게 감쇠해 슬롯을 반환한다. 다시 다가가면 기존 연료면에 표시가 복귀하며 피해 판정은 계속된다. 수류탄·화염병 **30쌍**을 반복해도 장면 객체·지오메트리·텍스처가 늘지 않고, 초기화 후 256개 슬롯이 모두 돌아왔다.

같은 시점의 전체 드로 수는 전후 동일했다. 표준 시야 140~142회, 근거리 156회, 원거리 164회였다. Chromium 156 / Three.js r160 / SwiftShader 환경에서 검사했다. 화면 캡처의 동기화 렌더 시간은 소프트웨어 GPU의 단일 프레임 참고값이며 실제 GPU의 FPS 변화율로 해석하지 않는다. [전후 화면 원시 자료](v85-vfx-comparison.json) · [화염·로딩 검사](v85-fire-checks.json) · [품질·반복 투척 검사](v85-vehicle-vfx-checks.json) · [실행한 검사 목록](v85-checks.json).

## 재현

```sh
node tools/prepare-fire-flipbook.cjs
node tools/check-fire-flipbook.cjs
REPORT=/tmp/lz-v85-vehicle-vfx.json node tools/check-vehicle-throwable-vfx.cjs
VFX_BASE=9dc90c0d4eb27782ba931b4da0073ad4c24f202c VFX_VIEWS=standard,near,far node tools/capture-throwable-vfx.cjs before /tmp/lz-v85-final
VFX_BASE=9dc90c0d4eb27782ba931b4da0073ad4c24f202c VFX_VIEWS=standard,near,far VFX_ANIMATE=1 node tools/capture-throwable-vfx.cjs after /tmp/lz-v85-final
```

기존 `NODE_PATH`, `THREE_DIR`, `CHROME_BIN` 설정과 ffmpeg를 사용한다. 새 화염 검사는 CI에도 추가했다.
