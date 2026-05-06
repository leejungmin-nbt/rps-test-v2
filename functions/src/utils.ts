// =====================================================================
// 공용 유틸 — 정규화, 해시, 샤드 매핑
// =====================================================================
// docs/guide/06 §6.6, §6.8.6 정규화·해시 정본
// docs/guide/07 §7.3.2 분산 샤드 카운터
// docs/guide/08 §8.9 샤드 매핑 함수 정본
// =====================================================================

import { createHash } from 'crypto'

/**
 * URL 파라미터 정규화 — NFC normalize + trim.
 * 대소문자는 보존. 빈 문자열은 호출자가 별도 검증한다.
 */
export function normalizeParam(raw: string): string {
  return raw.normalize('NFC').trim()
}

/**
 * adisonUidHash — sha256(normalize(adisonUid)) 64자 hex.
 * claims 문서 ID 와 동일 값을 사용한다.
 */
export function hashAdisonUid(rawAdisonUid: string): string {
  const normalized = normalizeParam(rawAdisonUid)
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/**
 * clickKeyHash — claims 문서의 운영 모니터링용 필드.
 * 차단 키로는 사용하지 않는다 (차단 키는 adisonUidHash).
 */
export function hashClickKey(rawClickKey: string): string {
  const normalized = normalizeParam(rawClickKey)
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/**
 * 샤드 인덱스 결정 — adisonUidHash 의 앞 8자(hex 32-bit) 를
 * 정수로 변환 후 mod 10.
 *
 * docs/guide/08 §8.9 정본:
 *   - 64자 전체를 정수 변환하면 JS 안전 정수 한도(2^53) 초과
 *   - 앞 8자(2^32) 만 사용하면 안전하고 분포도 균등
 *   - 결정적이라 입장-탈락 샤드 대칭성 자연 만족
 */
export function shardIndexFromHash(adisonUidHash: string): number {
  if (adisonUidHash.length < 8) {
    throw new Error('adisonUidHash too short (expected 64 hex chars)')
  }
  return parseInt(adisonUidHash.slice(0, 8), 16) % 10
}

/**
 * 검증 단계 임시 닉네임 생성기.
 * 운영 시점에는 docs/guide/05 정본의 한국어 형용사+명사 사전을 사용한다.
 */
export function generateGuestNickname(): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `guest_${suffix}`
}
