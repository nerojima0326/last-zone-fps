# 모바일 나뭇가지 모델 (v97)

`tree-branches.glb`는 기존 게임이 [EZ-Tree](../../../vendor/ez-tree.es.js)로 생성하는 가지 메시 9종을 경량화한 것입니다. 생성기는 [MIT 라이선스](../../../vendor/ez-tree.LICENSE.txt)를 유지합니다. 기존 게임의 종류별 프리셋·시드·크기를 사용하고, UV·노멀·형태를 보존하며 인덱스와 정점을 줄였습니다. 잎 메시·원거리 수관 사진은 기존 생성 결과를 사용합니다.

[build-mobile-models.cjs](../../../tools/optimize/build-mobile-models.cjs)로 재생성할 수 있습니다. 프리셋·시드·전후 삼각형 수와 파일 SHA-256은 [manifest.json](manifest.json)에 있습니다. PC는 기존 절차적 메시를 사용하며, 모바일 파일이 누락되면 기존 가지 메시로 복귀합니다.

같은 도구로 만든 군인의 모바일 파생본은 [SWAT 크레딧](../../char/swat/CREDITS.md)의 원작자·CC BY 4.0 조건을 유지합니다.
