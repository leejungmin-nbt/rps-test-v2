// =====================================================================
// 데이터 모델 타입 정의 (Firestore 컬렉션 contract)
// =====================================================================
// docs/guide/06 (데이터 모델 및 보안 정책) 정본 기준.
// 클라이언트 / 서버 모두에서 같은 타입을 공유한다.
//
// 컬렉션 트리:
//   appState/activeGameId            (활성 게임 포인터)
//   games/{gameId}                   (게임 공통 상태 — 공개)
//     ├ players/{userId}             (참가자 — 본인만 read)
//     ├ rounds/{roundNumber}         (라운드 상태 + 공개 집계)
//     │   └ batches/{i}              (배치 처리 상태 — restricted)
//     ├ claims/{adisonUidHash}       (중복 참여 차단 — restricted)
//     ├ counters/alive_{0~9}         (분산 샤드 카운터 — restricted)
//     ├ result/summary               (우승 결과 — restricted)
//     └ winnerPrivate/summary        (우승자 개인정보 — restricted)
// =====================================================================

import type { Timestamp } from 'firebase/firestore'

// ---------- 공통 enum ----------

export type Choice = 'rock' | 'scissors' | 'paper'

export type GamePhase = 'waiting' | 'countdown' | 'select' | 'reveal' | 'ended'
export type RoundPhase = 'countdown' | 'select' | 'reveal'

export type PlayerStatus = 'alive' | 'eliminated'
export type BatchStatus = 'pending' | 'processing' | 'done' | 'failed'

export type EndedReason = 'winner' | 'carryover'
export type EliminationReason = 'lose' | 'tie' | 'no_choice' | 'rejoin'

// ---------- appState/activeGameId ----------

export interface AppState {
  gameId: string
  updatedAt: Timestamp
}

// ---------- games/{gameId} (공개) ----------

export interface Game {
  phase: GamePhase
  currentRound: number // 0 = 시작 전, 1+ = 진행 중

  // 시각
  closesAt: Timestamp // 입장 마감
  roundEndsAt: Timestamp | null // 현재 select 페이즈 마감

  // 캐시 (분산 카운터 합산 결과)
  totalPlayers: number
  aliveCount: number

  // 결과 (게임 종료 시 채워짐)
  winnerNickname: string | null // 공개 표시용 (winnerId 는 result/summary 에)
  endedReason: EndedReason | null
  finishedAt: Timestamp | null

  updatedAt: Timestamp

  // 게임 룰 설정 (운영자가 사전 입력)
  countdownDurationMs: number
  selectDurationMs: number
  revealDurationMs: number
  maxRounds: number
  capacity: number
}

// ---------- games/{gameId}/players/{userId} (private own-read) ----------
// 문서 ID = Firebase Anonymous Auth UID

export interface Player {
  // 표시
  nickname: string

  // URL 파라미터 5종 (private own-read)
  adisonUid: string // URL `uid` 원본
  adisonUidHash: string // sha256 결과, claims 문서 ID와 동일
  clickKey: string // URL `click_key`
  advertisingId: string | null // URL `advertising_id`
  pubCode: string // URL `pub_code`
  pubAppCode: string // URL `pub_app_code`

  // 입장 시 결정 (탈락 차감 대칭성 보장)
  aliveShardIndex: number // 0 ~ 9

  // 게임 상태
  status: PlayerStatus
  eliminatedRound: number | null

  // 라운드 선택
  choice: Choice | null
  choiceRound: number | null
  choiceSubmittedAt: Timestamp | null

  // 멱등성
  lastProcessedRound: number // processBatch 가 마지막 반영한 라운드

  joinedAt: Timestamp
}

// ---------- games/{gameId}/rounds/{roundNumber} (공개 집계) ----------

export interface Round {
  phase: RoundPhase

  // 시각
  startedAt: Timestamp // 카운트다운 시작
  selectStartsAt: Timestamp // 선택 시작 예정
  endsAt: Timestamp // 선택 마감 예정

  // 결과 (reveal 이후만 채워짐)
  adminChoice: Choice | null // select 마감 전엔 null
  revealedAt: Timestamp | null

  // 집계
  survivorsBefore: number | null
  survivorsAfter: number | null
  eliminatedCount: number | null
  choiceDistribution: { rock: number; scissors: number; paper: number; no_choice: number } | null

  // batch manifest 상태
  manifestStatus: 'building' | 'ready' | 'failed'
  expectedBatchCount: number
  processedBatchCount: number
}

// ---------- games/{gameId}/rounds/{n}/batches/{i} (restricted) ----------

export interface Batch {
  batchIndex: number
  status: BatchStatus

  // 처리 통계
  processedCount: number
  eliminatedCount: number
  survivorCount: number

  // UID range cursor
  startAfterUid: string | null
  endAtUid: string | null
  limit: number // 기본 1000

  // 처리 시각 (lease 판단)
  startedAt: Timestamp
  finishedAt: Timestamp | null
  errorMessage: string | null
}

// ---------- games/{gameId}/claims/{adisonUidHash} (restricted) ----------

export interface Claim {
  userId: string // 선점한 Firebase Auth UID
  adisonUidHash: string // 문서 ID와 동일
  clickKeyHash: string // 운영 모니터링용
  pubCode: string
  nickname: string
  claimedAt: Timestamp
}

// ---------- games/{gameId}/counters/alive_{0~9} (restricted) ----------

export interface Counter {
  count: number
  updatedAt: Timestamp
}

// ---------- games/{gameId}/result/summary (restricted) ----------

export interface ResultSummary {
  winnerId: string // 우승자 Firebase Auth UID
  winnerNickname: string
  winnerClickKey: string
  winnerAdisonUid: string
  winnerAdvertisingId: string | null
  winnerPubCode: string
  winnerPubAppCode: string
  finishedAt: Timestamp

  // 운영자 지급 처리
  delivered: boolean
  deliveredAt: Timestamp | null
  deliveryMemo: string | null
}

// ---------- games/{gameId}/winnerPrivate/summary (restricted) ----------

export interface WinnerPrivate {
  winnerId: string
  name: string
  phone: string
  address: string | null
  privacyConsentAt: Timestamp
  thirdPartyConsentAt: Timestamp | null
  createdAt: Timestamp
}

// ---------- Cloud Function 호출 타입 ----------

export interface JoinGameRequest {
  gameId: string
  uid: string // URL `uid`
  advertising_id: string | null
  click_key: string
  pub_code: string
  pub_app_code: string
  nickname: string
}

export interface JoinGameResponse {
  status: 'joined' | 'already_in'
  playerId: string // = Firebase Auth UID
  aliveShardIndex: number
}

export interface SubmitChoiceRequest {
  gameId: string
  choice: Choice
}

export interface SubmitChoiceResponse {
  status: 'accepted'
}

export interface SubmitWinnerInfoRequest {
  gameId: string
  name: string
  phone: string
  address?: string
  privacyConsentAt: Timestamp
  thirdPartyConsentAt?: Timestamp
}

export interface SubmitWinnerInfoResponse {
  status: 'submitted'
}

// ---------- URL 쿼리 파라미터 ----------

export interface UrlParams {
  uid: string
  advertising_id: string | null
  click_key: string
  pub_code: string
  pub_app_code: string
}
