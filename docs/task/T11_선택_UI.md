# T11 — 선택 UI (`select` 페이즈)

> `phase == "select"` 동안 가위·바위·보 중 하나를 한 번 제출한다. 마감 시각 가시화와 미제출 처리 UX 를 포함한다.

## 가이드 정본

- [3. 게임 룰 및 라운드 흐름](../guide/03_게임_룰_및_라운드_흐름.md) §3.2, §3.3, §3.5
- [8. 자동진행 및 서버리스 함수](../guide/08_자동진행_및_서버리스_함수.md) §8.6.2

## 선행

- [T05](./T05_submitChoice.md), [T10](./T10_입장_대기_카운트다운_UI.md)

## 구현 항목

- [ ] `phase == "select"` 진입 감지 후 선택 화면 진입
- [ ] 가위·바위·보 버튼 3개
- [ ] 마감 시각 (`roundEndsAt`) 까지 남은 시간을 카운트다운으로 표시
- [ ] 첫 클릭 시 `submitChoice` Callable 호출
- [ ] 응답 분기:
  - 성공 → "제출 완료" 표시, 추가 선택 비활성화 (라운드 중 1회 제출)
  - `failed-precondition` (마감 후) → "선택 시간이 종료되었습니다"
  - `failed-precondition` (탈락) → 관전 모드로 전환 (T12)
- [ ] 본인 player 의 `choice` / `choiceRound == currentRound` 를 onSnapshot 으로 즉시 반영
- [ ] 마감까지 미제출 → 안내 문구 표시 (실제 탈락은 서버에서 처리됨, 클라이언트는 다음 라운드 또는 reveal 결과를 기다림)
- [ ] `phase` 가 `reveal` 로 바뀌면 T12 화면으로 전환

## 산출물

- `SelectView` 컴포넌트
- `submitChoice` 호출 어댑터 (멱등성: 같은 라운드 중복 클릭 방지)

## 완료 조건

- [ ] `phase == "select"` 에서 가위·바위·보 버튼 표시
- [ ] 정상 선택 후 본인 `players/{userId}.choice` 가 갱신되어 화면에 반영
- [ ] 마감 시각 도달 후 클릭하면 `failed-precondition`, 안내 표시
- [ ] 라운드 중 두 번 클릭 시 두 번째는 클라이언트에서 차단 (서버 호출 0)
- [ ] `phase` 가 `reveal` 로 전환되면 자동으로 화면 전환

## 위임 / 미결정

- 라운드 중 선택 변경 허용 → 13장
- 라운드 시간 (`select` 길이) → 13장
