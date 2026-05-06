# T09 — `submitWinnerInfo`

> 우승자 본인이 경품 수령용 개인정보를 1회만 제출하는 Callable. `winnerPrivate/summary` restricted 문서를 만든다.

## 가이드 정본

- [6. 데이터 모델 및 보안 정책](../guide/06_데이터_모델_및_보안_정책.md) §6.8.9
- [8. 자동진행 및 서버리스 함수](../guide/08_자동진행_및_서버리스_함수.md) §8.6.6

## 선행

- [T08](./T08_processBatch.md) (`result/summary` 가 생성되어야 본 함수가 의미 있음)

## 구현 항목

- [ ] Callable `submitWinnerInfo` (region `asia-northeast3`)
- [ ] payload: `gameId`, `name`, `phone`, `address?`, `privacyConsentAt`, `thirdPartyConsentAt?`
- [ ] `request.auth.uid` 미존재 → `unauthenticated`
- [ ] 트랜잭션 단계 (8.6.6):
  - `games/{gameId}` read → `phase == "ended"` 검증
  - `result/summary` read → `winnerId == request.auth.uid` 검증
  - `winnerPrivate/summary` read → 미존재 확인
  - `winnerPrivate/summary` create
- [ ] 실패 응답: `failed-precondition` (페이즈/우승자 아님), `already-exists` (이미 제출), `invalid-argument` (동의 timestamp 누락)
- [ ] `privacyConsentAt` 필수, `thirdPartyConsentAt` 선택

## 산출물

- `functions/src/submitWinnerInfo.ts`
- 단위 테스트 (페이즈 mismatch / 우승자 아님 / 중복 제출 / 동의 누락 / 정상)

## 완료 조건

- [ ] `phase != "ended"` 에서 호출 → `failed-precondition`
- [ ] 우승자 아닌 사용자가 호출 → `failed-precondition`
- [ ] 이미 제출된 우승자가 다시 호출 → `already-exists`
- [ ] `privacyConsentAt` 누락 호출 → `invalid-argument`
- [ ] 정상 호출 시 `winnerPrivate/summary` 생성, 모든 필드 6.8.9 정본 일치

## 위임 / 미결정

- 개인정보 보존 기간·파기 정책 → 13장
- 동의 문구 최종 문안 → 13장
