# 가위바위보 챌린지 v2 (상용 빌드)

`docs/guide/` 정책 정본 기반의 상용 운영급 빌드. v1(`adison-rps-event/`) 의 MVP 검증 결과를 기반으로 단일 쓰기 게이트웨이·Cloud Tasks·Pub/Sub 분산·5종 URL 파라미터·다중 게임 모델로 재설계.

## 1. 프로젝트 소개

매체사(예: PURSE)에서 진입한 1만 명 규모 사용자가 동시 참여하는 **가위바위보 토너먼트 이벤트**. 백엔드 신규 개발 없이 Firebase 매니지드 서비스 조합만으로 구현한다.

- **자동 진행**: Cloud Tasks 가 정확한 시각에 페이즈 전환
- **단일 쓰기 게이트웨이**: 모든 도메인 쓰기는 Cloud Functions 만
- **분산 처리**: 1만 명 라운드 판정을 Pub/Sub 1000명 단위 batch 로
- **5종 URL 파라미터**: uid / advertising_id / click_key / pub_code / pub_app_code

## 2. 기술 스택

- **Frontend**: React + TypeScript + Vite + SCSS Modules
- **Backend**: Firebase Cloud Functions (Node.js 20, asia-northeast3)
- **Database**: Firestore (asia-northeast3)
- **Auth**: Firebase Anonymous Authentication
- **Hosting**: Firebase Hosting (CDN + 서울 엣지)
- **자동 진행**: Cloud Tasks (페이즈 전환) + Pub/Sub (batch 분산)

## 3. 환경

현재 단일 환경 사용 (검증용 개인 계정).

| 환경 | Firebase 프로젝트 ID | 용도 |
|---|---|---|
| 검증 (단일) | `rps-test-e524c` | 기능 검증 + 부하 테스트 |

향후 회사 계정 적용 시 dev/prd 분리 예정. 분기 패턴은 `web/src/firebase.ts` 상단 주석 참조.

## 4. 디렉토리 구조

```
adison-rps-event-v2/
├── functions/                Cloud Functions (7개)
│   ├── src/index.ts          joinGame / submitChoice / submitWinnerInfo
│   │                         + startRound / beginSelect / endRound / processBatch
│   └── package.json
├── web/                      React 클라이언트
│   ├── src/
│   │   ├── App.tsx           라우팅 + 페이즈 화면
│   │   ├── firebase.ts       단일 환경 + dev/prd 분기 주석
│   │   ├── types.ts          데이터 모델 타입
│   │   └── styles/           디자인 토큰 (SCSS)
│   └── package.json
├── docs/                     정책 정본 (guide / flow / task / learn)
├── firebase.json             Firebase 통합 설정
├── firestore.rules           보안 규칙 (단일 쓰기 게이트웨이)
├── firestore.indexes.json
├── .firebaserc               프로젝트 alias
├── .env.example              환경 변수 가이드 (분리 시)
└── README.md
```

## 5. 명령어

### 의존성 설치 (최초 1회)
```bash
cd functions && npm install && cd ..
cd web && npm install && cd ..
```

### 로컬 개발 (Firebase Emulator)
```bash
firebase emulators:start    # localhost:4000 UI
cd web && npm run dev       # localhost:5173
```

### 빌드
```bash
cd functions && npm run build
cd web && npm run build
```

### 배포
```bash
firebase deploy                              # 전체
firebase deploy --only firestore:rules       # 보안 규칙만
firebase deploy --only functions --force     # Functions만 (3~5분)
firebase deploy --only hosting               # 정적 자산만 (1~2분)
```

## 6. 빌드 마일스톤

| 마일스톤 | 작업 | 상태 |
|---|---|---|
| **M0** | Foundation skeleton (디렉토리·타입·rules·stub) | ✅ 진행 중 |
| **M1** | Auth + 5종 파라미터 + 라우팅 (T01~T03) | ⏳ |
| **M2** | 7개 Cloud Functions 구현 (T04~T09) | ⏳ |
| **M3** | UI 4개 화면 (T10~T13) | ⏳ |
| **M4** | Cloud Tasks + Pub/Sub + 부하 테스트 (T14~T18) | ⏳ |

## 7. 정책 정본

이 프로젝트의 모든 의사결정은 `docs/guide/` 13장이 정본이다.

- [docs/guide/01 프로젝트 개요](./docs/guide/01_프로젝트_개요.md)
- [docs/guide/04 시스템 아키텍처](./docs/guide/04_시스템_아키텍처.md)
- [docs/guide/06 데이터 모델 및 보안 정책](./docs/guide/06_데이터_모델_및_보안_정책.md)
- [docs/guide/08 자동진행 및 서버리스 함수](./docs/guide/08_자동진행_및_서버리스_함수.md)

전체 목차는 [docs/README.md](./docs/README.md).

## 8. v1 (검증용 MVP) 와의 관계

`../adison-rps-event/` 는 v1 검증용 MVP. 검증 과정에서 발견한 race condition · 부정행위 정책 · 자동 정리 등을 docs/guide 정본으로 정리한 뒤, v2 에서 정본 기반으로 새로 빌드하는 중.

v1 은 archive 상태로 유지되며, GitHub `rps-test` 레포의 `v1` 태그로 보존된다.
