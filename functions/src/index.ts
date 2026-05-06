// =====================================================================
// Firebase Cloud Functions — 가위바위보 챌린지 v2 (상용 빌드)
// =====================================================================
// docs/guide/04 (시스템 아키텍처) + docs/guide/06 (데이터 모델) +
// docs/guide/07 (동시성·정원·중복참여) + docs/guide/08 (자동진행) 정본 기준.
//
// 함수 인벤토리 (총 7개):
//   [Callable]  — 클라이언트가 직접 호출
//     1. joinGame           : 입장 트랜잭션 + claims 선점 + 분산 샤드 카운터 + 정원 게이트
//     2. submitChoice       : 본인·생존·마감 검증 + 선택 갱신 (M2/T05 — 미구현)
//     3. submitWinnerInfo   : 우승자 본인 1회 제출 검증 (M2/T09 — 미구현)
//
//   [내부 트리거] — Cloud Tasks / Pub/Sub 만 호출
//     4. startRound         : waiting/reveal → countdown 전이 (M2/T06 — 미구현)
//     5. beginSelect        : countdown → select 전이 (M2/T06 — 미구현)
//     6. endRound           : adminChoice 결정 + persisted batch manifest (M2/T07 — 미구현)
//     7. processBatch       : 1000명 단위 승패 판정 + 탈락 + 샤드 차감 (M2/T08 — 미구현)
//
// 본 파일에서 joinGame (T04) 가 첫 본격 구현 대상.
// =====================================================================

import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import { onMessagePublished } from 'firebase-functions/v2/pubsub'

import {
  generateGuestNickname,
  hashAdisonUid,
  hashClickKey,
  normalizeParam,
  shardIndexFromHash
} from './utils'

initializeApp()
const db = getFirestore()

const FUNCTION_REGION = 'asia-northeast3'

// =====================================================================
// 1. joinGame (Callable) — 입장 트랜잭션
// =====================================================================
// docs/guide/07 §7.4.3 흐름 + §7.4.4 매트릭스 + §7.3 정원 게이트 적용.
// docs/guide/08 §8.6.1 함수 계약.
//
// 입력: { gameId, uid, advertising_id, click_key, pub_code, pub_app_code, nickname? }
// 인증: request.auth.uid (Firebase Anonymous Auth)
// 응답:
//   { status: 'joined' | 'rejoined' | 'rejected_already_in_other_session'
//             | 'rejected_other_adison_uid' | 'rejected_phase'
//             | 'rejected_full',
//     playerId?, aliveShardIndex?, phase, currentRound }
// =====================================================================
export const joinGame = onCall({ region: FUNCTION_REGION }, async request => {
  // ---- 인증 확인 ----
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'auth required')
  }
  const userId = request.auth.uid

  // ---- 입력 추출 + 정규화 + 검증 ----
  const data = (request.data ?? {}) as {
    gameId?: string
    uid?: string
    advertising_id?: string | null
    click_key?: string
    pub_code?: string
    pub_app_code?: string
    nickname?: string
  }

  const gameId = data.gameId
  if (!gameId || typeof gameId !== 'string') {
    throw new HttpsError('invalid-argument', 'gameId required')
  }

  const adisonUidRaw = data.uid
  const clickKeyRaw = data.click_key
  const pubCodeRaw = data.pub_code
  const pubAppCodeRaw = data.pub_app_code

  if (!adisonUidRaw || !clickKeyRaw || !pubCodeRaw || !pubAppCodeRaw) {
    throw new HttpsError('invalid-argument', 'required URL params missing')
  }

  const adisonUid = normalizeParam(adisonUidRaw)
  const clickKey = normalizeParam(clickKeyRaw)
  const pubCode = normalizeParam(pubCodeRaw)
  const pubAppCode = normalizeParam(pubAppCodeRaw)
  const advertisingId = data.advertising_id ? normalizeParam(data.advertising_id) : null
  const nickname = data.nickname ? normalizeParam(data.nickname) : generateGuestNickname()

  if (!adisonUid || !clickKey || !pubCode || !pubAppCode) {
    throw new HttpsError('invalid-argument', 'normalized params empty')
  }

  // ---- 해시 + 샤드 결정 ----
  const adisonUidHash = hashAdisonUid(adisonUid)
  const clickKeyHash = hashClickKey(clickKey)
  const shardIndex = shardIndexFromHash(adisonUidHash)

  // ---- Firestore 참조 ----
  const gameRef = db.doc(`games/${gameId}`)
  const claimRef = gameRef.collection('claims').doc(adisonUidHash)
  const playerRef = gameRef.collection('players').doc(userId)
  const counterRefs = Array.from({ length: 10 }, (_, i) => gameRef.collection('counters').doc(`alive_${i}`))

  // ---- 트랜잭션 ----
  type Result =
    | { status: 'joined' | 'rejoined'; aliveShardIndex: number; phase: string; currentRound: number }
    | { status: 'rejected_already_in_other_session'; phase: string; currentRound: number }
    | { status: 'rejected_other_adison_uid'; phase: string; currentRound: number }
    | { status: 'rejected_phase'; phase: string; currentRound: number; reason: string }
    | { status: 'rejected_full'; phase: string; currentRound: number; capacity: number; aliveCount: number }

  const result: Result = await db.runTransaction(async tx => {
    // 1) games/{gameId} 존재 + 페이즈 확인
    const gameSnap = await tx.get(gameRef)
    if (!gameSnap.exists) {
      throw new HttpsError('failed-precondition', 'game not found')
    }
    const game = gameSnap.data()!
    const phase = game.phase as string
    const currentRound = (game.currentRound as number) ?? 0
    const closesAt = game.closesAt as Timestamp | undefined
    const capacity = (game.capacity as number) ?? 0

    // 2) claims + player 동시 read
    const [claimSnap, playerSnap] = await Promise.all([tx.get(claimRef), tx.get(playerRef)])

    // 3) 재호출 분기 (docs/guide/07 §7.4.3 ~ §7.4.4)

    // 3-a) 본인 재호출 — claims 가 본인 것이고 player 도 존재
    if (claimSnap.exists && claimSnap.data()!.userId === userId) {
      // 모든 페이즈에서 idempotent 정상 응답 (waiting/countdown/select/reveal/ended 모두)
      const ps = playerSnap.exists ? playerSnap.data()! : null
      const aliveShardIndex = (ps?.aliveShardIndex as number) ?? shardIndex
      logger.info('[joinGame] rejoined (same session)', { userId, adisonUidHash, phase })
      return {
        status: 'rejoined' as const,
        aliveShardIndex,
        phase,
        currentRound
      }
    }

    // 3-b) claims 가 다른 사용자 소유 — 같은 adisonUid 의 다른 세션
    if (claimSnap.exists && claimSnap.data()!.userId !== userId) {
      logger.info('[joinGame] rejected_already_in_other_session', { userId, adisonUidHash, phase })
      return {
        status: 'rejected_already_in_other_session' as const,
        phase,
        currentRound
      }
    }

    // 3-c) claims 는 없는데 본인 player 가 이미 있음 — 다른 adisonUid 로 재진입
    if (!claimSnap.exists && playerSnap.exists) {
      logger.info('[joinGame] rejected_other_adison_uid', { userId, phase })
      return {
        status: 'rejected_other_adison_uid' as const,
        phase,
        currentRound
      }
    }

    // 4) 신규 입장 — phase 검증
    if (phase !== 'waiting') {
      logger.info('[joinGame] rejected_phase (not waiting)', { phase, userId })
      return {
        status: 'rejected_phase' as const,
        phase,
        currentRound,
        reason: 'phase_not_waiting'
      }
    }

    // 5) 입장 마감 시각 검증 — 서버 시간 기준
    if (closesAt && Timestamp.now().toMillis() > closesAt.toMillis()) {
      logger.info('[joinGame] rejected_phase (closesAt passed)', { userId })
      return {
        status: 'rejected_phase' as const,
        phase,
        currentRound,
        reason: 'closes_at_passed'
      }
    }

    // 6) 정원 검증 — 검증 단계 단순 합산 admission
    //    docs/guide/07 §7.3.5 (b) 근사 admission gate 의 단순 변형.
    //    1만 동접 운영 단계엔 별도 roll-up 캐시로 교체 필요.
    const counterSnaps = await Promise.all(counterRefs.map(ref => tx.get(ref)))
    const aliveCount = counterSnaps.reduce((sum, snap) => sum + (snap.exists ? ((snap.data()!.count as number) ?? 0) : 0), 0)

    if (capacity > 0 && aliveCount >= capacity) {
      logger.info('[joinGame] rejected_full', { aliveCount, capacity })
      return {
        status: 'rejected_full' as const,
        phase,
        currentRound,
        capacity,
        aliveCount
      }
    }

    // 7) 신규 입장 처리 — claims + player + counter 동시 갱신
    const now = FieldValue.serverTimestamp()

    tx.create(claimRef, {
      userId,
      adisonUidHash,
      clickKeyHash,
      pubCode,
      nickname,
      claimedAt: now
    })

    tx.create(playerRef, {
      nickname,
      adisonUid,
      adisonUidHash,
      clickKey,
      advertisingId,
      pubCode,
      pubAppCode,
      aliveShardIndex: shardIndex,
      status: 'alive',
      eliminatedRound: null,
      choice: null,
      choiceRound: null,
      choiceSubmittedAt: null,
      lastProcessedRound: 0,
      joinedAt: now
    })

    // counters/alive_{shardIndex} 가 없을 수도 있어 set + merge 패턴 + increment
    tx.set(
      counterRefs[shardIndex],
      {
        count: FieldValue.increment(1),
        updatedAt: now
      },
      { merge: true }
    )

    logger.info('[joinGame] joined', { userId, adisonUidHash, shardIndex, phase })
    return {
      status: 'joined' as const,
      aliveShardIndex: shardIndex,
      phase,
      currentRound
    }
  })

  // ---- 응답 ----
  // playerId 는 status 가 joined / rejoined 일 때만 의미 있음.
  if (result.status === 'joined' || result.status === 'rejoined') {
    return {
      ...result,
      playerId: userId
    }
  }
  return result
})

// =====================================================================
// 2. submitChoice (Callable) — 손 선택 제출 (M2/T05)
// =====================================================================
export const submitChoice = onCall({ region: FUNCTION_REGION }, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'auth required')
  }
  logger.info('[submitChoice] stub called', { uid: request.auth.uid })
  throw new HttpsError('unimplemented', 'submitChoice not implemented yet (M2/T05)')
})

// =====================================================================
// 3. submitWinnerInfo (Callable) — 우승자 개인정보 제출 (M2/T09)
// =====================================================================
export const submitWinnerInfo = onCall({ region: FUNCTION_REGION }, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'auth required')
  }
  logger.info('[submitWinnerInfo] stub called', { uid: request.auth.uid })
  throw new HttpsError('unimplemented', 'submitWinnerInfo not implemented yet (M2/T09)')
})

// =====================================================================
// 4. startRound (HTTP) — waiting/reveal → countdown 전이 (M2/T06)
// =====================================================================
export const startRound = onRequest({ region: FUNCTION_REGION }, async (_req, res) => {
  logger.info('[startRound] stub called')
  res.status(501).send('startRound not implemented yet (M2/T06)')
})

// =====================================================================
// 5. beginSelect (HTTP) — countdown → select 전이 (M2/T06)
// =====================================================================
export const beginSelect = onRequest({ region: FUNCTION_REGION }, async (_req, res) => {
  logger.info('[beginSelect] stub called')
  res.status(501).send('beginSelect not implemented yet (M2/T06)')
})

// =====================================================================
// 6. endRound (HTTP) — select → reveal 전이 + batch manifest (M2/T07)
// =====================================================================
export const endRound = onRequest({ region: FUNCTION_REGION }, async (_req, res) => {
  logger.info('[endRound] stub called')
  res.status(501).send('endRound not implemented yet (M2/T07)')
})

// =====================================================================
// 7. processBatch (Pub/Sub) — 1000명 단위 분산 승패 판정 (M2/T08)
// =====================================================================
export const processBatch = onMessagePublished(
  { region: FUNCTION_REGION, topic: 'process-batch' },
  async event => {
    logger.info('[processBatch] stub called', { messageId: event.id })
    throw new Error('processBatch not implemented yet (M2/T08)')
  }
)
