# T12 — 결과 / 관전 UI (`reveal` + 관전 모드)

> `reveal` 페이즈에서 애디슨 손, 본인 결과, 라운드 집계를 보여준다. 탈락자는 관전 모드로 전환되어 공개 집계만 본다.

## 가이드 정본

- [3. 게임 룰 및 라운드 흐름](../guide/03_게임_룰_및_라운드_흐름.md) §3.2, §3.3
- [4. 시스템 아키텍처](../guide/04_시스템_아키텍처.md) §4.6
- [6. 데이터 모델 및 보안 정책](../guide/06_데이터_모델_및_보안_정책.md) §6.8.3, §6.12

## 선행

- [T07](./T07_endRound_batch_manifest.md), [T08](./T08_processBatch.md), [T11](./T11_선택_UI.md)

## 구현 항목

### `reveal` 화면 (생존자 + 탈락자 공통)

- [ ] `rounds/{n}.adminChoice` 표시 (애디슨 손, `reveal` 이후만 노출)
- [ ] 본인 `choice` 와 비교한 결과 표시 (이김 / 비김 / 짐 / 미제출)
- [ ] 라운드 집계: `survivorsBefore`, `survivorsAfter`, `eliminatedCount`, `choiceDistribution` (가위/바위/보 분포)
- [ ] 생존 확률(이번 라운드 통과 비율) 표시 (소수점·반올림 정책은 13장 또는 placeholder)

### 페이즈 분기

- [ ] 본인 `status == "alive"` → 다음 `countdown` 으로 자동 전환 (T10 → T11)
- [ ] 본인 `status == "eliminated"` → 관전 모드로 전환

### 관전 모드 (6.12 공개 데이터 계약)

- [ ] `games.phase`, `games.currentRound`, `games.aliveCount` (폴링)
- [ ] `rounds/{n}.startedAt`, `endsAt`, `adminChoice` (reveal 이후), `survivorsBefore`, `survivorsAfter`, `eliminatedCount`, `choiceDistribution`
- [ ] **금지**: 다른 플레이어 목록, 개별 `choice`, `adisonUid`, `clickKey`, `winnerClickKey` 등 (6.12)
- [ ] 라운드 진행 상황을 라이브로 따라갈 수 있는 화면 (다음 라운드 카운트다운, 선택 진행 중 표시 등)

### `ended` 분기

- [ ] `games.phase == "ended"` AND `endedReason == "winner"` → 우승 화면 (T13)
- [ ] `games.phase == "ended"` AND `endedReason == "carryover"` → 이월 화면

## 산출물

- `RevealView`, `SpectatorView`, `EndedView` 컴포넌트
- 공통 집계 표시 컴포넌트 (라운드 집계 + 분포 그래프)

## 완료 조건

- [ ] `reveal` 진입 시 `adminChoice` 가 노출되고 본인 결과가 즉시 표시됨
- [ ] `select` 마감 전에는 어떤 화면에서도 `adminChoice` 가 절대 노출되지 않음 (6.4 결과 선공개 방지)
- [ ] 본인 탈락 시 다음 라운드부터 관전 모드 화면 사용
- [ ] 관전 모드는 다른 플레이어 정보를 0건 read (네트워크 inspector 로 확인)
- [ ] `aliveCount` 가 라운드 경계에서 갱신되는 모습이 보임
- [ ] `ended` 분기 두 가지가 각각 다른 화면으로 표시됨

## 위임 / 미결정

- 생존 확률 표시 문구·반올림 → 13장
- 관전 화면 UI 디테일 → 디자인
