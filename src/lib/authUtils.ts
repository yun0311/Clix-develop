//로그인 시도 횟수 제한 및 로그인 일지제한
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'

const MAX_ATTEMPTS = 5
const BLOCK_DURATION = 10 * 60 * 1000 // 10분 블록ed
const TTL_DURATION = 30 * 60 * 1000 // 30분 후 db 삭제

export async function handleLoginAttempt(email: string): Promise<{
  blocked: boolean
  count: number
  message?: string
}> {
  const ref = doc(db, 'loginAttempts', email)
  const snap = await getDoc(ref)

  const now = Date.now()

  if (snap.exists()) {
    const data = snap.data()
    const blockedUntil = data.blockedUntil?.toDate()?.getTime() || 0

    if (now < blockedUntil) {
      return {
        blocked: true,
        count: data.count,
        message: '5회 이상 로그인 실패로 10분 동안 로그인할 수 없습니다.',
      }
    }

    const newCount = data.count + 1
    const updates: any = {
      count: newCount,
      lastAttemptAt: serverTimestamp(),
      expireAt: new Date(now + TTL_DURATION),
    }

    if (newCount >= MAX_ATTEMPTS) {
      updates.blockedUntil = new Date(now + BLOCK_DURATION)
    }

    await updateDoc(ref, updates)

    return {
      blocked: newCount >= MAX_ATTEMPTS,
      count: newCount,
      message:
        newCount === 3
          ? '비밀번호를 다시 확인해주세요.'
          : newCount === 4
          ? '마지막 로그인 기회입니다. 비밀번호 변경을 권장합니다.'
          : newCount >= MAX_ATTEMPTS
          ? '5회 이상 로그인 실패로 10분 동안 로그인할 수 없습니다.'
          : undefined,
    }
  } else {
    await setDoc(ref, {
      count: 1,
      lastAttemptAt: serverTimestamp(),
      expireAt: new Date(now + TTL_DURATION),
    })

    return {
      blocked: false,
      count: 1,
      message: undefined,
    }
  }
}

export async function resetLoginAttempt(email: string) {
  const ref = doc(db, 'loginAttempts', email)
  await setDoc(ref, {
    count: 0,
    lastAttemptAt: serverTimestamp(),
    expireAt: new Date(Date.now() + TTL_DURATION),
  })
}
