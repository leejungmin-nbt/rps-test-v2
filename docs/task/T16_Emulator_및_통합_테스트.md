# T16 — Firebase Emulator 통합 테스트

> Emulator 위에서 보안 규칙·Callable·페이즈 전이 5종·Pub/Sub 트리거를 검증한다. Cloud Tasks 는 우회 어댑터로 모킹한다.

## 가이드 정본

- [9. 호스팅·배포·환경](../guide/09_호스팅_배포_환경.md) §9.5.4, §9.9
- [8. 자동진행 및 서버리스 함수](../guide/08_자동진행_및_서버리스_함수.md) §8.5

## 선행

- [T02](./T02_데이터_모델_및_보안_규칙.md), [T08](./T08_processBatch.md), [T14](./T14_Cloud_Tasks_PubSub_IAM.md)

## 구현 항목

### Emulator 활성화 (9.5.4)

- [ ] auth / firestore / functions / pubsub / hosting / ui 모두 활성화
- [ ] `firebase emulators:start` 한 명령으로 기동

### Cloud Tasks 우회 (9.9.2)

- [ ] (i) 인메모리 큐 어댑터: `enqueueTask({ name, scheduleTime, payload })` → 시각 도달 시 직접 함수 핸들러 호출. OIDC 우회
- [ ] (ii) HTTP 직접 호출 옵션: scheduled time 도달 시 함수 endpoint 직접 POST
- [ ] 우회 분기 활성화는 `ENV` 가 dev / emulator 일 때만. prd 코드에는 절대 들어가면 안 됨

### 보안 규칙 단위 테스트

- [ ] 6.9 권한 매트릭스 핵심 분기 (T02 산출물 재사용)
- [ ] anon / 본인 / 타인 / admin × 컬렉션별 read/write

### Callable 단위 테스트

- [ ] `joinGame`: 재호출 매트릭스 12분기 (T04)
- [ ] `submitChoice`: 5분기 (T05)
- [ ] `submitWinnerInfo`: 5분기 (T09)

### 페이즈 전이 5종 통합 테스트 (8.5)

- [ ] `waiting → countdown` (전이 #1)
- [ ] `countdown → select` (전이 #2)
- [ ] `select → reveal` (전이 #3, 첫 진입 + 복구 진입)
- [ ] `reveal → countdown` (전이 #4, finalizer 결정적 enqueue)
- [ ] `reveal → ended` (전이 #5, winner / carryover)

### 1라운드 통합 시나리오 (9.9.3)

- [ ] 입장 → countdown → select 제출 → reveal → 다음 라운드 또는 종료까지 한 번에 진행
- [ ] `select` 마감 전 `adminChoice` 노출 0건 검증
- [ ] 미제출자 자동 탈락 검증 (3.2 마감까지 미제출 → eliminated)
- [ ] 우승자 1명 시 `result/summary` 생성 + 우승자 폼 제출까지

### 부분 실패 시나리오

- [ ] `endRound` 가 publish 4/10 후 함수 종료 → 재시도로 6~9 batch 만 재발행 (8.8.4)
- [ ] `processBatch` 가 chunk 처리 도중 종료 → 재시도로 미처리 chunk 만 갱신
- [ ] 같은 batch 두 번 도착 → 두 번째 즉시 ack

## 산출물

- `functions/test/rules/*.test.ts` (보안 규칙)
- `functions/test/callable/*.test.ts` (Callable 단위)
- `functions/test/integration/round.test.ts` (1라운드 시나리오)
- `functions/test/integration/recovery.test.ts` (부분 실패 복구)
- 인메모리 Cloud Tasks 어댑터 (`functions/src/adapters/tasks.ts` 의 dev 분기)

## 완료 조건

- [ ] `firebase emulators:exec --import=./testdata "npm test"` 가 모든 테스트 통과
- [ ] 1라운드 통합 시나리오가 입장 → 우승까지 자동 진행
- [ ] partial publish 후 `endRound` 재시도가 정확히 누락 batch 만 재발행
- [ ] OIDC 우회 분기가 `ENV != dev|emulator` 환경에서 활성화되지 않음을 정적 분석 또는 빌드 시 검증
- [ ] 보안 규칙이 6.9 매트릭스 전체를 만족

## 위임 / 미결정

- prd 코드에 OIDC 우회 분기 누출 방지 검증 도구 → 13장 (lint rule, build-time check)
