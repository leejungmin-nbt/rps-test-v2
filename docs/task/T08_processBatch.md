# T08 — `processBatch` (Pub/Sub 배치 판정)

> Pub/Sub 메시지 1건당 1000명 분량의 승패 판정·탈락 처리·샤드 차감을 멱등하게 수행한다. 모든 batch 완료 후 다음 라운드 또는 종료를 결정적으로 enqueue 한다.

## 가이드 정본

- [7. 동시성·정원·중복참여 정책](../guide/07_동시성_정원_중복참여_정책.md) §7.3.3, §7.5
- [8. 자동진행 및 서버리스 함수](../guide/08_자동진행_및_서버리스_함수.md) §8.5 (전이 #4, #5), §8.6.5, §8.10

## 선행

- [T07](./T07_endRound_batch_manifest.md), [T14](./T14_Cloud_Tasks_PubSub_IAM.md)

## 구현 항목

### 메시지 처리 단계 (8.6.5)

- [ ] (i) `batches/{i}` 트랜잭션 claim
  - `done` → 즉시 ack
  - `processing` 이고 `startedAt` stale lease 만료 → 재claim
  - `processing` 이고 stale 아님 → ack 하지 않고 재시도 대기
- [ ] (ii) persisted UID range 를 `__name__` cursor 로 조회
  - 후보 = `status == "alive"` 또는 `lastProcessedRound == n` / `eliminatedRound == n` 인 player (이미 이번 라운드 처리된 경우 포함)
  - 이전 라운드 탈락자 제외
- [ ] (iii) `lastProcessedRound < n` 인 생존자만 새로 판정
- [ ] (iv) 판정 규칙
  - `choiceRound == n` 인 선택만 유효
  - 그 외는 미제출자 → 탈락
  - 애디슨 손과 비교: 이긴 사용자 → 생존 유지, 비김/패배/미제출 → `eliminated` + `eliminatedRound = n`
  - 모든 처리 대상에 `lastProcessedRound = n` set
- [ ] (v) 실제로 alive→eliminated 전이된 사용자만 `aliveShardIndex` 로 그룹핑 → 샤드별 `count -N`
- [ ] (vi) persisted UID range 를 Firestore 에서 재조회해 batch 최종 집계 계산 (in-memory buffer 정본 금지)
- [ ] (vii) `batches/{i}.status = "done"` 전환 트랜잭션에서 batch 집계 → `rounds/{n}` increment, `processedBatchCount += 1`

### 트랜잭션 경계 (8.6.5)

- [ ] 1000명을 단일 Firestore 트랜잭션에 묶지 않는다
- [ ] persisted UID range 를 chunk 로 나누고, 각 chunk 트랜잭션에서 player 전이 + 해당 `aliveShardIndex` 샤드 차감 함께 반영
- [ ] chunked transaction / BulkWriter / 서버 병렬 write 중 선택 가능. 단 player 전이와 샤드 차감의 멱등성 유지
- [ ] batch 전체 집계와 `processedBatchCount += 1` 은 `batches/{i}.status = "done"` 단일 트랜잭션에서만 반영

### 멱등성 두 단계 (7.5, 8.10.1)

- [ ] dispatch/claim 멱등성: `batches/{i}.status` + `startedAt` lease
- [ ] side effect 멱등성: `players/{userId}.lastProcessedRound`
- [ ] 같은 batch 두 번 도착 → `done` 이면 즉시 ack
- [ ] `processing` 에서 crash → lease 만료 후 재claim, 이미 처리된 player 는 `lastProcessedRound` 가드로 skip

### batch 완료 finalizer

- [ ] 본인이 `processedBatchCount` 를 `expectedBatchCount` 와 같게 만든 처리자가 finalizer 시도
- [ ] 라운드 종료 직후 10개 샤드 합산해 `games.aliveCount` 보정 (8.5.2)
- [ ] 라운드 집계 최종 set: `rounds/{n}.survivorsAfter` (샤드 합산값), `rounds/{n}.eliminatedCount` (= `survivorsBefore - survivorsAfter`), `rounds/{n}.choiceDistribution` (batch increment 누적값을 그대로 정본화). 개별 batch 처리(8.6.5 vii)에서 increment 한 값을 finalizer 가 일관성 검증 후 확정한다
- [ ] `survivorsAfter >= 2` → `startRound-{gameId}-{n+1}` 결정적 task name enqueue
- [ ] `survivorsAfter == 1` → `phase = "ended"`, `endedReason = "winner"`, `winnerNickname` set, `result/summary` create
- [ ] `survivorsAfter == 0` → `phase = "ended"`, `endedReason = "carryover"`

### 실패 / 재시도

- [ ] 처리 실패 시 `batches/{i}.status = "failed"` + `errorMessage` 기록 후 ack 하지 않음 (Pub/Sub 재발사)
- [ ] 재시도 한도 도달 시 `failed` 고정 → 운영자 수동 대상 (10장)

## 산출물

- `functions/src/processBatch.ts`
- chunked write 유틸 / BulkWriter 어댑터
- batch finalizer 모듈
- 단위·통합 테스트 (정상 / 미제출자 / 비김 / partial chunk crash / 재시도 멱등 / finalizer race)

## 완료 조건

- [ ] 1000명 batch 가 단일 메시지로 정상 완료, `batches/{i}.status = "done"`
- [ ] 같은 batch 메시지 두 번 도착 → 두 번째는 즉시 ack, side effect 0
- [ ] chunk 처리 도중 함수 종료 → 재시도 시 이미 처리된 player 는 skip, 미처리 chunk 만 갱신
- [ ] 탈락자별 샤드 차감이 입장 시 저장된 `aliveShardIndex` 와 일치
- [ ] 모든 batch 완료 후 `aliveCount` 보정값이 샤드 합산과 일치
- [ ] 마지막 batch 완료 race 에서 `startRound-{gameId}-{n+1}` 또는 `ended` 가 정확히 한 번만 발생
- [ ] `survivorsAfter == 1` 시 `result/summary` 가 정확히 1회 create

## 위임 / 미결정

- `failed` batch 운영자 복구 절차 → 10장
- TTL / 데이터 보존 → 13장
