# 총기 모델 제작 도구 (`tools/guns`)

게임의 총 13종(`assets/models/guns/<id>.glb`)을 만드는 도구입니다. AR-7(M4A1 FBX)과 P-92(Service Pistol glTF)는 `tools/convert-models.py` 쪽에서 따로 다룹니다.

| 파일 | 하는 일 |
|---|---|
| `kit.js` | 모델러 — 옆·위·앞 단면을 둥글게 다듬어 베벨 돌출, 선반(총열·소염기), 레일·나사·세레이션, 질감 생성(나뭇결·미세 요철·그립 돌기·체크무늬·표면경화), 공통 재질, GLB 내보내기 |
| `designs.js` | 직접 설계한 모델과 기존 기준점. MK-14 · G-18 · M-1911 · DE-7 · R-45에 사용 |
| `imported.js` | CC0 에셋 5종: SC-17 · M-1014 · DB-2 · SA-12 · AA-12. 원본 스킨의 강체 부품을 분리하고 게임의 팔·장전 시스템에 연결 |
| `fetch-imports.py` / `imported-sources.json` | 추가 CC0 원본의 고정 URL·SHA-256과 검증 다운로드 도구. 플레이 시에는 불필요 |
| `real.js` | 실사 CC0 모델 3종 정규화: KA-47(AK-47) · KR-98(Sniper) · S-12(Shotgun) — 수평 보정, 부품 분리, 1K JPEG 텍스처(DirectX 법선 맵 G 반전), 기준점 |
| `build.html` / `build.js` | 브라우저 미리보기 + GLB 내려받기 (기준점 표시: 빨강 총구 · 초록 왼손 · 하늘 장전 손잡이 · 노랑 장전구 · 주황 부품 축 · 흰 조준선 · 파랑 레일) |
| `run.cjs` | 헤드리스로 전부 만들고 glTF-Transform 으로 압축(meshopt + 위치·법선 양자화)해 `assets/models/guns/` 에 저장 |

## GLB 형식

- 좌표: **총 공간** — 원점 = 방아쇠, 총구 −Z, 위 +Y, 오른쪽 +X, 단위 m (실제 크기)
- 메시 `extras.part` = 부품: `body`(고정) · `mag` · `slide` · `charge` · `bolt` · `pump` · `barrel`(중절식) · `cyl`(실린더) · `rearsight`(조준경을 달면 숨김)
- 재질 이름 = 재질 키 (`metal`, `poly`, `grip`, `wood`, `steel` … 실사 모델은 `m`)
- 루트 `extras.lz` = 기준점: `muzzle`, `sight [y, z]`, `rail [y, z, 'body'|'slide']`, `fore`(왼손), `port`(장전구), `charge`, `slideTop`, `magDir`, `pivots`(부품 회전·이동 축), `extra.cylAxis`, `ironDist`(가늠쇠 조준 눈 거리, 선택)

게임(`js/gunmodels.js`)은 이 정보를 그대로 읽어 1인칭 팔 IK·재장전·볼트·펌프·중절·리볼버 애니메이션, 3인칭, 전리품에 씁니다.

## 다시 만들기

### 추가 AR · SG (v39)

완성 GLB 5종은 이미 `assets/models/guns/`에 포함되어 있습니다. 게임은 시작할 때 자동으로 불러오므로 플레이어가 원본을 받거나 파일을 선택할 필요가 없습니다. [모델별 출처·라이선스·가공 내역](../../assets/models/guns/CREDITS.md).

개발자가 원본으로부터 재생성할 때만 다음을 실행합니다:

```sh
python3 tools/guns/fetch-imports.py
# 아래 공통 도구 의존성을 설치한 다음:
CHROME_BIN=/usr/bin/chromium THREE_DIR=/path/to/node_modules/three \
  node tools/guns/run.cjs build sc17,m1014,db2,sa12,aa12
```

원본 캐시는 `tools/guns/src/imported/`에 저장하며 Git에서 제외합니다. 다운로드는 고정 커밋과 SHA-256을 검증합니다. 빌드 결과는 meshopt 압축과 게임용 기준점을 포함합니다. 권총·DMR·저격총을 재생성할 필요는 없습니다.

### 기존 모델

1. 실사 원본: [3DModelsCC0 Guns & Explosives 팩 GLB 변환본](https://github.com/BoQsc/cc0-guns-explosives-pack-glb/releases) 의 `Guns.Explosives_glb.zip` 에서 `AK47.glb`, `Sniper.glb`, `Shotgun.glb` 를 `tools/guns/src/` 에 넣습니다 (CC0, 저장소에는 올리지 않음).
2. `npm i playwright @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer`
3. `node tools/guns/run.cjs build all` (또는 `build g18,r45`)
   - 미리보기 그림: `node tools/guns/run.cjs view r45 persp,side` · 압축된 결과 확인: `... view r45 side final`
   - 인터넷 없이: `THREE_DIR=<node_modules/three 경로>` 를 주면 three.js CDN 대신 로컬 파일을 씁니다.
4. 브라우저로 보려면 저장소 루트에서 정적 서버(`serve.ps1` 등)를 띄우고 `tools/guns/build.html` 을 엽니다.
