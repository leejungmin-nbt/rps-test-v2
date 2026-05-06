# T07 — `endRound` + batch manifest

> `select → reveal` 전이, `adminChoice` 결정, persisted batch manifest 사전 고정, Pub/Sub 분산 dispatch 까지를 한 함수에서 처리한다.

## 가이드 정본

- [8. 자동진행 및 서버리스 함수](../guide/08_자동진행_및_서버리스_함수.md) §8.5 (전이 #3), §8.6.4, §8.8

## 선행

- [T06](./T06_라운드_페이즈_엔진.md), [T14](./T14_Cloud_Tasks_PubSub_IAM.md) 의 Pub/Sub 토픽 셋업

## 구현 항목

### 호출 주체 / 인증

- [ ] HTTP 함수 (Cloud Tasks 호출용) + 검증 단계 한정 Callable 변형 별도 함수
- [ ] OIDC 토큰의 `serviceAccountEmail` + `audience` 두 축 매칭

### 가드 (8.5 전이 #3)

- [ ] `currentRound == roundNumber` AND
  - 첫 진입: `phase == "select"` AND `now() >= roundEndsAt`
  - 복구 진입: `phase == "reveal"` AND (`manifestStatus != "ready"` OR `processedBatchCount < expectedBatchCount`)

### 첫 진입 트랜잭션

- [ ] `phase = "reveal"`, `rounds/{n}.phase = "reveal"`
- [ ] `rounds/{n}.adminChoice = crypto.randomInt(0, 3)` (서버 무작위, 한 번만)
- [ ] `rounds/{n}.revealedAt`, `rounds/{n}.survivorsBefore`
- [ ] `rounds/{n}.manifestStatus = "building"`, `expectedBatchCount = 0`, `processedBatchCount = 0`

### 복구 진입

- [ ] `adminChoice` 재추첨 금지. 기존 값 유지
- [ ] `revealedAt` 유지

### batch manifest 사전 고정 (8.8.3)

- [ ] `players` 컬렉션을 `__name__` 정렬로 cursor scan
- [ ] 처리 대상 필터: `status == "alive"` AND `lastProcessedRound < n`
- [ ] 1000명 단위로 UID range 분할
- [ ] deterministic path `games/{gameId}/rounds/{n}/batches/{i}` 에 idempotent upsert (`status = "pending"`, range, limit)
- [ ] 기존 batch 문서 range/limit 일치 검증, 불일치 시 `manifestStatus = "failed"` + 진단 메시지
- [ ] 모든 batch 문서 일관 기록 후 `expectedBatchCount` set, `manifestStatus = "ready"`

### Pub/Sub publish (8.8.2)

- [ ] persisted batch 문서 기준으로 `process-batch` 토픽 publish
- [ ] 메시지 페이로드: `{ gameId, roundNumber, batchIndex, expectedBatchCount, startAfterUid, endAtUid, limit }`
- [ ] `manifestStatus == "ready"` 인 재시도 → manifest 재산출 금지, `pending`/`failed`/stale `processing` batch 만 재발행

### 멱등성

- [ ] 결정적 task name `endRound-{gameId}-{n}` (자연 멱등)
- [ ] persisted manifest + 가드 두 분기로 partial publish 흡수 (8.8.4)

## 산출물

- `functions/src/endRound.ts`
- batch manifest 산출 유틸
- Pub/Sub publish 어댑터
- 단위 테스트 + 통합 테스트 (첫 진입 / 복구 진입 / partial publish 후 재시도 / manifest 충돌)

## 완료 조건

- [ ] `phase == "select"` AND `now() >= roundEndsAt` 첫 진입 시 `adminChoice` 가 결정되고 `phase = "reveal"`
- [ ] 같은 `endRound` 가 두 번 호출되어도 `adminChoice` 가 재추첨되지 않음
- [ ] 1만 alive 가정 시 batch 10개로 분할되어 persisted, Pub/Sub 10건 publish
- [ ] publish 4건 후 함수 crash → 재시도 시 `manifestStatus == "ready"` 분기에서 6~9 batch 만 재발행
- [ ] OIDC 검증 실패 시 401, 가드 불일치 시 200 + no-op

## 위임 / 미결정

- `adminChoiceHash` (commit-then-reveal) → 13장
- batch failure 운영 복구 절차 → 10장
