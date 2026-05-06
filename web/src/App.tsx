// =====================================================================
// 가위바위보 챌린지 v2 — 클라이언트 진입점
// =====================================================================
// 본 파일은 라우팅 + 5종 URL 파라미터 검증 + 익명 Auth 까지 처리한다.
// 페이즈별 게임 화면(waiting/countdown/select/reveal/ended)은 M3
// (T10~T13) 에서 본격 구현한다.
//
// 라우팅:
//   /         → 검증용 진입 폼 (uid/click_key 등 5종 파라미터 입력)
//   /event    → 이벤트 게임 화면 (5종 파라미터 + 익명 Auth + joinGame)
//   기타       → ErrorPage
// =====================================================================

import { useEffect, useState } from 'react'

import s from './App.module.scss'
import { ensureAnonymousAuth } from './firebase'
import type { UrlParams } from './types'

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
// URL 파라미터 파싱 — 5종 (uid, advertising_id, click_key, pub_code, pub_app_code)
// =====================================================================
// docs/guide/06 §6.6 정본:
//   - uid, click_key, pub_code, pub_app_code 4종은 필수
//   - advertising_id 는 nullable
//   - 모든 값은 trim 후 빈 문자열 거부
//   - 길이 제한은 보수적으로 1~256자 (DoS 방지 + 비정상 입력 차단)
// =====================================================================
const MAX_PARAM_LENGTH = 256

function parseUrlParams(search: string): UrlParams | null {
  const sp = new URLSearchParams(search)
  const uid = sp.get('uid')?.trim() ?? ''
  const advertising_id = sp.get('advertising_id')?.trim() || null
  const click_key = sp.get('click_key')?.trim() ?? ''
  const pub_code = sp.get('pub_code')?.trim() ?? ''
  const pub_app_code = sp.get('pub_app_code')?.trim() ?? ''

  // 필수 4종
  if (!uid || !click_key || !pub_code || !pub_app_code) return null

  // 길이 검증 (DoS · 비정상 입력 차단)
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
// 진입 페이지 (검증용) — 5종 파라미터 랜덤 생성 + 입장
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
// 이벤트 페이지 — 익명 Auth 발급 후 게임 화면 진입
// =====================================================================
// 흐름:
//   1. 익명 Auth 로그인 (sessionStorage persistence — 탭별 독립)
//   2. (M3 에서 추가) joinGame Callable 호출 → 입장 처리
//   3. (M3 에서 추가) games/active onSnapshot 구독 → 페이즈별 화면 분기
// =====================================================================
function EventPage({ params }: { params: UrlParams }) {
  const [authStatus, setAuthStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const user = await ensureAnonymousAuth()
        if (cancelled) return
        setFirebaseUid(user.uid)
        setAuthStatus('ready')
      } catch (e) {
        if (cancelled) return
        setError((e as Error).message)
        setAuthStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (authStatus === 'error') {
    return <ErrorPage title='⚠ 인증 실패' description={error ?? '익명 로그인 처리 중 문제가 발생했습니다.'} />
  }

  if (authStatus === 'loading') {
    return (
      <div className={s.container}>
        <h1 className={s.title}>가위바위보 챌린지</h1>
        <section className={`${s.panel} ${s.panelInfo}`}>
          <div className={s.panelBody}>입장 처리 중...</div>
        </section>
      </div>
    )
  }

  return (
    <div className={s.container}>
      <h1 className={s.title}>이벤트 페이지 (M1 — Auth 완료)</h1>

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
        <div className={s.panelHeader}>Firebase 인증 상태</div>
        <div className={s.panelBody}>
          <div>
            익명 UID: <code>{firebaseUid}</code>
          </div>
          <div className={s.helper}>다음 단계: M2 에서 joinGame 호출 + 페이즈 화면 구현 예정</div>
        </div>
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
