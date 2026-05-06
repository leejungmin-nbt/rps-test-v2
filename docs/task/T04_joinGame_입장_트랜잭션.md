# T04 — `joinGame` 입장 트랜잭션

> 입장 단일 진입점인 `joinGame` Callable 을 만든다. 정규화·중복 차단·정원 게이트·플레이어 생성·샤드 카운터 갱신을 한 트랜잭션 안에서 처리한다.

## 가이드 정본

- [7. 동시성·정원·중복참여 정책](../guide/07_동시성_정원_중복참여_정책.md) §7.3, §7.4
- [8. 자동진행 및 서버리스 함수](../guide/08_자동진행_및_서버리스_함수.md) §8.6.1, §8.9
- [6. 데이터 모델 및 보안 정책](../guide/06_데이터_모델_및_보안_정책.md) §6.6, §6.8.4, §6.8.6, §6.8.7

## 선행

- [T02](./T02_데이터_모델_및_보안_규칙.md), [T03](./T03_익명_Auth_및_URL_파라미터.md)

## 구현 항목

### 입력·인증

- [ ] Callable `joinGame` 을 region `asia-northeast3` 에 배포
- [ ] payload: 5종 URL 파라미터, 닉네임, `gameId`
- [ ] `request.auth.uid` 미존재 시 `unauthenticated` 즉시 반환

### 정규화 / 해시

- [ ] 5종을 NFC + trim 으로 서버 재정규화
- [ ] `adisonUidHash = sha256(normalize(adisonUid))` (64자 hex)
- [ ] `clickKeyHash = sha256(normalize(clickKey))` (claims 의 운영 모니터링용)
- [ ] 샤드 인덱스 산출: `parseInt(adisonUidHash.slice(0, 8), 16) % 10` (8.9 정본)

### 닉네임

- [ ] 한국어 형용사 + 명사 사전 기반 랜덤 닉네임 생성기 (사전 정책은 13장 위임이므로 placeholder 사전을 두되 교체 가능 구조)
- [ ] 금칙어 차단, 길이 제한
- [ ] 클라이언트 입력 닉네임이 있으면 검증 후 사용, 없으면 자동 생성

### 트랜잭션 단계 (8.6.1 정본 그대로)

- [ ] `games/{gameId}`, `claims/{adisonUidHash}`, `players/{userId}` read
- [ ] `claims.userId == request.auth.uid` → 정원/마감 검증 없이 idempotent 정상 응답
- [ ] `claims.userId != request.auth.uid` → 7.4.4 매트릭스로 거부
- [ ] `claims` 없지만 본인 player 존재 → 같은 Auth UID 의 다른 `adisonUid` 재진입 거부
- [ ] 신규 입장만 `phase == "waiting"` AND `now() < closesAt` AND 근사 admission gate 검증
- [ ] `claims` create + `players/{userId}` create (`aliveShardIndex` 포함) + `counters/alive_{shardIndex}` `+1`

### 7.4.4 재호출 매트릭스 분기

- [ ] `waiting` 의 4분기 (본인 재호출 idempotent / 같은 adisonUid 다른 Auth → 거부 / 다른 adisonUid 같은 Auth → 거부 / 신규 → 정원 검증)
- [ ] `countdown` / `select` / `reveal` 의 4분기 (본인 화면 재로딩 허용 / claims 차단 / 신규 거부)
- [ ] `ended` 의 4분기 (결과 화면용 read-only 응답)

### 실패 응답 코드 (8.6.1)

- [ ] `unauthenticated`
- [ ] `failed-precondition` (페이즈/마감/재진입 정책)
- [ ] `resource-exhausted` (정원)
- [ ] `already-exists` (다른 Auth UID 가 선점한 중복 참여)

## 산출물

- `functions/src/joinGame.ts`
- 닉네임 생성기 모듈 (사전, 검증)
- URL 파라미터 정규화 / 해시 / 샤드 매핑 유틸
- 단위 테스트 (재호출 매트릭스 12분기 + 정원 게이트 + claims 선점 경합)

## 완료 조건

- [ ] Emulator 에서 같은 `adisonUid` 두 번 호출 시 두 번째는 `claims.userId` 분기에 따라 본인이면 idempotent, 다른 Auth UID 면 거부
- [ ] 한 Auth UID 가 다른 `adisonUid` 로 두 번째 입장 시 거부
- [ ] `phase == "countdown"` 이후 신규 입장은 `failed-precondition`
- [ ] 정원 도달 신호가 발생한 상태 (근사 admission gate 가 닫힘을 반환) 에서 신규 입장은 `resource-exhausted`. 7.3.1 의 +5% 초과 허용 한계는 그대로 유효
- [ ] 입장 성공 후 `players/{userId}.aliveShardIndex` 가 `parseInt(adisonUidHash.slice(0,8),16) % 10` 과 일치
- [ ] 같은 샤드의 `counters/alive_{shardIndex}.count` 가 `+1` 되어 있음
- [ ] 트랜잭션 도중 함수 실패 시 부분 상태 (claims 만 있고 player 없음) 가 절대 발생하지 않음

## 위임 / 미결정

- 정원 강제 방식 최종 (a/b/c) → 13장. 본 태스크는 (b) 근사 admission gate 의 샤드별 quota 또는 별도 roll-up 캐시 신호를 사용한다고 가정하고 인터페이스를 둔다
- 닉네임 사전·금칙어·길이 → 13장
- 라운드 중 같은 `adisonUid` 재호출 자동 탈락 강도 → 13장 (현재는 거부만 수행)
