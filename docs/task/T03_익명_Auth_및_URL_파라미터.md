# T03 — 익명 Auth 및 URL 파라미터 5종 처리

> 광고 참여 → 인앱웹뷰 → `/event` 진입 → Firebase Anonymous Auth 로그인 → 5종 파라미터 추출까지의 진입 흐름을 클라이언트에서 구현한다.

## 가이드 정본

- [5. 사용자 식별 및 인증](../guide/05_사용자_식별_및_인증.md) 전체

## 선행

- [T01](./T01_프로젝트_환경_셋업.md), [T02](./T02_데이터_모델_및_보안_규칙.md)

## 구현 항목

### 라우팅

- [ ] `/event` 경로를 SPA rewrite 로 진입점으로 둔다 (하지만 `firebase.json` 은 모든 경로를 `index.html` 로 rewrite — 9.3.3)
- [ ] 클라이언트 라우터는 `/event` 외 경로에 대해 안내 또는 redirect 정책을 둔다 (이번 태스크에서는 `/event` 만 정상 분기)

### URL 파라미터 추출

- [ ] `URLSearchParams` 로 5종 파라미터 추출
  - `uid` → 내부 `adisonUid`
  - `advertising_id` → `advertisingId`
  - `click_key` → `clickKey`
  - `pub_code` → `pubCode`
  - `pub_app_code` → `pubAppCode`
- [ ] 누락/형식 오류 시 정상 입장으로 보지 않는 분기 (5.7) — 안내 화면으로 이동
- [ ] 호스팅이 파라미터를 가공하지 않음을 e2e 로 확인 (9.11)

### Firebase Anonymous Auth

- [ ] 진입 직후 `signInAnonymously` 호출. 토큰 저장은 SDK 기본값 사용
- [ ] `request.auth.uid` 발급 보장 (이후 `joinGame` Callable 의 전제)
- [ ] URL `uid` (= `adisonUid`) 와 Firebase Auth UID 를 코드 어디에서도 혼용하지 않는다는 명명 규칙 강제 (`adisonUid` vs `userId` 변수명 분리)

### 진입 컨텍스트 객체

- [ ] 5종 파라미터 + Auth UID 를 포함하는 `EntryContext` 같은 타입을 만들어 후속 `joinGame` 호출에 전달

## 산출물

- 클라이언트 라우팅 코드 (`/event` 진입점)
- `useAnonymousAuth` 훅 또는 등가 모듈
- URL 파라미터 정규화 함수 (트리밍, 빈 문자열 처리는 클라이언트 측 1차만 — 정본은 함수)
- 누락 안내 화면

## 완료 조건

- [ ] dev 환경에 배포된 SPA 가 `/event?uid=X&advertising_id=Y&click_key=Z&pub_code=A&pub_app_code=B` 로 진입했을 때 5종 값을 정확히 추출
- [ ] 5종 중 `pub_app_code` 만 비어 있는 경우는 허용 (5.3 의 빈 값 가능 메모)
- [ ] 다른 필수 파라미터가 비어 있으면 안내 화면 표시
- [ ] 익명 Auth UID 가 console 또는 디버그 화면으로 확인됨 (이후 태스크에서 사라짐)
- [ ] 같은 디바이스 새로고침 시 같은 Auth UID 가 유지됨 (5.4)
- [ ] 시크릿 모드 / 다른 기기 진입 시 새 Auth UID 가 발급됨 — 본 태스크는 검증만, 중복 차단은 T04

## 위임 / 미결정

- 인앱웹뷰의 쿠키·storage 정책 변동 시 토큰 보존 동작은 9.11 위임
- 개인정보 고지 문구 → 13장
