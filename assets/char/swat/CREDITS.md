# 특수부대 캐릭터 (v53)

- 원본: "S.W.A.T. Operator" — Mateusz Woliński (Sketchfab, CC-BY-4.0), Mixamo 뼈대
- 받은 곳: GitHub 사본 [Nik-WEBJS/web3-telegram-game](https://github.com/Nik-WEBJS/web3-telegram-game) `frontend/public/assets/swat`
- This work is based on "S.W.A.T. Operator" (https://sketchfab.com/3d-models/swat-operator-9e82fabf26194896b5ad4a364d864eab) by Mateusz Woliński (https://sketchfab.com/jeandiz) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

가공 (`tools/soldiers/build-swat.cjs`): 손에 든 소총·탄창과 팔 패치 메시를 빼고, 재질 10개를 아틀라스 1장으로 합쳐 메시 2개(몸, 헬멧+야시경)로 만들었습니다. 헬멧·야시경·군화·파우치 등은 삼각형 수를 줄였습니다 (50,400 → 20,700). 장비 색만 바꾼 위장 아틀라스 3가지(레인저 그린 · 코요테 · 회색)를 더 만들었습니다. 뼈 이름은 `mixamorig:` 와 번호를 뗐습니다.

## v97 모바일 변환본

`swat-mobile.glb`는 위 `swat.glb`의 모바일 전용 파생본입니다. 기존 텍스처·재질·66개 뼈와 피부 가중치를 유지하며 지오메트리를 20,698 → 12,770개 삼각형으로 줄였습니다. 원본과 모바일 변환본의 뼈 세계 행렬·전체 외곽 크기 오차는 검사에서 0이었습니다. 위 원작자와 CC BY 4.0 조건을 그대로 유지합니다.

변환 도구: [build-mobile-models.cjs](../../../tools/optimize/build-mobile-models.cjs). 원본·결과 SHA-256과 삼각형 수는 [manifest.json](../../models/mobile/manifest.json)에 기록했습니다. PC는 기존 원본을 사용하고, 모바일 변환본이 없으면 기존 원본으로 복귀합니다.
