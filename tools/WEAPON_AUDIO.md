# 총기 사운드 · 장전 리듬 (v76)

## 소리

총기 30종의 발사음은 `js/weapon-sound-design.js`의 원본 합성기로 만든다. 추가 15종의 음색은 `js/weapon-catalog.js`에 있다. 조작음은 **The Free Firearm Sound Library**(CC0)의 192 kHz 마스터 트랙을 사용한다. 트랙 ID와 공유 관계는 [오디오 출처](../assets/audio/weapons/CREDITS.md)와 `assets/audio/weapons/manifest.json`(schema 2)에 있다.

| 파일 | 내용 |
|---|---|
| `<id>-report-v76.mp3` | 총기별 4개 발사 변형 + `near`/`far`, 총 30개 뱅크 |
| `<base-id>-fx.mp3` | 조작음 `magout` `magin` `open` `close` `shell` `port` `dry` (KR-98은 `up` `down` 추가), 15개 공유 뱅크 |
| `switch.mp3` | 사격 모드 전환 |

재생 규칙 (`js/weapon-audio.js`):

- 내 총은 네 변형을 번갈아 쓰고 발사 변형 간 크기를 맞춘다. 연사 때는 앞 발의 꼬리를 22%로 줄이고 최대 4발만 겹친다.
- 남의 총은 45~135m 구간에서 near → far로 넘어가고, 거리/343초 늦게 들린다.
- 조작음은 장전 모션의 사건 시각(`G.Guns.reloadEvents`)에 맞춰 재생한다. 볼트액션은 손잡이 들기 → 뒤로, 앞으로 → 내리기를 나눠 낸다. 빈 산탄총의 배출구 한 발은 `port` 소리다.
- MP3 디코더마다 앞쪽 지연이 달라서, 디코딩한 파형에서 각 소리의 실제 시작점을 다시 찾는다.
- 파일을 못 읽거나 오래된 매니페스트가 남으면 동일한 원본 합성기를 사용한다. 전체·총기 음량 설정을 따른다.

발사 뱅크 다시 만들기: `node tools/build-original-weapon-audio.cjs` (ffmpeg 필요). 공유 조작음은 파일 경로별로 한 번씩 다운로드·디코딩하고, 각 무기의 큐를 별도로 정렬한다. 조작음 원본의 과거 편집 도구는 `tools/build-weapon-audio.py`다.

## 장전 리듬·자세

- 빈 총 장전 배율 `reloadFactor(empty)`를 1.35에서 1.1로 줄였다. S-12 빈 총 배출구 장전은 1.35초에서 1.1초.
- 장전 손잡이·슬라이드를 당길 때의 기울기(`chRoll`·`chYaw`)가 평소 기울기와 반대 방향이던 총(KA-47, MK-14, SA-12, DE-7, G-18)은 같은 방향의 작은 값으로 바꿔 총이 홱 뒤집히지 않게 했다. 전체 기울기도 줄였다.
- 위로 넘어가 장전 손잡이를 당기는 동작과 G-18 오버핸드 슬라이드 당기기에서 손이 지나가는 높이를 절반쯤으로 낮췄다.

## 검증

```sh
node tools/check-reloads.cjs
node tools/check-clearance.cjs
node tools/check-weapon-audio.cjs
```

`check-weapon-audio.cjs`는 고유 뱅크 46개 디코딩, 30종 발사·장전음의 구분, 조작음이 총성보다 작은지, 원거리 감쇠, 연사 중 클리핑, 노드 정리, 파일이 없을 때의 합성음 복귀를 확인한다. 새 15종의 조작음은 구조가 맞는 기존 CC0 뱅크를 공유하고, 발사 뱅크는 각각 독립적이다.
