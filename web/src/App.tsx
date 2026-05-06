// =====================================================================
// 가위바위보 챌린지 v2 — 클라이언트 진입점 (Foundation skeleton)
// =====================================================================
// 본 파일은 M0 의 라우팅·페이즈 화면 stub 만 정의한다.
// 실제 화면 구현은 M3 (T10~T13) 단계에서 진행.
//
// 라우팅:
//   /         → 검증용 진입 폼 (uid/clickKey 등 5종 파라미터 입력)
//   /event    → 이벤트 게임 화면 (5종 파라미터 검증 + joinGame 호출)
//   기타       → ErrorPage
// =====================================================================

import { useEffect, useState } from 'react'

import s from './App.module.scss'
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
          description='필수 URL 파라미터(uid, click_key, pub_code, pub_app_code)가 누락되었습니다. 정상적인 경로로 다시 진입해주세요.'
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
function parseUrlParams(search: string): UrlParams | null {
  const sp = new URLSearchParams(search)
  const uid = sp.get('uid')?.trim() ?? ''
  const advertising_id = sp.get('advertising_id')?.trim() || null
  const click_key = sp.get('click_key')?.trim() ?? ''
  const pub_code = sp.get('pub_code')?.trim() ?? ''
  const pub_app_code = sp.get('pub_app_code')?.trim() ?? ''

  // advertising_id 는 nullable, 나머지 4종은 필수
  if (!uid || !click_key || !pub_code || !pub_app_code) return null

  return { uid, advertising_id, click_key, pub_code, pub_app_code }
}

// =====================================================================
// 진입 페이지 (검증용) — uid/click_key/pub_code/pub_app_code 랜덤 생성
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
// 이벤트 페이지 (M0 stub) — M3 (T10~T13) 에서 본격 구현
// =====================================================================
function EventPage({ params }: { params: UrlParams }) {
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading')

  useEffect(() => {
    // M0 stub — 실제로는 ensureAnonymousAuth → joinGame 호출 → onSnapshot 구독
    const t = setTimeout(() => setPhase('ready'), 500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={s.container}>
      <h1 className={s.title}>이벤트 페이지 (M0 skeleton)</h1>

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
        <div className={s.panelHeader}>현재 상태</div>
        <div className={s.panelBody}>
          {phase === 'loading' ? '로딩 중...' : '준비 완료 (M3 에서 joinGame + 페이즈 화면 구현 예정)'}
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
