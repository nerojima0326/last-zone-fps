# 총기 사운드 · 장전 리듬 (v84)

## 소리

총기 30종의 발사음은 `js/weapon-sound-design.js`의 새 압력파 합성기로 만든다. 30종의 음색과 조작음 공명을 각각 조율하며, 이전 발사 PCM은 입력으로 사용하지 않는다. 조작음은 **The Free Firearm Sound Library**(CC0)의 기존 편집본을 고정 커밋에서 읽어 총별 EQ·접촉층을 더한다. 트랙 ID와 출처는 [오디오 출처](../assets/audio/weapons/CREDITS.md)와 `assets/audio/weapons/manifest.json`(schema 2)에 있다.

| 파일 | 내용 |
|---|---|
| `<id>-report-v84.mp3` | 총기별 4개 새 발사 변형 + `near`/`far`, 총 30개 뱅크 |
| `<id>-handling-v84.mp3` | 총별 조작음 `magout` `magin` `open` `close` `shell` `port` `dry` 등, 독립 뱅크 30개 |
| `switch.mp3` | 사격 모드 전환 |

재생 규칙 (`js/weapon-audio.js`):

- 내 총은 네 변형을 번갈아 쓰고 발사 변형 간 크기를 맞춘다. 연사 때는 앞 발의 꼬리를 22%로 줄이고 최대 4발만 겹친다.
- 남의 총은 45~135m 구간에서 near → far로 넘어가고, 거리/343초 늦게 들린다.
- 조작음은 장전 모션의 사건 시각(`G.Guns.reloadEvents`)에 맞춰 재생한다. 볼트액션은 손잡이 들기 → 뒤로, 앞으로 → 내리기를 나눠 낸다. 빈 산탄총의 배출구 한 발은 `port` 소리다.
- MP3 디코더마다 앞쪽 지연이 달라서, 디코딩한 파형에서 각 소리의 실제 시작점을 다시 찾는다.
- 파일을 못 읽거나 오래된 매니페스트가 남으면 동일한 원본 합성기를 사용한다. 전체·총기 음량 설정을 따른다.

발사·조작 뱅크 다시 만들기: `node tools/build-original-weapon-audio.cjs` (ffmpeg와 원본 커밋 `83563f6` 필요). 조작음은 항상 같은 고정 원본에서 가공하므로 반복 실행해도 중복 가공하지 않는다. 각 뱅크를 한 번씩 다운로드·디코딩하고 각 큐를 별도로 정렬한다. 전후 비교 파일은 `node tools/compare-weapon-audio-v84.cjs`로 만든다.

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

`check-weapon-audio.cjs`는 고유 뱅크 61개 디코딩, 30종 발사·장전음의 구분, 조작음이 총성보다 작은지, 원거리 감쇠, 연사 중 클리핑, 소음기·음소거·노드 정리와 파일이 없을 때 새 합성음으로 복귀하는지 확인한다. [v84 전후 비교·검증](../docs/validation/v84-vehicle-audio-vfx.md).
