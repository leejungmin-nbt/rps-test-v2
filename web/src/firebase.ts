// =====================================================================
// Firebase 환경 설정 — 단일 환경 (검증용)
// =====================================================================
// 현재: 단일 환경 (rps-test-e524c) 사용
//
// ─────────────────────────────────────────────────────────────────────
// 향후 dev/prd 분리 시 가이드 (예시)
// ─────────────────────────────────────────────────────────────────────
//
//   1) Firebase 콘솔에서 PRD 프로젝트 신규 생성 + 웹 앱 등록 → firebaseConfig 발급
//
//   2) 환경 변수 파일 분리 (web/ 디렉토리 안에):
//      .env.development → DEV firebaseConfig 값
//      .env.production  → PRD firebaseConfig 값
//
//      예시 (.env.production):
//        VITE_FIREBASE_API_KEY=AIza...prod
//        VITE_FIREBASE_AUTH_DOMAIN=rps-prod-xxxx.firebaseapp.com
//        VITE_FIREBASE_PROJECT_ID=rps-prod-xxxx
//        VITE_FIREBASE_APP_ID=1:xxxxx:web:prod...
//        VITE_FIREBASE_MESSAGING_SENDER_ID=xxxxx
//        VITE_FIREBASE_STORAGE_BUCKET=rps-prod-xxxx.firebasestorage.app
//
//   3) 아래 firebaseConfig 객체를 import.meta.env 참조로 변경:
//        const firebaseConfig = {
//          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//          appId: import.meta.env.VITE_FIREBASE_APP_ID,
//          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//        }
//
//   4) Vite 가 빌드 모드에 따라 자동으로 알맞은 .env 파일 선택:
//        npm run dev       → .env.development
//        npm run build     → .env.production
//
//   5) .firebaserc 에 alias 등록:
//        { "projects": { "dev": "rps-test-e524c", "prd": "rps-prod-xxxx" } }
//
//   6) 배포:
//        firebase use dev && firebase deploy   → DEV 배포
//        firebase use prd && firebase deploy   → PRD 배포
//
// 즉, 코드 한 줄도 안 바꾸고 빌드 명령만으로 환경 전환됨.
// =====================================================================

import { initializeApp } from 'firebase/app'
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  signInAnonymously,
  type User
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'

// 단일 환경 firebaseConfig (rps-test-e524c)
const firebaseConfig = {
  apiKey: 'AIzaSyBKtR5xnrJ1CXTqCXJyG2IDxWMHH4Mh1Zs',
  authDomain: 'rps-test-e524c.firebaseapp.com',
  projectId: 'rps-test-e524c',
  storageBucket: 'rps-test-e524c.firebasestorage.app',
  messagingSenderId: '802585496366',
  appId: '1:802585496366:web:f68e10a6bd12106071c8bf'
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
// functions region 은 docs/guide/08 §8.7 정본에 따라 asia-northeast3 사용
export const functions = getFunctions(app, 'asia-northeast3')

// 로컬 에뮬레이터 연결 (npm run dev 시점)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, 'localhost', 8080)
  connectFunctionsEmulator(functions, 'localhost', 5001)
}

// =====================================================================
// 익명 인증 헬퍼
// =====================================================================
// docs/guide/05 정본:
//   - Firebase Anonymous Auth 로 무료·무제한 익명 UID 발급
//   - 탭별 독립 세션을 위해 sessionStorage persistence 사용
//     (다중 탭 검증 시 각 탭이 별도 익명 UID 받도록)
// =====================================================================

let persistenceReady: Promise<void> | null = null

export async function ensureAnonymousAuth(): Promise<User> {
  if (!persistenceReady) {
    persistenceReady = setPersistence(auth, browserSessionPersistence)
  }
  await persistenceReady
  if (auth.currentUser) return auth.currentUser
  const cred = await signInAnonymously(auth)

  return cred.user
}
