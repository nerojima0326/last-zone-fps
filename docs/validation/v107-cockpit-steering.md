# v107 운전석 조향 방향

`vehicles.js`의 A 입력은 `steer > 0`, 차체 yaw 증가, 앞바퀴 좌회전이다. `vehicle-cabin.js`만 `-(v.steer||0)*.72`로 뒤집혀 있었다. 운전자를 향한 핸들 +Z축에 맞게 부호를 바로잡았다. 손 접촉점과 손목 자세는 같은 각도를 공유한다.

`check-cabin-steering.cjs`는 실제 키보드/터치 입력을 넣고 물리를 0.5초 진행한다. porter/e2200/izh/대체 차량의 내외부 시점 16개씩 검사했다.

| 검사 | 수정 전(eaf46b2) | 수정 후 |
| --- | --- | --- |
| A/D 핸들 회전·카메라 투영 방향 | 16개 실패(내부 투영도 반대) | 16개 통과 |
| 차체·앞바퀴 조향 | 통과 | 통과 |
| 손바닥 접촉 오차 25mm 이하 | 통과 | 통과 |
| 모바일 가상 스틱 조향 | 미측정 | 16개 통과 |

명령: `CHROME_BIN=/usr/bin/chromium THREE_DIR=$PWD/node_modules/three node tools/check-cabin-steering.cjs`. 터치는 `CABIN_MOBILE=1`, 과거 코드 재현은 `BASELINE_CABIN=eaf46b2`를 추가한다. 상세 JSON은 저장소 밖 `/workspace/artifacts/v107-cockpit/01-steering/`에 저장했다. 이 검사는 60Hz 고정 물리 재현이며 기기 FPS 측정은 아니다.
