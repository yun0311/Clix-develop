'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/firebase/firebase'
import { toast } from 'react-hot-toast'

//  실패 횟수 제한 유틸 함수
import { handleLoginAttempt, resetLoginAttempt } from '@/lib/authUtils'

export default function Login() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/')
      } else {
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [router])

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      setEmailError('올바른 이메일 형식이 아닙니다.')
    } else {
      setEmailError('')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error('이메일과 비밀번호를 모두 입력해주세요.')
      return
    }

    if (emailError) {
      toast.error('이메일 형식이 올바르지 않습니다.')
      return
    }

    //  Firestore로 실패 횟수 확인
    const { blocked, count, message } = await handleLoginAttempt(email)

    if (blocked) {
      toast.error(message || '로그인 차단 중입니다. 잠시 후 시도해주세요.')
      return
    }

    try {
      await signInWithEmailAndPassword(auth, email, password)

      //  성공 시 실패 기록 초기화
      await resetLoginAttempt(email)

      toast.success('로그인 성공!')
      router.push('/')
    } catch (error) {
      console.error('로그인 실패:', error)

      // 실패 횟수에 따른 안내 메시지 출력
      if (message) toast.error(message)
      else toast.error('이메일 또는 비밀번호가 일치하지 않습니다.')
    }
  }

  if (loading) return null

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>로그인</h1>

      <form onSubmit={handleLogin} className={styles.form}>
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          onBlur={() => setEmailTouched(true)}
          placeholder="email을 입력해주세요."
          className={styles.input}
        />
        {emailTouched && emailError && (
          <p className={styles.error}>{emailError}</p>
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호를 입력해주세요."
          className={styles.input}
        />

        <button type="submit" className={styles.button}>
          로그인
        </button>
      </form>

      <div className={styles.links}>
        <a href="/forgotPassword">비밀번호 찾기</a> /{' '}
        <a href="/signup">회원가입</a>
      </div>
    </div>
  )
}
