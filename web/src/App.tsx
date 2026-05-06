// =====================================================================
// 가위바위보 챌린지 v2 — 클라이언트 진입점
// =====================================================================
// 라우팅 + 5종 URL 파라미터 검증 + 익명 Auth + joinGame 호출까지 처리.
// 페이즈별 게임 화면(countdown/select/reveal/ended)은 M3 (T11~T13) 에서 구현.
//
// 라우팅:
//   /         → 검증용 진입 폼 (uid/click_key 등 5종 파라미터 입력)
//   /event    → 이벤트 게임 화면 (5종 파라미터 + 익명 Auth + joinGame)
//   기타       → ErrorPage
// =====================================================================

import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'

import s from './App.module.scss'
import { ensureAnonymousAuth, functions } from './firebase'
import type { UrlParams } from './types'

// =====================================================================
// joinGame Callable 핸들러
// =====================================================================
// docs/guide/06/07/08 정본의 입장 트랜잭션 호출.
type JoinGameRequest = {
  gameId: string
  uid: string
  advertising_id: string | null
  click_key: string
  pub_code: string
  pub_app_code: string
  nickname?: string
}

type JoinGameResponse =
  | { status: 'joined' | 'rejoined'; playerId: string; aliveShardIndex: number; phase: string; currentRound: number }
  | { status: 'rejected_already_in_other_session'; phase: string; currentRound: number }
  | { status: 'rejected_other_adison_uid'; phase: string; currentRound: number }
  | { status: 'rejected_phase'; phase: string; currentRound: number; reason: string }
  | { status: 'rejected_full'; phase: string; currentRound: number; capacity: number; aliveCount: number }

const joinGameFn = httpsCallable<JoinGameRequest, JoinGameResponse>(functions, 'joinGame')

// 활성 게임 ID — 검증 단계엔 'active' 단일 사용
const ACTIVE_GAME_ID = 'active'

// =====================================================================
// 라우팅 — pathname + 쿼리파라미터로 화면 분기
// =====================================================================
export default function App() {
  const path = window.location.pathname
  const params = parseUrlParams(window.location.search)

  if (path === '/event') {
    if (!params) {
      return (
        <ErrorPage
          title='⚠ 유효하지 않은 입장입니다'
          description='필수 URL 파라미터(uid, click_key, pub_code, pub_app_code)가 누락되었거나 형식이 올바르지 않습니다. 정상적인 경로로 다시 진입해주세요.'
        />
      )
    }
    return <EventPage params={params} />
  }

  return <RegisterPage />
}

// =====================================================================
// URL 파라미터 파싱
// =====================================================================
const MAX_PARAM_LENGTH = 256

function parseUrlParams(search: string): UrlParams | null {
  const sp = new URLSearchParams(search)
  const uid = sp.get('uid')?.trim() ?? ''
  const advertising_id = sp.get('advertising_id')?.trim() || null
  const click_key = sp.get('click_key')?.trim() ?? ''
  const pub_code = sp.get('pub_code')?.trim() ?? ''
  const pub_app_code = sp.get('pub_app_code')?.trim() ?? ''

  if (!uid || !click_key || !pub_code || !pub_app_code) return null
  if (
    uid.length > MAX_PARAM_LENGTH ||
    click_key.length > MAX_PARAM_LENGTH ||
    pub_code.length > MAX_PARAM_LENGTH ||
    pub_app_code.length > MAX_PARAM_LENGTH ||
    (advertising_id !== null && advertising_id.length > MAX_PARAM_LENGTH)
  ) {
    return null
  }

  return { uid, advertising_id, click_key, pub_code, pub_app_code }
}

// =====================================================================
// 진입 페이지 (검증용)
// =====================================================================
function RegisterPage() {
  const [uid, setUid] = useState('')
  const [clickKey, setClickKey] = useState('')
  const [pubCode, setPubCode] = useState('')
  const [pubAppCode, setPubAppCode] = useState('')

  const generateRandom = () => {
    setUid(`user_${Math.random().toString(36).slice(2, 10)}`)
    setClickKey(`click_${Math.random().toString(36).slice(2, 10)}`)
    setPubCode(`pub_${Math.random().toString(36).slice(2, 6)}`)
    setPubAppCode(`pubapp_${Math.random().toString(36).slice(2, 6)}`)
  }

  const enter = () => {
    if (!uid || !clickKey || !pubCode || !pubAppCode) return
    const sp = new URLSearchParams({
      uid,
      click_key: clickKey,
      pub_code: pubCode,
      pub_app_code: pubAppCode
    })
    window.location.href = `/event?${sp.toString()}`
  }

  return (
    <div className={s.container}>
      <h1 className={s.title}>🎮 가위바위보 챌린지 v2 — 검증 진입</h1>
      <p className={s.helper}>실제 운영 시엔 NBT 네이티브 SDK 가 5종 파라미터를 자동으로 전달합니다.</p>

      <section className={`${s.panel} ${s.panelInfo}`}>
        <div className={s.panelHeader}>1. URL 파라미터 입력</div>
        <button onClick={generateRandom} className={s.button}>
          🎲 랜덤 생성
        </button>

        <div className={s.field}>
          <label className={s.label}>uid (자사 사용자 식별자)</label>
          <input value={uid} onChange={e => setUid(e.target.value)} className={s.input} />
        </div>
        <div className={s.field}>
          <label className={s.label}>click_key (지급 확인용)</label>
          <input value={clickKey} onChange={e => setClickKey(e.target.value)} className={s.input} />
        </div>
        <div className={s.field}>
          <label className={s.label}>pub_code (매체사)</label>
          <input value={pubCode} onChange={e => setPubCode(e.target.value)} className={s.input} />
        </div>
        <div className={s.field}>
          <label className={s.label}>pub_app_code (매체 앱)</label>
          <input value={pubAppCode} onChange={e => setPubAppCode(e.target.value)} className={s.input} />
        </div>
      </section>

      <section className={`${s.panel} ${s.panelBrand}`}>
        <div className={s.panelHeader}>2. 입장</div>
        <button onClick={enter} className={s.buttonPrimary} disabled={!uid || !clickKey || !pubCode || !pubAppCode}>
          이벤트 입장 →
        </button>
      </section>
    </div>
  )
}

// =====================================================================
// 이벤트 페이지 — 익명 Auth → joinGame 호출 → 결과 분기
// =====================================================================
type Stage =
  | { kind: 'auth_loading' }
  | { kind: 'join_loading'; firebaseUid: string }
  | { kind: 'join_done'; firebaseUid: string; result: JoinGameResponse }
  | { kind: 'error'; message: string }

function EventPage({ params }: { params: UrlParams }) {
  const [stage, setStage] = useState<Stage>({ kind: 'auth_loading' })

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const user = await ensureAnonymousAuth()
        if (cancelled) return
        setStage({ kind: 'join_loading', firebaseUid: user.uid })

        const res = await joinGameFn({
          gameId: ACTIVE_GAME_ID,
          uid: params.uid,
          advertising_id: params.advertising_id,
          click_key: params.click_key,
          pub_code: params.pub_code,
          pub_app_code: params.pub_app_code
        })
        if (cancelled) return

        setStage({ kind: 'join_done', firebaseUid: user.uid, result: res.data })
      } catch (e) {
        if (cancelled) return
        setStage({ kind: 'error', message: (e as Error).message })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [params])

  if (stage.kind === 'error') {
    return <ErrorPage title='⚠ 입장 실패' description={stage.message} />
  }

  if (stage.kind === 'auth_loading' || stage.kind === 'join_loading') {
    return (
      <div className={s.container}>
        <h1 className={s.title}>가위바위보 챌린지</h1>
        <section className={`${s.panel} ${s.panelInfo}`}>
          <div className={s.panelBody}>
            {stage.kind === 'auth_loading' ? '익명 로그인 중...' : '입장 처리 중...'}
          </div>
        </section>
      </div>
    )
  }

  // join_done — status 별 분기
  return <JoinResultView params={params} firebaseUid={stage.firebaseUid} result={stage.result} />
}

// =====================================================================
// joinGame 결과 화면
// =====================================================================
function JoinResultView({
  params,
  firebaseUid,
  result
}: {
  params: UrlParams
  firebaseUid: string
  result: JoinGameResponse
}) {
  const isJoined = result.status === 'joined' || result.status === 'rejoined'

  return (
    <div className={s.container}>
      <h1 className={s.title}>이벤트 페이지 (M2 — joinGame 호출 완료)</h1>

      <section className={`${s.panel} ${s.panelInfo}`}>
        <div className={s.panelHeader}>전달받은 URL 파라미터</div>
        <div className={s.panelBody}>
          <div>
            uid: <code>{params.uid}</code>
          </div>
          <div>
            click_key: <code>{params.click_key}</code>
          </div>
          <div>
            pub_code: <code>{params.pub_code}</code>
          </div>
          <div>
            pub_app_code: <code>{params.pub_app_code}</code>
          </div>
          <div>
            advertising_id: <code>{params.advertising_id ?? '(없음)'}</code>
          </div>
        </div>
      </section>

      <section className={`${s.panel} ${s.panelInfo}`}>
        <div className={s.panelHeader}>Firebase 인증</div>
        <div className={s.panelBody}>
          <div>
            익명 UID: <code>{firebaseUid}</code>
          </div>
        </div>
      </section>

      <section className={`${s.panel} ${isJoined ? s.panelBrand : s.panelDanger}`}>
        <div className={s.panelHeader}>joinGame 결과</div>
        <div className={s.panelBody}>
          <div>
            status: <b>{result.status}</b>
          </div>
          <div>
            phase: <code>{result.phase}</code> | currentRound: <code>{result.currentRound}</code>
          </div>
          {result.status === 'joined' || result.status === 'rejoined' ? (
            <div>
              playerId: <code>{result.playerId}</code> | aliveShardIndex: <code>{result.aliveShardIndex}</code>
            </div>
          ) : null}
          {result.status === 'rejected_phase' && (
            <div className={s.helper}>거부 사유: {result.reason}</div>
          )}
          {result.status === 'rejected_full' && (
            <div className={s.helper}>
              정원 초과 — capacity {result.capacity} / aliveCount {result.aliveCount}
            </div>
          )}
        </div>
      </section>

      <section className={`${s.panel} ${s.panelInfo}`}>
        <div className={s.panelHeader}>다음 단계 (M3)</div>
        <div className={s.panelBody}>페이즈별 화면 (countdown / select / reveal / ended) 은 T10~T13 에서 구현.</div>
      </section>
    </div>
  )
}

// =====================================================================
// 에러 화면
// =====================================================================
function ErrorPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className={s.container}>
      <section className={`${s.panel} ${s.panelDanger}`}>
        <h1 className={s.errorTitle}>{title}</h1>
        {description && <p className={s.errorDescription}>{description}</p>}
        <p>
          <a href='/' className={s.errorBack}>
            처음으로 돌아가기
          </a>
        </p>
      </section>
    </div>
  )
}
