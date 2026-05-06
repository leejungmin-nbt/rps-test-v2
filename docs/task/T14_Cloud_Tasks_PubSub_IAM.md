# T14 — Cloud Tasks · Pub/Sub · IAM 셋업

> 8장 8.7 의 Cloud Tasks 큐, 8장 8.8 의 Pub/Sub 토픽, 9장 9.6 의 service account 와 IAM 바인딩을 환경별로 구성한다.

## 가이드 정본

- [8. 자동진행 및 서버리스 함수](../guide/08_자동진행_및_서버리스_함수.md) §8.7, §8.8
- [9. 호스팅·배포·환경](../guide/09_호스팅_배포_환경.md) §9.6, §9.7

## 선행

- [T01](./T01_프로젝트_환경_셋업.md)

## 구현 항목

### Cloud Tasks 큐

- [ ] dev / prd 각 프로젝트에 큐 `game-rounds` 생성
- [ ] 위치 `asia-northeast3`
- [ ] `max-dispatches-per-second = 10`, `max-concurrent-dispatches = 5`
- [ ] `max-retry-duration = 300s`, `min-backoff = 1s`, 지수 backoff
- [ ] 큐 정의를 IaC (gcloud 스크립트 또는 Terraform) 로 코드화

### Pub/Sub 토픽

- [ ] `process-batch` 토픽 dev / prd 각각 생성
- [ ] dead-letter 토픽 옵션 활성화 (운영 단계 우선)
- [ ] `processBatch` 함수를 Pub/Sub 트리거로 바인딩

### service account 인벤토리 (9.6.1)

- [ ] **Tasks Dispatcher SA** (환경별 1개): Cloud Tasks `createTask` 권한 + 호출 대상 함수의 `cloudfunctions.invoker` (또는 v2 Cloud Run invoker)
- [ ] **Pub/Sub Publisher SA** (또는 동일 SA 권한 추가): `process-batch` 토픽 `pubsub.publisher`
- [ ] **`processBatch` runtime SA**: Firestore read/write
- [ ] **Functions runtime (default)**: Firestore admin
- [ ] SA 키는 코드에 두지 않고 Functions runtime 으로 attach

### Functions IAM 바인딩 (9.6.2)

- [ ] `beginSelect` invoker = Tasks Dispatcher SA 만
- [ ] `endRound` invoker = Tasks Dispatcher SA 만 (검증 단계 클라이언트 Callable 변형은 별도 함수)
- [ ] `processBatch` 는 Pub/Sub 트리거 (외부 HTTP 표면 노출 금지)
- [ ] `joinGame` / `submitChoice` / `submitWinnerInfo` 는 표준 Callable

### OIDC 검증 절차 (9.6.3)

- [ ] 함수 측에서 토큰 `serviceAccountEmail` 매칭 (자기 환경 Tasks Dispatcher SA)
- [ ] 함수 측에서 토큰 `audience` 매칭 (자기 함수 URL)
- [ ] 검증 실패 시 401 (본문에 진단 노출 금지)
- [ ] 가드 불일치 (8.5) 는 200 + no-op

### task ID 산출 규칙 (9.7)

- [ ] `{kind}-{sha256(gameId).slice(0,8)}-{roundNumber}` 표현
- [ ] NFC + 소문자화, 비허용 문자 `_` 치환
- [ ] 같은 입력 → 같은 task ID → `ALREADY_EXISTS` 자연 거부

### 환경별 분기 (9.6.4)

- [ ] 큐 동시성·재시도 정책은 환경 무관 동일
- [ ] 큐가 속한 프로젝트와 호출 함수 URL 만 환경별로 다름

## 산출물

- IaC 스크립트 (`infra/cloud-tasks.sh`, `infra/pubsub.sh`, `infra/iam.sh` 또는 Terraform)
- OIDC 검증 미들웨어 (`functions/src/middleware/oidc.ts`)
- task ID 산출 유틸은 본 태스크에서 작성하지 않는다. T06 의 `shared/taskId.ts` 를 import 해서 사용한다
- IAM 바인딩 문서

## 완료 조건

- [ ] dev 의 큐와 토픽이 생성됨, prd 도 동일하게 셋업됨
- [ ] `beginSelect` 와 `endRound` 가 Tasks Dispatcher SA 외 호출 시 401
- [ ] OIDC `audience` 가 다른 환경 URL 인 토큰 → 401
- [ ] `processBatch` 가 외부 HTTP 로 호출 불가
- [ ] task ID 두 번 createTask → 두 번째는 `ALREADY_EXISTS`
- [ ] 환경별 SA·함수 URL 이 모두 분리됨 (9.4.2)

## 위임 / 미결정

- BigQuery Export 활성화 → 13장
- App Check (reCAPTCHA v3) 도입 → 13장
- `minInstances` 자동화 절차·구체값 → 10장 / 11장
