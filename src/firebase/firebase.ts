// lib/firebase.ts
import { initializeApp, getApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Firebase config (환경변수에서 가져옴)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Firebase 초기화 (중복 방지)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
console.log('Firebase API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY)

// 필요한 Firebase 서비스 초기화
const db = getFirestore(app)
const auth = getAuth(app)
const storage = getStorage(app)

export { db, app, auth, storage } // 다른 파일에서 사용할 수 있도록 내보내는 부분
export default app
