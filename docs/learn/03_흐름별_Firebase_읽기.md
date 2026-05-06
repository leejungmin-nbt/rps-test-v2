# 3. 흐름별 Firebase 읽기

이 문서는 [사용자 Flow](../flow/README.md)를 Firebase 서비스 관점에서 다시 읽는다.

## F01 — 이벤트 진입 및 입장

관련 문서: [F01](../flow/F01_이벤트_진입_및_입장.md), [T03](../task/T03_익명_Auth_및_URL_파라미터.md), [T04](../task/T04_joinGame_입장_트랜잭션.md)

```txt
사용자 → Hosting → React SPA → Anonymous Auth → joinGame → Firestore
```

| 단계 | Firebase 용어 | 쉬운 설명 |
|---|---|---|
| 이벤트 URL 열기 | Hosting, rewrite | `/event?...` 요청을 React 앱으로 보낸다. |
| 임시 로그인 | Anonymous Auth | 회원가입 없이 Firebase Auth UID를 만든다. |
| 입장 요청 | Callable Function | 클라이언트가 `joinGame` 서버 함수를 부른다. |
| 입장 검증 | transaction | 정원, 중복, phase를 한 번에 확인하고 쓴다. |
| 중복 차단 | claims | 같은 Adison UID가 이미 입장했는지 본다. |
| 생존자 수 증가 | shard counter | 많은 사용자가 동시에 들어와도 카운터 병목을 줄인다. |

## F02 — 라운드 참여 및 선택

관련 문서: [F02](../flow/F02_라운드_참여_및_선택.md), [T05](../task/T05_submitChoice.md), [T06](../task/T06_라운드_페이즈_엔진.md)

```txt
React SPA → Firestore 상태 조회 → submitChoice → Firestore player 갱신
```

| 단계 | Firebase 용어 | 쉬운 설명 |
|---|---|---|
| 본인 상태 보기 | onSnapshot | 내 player 문서 변화를 실시간으로 받는다. |
| 공통 상태 보기 | polling | 게임/라운드 공개 상태를 주기적으로 읽는다. |
| 선택 제출 | Callable Function | `submitChoice`가 서버에서 검증 후 저장한다. |
| 중복 제출 방지 | guard | 이미 낸 선택인지, 마감 전인지 확인한다. |

## F03 — 결과 확인 및 관전

관련 문서: [F03](../flow/F03_결과_확인_및_관전.md), [T07](../task/T07_endRound_batch_manifest.md), [T08](../task/T08_processBatch.md)

```txt
Cloud Tasks → endRound → Firestore/PubSub → processBatch → Firestore → React SPA
```

| 단계 | Firebase 용어 | 쉬운 설명 |
|---|---|---|
| 선택 마감 실행 | Cloud Tasks | 정해진 시각에 `endRound`를 호출한다. |
| 결과 공개 전환 | HTTP Function | `endRound`가 `reveal`로 바꾸고 애디슨 손을 정한다. |
| 처리 범위 고정 | batch manifest | 판정할 사용자 범위를 미리 기록한다. |
| 대량 판정 분산 | Pub/Sub | batch별 메시지를 보내 판정을 나눠 처리한다. |
| batch 판정 | processBatch | 1000명 단위로 승패와 탈락을 처리한다. |
| 관전 화면 | 공개 Firestore read | 다른 player 개별 정보 없이 공개 집계만 본다. |

## F04 — 우승 및 지급정보 제출

관련 문서: [F04](../flow/F04_우승_및_지급정보_제출.md), [T09](../task/T09_submitWinnerInfo.md), [T13](../task/T13_우승_종료_및_지급_폼.md)

```txt
React SPA → Firestore 종료 상태 확인 → submitWinnerInfo → Firestore 비공개 영역 저장
```

| 단계 | Firebase 용어 | 쉬운 설명 |
|---|---|---|
| 종료 상태 확인 | Firestore read | `phase == ended`, `endedReason`을 본다. |
| 우승자 폼 | Callable Function | `submitWinnerInfo`로 지급 정보를 보낸다. |
| 최종 검증 | request.auth.uid | 서버가 진짜 우승자 본인인지 확인한다. |
| 개인정보 저장 | winnerPrivate | 공개 문서가 아닌 제한 영역에 저장한다. |

## F05 — 예외 및 재진입

관련 문서: [F05](../flow/F05_예외_및_재진입.md), [T04](../task/T04_joinGame_입장_트랜잭션.md)

| 상황 | Firebase 관점 |
|---|---|
| 필수 URL 값 누락 | 클라이언트에서 `joinGame` 호출 전에 안내한다. |
| 같은 사용자의 재진입 | `claims`와 `players/{userId}`를 보고 기존 상태를 복구하거나 거부한다. |
| phase가 이미 진행 중 | `joinGame` 가드가 신규 입장을 막는다. |
| 함수/큐 재시도 | 멱등 처리로 같은 작업이 여러 번 반영되지 않게 한다. |

## F06 — 운영 검증 및 전환

관련 문서: [F06](../flow/F06_운영_검증_및_전환.md), [T14](../task/T14_Cloud_Tasks_PubSub_IAM.md), [T16](../task/T16_Emulator_및_통합_테스트.md), [T17](../task/T17_관측_로그_알림.md), [T18](../task/T18_부하테스트_및_운영_매뉴얼.md)

| 단계 | Firebase / Google Cloud 용어 | 쉬운 설명 |
|---|---|---|
| 로컬 검증 | Emulator | 실제 배포 전에 로컬에서 통합 테스트한다. |
| 권한 설정 | IAM, service account | 어떤 서버 작업자가 어떤 함수를 부를 수 있는지 정한다. |
| 호출 검증 | OIDC, audience | Cloud Tasks 호출이 진짜인지 확인한다. |
| 로그 확인 | Cloud Logging | 함수 오류와 처리 상태를 검색한다. |
| 알림/지표 | Cloud Monitoring | 실패율, 큐 상태, batch 상태를 관측한다. |
| 출시 전 검증 | 부하 테스트 | 1k → 5k → 1만 단계로 병목을 찾는다. |
