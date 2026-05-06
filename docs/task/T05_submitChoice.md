# T05 — `submitChoice`

> 본인이 가위·바위·보 중 하나를 제출하는 Callable 함수. 본인 여부, 생존, 현재 라운드, 마감 시각, 중복 제출을 모두 검증한다.

## 가이드 정본

- [6. 데이터 모델 및 보안 정책](../guide/06_데이터_모델_및_보안_정책.md) §6.8.4
- [8. 자동진행 및 서버리스 함수](../guide/08_자동진행_및_서버리스_함수.md) §8.6.2

## 선행

- [T04](./T04_joinGame_입장_트랜잭션.md)

## 구현 항목

- [ ] Callable `submitChoice` (region `asia-northeast3`)
- [ ] payload: `gameId`, `choice ∈ { "rock", "scissors", "paper" }`
- [ ] `request.auth.uid` 미존재 → `unauthenticated`
- [ ] 트랜잭션 단계 (8.6.2):
  - `games/{gameId}` read → `phase == "select"` AND `now() < roundEndsAt` (서버 시간만 사용)
  - `players/{userId}` read → `status == "alive"` AND `choiceRound != currentRound` (라운드 중 1회 제출)
  - `players/{userId}.choice` / `choiceRound` / `choiceSubmittedAt` set
- [ ] 라운드별 1만 명 초기화 write 를 하지 않는다 (`choiceRound` 로 현재 라운드 선택인지 판별)
- [ ] 실패 응답 코드: `failed-precondition` (페이즈/마감/생존/중복 제출)
- [ ] 마감 시각 검증은 `Timestamp.now()` 만 사용 (8.2 서버 시간 신뢰 원칙)

## 산출물

- `functions/src/submitChoice.ts`
- 단위 테스트 (페이즈 mismatch / 마감 후 / 탈락 / 중복 제출 / 정상 케이스)

## 완료 조건

- [ ] `phase != "select"` 인 상태에서 호출하면 `failed-precondition`
- [ ] `now() >= roundEndsAt` 이면 `failed-precondition`
- [ ] `players/{userId}.status == "eliminated"` 면 `failed-precondition`
- [ ] 같은 라운드에 두 번째 호출은 `failed-precondition`
- [ ] 정상 호출 후 본인 player 문서의 `choice`, `choiceRound`, `choiceSubmittedAt` 갱신 확인
- [ ] 다른 player 문서가 영향받지 않음

## 위임 / 미결정

- 라운드 중 선택 변경 허용 여부 → 13장. 현재는 최초 1회만 인정
