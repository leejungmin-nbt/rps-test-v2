# PM 기획 vs MVP 구현 현황

> 작성일: 2026-04-29
> 대상: 가위바위보 챌린지 이벤트 MVP
> 비교 기준: [(2026.04) 가위바위보 쉐이핑 노트](https://nbtguild.atlassian.net/wiki/spaces/AdisonOfferwall/pages/1855553605/2026.04)

PM 의 가위바위보 챌린지 쉐이핑 노트와 실제 구현된 MVP 의 차이를 정리한 문서입니다. 검증 단계에서 어떤 것이 구현되어 있고, 어떤 것이 운영 전 추가 작업으로 남아있는지, 그리고 구현 과정에서 추가·강화된 정책은 무엇인지 한눈에 파악하기 위함.

---

## 1. PM 기획 요구사항 vs 구현 현황

| # | PM 기획 항목 | 구현 상태 | 비고 |
|---|---|---|---|
| 1 | 동시 접속 가능 | ✅ 완료 | Firestore onSnapshot 실시간 broadcast |
| 2 | 외부 브라우저 랜딩 | ✅ 완료 | URL 공유 진입 |
| 3 | 정원 차면 접속 차단 | ❌ 미구현 | events.capacity 필드만 정의, 분산 샤드 카운터 미적용 |
| 4 | 랜덤 닉네임 부여 | ❌ 미구현 | 자사 uid 를 식별자로 직접 사용 |
| 5 | n초간 가위/바위/보 선택 | ✅ 완료 | select 페이즈 + selectDurationMs |
| 6 | 컴퓨터 손 (글로벌·사전 미결정) | ✅ 완료 | Cloud Functions tick 안에서 `crypto.randomInt` |
| 7 | 이기면 진출 / 지면 관전 | ✅ 완료 | `players.alive` 갱신 + 관전 모드 화면 분기 |
| 8 | 라운드별 생존 확률 노출 | ✅ 완료 | rounds 컬렉션의 survivorsBefore/After |
| 9 | 라운드별 묵·찌·빠 분포 노출 | ✅ 완료 | rockCount / paperCount / scissorsCount |
| 10 | 최후 1인 우승자 노출 | ✅ 완료 | `events.winnerId` + 종료 화면 |
| 11 | 100만원 리워드 적립 | ⚠️ 수동 | winnerId 자동 기록 → 운영자 수동 적립 (자동 적립 미구현) |
| 12 | 비기거나 져서 이월 표기 | ✅ 완료 | `endReason='all_eliminated'` / `'max_rounds_reached'` 분기 |
| 13 | 매체사별 분기 | ⏸ 제외 | PM 합의로 이번 범위 제외 |
| 14 | SNS 공유 | ⏸ 제외 | PM 합의로 이번 범위 제외 |
| 15 | 광고 (RV/동영상) | ⏸ 제외 | PM 합의로 이번 범위 제외 |

---

## 2. MVP 구현 과정에서 추가·강화된 정책

PM 노트엔 명시되지 않았으나 구현 과정에서 필요성이 드러나 추가·강화된 정책들. 운영 전에 PM 과 합의 확정이 필요한 항목들이기도 합니다.

### 2.1 부정행위 방지 정책 (강화)

PM 노트엔 "이기면 진출 / 지면 관전" 정도만 명시. 구현 과정에서 다음 정책으로 강화됨:

| 시나리오 | 처리 |
|---|---|
| 입장 가능 시간(registration 페이즈) 동안 같은 uid 로 재호출 | **재참가 거부** (`rejected_already_joined`). 새로고침·인터넷 끊김 후 재접속 등 모든 경우 동일 |
| 게임 진행 중(countdown / select / reveal) 같은 uid 로 재호출 | **자동 탈락 처리** + 게임 진입 불가 (`eliminated_rejoin`) |
| 게임 시작 후 신규 진입 시도 | 거부 (`rejected_already_started`) |
| 게임 종료 후 재호출 | 결과 화면만 노출 (`ended`) |

**핵심 원칙**: 한 번 입장한 사용자는 화면을 유지해야 함. 페이지 떠나는 즉시 자동 탈락 또는 재진입 차단.

**구현 위치**: `joinEvent` Cloud Function 안의 `playerSnap.exists` 분기 로직.

### 2.2 사용자 식별 정책 (NBT 인앱브라우저 통합)

PM 노트엔 "랜덤 닉네임 부여" 만 있고 자사 uid 처리는 미명시. 운영 시 NBT 네이티브 SDK 가 인앱브라우저로 띄울 때 다음 쿼리파라미터를 전달하는 정책 적용:

| 쿼리파라미터 | 의미 | 저장 위치 | 노출 정책 |
|---|---|---|---|
| `uid` | 자사 uid (NBT 사용자 식별자) | `players/{uid}.externalUserId` + 문서 ID | 본인 외 read 차단 (보안 규칙) |
| `clickKey` | 광고 참여 식별자 | `players/{uid}.clickKey` | 본인 외 read 차단 |

**보안 보장**:
- 인앱브라우저로 띄움 → 쿼리파라미터 외부 노출 차단
- Firestore 보안 규칙 — `request.auth.uid == resource.data.currentFirebaseUid` 인 본인만 자기 player 문서 read
- 적립 검증 — 운영자가 winnerId 의 player 문서에서 externalUserId / clickKey 확인 후 자사 어드민 시스템에서 검증·적립

**검증 단계 흐름**: `/` 진입 페이지에서 임의 uid/clickKey 생성 → `/event?uid=...&clickKey=...` 진입.

### 2.3 동시성 보호 정책 (트랜잭션)

PM 노트와 검토 문서엔 미명시. 4명 검증에서 race condition 발견(rock 사용자가 'tie' 처리됨)되어 모든 phase 전환에 atomic 보장 적용:

| Phase 전환 | 적용된 트랜잭션 |
|---|---|
| pending → registration | clearCollection 후 `db.runTransaction` 으로 phase 변경 atomic |
| registration → countdown | `db.runTransaction` 안에서 alive count + phase 변경 atomic |
| countdown → select | `db.runTransaction` 으로 phase 변경 atomic |
| select → reveal | `db.runTransaction` 으로 AI 손 결정 + phase 즉시 변경. 일괄 판정은 외부에서 단일 호출만 실행 보장 |
| reveal → 다음 countdown / ended | `db.runTransaction` 으로 winner 결정 + phase 변경 atomic |

**보장 사항**: 동시에 N 개의 호출(클라이언트 tickPoke + Cloud Scheduler tick)이 들어와도 각 phase 전환은 정확히 1번만 실행. 다른 호출들은 phase 가 이미 다음 단계로 변경된 것을 보고 무시.

### 2.4 자동 운영 정책 (운영자 개입 최소화)

PM 노트엔 "운영자 페이지 없음, Firebase 에 미리 설정" 정도만 명시. 구현 과정에서 다음으로 구체화:

| 운영자 작업 | 자동 처리 |
|---|---|
| Firebase 콘솔에서 events/active 의 phase를 'pending' 으로 변경 + 시각 갱신 | tick 함수가 자동 청소 + 페이즈 자동 진행 |
| 게임 종료 후 winnerId 확인 | 운영자가 콘솔에서 확인 후 자사 적립 시스템에서 수동 적립 |

**핵심**: 운영자는 매 회차 시작 시 시각만 갱신하면 끝. 라운드 진행·결과 산출·우승자 결정은 모두 자동.

### 2.5 검증 편의 정책 (이전 게임 데이터 자동 정리)

검증 사이클을 빠르게 돌리기 위해 추가:

| 정책 | 동작 |
|---|---|
| events/active 자동 정리 | tick 의 pending → registration 전환 시 `clearCollection(players)` + `clearCollection(rounds)` 실행 |
| 게임 상태 필드 자동 초기화 | currentRound=0, aliveCount=0, aiChoice=null, winnerId=null, endReason=null, phaseEndsAt=null |

**효과**: 운영자가 매번 콘솔에서 player 문서들을 일일이 삭제할 필요 없음. phase='pending' 만 바꾸면 자동.

### 2.6 라우팅 정책 (검증용 / 운영용 분리)

PM 노트엔 단일 페이지로 가정. 구현 과정에서 검증 도구를 별도 경로로 분리:

| 경로 | 용도 | 운영 시 사용 여부 |
|---|---|---|
| `/` | RegisterPage — 검증용 uid/clickKey 생성 폼 | ❌ 운영 시 미사용 (NBT SDK 가 직접 /event 진입) |
| `/event?uid=...&clickKey=...` | EventPage — 실 게임 화면 | ✅ 운영 시 사용 |
| `/event` (쿼리 누락) | ErrorPage — "유효하지 않은 입장" | ✅ 비정상 진입 차단 |

---

## 3. 의도적 단순화 (검증 단계라 미룬 항목)

검증 단계 규모(4~10명)에 맞지 않거나 운영 직전에 추가하는 게 효율적이라 미룬 항목:

| 항목 | 미구현 사유 | 운영 전 추가 작업 |
|---|---|---|
| 정원 게이트 (분산 샤드 카운터) | 검증 규모에 게이트 자체 불필요 | 분산 샤드 10개로 1만 동접 대응. ±5% 초과 허용 정책 |
| 랜덤 닉네임 사전 | 검증은 자사 uid 만으로 식별 가능 | 한국어 형용사+명사 사전 / 클라이언트 생성 |
| Cloud Tasks 정밀 자동 진행 | 검증 단계엔 1분 단위 정확도로 충분 | Cloud Tasks 도입 — 초 단위 정확도 |
| 인앱브라우저 호환성 매트릭스 | UI 디자인 안정화 후 진행 | 카톡/인스타/페북/네이버/NBT 오퍼월 webview 검증 |
| 부하 테스트 | 기능 안정성 우선 검증 | 1k → 5k → 1만 단계 상승 (k6 또는 Artillery) |
| App Check (봇 차단) | 검증 단계엔 트래픽이 적어 어뷰징 위험 낮음 | reCAPTCHA v3 도입 |
| BigQuery Export (어뷰징 사후 검증) | 검증 단계 분석 부담 작음 | Firestore → BigQuery 자동 export 설정 |

---

## 4. PM 합의 후속 사항 (미정)

PM 노트에 언급되었으나 아직 합의되지 않은 디테일:

- 제세공과금 22% 처리 주체 (자사 부담? 당첨자 부담?)
- 이월 누적 정책 (200만 → 300만? 또는 100만 유지?)
- 4회 행사 일정 확정 (요일·시각)
- 정원 N 확정값 (예: 5천 / 1만 / 1.5만)
- 라운드 수·라운드당 선택 시간
- 이벤트 시작 ~ 종료까지 총 게임 시간

---

## 5. 다음 단계

### 5.1 우선순위 높음
1. **PM 합의 후속 사항 확정** (제세공과금, 이월 정책, 일정, 정원, 라운드 수)
2. **부정행위 방지 정책 검토** — 본 문서 2.1 정책이 PM 의도와 맞는지 재확인
3. **사용자 식별 정책 검토** — NBT 네이티브 SDK 의 인앱브라우저 쿼리파라미터 키 이름·전달 방식 합의

### 5.2 운영 전 추가 작업
4. 정원 게이트 (분산 샤드 카운터) 추가
5. 랜덤 닉네임 사전 + 부여 로직
6. Cloud Tasks 정밀 자동 진행 (선택)
7. 인앱브라우저 호환성 매트릭스 검증
8. 부하 테스트 (1k → 1만)
9. App Check 도입
10. 운영자 매뉴얼 작성

---

## 부록: 관련 문서

- [1차_기술검토.md](./1차_기술검토.md) — 동료 1차 검토 결과 (위키 게시용 압축본)
- [README.md](../README.md) — 프로젝트 개요·기술 스택·명령어 가이드
