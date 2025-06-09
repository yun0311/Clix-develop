'use client'

import { useState } from 'react'
import Head from 'next/head'
import styles from '../signup/signup.module.css'
import {
  sendSignInLinkToEmail,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { auth, db } from '@/firebase/firebase'
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { useRouter } from 'next/navigation'

export default function Signup() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [nameError, setNameError] = useState('')

  const [emailTouched, setEmailTouched] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    setEmailError(
      emailRegex.test(value) ? '' : '올바른 이메일 형식이 아닙니다.'
    )
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassword(value)
    setPasswordError(
      value.length >= 8 ? '' : '비밀번호는 최소 8자 이상이어야 합니다.'
    )
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setName(value)
    setNameError(value.trim() === '' ? '이름을 입력해주세요.' : '')
  }

  //  이메일 인증 링크 전송
  const handleSendVerification = async () => {
    if (!email) return alert('이메일을 입력해주세요.')

    const userRef = doc(db, 'users', email)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      alert('이미 가입된 사용자입니다.')
      return
    }

    const pendingRef = doc(db, 'pendingUsers', email)
    const pendingSnap = await getDoc(pendingRef)

    if (pendingSnap.exists()) {
      const { requestedAt } = pendingSnap.data()
      const now = Timestamp.now()
      const expired = now.seconds - requestedAt.seconds > 600

      if (!expired) {
        alert('이미 이메일이 전송되었습니다. 이메일을 확인해주세요.')
        return
      } else {
        await deleteDoc(pendingRef)
      }
    }

    const actionCodeSettings = {
      url: 'http://localhost:3000/verify?email=' + encodeURIComponent(email),
      handleCodeInApp: true,
    }

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings)

      await setDoc(pendingRef, {
        email,
        isVerified: false,
        requestedAt: Timestamp.now(),
      })

      localStorage.setItem('emailForSignIn', email)
      alert('인증 이메일이 전송되었습니다. 이메일을 확인해주세요.')
      setEmailSent(true)
    } catch (error) {
      console.error('인증 이메일 전송 실패:', error)
      alert('인증 메일 전송에 실패했습니다.')
    }
  }

  //  회원가입 처리
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password || !name) {
      alert('모든 정보를 입력해주세요.')
      return
    }

    if (password.length < 8) {
      setPasswordError('비밀번호는 최소 8자 이상이어야 합니다.')
      return
    }

    if (name.trim() === '') {
      setNameError('이름을 입력해주세요.')
      return
    }

    const pendingRef = doc(db, 'pendingUsers', email)
    const pendingSnap = await getDoc(pendingRef)

    if (!pendingSnap.exists()) {
      alert('이메일 인증을 먼저 진행해주세요.')
      return
    }

    const { isVerified, requestedAt } = pendingSnap.data()
    const now = Timestamp.now()

    if (now.seconds - requestedAt.seconds > 600) {
      await deleteDoc(pendingRef)
      alert('이메일 인증 유효시간이 만료되었습니다. 다시 인증해주세요.')
      return
    }

    if (!isVerified) {
      alert('이메일 인증이 아직 완료되지 않았습니다.')
      return
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      )

      const uid = userCredential.user.uid

      await setDoc(doc(db, 'users', email), {
        uid,
        email,
        name,
        role: email === 'rjsgns01@naver.com' ? 'admin' : 'user',
        createdAt: serverTimestamp(),
      })

      await deleteDoc(pendingRef)

      alert('회원가입이 완료되었습니다!')
      router.push('/login')
    } catch (error) {
      console.error('회원가입 실패:', error)
      alert('회원가입 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>회원가입</title>
      </Head>

      <h1 className={styles.title}>회원가입</h1>

      <form className={styles.form} onSubmit={handleSignup}>
        {/* 이메일 */}
        <div className={styles.emailRow}>
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            onBlur={() => setEmailTouched(true)}
            placeholder="email을 입력해주세요."
            className={styles.input}
          />
          <button
            type="button"
            className={styles.verifyButton}
            onClick={handleSendVerification}
          >
            인증
          </button>
        </div>
        {emailTouched && emailError && (
          <p className={styles.error}>{emailError}</p>
        )}
        {emailSent && (
          <p className={styles.success}>인증 이메일이 전송되었습니다!</p>
        )}

        {/* 비밀번호 */}
        <input
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="비밀번호를 입력해주세요."
          className={styles.input}
        />
        {passwordError && <p className={styles.error}>{passwordError}</p>}

        {/* 이름 */}
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="이름을 입력해주세요."
          className={styles.input}
        />
        {nameError && <p className={styles.error}>{nameError}</p>}

        <button type="submit" className={styles.button}>
          회원가입
        </button>
      </form>
    </div>
  )
}
