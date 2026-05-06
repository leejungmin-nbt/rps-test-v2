# T10 — 입장 / 대기 / 카운트다운 UI

> 광고 진입 → `joinGame` → `waiting` / `countdown` 페이즈를 보여주는 클라이언트 화면을 만든다.

## 가이드 정본

- [3. 게임 룰 및 라운드 흐름](../guide/03_게임_룰_및_라운드_흐름.md) §3.2, §3.3
- [4. 시스템 아키텍처](../guide/04_시스템_아키텍처.md) §4.6
- [5. 사용자 식별 및 인증](../guide/05_사용자_식별_및_인증.md) §5.2

## 선행

- [T03](./T03_익명_Auth_및_URL_파라미터.md), [T04](./T04_joinGame_입장_트랜잭션.md)

## 구현 항목

### 진입 → joinGame 호출

- [ ] T03 의 `EntryContext` (5종 + Auth UID) 를 받아 `joinGame` Callable 호출
- [ ] 응답에 따른 분기:
  - 정상 입장 → 본인 player 문서 onSnapshot 시작 (4.6 본인 상태만 실시간)
  - `failed-precondition` (페이즈 마감) → "이미 게임이 시작되었습니다" 안내
  - `resource-exhausted` (정원) → "정원이 마감되었습니다" 안내
  - `already-exists` → "다른 세션에서 이미 참여 중입니다" 안내
  - `unauthenticated` → 익명 Auth 재시도

### 본인 상태 onSnapshot

- [ ] `games/{gameId}/players/{userId}` 실시간 구독 (사용자당 1개)
- [ ] `nickname`, `status`, `choiceRound` 등 본인 상태 추출

### 게임 공통 상태 폴링

- [ ] `games/{gameId}` 와 `games/{gameId}/rounds/{currentRound}` 를 5초 내외 폴링 (4.6 비대칭 전략)
- [ ] `phase`, `currentRound`, `aliveCount`, `closesAt`, `roundEndsAt` 등 추출
- [ ] `appState/activeGameId` 도 한 번 read 해서 `gameId` 결정

### 화면 분기

- [ ] `waiting` → "곧 시작합니다" + `closesAt` 까지 남은 시간 + `aliveCount` (입장 누적치)
- [ ] `countdown` → 카운트다운 타이머 (`rounds/{n}.selectStartsAt`)
- [ ] 본인 닉네임 표시
- [ ] 페이즈가 `select` 로 바뀌면 T11 화면으로 전환

### 새로고침 / 재진입

- [ ] 새로고침 시 같은 Auth UID 로 본인 player 문서 재구독, 화면 즉시 복원 (7.7)

## 산출물

- React 컴포넌트 (`EventEntry`, `WaitingView`, `CountdownView`)
- `useGameState` (공통 폴링) / `usePlayerState` (본인 onSnapshot) 훅
- joinGame 호출 어댑터

## 완료 조건

- [ ] dev 환경에서 `/event?...` 로 진입 → 자동 입장 → `waiting` 화면 표시
- [ ] 같은 사용자가 새로고침 시 같은 화면이 즉시 복원됨
- [ ] 정원 마감 / 페이즈 마감 / 중복 참여 시 각각 다른 안내 화면 표시
- [ ] `phase == "countdown"` 으로 전환되면 카운트다운 타이머가 보임
- [ ] 카운트다운 종료 시 (`now() >= selectStartsAt`) 화면이 자동 전환됨
- [ ] 폴링은 5초 내외 간격, 본인 player 는 onSnapshot 1개

## 위임 / 미결정

- 카운트다운 길이·라운드 시간 → 13장
- 페이지 이탈 시 자동 탈락 강도 → 13장
