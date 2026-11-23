# LAST ZONE — 유니티판

웹판(Three.js) LAST ZONE 을 유니티로 옮기기 전에 **손맛과 성능을 확인하는 작은 사격장**입니다.
이동 · 총 13종 · 조준 · 사격(탄속·낙차·영점) · 반동 · 장전 · 과녁만 들어 있습니다.

## 처음 여는 법 (5분)

1. **Unity Hub → New project → `Universal 3D` 템플릿** (Unity 6 권장)으로 새 프로젝트를 만듭니다.
2. 이 폴더의 `Assets/LastZone` 폴더를 새 프로젝트의 `Assets` 안에 통째로 끌어다 놓습니다.
3. **glTFast 설치** (총 모델 `.glb` 를 읽는 유니티 공식 패키지):
   `Window → Package Manager → 왼쪽 위 + → Add package by name…` → `com.unity.cloud.gltfast` 입력 → Add
   - 설치하지 않아도 돌아가지만, 총이 상자 모양 대체 모델로 나옵니다.
4. 위 메뉴 **`LAST ZONE → 프로토타입 씬 만들기`** 를 누릅니다. 사격장 씬이 `Assets/LastZone/Scenes/Prototype.unity` 로 만들어집니다.
5. **▶ 재생**. 게임 화면을 한 번 클릭하면 마우스가 잡힙니다 (Esc 로 풀기).

> 입력은 새 Input System 과 예전 Input Manager 둘 다 됩니다. 프로젝트 설정을 바꿀 필요는 없습니다.

## 조작

| 키 | 동작 |
|---|---|
| WASD · Shift · Ctrl/C · Space | 이동 · 달리기 · 앉기 · 점프 |
| 좌클릭 · 우클릭 · R | 사격 · 조준 · 장전 |
| 1 · 2 · 3 · 휠 | 소총 · 산탄총 · 권총 칸 |
| T | 같은 종류의 다음 총 (소총 4 · 산탄총 5 · 권총 4) |
| B | 연사 / 단발 |
| F1 · F2 · F3 · F4 | 도움말 · 영점 조정 모드 · 화면 가운데 점 · 조준 고정 |

## 사격장

- 과녁: 10 · 25 · 50 · 75 · 100 · 150 · 200 · 300 m 에 한 개씩, 35 m · 60 m 에 좌우로 움직이는 과녁.
- 맞으면 붉게 번쩍이고, 체력 100 이 다 닳으면 넘어졌다 2.5초 뒤 일어납니다. 머리는 총별 헤드샷 배율.
- 왼쪽 위에 명중률, 맞힌 곳 옆에 피해량 · 헤드샷 · 거리.

## 웹판에서 그대로 가져온 것

- **수치**: 데미지 · 연사력 · 탄창 · 장전 시간 · 퍼짐 · 반동 · 탄속 · 사거리 감쇠 · 조준 시야각 (`Runtime/GunTable.cs`, 웹판 `js/weapons.js` 에서 자동 생성).
- **총 모델**: `assets/models/guns/*.glb` (CC0). 압축(meshopt)만 풀어서 넣었습니다. 출처 `Models/CREDITS.md`.
- **소리**: 실제 총기 녹음(CC0)을 총·동작별로 잘라 `.ogg` 로. 출처 `Audio/CREDITS.md`.
- **영점 (v70)**: 총알은 눈(화면 가운데)에서 나가고, 조준하면 가늠쇠 끝(고리 조준기는 고리 가운데)이 화면 정가운데에 옵니다. 조준 중에는 조준한 곳까지의 거리만큼 낙차를 보정하고, 지향 사격은 50 m 영점입니다.

## 영점이 조금 어긋나 보이면

F2 → 조준한 채 **↑ / ↓** 로 그 총의 조준선 높이를 0.5 mm 씩 바꿉니다 (총마다 저장).
F3 를 켜면 총알이 가는 진짜 화면 가운데에 하늘색 점이 보입니다. 바뀐 값(`sightHeight`)을 알려 주시면 `GunTable.cs` 에 반영하겠습니다.

## 파일

```
Assets/LastZone/
  Runtime/   PlayerController(이동·시선) · WeaponController(총) · Ballistics(총알) · Target · Hud · LZInput · GunTable · GunDef · GunLibrary
  Editor/    PrototypeBuilder (메뉴: 씬 만들기)
  Models/    총 13종 .glb
  Audio/     총소리 · 장전 소리 .ogg
```

## 섬 맵 · 배틀로얄 (웹판 전체 이식)

웹판 게임 전체(섬 맵 · 봇 · 자기장 · 수송기·낙하 · 아이템 · 부착물 · 투척물 · 차량 · 메뉴·설정·통계 · 훈련장)를 `Sim/` 에 C# 로 옮겼습니다.
게임 규칙은 웹판과 같은 좌표계로 계산하고, 그리는 쪽(`Runtime/GameView.cs`)에서만 유니티 좌표로 바꿉니다.

1. **맵 데이터 만들기** (130MB 라 저장소에는 없습니다): `Tools/map-export` 의 `export.cjs` 로 웹판에서 지형·건물·나무·충돌 상자를 뽑고, `fixnan.py` → `shrink.py` → `splitglb.py` → `pack.py` 순서로 `Assets/LastZone/Map/` 에 넣습니다.
2. 메뉴 **`LAST ZONE → 섬 맵 씬 만들기`** → `Assets/LastZone/Scenes/Island.unity`.
3. **▶ 재생** → 메뉴에서 **게임 시작** 또는 **훈련장**.

```
Sim/       World(지형·충돌) · Match(규칙) · Bot · PlayerCtl · Bullets · Throwables · Vehicles · Attachments · Training · Extras · Data
Runtime/   GameView(그리기) · GameHud(메뉴·HUD·지도) · GameInput · Sfx · Fx · CharacterRig · ViewModel · Settings · Graphics2
```

## 아직 없는 것

AR-7 · P-92 총 모델(상자 대체 모델) · 부착물·조준경 겉모양 · 날씨 하늘 · 팔·손 모델.
