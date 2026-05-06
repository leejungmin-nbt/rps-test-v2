// =====================================================================
// Firebase Cloud Functions — 가위바위보 챌린지 v2 (상용 빌드)
// =====================================================================
// docs/guide/04 (시스템 아키텍처) + docs/guide/08 (자동진행 및 서버리스 함수) 정본 기준.
//
// 단일 서버 쓰기 게이트웨이 — 모든 도메인 쓰기는 본 함수 모음을 통과한다.
// 클라이언트 직접 쓰기는 firestore.rules 에서 전체 차단되어 있다.
//
// 함수 인벤토리 (총 7개):
//   [Callable]  — 클라이언트가 직접 호출
//     1. joinGame           : 입장 트랜잭션 + claims 선점 + 분산 샤드 카운터 + 정원 게이트
//     2. submitChoice       : 본인·생존·마감 검증 + 선택 갱신
//     3. submitWinnerInfo   : 우승자 본인 1회 제출 검증
//
//   [내부 트리거] — Cloud Tasks / Pub/Sub 만 호출
//     4. startRound         : waiting/reveal → countdown 전이, beginSelect 예약
//     5. beginSelect        : countdown → select 전이, endRound 예약
//     6. endRound           : adminChoice 결정 + persisted batch manifest + Pub/Sub publish
//     7. processBatch       : 1000명 단위 승패 판정 + 탈락 + 샤드 차감 + 멱등성
//
// 본 파일은 M0 (Foundation) 단계의 stub 으로, 시그니처와 가드만 두고
// 실제 트랜잭션·재시도·멱등성 로직은 M2 단계 (T04~T09) 에서 구현한다.
// =====================================================================

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import { onMessagePublished } from 'firebase-functions/v2/pubsub'

initializeApp()
const db = getFirestore()
void db // M2 단계에서 본격 사용

// 함수 region — Hosting/Firestore 와 같은 region 으로 통일
const FUNCTION_REGION = 'asia-northeast3'

// =====================================================================
// 1. joinGame (Callable) — 입장
// =====================================================================
// 책임: URL 파라미터 5종 정규화 + adisonUid 중복 차단 + 정원 검증 +
//       aliveShardIndex 저장 + 카운터 갱신 (단일 트랜잭션)
//
// 입력: { gameId, uid, advertising_id, click_key, pub_code, pub_app_code, nickname }
// 인증: request.auth.uid (Firebase Anonymous Auth)
// 응답: { status: 'joined' | 'already_in', playerId, aliveShardIndex }
//
// 상세 계약: docs/guide/08 §8.6.1
// =====================================================================
export const joinGame = onCall(
  { region: FUNCTION_REGION },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'auth required')
    }
    logger.info('[joinGame] stub called', { uid: request.auth.uid })
    throw new HttpsError('unimplemented', 'joinGame not implemented yet (M2/T04)')
  }
)

// =====================================================================
// 2. submitChoice (Callable) — 손 선택 제출
// =====================================================================
// 책임: 본인 + 생존 + 현재 라운드 + 마감 전 검증 후 본인 선택 필드 갱신
//
// 입력: { gameId, choice: 'rock' | 'scissors' | 'paper' }
// 인증: request.auth.uid
// 응답: { status: 'accepted' }
//
// 상세 계약: docs/guide/08 §8.6.2
// =====================================================================
export const submitChoice = onCall(
  { region: FUNCTION_REGION },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'auth required')
    }
    logger.info('[submitChoice] stub called', { uid: request.auth.uid })
    throw new HttpsError('unimplemented', 'submitChoice not implemented yet (M2/T05)')
  }
)

// =====================================================================
// 3. submitWinnerInfo (Callable) — 우승자 개인정보 제출
// =====================================================================
// 책임: 우승자 본인 여부 + 1회 제출 검증 후 winnerPrivate/summary 저장
//
// 입력: { gameId, name, phone, address?, privacyConsentAt, thirdPartyConsentAt? }
// 인증: request.auth.uid (= result/summary.winnerId 와 일치 필요)
// 응답: { status: 'submitted' }
//
// 상세 계약: docs/guide/08 §8.6.6
// =====================================================================
export const submitWinnerInfo = onCall(
  { region: FUNCTION_REGION },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'auth required')
    }
    logger.info('[submitWinnerInfo] stub called', { uid: request.auth.uid })
    throw new HttpsError('unimplemented', 'submitWinnerInfo not implemented yet (M2/T09)')
  }
)

// =====================================================================
// 4. startRound (HTTP) — waiting/reveal → countdown 전이
// =====================================================================
// 호출 주체: 운영자 / 마지막 batch 의 결정적 enqueue (Cloud Tasks)
// 책임: 라운드 문서 생성 (startedAt, selectStartsAt) + Cloud Tasks 에 beginSelect 예약
//
// 상세 계약: docs/guide/08 §8.5 전이 #1, #4 + §8.6.3
// =====================================================================
export const startRound = onRequest(
  { region: FUNCTION_REGION },
  async (_req, res) => {
    logger.info('[startRound] stub called')
    res.status(501).send('startRound not implemented yet (M2/T06)')
  }
)

// =====================================================================
// 5. beginSelect (HTTP) — countdown → select 전이
// =====================================================================
// 호출 주체: Cloud Tasks (startRound 계열 step)
// 책임: roundEndsAt / rounds/{n}.endsAt 설정 + Cloud Tasks 에 endRound 예약
//
// 상세 계약: docs/guide/08 §8.5 전이 #2 + §8.6.3
// =====================================================================
export const beginSelect = onRequest(
  { region: FUNCTION_REGION },
  async (_req, res) => {
    logger.info('[beginSelect] stub called')
    res.status(501).send('beginSelect not implemented yet (M2/T06)')
  }
)

// =====================================================================
// 6. endRound (HTTP) — select → reveal 전이 + batch manifest dispatch
// =====================================================================
// 호출 주체: Cloud Tasks
// 책임: adminChoice 결정 (서버 무작위) + revealedAt 기록 +
//       persisted batches/{i} manifest 동결 + Pub/Sub `process-batch` publish
//
// 멱등성: 결정적 task name `endRound-{gameId}-{n}` + manifestStatus 가드
// 상세 계약: docs/guide/08 §8.5 전이 #3 + §8.6.4 + §8.8
// =====================================================================
export const endRound = onRequest(
  { region: FUNCTION_REGION },
  async (_req, res) => {
    logger.info('[endRound] stub called')
    res.status(501).send('endRound not implemented yet (M2/T07)')
  }
)

// =====================================================================
// 7. processBatch (Pub/Sub) — 1000명 단위 분산 승패 판정
// =====================================================================
// 호출 주체: Pub/Sub `process-batch` 토픽
// 책임: persisted UID range 의 플레이어 판정 → 탈락 처리 →
//       aliveShardIndex 기준 샤드 카운터 차감 → batch 집계 반영
//
// 멱등성: (roundNumber, batchIndex) + players.lastProcessedRound
// 상세 계약: docs/guide/08 §8.6.5 + §8.8
// =====================================================================
export const processBatch = onMessagePublished(
  { region: FUNCTION_REGION, topic: 'process-batch' },
  async event => {
    logger.info('[processBatch] stub called', { messageId: event.id })
    throw new Error('processBatch not implemented yet (M2/T08)')
  }
)
